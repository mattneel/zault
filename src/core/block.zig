//! Block structures for Zault
//!
//! Blocks are the fundamental unit of storage. Every piece of data
//! is stored as a content-addressed, signed, encrypted block.
//!
//! ## Block Types
//!
//! - **content** - Encrypted file data
//! - **metadata** - Encrypted file metadata (filename, size, keys)
//! - **index** - Directory indexes (not yet implemented)
//! - **tombstone** - Deletion markers (not yet implemented)
//! - **share** - Share tokens (not yet implemented)
//!
//! ## Example
//!
//! ```zig
//! // Create a block
//! var block = Block{
//!     .version = 0x01,
//!     .block_type = .content,
//!     .timestamp = 0,
//!     .author = identity.public_key,
//!     .data = encrypted_data,
//!     .nonce = nonce,
//!     .signature = undefined,
//!     .prev_hash = [_]u8{0} ** 32,
//!     .hash = undefined,
//! };
//!
//! // Sign the block
//! try block.sign(&identity.secret_key, allocator);
//!
//! // Compute hash
//! block.hash = block.computeHash();
//!
//! // Verify later
//! try block.verify(allocator);
//! ```

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

    /// Helper: serialize block data for signing (everything except signature)
    fn serializeForSigning(self: *const Block, allocator: std.mem.Allocator) ![]u8 {
        var list = std.ArrayList(u8){};

        // Add all fields except signature
        try list.append(allocator, self.version);
        try list.append(allocator, @intFromEnum(self.block_type));

        var timestamp_bytes: [8]u8 = undefined;
        std.mem.writeInt(i64, &timestamp_bytes, self.timestamp, .little);
        try list.appendSlice(allocator, &timestamp_bytes);

        try list.appendSlice(allocator, &self.author);
        try list.appendSlice(allocator, &self.nonce);

        // Data length + data
        var len_bytes: [4]u8 = undefined;
        std.mem.writeInt(u32, &len_bytes, @intCast(self.data.len), .little);
        try list.appendSlice(allocator, &len_bytes);
        try list.appendSlice(allocator, self.data);

        try list.appendSlice(allocator, &self.prev_hash);

        return try list.toOwnedSlice(allocator);
    }

    /// Sign this block with a secret key
    pub fn sign(self: *Block, secret_key_bytes: *const [crypto.MLDSA65.SecretKey.encoded_length]u8, allocator: std.mem.Allocator) !void {
        // Reconstruct SecretKey from bytes
        const secret_key = try crypto.MLDSA65.SecretKey.fromBytes(secret_key_bytes.*);

        // Serialize block data for signing
        const data_to_sign = try self.serializeForSigning(allocator);
        defer allocator.free(data_to_sign);

        // Create signer and sign
        var signer = try secret_key.signer(null); // null = deterministic signing
        signer.update(data_to_sign);
        const signature = signer.finalize();

        // Store signature bytes
        self.signature = signature.toBytes();
    }

    /// Verify the signature on this block
    pub fn verify(self: *const Block, allocator: std.mem.Allocator) !void {
        // Reconstruct PublicKey from bytes
        const public_key = try crypto.MLDSA65.PublicKey.fromBytes(self.author);

        // Reconstruct Signature from bytes
        const signature = try crypto.MLDSA65.Signature.fromBytes(self.signature);

        // Serialize block data for verification
        const data_to_verify = try self.serializeForSigning(allocator);
        defer allocator.free(data_to_verify);

        // Verify signature
        try signature.verify(data_to_verify, public_key);
    }

    /// Serialize block to bytes for storage
    pub fn serialize(self: *const Block, allocator: std.mem.Allocator) ![]u8 {
        var list = std.ArrayList(u8){};

        // Version (1 byte)
        try list.append(allocator, self.version);

        // Block type (1 byte)
        try list.append(allocator, @intFromEnum(self.block_type));

        // Timestamp (8 bytes, little-endian)
        var ts_bytes: [8]u8 = undefined;
        std.mem.writeInt(i64, &ts_bytes, self.timestamp, .little);
        try list.appendSlice(allocator, &ts_bytes);

        // Author (1952 bytes)
        try list.appendSlice(allocator, &self.author);

        // Nonce (12 bytes)
        try list.appendSlice(allocator, &self.nonce);

        // Data length (4 bytes)
        var len_bytes: [4]u8 = undefined;
        std.mem.writeInt(u32, &len_bytes, @intCast(self.data.len), .little);
        try list.appendSlice(allocator, &len_bytes);

        // Data (variable)
        try list.appendSlice(allocator, self.data);

        // Prev hash (32 bytes)
        try list.appendSlice(allocator, &self.prev_hash);

        // Signature (3309 bytes)
        try list.appendSlice(allocator, &self.signature);

        // Hash (32 bytes)
        try list.appendSlice(allocator, &self.hash);

        return try list.toOwnedSlice(allocator);
    }

    /// Deserialize block from bytes
    pub fn deserialize(bytes: []const u8, allocator: std.mem.Allocator) !Block {
        var pos: usize = 0;

        // Read version
        if (pos + 1 > bytes.len) return error.InvalidBlock;
        const version = bytes[pos];
        pos += 1;

        // Read block type
        if (pos + 1 > bytes.len) return error.InvalidBlock;
        const block_type: BlockType = @enumFromInt(bytes[pos]);
        pos += 1;

        // Read timestamp
        if (pos + 8 > bytes.len) return error.InvalidBlock;
        const timestamp = std.mem.readInt(i64, bytes[pos..][0..8], .little);
        pos += 8;

        // Read author
        if (pos + 1952 > bytes.len) return error.InvalidBlock;
        var author: [1952]u8 = undefined;
        @memcpy(&author, bytes[pos..][0..1952]);
        pos += 1952;

        // Read nonce
        if (pos + 12 > bytes.len) return error.InvalidBlock;
        var nonce: [12]u8 = undefined;
        @memcpy(&nonce, bytes[pos..][0..12]);
        pos += 12;

        // Read data length
        if (pos + 4 > bytes.len) return error.InvalidBlock;
        const data_len = std.mem.readInt(u32, bytes[pos..][0..4], .little);
        pos += 4;

        // Read data
        if (pos + data_len > bytes.len) return error.InvalidBlock;
        const data = try allocator.dupe(u8, bytes[pos..][0..data_len]);
        pos += data_len;

        // Read prev_hash
        if (pos + 32 > bytes.len) return error.InvalidBlock;
        var prev_hash: [32]u8 = undefined;
        @memcpy(&prev_hash, bytes[pos..][0..32]);
        pos += 32;

        // Read signature
        if (pos + 3309 > bytes.len) return error.InvalidBlock;
        var signature: [3309]u8 = undefined;
        @memcpy(&signature, bytes[pos..][0..3309]);
        pos += 3309;

        // Read hash
        if (pos + 32 > bytes.len) return error.InvalidBlock;
        var hash: [32]u8 = undefined;
        @memcpy(&hash, bytes[pos..][0..32]);
        pos += 32;

        return Block{
            .version = version,
            .block_type = block_type,
            .timestamp = timestamp,
            .author = author,
            .data = data,
            .nonce = nonce,
            .signature = signature,
            .prev_hash = prev_hash,
            .hash = hash,
        };
    }
};

/// Encrypt plaintext data using ChaCha20-Poly1305
/// Returns ciphertext || tag (16-byte tag appended)
pub fn encryptData(
    plaintext: []const u8,
    key: [32]u8,
    nonce: [12]u8,
    allocator: std.mem.Allocator,
) ![]u8 {
    // Allocate space for ciphertext + tag
    const ciphertext_with_tag = try allocator.alloc(u8, plaintext.len + crypto.ChaCha20Poly1305.tag_length);
    errdefer allocator.free(ciphertext_with_tag);

    const ciphertext = ciphertext_with_tag[0..plaintext.len];
    var tag: [crypto.ChaCha20Poly1305.tag_length]u8 = undefined;

    // Encrypt (no additional data)
    crypto.ChaCha20Poly1305.encrypt(
        ciphertext,
        &tag,
        plaintext,
        &[_]u8{}, // no additional authenticated data
        nonce,
        key,
    );

    // Append tag
    @memcpy(ciphertext_with_tag[plaintext.len..], &tag);

    return ciphertext_with_tag;
}

/// Decrypt ciphertext data using ChaCha20-Poly1305
/// Input must be ciphertext || tag (16-byte tag appended)
pub fn decryptData(
    ciphertext_with_tag: []const u8,
    key: [32]u8,
    nonce: [12]u8,
    allocator: std.mem.Allocator,
) ![]u8 {
    if (ciphertext_with_tag.len < crypto.ChaCha20Poly1305.tag_length) {
        return error.InvalidCiphertext;
    }

    const tag_start = ciphertext_with_tag.len - crypto.ChaCha20Poly1305.tag_length;
    const ciphertext = ciphertext_with_tag[0..tag_start];
    const tag_slice = ciphertext_with_tag[tag_start..];
    var tag: [crypto.ChaCha20Poly1305.tag_length]u8 = undefined;
    @memcpy(&tag, tag_slice);

    // Allocate space for plaintext
    const plaintext = try allocator.alloc(u8, ciphertext.len);
    errdefer allocator.free(plaintext);

    // Decrypt and verify
    try crypto.ChaCha20Poly1305.decrypt(
        plaintext,
        ciphertext,
        tag,
        &[_]u8{}, // no additional authenticated data
        nonce,
        key,
    );

    return plaintext;
}

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

test "block signing and verification" {
    const allocator = std.testing.allocator;
    const Identity = @import("identity.zig").Identity;

    // Generate an identity for testing
    const identity = Identity.generate();

    // Create a block
    var block = Block{
        .version = 0x01,
        .block_type = .content,
        .timestamp = 0,
        .author = identity.public_key,
        .data = "test data for signing",
        .nonce = [_]u8{1} ** crypto.ChaCha20Poly1305.nonce_length,
        .signature = undefined,
        .prev_hash = [_]u8{0} ** crypto.Sha3_256.digest_length,
        .hash = undefined,
    };

    // Sign the block
    try block.sign(&identity.secret_key, allocator);

    // Verify should succeed
    try block.verify(allocator);

    // Tamper with the data
    const original_data = block.data;
    block.data = "tampered data";

    // Verification should now fail
    try std.testing.expectError(error.SignatureVerificationFailed, block.verify(allocator));

    // Restore data
    block.data = original_data;

    // Verification should succeed again
    try block.verify(allocator);
}

test "data encryption and decryption" {
    const allocator = std.testing.allocator;

    const plaintext = "secret data that needs encryption";
    var key: [32]u8 = undefined;
    crypto.random.bytes(&key);
    var nonce: [12]u8 = undefined;
    crypto.random.bytes(&nonce);

    // Encrypt
    const ciphertext = try encryptData(plaintext, key, nonce, allocator);
    defer allocator.free(ciphertext);

    // Ciphertext should be longer (includes 16-byte tag)
    try std.testing.expect(ciphertext.len == plaintext.len + 16);

    // Ciphertext should not match plaintext
    try std.testing.expect(!std.mem.eql(u8, plaintext, ciphertext[0..plaintext.len]));

    // Decrypt
    const decrypted = try decryptData(ciphertext, key, nonce, allocator);
    defer allocator.free(decrypted);

    // Should match original
    try std.testing.expectEqualStrings(plaintext, decrypted);

    // Wrong key should fail
    var wrong_key: [32]u8 = undefined;
    crypto.random.bytes(&wrong_key);
    try std.testing.expectError(error.AuthenticationFailed, decryptData(ciphertext, wrong_key, nonce, allocator));
}

test "block serialization round-trip" {
    const allocator = std.testing.allocator;

    // Create a test block
    const test_data = "test data for serialization";
    var block = Block{
        .version = 0x01,
        .block_type = .content,
        .timestamp = 1700000000,
        .author = [_]u8{0xAB} ** 1952,
        .data = test_data,
        .nonce = [_]u8{1} ** 12,
        .signature = [_]u8{2} ** 3309,
        .prev_hash = [_]u8{3} ** 32,
        .hash = [_]u8{4} ** 32,
    };

    // Serialize
    const bytes = try block.serialize(allocator);
    defer allocator.free(bytes);

    // Deserialize
    const deserialized = try Block.deserialize(bytes, allocator);
    defer allocator.free(deserialized.data);

    // Compare all fields
    try std.testing.expectEqual(block.version, deserialized.version);
    try std.testing.expectEqual(block.block_type, deserialized.block_type);
    try std.testing.expectEqual(block.timestamp, deserialized.timestamp);
    try std.testing.expectEqualSlices(u8, &block.author, &deserialized.author);
    try std.testing.expectEqualSlices(u8, block.data, deserialized.data);
    try std.testing.expectEqualSlices(u8, &block.nonce, &deserialized.nonce);
    try std.testing.expectEqualSlices(u8, &block.signature, &deserialized.signature);
    try std.testing.expectEqualSlices(u8, &block.prev_hash, &deserialized.prev_hash);
    try std.testing.expectEqualSlices(u8, &block.hash, &deserialized.hash);
}
