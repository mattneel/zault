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
