//! Storage backend for Zault blocks
//!
//! Provides a content-addressed block store with a local filesystem backend.

const std = @import("std");
const crypto = @import("crypto.zig");
const Block = @import("block.zig").Block;

/// Hash type for block addresses
pub const BlockHash = [crypto.Sha3_256.digest_length]u8;

/// Errors that can occur during storage operations
pub const Error = error{
    NotFound,
    AlreadyExists,
    StorageFailure,
    InvalidPath,
    InvalidBlock,
    LinkQuotaExceeded,
    ReadOnlyFileSystem,
    Streaming,
    StreamTooLong,
    RenameAcrossMountPoints,
} || std.mem.Allocator.Error || std.fs.File.OpenError || std.fs.File.WriteError || std.fs.File.ReadError;

/// Block storage interface
pub const BlockStore = struct {
    allocator: std.mem.Allocator,
    base_path: []const u8,

    /// Initialize a new block store
    pub fn init(allocator: std.mem.Allocator, base_path: []const u8) !BlockStore {
        // Create base directory if it doesn't exist
        std.fs.cwd().makePath(base_path) catch |err| switch (err) {
            error.PathAlreadyExists => {},
            else => return err,
        };

        return BlockStore{
            .allocator = allocator,
            .base_path = base_path,
        };
    }

    /// Get the file path for a block hash
    fn getBlockPath(self: *BlockStore, hash: BlockHash) ![]u8 {
        // Use first 2 hex chars as subdirectory
        var hex_buf: [64]u8 = undefined;
        const hex = std.fmt.bytesToHex(hash, .lower);
        @memcpy(&hex_buf, &hex);

        const subdir = hex_buf[0..2];
        const filename = hex_buf[0..];

        // Create path: base_path/blocks/XX/XXXX...
        return std.fmt.allocPrint(
            self.allocator,
            "{s}/blocks/{s}/{s}",
            .{ self.base_path, subdir, filename },
        );
    }

    /// Store a block
    pub fn put(self: *BlockStore, hash: BlockHash, block: *const Block) Error!void {
        // Get the block path
        const block_path = try self.getBlockPath(hash);
        defer self.allocator.free(block_path);

        // Create subdirectory if needed
        const dir_path = std.fs.path.dirname(block_path) orelse return error.InvalidPath;
        std.fs.cwd().makePath(dir_path) catch |err| switch (err) {
            error.PathAlreadyExists => {},
            else => return err,
        };

        // Serialize the block
        const serialized = try block.serialize(self.allocator);
        defer self.allocator.free(serialized);

        // Write to temporary file first (atomic write)
        const tmp_path = try std.fmt.allocPrint(
            self.allocator,
            "{s}.tmp",
            .{block_path},
        );
        defer self.allocator.free(tmp_path);

        const tmp_file = try std.fs.cwd().createFile(tmp_path, .{});
        defer tmp_file.close();
        try tmp_file.writeAll(serialized);

        // Atomic rename
        std.fs.cwd().rename(tmp_path, block_path) catch |err| {
            // If rename fails, try to clean up tmp file
            std.fs.cwd().deleteFile(tmp_path) catch {};
            return err;
        };
    }

    /// Retrieve a block
    pub fn get(self: *BlockStore, hash: BlockHash) Error!Block {
        // Get the block path
        const block_path = try self.getBlockPath(hash);
        defer self.allocator.free(block_path);

        // Read the file
        const bytes = std.fs.cwd().readFileAlloc(
            block_path,
            self.allocator,
            @enumFromInt(16 * 1024 * 1024), // max 16MB
        ) catch |err| switch (err) {
            error.FileNotFound => return Error.NotFound,
            error.StreamTooLong => return Error.StorageFailure,
            else => return err,
        };
        defer self.allocator.free(bytes);

        // Deserialize
        return try Block.deserialize(bytes, self.allocator);
    }

    /// Check if a block exists
    pub fn has(self: *BlockStore, hash: BlockHash) Error!bool {
        const block_path = try self.getBlockPath(hash);
        defer self.allocator.free(block_path);

        // Try to open the file to check if it exists
        const file = std.fs.cwd().openFile(block_path, .{}) catch |err| switch (err) {
            error.FileNotFound => return false,
            else => return err,
        };
        file.close();

        return true;
    }

    /// Clean up resources
    pub fn deinit(self: *BlockStore) void {
        _ = self;
        // Nothing to clean up yet
    }
};

test "blockstore init" {
    const allocator = std.testing.allocator;

    // Create a temporary directory for testing
    const test_dir = "zig-cache/test-blockstore";
    var store = try BlockStore.init(allocator, test_dir);
    defer store.deinit();

    try std.testing.expect(std.mem.eql(u8, store.base_path, test_dir));
}

test "blockstore operations compile" {
    const allocator = std.testing.allocator;
    const test_dir = "zig-cache/test-blockstore2";

    var store = try BlockStore.init(allocator, test_dir);
    defer store.deinit();

    // These operations are stubs for now
    const hash = [_]u8{0} ** 32;
    const has = try store.has(hash);
    try std.testing.expect(!has);
}

test "blockstore put and get" {
    const allocator = std.testing.allocator;
    const Identity = @import("identity.zig").Identity;

    // Use a temp directory
    const test_dir = "zig-cache/test-blockstore-putget";

    var store = try BlockStore.init(allocator, test_dir);
    defer store.deinit();

    // Create an identity and a test block
    const identity = Identity.generate();

    const test_data = "test data for storage";
    var block = Block{
        .version = 0x01,
        .block_type = .content,
        .timestamp = 1700000000,
        .author = identity.public_key,
        .data = test_data,
        .nonce = [_]u8{1} ** crypto.ChaCha20Poly1305.nonce_length,
        .signature = undefined,
        .prev_hash = [_]u8{0} ** crypto.Sha3_256.digest_length,
        .hash = undefined,
    };

    // Sign the block
    try block.sign(&identity.secret_key, allocator);

    // Compute hash
    block.hash = block.computeHash();

    // Block shouldn't exist yet
    try std.testing.expect(!try store.has(block.hash));

    // Store the block
    try store.put(block.hash, &block);

    // Block should now exist
    try std.testing.expect(try store.has(block.hash));

    // Retrieve the block
    const retrieved = try store.get(block.hash);
    defer allocator.free(retrieved.data);

    // Verify it matches
    try std.testing.expectEqualSlices(u8, &block.hash, &retrieved.hash);
    try std.testing.expectEqualSlices(u8, &block.author, &retrieved.author);
    try std.testing.expectEqualStrings(block.data, retrieved.data);
    try std.testing.expectEqual(block.timestamp, retrieved.timestamp);

    // Verify signature
    try retrieved.verify(allocator);
}
