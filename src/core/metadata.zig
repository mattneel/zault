//! File metadata structure for Zault
//!
//! Metadata blocks store encrypted information about files:
//! - Original filename
//! - File size and MIME type
//! - Content block hash
//! - Per-file encryption key and nonce
//!
//! ## Security
//!
//! Metadata is encrypted with the vault master key (derived from identity).
//! This means the server cannot see:
//! - Filenames
//! - File sizes (exact)
//! - MIME types
//! - Encryption keys
//!
//! ## Example
//!
//! ```zig
//! const metadata = FileMetadata{
//!     .version = 0x01,
//!     .filename = "secret.pdf",
//!     .size = 1024,
//!     .mime_type = "application/pdf",
//!     .created = 0,
//!     .modified = 0,
//!     .content_hash = content_block.hash,
//!     .content_key = encryption_key,
//!     .content_nonce = nonce,
//! };
//!
//! // Serialize
//! const bytes = try metadata.serialize(allocator);
//! defer allocator.free(bytes);
//!
//! // Deserialize
//! var loaded = try FileMetadata.deserialize(bytes, allocator);
//! defer loaded.deinit(allocator);
//! ```

const std = @import("std");
const crypto = @import("crypto.zig");

/// File metadata structure
pub const FileMetadata = struct {
    version: u8,
    filename: []const u8,
    size: u64,
    mime_type: []const u8,
    created: i64,
    modified: i64,
    content_hash: [crypto.Sha3_256.digest_length]u8,
    content_key: [32]u8,
    content_nonce: [crypto.ChaCha20Poly1305.nonce_length]u8,

    /// Serialize metadata to bytes
    pub fn serialize(self: *const FileMetadata, allocator: std.mem.Allocator) ![]u8 {
        var list = std.ArrayList(u8){};

        // Version
        try list.append(allocator, self.version);

        // Filename length + data
        var len_bytes: [4]u8 = undefined;
        std.mem.writeInt(u32, &len_bytes, @intCast(self.filename.len), .little);
        try list.appendSlice(allocator, &len_bytes);
        try list.appendSlice(allocator, self.filename);

        // Size
        var size_bytes: [8]u8 = undefined;
        std.mem.writeInt(u64, &size_bytes, self.size, .little);
        try list.appendSlice(allocator, &size_bytes);

        // MIME type length + data
        std.mem.writeInt(u32, &len_bytes, @intCast(self.mime_type.len), .little);
        try list.appendSlice(allocator, &len_bytes);
        try list.appendSlice(allocator, self.mime_type);

        // Timestamps
        var ts_bytes: [8]u8 = undefined;
        std.mem.writeInt(i64, &ts_bytes, self.created, .little);
        try list.appendSlice(allocator, &ts_bytes);
        std.mem.writeInt(i64, &ts_bytes, self.modified, .little);
        try list.appendSlice(allocator, &ts_bytes);

        // Content hash, key, nonce
        try list.appendSlice(allocator, &self.content_hash);
        try list.appendSlice(allocator, &self.content_key);
        try list.appendSlice(allocator, &self.content_nonce);

        return try list.toOwnedSlice(allocator);
    }

    /// Deserialize metadata from bytes
    pub fn deserialize(bytes: []const u8, allocator: std.mem.Allocator) !FileMetadata {
        var pos: usize = 0;

        // Version
        if (pos + 1 > bytes.len) return error.InvalidMetadata;
        const version = bytes[pos];
        pos += 1;

        // Filename
        if (pos + 4 > bytes.len) return error.InvalidMetadata;
        const filename_len = std.mem.readInt(u32, bytes[pos..][0..4], .little);
        pos += 4;
        if (pos + filename_len > bytes.len) return error.InvalidMetadata;
        const filename = try allocator.dupe(u8, bytes[pos..][0..filename_len]);
        pos += filename_len;

        // Size
        if (pos + 8 > bytes.len) return error.InvalidMetadata;
        const size = std.mem.readInt(u64, bytes[pos..][0..8], .little);
        pos += 8;

        // MIME type
        if (pos + 4 > bytes.len) return error.InvalidMetadata;
        const mime_len = std.mem.readInt(u32, bytes[pos..][0..4], .little);
        pos += 4;
        if (pos + mime_len > bytes.len) return error.InvalidMetadata;
        const mime_type = try allocator.dupe(u8, bytes[pos..][0..mime_len]);
        pos += mime_len;

        // Timestamps
        if (pos + 8 > bytes.len) return error.InvalidMetadata;
        const created = std.mem.readInt(i64, bytes[pos..][0..8], .little);
        pos += 8;
        if (pos + 8 > bytes.len) return error.InvalidMetadata;
        const modified = std.mem.readInt(i64, bytes[pos..][0..8], .little);
        pos += 8;

        // Content info
        if (pos + 32 > bytes.len) return error.InvalidMetadata;
        var content_hash: [32]u8 = undefined;
        @memcpy(&content_hash, bytes[pos..][0..32]);
        pos += 32;

        if (pos + 32 > bytes.len) return error.InvalidMetadata;
        var content_key: [32]u8 = undefined;
        @memcpy(&content_key, bytes[pos..][0..32]);
        pos += 32;

        if (pos + 12 > bytes.len) return error.InvalidMetadata;
        var content_nonce: [12]u8 = undefined;
        @memcpy(&content_nonce, bytes[pos..][0..12]);
        pos += 12;

        return FileMetadata{
            .version = version,
            .filename = filename,
            .size = size,
            .mime_type = mime_type,
            .created = created,
            .modified = modified,
            .content_hash = content_hash,
            .content_key = content_key,
            .content_nonce = content_nonce,
        };
    }

    /// Free allocated resources
    pub fn deinit(self: *FileMetadata, allocator: std.mem.Allocator) void {
        allocator.free(self.filename);
        allocator.free(self.mime_type);
    }
};

test "metadata serialization round-trip" {
    const allocator = std.testing.allocator;

    const metadata = FileMetadata{
        .version = 0x01,
        .filename = "test.txt",
        .size = 1234,
        .mime_type = "text/plain",
        .created = 1700000000,
        .modified = 1700000001,
        .content_hash = [_]u8{0xAB} ** 32,
        .content_key = [_]u8{0xCD} ** 32,
        .content_nonce = [_]u8{0xEF} ** 12,
    };

    const bytes = try metadata.serialize(allocator);
    defer allocator.free(bytes);

    var deserialized = try FileMetadata.deserialize(bytes, allocator);
    defer deserialized.deinit(allocator);

    try std.testing.expectEqualStrings(metadata.filename, deserialized.filename);
    try std.testing.expectEqual(metadata.size, deserialized.size);
    try std.testing.expectEqualStrings(metadata.mime_type, deserialized.mime_type);
    try std.testing.expectEqual(metadata.created, deserialized.created);
    try std.testing.expectEqualSlices(u8, &metadata.content_hash, &deserialized.content_hash);
    try std.testing.expectEqualSlices(u8, &metadata.content_key, &deserialized.content_key);
}
