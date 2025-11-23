//! Professional CLI command handlers for Zault using zig-clap

const std = @import("std");
const clap = @import("clap");
const Vault = @import("../core/vault.zig").Vault;
const BlockHash = @import("../core/store.zig").BlockHash;

const version = "0.1.0";

// Subcommands enum
const SubCommand = enum {
    init,
    add,
    get,
    list,
    verify,
    share,
    receive,
    import,
    pubkey,
    help,
    version,
};

const main_parsers = .{
    .command = clap.parsers.enumeration(SubCommand),
    .STR = clap.parsers.string,
};

const main_params = clap.parseParamsComptime(
    \\-h, --help           Display this help and exit.
    \\-v, --version        Output version information and exit.
    \\    --vault <STR>    Vault directory path (default: ~/.zault or $ZAULT_PATH).
    \\<command>
    \\
);

pub fn run(allocator: std.mem.Allocator) !void {
    var iter = try std.process.ArgIterator.initWithAllocator(allocator);
    defer iter.deinit();

    // Skip exe name
    _ = iter.next();

    var diag = clap.Diagnostic{};
    var res = clap.parseEx(clap.Help, &main_params, main_parsers, &iter, .{
        .diagnostic = &diag,
        .allocator = allocator,
        .terminating_positional = 0, // Stop after parsing subcommand
    }) catch |err| {
        // Print error to stderr
        std.debug.print("Error: {}\n", .{err});
        return err;
    };
    defer res.deinit();

    // Handle global flags
    if (res.args.help != 0) {
        try printMainHelp();
        return;
    }

    if (res.args.version != 0) {
        try printVersion();
        return;
    }

    // Get vault path (from flag or environment)
    const vault_path = if (res.args.vault) |p|
        try allocator.dupe(u8, p)
    else
        try getVaultPath(allocator);
    defer allocator.free(vault_path);

    // Get subcommand
    const command = res.positionals[0] orelse {
        try printMainHelp();
        return;
    };

    // Dispatch to subcommand
    switch (command) {
        .init => try cmdInit(allocator, &iter, vault_path),
        .add => try cmdAdd(allocator, &iter, vault_path),
        .get => try cmdGet(allocator, &iter, vault_path),
        .list => try cmdList(allocator, &iter, vault_path),
        .verify => try cmdVerify(allocator, &iter, vault_path),
        .share => try cmdShare(allocator, &iter, vault_path),
        .receive => try cmdReceive(allocator, &iter, vault_path),
        .import => try cmdImport(allocator, &iter, vault_path),
        .pubkey => try cmdPubkey(allocator, &iter, vault_path),
        .help => try printMainHelp(),
        .version => try printVersion(),
    }
}

fn printMainHelp() !void {
    const help_text =
        \\Zault v{s} - Post-quantum encrypted storage
        \\
        \\USAGE:
        \\    zault [OPTIONS] <COMMAND>
        \\
        \\OPTIONS:
        \\    -h, --help           Display this help and exit
        \\    -v, --version        Output version information and exit
        \\        --vault <PATH>   Vault directory path (default: ~/.zault or $ZAULT_PATH)
        \\
        \\COMMANDS:
        \\    init                 Initialize a new vault
        \\    add <FILE>          Add file to vault (encrypted)
        \\    get <HASH> [OUT]    Retrieve file by hash (decrypted)
        \\    list                 List all files in vault
        \\    verify <HASH>        Verify block signature
        \\    share <HASH>         Create share token for file (ML-KEM-768)
        \\    receive <TOKEN>      Redeem share token
        \\    help                 Display this help
        \\    version              Display version information
        \\
        \\EXAMPLES:
        \\    zault init                           # Create vault
        \\    zault add secret.pdf                 # Encrypt and store file
        \\    zault list                           # Show all files
        \\    zault get 8578287e... output.pdf    # Retrieve and decrypt
        \\    zault verify 8578287e...             # Verify signature
        \\
        \\For more information, see: https://github.com/mattneel/zault
        \\
    ;
    std.debug.print(help_text, .{version});
}

fn printVersion() !void {
    std.debug.print("zault {s}\n", .{version});
    std.debug.print("Zig {s}\n", .{@import("builtin").zig_version_string});
    std.debug.print("\n", .{});
    std.debug.print("Cryptography:\n", .{});
    std.debug.print("  ML-DSA-65 (NIST FIPS 204)\n", .{});
    std.debug.print("  ML-KEM-768 (NIST FIPS 203)\n", .{});
    std.debug.print("  ChaCha20-Poly1305 (RFC 8439)\n", .{});
    std.debug.print("  SHA3-256 (FIPS 202)\n", .{});
}

fn getVaultPath(allocator: std.mem.Allocator) ![]u8 {
    // Check ZAULT_PATH env var, fallback to ~/.zault
    if (std.process.getEnvVarOwned(allocator, "ZAULT_PATH")) |path| {
        return path;
    } else |_| {
        const home = try std.process.getEnvVarOwned(allocator, "HOME");
        defer allocator.free(home);
        return try std.fmt.allocPrint(allocator, "{s}/.zault", .{home});
    }
}

// ============================================================================
// Subcommand: init
// ============================================================================

const init_params = clap.parseParamsComptime(
    \\-h, --help    Display help for init command.
    \\
);

fn cmdInit(allocator: std.mem.Allocator, iter: *std.process.ArgIterator, vault_path: []const u8) !void {
    var diag = clap.Diagnostic{};
    var res = clap.parseEx(clap.Help, &init_params, clap.parsers.default, iter, .{
        .diagnostic = &diag,
        .allocator = allocator,
    }) catch |err| {
        // Print error to stderr
        std.debug.print("Error: {}\n", .{err});
        return err;
    };
    defer res.deinit();

    if (res.args.help != 0) {
        std.debug.print("Initialize a new Zault vault\n\n", .{});
        std.debug.print("USAGE:\n", .{});
        std.debug.print("    zault init\n\n", .{});
        std.debug.print("Creates a new vault directory and generates ML-DSA-65 identity.\n", .{});
        return;
    }

    std.debug.print("Initializing vault at {s}\n", .{vault_path});

    var vault = try Vault.init(allocator, vault_path);
    defer vault.deinit();

    std.debug.print("✓ Vault initialized\n", .{});
    std.debug.print("✓ Identity generated: ", .{});

    // Print first 16 chars of public key hash
    var hash: [32]u8 = undefined;
    std.crypto.hash.sha3.Sha3_256.hash(&vault.identity.public_key, &hash, .{});
    const hex = std.fmt.bytesToHex(hash[0..8], .lower);
    std.debug.print("zpub1{s}...\n", .{hex});
    std.debug.print("\n", .{});
    std.debug.print("⚠️  Backup your identity: {s}/identity.bin\n", .{vault_path});
}

// ============================================================================
// Subcommand: add
// ============================================================================

const add_params = clap.parseParamsComptime(
    \\-h, --help    Display help for add command.
    \\<FILE>
    \\
);

const add_parsers = .{
    .FILE = clap.parsers.string,
};

fn cmdAdd(allocator: std.mem.Allocator, iter: *std.process.ArgIterator, vault_path: []const u8) !void {
    var diag = clap.Diagnostic{};
    var res = clap.parseEx(clap.Help, &add_params, add_parsers, iter, .{
        .diagnostic = &diag,
        .allocator = allocator,
    }) catch |err| {
        // Print error to stderr
        std.debug.print("Error: {}\n", .{err});
        return err;
    };
    defer res.deinit();

    if (res.args.help != 0) {
        std.debug.print("Add a file to the vault (encrypted)\n\n", .{});
        std.debug.print("USAGE:\n", .{});
        std.debug.print("    zault add <FILE>\n\n", .{});
        std.debug.print("Encrypts the file with ChaCha20-Poly1305 and stores it in the vault.\n", .{});
        std.debug.print("Returns metadata block hash.\n", .{});
        return;
    }

    const file_path = res.positionals[0] orelse {
        std.debug.print("Error: No file specified\n\n", .{});
        std.debug.print("USAGE: zault add <FILE>\n", .{});
        return error.MissingArgument;
    };

    var vault = try Vault.init(allocator, vault_path);
    defer vault.deinit();

    std.debug.print("Adding file: {s}\n", .{file_path});

    const hash = try vault.addFile(file_path);

    std.debug.print("✓ File added (encrypted)\n", .{});
    const hex = std.fmt.bytesToHex(&hash, .lower);
    std.debug.print("Hash: {s}\n", .{hex});
}

// ============================================================================
// Subcommand: get
// ============================================================================

const get_params = clap.parseParamsComptime(
    \\-h, --help       Display help for get command.
    \\-o, --output <STR>  Output file path.
    \\<HASH>
    \\
);

const get_parsers = .{
    .HASH = clap.parsers.string,
    .STR = clap.parsers.string,
};

fn cmdGet(allocator: std.mem.Allocator, iter: *std.process.ArgIterator, vault_path: []const u8) !void {
    var diag = clap.Diagnostic{};
    var res = clap.parseEx(clap.Help, &get_params, get_parsers, iter, .{
        .diagnostic = &diag,
        .allocator = allocator,
    }) catch |err| {
        // Print error to stderr
        std.debug.print("Error: {}\n", .{err});
        return err;
    };
    defer res.deinit();

    if (res.args.help != 0) {
        std.debug.print("Retrieve and decrypt a file from the vault\n\n", .{});
        std.debug.print("USAGE:\n", .{});
        std.debug.print("    zault get <HASH> [-o OUTPUT]\n\n", .{});
        std.debug.print("OPTIONS:\n", .{});
        std.debug.print("    -o, --output <PATH>    Output file path (default: output.bin)\n", .{});
        return;
    }

    const hash_str = res.positionals[0] orelse {
        std.debug.print("Error: No hash specified\n\n", .{});
        std.debug.print("USAGE: zault get <HASH> [-o OUTPUT]\n", .{});
        return error.MissingArgument;
    };

    const output_path = res.args.output orelse "output.bin";

    // Parse hash
    var hash: BlockHash = undefined;
    _ = try std.fmt.hexToBytes(&hash, hash_str);

    var vault = try Vault.init(allocator, vault_path);
    defer vault.deinit();

    std.debug.print("Retrieving block: {s}\n", .{hash_str});

    try vault.getFile(hash, output_path);

    std.debug.print("✓ File retrieved (decrypted): {s}\n", .{output_path});
}

// ============================================================================
// Subcommand: list
// ============================================================================

const list_params = clap.parseParamsComptime(
    \\-h, --help        Display help for list command.
    \\-l, --long        Show detailed information.
    \\    --hashes      Show full hashes.
    \\
);

fn cmdList(allocator: std.mem.Allocator, iter: *std.process.ArgIterator, vault_path: []const u8) !void {
    var diag = clap.Diagnostic{};
    var res = clap.parseEx(clap.Help, &list_params, clap.parsers.default, iter, .{
        .diagnostic = &diag,
        .allocator = allocator,
    }) catch |err| {
        // Print error to stderr
        std.debug.print("Error: {}\n", .{err});
        return err;
    };
    defer res.deinit();

    if (res.args.help != 0) {
        std.debug.print("List all files in the vault\n\n", .{});
        std.debug.print("USAGE:\n", .{});
        std.debug.print("    zault list [OPTIONS]\n\n", .{});
        std.debug.print("OPTIONS:\n", .{});
        std.debug.print("    -l, --long     Show detailed information\n", .{});
        std.debug.print("        --hashes   Show full hashes\n", .{});
        return;
    }

    var vault = try Vault.init(allocator, vault_path);
    defer vault.deinit();

    var files = try vault.listFiles();
    defer {
        for (files.items) |*file| {
            allocator.free(file.filename);
            allocator.free(file.mime_type);
        }
        files.deinit(allocator);
    }

    std.debug.print("Files in vault: {d}\n\n", .{files.items.len});

    if (files.items.len == 0) {
        std.debug.print("(empty)\n", .{});
        return;
    }

    const show_full_hash = res.args.hashes != 0;
    const hash_width: usize = if (show_full_hash) 64 else 16;

    // Print header
    std.debug.print("{s:<40} {s:>10} {s:<20} {s}\n", .{ "Filename", "Size", "Type", "Hash" });
    std.debug.print("{s}\n", .{"-" ** 100});

    for (files.items) |file| {
        const hex = std.fmt.bytesToHex(&file.hash, .lower);
        const hash_display = if (show_full_hash) hex[0..] else hex[0..hash_width];

        std.debug.print("{s:<40} {d:>10} {s:<20} {s}\n", .{
            file.filename,
            file.size,
            file.mime_type,
            hash_display,
        });
    }
}

// ============================================================================
// Subcommand: verify
// ============================================================================

const verify_params = clap.parseParamsComptime(
    \\-h, --help    Display help for verify command.
    \\<HASH>
    \\
);

const verify_parsers = .{
    .HASH = clap.parsers.string,
};

fn cmdVerify(allocator: std.mem.Allocator, iter: *std.process.ArgIterator, vault_path: []const u8) !void {
    var diag = clap.Diagnostic{};
    var res = clap.parseEx(clap.Help, &verify_params, verify_parsers, iter, .{
        .diagnostic = &diag,
        .allocator = allocator,
    }) catch |err| {
        // Print error to stderr
        std.debug.print("Error: {}\n", .{err});
        return err;
    };
    defer res.deinit();

    if (res.args.help != 0) {
        std.debug.print("Verify a block's ML-DSA-65 signature\n\n", .{});
        std.debug.print("USAGE:\n", .{});
        std.debug.print("    zault verify <HASH>\n\n", .{});
        std.debug.print("Verifies the cryptographic signature on a block.\n", .{});
        return;
    }

    const hash_str = res.positionals[0] orelse {
        std.debug.print("Error: No hash specified\n\n", .{});
        std.debug.print("USAGE: zault verify <HASH>\n", .{});
        return error.MissingArgument;
    };

    var hash: BlockHash = undefined;
    _ = try std.fmt.hexToBytes(&hash, hash_str);

    var vault = try Vault.init(allocator, vault_path);
    defer vault.deinit();

    std.debug.print("Verifying block: {s}\n", .{hash_str});

    try vault.verifyBlock(hash);

    std.debug.print("✓ Signature valid (ML-DSA-65)\n", .{});
}

// ============================================================================
// Subcommand: share
// ============================================================================

const share_params = clap.parseParamsComptime(
    \\-h, --help              Display help for share command.
    \\    --to <STR>          Recipient's ML-KEM public key (hex).
    \\    --expires <i64>     Expiration timestamp (Unix time).
    \\    --export <STR>      Export blocks to file.
    \\<HASH>
    \\
);

const share_parsers = .{
    .HASH = clap.parsers.string,
    .STR = clap.parsers.string,
    .i64 = clap.parsers.int(i64, 10),
};

fn cmdShare(allocator: std.mem.Allocator, iter: *std.process.ArgIterator, vault_path: []const u8) !void {
    var diag = clap.Diagnostic{};
    var res = clap.parseEx(clap.Help, &share_params, share_parsers, iter, .{
        .diagnostic = &diag,
        .allocator = allocator,
    }) catch |err| {
        // Print error to stderr
        std.debug.print("Error: {}\n", .{err});
        return err;
    };
    defer res.deinit();

    if (res.args.help != 0) {
        std.debug.print("Create a share token for a file\n\n", .{});
        std.debug.print("USAGE:\n", .{});
        std.debug.print("    zault share <HASH> --to <PUBKEY> --expires <TIMESTAMP>\n\n", .{});
        std.debug.print("OPTIONS:\n", .{});
        std.debug.print("    --to <HEX>        Recipient's ML-KEM-768 public key (hex, 1184 bytes)\n", .{});
        std.debug.print("    --expires <TIME>  Expiration Unix timestamp\n", .{});
        std.debug.print("\nEXAMPLE:\n", .{});
        std.debug.print("    zault share 8578287e... --to <recipient_pubkey> --expires 1700000000\n", .{});
        return;
    }

    const hash_str = res.positionals[0] orelse {
        std.debug.print("Error: No file hash specified\n\n", .{});
        std.debug.print("USAGE: zault share <HASH> --to <PUBKEY> --expires <TIMESTAMP>\n", .{});
        return error.MissingArgument;
    };

    const recipient_pubkey_hex = res.args.to orelse {
        std.debug.print("Error: No recipient specified\n\n", .{});
        std.debug.print("Use --to <PUBKEY> to specify recipient's ML-KEM public key\n", .{});
        return error.MissingRecipient;
    };

    const expires_at = res.args.expires orelse {
        std.debug.print("Error: No expiration specified\n\n", .{});
        std.debug.print("Use --expires <TIMESTAMP> to set expiration\n", .{});
        return error.MissingExpiration;
    };

    // Parse file hash
    var file_hash: BlockHash = undefined;
    _ = try std.fmt.hexToBytes(&file_hash, hash_str);

    // Parse recipient ML-KEM public key (1184 bytes = 2368 hex chars)
    var recipient_pubkey: [1184]u8 = undefined;
    _ = try std.fmt.hexToBytes(&recipient_pubkey, recipient_pubkey_hex);

    var vault = try Vault.init(allocator, vault_path);
    defer vault.deinit();

    std.debug.print("Creating share token...\n", .{});

    const share_token = try vault.createShare(file_hash, &recipient_pubkey, expires_at, allocator);
    defer allocator.free(share_token);

    std.debug.print("✓ Share token created (ML-KEM-768)\n", .{});
    std.debug.print("Token (hex): ", .{});

    // Print token as hex for easy copy/paste
    for (share_token) |byte| {
        std.debug.print("{x:0>2}", .{byte});
    }
    std.debug.print("\n", .{});

    // Export blocks if requested
    if (res.args.@"export") |export_path| {
        std.debug.print("\nExporting blocks...\n", .{});
        try vault.exportBlocks(&[_]BlockHash{file_hash}, export_path, allocator);
        std.debug.print("✓ Blocks exported: {s}\n", .{export_path});
    }

    std.debug.print("\nRecipient can redeem with:\n", .{});
    std.debug.print("    zault receive <TOKEN>\n", .{});
    if (res.args.@"export") |export_path| {
        std.debug.print("\nSend both:\n", .{});
        std.debug.print("  1. Token (above)\n", .{});
        std.debug.print("  2. Blocks file: {s}\n", .{export_path});
    }
}

// ============================================================================
// Subcommand: receive
// ============================================================================

const receive_params = clap.parseParamsComptime(
    \\-h, --help         Display help for receive command.
    \\-o, --output <STR>  Retrieve shared file immediately.
    \\<TOKEN>
    \\
);

const receive_parsers = .{
    .TOKEN = clap.parsers.string,
    .STR = clap.parsers.string,
};

fn cmdReceive(allocator: std.mem.Allocator, iter: *std.process.ArgIterator, vault_path: []const u8) !void {
    var diag = clap.Diagnostic{};
    var res = clap.parseEx(clap.Help, &receive_params, receive_parsers, iter, .{
        .diagnostic = &diag,
        .allocator = allocator,
    }) catch |err| {
        // Print error to stderr
        std.debug.print("Error: {}\n", .{err});
        return err;
    };
    defer res.deinit();

    if (res.args.help != 0) {
        std.debug.print("Redeem a share token\n\n", .{});
        std.debug.print("USAGE:\n", .{});
        std.debug.print("    zault receive <TOKEN>\n\n", .{});
        std.debug.print("Decrypts the share token and grants access to the shared file.\n", .{});
        return;
    }

    const token_hex = res.positionals[0] orelse {
        std.debug.print("Error: No token specified\n\n", .{});
        std.debug.print("USAGE: zault receive <TOKEN>\n", .{});
        return error.MissingArgument;
    };

    // Parse token from hex
    const token_bytes = try allocator.alloc(u8, token_hex.len / 2);
    defer allocator.free(token_bytes);
    _ = try std.fmt.hexToBytes(token_bytes, token_hex);

    var vault = try Vault.init(allocator, vault_path);
    defer vault.deinit();

    std.debug.print("Redeeming share token...\n", .{});

    const share_info = try vault.redeemShare(token_bytes, allocator);

    std.debug.print("✓ Share token redeemed (ML-KEM-768)\n", .{});
    std.debug.print("File hash: ", .{});
    const hex = std.fmt.bytesToHex(&share_info.file_hash, .lower);
    std.debug.print("{s}\n", .{hex});

    // If --output specified, retrieve the file immediately
    if (res.args.output) |output_path| {
        std.debug.print("\nRetrieving shared file...\n", .{});
        try vault.getSharedFile(share_info, output_path, allocator);
        std.debug.print("✓ File retrieved: {s}\n", .{output_path});
    } else {
        std.debug.print("\nTo retrieve the shared file:\n", .{});
        std.debug.print("    # The file blocks were imported earlier\n", .{});
        std.debug.print("    # But you need the share keys to decrypt\n", .{});
        std.debug.print("    # Re-run with: zault receive <TOKEN> -o output.bin\n", .{});
    }
}

// ============================================================================
// Subcommand: pubkey
// ============================================================================

const pubkey_params = clap.parseParamsComptime(
    \\-h, --help    Display help for pubkey command.
    \\
);

fn cmdPubkey(allocator: std.mem.Allocator, iter: *std.process.ArgIterator, vault_path: []const u8) !void {
    var diag = clap.Diagnostic{};
    var res = clap.parseEx(clap.Help, &pubkey_params, clap.parsers.default, iter, .{
        .diagnostic = &diag,
        .allocator = allocator,
    }) catch |err| {
        std.debug.print("Error: {}\n", .{err});
        return err;
    };
    defer res.deinit();

    if (res.args.help != 0) {
        std.debug.print("Display your ML-KEM public key for sharing\n\n", .{});
        std.debug.print("USAGE:\n", .{});
        std.debug.print("    zault pubkey\n\n", .{});
        std.debug.print("Shows your ML-KEM-768 public key that others can use to share files with you.\n", .{});
        return;
    }

    var vault = try Vault.init(allocator, vault_path);
    defer vault.deinit();

    std.debug.print("Your ML-KEM-768 public key (for receiving shares):\n", .{});

    // Print as hex
    for (vault.identity.kem_public_key) |byte| {
        std.debug.print("{x:0>2}", .{byte});
    }
    std.debug.print("\n", .{});
    std.debug.print("\nOthers can share files with you using:\n", .{});
    std.debug.print("    zault share <HASH> --to <YOUR_PUBKEY> --expires <TIME>\n", .{});
}

// ============================================================================
// Subcommand: import
// ============================================================================

const import_params = clap.parseParamsComptime(
    \\-h, --help    Display help for import command.
    \\<FILE>
    \\
);

const import_parsers = .{
    .FILE = clap.parsers.string,
};

fn cmdImport(allocator: std.mem.Allocator, iter: *std.process.ArgIterator, vault_path: []const u8) !void {
    var diag = clap.Diagnostic{};
    var res = clap.parseEx(clap.Help, &import_params, import_parsers, iter, .{
        .diagnostic = &diag,
        .allocator = allocator,
    }) catch |err| {
        std.debug.print("Error: {}\n", .{err});
        return err;
    };
    defer res.deinit();

    if (res.args.help != 0) {
        std.debug.print("Import blocks from a file\n\n", .{});
        std.debug.print("USAGE:\n", .{});
        std.debug.print("    zault import <FILE>\n\n", .{});
        std.debug.print("Imports blocks from an exported .zault file.\n", .{});
        return;
    }

    const import_path = res.positionals[0] orelse {
        std.debug.print("Error: No file specified\n\n", .{});
        std.debug.print("USAGE: zault import <FILE>\n", .{});
        return error.MissingArgument;
    };

    var vault = try Vault.init(allocator, vault_path);
    defer vault.deinit();

    std.debug.print("Importing blocks from: {s}\n", .{import_path});

    var imported = try vault.importBlocks(import_path, allocator);
    defer imported.deinit(allocator);

    std.debug.print("✓ Imported {d} blocks\n", .{imported.items.len});

    // Show what was imported
    for (imported.items) |hash| {
        const hex = std.fmt.bytesToHex(&hash, .lower);
        std.debug.print("  - {s}\n", .{hex[0..16]});
    }
}
