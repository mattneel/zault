//! CLI command handlers for Zault

const std = @import("std");
const Vault = @import("../core/vault.zig").Vault;
const BlockHash = @import("../core/store.zig").BlockHash;

pub fn run(allocator: std.mem.Allocator) !void {
    // Parse command line arguments
    var args = try std.process.argsWithAllocator(allocator);
    defer args.deinit();

    // Skip program name
    _ = args.next();

    // Get command
    const command = args.next() orelse {
        printUsage();
        return;
    };

    if (std.mem.eql(u8, command, "init")) {
        try cmdInit(allocator, &args);
    } else if (std.mem.eql(u8, command, "add")) {
        try cmdAdd(allocator, &args);
    } else if (std.mem.eql(u8, command, "get")) {
        try cmdGet(allocator, &args);
    } else if (std.mem.eql(u8, command, "list")) {
        try cmdList(allocator, &args);
    } else if (std.mem.eql(u8, command, "verify")) {
        try cmdVerify(allocator, &args);
    } else {
        std.debug.print("Unknown command: {s}\n", .{command});
        printUsage();
        return error.UnknownCommand;
    }
}

fn printUsage() void {
    std.debug.print(
        \\Zault v0.1.0 - Post-quantum encrypted storage
        \\
        \\Usage:
        \\  zault init              Create a new vault
        \\  zault add <file>        Add a file to the vault
        \\  zault get <hash>        Retrieve a file by hash
        \\  zault list              List all blocks
        \\  zault verify <hash>     Verify a block's signature
        \\
    , .{});
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

fn cmdInit(allocator: std.mem.Allocator, args: anytype) !void {
    _ = args; // No additional args for init

    const vault_path = try getVaultPath(allocator);
    defer allocator.free(vault_path);

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
}

fn cmdAdd(allocator: std.mem.Allocator, args: anytype) !void {
    const file_path = args.next() orelse {
        std.debug.print("Error: No file specified\n", .{});
        std.debug.print("Usage: zault add <file>\n", .{});
        return error.MissingArgument;
    };

    const vault_path = try getVaultPath(allocator);
    defer allocator.free(vault_path);

    var vault = try Vault.init(allocator, vault_path);
    defer vault.deinit();

    std.debug.print("Adding file: {s}\n", .{file_path});

    const hash = try vault.addFile(file_path);

    std.debug.print("✓ File added\n", .{});
    std.debug.print("Hash: ", .{});
    const hex = std.fmt.bytesToHex(&hash, .lower);
    std.debug.print("{s}\n", .{hex});
}

fn cmdGet(allocator: std.mem.Allocator, args: anytype) !void {
    const hash_str = args.next() orelse {
        std.debug.print("Error: No hash specified\n", .{});
        std.debug.print("Usage: zault get <hash> [output_file]\n", .{});
        return error.MissingArgument;
    };

    const output_path = args.next() orelse "output.bin";

    // Parse hash
    var hash: BlockHash = undefined;
    _ = try std.fmt.hexToBytes(&hash, hash_str);

    const vault_path = try getVaultPath(allocator);
    defer allocator.free(vault_path);

    var vault = try Vault.init(allocator, vault_path);
    defer vault.deinit();

    std.debug.print("Retrieving block: {s}\n", .{hash_str});

    try vault.getFile(hash, output_path);

    std.debug.print("✓ File retrieved: {s}\n", .{output_path});
}

fn cmdList(allocator: std.mem.Allocator, args: anytype) !void {
    _ = args;

    const vault_path = try getVaultPath(allocator);
    defer allocator.free(vault_path);

    var vault = try Vault.init(allocator, vault_path);
    defer vault.deinit();

    var blocks = try vault.listBlocks();
    defer blocks.deinit(allocator);

    std.debug.print("Blocks in vault: {d}\n\n", .{blocks.items.len});

    for (blocks.items) |hash| {
        const hex = std.fmt.bytesToHex(&hash, .lower);
        std.debug.print("{s}\n", .{hex});
    }
}

fn cmdVerify(allocator: std.mem.Allocator, args: anytype) !void {
    const hash_str = args.next() orelse {
        std.debug.print("Error: No hash specified\n", .{});
        std.debug.print("Usage: zault verify <hash>\n", .{});
        return error.MissingArgument;
    };

    var hash: BlockHash = undefined;
    _ = try std.fmt.hexToBytes(&hash, hash_str);

    const vault_path = try getVaultPath(allocator);
    defer allocator.free(vault_path);

    var vault = try Vault.init(allocator, vault_path);
    defer vault.deinit();

    std.debug.print("Verifying block: {s}\n", .{hash_str});

    try vault.verifyBlock(hash);

    std.debug.print("✓ Signature valid\n", .{});
}
