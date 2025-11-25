# libzault C FFI

libzault provides a C-compatible API for embedding Zault's post-quantum cryptography in any language that can call C functions.

## Building

```bash
zig build

# Outputs:
# zig-out/lib/libzault.so      - Shared library
# zig-out/lib/libzault_static.a - Static library
# zig-out/include/zault.h      - C header
```

## Quick Start

```c
#include <zault.h>
#include <stdio.h>

int main() {
    // Generate identity (ML-DSA-65 + ML-KEM-768 keypairs)
    ZaultIdentity* alice = zault_identity_generate();
    ZaultIdentity* bob = zault_identity_generate();
    
    // Get Bob's public key for encryption
    uint8_t bob_public[ZAULT_PUBLIC_IDENTITY_LEN];
    zault_identity_serialize_public(bob, bob_public, sizeof(bob_public));
    
    // Parse Bob's KEM public key
    uint8_t bob_kem_pk[ZAULT_MLKEM768_PK_LEN];
    zault_parse_public_identity_kem_pk(bob_public, sizeof(bob_public),
                                        bob_kem_pk, sizeof(bob_kem_pk));
    
    // Encrypt message to Bob
    const char* message = "Hello, post-quantum world!";
    uint8_t ciphertext[1024];
    size_t ciphertext_len;
    
    int result = zault_encrypt_message(
        alice,
        bob_kem_pk, ZAULT_MLKEM768_PK_LEN,
        (const uint8_t*)message, strlen(message),
        ciphertext, sizeof(ciphertext),
        &ciphertext_len
    );
    
    if (result != ZAULT_OK) {
        printf("Encryption failed: %s\n", zault_error_string(result));
        return 1;
    }
    
    // Bob decrypts
    uint8_t plaintext[1024];
    size_t plaintext_len;
    
    result = zault_decrypt_message(
        bob,
        ciphertext, ciphertext_len,
        plaintext, sizeof(plaintext),
        &plaintext_len
    );
    
    if (result == ZAULT_OK) {
        printf("Decrypted: %.*s\n", (int)plaintext_len, plaintext);
    }
    
    // Cleanup
    zault_identity_destroy(alice);
    zault_identity_destroy(bob);
    
    return 0;
}
```

Compile:

```bash
gcc -o example example.c -L./zig-out/lib -lzault -I./zig-out/include
LD_LIBRARY_PATH=./zig-out/lib ./example
```

## API Reference

### Constants

```c
// Key sizes
#define ZAULT_MLDSA65_PK_LEN     1952   // ML-DSA-65 public key
#define ZAULT_MLDSA65_SK_LEN     4032   // ML-DSA-65 secret key
#define ZAULT_MLKEM768_PK_LEN    1184   // ML-KEM-768 public key
#define ZAULT_MLKEM768_SK_LEN    2400   // ML-KEM-768 secret key

// Derived sizes
#define ZAULT_PUBLIC_IDENTITY_LEN 3136  // DSA PK + KEM PK
#define ZAULT_SIGNATURE_LEN       3309  // ML-DSA-65 signature
#define ZAULT_MSG_OVERHEAD        1116  // KEM ciphertext + nonce + tag
#define ZAULT_CHACHA20_OVERHEAD   28    // Nonce (12) + tag (16)
#define ZAULT_CHACHA20_KEY_LEN    32    // ChaCha20 key size
#define ZAULT_HASH_LEN            32    // SHA3-256 output

// Error codes
#define ZAULT_OK                   0
#define ZAULT_ERR_INVALID_PARAM   -1
#define ZAULT_ERR_BUFFER_TOO_SMALL -2
#define ZAULT_ERR_CRYPTO_FAILED   -3
#define ZAULT_ERR_AUTH_FAILED     -4
#define ZAULT_ERR_NOT_FOUND       -5
```

### Identity Management

```c
// Generate new identity (ML-DSA-65 + ML-KEM-768 keypairs)
ZaultIdentity* zault_identity_generate(void);

// Load identity from bytes
ZaultIdentity* zault_identity_from_bytes(
    const uint8_t* data,
    size_t len
);

// Serialize identity to bytes
int zault_identity_to_bytes(
    const ZaultIdentity* identity,
    uint8_t* out,
    size_t out_len,
    size_t* bytes_written
);

// Get public identity (for sharing)
int zault_identity_serialize_public(
    const ZaultIdentity* identity,
    uint8_t* out,
    size_t out_len
);

// Parse public identity components
int zault_parse_public_identity_kem_pk(
    const uint8_t* public_identity,
    size_t public_identity_len,
    uint8_t* kem_pk_out,
    size_t kem_pk_out_len
);

int zault_parse_public_identity_dsa_pk(
    const uint8_t* public_identity,
    size_t public_identity_len,
    uint8_t* dsa_pk_out,
    size_t dsa_pk_out_len
);

// Free identity
void zault_identity_destroy(ZaultIdentity* identity);
```

### Message Encryption (ML-KEM-768 + ChaCha20-Poly1305)

For encrypting messages to a specific recipient using their public key:

```c
// Encrypt message to recipient
// Uses ML-KEM-768 for key encapsulation + ChaCha20-Poly1305
int zault_encrypt_message(
    const ZaultIdentity* identity,      // Sender (can be NULL for anonymous)
    const uint8_t* recipient_kem_pk,    // Recipient's ML-KEM-768 public key
    size_t recipient_pk_len,            // Must be ZAULT_MLKEM768_PK_LEN
    const uint8_t* plaintext,
    size_t plaintext_len,
    uint8_t* ciphertext_out,
    size_t ciphertext_out_len,          // Must be >= plaintext_len + ZAULT_MSG_OVERHEAD
    size_t* ciphertext_len_out
);

// Decrypt message
int zault_decrypt_message(
    const ZaultIdentity* identity,      // Recipient's identity
    const uint8_t* ciphertext,
    size_t ciphertext_len,
    uint8_t* plaintext_out,
    size_t plaintext_out_len,
    size_t* plaintext_len_out
);
```

### Direct Symmetric Encryption (ChaCha20-Poly1305)

For group messaging or when you already have a shared key:

```c
// Encrypt with symmetric key (generates random nonce)
int zault_chacha20_encrypt(
    const uint8_t* key,                 // 32 bytes
    const uint8_t* plaintext,
    size_t plaintext_len,
    uint8_t* ciphertext_out,            // plaintext_len + ZAULT_CHACHA20_OVERHEAD
    size_t ciphertext_out_len,
    size_t* ciphertext_len_out
);

// Decrypt with symmetric key
int zault_chacha20_decrypt(
    const uint8_t* key,                 // 32 bytes
    const uint8_t* ciphertext,
    size_t ciphertext_len,
    uint8_t* plaintext_out,
    size_t plaintext_out_len,
    size_t* plaintext_len_out
);
```

### Digital Signatures (ML-DSA-65)

```c
// Sign data
int zault_sign(
    const ZaultIdentity* identity,
    const uint8_t* data,
    size_t data_len,
    uint8_t* signature_out,             // Must be >= ZAULT_SIGNATURE_LEN
    size_t sig_out_len
);

// Verify signature
int zault_verify(
    const uint8_t* public_key,          // ML-DSA-65 public key
    size_t pk_len,                      // Must be ZAULT_MLDSA65_PK_LEN
    const uint8_t* data,
    size_t data_len,
    const uint8_t* signature,
    size_t sig_len                      // Must be ZAULT_SIGNATURE_LEN
);
```

### Cryptographic Utilities

```c
// SHA3-256 hash
int zault_sha3_256(
    const uint8_t* data,
    size_t data_len,
    uint8_t* hash_out,                  // Must be >= ZAULT_HASH_LEN
    size_t hash_out_len
);

// Cryptographically secure random bytes
int zault_random_bytes(
    uint8_t* out,
    size_t len
);

// Get error message
const char* zault_error_string(int error_code);
```

### Vault Operations

For file storage (local filesystem):

```c
// Initialize vault
ZaultVault* zault_vault_init(
    const char* path,
    size_t path_len
);

// Add file to vault
int zault_vault_add_file(
    ZaultVault* vault,
    const char* file_path,
    size_t file_path_len,
    uint8_t* hash_out,
    size_t hash_out_len
);

// Get file from vault
int zault_vault_get_file(
    ZaultVault* vault,
    const uint8_t* hash,
    size_t hash_len,
    const char* output_path,
    size_t output_path_len
);

// Create share token
int zault_vault_create_share(
    ZaultVault* vault,
    const uint8_t* file_hash,
    size_t hash_len,
    const uint8_t* recipient_pk,
    size_t pk_len,
    uint64_t expires_at,
    uint8_t* token_out,
    size_t token_out_len,
    size_t* token_len_out
);

// Redeem share token
int zault_vault_redeem_share(
    ZaultVault* vault,
    const uint8_t* token,
    size_t token_len,
    const char* output_path,
    size_t output_path_len
);

// Free vault
void zault_vault_destroy(ZaultVault* vault);
```

## Usage Patterns

### 1:1 Chat

```c
// Alice sends to Bob
uint8_t ciphertext[msg_len + ZAULT_MSG_OVERHEAD];
size_t ct_len;
zault_encrypt_message(alice, bob_kem_pk, ZAULT_MLKEM768_PK_LEN,
                      msg, msg_len, ciphertext, sizeof(ciphertext), &ct_len);

// Bob decrypts
uint8_t plaintext[1024];
size_t pt_len;
zault_decrypt_message(bob, ciphertext, ct_len,
                      plaintext, sizeof(plaintext), &pt_len);
```

### Group Chat

```c
// Generate shared group key
uint8_t group_key[ZAULT_CHACHA20_KEY_LEN];
zault_random_bytes(group_key, sizeof(group_key));

// Distribute key to members (encrypt to each member's KEM pk)
for (int i = 0; i < member_count; i++) {
    uint8_t encrypted_key[ZAULT_CHACHA20_KEY_LEN + ZAULT_MSG_OVERHEAD];
    size_t ek_len;
    zault_encrypt_message(NULL, members[i].kem_pk, ZAULT_MLKEM768_PK_LEN,
                          group_key, sizeof(group_key),
                          encrypted_key, sizeof(encrypted_key), &ek_len);
    // Send encrypted_key to member[i]
}

// Encrypt group message with shared key
uint8_t ciphertext[msg_len + ZAULT_CHACHA20_OVERHEAD];
size_t ct_len;
zault_chacha20_encrypt(group_key, msg, msg_len,
                       ciphertext, sizeof(ciphertext), &ct_len);

// Any member with group_key can decrypt
uint8_t plaintext[1024];
size_t pt_len;
zault_chacha20_decrypt(group_key, ciphertext, ct_len,
                       plaintext, sizeof(plaintext), &pt_len);
```

### Signed Messages

```c
// Sign message
uint8_t signature[ZAULT_SIGNATURE_LEN];
zault_sign(alice, msg, msg_len, signature, sizeof(signature));

// Verify (using Alice's DSA public key)
int valid = zault_verify(alice_dsa_pk, ZAULT_MLDSA65_PK_LEN,
                         msg, msg_len, signature, sizeof(signature));
if (valid == ZAULT_OK) {
    printf("Signature valid!\n");
}
```

## Error Handling

All functions return `ZAULT_OK` (0) on success or a negative error code:

```c
int result = zault_encrypt_message(...);
if (result != ZAULT_OK) {
    fprintf(stderr, "Error: %s\n", zault_error_string(result));
}
```

## Thread Safety

- `zault_identity_generate()` is thread-safe
- `zault_random_bytes()` is thread-safe
- All crypto operations are stateless and thread-safe
- Vault operations require external synchronization

## Memory Management

- Functions that return pointers (e.g., `zault_identity_generate()`) allocate memory
- Always call the corresponding `_destroy()` function to free
- Output buffers are caller-provided and caller-owned

## Language Bindings

libzault can be used from any language with C FFI support:

- **Rust**: Use `bindgen` or write manual bindings
- **Python**: Use `ctypes` or `cffi`
- **Go**: Use `cgo`
- **Node.js**: Use `node-ffi-napi`
- **Ruby**: Use `ffi` gem

