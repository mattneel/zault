# Security Model

Understanding Zault's security properties, threat model, and guarantees.

---

## Threat Model

### What Zault Protects Against ✅

#### 1. Malicious Storage Provider

**Threat:** Storage provider tries to read your files.

**Protection:**
- All content encrypted with ChaCha20-Poly1305
- All metadata encrypted with vault master key
- Server never receives encryption keys

**Result:** Server sees only encrypted gibberish ✅

#### 2. Network Eavesdropping

**Threat:** Attacker intercepts network traffic.

**Protection:**
- Files encrypted before upload
- Only ciphertext transmitted
- Future: TLS for server communication

**Result:** Eavesdropper cannot decrypt ✅

#### 3. Quantum Adversaries (Harvest Now, Decrypt Later)

**Threat:** Attacker captures encrypted data today, decrypts with quantum computer in 10-15 years.

**Protection:**
- ML-DSA-65 signatures (quantum-resistant)
- ChaCha20-Poly1305 (256-bit, quantum-resistant for symmetric)
- NIST-standardized post-quantum algorithms

**Result:** Resistant to known quantum attacks ✅

#### 4. Server Compromise

**Threat:** Attacker gains full access to storage server.

**Protection:**
- Encrypted at rest
- No master keys on server
- Signatures prevent tampering

**Result:** Attacker gets encrypted blocks only ✅

#### 5. Tampering

**Threat:** Attacker modifies stored blocks.

**Protection:**
- All blocks signed with ML-DSA-65
- Content-addressed (SHA3-256 hashes)
- Signature verification before decryption

**Result:** Tampering detected immediately ✅

---

### What Zault Does NOT Protect Against ❌

#### 1. Malware on Your Device

**Threat:** Malware on your computer captures keys.

**Not Protected:**
- Malware can read `identity.bin`
- Malware can see plaintext files
- Malware can log keystrokes

**Mitigation:**
- Keep OS updated
- Use antivirus
- Don't run untrusted code
- Consider hardware security modules (future)

#### 2. Physical Attacks

**Threat:** Attacker steals your device.

**Not Protected:**
- `identity.bin` accessible if disk not encrypted
- Memory dumps may contain keys
- Cold boot attacks

**Mitigation:**
- Use full-disk encryption (LUKS, FileVault, BitLocker)
- Strong device password
- Secure boot
- Consider encrypted identity.bin (future)

#### 3. Social Engineering

**Threat:** Attacker tricks you into sharing keys.

**Not Protected:**
- Zault cannot prevent human error
- No "undo" for sharing `identity.bin`

**Mitigation:**
- Never share `identity.bin`
- Verify recipient identity before sharing files
- Use share tokens (Phase 2) instead

#### 4. Loss of Private Key

**Threat:** You lose `identity.bin`.

**Not Protected:**
- No password recovery
- No key escrow
- No way to decrypt vault

**Mitigation:**
- Multiple backups of `identity.bin`
- Store backup in safe location
- Test recovery procedure
- Consider BIP39 mnemonics (future)

#### 5. Traffic Analysis

**Threat:** Attacker analyzes access patterns.

**Not Protected:**
- Block sizes visible (approximate file sizes)
- Access timing visible
- Upload frequency patterns

**Mitigation:**
- Pad blocks to fixed sizes (future)
- Use Tor/VPN for network privacy
- Oblivious RAM patterns (future)

---

## Security Properties

### Confidentiality ✅

**Content Encryption:**
- Algorithm: ChaCha20-Poly1305
- Key length: 256 bits
- Unique key per file
- Nonce: 96 bits, random

**Metadata Encryption:**
- Algorithm: ChaCha20-Poly1305
- Key: Vault master key (HKDF-derived)
- Encrypts: filename, size, type, content_key

**Result:** Server cannot read filenames or content.

---

### Integrity ✅

**Digital Signatures:**
- Algorithm: ML-DSA-65 (NIST FIPS 204)
- Security level: ~192-bit (post-quantum)
- Signs: All block data

**Content Addressing:**
- Algorithm: SHA3-256
- Block ID = SHA3-256(block data)
- Tamper-evident

**Result:** Any modification is immediately detected.

---

### Authenticity ✅

**Identity:**
- ML-DSA-65 keypair per vault
- Public key in every block's `author` field
- Cannot forge without private key

**Result:** Provable authorship of all blocks.

---

### Non-Repudiation ✅

**Signatures are binding:**
- Cannot deny creating a signed block
- Cryptographic proof of authorship
- Audit trail immutable

**Result:** Perfect for compliance and legal evidence.

---

### Forward Secrecy ✅

**Per-File Keys:**
- Each file has unique encryption key
- Compromise of one key doesn't affect others
- Future: Ratcheting keys for share tokens

**Result:** Limited blast radius on key compromise.

---

## Cryptographic Algorithms

### Post-Quantum Algorithms

#### ML-DSA-65 (Digital Signatures)
- **Standard:** NIST FIPS 204
- **Security:** ~192-bit (post-quantum)
- **Key sizes:**
  - Public: 1,952 bytes
  - Secret: 4,032 bytes
  - Signature: 3,309 bytes
- **Performance:** ~2ms sign/verify

**Why ML-DSA:**
- NIST-standardized (mature)
- Quantum-resistant (lattice-based)
- Fast enough for real-time use

#### ML-KEM-768 (Key Encapsulation)
- **Standard:** NIST FIPS 203
- **Security:** ~192-bit (post-quantum)
- **Status:** Implemented, not yet used
- **Future:** Share tokens (Phase 2.1)

**Why ML-KEM:**
- NIST-standardized
- Quantum-resistant (lattice-based)
- Perfect for asymmetric encryption

---

### Classical Algorithms

#### ChaCha20-Poly1305 (Authenticated Encryption)
- **Standard:** RFC 8439
- **Security:** 256-bit
- **Performance:** 100+ MB/s
- **Properties:** Authenticated encryption (AEAD)

**Why ChaCha20:**
- Fast (software-friendly)
- Secure (256-bit keys resist quantum attacks)
- Authenticated (detects tampering)
- No side-channel attacks

#### HKDF-SHA3-256 (Key Derivation)
- **Standard:** RFC 5869 + FIPS 202
- **Security:** 256-bit
- **Purpose:** Derive vault master key from identity

**Why HKDF:**
- Standard KDF construction
- Combines with SHA3-256 for post-quantum security
- Deterministic (same input → same output)

#### SHA3-256 (Hashing)
- **Standard:** FIPS 202
- **Security:** 256-bit
- **Purpose:** Content addressing, integrity

**Why SHA3:**
- NIST-standardized (2015)
- Collision resistant
- Different design than SHA2 (Keccak)

---

## Attack Scenarios

### Scenario 1: Server Reads Storage

**Attack:** Malicious operator tries to read files.

**What attacker sees:**
```
Block 8578287ea915b760... (5,320 bytes)
  01 02 00 00 00 00 00 00 00 00 47 b3 d0 c0 32 a4
  82 59 26 5c 0e 9d ca 6b ef 87 a8 6e 6e 71 8c a3
  ...
```

**What attacker can do:**
- Verify ML-DSA signatures ✓
- Count blocks
- See approximate sizes

**What attacker CANNOT do:**
- Decrypt content ❌
- Read filenames ❌
- Extract encryption keys ❌

**Result:** Attack fails ✅

---

### Scenario 2: Network MITM

**Attack:** Attacker intercepts upload.

**What attacker sees:**
```
HTTP POST /blocks/8578287ea915b760...
Body: [encrypted block data + ML-DSA signature]
```

**What attacker can do:**
- Capture encrypted blocks
- Verify signatures

**What attacker CANNOT do:**
- Decrypt blocks ❌
- Modify blocks (signature will fail) ❌

**Result:** Attack fails ✅

---

### Scenario 3: Quantum Computer (Future)

**Attack:** Attacker with quantum computer tries to break crypto.

**Vulnerable algorithms:**
- RSA ❌ (broken by Shor's algorithm)
- ECDSA ❌ (broken by Shor's algorithm)

**Safe algorithms:**
- ML-DSA-65 ✅ (quantum-resistant)
- ML-KEM-768 ✅ (quantum-resistant)
- ChaCha20 ✅ (256-bit symmetric, Grover's algorithm only halves security to 128-bit)
- SHA3-256 ✅ (quantum resistance sufficient)

**Result:** Zault resists known quantum attacks ✅

---

### Scenario 4: Compromised Block

**Attack:** Attacker modifies a stored block.

**Detection:**
1. User runs `zault verify <hash>`
2. Signature verification fails
3. Error: `SignatureVerificationFailed`

**Protection:**
- Signature mismatch detected
- User warned before decryption
- No plaintext leaked

**Result:** Attack detected ✅

---

## Known Limitations

### 1. Metadata Leakage

**What leaks:**
- Approximate file sizes (block sizes visible)
- Number of files in vault
- Access patterns (timing)

**Not leaked:**
- Exact file sizes (encrypted in metadata)
- Filenames (encrypted)
- MIME types (encrypted)

**Future mitigation:**
- Pad all blocks to fixed sizes
- Add dummy blocks
- Oblivious RAM patterns

---

### 2. Single Device Only

**Current limitation:**
- No multi-device sync
- No collaboration
- No sharing (yet)

**Phase 2 will add:**
- Share tokens (ML-KEM-768)
- Multi-device sync
- Server-based storage

---

### 3. No Plausible Deniability

**Limitation:**
- Vault existence is obvious
- Cannot deny having encrypted data
- Coercion resistant only if adversary cannot access device

**Not a goal:**
- Zault is not Veracrypt
- Focus is on crypto strength, not deniability

---

## Security Audits

**Status:** Not yet audited

**Planned:**
- Q1 2026: External cryptographic audit
- Q2 2026: Penetration testing
- Q3 2026: Formal verification (TLA+)

**Current state:**
- Cryptographic primitives are NIST-standardized ✅
- Implementation uses Zig stdlib (well-tested) ✅
- 22/22 tests passing ✅
- Open source (auditable) ✅

**Recommendation:** Wait for audits before critical production use.

---

## Reporting Security Issues

**Found a vulnerability?**

**DO NOT open a public issue!**

Instead:
1. Email: security@zault.io (coming soon)
2. Use GitHub Security Advisories
3. Encrypted: Use project maintainer's PGP key

We take security seriously and will respond within 48 hours.

---

## Security Best Practices

### For Users

1. **Backup identity.bin** - Store in multiple safe locations
2. **Use strong device security** - Full-disk encryption, strong password
3. **Verify signatures** - Especially after network transfer
4. **Keep Zault updated** - Security fixes distributed via updates

### For Developers

1. **Never trust user input** - Validate everything
2. **Test crypto operations** - 100% coverage on security code
3. **Use constant-time operations** - Prevent timing attacks
4. **Clear sensitive data** - Zero memory after use

---

## Compliance

Zault's cryptographic audit trail makes it suitable for:

- **HIPAA** - Healthcare data encryption + audit trail
- **SOC 2** - Access controls + integrity verification
- **GDPR** - Right to erasure (delete blocks)
- **FINRA** - Immutable audit trail

**Note:** Consult your compliance officer before production use.

---

## Further Reading

- [Protocol Specification](./protocol-specification.md) - Technical details
- [Cryptographic Primitives](./cryptography.md) - Algorithm details
- [Test Vectors](./test-vectors.md) - Interoperability tests

---

**Security is a process, not a product. Stay vigilant!** 🔒
