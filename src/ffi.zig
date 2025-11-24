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
pub const ZAULT_MLDSA65_SIG_LEN: usize = crypto.MLDSA65.Signature.encoded_length;
pub const ZAULT_MLKEM768_PK_LEN: usize = crypto.MLKem768.PublicKey.encoded_length;
pub const ZAULT_MLKEM768_SK_LEN: usize = crypto.MLKem768.SecretKey.encoded_length;
pub const ZAULT_MLKEM768_CT_LEN: usize = crypto.MLKem768.ciphertext_length;

// Message encryption overhead: ML-KEM ciphertext (1088) + nonce (12) + tag (16)
pub const ZAULT_MSG_OVERHEAD: usize = ZAULT_MLKEM768_CT_LEN + 12 + 16;

// Serialized public identity: ML-DSA-65 pk (1952) + ML-KEM-768 pk (1184)
pub const ZAULT_PUBLIC_IDENTITY_LEN: usize = ZAULT_MLDSA65_PK_LEN + ZAULT_MLKEM768_PK_LEN;

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
// Message encryption (memory-only, no filesystem)
// =============================================================================

/// Encrypt a message to a recipient using ML-KEM-768 + ChaCha20-Poly1305.
/// Output format: [ML-KEM ciphertext (1088)] [nonce (12)] [tag (16)] [encrypted_message]
/// Total overhead: ZAULT_MSG_OVERHEAD (1116 bytes)
export fn zault_encrypt_message(
    identity: ?*const ZaultIdentity, // NULL for anonymous
    recipient_kem_pk_ptr: ?[*]const u8,
    recipient_pk_len: usize,
    plaintext_ptr: ?[*]const u8,
    plaintext_len: usize,
    ciphertext_out: ?[*]u8,
    ciphertext_out_len: usize,
    ciphertext_len_out: ?*usize,
) c_int {
    // Validate recipient public key
    if (recipient_kem_pk_ptr == null or recipient_pk_len != ZAULT_MLKEM768_PK_LEN) {
        return ZAULT_ERR_INVALID_ARG;
    }

    // Validate output buffer
    const required_len = plaintext_len + ZAULT_MSG_OVERHEAD;
    if (ciphertext_out == null or ciphertext_out_len < required_len) {
        return ZAULT_ERR_INVALID_ARG;
    }

    // Parse recipient's ML-KEM public key
    var pk_bytes: [ZAULT_MLKEM768_PK_LEN]u8 = undefined;
    @memcpy(&pk_bytes, recipient_kem_pk_ptr.?[0..ZAULT_MLKEM768_PK_LEN]);
    const recipient_pk = crypto.MLKem768.PublicKey.fromBytes(&pk_bytes) catch {
        return ZAULT_ERR_INVALID_ARG;
    };

    // Encapsulate: generate shared secret
    const encapsulation = recipient_pk.encaps(null); // null = random seed

    // Derive encryption key from shared secret using HKDF
    const prk = crypto.HkdfSha3_256.extract(&[_]u8{}, &encapsulation.shared_secret);
    var derived_key: [32]u8 = undefined;
    crypto.HkdfSha3_256.expand(&derived_key, "zault-message-v1", prk);

    // Generate random nonce
    var nonce: [12]u8 = undefined;
    crypto.random.bytes(&nonce);

    // Get plaintext slice (handle NULL for empty message)
    const plaintext = if (plaintext_ptr) |p| p[0..plaintext_len] else &[_]u8{};

    // Output layout: [ciphertext (1088)] [nonce (12)] [tag (16)] [encrypted]
    const out = ciphertext_out.?;
    const ct_start: usize = 0;
    const nonce_start: usize = ZAULT_MLKEM768_CT_LEN;
    const tag_start: usize = nonce_start + 12;
    const enc_start: usize = tag_start + 16;

    // Copy ML-KEM ciphertext
    @memcpy(out[ct_start..][0..ZAULT_MLKEM768_CT_LEN], &encapsulation.ciphertext);

    // Copy nonce
    @memcpy(out[nonce_start..][0..12], &nonce);

    // Encrypt message with ChaCha20-Poly1305
    // Note: We use empty AD since the recipient doesn't have sender identity during decryption
    // For authenticated messages, use zault_sign() separately
    crypto.ChaCha20Poly1305.encrypt(
        out[enc_start..][0..plaintext_len],
        out[tag_start..][0..16],
        plaintext,
        &[_]u8{}, // Empty AD
        nonce,
        derived_key,
    );

    // Sender identity is reserved for future use (e.g., embedding signature)
    _ = identity;

    // Zero out derived key
    @memset(&derived_key, 0);

    if (ciphertext_len_out) |len_out| {
        len_out.* = required_len;
    }

    return ZAULT_OK;
}

/// Decrypt a message encrypted with zault_encrypt_message().
export fn zault_decrypt_message(
    identity: ?*const ZaultIdentity,
    ciphertext_ptr: ?[*]const u8,
    ciphertext_len: usize,
    plaintext_out: ?[*]u8,
    plaintext_out_len: usize,
    plaintext_len_out: ?*usize,
) c_int {
    // Validate identity
    if (identity == null) return ZAULT_ERR_INVALID_ARG;

    // Validate ciphertext (must have at least overhead)
    if (ciphertext_ptr == null or ciphertext_len < ZAULT_MSG_OVERHEAD) {
        return ZAULT_ERR_INVALID_ARG;
    }

    const encrypted_len = ciphertext_len - ZAULT_MSG_OVERHEAD;

    // Validate output buffer
    if (plaintext_out == null or plaintext_out_len < encrypted_len) {
        return ZAULT_ERR_INVALID_ARG;
    }

    const ident: *const Identity = @ptrCast(@alignCast(identity.?));
    const input = ciphertext_ptr.?;

    // Parse layout: [ciphertext (1088)] [nonce (12)] [tag (16)] [encrypted]
    const ct_start: usize = 0;
    const nonce_start: usize = ZAULT_MLKEM768_CT_LEN;
    const tag_start: usize = nonce_start + 12;
    const enc_start: usize = tag_start + 16;

    // Extract ML-KEM ciphertext
    var kem_ct: [ZAULT_MLKEM768_CT_LEN]u8 = undefined;
    @memcpy(&kem_ct, input[ct_start..][0..ZAULT_MLKEM768_CT_LEN]);

    // Extract nonce
    var nonce: [12]u8 = undefined;
    @memcpy(&nonce, input[nonce_start..][0..12]);

    // Extract tag
    var tag: [16]u8 = undefined;
    @memcpy(&tag, input[tag_start..][0..16]);

    // Decapsulate: recover shared secret
    const secret_key = crypto.MLKem768.SecretKey.fromBytes(&ident.kem_secret_key) catch {
        return ZAULT_ERR_CRYPTO;
    };
    const shared_secret = secret_key.decaps(&kem_ct) catch {
        return ZAULT_ERR_AUTH_FAILED;
    };

    // Derive decryption key
    const prk = crypto.HkdfSha3_256.extract(&[_]u8{}, &shared_secret);
    var derived_key: [32]u8 = undefined;
    crypto.HkdfSha3_256.expand(&derived_key, "zault-message-v1", prk);

    // Decrypt with ChaCha20-Poly1305
    // Note: We don't have sender's identity here for AD verification in anonymous case
    // For authenticated messages, caller should verify signature separately
    crypto.ChaCha20Poly1305.decrypt(
        plaintext_out.?[0..encrypted_len],
        input[enc_start..][0..encrypted_len],
        tag,
        &[_]u8{}, // Empty AD for decryption (sender identity not available)
        nonce,
        derived_key,
    ) catch {
        @memset(&derived_key, 0);
        return ZAULT_ERR_AUTH_FAILED;
    };

    // Zero out derived key
    @memset(&derived_key, 0);

    if (plaintext_len_out) |len_out| {
        len_out.* = encrypted_len;
    }

    return ZAULT_OK;
}

// =============================================================================
// Digital signatures (for message authentication)
// =============================================================================

/// Sign arbitrary data with identity's ML-DSA-65 key.
export fn zault_sign(
    identity: ?*const ZaultIdentity,
    data_ptr: ?[*]const u8,
    data_len: usize,
    signature_out: ?[*]u8,
    sig_out_len: usize,
) c_int {
    if (identity == null) return ZAULT_ERR_INVALID_ARG;
    if (signature_out == null or sig_out_len < ZAULT_MLDSA65_SIG_LEN) return ZAULT_ERR_INVALID_ARG;

    const ident: *const Identity = @ptrCast(@alignCast(identity.?));
    const data = if (data_ptr) |p| p[0..data_len] else &[_]u8{};

    // Reconstruct secret key and create keypair for signing
    const secret_key = crypto.MLDSA65.SecretKey.fromBytes(ident.secret_key) catch {
        return ZAULT_ERR_CRYPTO;
    };
    const keypair = crypto.MLDSA65.KeyPair.fromSecretKey(secret_key) catch {
        return ZAULT_ERR_CRYPTO;
    };

    // Sign the data
    const signature = keypair.sign(data, null) catch {
        return ZAULT_ERR_CRYPTO;
    };

    @memcpy(signature_out.?[0..ZAULT_MLDSA65_SIG_LEN], &signature.toBytes());
    return ZAULT_OK;
}

/// Verify a signature against a public key.
export fn zault_verify(
    public_key_ptr: ?[*]const u8,
    pk_len: usize,
    data_ptr: ?[*]const u8,
    data_len: usize,
    signature_ptr: ?[*]const u8,
    sig_len: usize,
) c_int {
    if (public_key_ptr == null or pk_len != ZAULT_MLDSA65_PK_LEN) return ZAULT_ERR_INVALID_ARG;
    if (signature_ptr == null or sig_len != ZAULT_MLDSA65_SIG_LEN) return ZAULT_ERR_INVALID_ARG;

    const data = if (data_ptr) |p| p[0..data_len] else &[_]u8{};

    // Parse public key
    var pk_bytes: [ZAULT_MLDSA65_PK_LEN]u8 = undefined;
    @memcpy(&pk_bytes, public_key_ptr.?[0..ZAULT_MLDSA65_PK_LEN]);
    const public_key = crypto.MLDSA65.PublicKey.fromBytes(pk_bytes) catch {
        return ZAULT_ERR_INVALID_ARG;
    };

    // Parse signature
    var sig_bytes: [ZAULT_MLDSA65_SIG_LEN]u8 = undefined;
    @memcpy(&sig_bytes, signature_ptr.?[0..ZAULT_MLDSA65_SIG_LEN]);
    const signature = crypto.MLDSA65.Signature.fromBytes(sig_bytes) catch {
        return ZAULT_ERR_INVALID_ARG;
    };

    // Verify
    signature.verify(data, public_key) catch {
        return ZAULT_ERR_AUTH_FAILED;
    };

    return ZAULT_OK;
}

// =============================================================================
// Identity serialization (for wire transfer)
// =============================================================================

/// Serialize identity's public keys for sharing (e.g., via QR code, link).
/// Format: [ML-DSA-65 pk (1952)] [ML-KEM-768 pk (1184)]
export fn zault_identity_serialize_public(
    identity: ?*const ZaultIdentity,
    out: ?[*]u8,
    out_len: usize,
) c_int {
    if (identity == null or out == null) return ZAULT_ERR_INVALID_ARG;
    if (out_len < ZAULT_PUBLIC_IDENTITY_LEN) return ZAULT_ERR_INVALID_ARG;

    const ident: *const Identity = @ptrCast(@alignCast(identity.?));

    // Copy ML-DSA-65 public key
    @memcpy(out.?[0..ZAULT_MLDSA65_PK_LEN], &ident.public_key);

    // Copy ML-KEM-768 public key
    @memcpy(out.?[ZAULT_MLDSA65_PK_LEN..][0..ZAULT_MLKEM768_PK_LEN], &ident.kem_public_key);

    return ZAULT_OK;
}

/// Parse a serialized public identity to extract KEM public key.
/// Useful when you receive someone's public identity and need their KEM key for encryption.
export fn zault_parse_public_identity_kem_pk(
    serialized_ptr: ?[*]const u8,
    serialized_len: usize,
    kem_pk_out: ?[*]u8,
    kem_pk_out_len: usize,
) c_int {
    if (serialized_ptr == null or serialized_len != ZAULT_PUBLIC_IDENTITY_LEN) return ZAULT_ERR_INVALID_ARG;
    if (kem_pk_out == null or kem_pk_out_len < ZAULT_MLKEM768_PK_LEN) return ZAULT_ERR_INVALID_ARG;

    // KEM public key is at offset ZAULT_MLDSA65_PK_LEN
    @memcpy(kem_pk_out.?[0..ZAULT_MLKEM768_PK_LEN], serialized_ptr.?[ZAULT_MLDSA65_PK_LEN..][0..ZAULT_MLKEM768_PK_LEN]);
    return ZAULT_OK;
}

/// Parse a serialized public identity to extract DSA public key.
/// Useful for verifying signatures from someone whose public identity you have.
export fn zault_parse_public_identity_dsa_pk(
    serialized_ptr: ?[*]const u8,
    serialized_len: usize,
    dsa_pk_out: ?[*]u8,
    dsa_pk_out_len: usize,
) c_int {
    if (serialized_ptr == null or serialized_len != ZAULT_PUBLIC_IDENTITY_LEN) return ZAULT_ERR_INVALID_ARG;
    if (dsa_pk_out == null or dsa_pk_out_len < ZAULT_MLDSA65_PK_LEN) return ZAULT_ERR_INVALID_ARG;

    // DSA public key is at offset 0
    @memcpy(dsa_pk_out.?[0..ZAULT_MLDSA65_PK_LEN], serialized_ptr.?[0..ZAULT_MLDSA65_PK_LEN]);
    return ZAULT_OK;
}

// =============================================================================
// Error strings
// =============================================================================

/// Get human-readable error message for an error code.
export fn zault_error_string(error_code: c_int) [*:0]const u8 {
    return switch (error_code) {
        ZAULT_OK => "Success",
        ZAULT_ERR_INVALID_ARG => "Invalid argument",
        ZAULT_ERR_ALLOC => "Memory allocation failed",
        ZAULT_ERR_IO => "I/O error",
        ZAULT_ERR_CRYPTO => "Cryptographic error",
        ZAULT_ERR_INVALID_DATA => "Invalid or corrupted data",
        ZAULT_ERR_NOT_FOUND => "Resource not found",
        ZAULT_ERR_EXISTS => "Resource already exists",
        ZAULT_ERR_AUTH_FAILED => "Authentication failed",
        else => "Unknown error",
    };
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

test "ffi encrypt/decrypt message round-trip" {
    // Generate sender and recipient identities
    const sender = zault_identity_generate();
    try std.testing.expect(sender != null);
    defer zault_identity_destroy(sender);

    const recipient = zault_identity_generate();
    try std.testing.expect(recipient != null);
    defer zault_identity_destroy(recipient);

    // Get recipient's KEM public key
    var recipient_kem_pk: [ZAULT_MLKEM768_PK_LEN]u8 = undefined;
    try std.testing.expectEqual(ZAULT_OK, zault_identity_get_kem_public_key(recipient, &recipient_kem_pk, recipient_kem_pk.len));

    // Encrypt a message
    const plaintext = "Hello, post-quantum world!";
    var ciphertext: [plaintext.len + ZAULT_MSG_OVERHEAD]u8 = undefined;
    var ct_len: usize = undefined;

    const enc_result = zault_encrypt_message(
        sender,
        &recipient_kem_pk,
        recipient_kem_pk.len,
        plaintext.ptr,
        plaintext.len,
        &ciphertext,
        ciphertext.len,
        &ct_len,
    );
    try std.testing.expectEqual(ZAULT_OK, enc_result);
    try std.testing.expectEqual(plaintext.len + ZAULT_MSG_OVERHEAD, ct_len);

    // Decrypt the message
    var decrypted: [plaintext.len]u8 = undefined;
    var dec_len: usize = undefined;

    const dec_result = zault_decrypt_message(
        recipient,
        &ciphertext,
        ct_len,
        &decrypted,
        decrypted.len,
        &dec_len,
    );
    try std.testing.expectEqual(ZAULT_OK, dec_result);
    try std.testing.expectEqual(plaintext.len, dec_len);
    try std.testing.expectEqualStrings(plaintext, &decrypted);
}

test "ffi encrypt/decrypt anonymous message" {
    // Recipient only
    const recipient = zault_identity_generate();
    try std.testing.expect(recipient != null);
    defer zault_identity_destroy(recipient);

    var recipient_kem_pk: [ZAULT_MLKEM768_PK_LEN]u8 = undefined;
    _ = zault_identity_get_kem_public_key(recipient, &recipient_kem_pk, recipient_kem_pk.len);

    // Encrypt anonymously (no sender identity)
    const plaintext = "Anonymous message";
    var ciphertext: [plaintext.len + ZAULT_MSG_OVERHEAD]u8 = undefined;
    var ct_len: usize = undefined;

    const enc_result = zault_encrypt_message(
        null, // Anonymous
        &recipient_kem_pk,
        recipient_kem_pk.len,
        plaintext.ptr,
        plaintext.len,
        &ciphertext,
        ciphertext.len,
        &ct_len,
    );
    try std.testing.expectEqual(ZAULT_OK, enc_result);

    // Decrypt
    var decrypted: [plaintext.len]u8 = undefined;
    var dec_len: usize = undefined;

    const dec_result = zault_decrypt_message(
        recipient,
        &ciphertext,
        ct_len,
        &decrypted,
        decrypted.len,
        &dec_len,
    );
    try std.testing.expectEqual(ZAULT_OK, dec_result);
    try std.testing.expectEqualStrings(plaintext, &decrypted);
}

test "ffi sign and verify" {
    const identity = zault_identity_generate();
    try std.testing.expect(identity != null);
    defer zault_identity_destroy(identity);

    const message = "Sign this message";
    var signature: [ZAULT_MLDSA65_SIG_LEN]u8 = undefined;

    // Sign
    const sign_result = zault_sign(identity, message.ptr, message.len, &signature, signature.len);
    try std.testing.expectEqual(ZAULT_OK, sign_result);

    // Get public key for verification
    var pk: [ZAULT_MLDSA65_PK_LEN]u8 = undefined;
    _ = zault_identity_get_public_key(identity, &pk, pk.len);

    // Verify (should succeed)
    const verify_result = zault_verify(&pk, pk.len, message.ptr, message.len, &signature, signature.len);
    try std.testing.expectEqual(ZAULT_OK, verify_result);

    // Tamper with message and verify (should fail)
    const tampered = "Sign this messag!";
    const verify_tampered = zault_verify(&pk, pk.len, tampered.ptr, tampered.len, &signature, signature.len);
    try std.testing.expectEqual(ZAULT_ERR_AUTH_FAILED, verify_tampered);
}

test "ffi identity serialize public round-trip" {
    const identity = zault_identity_generate();
    try std.testing.expect(identity != null);
    defer zault_identity_destroy(identity);

    // Serialize public identity
    var serialized: [ZAULT_PUBLIC_IDENTITY_LEN]u8 = undefined;
    const ser_result = zault_identity_serialize_public(identity, &serialized, serialized.len);
    try std.testing.expectEqual(ZAULT_OK, ser_result);

    // Extract KEM public key
    var kem_pk: [ZAULT_MLKEM768_PK_LEN]u8 = undefined;
    const kem_result = zault_parse_public_identity_kem_pk(&serialized, serialized.len, &kem_pk, kem_pk.len);
    try std.testing.expectEqual(ZAULT_OK, kem_result);

    // Compare with direct extraction
    var direct_kem_pk: [ZAULT_MLKEM768_PK_LEN]u8 = undefined;
    _ = zault_identity_get_kem_public_key(identity, &direct_kem_pk, direct_kem_pk.len);
    try std.testing.expectEqualSlices(u8, &direct_kem_pk, &kem_pk);

    // Extract DSA public key
    var dsa_pk: [ZAULT_MLDSA65_PK_LEN]u8 = undefined;
    const dsa_result = zault_parse_public_identity_dsa_pk(&serialized, serialized.len, &dsa_pk, dsa_pk.len);
    try std.testing.expectEqual(ZAULT_OK, dsa_result);

    // Compare with direct extraction
    var direct_dsa_pk: [ZAULT_MLDSA65_PK_LEN]u8 = undefined;
    _ = zault_identity_get_public_key(identity, &direct_dsa_pk, direct_dsa_pk.len);
    try std.testing.expectEqualSlices(u8, &direct_dsa_pk, &dsa_pk);
}

test "ffi error string" {
    try std.testing.expectEqualStrings("Success", std.mem.span(zault_error_string(ZAULT_OK)));
    try std.testing.expectEqualStrings("Invalid argument", std.mem.span(zault_error_string(ZAULT_ERR_INVALID_ARG)));
    try std.testing.expectEqualStrings("Authentication failed", std.mem.span(zault_error_string(ZAULT_ERR_AUTH_FAILED)));
    try std.testing.expectEqualStrings("Unknown error", std.mem.span(zault_error_string(-999)));
}

