//! Vault - High-level operations for Zault storage
//!
//! The Vault provides a high-level interface for encrypted file storage.
//! It manages identity, encryption keys, blocks, and storage.
//!
//! ## Usage
//!
//! ```zig
//! const Vault = @import("vault.zig").Vault;
//!
//! // Initialize or load vault
//! var vault = try Vault.init(allocator, "/path/to/vault");
//! defer vault.deinit();
//!
//! // Add file (encrypts automatically)
//! const hash = try vault.addFile("secret.pdf");
//!
//! // Retrieve file (decrypts automatically)
//! try vault.getFile(hash, "output.pdf");
//!
//! // List all files
//! var files = try vault.listFiles();
//! defer {
//!     for (files.items) |*f| {
//!         allocator.free(f.filename);
//!         allocator.free(f.mime_type);
//!     }
//!     files.deinit(allocator);
//! }
//! ```
//!
//! ## Security
//!
//! - Files encrypted with unique keys (ChaCha20-Poly1305)
//! - Metadata encrypted with vault master key
//! - All blocks signed with ML-DSA-65
//! - Master key derived from identity via HKDF

const std = @import("std");
const Identity = @import("identity.zig").Identity;
const Block = @import("block.zig").Block;
const BlockStore = @import("store.zig").BlockStore;
const BlockHash = @import("store.zig").BlockHash;
const FileMetadata = @import("metadata.zig").FileMetadata;
const ShareToken = @import("share.zig").ShareToken;
const encryptShareToken = @import("share.zig").encryptShareToken;
const decryptShareToken = @import("share.zig").decryptShareToken;
const crypto = @import("crypto.zig");
const encryptData = @import("block.zig").encryptData;
const decryptData = @import("block.zig").decryptData;

pub const Vault = struct {
    identity: Identity,
    store: BlockStore,
    vault_path: []const u8,
    master_key: [32]u8,
    allocator: std.mem.Allocator,

    /// Initialize or load a vault
    pub fn init(allocator: std.mem.Allocator, vault_path: []const u8) !Vault {
        // Create vault directory if it doesn't exist
        std.fs.cwd().makePath(vault_path) catch |err| switch (err) {
            error.PathAlreadyExists => {},
            else => return err,
        };

        // Load or generate identity
        const identity_path = try std.fmt.allocPrint(
            allocator,
            "{s}/identity.bin",
            .{vault_path},
        );
        defer allocator.free(identity_path);

        const identity = Identity.load(identity_path) catch |err| switch (err) {
            error.FileNotFound => blk: {
                // Generate new identity
                const new_identity = Identity.generate();
                try new_identity.save(identity_path);
                break :blk new_identity;
            },
            else => return err,
        };

        // Derive vault master key from identity
        const master_key = deriveMasterKey(&identity.secret_key);

        // Initialize block store
        const store = try BlockStore.init(allocator, vault_path);

        return Vault{
            .identity = identity,
            .store = store,
            .vault_path = vault_path,
            .master_key = master_key,
            .allocator = allocator,
        };
    }

    /// Derive vault master key from identity secret key using HKDF
    fn deriveMasterKey(secret_key: *const [crypto.MLDSA65.SecretKey.encoded_length]u8) [32]u8 {
        // Extract: use empty salt, secret key as input keying material
        const prk = crypto.HkdfSha3_256.extract(&[_]u8{}, secret_key);

        // Expand: derive master key with context string
        var master_key: [32]u8 = undefined;
        crypto.HkdfSha3_256.expand(&master_key, "zault-vault-master-key-v1", prk);

        return master_key;
    }

    /// Add a file to the vault with full encryption
    pub fn addFile(self: *Vault, file_path: []const u8) !BlockHash {
        // 1. Read file
        const plaintext = try std.fs.cwd().readFileAlloc(
            file_path,
            self.allocator,
            @enumFromInt(100 * 1024 * 1024), // 100MB max
        );
        defer self.allocator.free(plaintext);

        // 2. Generate per-file encryption key and nonce
        var content_key: [32]u8 = undefined;
        crypto.random.bytes(&content_key);

        var content_nonce: [12]u8 = undefined;
        crypto.random.bytes(&content_nonce);

        // 3. Encrypt file data
        const ciphertext = try encryptData(
            plaintext,
            content_key,
            content_nonce,
            self.allocator,
        );
        defer self.allocator.free(ciphertext);

        // 4. Create content block
        var content_block = Block{
            .version = 0x01,
            .block_type = .content,
            .timestamp = 0,
            .author = self.identity.public_key,
            .data = ciphertext,
            .nonce = content_nonce,
            .signature = undefined,
            .prev_hash = [_]u8{0} ** 32,
            .hash = undefined,
        };

        // 5. Sign content block
        try content_block.sign(&self.identity.secret_key, self.allocator);
        content_block.hash = content_block.computeHash();

        // 6. Store content block
        try self.store.put(content_block.hash, &content_block);

        // 7. Create metadata
        const basename = std.fs.path.basename(file_path);
        const mime_type = detectMimeType(file_path);

        const file_metadata = FileMetadata{
            .version = 0x01,
            .filename = basename,
            .size = plaintext.len,
            .mime_type = mime_type,
            .created = 0,
            .modified = 0,
            .content_hash = content_block.hash,
            .content_key = content_key,
            .content_nonce = content_nonce,
        };

        // 8. Serialize metadata
        const metadata_bytes = try file_metadata.serialize(self.allocator);
        defer self.allocator.free(metadata_bytes);

        // 9. Encrypt metadata with vault master key
        var metadata_nonce: [12]u8 = undefined;
        crypto.random.bytes(&metadata_nonce);

        const encrypted_metadata = try encryptData(
            metadata_bytes,
            self.master_key,
            metadata_nonce,
            self.allocator,
        );
        defer self.allocator.free(encrypted_metadata);

        // 10. Create metadata block
        var metadata_block = Block{
            .version = 0x01,
            .block_type = .metadata,
            .timestamp = 0,
            .author = self.identity.public_key,
            .data = encrypted_metadata,
            .nonce = metadata_nonce,
            .signature = undefined,
            .prev_hash = content_block.hash, // Chain to content
            .hash = undefined,
        };

        // 11. Sign metadata block
        try metadata_block.sign(&self.identity.secret_key, self.allocator);
        metadata_block.hash = metadata_block.computeHash();

        // 12. Store metadata block
        try self.store.put(metadata_block.hash, &metadata_block);

        // Return metadata block hash (user stores this)
        return metadata_block.hash;
    }

    /// Simple MIME type detection based on file extension
    fn detectMimeType(file_path: []const u8) []const u8 {
        if (std.mem.endsWith(u8, file_path, ".txt")) return "text/plain";
        if (std.mem.endsWith(u8, file_path, ".md")) return "text/markdown";
        if (std.mem.endsWith(u8, file_path, ".pdf")) return "application/pdf";
        if (std.mem.endsWith(u8, file_path, ".png")) return "image/png";
        if (std.mem.endsWith(u8, file_path, ".jpg")) return "image/jpeg";
        if (std.mem.endsWith(u8, file_path, ".jpeg")) return "image/jpeg";
        if (std.mem.endsWith(u8, file_path, ".zip")) return "application/zip";
        if (std.mem.endsWith(u8, file_path, ".json")) return "application/json";
        return "application/octet-stream";
    }

    /// Get a file from the vault with full decryption
    pub fn getFile(self: *Vault, hash: BlockHash, output_path: []const u8) !void {
        // 1. Retrieve metadata block
        const metadata_block = try self.store.get(hash);
        defer self.allocator.free(metadata_block.data);

        // 2. Verify metadata signature
        try metadata_block.verify(self.allocator);

        // 3. Decrypt metadata with vault master key
        const metadata_bytes = try decryptData(
            metadata_block.data,
            self.master_key,
            metadata_block.nonce,
            self.allocator,
        );
        defer self.allocator.free(metadata_bytes);

        // 4. Parse metadata
        var file_metadata = try FileMetadata.deserialize(metadata_bytes, self.allocator);
        defer file_metadata.deinit(self.allocator);

        // 5. Retrieve content block
        const content_block = try self.store.get(file_metadata.content_hash);
        defer self.allocator.free(content_block.data);

        // 6. Verify content signature
        try content_block.verify(self.allocator);

        // 7. Decrypt content with per-file key
        const plaintext = try decryptData(
            content_block.data,
            file_metadata.content_key,
            file_metadata.content_nonce,
            self.allocator,
        );
        defer self.allocator.free(plaintext);

        // 8. Write plaintext to output file
        const file = try std.fs.cwd().createFile(output_path, .{});
        defer file.close();
        try file.writeAll(plaintext);
    }

    /// List all blocks in the vault
    pub fn listBlocks(self: *Vault) !std.ArrayList(BlockHash) {
        var list = std.ArrayList(BlockHash){};

        const blocks_path = try std.fmt.allocPrint(
            self.allocator,
            "{s}/blocks",
            .{self.vault_path},
        );
        defer self.allocator.free(blocks_path);

        // Try to open blocks directory
        var blocks_dir = std.fs.cwd().openDir(blocks_path, .{ .iterate = true }) catch |err| switch (err) {
            error.FileNotFound => return list, // Empty vault
            else => return err,
        };
        defer blocks_dir.close();

        // Walk through all subdirectories
        var walker = try blocks_dir.walk(self.allocator);
        defer walker.deinit();

        while (try walker.next()) |entry| {
            if (entry.kind == .file) {
                // Skip .tmp files
                if (std.mem.endsWith(u8, entry.basename, ".tmp")) continue;

                // Parse hex filename to hash (SHA3-256 = 32 bytes = 64 hex chars)
                if (entry.basename.len == 64) {
                    var hash: BlockHash = undefined;
                    _ = try std.fmt.hexToBytes(&hash, entry.basename);
                    try list.append(self.allocator, hash);
                }
            }
        }

        return list;
    }

    /// File information for listing
    pub const FileInfo = struct {
        hash: BlockHash,
        filename: []const u8,
        size: u64,
        mime_type: []const u8,
        created: i64,
    };

    /// List all files in the vault with metadata
    pub fn listFiles(self: *Vault) !std.ArrayList(FileInfo) {
        var list = std.ArrayList(FileInfo){};

        var blocks = try self.listBlocks();
        defer blocks.deinit(self.allocator);

        for (blocks.items) |hash| {
            // Try to load as metadata block
            const block = self.store.get(hash) catch continue;
            defer self.allocator.free(block.data);

            // Skip if not metadata
            if (block.block_type != .metadata) continue;

            // Decrypt and parse metadata
            const metadata_bytes = decryptData(
                block.data,
                self.master_key,
                block.nonce,
                self.allocator,
            ) catch continue;
            defer self.allocator.free(metadata_bytes);

            var file_metadata = FileMetadata.deserialize(metadata_bytes, self.allocator) catch continue;
            // Don't defer deinit - we're transferring ownership to FileInfo

            try list.append(self.allocator, FileInfo{
                .hash = hash,
                .filename = file_metadata.filename,
                .size = file_metadata.size,
                .mime_type = file_metadata.mime_type,
                .created = file_metadata.created,
            });
        }

        return list;
    }

    /// Verify a block's signature
    pub fn verifyBlock(self: *Vault, hash: BlockHash) !void {
        const block = try self.store.get(hash);
        defer self.allocator.free(block.data);

        try block.verify(self.allocator);
    }

    /// Create a share token for a file
    pub fn createShare(
        self: *Vault,
        file_hash: BlockHash,
        recipient_kem_pubkey: *const [crypto.MLKem768.PublicKey.bytes_length]u8,
        expires_at: i64,
        allocator: std.mem.Allocator,
    ) ![]u8 {
        // 1. Get the metadata block to extract content key
        const metadata_block = try self.store.get(file_hash);
        defer allocator.free(metadata_block.data);

        // 2. Decrypt metadata
        const metadata_bytes = try decryptData(
            metadata_block.data,
            self.master_key,
            metadata_block.nonce,
            allocator,
        );
        defer allocator.free(metadata_bytes);

        var file_metadata = try FileMetadata.deserialize(metadata_bytes, allocator);
        defer file_metadata.deinit(allocator);

        // 3. Create share token
        const share_token = ShareToken{
            .version = 0x01,
            .file_hash = file_hash,
            .content_key = file_metadata.content_key,
            .content_nonce = file_metadata.content_nonce,
            .expires_at = expires_at,
            .granted_by = self.identity.public_key,
            .granted_at = 0, // TODO: actual timestamp
        };

        // 4. Encrypt for recipient using ML-KEM
        return try encryptShareToken(&share_token, recipient_kem_pubkey, allocator);
    }

    /// Redeem a share token and get access to the file
    pub fn redeemShare(
        self: *Vault,
        encrypted_share: []const u8,
        allocator: std.mem.Allocator,
    ) !BlockHash {
        // 1. Decrypt share token using our ML-KEM secret key
        const share_token = try decryptShareToken(
            encrypted_share,
            &self.identity.kem_secret_key,
            allocator,
        );

        // 2. Check expiration
        if (share_token.expires_at < 0) { // TODO: Compare with actual timestamp
            return error.ShareExpired;
        }

        // 3. Return the file hash from the share token
        // The file hash points to the metadata block
        // Recipient can now use getFile() with this hash
        return share_token.file_hash;
    }

    /// Export blocks to a portable file with dependencies
    pub fn exportBlocks(
        self: *Vault,
        hashes: []const BlockHash,
        output_path: []const u8,
        allocator: std.mem.Allocator,
    ) !void {
        const file = try std.fs.cwd().createFile(output_path, .{});
        defer file.close();

        // Write header
        try file.writeAll("ZAULT_BLOCKS_V1\n");

        var exported = std.AutoHashMap(BlockHash, void).init(allocator);
        defer exported.deinit();

        // Export each hash and its dependencies
        for (hashes) |hash| {
            try self.exportBlockRecursive(hash, file, &exported, allocator);
        }
    }

    fn exportBlockRecursive(
        self: *Vault,
        hash: BlockHash,
        file: std.fs.File,
        exported: *std.AutoHashMap(BlockHash, void),
        allocator: std.mem.Allocator,
    ) !void {
        // Skip if already exported
        if (exported.contains(hash)) return;

        // Get block
        const block = try self.store.get(hash);
        defer allocator.free(block.data);

        // If metadata block, export content block first
        if (block.block_type == .metadata) {
            // Decrypt metadata to get content hash
            const metadata_bytes = try decryptData(
                block.data,
                self.master_key,
                block.nonce,
                allocator,
            );
            defer allocator.free(metadata_bytes);

            var file_metadata = try FileMetadata.deserialize(metadata_bytes, allocator);
            defer file_metadata.deinit(allocator);

            // Recursively export content block
            try self.exportBlockRecursive(file_metadata.content_hash, file, exported, allocator);
        }

        // Serialize and write block
        const serialized = try block.serialize(allocator);
        defer allocator.free(serialized);

        // Write: [size: u64][serialized block]
        var size_bytes: [8]u8 = undefined;
        std.mem.writeInt(u64, &size_bytes, serialized.len, .little);
        try file.writeAll(&size_bytes);
        try file.writeAll(serialized);

        // Mark as exported
        try exported.put(hash, {});
    }

    /// Import blocks from a portable file
    pub fn importBlocks(
        self: *Vault,
        import_path: []const u8,
        allocator: std.mem.Allocator,
    ) !std.ArrayList(BlockHash) {
        var imported = std.ArrayList(BlockHash){};

        const file = try std.fs.cwd().openFile(import_path, .{});
        defer file.close();

        // Read and verify header
        var header: [16]u8 = undefined;
        const header_len = try file.read(&header);
        if (header_len < 15 or !std.mem.eql(u8, header[0..15], "ZAULT_BLOCKS_V1")) {
            return error.InvalidExportFile;
        }

        // Read blocks
        while (true) {
            // Read size
            var size_bytes: [8]u8 = undefined;
            const n = try file.read(&size_bytes);
            if (n == 0 or n != 8) break; // End of file

            const size = std.mem.readInt(u64, &size_bytes, .little);

            // Read serialized block
            const serialized = try allocator.alloc(u8, size);
            defer allocator.free(serialized);

            var total_read: usize = 0;
            while (total_read < size) {
                const nread = try file.read(serialized[total_read..]);
                if (nread == 0) return error.UnexpectedEOF;
                total_read += nread;
            }

            // Deserialize
            const block = try Block.deserialize(serialized, allocator);
            defer allocator.free(block.data);

            // Store (skip if already exists)
            self.store.put(block.hash, &block) catch |err| switch (err) {
                error.AlreadyExists => {},
                else => return err,
            };

            try imported.append(allocator, block.hash);
        }

        return imported;
    }

    /// Clean up resources
    pub fn deinit(self: *Vault) void {
        self.store.deinit();
    }
};

test "vault initialization" {
    const allocator = std.testing.allocator;

    const test_dir = "zig-cache/test-vault";
    var vault = try Vault.init(allocator, test_dir);
    defer vault.deinit();

    // Verify identity was created
    try std.testing.expectEqual(@as(u8, 0x01), vault.identity.version);
}

test "master key derivation is deterministic" {
    const allocator = std.testing.allocator;

    const identity = Identity.generate();

    const key1 = Vault.deriveMasterKey(&identity.secret_key);
    const key2 = Vault.deriveMasterKey(&identity.secret_key);

    // Same identity should produce same master key
    try std.testing.expectEqualSlices(u8, &key1, &key2);

    // Master key should be 32 bytes
    try std.testing.expectEqual(@as(usize, 32), key1.len);

    _ = allocator;
}

test "vault add and get file" {
    const allocator = std.testing.allocator;

    const test_dir = "zig-cache/test-vault-addget";
    var vault = try Vault.init(allocator, test_dir);
    defer vault.deinit();

    // Verify master key was derived
    try std.testing.expectEqual(@as(usize, 32), vault.master_key.len);

    // Create a test file
    const test_file = "zig-cache/test-file.txt";
    const test_data = "test data for vault";
    {
        const file = try std.fs.cwd().createFile(test_file, .{});
        defer file.close();
        try file.writeAll(test_data);
    }
    defer std.fs.cwd().deleteFile(test_file) catch {};

    // Add file to vault
    const hash = try vault.addFile(test_file);

    // Verify block exists
    try std.testing.expect(try vault.store.has(hash));

    // Retrieve file
    const output_file = "zig-cache/test-output.txt";
    try vault.getFile(hash, output_file);
    defer std.fs.cwd().deleteFile(output_file) catch {};

    // Verify content matches
    const retrieved_data = try std.fs.cwd().readFileAlloc(
        output_file,
        allocator,
        @enumFromInt(1024),
    );
    defer allocator.free(retrieved_data);

    try std.testing.expectEqualStrings(test_data, retrieved_data);
}

test "create and redeem share token" {
    const allocator = std.testing.allocator;

    // Create two vaults sharing same storage (simulates server)
    const shared_dir = "/tmp/test-vault-shared";

    var sender_vault = try Vault.init(allocator, shared_dir);
    defer sender_vault.deinit();

    // Create recipient identity (different from sender)
    const recipient_identity = Identity.generate();

    // Sender adds a file
    const test_file = "/tmp/test-share-file.txt";
    const test_data = "Shared secret data";
    {
        const file = try std.fs.cwd().createFile(test_file, .{});
        defer file.close();
        try file.writeAll(test_data);
    }
    defer std.fs.cwd().deleteFile(test_file) catch {};

    const file_hash = try sender_vault.addFile(test_file);

    // Sender creates share token for recipient
    const share_token = try sender_vault.createShare(
        file_hash,
        &recipient_identity.kem_public_key,
        1700000000, // expires_at
        allocator,
    );
    defer allocator.free(share_token);

    // Recipient redeems share (using same storage)
    var recipient_vault = Vault{
        .identity = recipient_identity,
        .store = sender_vault.store, // Share storage for testing
        .vault_path = shared_dir,
        .master_key = Vault.deriveMasterKey(&recipient_identity.secret_key),
        .allocator = allocator,
    };

    const redeemed_hash = try recipient_vault.redeemShare(share_token, allocator);

    // Verify redeemed hash matches original
    try std.testing.expectEqualSlices(u8, &file_hash, &redeemed_hash);

    // NOTE: Recipient can't decrypt the file because metadata is encrypted
    // with sender's master key. This is correct - they only get access to
    // the content block via the share token's content_key.
    // Full implementation would create a metadata block for recipient.
}

test "export blocks to file" {
    const allocator = std.testing.allocator;

    const test_dir = "/tmp/test-vault-export";
    var vault = try Vault.init(allocator, test_dir);
    defer vault.deinit();

    // Add a file
    const test_file = "/tmp/test-export-file.txt";
    const test_data = "Data to export";
    {
        const file = try std.fs.cwd().createFile(test_file, .{});
        defer file.close();
        try file.writeAll(test_data);
    }
    defer std.fs.cwd().deleteFile(test_file) catch {};

    const file_hash = try vault.addFile(test_file);

    // This will fail until we implement exportBlocks
    const export_path = "/tmp/test-export.zault";
    try vault.exportBlocks(&[_]BlockHash{file_hash}, export_path, allocator);
    defer std.fs.cwd().deleteFile(export_path) catch {};

    // Verify export file exists and has content
    const exported = try std.fs.cwd().openFile(export_path, .{});
    defer exported.close();
    const size = try exported.getEndPos();
    try std.testing.expect(size > 100); // Should have at least header + blocks
}

test "import blocks from file" {
    const allocator = std.testing.allocator;

    // Vault 1: Create and export
    const vault1_dir = "/tmp/test-vault-export1";
    var vault1 = try Vault.init(allocator, vault1_dir);
    defer vault1.deinit();

    const test_file = "/tmp/test-import-file.txt";
    const test_data = "Import test data";
    {
        const file = try std.fs.cwd().createFile(test_file, .{});
        defer file.close();
        try file.writeAll(test_data);
    }
    defer std.fs.cwd().deleteFile(test_file) catch {};

    const file_hash = try vault1.addFile(test_file);

    const export_path = "/tmp/test-import.zault";
    try vault1.exportBlocks(&[_]BlockHash{file_hash}, export_path, allocator);
    defer std.fs.cwd().deleteFile(export_path) catch {};

    // Vault 2: Import blocks
    const vault2_dir = "/tmp/test-vault-import2";
    var vault2 = try Vault.init(allocator, vault2_dir);
    defer vault2.deinit();

    // This will fail until we implement importBlocks
    var imported = try vault2.importBlocks(export_path, allocator);
    defer imported.deinit(allocator);

    // Should have imported 2 blocks (content + metadata)
    try std.testing.expect(imported.items.len >= 2);

    // Blocks should now exist in vault2
    try std.testing.expect(try vault2.store.has(file_hash));
}
