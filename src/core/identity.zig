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

    /// Save identity to file
    pub fn save(self: *const Identity, path: []const u8) !void {
        const file = try std.fs.cwd().createFile(path, .{});
        defer file.close();

        // Simple binary format: version || public_key || secret_key || timestamp
        try file.writeAll(&[_]u8{self.version});
        try file.writeAll(&self.public_key);
        try file.writeAll(&self.secret_key);

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

        // Read public key
        _ = try file.read(&identity.public_key);

        // Read secret key
        _ = try file.read(&identity.secret_key);

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

    // Save to temp file
    const test_path = "zig-cache/test-identity.bin";
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
