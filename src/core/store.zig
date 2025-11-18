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

    /// Store a block (not implemented yet - just a stub)
    pub fn put(self: *BlockStore, hash: BlockHash, block: *const Block) Error!void {
        _ = self;
        _ = hash;
        _ = block;
        // TODO: Implement block serialization and storage
    }

    /// Retrieve a block (not implemented yet - just a stub)
    pub fn get(self: *BlockStore, hash: BlockHash) Error!Block {
        _ = self;
        _ = hash;
        return Error.NotFound;
    }

    /// Check if a block exists (not implemented yet - just a stub)
    pub fn has(self: *BlockStore, hash: BlockHash) Error!bool {
        _ = self;
        _ = hash;
        return false;
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
