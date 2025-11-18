# Zault Protocol Specification v0.1

**Status:** Draft  
**Last Updated:** 2025-11-18  
**Authors:** Initial Design

## Abstract

Zault is a post-quantum secure, zero-knowledge storage protocol designed for verifiable, encrypted data storage and sharing. The protocol uses NIST-standardized post-quantum cryptography (ML-KEM-768 for key encapsulation, ML-DSA-65 for digital signatures) and provides cryptographic proof of authenticity, integrity, and non-repudiation for all operations.

## 1. Goals and Non-Goals

### Goals
- **Post-quantum security:** Resistant to attacks from quantum computers
- **Zero-knowledge:** Storage providers cannot access plaintext data or metadata
- **Verifiable:** All operations are cryptographically signed and auditable
- **Decentralized-capable:** Can operate peer-to-peer or with untrusted servers
- **Self-sovereign identity:** Users control their cryptographic identity
- **Storage-agnostic:** Works with any content-addressed storage backend

### Non-Goals
- **Byzantine fault tolerance:** Not a distributed consensus system
- **Anonymous communication:** Identity privacy is optional, not mandatory
- **Real-time collaboration:** Designed for async operations
- **Compression:** Left to storage backend or application layer

## 2. Cryptographic Primitives

### 2.1 Core Algorithms

| Primitive | Algorithm | Parameters | Purpose |
|-----------|-----------|------------|---------|
| Key Encapsulation | ML-KEM | ML-KEM-768 | Key exchange, sharing |
| Digital Signatures | ML-DSA | ML-DSA-65 | Authentication, integrity |
| Symmetric Encryption | ChaCha20-Poly1305 | 256-bit keys | Bulk data encryption |
| Key Derivation | HKDF-SHA3-256 | - | Derive encryption keys |
| Hashing | SHA3-256 | - | Content addressing |
| Random | SHAKE256 | - | Nonce/IV generation |

**Rationale:** ML-KEM-768 and ML-DSA-65 provide security levels comparable to AES-192 and are NIST-standardized. ChaCha20-Poly1305 provides efficient authenticated encryption with post-quantum security for symmetric operations.

### 2.2 Algorithm Versioning

All cryptographic operations include a version identifier to support algorithm agility:

```
Version 0x01: ML-KEM-768, ML-DSA-65, ChaCha20-Poly1305, SHA3-256
Version 0x02+: Reserved for future algorithms
```

## 3. Identity

### 3.1 Identity Structure

A Zault identity consists of an ML-DSA key pair:

```zig
pub const Identity = struct {
    public_key: [ml_dsa.PublicKey.encoded_length]u8,   // 1952 bytes
    secret_key: [ml_dsa.SecretKey.encoded_length]u8,   // 4032 bytes
    created_at: i64,  // Unix timestamp
    version: u8,      // Crypto version (0x01)
};
```

### 3.2 Identity Encoding

**Public Identity (zpub):**
```
zpub1 + base32(version || public_key || checksum)
```

- `zpub1`: Human-readable prefix (version 1)
- `version`: 1 byte (0x01)
- `public_key`: ML-DSA public key (1952 bytes)
- `checksum`: First 4 bytes of SHA3-256(version || public_key)

**Secret Identity (zprv):**
```
zprv1 + base32(version || secret_key || checksum)
```

- `zprv1`: Human-readable prefix (version 1)
- `version`: 1 byte (0x01)
- `secret_key`: ML-DSA secret key (4032 bytes)
- `checksum`: First 4 bytes of SHA3-256(version || secret_key)

### 3.3 Identity Generation

```zig
pub fn generateIdentity(seed: ?[32]u8) !Identity {
    const keypair = if (seed) |s|
        try ml_dsa.ML_DSA_65.KeyPair.fromSeed(s)
    else
        try ml_dsa.ML_DSA_65.KeyPair.generate(null);
    
    return Identity{
        .public_key = keypair.public_key.toBytes(),
        .secret_key = keypair.secret_key.toBytes(),
        .created_at = std.time.timestamp(),
        .version = 0x01,
    };
}
```

### 3.4 Backup Words (BIP39-style)

Secret keys can be encoded as 24-word mnemonic phrases for backup:

```
secret_key → entropy (256 bits) → BIP39 encoding → 24 words
```

## 4. Data Structures

### 4.1 Block

The fundamental unit of storage. All data is stored as content-addressed blocks.

```zig
pub const Block = struct {
    // Header
    version: u8,              // Protocol version (0x01)
    block_type: BlockType,    // Content, Metadata, Index, etc.
    timestamp: i64,           // Unix timestamp
    author: [1952]u8,         // Author's ML-DSA public key
    
    // Content
    data: []const u8,         // Encrypted payload
    nonce: [12]u8,            // ChaCha20-Poly1305 nonce
    
    // Integrity
    signature: [ml_dsa.Signature.encoded_length]u8,  // 3309 bytes
    prev_hash: [32]u8,        // Hash of previous block (chain)
    
    // Computed (not serialized)
    hash: [32]u8,             // SHA3-256 of serialized block
};

pub const BlockType = enum(u8) {
    content = 0x01,     // File data
    metadata = 0x02,    // File metadata
    index = 0x03,       // Directory index
    tombstone = 0x04,   // Deletion marker
    share = 0x05,       // Share token
};
```

### 4.2 Block Serialization

Binary format (little-endian):

```
[version: 1 byte]
[block_type: 1 byte]
[timestamp: 8 bytes]
[author: 1952 bytes]
[nonce: 12 bytes]
[data_len: 4 bytes]
[data: data_len bytes]
[prev_hash: 32 bytes]
[signature: 3309 bytes]
```

**Block Hash:**
```
hash = SHA3-256(serialized_block_without_signature || signature)
```

### 4.3 Vault

A collection of blocks representing a user's stored data.

```zig
pub const Vault = struct {
    identity: Identity,
    root_hash: [32]u8,        // Current root of block DAG
    blocks: BlockStore,       // Content-addressed storage
    index: EncryptedIndex,    // Fast lookups
};
```

### 4.4 File Metadata

Encrypted metadata stored in a metadata block:

```zig
pub const FileMetadata = struct {
    name: []const u8,         // Original filename
    size: u64,                // Plaintext size
    mime_type: []const u8,    // MIME type
    created: i64,             // Creation timestamp
    modified: i64,            // Last modified
    version: u32,             // Version number
    parent: ?[32]u8,          // Parent directory hash
    content_hash: [32]u8,     // Hash of content block
    encryption_key: [32]u8,   // Key for content (encrypted)
};
```

## 5. Core Operations

### 5.1 Upload

**Goal:** Store a file in the vault with full encryption and signing.

**Algorithm:**

```zig
pub fn upload(vault: *Vault, filepath: []const u8) !BlockHash {
    // 1. Read file
    const data = try std.fs.cwd().readFileAlloc(allocator, filepath, max_size);
    
    // 2. Generate content encryption key
    var content_key: [32]u8 = undefined;
    crypto.random.bytes(&content_key);
    
    // 3. Encrypt content
    var nonce: [12]u8 = undefined;
    crypto.random.bytes(&nonce);
    const ciphertext = try ChaCha20Poly1305.encrypt(
        data,
        &content_key,
        &nonce,
        &[_]u8{}, // no associated data
    );
    
    // 4. Create content block
    const content_block = Block{
        .version = 0x01,
        .block_type = .content,
        .timestamp = std.time.timestamp(),
        .author = vault.identity.public_key,
        .data = ciphertext,
        .nonce = nonce,
        .prev_hash = vault.root_hash,
        .signature = undefined, // filled below
        .hash = undefined,
    };
    
    // 5. Sign content block
    const serialized = content_block.serialize();
    const signature = try ml_dsa.ML_DSA_65.sign(
        serialized,
        vault.identity.secret_key,
    );
    content_block.signature = signature;
    content_block.hash = SHA3_256.hash(serialized ++ signature);
    
    // 6. Store content block
    try vault.blocks.put(content_block.hash, content_block);
    
    // 7. Create metadata block
    const metadata = FileMetadata{
        .name = std.fs.path.basename(filepath),
        .size = data.len,
        .mime_type = detectMimeType(filepath),
        .created = std.time.timestamp(),
        .modified = std.time.timestamp(),
        .version = 1,
        .parent = null,
        .content_hash = content_block.hash,
        .encryption_key = content_key,
    };
    
    // 8. Encrypt metadata with vault key
    const metadata_ciphertext = try encryptMetadata(vault, metadata);
    
    // 9. Create and store metadata block
    const metadata_block = createBlock(
        vault,
        .metadata,
        metadata_ciphertext,
        content_block.hash,
    );
    try vault.blocks.put(metadata_block.hash, metadata_block);
    
    // 10. Update vault root
    vault.root_hash = metadata_block.hash;
    
    return metadata_block.hash;
}
```

### 5.2 Download

**Goal:** Retrieve and decrypt a file from the vault.

**Algorithm:**

```zig
pub fn download(vault: *Vault, block_hash: [32]u8) ![]const u8 {
    // 1. Fetch metadata block
    const metadata_block = try vault.blocks.get(block_hash);
    
    // 2. Verify signature
    try ml_dsa.ML_DSA_65.verify(
        metadata_block.serialize(),
        metadata_block.signature,
        metadata_block.author,
    );
    
    // 3. Decrypt metadata
    const metadata = try decryptMetadata(vault, metadata_block.data);
    
    // 4. Fetch content block
    const content_block = try vault.blocks.get(metadata.content_hash);
    
    // 5. Verify content signature
    try ml_dsa.ML_DSA_65.verify(
        content_block.serialize(),
        content_block.signature,
        content_block.author,
    );
    
    // 6. Decrypt content
    const plaintext = try ChaCha20Poly1305.decrypt(
        content_block.data,
        &metadata.encryption_key,
        &content_block.nonce,
        &[_]u8{},
    );
    
    return plaintext;
}
```

### 5.3 Share

**Goal:** Grant time-limited access to a file to another identity.

**Algorithm:**

```zig
pub fn share(
    vault: *Vault,
    block_hash: [32]u8,
    recipient_pubkey: []const u8,
    expires_at: i64,
) ![]const u8 {
    // 1. Fetch metadata block
    const metadata_block = try vault.blocks.get(block_hash);
    const metadata = try decryptMetadata(vault, metadata_block.data);
    
    // 2. Create share token
    const share_token = ShareToken{
        .version = 0x01,
        .file_hash = block_hash,
        .content_key = metadata.encryption_key,
        .expires_at = expires_at,
        .granted_by = vault.identity.public_key,
        .granted_at = std.time.timestamp(),
    };
    
    // 3. Serialize share token
    const token_bytes = share_token.serialize();
    
    // 4. Encrypt for recipient using ML-KEM
    const recipient_pk = try ml_kem.ML_KEM_768.PublicKey.fromBytes(
        recipient_pubkey
    );
    const ss_seed: [32]u8 = undefined;
    crypto.random.bytes(&ss_seed);
    const encapsulation = try recipient_pk.encaps(ss_seed);
    
    // 5. Derive encryption key from shared secret
    var kdf = HKDF_SHA3_256.init(&encapsulation.shared_secret);
    var derived_key: [32]u8 = undefined;
    try kdf.expand(&derived_key, "zault-share-v1");
    
    // 6. Encrypt token
    var nonce: [12]u8 = undefined;
    crypto.random.bytes(&nonce);
    const encrypted_token = try ChaCha20Poly1305.encrypt(
        token_bytes,
        &derived_key,
        &nonce,
        &[_]u8{},
    );
    
    // 7. Create share block
    const share_data = ShareBlockData{
        .ciphertext: encapsulation.ciphertext,
        .nonce: nonce,
        .encrypted_token: encrypted_token,
    };
    
    // 8. Sign share block
    const share_block = createBlock(
        vault,
        .share,
        share_data.serialize(),
        metadata_block.hash,
    );
    
    // 9. Encode as share URI
    return try encodeShareURI(share_block);
}
```

**Share Token Structure:**

```zig
pub const ShareToken = struct {
    version: u8,
    file_hash: [32]u8,
    content_key: [32]u8,
    expires_at: i64,
    granted_by: [1952]u8,
    granted_at: i64,
};
```

**Share URI Format:**

```
zshare1:<base32(share_block_hash)>:<base32(server_hint)>
```

### 5.4 Receive Shared File

**Algorithm:**

```zig
pub fn receiveShare(
    vault: *Vault,
    share_uri: []const u8,
) !BlockHash {
    // 1. Parse share URI
    const share_info = try parseShareURI(share_uri);
    
    // 2. Fetch share block (from hint or DHT)
    const share_block = try fetchBlock(share_info.hash, share_info.server);
    
    // 3. Verify signature
    try ml_dsa.ML_DSA_65.verify(
        share_block.serialize(),
        share_block.signature,
        share_block.author,
    );
    
    // 4. Decrypt share token
    const share_data = ShareBlockData.deserialize(share_block.data);
    
    // 5. Decapsulate shared secret
    const shared_secret = try vault.identity.kem_keypair.decaps(
        share_data.ciphertext
    );
    
    // 6. Derive decryption key
    var kdf = HKDF_SHA3_256.init(&shared_secret);
    var derived_key: [32]u8 = undefined;
    try kdf.expand(&derived_key, "zault-share-v1");
    
    // 7. Decrypt token
    const token_bytes = try ChaCha20Poly1305.decrypt(
        share_data.encrypted_token,
        &derived_key,
        &share_data.nonce,
        &[_]u8{},
    );
    
    // 8. Parse token
    const token = try ShareToken.deserialize(token_bytes);
    
    // 9. Check expiration
    if (std.time.timestamp() > token.expires_at) {
        return error.ShareExpired;
    }
    
    // 10. Fetch and verify content
    const content_block = try fetchBlock(token.file_hash, share_info.server);
    try ml_dsa.ML_DSA_65.verify(
        content_block.serialize(),
        content_block.signature,
        token.granted_by,
    );
    
    // 11. Store in local vault
    try vault.blocks.put(content_block.hash, content_block);
    
    return content_block.hash;
}
```

### 5.5 Version History

Files maintain a DAG of versions through the `prev_hash` field:

```
v1 → v2 → v3 → v4 (current)
      ↓
      v2.1 (branch)
```

**List versions:**

```zig
pub fn listVersions(vault: *Vault, file_hash: [32]u8) ![]BlockHash {
    var versions = ArrayList(BlockHash).init(allocator);
    var current = file_hash;
    
    while (true) {
        try versions.append(current);
        const block = try vault.blocks.get(current);
        
        if (std.mem.eql(u8, &block.prev_hash, &[_]u8{0} ** 32)) {
            break; // Reached genesis
        }
        
        current = block.prev_hash;
    }
    
    std.mem.reverse(BlockHash, versions.items);
    return versions.toOwnedSlice();
}
```

## 6. Storage Backend

### 6.1 BlockStore Interface

```zig
pub const BlockStore = struct {
    pub const Error = error{
        NotFound,
        AlreadyExists,
        StorageFailure,
    };
    
    pub fn put(self: *BlockStore, hash: [32]u8, block: Block) Error!void;
    pub fn get(self: *BlockStore, hash: [32]u8) Error!Block;
    pub fn has(self: *BlockStore, hash: [32]u8) Error!bool;
    pub fn delete(self: *BlockStore, hash: [32]u8) Error!void;
    pub fn list(self: *BlockStore) Error!Iterator(BlockHash);
};
```

### 6.2 Backend Implementations

**Local Filesystem:**
```
~/.zault/
├── blocks/
│   ├── 00/
│   │   ├── 00a1b2c3...
│   │   └── 00d4e5f6...
│   └── 01/
└── index.db
```

**S3-Compatible:**
- Bucket: `my-zault-storage`
- Key: `blocks/<hash>`
- Metadata: None (everything encrypted)

**IPFS:**
- Pin blocks as they're created
- Use IPNS for mutable vault root

### 6.3 Deduplication

Blocks are content-addressed, so identical encrypted content is stored once:

```
hash = SHA3-256(ciphertext)
```

Note: Different encryption keys produce different ciphertexts, so files must be re-encrypted with the same key for deduplication to work.

## 7. Network Protocol

### 7.1 Server API

Zault servers provide a simple REST API for block storage:

**Endpoints:**

```
PUT    /blocks/:hash          Store a block
GET    /blocks/:hash          Retrieve a block
HEAD   /blocks/:hash          Check if block exists
DELETE /blocks/:hash          Delete a block (auth required)
GET    /blocks                List all block hashes (paginated)
```

**Authentication:**

Requests must include ML-DSA signature:

```
Authorization: Zault zpub=<public_key>, sig=<signature>, ts=<timestamp>
```

Signature covers: `METHOD + PATH + TIMESTAMP + BODY_HASH`

### 7.2 Peer-to-Peer

For P2P operation, Zault can use:

- **DHT:** Kademlia-based lookup of block hashes
- **Direct transfer:** QUIC streams between peers
- **Discovery:** mDNS for local network, DHT for internet

**P2P Block Exchange:**

```
1. Sender announces block hash to DHT
2. Receiver looks up hash, gets peer list
3. Receiver requests block from peers
4. Peers stream block over QUIC
5. Receiver verifies signature
```

## 8. Security Considerations

### 8.1 Threat Model

**In Scope:**
- Malicious storage providers
- Network adversaries (MITM, eavesdropping)
- Quantum adversaries (harvest now, decrypt later)
- Insider threats (compromised servers)

**Out of Scope:**
- Side-channel attacks on local implementation
- Physical attacks on user devices
- Social engineering
- Malware on user devices

### 8.2 Security Properties

**Confidentiality:**
- Files encrypted with unique keys per-file
- Metadata encrypted with vault master key
- Storage provider sees only encrypted blobs

**Integrity:**
- All blocks signed with ML-DSA
- Tampering is detectable
- Content-addressed storage ensures correctness

**Authenticity:**
- ML-DSA signatures prove authorship
- Cannot forge blocks without private key
- Share tokens prove grant delegation

**Non-repudiation:**
- Signatures are cryptographically binding
- Audit trail is immutable
- Version history preserved

**Forward Secrecy:**
- Each file has unique encryption key
- Compromise of one key doesn't affect others
- Share tokens have limited lifetime

### 8.3 Known Limitations

1. **Metadata leakage:** File sizes and access patterns visible to storage provider
2. **No plausible deniability:** Cannot deny existence of vault
3. **Key loss is permanent:** No password recovery mechanism
4. **Clock skew:** Timestamps can be manipulated by client
5. **Spam/DoS:** Servers must implement rate limiting

### 8.4 Mitigations

**Metadata protection:**
- Optional: Pad all blocks to fixed sizes
- Optional: Use Oblivious RAM patterns for access
- Use encrypted index for filename searches

**Rate limiting:**
- Proof-of-work for anonymous uploads
- Account quotas for authenticated users
- Per-IP rate limits

**Clock skew:**
- Servers can reject blocks with future timestamps
- Clients should validate timestamp ordering

## 9. Implementation Notes

### 9.1 Performance Targets

- **Upload:** 100 MB/s on modern hardware
- **Download:** 100 MB/s on modern hardware
- **Signature generation:** ~2ms per block
- **Signature verification:** ~2ms per block
- **Key generation:** <100ms

### 9.2 Resource Limits

```zig
pub const Limits = struct {
    pub const max_block_size = 16 * 1024 * 1024;      // 16 MB
    pub const max_file_size = 100 * 1024 * 1024 * 1024; // 100 GB (chunked)
    pub const max_metadata_size = 64 * 1024;           // 64 KB
    pub const max_share_recipients = 1000;             // Per share operation
    pub const max_versions = 10000;                    // Per file
};
```

### 9.3 Error Handling

```zig
pub const ZaultError = error{
    // Crypto errors
    InvalidSignature,
    InvalidPublicKey,
    InvalidSecretKey,
    DecryptionFailed,
    EncapsulationFailed,
    
    // Protocol errors
    InvalidBlock,
    InvalidVersion,
    BlockNotFound,
    ShareExpired,
    QuotaExceeded,
    
    // Storage errors
    StorageFailure,
    NetworkFailure,
    Timeout,
};
```

### 9.4 Testing Strategy

**Unit tests:**
- Cryptographic primitives
- Block serialization/deserialization
- Signature generation/verification

**Integration tests:**
- Full upload/download cycle
- Share token creation/redemption
- Version history operations

**Property tests:**
- Round-trip encoding (block → bytes → block)
- Signature verification always succeeds for valid blocks
- Decryption produces original plaintext

**Security tests:**
- Cannot decrypt without key
- Cannot forge signatures
- Cannot access expired shares

## 10. Future Extensions

### 10.1 Potential Features

- **Multi-device sync:** Conflict-free replicated data types (CRDTs)
- **Selective disclosure:** Zero-knowledge proofs for metadata queries
- **Encrypted search:** Searchable encryption for filenames
- **Smart contracts:** On-chain storage commitments
- **Collaborative editing:** Operational transforms over encrypted data

### 10.2 Cryptographic Agility

When quantum computers break ML-KEM/ML-DSA:

```zig
pub const BlockV2 = struct {
    // All fields from BlockV1, plus:
    version: u8 = 0x02,
    future_crypto_params: FutureCryptoParams,
};
```

Old blocks remain valid. New blocks use new crypto. Clients support both.

---

## Appendix A: Test Vectors

```zig
test "Identity generation" {
    const seed = [_]u8{0x42} ** 32;
    const identity = try generateIdentity(seed);
    
    // Expected public key (first 8 bytes)
    const expected_pk_prefix = [_]u8{0x1a, 0x2b, 0x3c, 0x4d, 0x5e, 0x6f, 0x7a, 0x8b};
    try testing.expect(std.mem.eql(
        u8,
        identity.public_key[0..8],
        &expected_pk_prefix,
    ));
}

test "Block signing and verification" {
    var rng = RndGen.init(0);
    const identity = try generateIdentity(null);
    
    const block = Block{
        .version = 0x01,
        .block_type = .content,
        .timestamp = 1700000000,
        .author = identity.public_key,
        .data = "test data",
        .nonce = [_]u8{0} ** 12,
        .prev_hash = [_]u8{0} ** 32,
        .signature = undefined,
        .hash = undefined,
    };
    
    const serialized = block.serialize();
    const signature = try ml_dsa.ML_DSA_65.sign(serialized, identity.secret_key);
    
    // Verify signature
    try ml_dsa.ML_DSA_65.verify(serialized, signature, identity.public_key);
}

test "Share token encryption" {
    // TODO: Full test vector
}
```

## Appendix B: Wire Format Examples

**Identity (zpub):**
```
zpub1a2b3c4d5e6f7g8h9j0k1m2n3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f0g1h2j3k4m5n6p7q8r9s0t1u2v3w4x5y6z7a8b9c0d1e2f3g4h5j6k7m8
```

**Block Hash:**
```
00a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0
```

**Share URI:**
```
zshare1:a2b3c4d5e6f7g8h9:storage.example.com
```

## Appendix C: References

- [ML-KEM Specification (FIPS 203)](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.203.pdf)
- [ML-DSA Specification (FIPS 204)](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf)
- [ChaCha20-Poly1305 (RFC 8439)](https://www.rfc-editor.org/rfc/rfc8439)
- [HKDF (RFC 5869)](https://www.rfc-editor.org/rfc/rfc5869)
- [SHA-3 (FIPS 202)](https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf)

