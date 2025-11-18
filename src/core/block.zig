//! Block structures for Zault
//!
//! Blocks are the fundamental unit of storage. Every piece of data
//! is stored as a content-addressed, signed, encrypted block.

const std = @import("std");
const crypto = @import("crypto.zig");

/// Block type enumeration
pub const BlockType = enum(u8) {
    content = 0x01, // File data
    metadata = 0x02, // File metadata
    index = 0x03, // Directory index
    tombstone = 0x04, // Deletion marker
    share = 0x05, // Share token
};

/// A Zault block
pub const Block = struct {
    /// Protocol version
    version: u8,
    /// Type of block
    block_type: BlockType,
    /// Creation timestamp
    timestamp: i64,
    /// Author's public key
    author: [crypto.MLDSA65.PublicKey.encoded_length]u8,
    /// Encrypted data payload
    data: []const u8,
    /// ChaCha20-Poly1305 nonce
    nonce: [crypto.ChaCha20Poly1305.nonce_length]u8,
    /// ML-DSA signature
    signature: [crypto.MLDSA65.Signature.encoded_length]u8,
    /// Previous block hash (for versioning)
    prev_hash: [crypto.Sha3_256.digest_length]u8,
    /// This block's hash (computed)
    hash: [crypto.Sha3_256.digest_length]u8,

    /// Compute the hash of this block
    pub fn computeHash(self: *const Block) [crypto.Sha3_256.digest_length]u8 {
        var hasher = crypto.Sha3_256.init(.{});

        // Hash all fields except the hash itself
        hasher.update(&[_]u8{self.version});
        hasher.update(&[_]u8{@intFromEnum(self.block_type)});

        var timestamp_bytes: [8]u8 = undefined;
        std.mem.writeInt(i64, &timestamp_bytes, self.timestamp, .little);
        hasher.update(&timestamp_bytes);

        hasher.update(&self.author);
        hasher.update(self.data);
        hasher.update(&self.nonce);
        hasher.update(&self.signature);
        hasher.update(&self.prev_hash);

        var result: [crypto.Sha3_256.digest_length]u8 = undefined;
        hasher.final(&result);
        return result;
    }
};

test "block structure compiles" {
    const allocator = std.testing.allocator;

    // Create a simple block
    var block = Block{
        .version = 0x01,
        .block_type = .content,
        .timestamp = 0,
        .author = undefined,
        .data = &[_]u8{},
        .nonce = undefined,
        .signature = undefined,
        .prev_hash = undefined,
        .hash = undefined,
    };

    // Initialize fields
    @memset(&block.author, 0);
    @memset(&block.nonce, 0);
    @memset(&block.signature, 0);
    @memset(&block.prev_hash, 0);

    // Compute hash
    block.hash = block.computeHash();

    _ = allocator;
    try std.testing.expectEqual(@as(u8, 0x01), block.version);
    try std.testing.expectEqual(BlockType.content, block.block_type);
}

test "compute hash" {
    var block = Block{
        .version = 0x01,
        .block_type = .content,
        .timestamp = 0,
        .author = undefined,
        .data = "test data",
        .nonce = undefined,
        .signature = undefined,
        .prev_hash = undefined,
        .hash = undefined,
    };

    @memset(&block.author, 0);
    @memset(&block.nonce, 0);
    @memset(&block.signature, 0);
    @memset(&block.prev_hash, 0);

    const hash1 = block.computeHash();
    const hash2 = block.computeHash();

    // Same input should produce same hash
    try std.testing.expectEqualSlices(u8, &hash1, &hash2);

    // Hash should be 32 bytes
    try std.testing.expectEqual(@as(usize, 32), hash1.len);
}
