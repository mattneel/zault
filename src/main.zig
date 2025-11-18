const std = @import("std");
const zault = @import("zault");

pub fn main() !void {
    std.debug.print("Zault v0.1.0 - Post-quantum encrypted storage\n", .{});
    std.debug.print("\n", .{});
    std.debug.print("Core modules initialized:\n", .{});
    std.debug.print("  - crypto (ML-DSA-65, ML-KEM-768, ChaCha20-Poly1305, SHA3-256)\n", .{});
    std.debug.print("  - identity (ML-DSA keypairs)\n", .{});
    std.debug.print("  - block (content-addressed blocks)\n", .{});
    std.debug.print("  - store (local filesystem storage)\n", .{});
    std.debug.print("\n", .{});
    std.debug.print("Run `zig build test` to verify all functionality.\n", .{});
}

test "can generate identity" {
    const identity = zault.Identity.generate();
    try std.testing.expectEqual(@as(u8, 0x01), identity.version);
}

test "can create block" {
    var block = zault.Block{
        .version = 0x01,
        .block_type = .content,
        .timestamp = 0,
        .author = undefined,
        .data = "test",
        .nonce = undefined,
        .signature = undefined,
        .prev_hash = undefined,
        .hash = undefined,
    };
    @memset(&block.author, 0);
    @memset(&block.nonce, 0);
    @memset(&block.signature, 0);
    @memset(&block.prev_hash, 0);

    block.hash = block.computeHash();
    try std.testing.expectEqual(@as(usize, 32), block.hash.len);
}
