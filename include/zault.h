/**
 * @file zault.h
 * @brief C API for libzault - Post-quantum encrypted storage
 *
 * libzault provides post-quantum cryptographic storage with secure file sharing.
 * This header defines the C FFI for embedding Zault functionality in C/C++ applications.
 *
 * ## Quick Start
 *
 * ```c
 * #include <zault.h>
 *
 * // Initialize vault
 * ZaultVault* vault = zault_vault_init("./my-vault", 10);
 * if (!vault) { handle_error(); }
 *
 * // Add a file
 * uint8_t hash[ZAULT_HASH_LEN];
 * int rc = zault_vault_add_file(vault, "secret.pdf", 10, hash, sizeof(hash));
 * if (rc != ZAULT_OK) { handle_error(); }
 *
 * // Clean up
 * zault_vault_destroy(vault);
 * ```
 *
 * ## Memory Management
 *
 * - Opaque handles (ZaultVault*, ZaultIdentity*) must be freed with their
 *   respective *_destroy() functions.
 * - Output buffers are caller-allocated; check required sizes in documentation.
 *
 * ## Thread Safety
 *
 * Individual handles are NOT thread-safe. Use separate handles per thread,
 * or protect access with external synchronization.
 *
 * @copyright MIT License
 */

#ifndef ZAULT_H
#define ZAULT_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* ============================================================================
 * Error Codes
 * ============================================================================ */

/** Operation succeeded */
#define ZAULT_OK                 0
/** Invalid argument passed to function */
#define ZAULT_ERR_INVALID_ARG   -1
/** Memory allocation failed */
#define ZAULT_ERR_ALLOC         -2
/** I/O error (file not found, permission denied, etc.) */
#define ZAULT_ERR_IO            -3
/** Cryptographic operation failed */
#define ZAULT_ERR_CRYPTO        -4
/** Invalid or corrupted data */
#define ZAULT_ERR_INVALID_DATA  -5
/** Resource not found */
#define ZAULT_ERR_NOT_FOUND     -6
/** Resource already exists */
#define ZAULT_ERR_EXISTS        -7
/** Authentication or verification failed */
#define ZAULT_ERR_AUTH_FAILED   -8

/* ============================================================================
 * Constants
 * ============================================================================ */

/** Length of SHA3-256 hash (block identifiers) */
#define ZAULT_HASH_LEN          32

/** ML-DSA-65 public key length (1952 bytes) */
#define ZAULT_MLDSA65_PK_LEN    1952

/** ML-DSA-65 secret key length (4032 bytes) */
#define ZAULT_MLDSA65_SK_LEN    4032

/** ML-KEM-768 public key length (1184 bytes) */
#define ZAULT_MLKEM768_PK_LEN   1184

/** ML-KEM-768 secret key length (2400 bytes) */
#define ZAULT_MLKEM768_SK_LEN   2400

/* ============================================================================
 * Opaque Types
 * ============================================================================ */

/**
 * Opaque vault handle.
 * Create with zault_vault_init(), destroy with zault_vault_destroy().
 */
typedef struct ZaultVault ZaultVault;

/**
 * Opaque identity handle.
 * Create with zault_identity_generate() or zault_identity_load(),
 * destroy with zault_identity_destroy().
 */
typedef struct ZaultIdentity ZaultIdentity;

/* ============================================================================
 * Version Information
 * ============================================================================ */

/**
 * Get the library version string.
 *
 * @return Null-terminated version string (e.g., "0.2.0"). Do not free.
 */
const char* zault_version(void);

/* ============================================================================
 * Identity Functions
 * ============================================================================ */

/**
 * Generate a new random identity with ML-DSA-65 and ML-KEM-768 keypairs.
 *
 * The identity contains:
 * - ML-DSA-65 keypair for digital signatures
 * - ML-KEM-768 keypair for key encapsulation (sharing)
 *
 * @return New identity handle, or NULL on failure. Must be freed with
 *         zault_identity_destroy().
 */
ZaultIdentity* zault_identity_generate(void);

/**
 * Generate a deterministic identity from a 32-byte seed.
 *
 * Useful for testing or key derivation from a master secret.
 * WARNING: Using the same seed will produce the same identity.
 *
 * @param seed      Pointer to 32-byte seed
 * @param seed_len  Must be exactly 32
 * @return New identity handle, or NULL on failure
 */
ZaultIdentity* zault_identity_from_seed(const uint8_t* seed, size_t seed_len);

/**
 * Destroy an identity handle and securely zero secret keys.
 *
 * @param identity  Handle to destroy (NULL is safe no-op)
 */
void zault_identity_destroy(ZaultIdentity* identity);

/**
 * Get the ML-DSA-65 public key from an identity.
 *
 * @param identity    Identity handle
 * @param pk_out      Buffer to receive public key
 * @param pk_out_len  Buffer size (must be >= ZAULT_MLDSA65_PK_LEN)
 * @return ZAULT_OK on success, error code otherwise
 */
int zault_identity_get_public_key(
    const ZaultIdentity* identity,
    uint8_t* pk_out,
    size_t pk_out_len
);

/**
 * Get the ML-KEM-768 public key from an identity (for receiving shares).
 *
 * Share this key with others so they can create share tokens for you.
 *
 * @param identity    Identity handle
 * @param pk_out      Buffer to receive public key
 * @param pk_out_len  Buffer size (must be >= ZAULT_MLKEM768_PK_LEN)
 * @return ZAULT_OK on success, error code otherwise
 */
int zault_identity_get_kem_public_key(
    const ZaultIdentity* identity,
    uint8_t* pk_out,
    size_t pk_out_len
);

/**
 * Save an identity to a file.
 *
 * WARNING: The file contains secret keys. Protect appropriately.
 *
 * @param identity  Identity handle
 * @param path      File path (not null-terminated; use path_len)
 * @param path_len  Length of path string
 * @return ZAULT_OK on success, error code otherwise
 */
int zault_identity_save(
    const ZaultIdentity* identity,
    const char* path,
    size_t path_len
);

/**
 * Load an identity from a file.
 *
 * @param path      File path (not null-terminated; use path_len)
 * @param path_len  Length of path string
 * @return Identity handle, or NULL on failure
 */
ZaultIdentity* zault_identity_load(const char* path, size_t path_len);

/* ============================================================================
 * Vault Functions
 * ============================================================================ */

/**
 * Initialize or open a vault at the given path.
 *
 * If the vault doesn't exist, creates a new one with a fresh identity.
 * If it exists, loads the existing identity and block store.
 *
 * @param path      Directory path for the vault
 * @param path_len  Length of path string
 * @return Vault handle, or NULL on failure. Must be freed with zault_vault_destroy().
 */
ZaultVault* zault_vault_init(const char* path, size_t path_len);

/**
 * Destroy a vault handle and securely zero the master key.
 *
 * @param vault  Handle to destroy (NULL is safe no-op)
 */
void zault_vault_destroy(ZaultVault* vault);

/**
 * Add a file to the vault with full encryption.
 *
 * The file is:
 * 1. Read from disk
 * 2. Encrypted with a random per-file key (ChaCha20-Poly1305)
 * 3. Stored as content + metadata blocks
 * 4. Signed with the vault's ML-DSA-65 key
 *
 * @param vault          Vault handle
 * @param file_path      Path to file to add
 * @param file_path_len  Length of file_path
 * @param hash_out       Buffer to receive 32-byte metadata block hash
 * @param hash_out_len   Buffer size (must be >= ZAULT_HASH_LEN)
 * @return ZAULT_OK on success, error code otherwise
 */
int zault_vault_add_file(
    ZaultVault* vault,
    const char* file_path,
    size_t file_path_len,
    uint8_t* hash_out,
    size_t hash_out_len
);

/**
 * Retrieve and decrypt a file from the vault.
 *
 * @param vault            Vault handle
 * @param hash             32-byte metadata block hash
 * @param hash_len         Must be ZAULT_HASH_LEN
 * @param output_path      Path to write decrypted file
 * @param output_path_len  Length of output_path
 * @return ZAULT_OK on success, error code otherwise
 */
int zault_vault_get_file(
    ZaultVault* vault,
    const uint8_t* hash,
    size_t hash_len,
    const char* output_path,
    size_t output_path_len
);

/**
 * Get the vault's ML-KEM-768 public key for receiving shares.
 *
 * @param vault       Vault handle
 * @param pk_out      Buffer to receive public key
 * @param pk_out_len  Buffer size (must be >= ZAULT_MLKEM768_PK_LEN)
 * @return ZAULT_OK on success, error code otherwise
 */
int zault_vault_get_kem_public_key(
    const ZaultVault* vault,
    uint8_t* pk_out,
    size_t pk_out_len
);

/* ============================================================================
 * Sharing Functions
 * ============================================================================ */

/**
 * Create an encrypted share token for a file.
 *
 * The token allows the recipient to decrypt the file without access to
 * your vault's master key. Uses ML-KEM-768 for post-quantum security.
 *
 * @param vault               Vault handle
 * @param file_hash           32-byte metadata block hash
 * @param file_hash_len       Must be ZAULT_HASH_LEN
 * @param recipient_kem_pk    Recipient's ML-KEM-768 public key
 * @param recipient_kem_pk_len Must be ZAULT_MLKEM768_PK_LEN
 * @param expires_at          Unix timestamp when share expires
 * @param token_out           Buffer to receive encrypted token (or NULL to query size)
 * @param token_out_len       Buffer size
 * @param token_len_out       Receives actual token length
 * @return ZAULT_OK on success, error code otherwise
 */
int zault_vault_create_share(
    ZaultVault* vault,
    const uint8_t* file_hash,
    size_t file_hash_len,
    const uint8_t* recipient_kem_pk,
    size_t recipient_kem_pk_len,
    int64_t expires_at,
    uint8_t* token_out,
    size_t token_out_len,
    size_t* token_len_out
);

/**
 * Redeem a share token to get decryption access.
 *
 * After redeeming, use the returned hash to retrieve the shared file.
 *
 * @param vault         Vault handle
 * @param token         Encrypted share token
 * @param token_len     Token length
 * @param hash_out      Buffer to receive 32-byte file hash
 * @param hash_out_len  Buffer size (must be >= ZAULT_HASH_LEN)
 * @return ZAULT_OK on success, error code otherwise
 */
int zault_vault_redeem_share(
    ZaultVault* vault,
    const uint8_t* token,
    size_t token_len,
    uint8_t* hash_out,
    size_t hash_out_len
);

/* ============================================================================
 * Block Export/Import
 * ============================================================================ */

/**
 * Export blocks to a portable file.
 *
 * Exports the specified blocks and their dependencies (e.g., content blocks
 * referenced by metadata blocks) to a single file for offline transfer.
 *
 * @param vault            Vault handle
 * @param hashes           Flat array of 32-byte hashes (hash_count * 32 bytes)
 * @param hash_count       Number of hashes
 * @param output_path      Path to write export file
 * @param output_path_len  Length of output_path
 * @return ZAULT_OK on success, error code otherwise
 */
int zault_vault_export_blocks(
    ZaultVault* vault,
    const uint8_t* hashes,
    size_t hash_count,
    const char* output_path,
    size_t output_path_len
);

/**
 * Import blocks from a portable file.
 *
 * @param vault            Vault handle
 * @param import_path      Path to export file
 * @param import_path_len  Length of import_path
 * @return Number of imported blocks on success, negative error code otherwise
 */
int zault_vault_import_blocks(
    ZaultVault* vault,
    const char* import_path,
    size_t import_path_len
);

/* ============================================================================
 * Cryptographic Utilities
 * ============================================================================ */

/**
 * Compute SHA3-256 hash.
 *
 * @param data          Input data (NULL with data_len=0 for empty input)
 * @param data_len      Input length
 * @param hash_out      Buffer to receive 32-byte hash
 * @param hash_out_len  Buffer size (must be >= 32)
 * @return ZAULT_OK on success, error code otherwise
 */
int zault_sha3_256(
    const uint8_t* data,
    size_t data_len,
    uint8_t* hash_out,
    size_t hash_out_len
);

/**
 * Generate cryptographically secure random bytes.
 *
 * Uses the system's secure random number generator.
 *
 * @param out      Buffer to fill with random bytes
 * @param out_len  Number of bytes to generate
 * @return ZAULT_OK on success, error code otherwise
 */
int zault_random_bytes(uint8_t* out, size_t out_len);

#ifdef __cplusplus
}
#endif

#endif /* ZAULT_H */

