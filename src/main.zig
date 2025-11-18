const std = @import("std");
const commands = @import("cli/commands.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();

    const allocator = gpa.allocator();

    try commands.run(allocator);
}

test "CLI compiles" {
    // Just verify the CLI module compiles
    _ = commands;
}
