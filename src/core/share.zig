//! Share token system for Zault
//!
//! Share tokens allow granting time-limited access to files using ML-KEM-768.
//!
//! ## Design
//!
//! 1. Sender creates share token with file metadata + encryption key
//! 2. Token encrypted for recipient using ML-KEM-768
//! 3. Recipient decrypts token with their private key
//! 4. Recipient can then decrypt the file
//!
//! ## Example
//!
//! ```zig
//! // Sender creates share
//! const token = try createShareToken(
//!     file_hash,
//!     content_key,
//!     recipient_pubkey,
//!     expires_at,
//! );
//!
//! // Recipient redeems share
//! const content_key = try redeemShareToken(
//!     token,
//!     recipient_identity,
//! );
//! ```

const std = @import("std");
const crypto = @import("crypto.zig");
const BlockHash = @import("store.zig").BlockHash;

/// Share token structure
pub const ShareToken = struct {
    version: u8,
    file_hash: BlockHash,
    content_key: [32]u8,
    content_nonce: [12]u8,
    expires_at: i64,
    granted_by: [crypto.MLDSA65.PublicKey.encoded_length]u8,
    granted_at: i64,

    /// Serialize share token to bytes
    pub fn serialize(self: *const ShareToken, allocator: std.mem.Allocator) ![]u8 {
        var list = std.ArrayList(u8){};

        try list.append(allocator, self.version);
        try list.appendSlice(allocator, &self.file_hash);
        try list.appendSlice(allocator, &self.content_key);
        try list.appendSlice(allocator, &self.content_nonce);

        var ts_bytes: [8]u8 = undefined;
        std.mem.writeInt(i64, &ts_bytes, self.expires_at, .little);
        try list.appendSlice(allocator, &ts_bytes);

        try list.appendSlice(allocator, &self.granted_by);

        std.mem.writeInt(i64, &ts_bytes, self.granted_at, .little);
        try list.appendSlice(allocator, &ts_bytes);

        return try list.toOwnedSlice(allocator);
    }

    /// Deserialize share token from bytes
    pub fn deserialize(bytes: []const u8, allocator: std.mem.Allocator) !ShareToken {
        _ = allocator;
        var pos: usize = 0;

        if (pos + 1 > bytes.len) return error.InvalidShareToken;
        const version = bytes[pos];
        pos += 1;

        if (pos + 32 > bytes.len) return error.InvalidShareToken;
        var file_hash: BlockHash = undefined;
        @memcpy(&file_hash, bytes[pos..][0..32]);
        pos += 32;

        if (pos + 32 > bytes.len) return error.InvalidShareToken;
        var content_key: [32]u8 = undefined;
        @memcpy(&content_key, bytes[pos..][0..32]);
        pos += 32;

        if (pos + 12 > bytes.len) return error.InvalidShareToken;
        var content_nonce: [12]u8 = undefined;
        @memcpy(&content_nonce, bytes[pos..][0..12]);
        pos += 12;

        if (pos + 8 > bytes.len) return error.InvalidShareToken;
        const expires_at = std.mem.readInt(i64, bytes[pos..][0..8], .little);
        pos += 8;

        if (pos + 1952 > bytes.len) return error.InvalidShareToken;
        var granted_by: [1952]u8 = undefined;
        @memcpy(&granted_by, bytes[pos..][0..1952]);
        pos += 1952;

        if (pos + 8 > bytes.len) return error.InvalidShareToken;
        const granted_at = std.mem.readInt(i64, bytes[pos..][0..8], .little);
        pos += 8;

        return ShareToken{
            .version = version,
            .file_hash = file_hash,
            .content_key = content_key,
            .content_nonce = content_nonce,
            .expires_at = expires_at,
            .granted_by = granted_by,
            .granted_at = granted_at,
        };
    }
};

/// Encrypt a share token for a recipient using ML-KEM-768
pub fn encryptShareToken(
    token: *const ShareToken,
    recipient_pubkey: *const [crypto.MLKem768.PublicKey.encoded_length]u8,
    allocator: std.mem.Allocator,
) ![]u8 {
    // 1. Serialize the token
    const token_bytes = try token.serialize(allocator);
    defer allocator.free(token_bytes);

    // 2. Reconstruct recipient's ML-KEM public key
    const recipient_pk = try crypto.MLKem768.PublicKey.fromBytes(recipient_pubkey);

    // 3. Encapsulate (generate shared secret)
    const encapsulation = recipient_pk.encaps(null); // null = random seed

    // 4. Derive encryption key from shared secret using HKDF
    const prk = crypto.HkdfSha3_256.extract(&[_]u8{}, &encapsulation.shared_secret);
    var derived_key: [32]u8 = undefined;
    crypto.HkdfSha3_256.expand(&derived_key, "zault-share-token-v1", prk);

    // 5. Generate nonce
    var nonce: [12]u8 = undefined;
    crypto.random.bytes(&nonce);

    // 6. Encrypt token with derived key
    const encryptData = @import("block.zig").encryptData;
    const encrypted_token = try encryptData(token_bytes, derived_key, nonce, allocator);
    defer allocator.free(encrypted_token);

    // 7. Build final encrypted share: ML-KEM ciphertext + nonce + encrypted token
    var result = std.ArrayList(u8){};
    try result.appendSlice(allocator, &encapsulation.ciphertext);
    try result.appendSlice(allocator, &nonce);
    try result.appendSlice(allocator, encrypted_token);

    return try result.toOwnedSlice(allocator);
}

/// Decrypt a share token using ML-KEM-768
pub fn decryptShareToken(
    encrypted: []const u8,
    recipient_seckey: *const [crypto.MLKem768.SecretKey.encoded_length]u8,
    allocator: std.mem.Allocator,
) !ShareToken {
    var pos: usize = 0;

    // 1. Extract ML-KEM ciphertext
    if (pos + crypto.MLKem768.ciphertext_length > encrypted.len) return error.InvalidEncryptedShare;
    var kem_ciphertext: [crypto.MLKem768.ciphertext_length]u8 = undefined;
    @memcpy(&kem_ciphertext, encrypted[pos..][0..crypto.MLKem768.ciphertext_length]);
    pos += crypto.MLKem768.ciphertext_length;

    // 2. Extract nonce
    if (pos + 12 > encrypted.len) return error.InvalidEncryptedShare;
    var nonce: [12]u8 = undefined;
    @memcpy(&nonce, encrypted[pos..][0..12]);
    pos += 12;

    // 3. Extract encrypted token
    const encrypted_token = encrypted[pos..];

    // 4. Reconstruct secret key and decapsulate
    const secret_key = try crypto.MLKem768.SecretKey.fromBytes(recipient_seckey);
    const shared_secret = try secret_key.decaps(&kem_ciphertext);

    // 5. Derive decryption key
    const prk = crypto.HkdfSha3_256.extract(&[_]u8{}, &shared_secret);
    var derived_key: [32]u8 = undefined;
    crypto.HkdfSha3_256.expand(&derived_key, "zault-share-token-v1", prk);

    // 6. Decrypt token
    const decryptData = @import("block.zig").decryptData;
    const token_bytes = try decryptData(encrypted_token, derived_key, nonce, allocator);
    defer allocator.free(token_bytes);

    // 7. Deserialize token
    return try ShareToken.deserialize(token_bytes, allocator);
}

// =============================================================================
// TDD: Start with tests
// =============================================================================

test "share token structure compiles" {
    const token = ShareToken{
        .version = 0x01,
        .file_hash = [_]u8{0xAB} ** 32,
        .content_key = [_]u8{0xCD} ** 32,
        .content_nonce = [_]u8{0xEF} ** 12,
        .expires_at = 1700000000,
        .granted_by = [_]u8{0x12} ** crypto.MLDSA65.PublicKey.encoded_length,
        .granted_at = 1699999900,
    };

    try std.testing.expectEqual(@as(u8, 0x01), token.version);
    try std.testing.expectEqual(@as(usize, 32), token.file_hash.len);
}

test "share token serialization round-trip" {
    const allocator = std.testing.allocator;

    const token = ShareToken{
        .version = 0x01,
        .file_hash = [_]u8{0xAB} ** 32,
        .content_key = [_]u8{0xCD} ** 32,
        .content_nonce = [_]u8{0xEF} ** 12,
        .expires_at = 1700000000,
        .granted_by = [_]u8{0x12} ** 1952,
        .granted_at = 1699999900,
    };

    const bytes = try token.serialize(allocator);
    defer allocator.free(bytes);

    const deserialized = try ShareToken.deserialize(bytes, allocator);

    try std.testing.expectEqual(token.version, deserialized.version);
    try std.testing.expectEqualSlices(u8, &token.file_hash, &deserialized.file_hash);
    try std.testing.expectEqualSlices(u8, &token.content_key, &deserialized.content_key);
}

test "encrypt share token for recipient with ML-KEM" {
    const allocator = std.testing.allocator;
    const Identity = @import("identity.zig").Identity;

    // Create sender identity (ML-DSA for signing)
    const sender = Identity.generate();

    // Create recipient ML-KEM keypair (for encryption)
    const recipient_kem = crypto.MLKem768.KeyPair.generate();

    // Create a share token
    const token = ShareToken{
        .version = 0x01,
        .file_hash = [_]u8{0xAB} ** 32,
        .content_key = [_]u8{0xCD} ** 32,
        .content_nonce = [_]u8{0xEF} ** 12,
        .expires_at = 1700000000,
        .granted_by = sender.public_key,
        .granted_at = 1699999900,
    };

    // Encrypt for recipient
    const recipient_pk_bytes = recipient_kem.public_key.toBytes();
    const encrypted = try encryptShareToken(&token, &recipient_pk_bytes, allocator);
    defer allocator.free(encrypted);

    // Should be encrypted (not equal to plaintext)
    const plaintext = try token.serialize(allocator);
    defer allocator.free(plaintext);
    try std.testing.expect(!std.mem.eql(u8, plaintext, encrypted));

    // Decrypt and verify
    const recipient_sk_bytes = recipient_kem.secret_key.toBytes();
    const decrypted_token = try decryptShareToken(encrypted, &recipient_sk_bytes, allocator);

    try std.testing.expectEqualSlices(u8, &token.content_key, &decrypted_token.content_key);
    try std.testing.expectEqual(token.expires_at, decrypted_token.expires_at);
}
