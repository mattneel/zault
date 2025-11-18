//! Vault - High-level operations for Zault storage
//!
//! The Vault ties together identity, blocks, and storage into a unified interface.

const std = @import("std");
const Identity = @import("identity.zig").Identity;
const Block = @import("block.zig").Block;
const BlockStore = @import("store.zig").BlockStore;
const BlockHash = @import("store.zig").BlockHash;
const crypto = @import("crypto.zig");
const encryptData = @import("block.zig").encryptData;
const decryptData = @import("block.zig").decryptData;

pub const Vault = struct {
    identity: Identity,
    store: BlockStore,
    vault_path: []const u8,
    allocator: std.mem.Allocator,

    /// Initialize or load a vault
    pub fn init(allocator: std.mem.Allocator, vault_path: []const u8) !Vault {
        // Create vault directory if it doesn't exist
        std.fs.cwd().makePath(vault_path) catch |err| switch (err) {
            error.PathAlreadyExists => {},
            else => return err,
        };

        // Load or generate identity
        const identity_path = try std.fmt.allocPrint(
            allocator,
            "{s}/identity.bin",
            .{vault_path},
        );
        defer allocator.free(identity_path);

        const identity = Identity.load(identity_path) catch |err| switch (err) {
            error.FileNotFound => blk: {
                // Generate new identity
                const new_identity = Identity.generate();
                try new_identity.save(identity_path);
                break :blk new_identity;
            },
            else => return err,
        };

        // Initialize block store
        const store = try BlockStore.init(allocator, vault_path);

        return Vault{
            .identity = identity,
            .store = store,
            .vault_path = vault_path,
            .allocator = allocator,
        };
    }

    /// Add a file to the vault (simplified - stores raw data for now)
    pub fn addFile(self: *Vault, file_path: []const u8) !BlockHash {
        // Read file
        const data = try std.fs.cwd().readFileAlloc(
            file_path,
            self.allocator,
            @enumFromInt(100 * 1024 * 1024), // 100MB max
        );
        defer self.allocator.free(data);

        // For now, store data as-is (no encryption yet - encryption key management needed)
        // In Phase 1.3 we'll add metadata blocks with encryption keys

        // Generate nonce (even though we're not encrypting yet, we need it for the block structure)
        var nonce: [12]u8 = undefined;
        crypto.random.bytes(&nonce);

        // Create block
        var block = Block{
            .version = 0x01,
            .block_type = .content,
            .timestamp = 0, // TODO: Use actual timestamp
            .author = self.identity.public_key,
            .data = data,
            .nonce = nonce,
            .signature = undefined,
            .prev_hash = [_]u8{0} ** 32,
            .hash = undefined,
        };

        // Sign block
        try block.sign(&self.identity.secret_key, self.allocator);

        // Compute hash
        block.hash = block.computeHash();

        // Store block
        try self.store.put(block.hash, &block);

        return block.hash;
    }

    /// Get a file from the vault
    pub fn getFile(self: *Vault, hash: BlockHash, output_path: []const u8) !void {
        // Retrieve block
        const block = try self.store.get(hash);
        defer self.allocator.free(block.data);

        // Verify signature
        try block.verify(self.allocator);

        // Write to output file (data is not encrypted in this version)
        const file = try std.fs.cwd().createFile(output_path, .{});
        defer file.close();
        try file.writeAll(block.data);
    }

    /// List all blocks in the vault
    pub fn listBlocks(self: *Vault) !std.ArrayList(BlockHash) {
        var list = std.ArrayList(BlockHash){};

        const blocks_path = try std.fmt.allocPrint(
            self.allocator,
            "{s}/blocks",
            .{self.vault_path},
        );
        defer self.allocator.free(blocks_path);

        // Try to open blocks directory
        var blocks_dir = std.fs.cwd().openDir(blocks_path, .{ .iterate = true }) catch |err| switch (err) {
            error.FileNotFound => return list, // Empty vault
            else => return err,
        };
        defer blocks_dir.close();

        // Walk through all subdirectories
        var walker = try blocks_dir.walk(self.allocator);
        defer walker.deinit();

        while (try walker.next()) |entry| {
            if (entry.kind == .file) {
                // Skip .tmp files
                if (std.mem.endsWith(u8, entry.basename, ".tmp")) continue;

                // Parse hex filename to hash (SHA3-256 = 32 bytes = 64 hex chars)
                if (entry.basename.len == 64) {
                    var hash: BlockHash = undefined;
                    _ = try std.fmt.hexToBytes(&hash, entry.basename);
                    try list.append(self.allocator, hash);
                }
            }
        }

        return list;
    }

    /// Verify a block's signature
    pub fn verifyBlock(self: *Vault, hash: BlockHash) !void {
        const block = try self.store.get(hash);
        defer self.allocator.free(block.data);

        try block.verify(self.allocator);
    }

    /// Clean up resources
    pub fn deinit(self: *Vault) void {
        self.store.deinit();
    }
};

test "vault initialization" {
    const allocator = std.testing.allocator;

    const test_dir = "zig-cache/test-vault";
    var vault = try Vault.init(allocator, test_dir);
    defer vault.deinit();

    // Verify identity was created
    try std.testing.expectEqual(@as(u8, 0x01), vault.identity.version);
}

test "vault add and get file" {
    const allocator = std.testing.allocator;

    const test_dir = "zig-cache/test-vault-addget";
    var vault = try Vault.init(allocator, test_dir);
    defer vault.deinit();

    // Create a test file
    const test_file = "zig-cache/test-file.txt";
    const test_data = "test data for vault";
    {
        const file = try std.fs.cwd().createFile(test_file, .{});
        defer file.close();
        try file.writeAll(test_data);
    }
    defer std.fs.cwd().deleteFile(test_file) catch {};

    // Add file to vault
    const hash = try vault.addFile(test_file);

    // Verify block exists
    try std.testing.expect(try vault.store.has(hash));

    // Retrieve file
    const output_file = "zig-cache/test-output.txt";
    try vault.getFile(hash, output_file);
    defer std.fs.cwd().deleteFile(output_file) catch {};

    // Verify content matches
    const retrieved_data = try std.fs.cwd().readFileAlloc(
        output_file,
        allocator,
        @enumFromInt(1024),
    );
    defer allocator.free(retrieved_data);

    try std.testing.expectEqualStrings(test_data, retrieved_data);
}
