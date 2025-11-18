//! Identity management for Zault
//!
//! Identities are ML-DSA-65 keypairs that serve as your cryptographic identity.
//! Your identity is your vault - no passwords, just keys.
//!
//! ## Structure
//!
//! - **Public key** - 1,952 bytes (ML-DSA-65)
//! - **Secret key** - 4,032 bytes (ML-DSA-65)
//! - **Created timestamp** - Unix timestamp
//! - **Version** - Protocol version (0x01)
//!
//! ## Example
//!
//! ```zig
//! // Generate new identity
//! const identity = Identity.generate();
//!
//! // Save to file
//! try identity.save("/path/to/identity.bin");
//!
//! // Load from file
//! const loaded = try Identity.load("/path/to/identity.bin");
//! ```

const std = @import("std");
const crypto = @import("crypto.zig");

/// Zault identity structure
///
/// Represents a cryptographic identity using ML-DSA-65 keypairs (for signing)
/// and ML-KEM-768 keypairs (for key encapsulation/sharing).
/// This is your vault identity - backup both secret keys!
pub const Identity = struct {
    /// Public key (ML-DSA-65) for signatures
    public_key: [crypto.MLDSA65.PublicKey.encoded_length]u8,
    /// Secret key (ML-DSA-65) for signatures
    secret_key: [crypto.MLDSA65.SecretKey.encoded_length]u8,
    /// Public key (ML-KEM-768) for key encapsulation
    kem_public_key: [crypto.MLKem768.PublicKey.bytes_length]u8,
    /// Secret key (ML-KEM-768) for key decapsulation
    kem_secret_key: [crypto.MLKem768.SecretKey.bytes_length]u8,
    /// Creation timestamp (Unix time)
    created_at: i64,
    /// Protocol version
    version: u8,

    /// Generate a new random identity with both ML-DSA and ML-KEM keys
    pub fn generate() Identity {
        const dsa_keypair = crypto.MLDSA65.KeyPair.generate();
        const kem_keypair = crypto.MLKem768.KeyPair.generate();

        return .{
            .public_key = dsa_keypair.public_key.toBytes(),
            .secret_key = dsa_keypair.secret_key.toBytes(),
            .kem_public_key = kem_keypair.public_key.toBytes(),
            .kem_secret_key = kem_keypair.secret_key.toBytes(),
            .created_at = 0, // TODO: Use std.time.Instant when we add time support
            .version = 0x01,
        };
    }

    /// Generate identity from a seed (deterministic, for testing)
    pub fn fromSeed(seed: [32]u8) !Identity {
        const dsa_keypair = try crypto.MLDSA65.KeyPair.generateDeterministic(seed);

        // ML-KEM needs 64-byte seed, derive from 32-byte input
        var kem_seed: [64]u8 = undefined;
        @memcpy(kem_seed[0..32], &seed);
        // Use SHA3-256 to derive second half
        crypto.Sha3_256.hash(&seed, kem_seed[32..64], .{});

        const kem_keypair = try crypto.MLKem768.KeyPair.generateDeterministic(kem_seed);

        return .{
            .public_key = dsa_keypair.public_key.toBytes(),
            .secret_key = dsa_keypair.secret_key.toBytes(),
            .kem_public_key = kem_keypair.public_key.toBytes(),
            .kem_secret_key = kem_keypair.secret_key.toBytes(),
            .created_at = 0, // TODO: Use std.time.Instant when we add time support
            .version = 0x01,
        };
    }

    /// Save identity to file
    pub fn save(self: *const Identity, path: []const u8) !void {
        const file = try std.fs.cwd().createFile(path, .{});
        defer file.close();

        // Binary format: version || ML-DSA keys || ML-KEM keys || timestamp
        try file.writeAll(&[_]u8{self.version});
        try file.writeAll(&self.public_key);
        try file.writeAll(&self.secret_key);
        try file.writeAll(&self.kem_public_key);
        try file.writeAll(&self.kem_secret_key);

        var ts_bytes: [8]u8 = undefined;
        std.mem.writeInt(i64, &ts_bytes, self.created_at, .little);
        try file.writeAll(&ts_bytes);
    }

    /// Load identity from file
    pub fn load(path: []const u8) !Identity {
        const file = try std.fs.cwd().openFile(path, .{});
        defer file.close();

        var identity: Identity = undefined;

        // Read version
        var version_buf: [1]u8 = undefined;
        _ = try file.read(&version_buf);
        identity.version = version_buf[0];

        // Read ML-DSA public key
        _ = try file.read(&identity.public_key);

        // Read ML-DSA secret key
        _ = try file.read(&identity.secret_key);

        // Read ML-KEM public key
        _ = try file.read(&identity.kem_public_key);

        // Read ML-KEM secret key
        _ = try file.read(&identity.kem_secret_key);

        // Read timestamp
        var ts_bytes: [8]u8 = undefined;
        _ = try file.read(&ts_bytes);
        identity.created_at = std.mem.readInt(i64, &ts_bytes, .little);

        return identity;
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

test "identity save and load" {
    const allocator = std.testing.allocator;

    // Generate an identity
    const identity = Identity.generate();

    // Use /tmp for CI compatibility
    const test_path = "/tmp/test-identity.bin";
    try identity.save(test_path);
    defer std.fs.cwd().deleteFile(test_path) catch {};

    // Load it back
    const loaded = try Identity.load(test_path);

    // Verify it matches
    try std.testing.expectEqual(identity.version, loaded.version);
    try std.testing.expectEqualSlices(u8, &identity.public_key, &loaded.public_key);
    try std.testing.expectEqualSlices(u8, &identity.secret_key, &loaded.secret_key);
    try std.testing.expectEqual(identity.created_at, loaded.created_at);

    _ = allocator;
}

test "identity has ML-KEM keys for sharing" {
    const allocator = std.testing.allocator;

    // This will fail until we add ML-KEM keys
    const identity = Identity.generate();

    // Should have ML-KEM public key (1184 bytes)
    try std.testing.expectEqual(@as(usize, 1184), identity.kem_public_key.len);

    // Should have ML-KEM secret key (2400 bytes)
    try std.testing.expectEqual(@as(usize, 2400), identity.kem_secret_key.len);

    _ = allocator;
}
