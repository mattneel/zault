//! Cryptographic primitives wrapper for Zault
//!
//! This module wraps the Zig standard library's post-quantum cryptography
//! implementations and other crypto primitives used by Zault.
//!
//! ## Algorithms
//!
//! - **ML-DSA-65** - Digital signatures (NIST FIPS 204, ~192-bit security)
//! - **ML-KEM-768** - Key encapsulation (NIST FIPS 203, ~192-bit security)
//! - **ChaCha20-Poly1305** - Authenticated encryption (RFC 8439, 256-bit)
//! - **HKDF-SHA3-256** - Key derivation (RFC 5869 + FIPS 202)
//! - **SHA3-256** - Cryptographic hashing (FIPS 202)
//!
//! ## Example
//!
//! ```zig
//! const crypto = @import("crypto.zig");
//!
//! // Generate ML-DSA keypair
//! const keypair = crypto.MLDSA65.KeyPair.generate();
//!
//! // Hash data
//! var hasher = crypto.Sha3_256.init(.{});
//! hasher.update("hello");
//! var hash: [32]u8 = undefined;
//! hasher.final(&hash);
//! ```

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

fn hexToBytes(hex: []const u8, out: []u8) !void {
    if (hex.len != out.len * 2) return error.InvalidLength;
    var i: usize = 0;
    while (i < out.len) : (i += 1) {
        const hi = try std.fmt.charToDigit(hex[i * 2], 16);
        const lo = try std.fmt.charToDigit(hex[i * 2 + 1], 16);
        out[i] = @as(u8, (hi << 4) | lo);
    }
}

test "nist kat ml-dsa-65 count 0" {
    var xi: [32]u8 = undefined;
    try hexToBytes("f696484048ec21f96cf50a56d0759c448f3779752f0383d37449690694cf7a68", &xi);

    var expected_pk_prefix: [32]u8 = undefined;
    try hexToBytes("e50d03fff3b3a70961abbb92a390008dec1283f603f50cdbaaa3d00bd659bc76", &expected_pk_prefix);

    var message: [16]u8 = undefined;
    try hexToBytes("6dbbc4375136df3b07f7c70e639e223e", &message);

    const result = MLDSA65.newKeyFromSeed(&xi);
    const pk_bytes = result.pk.toBytes();
    try std.testing.expectEqualSlices(u8, &expected_pk_prefix, pk_bytes[0..expected_pk_prefix.len]);

    const kp = try MLDSA65.KeyPair.fromSecretKey(result.sk);
    const sig = try kp.sign(&message, null);
    try sig.verify(&message, kp.public_key);
}

const MlKemKat = struct {
    seed: [64]u8,
    public_key: [MLKem768.PublicKey.encoded_length]u8,
    secret_key: [MLKem768.SecretKey.encoded_length]u8,
    entropy: [MLKem768.encaps_seed_length]u8,
    ciphertext: [MLKem768.ciphertext_length]u8,
    shared_secret: [MLKem768.shared_length]u8,
};

fn loadMlKemKatVector() !MlKemKat {
    var kat = MlKemKat{
        .seed = undefined,
        .public_key = undefined,
        .secret_key = undefined,
        .entropy = undefined,
        .ciphertext = undefined,
        .shared_secret = undefined,
    };
    var got_seed = false;
    var got_public = false;
    var got_secret = false;
    var got_entropy = false;
    var got_ciphertext = false;
    var got_shared = false;

    const text = @embedFile("../testdata/mlkem768_vector1.txt");
    var lines = std.mem.tokenizeScalar(u8, text, '\n');
    while (lines.next()) |raw_line| {
        const line = std.mem.trim(u8, raw_line, " \r");
        if (line.len == 0 or line[0] == '#') continue;
        if (std.mem.startsWith(u8, line, "seed=")) {
            try hexToBytes(line["seed=".len..], &kat.seed);
            got_seed = true;
            continue;
        }
        if (std.mem.startsWith(u8, line, "public_key=")) {
            try hexToBytes(line["public_key=".len..], &kat.public_key);
            got_public = true;
            continue;
        }
        if (std.mem.startsWith(u8, line, "secret_key=")) {
            try hexToBytes(line["secret_key=".len..], &kat.secret_key);
            got_secret = true;
            continue;
        }
        if (std.mem.startsWith(u8, line, "entropy=")) {
            try hexToBytes(line["entropy=".len..], &kat.entropy);
            got_entropy = true;
            continue;
        }
        if (std.mem.startsWith(u8, line, "ciphertext=")) {
            try hexToBytes(line["ciphertext=".len..], &kat.ciphertext);
            got_ciphertext = true;
            continue;
        }
        if (std.mem.startsWith(u8, line, "shared_secret=")) {
            try hexToBytes(line["shared_secret=".len..], &kat.shared_secret);
            got_shared = true;
            continue;
        }
    }

    std.debug.assert(got_seed and got_public and got_secret and got_entropy and got_ciphertext and got_shared);
    return kat;
}

test "ml-kem-768 boringssl kat vector 0" {
    const kat = try loadMlKemKatVector();

    const public_key = try MLKem768.PublicKey.fromBytes(&kat.public_key);
    const secret_key = try MLKem768.SecretKey.fromBytes(&kat.secret_key);

    try std.testing.expectEqualSlices(u8, &kat.public_key, &public_key.toBytes());
    try std.testing.expectEqualSlices(u8, &kat.secret_key, &secret_key.toBytes());

    const encapsulated = public_key.encaps(kat.entropy);
    try std.testing.expectEqualSlices(u8, &kat.ciphertext, &encapsulated.ciphertext);
    try std.testing.expectEqualSlices(u8, &kat.shared_secret, &encapsulated.shared_secret);

    const decapped = try secret_key.decaps(&kat.ciphertext);
    try std.testing.expectEqualSlices(u8, &kat.shared_secret, &decapped);
}

test "nist kat chacha20-poly1305" {
    const plaintext = "Ladies and Gentlemen of the class of '99: If I could offer you only one tip for the future, sunscreen would be it.";
    const ad = [_]u8{ 0x50, 0x51, 0x52, 0x53, 0xC0, 0xC1, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7 };
    const key = [_]u8{
        0x80, 0x81, 0x82, 0x83, 0x84, 0x85, 0x86, 0x87,
        0x88, 0x89, 0x8A, 0x8B, 0x8C, 0x8D, 0x8E, 0x8F,
        0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97,
        0x98, 0x99, 0x9A, 0x9B, 0x9C, 0x9D, 0x9E, 0x9F,
    };
    const nonce = [_]u8{ 0x7, 0x0, 0x0, 0x0, 0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47 };
    const expected = [_]u8{
        0xD3, 0x1A, 0x8D, 0x34, 0x64, 0x8E, 0x60, 0xDB, 0x7B, 0x86, 0xAF, 0xBC, 0x53, 0xEF, 0x7E, 0xC2,
        0xA4, 0xAD, 0xED, 0x51, 0x29, 0x6E, 0x08, 0xFE, 0xA9, 0xE2, 0xB5, 0xA7, 0x36, 0xEE, 0x62, 0xD6,
        0x3D, 0xBE, 0xA4, 0x5E, 0x8C, 0xA9, 0x67, 0x12, 0x82, 0xFA, 0xFB, 0x69, 0xDA, 0x92, 0x72, 0x8B,
        0x1A, 0x71, 0xDE, 0x0A, 0x9E, 0x06, 0x0B, 0x29, 0x05, 0xD6, 0xA5, 0xB6, 0x7E, 0xCD, 0x3B, 0x36,
        0x92, 0xDD, 0xBD, 0x7F, 0x2D, 0x77, 0x8B, 0x8C, 0x98, 0x03, 0xAE, 0xE3, 0x28, 0x09, 0x1B, 0x58,
        0xFA, 0xB3, 0x24, 0xE4, 0xFA, 0xD6, 0x75, 0x94, 0x55, 0x85, 0x80, 0x8B, 0x48, 0x31, 0xD7, 0xBC,
        0x3F, 0xF4, 0xDE, 0xF0, 0x8E, 0x4B, 0x7A, 0x9D, 0xE5, 0x76, 0xD2, 0x65, 0x86, 0xCE, 0xC6, 0x4B,
        0x61, 0x16, 0x1A, 0xE1, 0x0B, 0x59, 0x4F, 0x09, 0xE2, 0x6A, 0x7E, 0x90, 0x2E, 0xCB, 0xD0, 0x60,
        0x06, 0x91,
    };

    var ciphertext: [plaintext.len + ChaCha20Poly1305.tag_length]u8 = undefined;
    ChaCha20Poly1305.encrypt(ciphertext[0..plaintext.len], ciphertext[plaintext.len..], plaintext, ad[0..], nonce, key);
    try std.testing.expectEqualSlices(u8, &expected, ciphertext[0..expected.len]);
}

test "nist kat sha3-256" {
    const msg = "abc";
    var digest: [Sha3_256.digest_length]u8 = undefined;
    Sha3_256.hash(msg, &digest, .{});
    var digest_hex: [Sha3_256.digest_length * 2]u8 = undefined;
    _ = try std.fmt.bufPrint(&digest_hex, "{x}", .{&digest});
    try std.testing.expectEqualStrings(
        "3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532",
        &digest_hex,
    );
}

test "nist kat hkdf-sha3-256" {
    const ikm = [_]u8{0x0b} ** 22;
    const salt = [_]u8{
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0x0C,
    };
    const info = [_]u8{ 0xF0, 0xF1, 0xF2, 0xF3, 0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9 };

    const prk = HkdfSha3_256.extract(&salt, &ikm);
    var okm: [42]u8 = undefined;
    HkdfSha3_256.expand(&okm, &info, prk);

    var prk_hex: [HmacSha3_256.mac_length * 2]u8 = undefined;
    _ = try std.fmt.bufPrint(&prk_hex, "{x}", .{&prk});
    var okm_hex: [okm.len * 2]u8 = undefined;
    _ = try std.fmt.bufPrint(&okm_hex, "{x}", .{&okm});

    try std.testing.expectEqualStrings(
        "7d4194836f7a113a44677abc825640ade07af1c1d69a9a4b109b280a8fe54ef0",
        &prk_hex,
    );
    try std.testing.expectEqualStrings(
        "0c5160501d65021deaf2c14f5abce04c5bd2635abceeba61c2edb6e8ed72674900557728f2c9f2c4c179",
        &okm_hex,
    );
}
