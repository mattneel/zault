# Security Model

Understanding Zault's security properties, threat model, and guarantees.

---

## Overview

Zault provides post-quantum end-to-end encryption for:

1. **File Storage** (CLI) - Encrypted vault with content-addressed blocks
2. **P2P Chat** (PWA) - Real-time encrypted messaging
3. **Library** (libzault/WASM) - Crypto primitives for your applications

All three share the same cryptographic foundation:

| Algorithm | Purpose | Security Level |
|-----------|---------|----------------|
| ML-DSA-65 | Digital signatures | ~192-bit (post-quantum) |
| ML-KEM-768 | Key encapsulation | ~192-bit (post-quantum) |
| ChaCha20-Poly1305 | Symmetric encryption | 256-bit |
| SHA3-256 | Hashing | 256-bit |

---

## Threat Model

### What Zault Protects Against ✅

#### 1. Malicious Server/Storage Provider

**Threat:** Server operator tries to read your data.

**Protection:**
- All content encrypted before transmission
- Server never receives encryption keys
- Keys generated and stored only on your device

**Result:** Server sees only encrypted ciphertext ✅

#### 2. Network Eavesdropping

**Threat:** Attacker intercepts network traffic.

**Protection:**
- Data encrypted end-to-end
- Only ciphertext transmitted
- TLS for transport (additional layer)

**Result:** Eavesdropper cannot decrypt ✅

#### 3. Quantum Adversaries (Harvest Now, Decrypt Later)

**Threat:** Attacker captures encrypted data today, decrypts with quantum computer in 10-15 years.

**Protection:**
- ML-DSA-65 signatures (quantum-resistant)
- ML-KEM-768 key exchange (quantum-resistant)
- ChaCha20-Poly1305 (256-bit, quantum-resistant for symmetric)
- NIST-standardized algorithms (FIPS 203, 204)

**Result:** Resistant to known quantum attacks ✅

#### 4. Message Tampering

**Threat:** Attacker modifies messages in transit.

**Protection:**
- ChaCha20-Poly1305 authenticated encryption
- ML-DSA-65 signatures on blocks
- Tampering detected before decryption

**Result:** Tampering detected immediately ✅

#### 5. Impersonation

**Threat:** Attacker pretends to be someone else.

**Protection:**
- Identity = ML-DSA-65 + ML-KEM-768 keypairs
- Messages signed with sender's private key
- Cannot forge without private key

**Result:** Cryptographic proof of identity ✅

---

### What Zault Does NOT Protect Against ❌

#### 1. Compromised Device

**Threat:** Malware on your device captures keys.

**Not Protected:**
- Malware can read identity files
- Malware can see decrypted messages
- Keyloggers can capture input

**Mitigation:**
- Keep OS updated
- Use antivirus software
- Don't install untrusted software

#### 2. Physical Access

**Threat:** Attacker steals your device.

**Not Protected:**
- Identity accessible if disk not encrypted
- Memory may contain keys

**Mitigation:**
- Use full-disk encryption
- Strong device password
- Remote wipe capability

#### 3. Key Loss

**Threat:** You lose your identity/private keys.

**Not Protected:**
- No password recovery
- No key escrow
- No way to decrypt old data

**Mitigation:**
- Backup identity file
- Store backup securely
- Test recovery procedure

#### 4. Metadata/Traffic Analysis

**Threat:** Attacker analyzes communication patterns.

**Visible:**
- Who communicates with whom (peer IDs)
- When messages are sent
- Message sizes
- Online/offline status

**Not Visible:**
- Message contents
- Full identities (only short IDs)

---

## P2P Chat Security Model

### Architecture

```
Alice                    Server                    Bob
  │                        │                        │
  │ ── encrypted msg ────▶ │ ── encrypted msg ────▶ │
  │                        │                        │
  │ (Server routes only)   │                        │
  │ (Cannot decrypt)       │                        │
```

### What the Server Sees

| Data | Visible? | Notes |
|------|----------|-------|
| Message content | ❌ No | Encrypted with ML-KEM-768 |
| Peer short IDs | ✅ Yes | First 16 chars of pubkey hash |
| Full identities | ❌ No | Only exchanged peer-to-peer |
| Online status | ✅ Yes | WebSocket connection state |
| Message routing | ✅ Yes | Who sends to whom |
| Message timing | ✅ Yes | When messages sent |
| Message size | ✅ Yes | Approximate length |

### 1:1 Chat Encryption

```
1. Alice generates ephemeral shared secret using Bob's ML-KEM-768 public key
2. Derives symmetric key from shared secret
3. Encrypts message with ChaCha20-Poly1305
4. Sends: [KEM ciphertext (1088)] [nonce (12)] [tag (16)] [encrypted message]
5. Bob decapsulates shared secret using his private key
6. Decrypts message
```

**Properties:**
- Forward secrecy per message (new KEM encapsulation each time)
- Authentication via ML-KEM binding
- 1116 bytes overhead per message

### Group Chat Encryption

```
1. Creator generates random 32-byte group key
2. Encrypts group key to each member's ML-KEM-768 public key
3. Distributes encrypted keys
4. Messages encrypted with ChaCha20-Poly1305 using shared key
5. On member removal: rotate key, re-encrypt to remaining members
```

**Properties:**
- Efficient (28 bytes overhead per message)
- Key rotation maintains forward secrecy
- Removed members cannot decrypt new messages

### Offline Sync Security

Messages synced when coming back online:

1. **Stored encrypted** - Only ciphertext in IndexedDB
2. **Synced encrypted** - Only ciphertext transmitted
3. **Decrypted at render** - Plaintext only in UI layer

**CRDT sync protocol:**
- Vector clocks track message history
- Missing messages requested by ID
- Only encrypted payloads transferred

---

## File Storage Security Model

### Two-Block System

Every file creates two encrypted blocks:

**Content Block:**
- Encrypted file data (ChaCha20-Poly1305)
- Random per-file key
- Signed with ML-DSA-65

**Metadata Block:**
- Encrypted filename, size, MIME type
- Contains content block hash and key
- Signed with ML-DSA-65

**Result:** Server cannot see filenames or content.

### Share Token Security

```
1. Alice creates share for Bob
2. File key encrypted with Bob's ML-KEM-768 public key
3. Share token = [encrypted key] [expiration] [signature]
4. Bob decapsulates key with his private key
5. Bob decrypts file
```

**Properties:**
- Only intended recipient can decrypt
- Expiration enforced cryptographically
- Cannot forge share tokens (ML-DSA signature)

---

## Cryptographic Algorithms

### ML-DSA-65 (Digital Signatures)

- **Standard:** NIST FIPS 204
- **Security:** ~192-bit post-quantum
- **Key sizes:** Public 1,952 bytes, Secret 4,032 bytes
- **Signature:** 3,309 bytes
- **Use:** Block signing, message authentication

### ML-KEM-768 (Key Encapsulation)

- **Standard:** NIST FIPS 203
- **Security:** ~192-bit post-quantum
- **Key sizes:** Public 1,184 bytes, Secret 2,400 bytes
- **Ciphertext:** 1,088 bytes
- **Use:** 1:1 chat encryption, share tokens

### ChaCha20-Poly1305 (AEAD)

- **Standard:** RFC 8439
- **Security:** 256-bit
- **Overhead:** 28 bytes (12 nonce + 16 tag)
- **Use:** Symmetric encryption, group chat

### SHA3-256 (Hashing)

- **Standard:** FIPS 202
- **Security:** 256-bit
- **Output:** 32 bytes
- **Use:** Content addressing, key derivation

---

## Attack Scenarios

### Scenario 1: Server Compromise

**Attack:** Attacker gains full server access.

**What attacker gets:**
- Encrypted message payloads
- Peer short IDs
- Routing metadata

**What attacker CANNOT get:**
- Message contents ❌
- Private keys ❌
- Full identities ❌

**Result:** Attack limited to metadata ✅

### Scenario 2: Man-in-the-Middle

**Attack:** Attacker intercepts and modifies messages.

**Detection:**
- ChaCha20-Poly1305 authentication fails
- Message rejected before decryption

**Result:** Attack detected ✅

### Scenario 3: Quantum Computer (Future)

**Attack:** Quantum computer breaks classical crypto.

**Vulnerable (NOT used by Zault):**
- RSA ❌
- ECDSA ❌
- ECDH ❌

**Safe (used by Zault):**
- ML-DSA-65 ✅
- ML-KEM-768 ✅
- ChaCha20 ✅ (Grover's halves to 128-bit, still secure)
- SHA3-256 ✅

**Result:** Zault resists known quantum attacks ✅

---

## Security Audits

**Current Status:** Not yet externally audited

**Completed:**
- ✅ NIST KAT test vectors
- ✅ Fuzz testing
- ✅ 75+ automated tests
- ✅ Open source review

**Planned:**
- External cryptographic audit
- Penetration testing
- Formal verification

**Recommendation:** Suitable for personal use. Wait for audit before high-value/regulated data.

---

## Security Best Practices

### For Users

1. **Backup your identity** - Store in multiple secure locations
2. **Use device encryption** - Full-disk encryption on all devices
3. **Verify contacts** - Confirm identity through secondary channel
4. **Keep software updated** - Security fixes in updates

### For Developers

1. **Never log sensitive data** - No plaintext in logs
2. **Clear memory after use** - Zero sensitive buffers
3. **Validate all inputs** - Don't trust user data
4. **Use constant-time operations** - Prevent timing attacks

---

## Reporting Security Issues

**Found a vulnerability?**

**DO NOT open a public issue!**

Contact: security@zault.chat

We respond within 48 hours and coordinate responsible disclosure.

---

## Further Reading

- [Protocol Specification](./protocol-specification.md) - Technical details
- [libzault](./libzault.md) - C FFI documentation
- [WASM](./wasm.md) - Browser integration

---

**Security is a process, not a product. Stay vigilant!** 🔒
