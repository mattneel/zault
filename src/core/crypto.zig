//! Cryptographic primitives wrapper for Zault
//!
//! This module wraps the Zig standard library's post-quantum cryptography
//! implementations and other crypto primitives used by Zault.

const std = @import("std");

// Post-quantum cryptography - digital signatures
pub const mldsa = std.crypto.sign.mldsa;
// We use ML-DSA-65 for digital signatures (NIST security category 3, ~192-bit)
pub const MLDSA65 = mldsa.MLDSA65;

// Post-quantum cryptography - key encapsulation
pub const ml_kem = std.crypto.kem.ml_kem;
// We use ML-KEM-768 for key encapsulation (NIST security category 3, ~192-bit)
pub const MLKem768 = ml_kem.MLKem768;

// Symmetric encryption
pub const ChaCha20Poly1305 = std.crypto.aead.chacha_poly.ChaCha20Poly1305;

// Key derivation
pub const hkdf = std.crypto.kdf.hkdf;
pub const Sha3_256 = std.crypto.hash.sha3.Sha3_256;
pub const Hmac = std.crypto.auth.hmac.Hmac;
pub const HmacSha3_256 = Hmac(Sha3_256);
pub const HkdfSha3_256 = hkdf.Hkdf(HmacSha3_256);

// Random number generation
pub const random = std.crypto.random;

test "can access ML-DSA" {
    // This test verifies that ML-DSA-65 is available
    const KeyPair = MLDSA65.KeyPair;
    _ = KeyPair;
}

test "can access ML-KEM" {
    // This test verifies that ML-KEM-768 is available
    const PublicKey = MLKem768.PublicKey;
    _ = PublicKey;
}

test "can access ChaCha20-Poly1305" {
    // Verify ChaCha20-Poly1305 is available
    const key_length = ChaCha20Poly1305.key_length;
    const nonce_length = ChaCha20Poly1305.nonce_length;
    _ = key_length;
    _ = nonce_length;
}

test "can access SHA3-256" {
    // Verify SHA3-256 is available
    const digest_length = Sha3_256.digest_length;
    _ = digest_length;
}

test "can access HKDF-SHA3-256" {
    // Verify HKDF is available
    const prk_length = HkdfSha3_256.prk_length;
    _ = prk_length;
}
