//! C FFI bindings for libzault
//!
//! This module exposes Zault's core functionality through a C-compatible ABI.
//! All functions use raw pointers and return integer error codes.
//!
//! ## Error Codes
//!
//! - 0: Success
//! - -1: Invalid argument
//! - -2: Allocation failure
//! - -3: I/O error
//! - -4: Cryptographic error
//! - -5: Invalid block/data
//! - -6: Not found
//! - -7: Already exists
//! - -8: Authentication failed
//!
//! ## Memory Management
//!
//! Functions that allocate memory (returning `*_out` parameters) require the caller
//! to free the memory using `zault_free()`. Opaque handles (ZaultVault*, ZaultIdentity*)
//! must be freed with their respective `*_destroy()` functions.

const std = @import("std");
const zault = @import("zault");

const Vault = zault.Vault;
const Identity = zault.Identity;
const Block = zault.Block;
const BlockHash = zault.BlockHash;
const crypto = zault.crypto;

// =============================================================================
// Error codes
// =============================================================================

pub const ZAULT_OK: c_int = 0;
pub const ZAULT_ERR_INVALID_ARG: c_int = -1;
pub const ZAULT_ERR_ALLOC: c_int = -2;
pub const ZAULT_ERR_IO: c_int = -3;
pub const ZAULT_ERR_CRYPTO: c_int = -4;
pub const ZAULT_ERR_INVALID_DATA: c_int = -5;
pub const ZAULT_ERR_NOT_FOUND: c_int = -6;
pub const ZAULT_ERR_EXISTS: c_int = -7;
pub const ZAULT_ERR_AUTH_FAILED: c_int = -8;

// =============================================================================
// Constants
// =============================================================================

pub const ZAULT_HASH_LEN: usize = 32;
pub const ZAULT_MLDSA65_PK_LEN: usize = crypto.MLDSA65.PublicKey.encoded_length;
pub const ZAULT_MLDSA65_SK_LEN: usize = crypto.MLDSA65.SecretKey.encoded_length;
pub const ZAULT_MLKEM768_PK_LEN: usize = crypto.MLKem768.PublicKey.encoded_length;
pub const ZAULT_MLKEM768_SK_LEN: usize = crypto.MLKem768.SecretKey.encoded_length;

// =============================================================================
// Allocator for FFI
// =============================================================================

var gpa = std.heap.GeneralPurposeAllocator(.{}){};
const ffi_allocator = gpa.allocator();

// =============================================================================
// Opaque handle types
// =============================================================================

/// Opaque vault handle
pub const ZaultVault = opaque {};

/// Opaque identity handle
pub const ZaultIdentity = opaque {};

// =============================================================================
// Memory management
// =============================================================================

/// Free memory allocated by libzault functions.
/// Do NOT use this for opaque handles (use *_destroy instead).
export fn zault_free(ptr: ?*anyopaque) void {
    if (ptr) |p| {
        // We can't know the size, so we use a slice trick
        // This works because we always allocate with ffi_allocator
        const byte_ptr: [*]u8 = @ptrCast(p);
        // Unfortunately we can't free without knowing size
        // For now, this is a no-op placeholder
        // Real implementation would need to track allocations
        _ = byte_ptr;
    }
}

// =============================================================================
// Identity functions
// =============================================================================

/// Generate a new random identity.
/// Returns an opaque handle that must be freed with zault_identity_destroy().
export fn zault_identity_generate() ?*ZaultIdentity {
    const identity_ptr = ffi_allocator.create(Identity) catch return null;
    identity_ptr.* = Identity.generate();
    return @ptrCast(identity_ptr);
}

/// Generate identity from a 32-byte seed (deterministic).
export fn zault_identity_from_seed(
    seed_ptr: ?[*]const u8,
    seed_len: usize,
) ?*ZaultIdentity {
    if (seed_ptr == null or seed_len != 32) return null;

    const seed: *const [32]u8 = @ptrCast(seed_ptr.?);
    const identity_ptr = ffi_allocator.create(Identity) catch return null;
    identity_ptr.* = Identity.fromSeed(seed.*) catch {
        ffi_allocator.destroy(identity_ptr);
        return null;
    };
    return @ptrCast(identity_ptr);
}

/// Destroy an identity handle.
export fn zault_identity_destroy(handle: ?*ZaultIdentity) void {
    if (handle) |h| {
        const identity_ptr: *Identity = @ptrCast(@alignCast(h));
        // Zero out secret keys before freeing
        @memset(&identity_ptr.secret_key, 0);
        @memset(&identity_ptr.kem_secret_key, 0);
        ffi_allocator.destroy(identity_ptr);
    }
}

/// Get the ML-DSA-65 public key from an identity.
/// Writes ZAULT_MLDSA65_PK_LEN bytes to pk_out.
export fn zault_identity_get_public_key(
    handle: ?*const ZaultIdentity,
    pk_out: ?[*]u8,
    pk_out_len: usize,
) c_int {
    if (handle == null or pk_out == null) return ZAULT_ERR_INVALID_ARG;
    if (pk_out_len < ZAULT_MLDSA65_PK_LEN) return ZAULT_ERR_INVALID_ARG;

    const identity: *const Identity = @ptrCast(@alignCast(handle.?));
    @memcpy(pk_out.?[0..ZAULT_MLDSA65_PK_LEN], &identity.public_key);
    return ZAULT_OK;
}

/// Get the ML-KEM-768 public key from an identity (for receiving shares).
/// Writes ZAULT_MLKEM768_PK_LEN bytes to pk_out.
export fn zault_identity_get_kem_public_key(
    handle: ?*const ZaultIdentity,
    pk_out: ?[*]u8,
    pk_out_len: usize,
) c_int {
    if (handle == null or pk_out == null) return ZAULT_ERR_INVALID_ARG;
    if (pk_out_len < ZAULT_MLKEM768_PK_LEN) return ZAULT_ERR_INVALID_ARG;

    const identity: *const Identity = @ptrCast(@alignCast(handle.?));
    @memcpy(pk_out.?[0..ZAULT_MLKEM768_PK_LEN], &identity.kem_public_key);
    return ZAULT_OK;
}

/// Save identity to a file.
export fn zault_identity_save(
    handle: ?*const ZaultIdentity,
    path_ptr: ?[*]const u8,
    path_len: usize,
) c_int {
    if (handle == null or path_ptr == null or path_len == 0) return ZAULT_ERR_INVALID_ARG;

    const identity: *const Identity = @ptrCast(@alignCast(handle.?));
    const path = path_ptr.?[0..path_len];

    // Need null-terminated path for Zig's fs API
    const path_z = ffi_allocator.allocSentinel(u8, path_len, 0) catch return ZAULT_ERR_ALLOC;
    defer ffi_allocator.free(path_z);
    @memcpy(path_z[0..path_len], path);

    identity.save(path_z) catch return ZAULT_ERR_IO;
    return ZAULT_OK;
}

/// Load identity from a file.
export fn zault_identity_load(
    path_ptr: ?[*]const u8,
    path_len: usize,
) ?*ZaultIdentity {
    if (path_ptr == null or path_len == 0) return null;

    const path = path_ptr.?[0..path_len];

    // Need null-terminated path
    const path_z = ffi_allocator.allocSentinel(u8, path_len, 0) catch return null;
    defer ffi_allocator.free(path_z);
    @memcpy(path_z[0..path_len], path);

    const identity_ptr = ffi_allocator.create(Identity) catch return null;
    identity_ptr.* = Identity.load(path_z) catch {
        ffi_allocator.destroy(identity_ptr);
        return null;
    };
    return @ptrCast(identity_ptr);
}

// =============================================================================
// Vault functions
// =============================================================================

/// Initialize or open a vault at the given path.
/// Returns an opaque handle that must be freed with zault_vault_destroy().
export fn zault_vault_init(
    path_ptr: ?[*]const u8,
    path_len: usize,
) ?*ZaultVault {
    if (path_ptr == null or path_len == 0) return null;

    const path = path_ptr.?[0..path_len];

    // Need null-terminated path
    const path_z = ffi_allocator.allocSentinel(u8, path_len, 0) catch return null;
    defer ffi_allocator.free(path_z);
    @memcpy(path_z[0..path_len], path);

    const vault_ptr = ffi_allocator.create(Vault) catch return null;
    vault_ptr.* = Vault.init(ffi_allocator, path_z) catch {
        ffi_allocator.destroy(vault_ptr);
        return null;
    };
    return @ptrCast(vault_ptr);
}

/// Destroy a vault handle.
export fn zault_vault_destroy(handle: ?*ZaultVault) void {
    if (handle) |h| {
        const vault_ptr: *Vault = @ptrCast(@alignCast(h));
        // Zero out master key before freeing
        @memset(&vault_ptr.master_key, 0);
        vault_ptr.deinit();
        ffi_allocator.destroy(vault_ptr);
    }
}

/// Add a file to the vault.
/// On success, writes the 32-byte hash to hash_out.
export fn zault_vault_add_file(
    handle: ?*ZaultVault,
    file_path_ptr: ?[*]const u8,
    file_path_len: usize,
    hash_out: ?[*]u8,
    hash_out_len: usize,
) c_int {
    if (handle == null or file_path_ptr == null or file_path_len == 0) return ZAULT_ERR_INVALID_ARG;
    if (hash_out == null or hash_out_len < ZAULT_HASH_LEN) return ZAULT_ERR_INVALID_ARG;

    const vault: *Vault = @ptrCast(@alignCast(handle.?));
    const file_path = file_path_ptr.?[0..file_path_len];

    // Need null-terminated path
    const path_z = ffi_allocator.allocSentinel(u8, file_path_len, 0) catch return ZAULT_ERR_ALLOC;
    defer ffi_allocator.free(path_z);
    @memcpy(path_z[0..file_path_len], file_path);

    const hash = vault.addFile(path_z) catch |err| {
        return switch (err) {
            error.FileNotFound => ZAULT_ERR_NOT_FOUND,
            error.OutOfMemory => ZAULT_ERR_ALLOC,
            else => ZAULT_ERR_IO,
        };
    };

    @memcpy(hash_out.?[0..ZAULT_HASH_LEN], &hash);
    return ZAULT_OK;
}

/// Get a file from the vault by hash.
export fn zault_vault_get_file(
    handle: ?*ZaultVault,
    hash_ptr: ?[*]const u8,
    hash_len: usize,
    output_path_ptr: ?[*]const u8,
    output_path_len: usize,
) c_int {
    if (handle == null or hash_ptr == null or hash_len != ZAULT_HASH_LEN) return ZAULT_ERR_INVALID_ARG;
    if (output_path_ptr == null or output_path_len == 0) return ZAULT_ERR_INVALID_ARG;

    const vault: *Vault = @ptrCast(@alignCast(handle.?));
    const hash: *const [32]u8 = @ptrCast(hash_ptr.?);
    const output_path = output_path_ptr.?[0..output_path_len];

    // Need null-terminated path
    const path_z = ffi_allocator.allocSentinel(u8, output_path_len, 0) catch return ZAULT_ERR_ALLOC;
    defer ffi_allocator.free(path_z);
    @memcpy(path_z[0..output_path_len], output_path);

    vault.getFile(hash.*, path_z) catch |err| {
        return switch (err) {
            error.FileNotFound => ZAULT_ERR_NOT_FOUND,
            error.OutOfMemory => ZAULT_ERR_ALLOC,
            error.AuthenticationFailed => ZAULT_ERR_AUTH_FAILED,
            else => ZAULT_ERR_IO,
        };
    };

    return ZAULT_OK;
}

/// Get the vault's ML-KEM-768 public key (for receiving shares).
export fn zault_vault_get_kem_public_key(
    handle: ?*const ZaultVault,
    pk_out: ?[*]u8,
    pk_out_len: usize,
) c_int {
    if (handle == null or pk_out == null) return ZAULT_ERR_INVALID_ARG;
    if (pk_out_len < ZAULT_MLKEM768_PK_LEN) return ZAULT_ERR_INVALID_ARG;

    const vault: *const Vault = @ptrCast(@alignCast(handle.?));
    @memcpy(pk_out.?[0..ZAULT_MLKEM768_PK_LEN], &vault.identity.kem_public_key);
    return ZAULT_OK;
}

// =============================================================================
// Sharing functions
// =============================================================================

/// Create a share token for a file.
/// Returns the encrypted token length on success, or negative error code.
/// Call with token_out=NULL to get required buffer size.
export fn zault_vault_create_share(
    handle: ?*ZaultVault,
    file_hash_ptr: ?[*]const u8,
    file_hash_len: usize,
    recipient_kem_pk_ptr: ?[*]const u8,
    recipient_kem_pk_len: usize,
    expires_at: i64,
    token_out: ?[*]u8,
    token_out_len: usize,
    token_len_out: ?*usize,
) c_int {
    if (handle == null or file_hash_ptr == null or file_hash_len != ZAULT_HASH_LEN) return ZAULT_ERR_INVALID_ARG;
    if (recipient_kem_pk_ptr == null or recipient_kem_pk_len != ZAULT_MLKEM768_PK_LEN) return ZAULT_ERR_INVALID_ARG;

    const vault: *Vault = @ptrCast(@alignCast(handle.?));
    const file_hash: *const [32]u8 = @ptrCast(file_hash_ptr.?);
    const recipient_pk: *const [ZAULT_MLKEM768_PK_LEN]u8 = @ptrCast(recipient_kem_pk_ptr.?);

    const token = vault.createShare(file_hash.*, recipient_pk, expires_at, ffi_allocator) catch |err| {
        return switch (err) {
            error.FileNotFound => ZAULT_ERR_NOT_FOUND,
            error.OutOfMemory => ZAULT_ERR_ALLOC,
            error.AuthenticationFailed => ZAULT_ERR_AUTH_FAILED,
            else => ZAULT_ERR_CRYPTO,
        };
    };
    defer ffi_allocator.free(token);

    if (token_len_out) |len_out| {
        len_out.* = token.len;
    }

    if (token_out) |out| {
        if (token_out_len < token.len) return ZAULT_ERR_INVALID_ARG;
        @memcpy(out[0..token.len], token);
    }

    return ZAULT_OK;
}

/// Redeem a share token and get decryption info.
/// On success, writes file_hash (32 bytes) to hash_out.
export fn zault_vault_redeem_share(
    handle: ?*ZaultVault,
    token_ptr: ?[*]const u8,
    token_len: usize,
    hash_out: ?[*]u8,
    hash_out_len: usize,
) c_int {
    if (handle == null or token_ptr == null or token_len == 0) return ZAULT_ERR_INVALID_ARG;
    if (hash_out == null or hash_out_len < ZAULT_HASH_LEN) return ZAULT_ERR_INVALID_ARG;

    const vault: *Vault = @ptrCast(@alignCast(handle.?));
    const token = token_ptr.?[0..token_len];

    const share_info = vault.redeemShare(token, ffi_allocator) catch |err| {
        return switch (err) {
            error.OutOfMemory => ZAULT_ERR_ALLOC,
            error.AuthenticationFailed => ZAULT_ERR_AUTH_FAILED,
            error.ShareExpired => ZAULT_ERR_AUTH_FAILED,
            else => ZAULT_ERR_CRYPTO,
        };
    };

    @memcpy(hash_out.?[0..ZAULT_HASH_LEN], &share_info.file_hash);
    return ZAULT_OK;
}

// =============================================================================
// Block export/import
// =============================================================================

/// Export blocks to a file.
export fn zault_vault_export_blocks(
    handle: ?*ZaultVault,
    hashes_ptr: ?[*]const u8,
    hash_count: usize,
    output_path_ptr: ?[*]const u8,
    output_path_len: usize,
) c_int {
    if (handle == null or output_path_ptr == null or output_path_len == 0) return ZAULT_ERR_INVALID_ARG;
    if (hash_count > 0 and hashes_ptr == null) return ZAULT_ERR_INVALID_ARG;

    const vault: *Vault = @ptrCast(@alignCast(handle.?));
    const output_path = output_path_ptr.?[0..output_path_len];

    // Need null-terminated path
    const path_z = ffi_allocator.allocSentinel(u8, output_path_len, 0) catch return ZAULT_ERR_ALLOC;
    defer ffi_allocator.free(path_z);
    @memcpy(path_z[0..output_path_len], output_path);

    // Convert flat hash array to slice of BlockHash
    const hashes = ffi_allocator.alloc(BlockHash, hash_count) catch return ZAULT_ERR_ALLOC;
    defer ffi_allocator.free(hashes);

    if (hashes_ptr) |hp| {
        for (0..hash_count) |i| {
            @memcpy(&hashes[i], hp[i * ZAULT_HASH_LEN ..][0..ZAULT_HASH_LEN]);
        }
    }

    vault.exportBlocks(hashes, path_z, ffi_allocator) catch |err| {
        return switch (err) {
            error.FileNotFound => ZAULT_ERR_NOT_FOUND,
            error.OutOfMemory => ZAULT_ERR_ALLOC,
            else => ZAULT_ERR_IO,
        };
    };

    return ZAULT_OK;
}

/// Import blocks from a file.
/// Returns the number of imported blocks on success, or negative error code.
export fn zault_vault_import_blocks(
    handle: ?*ZaultVault,
    import_path_ptr: ?[*]const u8,
    import_path_len: usize,
) c_int {
    if (handle == null or import_path_ptr == null or import_path_len == 0) return ZAULT_ERR_INVALID_ARG;

    const vault: *Vault = @ptrCast(@alignCast(handle.?));
    const import_path = import_path_ptr.?[0..import_path_len];

    // Need null-terminated path
    const path_z = ffi_allocator.allocSentinel(u8, import_path_len, 0) catch return ZAULT_ERR_ALLOC;
    defer ffi_allocator.free(path_z);
    @memcpy(path_z[0..import_path_len], import_path);

    var imported = vault.importBlocks(path_z, ffi_allocator) catch |err| {
        return switch (err) {
            error.FileNotFound => ZAULT_ERR_NOT_FOUND,
            error.OutOfMemory => ZAULT_ERR_ALLOC,
            error.InvalidExportFile => ZAULT_ERR_INVALID_DATA,
            else => ZAULT_ERR_IO,
        };
    };
    defer imported.deinit(ffi_allocator);

    return @intCast(imported.items.len);
}

// =============================================================================
// Crypto utilities (standalone, no vault needed)
// =============================================================================

/// Hash data with SHA3-256.
/// Writes 32 bytes to hash_out.
export fn zault_sha3_256(
    data_ptr: ?[*]const u8,
    data_len: usize,
    hash_out: ?[*]u8,
    hash_out_len: usize,
) c_int {
    if (hash_out == null or hash_out_len < 32) return ZAULT_ERR_INVALID_ARG;

    const data = if (data_ptr) |p| p[0..data_len] else &[_]u8{};
    var hash: [32]u8 = undefined;
    crypto.Sha3_256.hash(data, &hash, .{});
    @memcpy(hash_out.?[0..32], &hash);
    return ZAULT_OK;
}

/// Generate cryptographically secure random bytes.
export fn zault_random_bytes(
    out_ptr: ?[*]u8,
    out_len: usize,
) c_int {
    if (out_ptr == null or out_len == 0) return ZAULT_ERR_INVALID_ARG;
    crypto.random.bytes(out_ptr.?[0..out_len]);
    return ZAULT_OK;
}

// =============================================================================
// Version info
// =============================================================================

/// Get the library version string.
/// Returns a pointer to a static null-terminated string.
export fn zault_version() [*:0]const u8 {
    return "0.2.0";
}

// =============================================================================
// Tests
// =============================================================================

test "ffi identity round-trip" {
    const identity = zault_identity_generate();
    try std.testing.expect(identity != null);
    defer zault_identity_destroy(identity);

    var pk: [ZAULT_MLDSA65_PK_LEN]u8 = undefined;
    const result = zault_identity_get_public_key(identity, &pk, pk.len);
    try std.testing.expectEqual(ZAULT_OK, result);

    // Public key should not be all zeros
    var all_zero = true;
    for (pk) |b| {
        if (b != 0) {
            all_zero = false;
            break;
        }
    }
    try std.testing.expect(!all_zero);
}

test "ffi sha3-256" {
    const data = "test data";
    var hash: [32]u8 = undefined;
    const result = zault_sha3_256(data.ptr, data.len, &hash, hash.len);
    try std.testing.expectEqual(ZAULT_OK, result);

    // Verify against known hash
    var expected: [32]u8 = undefined;
    crypto.Sha3_256.hash(data, &expected, .{});
    try std.testing.expectEqualSlices(u8, &expected, &hash);
}

test "ffi random bytes" {
    var buf1: [32]u8 = undefined;
    var buf2: [32]u8 = undefined;

    _ = zault_random_bytes(&buf1, buf1.len);
    _ = zault_random_bytes(&buf2, buf2.len);

    // Two random outputs should (almost certainly) differ
    try std.testing.expect(!std.mem.eql(u8, &buf1, &buf2));
}

test "ffi version" {
    const ver = zault_version();
    try std.testing.expect(ver[0] != 0);
}

