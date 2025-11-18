//! Zault - Post-quantum encrypted storage library
//!
//! This is the main library entry point for the Zault core functionality.

const std = @import("std");

// Export core modules
pub const crypto = @import("core/crypto.zig");
pub const identity = @import("core/identity.zig");
pub const block = @import("core/block.zig");
pub const store = @import("core/store.zig");
pub const vault = @import("core/vault.zig");
pub const metadata = @import("core/metadata.zig");

// Re-export commonly used types
pub const Identity = identity.Identity;
pub const Block = block.Block;
pub const BlockType = block.BlockType;
pub const BlockStore = store.BlockStore;
pub const BlockHash = store.BlockHash;
pub const Vault = vault.Vault;
pub const FileMetadata = metadata.FileMetadata;

test "core modules are accessible (also doubles as a test aggregator)" {
    // Verify all modules are accessible
    _ = crypto;
    _ = identity;
    _ = block;
    _ = store;
    _ = vault;
    _ = metadata;
}
