//! WASM FFI bindings for libzault
//!
//! This is a minimal subset of the full FFI, containing only memory-only
//! operations suitable for browser/WASM environments:
//!
//! - Identity generation and serialization
//! - Message encryption/decryption (ML-KEM-768 + ChaCha20-Poly1305)
//! - Digital signatures (ML-DSA-65)
//! - Crypto utilities (SHA3-256, random bytes)
//!
//! NO filesystem operations are included.

const std = @import("std");
const zault = @import("zault");

const Identity = zault.Identity;
const crypto = zault.crypto;

// =============================================================================
// Error codes (same as full FFI)
// =============================================================================

pub const ZAULT_OK: i32 = 0;
pub const ZAULT_ERR_INVALID_ARG: i32 = -1;
pub const ZAULT_ERR_ALLOC: i32 = -2;
pub const ZAULT_ERR_CRYPTO: i32 = -4;
pub const ZAULT_ERR_AUTH_FAILED: i32 = -8;

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
pub const ZAULT_MSG_OVERHEAD: usize = ZAULT_MLKEM768_CT_LEN + 12 + 16;
pub const ZAULT_PUBLIC_IDENTITY_LEN: usize = ZAULT_MLDSA65_PK_LEN + ZAULT_MLKEM768_PK_LEN;

// Full identity size for serialization (both key pairs + metadata)
pub const ZAULT_IDENTITY_LEN: usize = 1 + // version
    ZAULT_MLDSA65_PK_LEN + ZAULT_MLDSA65_SK_LEN + // ML-DSA keys
    ZAULT_MLKEM768_PK_LEN + ZAULT_MLKEM768_SK_LEN + // ML-KEM keys
    8; // timestamp

// =============================================================================
// WASM memory management
// For WASM, caller manages memory. We work with raw pointers only.
// =============================================================================

// =============================================================================
// Identity functions (stateless - caller provides buffer)
// =============================================================================

/// Generate a new random identity and write to buffer.
/// Buffer must be at least ZAULT_IDENTITY_LEN bytes.
/// Returns ZAULT_OK on success.
export fn zault_identity_generate(out_ptr: [*]u8, out_len: usize) i32 {
    if (out_len < ZAULT_IDENTITY_LEN) return ZAULT_ERR_INVALID_ARG;

    const identity = Identity.generate();
    serializeIdentity(&identity, out_ptr);
    return ZAULT_OK;
}

/// Generate identity from a 32-byte seed (deterministic).
export fn zault_identity_from_seed(
    seed_ptr: [*]const u8,
    seed_len: usize,
    out_ptr: [*]u8,
    out_len: usize,
) i32 {
    if (seed_len != 32) return ZAULT_ERR_INVALID_ARG;
    if (out_len < ZAULT_IDENTITY_LEN) return ZAULT_ERR_INVALID_ARG;

    const seed: *const [32]u8 = @ptrCast(seed_ptr);
    const identity = Identity.fromSeed(seed.*) catch return ZAULT_ERR_CRYPTO;
    serializeIdentity(&identity, out_ptr);
    return ZAULT_OK;
}

/// Get the ML-DSA-65 public key from a serialized identity.
export fn zault_identity_get_public_key(
    identity_ptr: [*]const u8,
    identity_len: usize,
    pk_out: [*]u8,
    pk_out_len: usize,
) i32 {
    if (identity_len < ZAULT_IDENTITY_LEN) return ZAULT_ERR_INVALID_ARG;
    if (pk_out_len < ZAULT_MLDSA65_PK_LEN) return ZAULT_ERR_INVALID_ARG;

    // Public key starts at offset 1 (after version byte)
    @memcpy(pk_out[0..ZAULT_MLDSA65_PK_LEN], identity_ptr[1..][0..ZAULT_MLDSA65_PK_LEN]);
    return ZAULT_OK;
}

/// Get the ML-KEM-768 public key from a serialized identity.
export fn zault_identity_get_kem_public_key(
    identity_ptr: [*]const u8,
    identity_len: usize,
    pk_out: [*]u8,
    pk_out_len: usize,
) i32 {
    if (identity_len < ZAULT_IDENTITY_LEN) return ZAULT_ERR_INVALID_ARG;
    if (pk_out_len < ZAULT_MLKEM768_PK_LEN) return ZAULT_ERR_INVALID_ARG;

    // KEM public key starts after version + DSA keys
    const offset = 1 + ZAULT_MLDSA65_PK_LEN + ZAULT_MLDSA65_SK_LEN;
    @memcpy(pk_out[0..ZAULT_MLKEM768_PK_LEN], identity_ptr[offset..][0..ZAULT_MLKEM768_PK_LEN]);
    return ZAULT_OK;
}

/// Serialize identity's public keys for sharing.
export fn zault_identity_serialize_public(
    identity_ptr: [*]const u8,
    identity_len: usize,
    out: [*]u8,
    out_len: usize,
) i32 {
    if (identity_len < ZAULT_IDENTITY_LEN) return ZAULT_ERR_INVALID_ARG;
    if (out_len < ZAULT_PUBLIC_IDENTITY_LEN) return ZAULT_ERR_INVALID_ARG;

    // Copy DSA public key (at offset 1)
    @memcpy(out[0..ZAULT_MLDSA65_PK_LEN], identity_ptr[1..][0..ZAULT_MLDSA65_PK_LEN]);

    // Copy KEM public key
    const kem_offset = 1 + ZAULT_MLDSA65_PK_LEN + ZAULT_MLDSA65_SK_LEN;
    @memcpy(out[ZAULT_MLDSA65_PK_LEN..][0..ZAULT_MLKEM768_PK_LEN], identity_ptr[kem_offset..][0..ZAULT_MLKEM768_PK_LEN]);

    return ZAULT_OK;
}

/// Extract KEM public key from serialized public identity.
export fn zault_parse_public_identity_kem_pk(
    serialized_ptr: [*]const u8,
    serialized_len: usize,
    kem_pk_out: [*]u8,
    kem_pk_out_len: usize,
) i32 {
    if (serialized_len != ZAULT_PUBLIC_IDENTITY_LEN) return ZAULT_ERR_INVALID_ARG;
    if (kem_pk_out_len < ZAULT_MLKEM768_PK_LEN) return ZAULT_ERR_INVALID_ARG;

    @memcpy(kem_pk_out[0..ZAULT_MLKEM768_PK_LEN], serialized_ptr[ZAULT_MLDSA65_PK_LEN..][0..ZAULT_MLKEM768_PK_LEN]);
    return ZAULT_OK;
}

/// Extract DSA public key from serialized public identity.
export fn zault_parse_public_identity_dsa_pk(
    serialized_ptr: [*]const u8,
    serialized_len: usize,
    dsa_pk_out: [*]u8,
    dsa_pk_out_len: usize,
) i32 {
    if (serialized_len != ZAULT_PUBLIC_IDENTITY_LEN) return ZAULT_ERR_INVALID_ARG;
    if (dsa_pk_out_len < ZAULT_MLDSA65_PK_LEN) return ZAULT_ERR_INVALID_ARG;

    @memcpy(dsa_pk_out[0..ZAULT_MLDSA65_PK_LEN], serialized_ptr[0..ZAULT_MLDSA65_PK_LEN]);
    return ZAULT_OK;
}

// =============================================================================
// Message encryption
// =============================================================================

/// Encrypt a message to a recipient.
export fn zault_encrypt_message(
    recipient_kem_pk_ptr: [*]const u8,
    recipient_pk_len: usize,
    plaintext_ptr: [*]const u8,
    plaintext_len: usize,
    ciphertext_out: [*]u8,
    ciphertext_out_len: usize,
) i32 {
    if (recipient_pk_len != ZAULT_MLKEM768_PK_LEN) return ZAULT_ERR_INVALID_ARG;

    const required_len = plaintext_len + ZAULT_MSG_OVERHEAD;
    if (ciphertext_out_len < required_len) return ZAULT_ERR_INVALID_ARG;

    // Parse recipient's ML-KEM public key
    var pk_bytes: [ZAULT_MLKEM768_PK_LEN]u8 = undefined;
    @memcpy(&pk_bytes, recipient_kem_pk_ptr[0..ZAULT_MLKEM768_PK_LEN]);
    const recipient_pk = crypto.MLKem768.PublicKey.fromBytes(&pk_bytes) catch {
        return ZAULT_ERR_INVALID_ARG;
    };

    // Encapsulate
    const encapsulation = recipient_pk.encaps(null);

    // Derive key
    const prk = crypto.HkdfSha3_256.extract(&[_]u8{}, &encapsulation.shared_secret);
    var derived_key: [32]u8 = undefined;
    crypto.HkdfSha3_256.expand(&derived_key, "zault-message-v1", prk);

    // Generate nonce
    var nonce: [12]u8 = undefined;
    crypto.random.bytes(&nonce);

    // Output layout
    const ct_start: usize = 0;
    const nonce_start: usize = ZAULT_MLKEM768_CT_LEN;
    const tag_start: usize = nonce_start + 12;
    const enc_start: usize = tag_start + 16;

    @memcpy(ciphertext_out[ct_start..][0..ZAULT_MLKEM768_CT_LEN], &encapsulation.ciphertext);
    @memcpy(ciphertext_out[nonce_start..][0..12], &nonce);

    const plaintext = plaintext_ptr[0..plaintext_len];
    crypto.ChaCha20Poly1305.encrypt(
        ciphertext_out[enc_start..][0..plaintext_len],
        ciphertext_out[tag_start..][0..16],
        plaintext,
        &[_]u8{},
        nonce,
        derived_key,
    );

    @memset(&derived_key, 0);
    return ZAULT_OK;
}

/// Decrypt a message.
export fn zault_decrypt_message(
    identity_ptr: [*]const u8,
    identity_len: usize,
    ciphertext_ptr: [*]const u8,
    ciphertext_len: usize,
    plaintext_out: [*]u8,
    plaintext_out_len: usize,
) i32 {
    if (identity_len < ZAULT_IDENTITY_LEN) return ZAULT_ERR_INVALID_ARG;
    if (ciphertext_len < ZAULT_MSG_OVERHEAD) return ZAULT_ERR_INVALID_ARG;

    const encrypted_len = ciphertext_len - ZAULT_MSG_OVERHEAD;
    if (plaintext_out_len < encrypted_len) return ZAULT_ERR_INVALID_ARG;

    // Extract KEM secret key from identity
    const kem_sk_offset = 1 + ZAULT_MLDSA65_PK_LEN + ZAULT_MLDSA65_SK_LEN + ZAULT_MLKEM768_PK_LEN;
    var kem_sk_bytes: [ZAULT_MLKEM768_SK_LEN]u8 = undefined;
    @memcpy(&kem_sk_bytes, identity_ptr[kem_sk_offset..][0..ZAULT_MLKEM768_SK_LEN]);

    // Parse layout
    const ct_start: usize = 0;
    const nonce_start: usize = ZAULT_MLKEM768_CT_LEN;
    const tag_start: usize = nonce_start + 12;
    const enc_start: usize = tag_start + 16;

    var kem_ct: [ZAULT_MLKEM768_CT_LEN]u8 = undefined;
    @memcpy(&kem_ct, ciphertext_ptr[ct_start..][0..ZAULT_MLKEM768_CT_LEN]);

    var nonce: [12]u8 = undefined;
    @memcpy(&nonce, ciphertext_ptr[nonce_start..][0..12]);

    var tag: [16]u8 = undefined;
    @memcpy(&tag, ciphertext_ptr[tag_start..][0..16]);

    // Decapsulate
    const secret_key = crypto.MLKem768.SecretKey.fromBytes(&kem_sk_bytes) catch {
        return ZAULT_ERR_CRYPTO;
    };
    const shared_secret = secret_key.decaps(&kem_ct) catch {
        return ZAULT_ERR_AUTH_FAILED;
    };

    // Derive key
    const prk = crypto.HkdfSha3_256.extract(&[_]u8{}, &shared_secret);
    var derived_key: [32]u8 = undefined;
    crypto.HkdfSha3_256.expand(&derived_key, "zault-message-v1", prk);

    // Decrypt
    crypto.ChaCha20Poly1305.decrypt(
        plaintext_out[0..encrypted_len],
        ciphertext_ptr[enc_start..][0..encrypted_len],
        tag,
        &[_]u8{},
        nonce,
        derived_key,
    ) catch {
        @memset(&derived_key, 0);
        return ZAULT_ERR_AUTH_FAILED;
    };

    @memset(&derived_key, 0);
    return ZAULT_OK;
}

// =============================================================================
// Digital signatures
// =============================================================================

/// Sign data with identity's ML-DSA-65 key.
export fn zault_sign(
    identity_ptr: [*]const u8,
    identity_len: usize,
    data_ptr: [*]const u8,
    data_len: usize,
    signature_out: [*]u8,
    sig_out_len: usize,
) i32 {
    if (identity_len < ZAULT_IDENTITY_LEN) return ZAULT_ERR_INVALID_ARG;
    if (sig_out_len < ZAULT_MLDSA65_SIG_LEN) return ZAULT_ERR_INVALID_ARG;

    // Extract DSA secret key from identity (at offset 1 + pk_len)
    const sk_offset = 1 + ZAULT_MLDSA65_PK_LEN;
    var sk_bytes: [ZAULT_MLDSA65_SK_LEN]u8 = undefined;
    @memcpy(&sk_bytes, identity_ptr[sk_offset..][0..ZAULT_MLDSA65_SK_LEN]);

    const secret_key = crypto.MLDSA65.SecretKey.fromBytes(sk_bytes) catch {
        return ZAULT_ERR_CRYPTO;
    };
    const keypair = crypto.MLDSA65.KeyPair.fromSecretKey(secret_key) catch {
        return ZAULT_ERR_CRYPTO;
    };

    const data = data_ptr[0..data_len];
    const signature = keypair.sign(data, null) catch {
        return ZAULT_ERR_CRYPTO;
    };

    @memcpy(signature_out[0..ZAULT_MLDSA65_SIG_LEN], &signature.toBytes());
    return ZAULT_OK;
}

/// Verify a signature.
export fn zault_verify(
    public_key_ptr: [*]const u8,
    pk_len: usize,
    data_ptr: [*]const u8,
    data_len: usize,
    signature_ptr: [*]const u8,
    sig_len: usize,
) i32 {
    if (pk_len != ZAULT_MLDSA65_PK_LEN) return ZAULT_ERR_INVALID_ARG;
    if (sig_len != ZAULT_MLDSA65_SIG_LEN) return ZAULT_ERR_INVALID_ARG;

    var pk_bytes: [ZAULT_MLDSA65_PK_LEN]u8 = undefined;
    @memcpy(&pk_bytes, public_key_ptr[0..ZAULT_MLDSA65_PK_LEN]);
    const public_key = crypto.MLDSA65.PublicKey.fromBytes(pk_bytes) catch {
        return ZAULT_ERR_INVALID_ARG;
    };

    var sig_bytes: [ZAULT_MLDSA65_SIG_LEN]u8 = undefined;
    @memcpy(&sig_bytes, signature_ptr[0..ZAULT_MLDSA65_SIG_LEN]);
    const signature = crypto.MLDSA65.Signature.fromBytes(sig_bytes) catch {
        return ZAULT_ERR_INVALID_ARG;
    };

    const data = data_ptr[0..data_len];
    signature.verify(data, public_key) catch {
        return ZAULT_ERR_AUTH_FAILED;
    };

    return ZAULT_OK;
}

// =============================================================================
// Crypto utilities
// =============================================================================

/// SHA3-256 hash.
export fn zault_sha3_256(
    data_ptr: [*]const u8,
    data_len: usize,
    hash_out: [*]u8,
    hash_out_len: usize,
) i32 {
    if (hash_out_len < 32) return ZAULT_ERR_INVALID_ARG;

    const data = data_ptr[0..data_len];
    var hash: [32]u8 = undefined;
    crypto.Sha3_256.hash(data, &hash, .{});
    @memcpy(hash_out[0..32], &hash);
    return ZAULT_OK;
}

/// Generate random bytes.
export fn zault_random_bytes(out_ptr: [*]u8, out_len: usize) i32 {
    if (out_len == 0) return ZAULT_ERR_INVALID_ARG;
    crypto.random.bytes(out_ptr[0..out_len]);
    return ZAULT_OK;
}

// =============================================================================
// Utilities
// =============================================================================

/// Get message overhead constant.
export fn zault_get_msg_overhead() usize {
    return ZAULT_MSG_OVERHEAD;
}

/// Get identity buffer size.
export fn zault_get_identity_len() usize {
    return ZAULT_IDENTITY_LEN;
}

/// Get public identity buffer size.
export fn zault_get_public_identity_len() usize {
    return ZAULT_PUBLIC_IDENTITY_LEN;
}

/// Get signature size.
export fn zault_get_signature_len() usize {
    return ZAULT_MLDSA65_SIG_LEN;
}

/// Get KEM public key size.
export fn zault_get_kem_pk_len() usize {
    return ZAULT_MLKEM768_PK_LEN;
}

/// Get DSA public key size.
export fn zault_get_dsa_pk_len() usize {
    return ZAULT_MLDSA65_PK_LEN;
}

/// Get version string.
export fn zault_version() [*:0]const u8 {
    return "0.2.0-wasm";
}

/// Error string.
export fn zault_error_string(error_code: i32) [*:0]const u8 {
    return switch (error_code) {
        ZAULT_OK => "Success",
        ZAULT_ERR_INVALID_ARG => "Invalid argument",
        ZAULT_ERR_ALLOC => "Memory allocation failed",
        ZAULT_ERR_CRYPTO => "Cryptographic error",
        ZAULT_ERR_AUTH_FAILED => "Authentication failed",
        else => "Unknown error",
    };
}

// =============================================================================
// Internal helpers
// =============================================================================

fn serializeIdentity(identity: *const Identity, out: [*]u8) void {
    var pos: usize = 0;

    // Version
    out[pos] = identity.version;
    pos += 1;

    // ML-DSA public key
    @memcpy(out[pos..][0..ZAULT_MLDSA65_PK_LEN], &identity.public_key);
    pos += ZAULT_MLDSA65_PK_LEN;

    // ML-DSA secret key
    @memcpy(out[pos..][0..ZAULT_MLDSA65_SK_LEN], &identity.secret_key);
    pos += ZAULT_MLDSA65_SK_LEN;

    // ML-KEM public key
    @memcpy(out[pos..][0..ZAULT_MLKEM768_PK_LEN], &identity.kem_public_key);
    pos += ZAULT_MLKEM768_PK_LEN;

    // ML-KEM secret key
    @memcpy(out[pos..][0..ZAULT_MLKEM768_SK_LEN], &identity.kem_secret_key);
    pos += ZAULT_MLKEM768_SK_LEN;

    // Timestamp
    var ts_bytes: [8]u8 = undefined;
    std.mem.writeInt(i64, &ts_bytes, identity.created_at, .little);
    @memcpy(out[pos..][0..8], &ts_bytes);
}

