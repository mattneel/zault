//! Identity management for Zault
//!
//! Identities are ML-DSA keypairs with metadata.
//! Public identities are encoded as "zpub1..." strings.
//! Private identities are encoded as "zprv1..." strings.

const std = @import("std");
const crypto = @import("crypto.zig");

/// Zault identity structure
pub const Identity = struct {
    /// Public key (ML-DSA-65)
    public_key: [crypto.MLDSA65.PublicKey.encoded_length]u8,
    /// Secret key (ML-DSA-65)
    secret_key: [crypto.MLDSA65.SecretKey.encoded_length]u8,
    /// Creation timestamp (Unix time)
    created_at: i64,
    /// Protocol version
    version: u8,

    /// Generate a new random identity
    pub fn generate() Identity {
        const keypair = crypto.MLDSA65.KeyPair.generate();
        return .{
            .public_key = keypair.public_key.toBytes(),
            .secret_key = keypair.secret_key.toBytes(),
            .created_at = 0, // TODO: Use std.time.Instant when we add time support
            .version = 0x01,
        };
    }

    /// Generate identity from a seed (deterministic, for testing)
    pub fn fromSeed(seed: [32]u8) !Identity {
        const keypair = try crypto.MLDSA65.KeyPair.generateDeterministic(seed);
        return .{
            .public_key = keypair.public_key.toBytes(),
            .secret_key = keypair.secret_key.toBytes(),
            .created_at = 0, // TODO: Use std.time.Instant when we add time support
            .version = 0x01,
        };
    }
};

test "generate identity" {
    const identity = Identity.generate();
    try std.testing.expectEqual(@as(u8, 0x01), identity.version);
    try std.testing.expectEqual(@as(usize, 1952), identity.public_key.len);
    try std.testing.expectEqual(@as(usize, 4032), identity.secret_key.len);
}

test "generate deterministic identity" {
    const seed = [_]u8{0x42} ** 32;
    const identity1 = try Identity.fromSeed(seed);
    const identity2 = try Identity.fromSeed(seed);

    // Same seed should produce same keys
    try std.testing.expectEqualSlices(u8, &identity1.public_key, &identity2.public_key);
    try std.testing.expectEqualSlices(u8, &identity1.secret_key, &identity2.secret_key);
}
