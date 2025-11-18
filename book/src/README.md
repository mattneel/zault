# Zault Documentation

Welcome to the Zault documentation!

Zault is a **post-quantum secure, zero-knowledge storage system** that provides verifiable, encrypted data storage with cryptographic proof of authenticity.

---

## Quick Links

- **[Getting Started](./getting-started.md)** - Install and run your first vault
- **[CLI Reference](./cli-reference.md)** - Complete command documentation
- **[Security Model](./security-model.md)** - Understand threat model and guarantees
- **[FAQ](./faq.md)** - Common questions answered

---

## What is Zault?

Zault is encrypted storage that:
- **Server cannot read** - True zero-knowledge encryption
- **Quantum-resistant** - Uses post-quantum cryptography (ML-DSA-65)
- **Cryptographically verifiable** - Every operation is signed
- **Self-sovereign** - You control your keys, no passwords

---

## Why Zault?

### The Quantum Threat

Nation-states and sophisticated actors are **already capturing encrypted traffic** to decrypt when quantum computers arrive ("harvest now, decrypt later").

**Every cloud storage provider's encryption will be broken in 10-15 years.**

Zault uses **post-quantum cryptography** - resistant to attacks from quantum computers.

### True Zero-Knowledge

Most "encrypted" storage providers can read your files. They have the keys.

**Zault is different:**
- Encryption keys never leave your device
- Server gets only encrypted blobs
- Mathematically impossible to decrypt without your identity

---

## Key Features

### 🔐 Post-Quantum Cryptography

- **ML-DSA-65** - Digital signatures (NIST FIPS 204)
- **ChaCha20-Poly1305** - Authenticated encryption
- **HKDF-SHA3-256** - Key derivation
- **SHA3-256** - Content addressing

### 🎯 Zero-Knowledge Design

```
Server sees:
{
  "block_id": "8578287ea915b760...",
  "data": "���¿�Ӓ��...",  ← Encrypted gibberish
  "signature": "✓ Valid ML-DSA-65 signature"
}

Server CANNOT see:
- Filenames (encrypted)
- Contents (encrypted)
- Sizes (encrypted)
- MIME types (encrypted)
```

### 📜 Verifiable Operations

Every block is signed with ML-DSA-65:
- Prove authorship
- Detect tampering
- Audit trail
- Compliance-ready

---

## How to Use This Documentation

### New Users

1. [Getting Started](./getting-started.md) - Install and create your first vault
2. [CLI Reference](./cli-reference.md) - Learn all commands
3. [Security Model](./security-model.md) - Understand what Zault protects

### Developers

1. [Architecture](./architecture.md) - System design
2. [API Reference](./api-reference.md) - Library usage
3. [Protocol Specification](./protocol-specification.md) - Technical details

### Security Researchers

1. [Security Model](./security-model.md) - Threat model
2. [Cryptographic Primitives](./cryptography.md) - Algorithm details
3. [Test Vectors](./test-vectors.md) - Interoperability

---

## Quick Example

```bash
# Initialize vault
$ zault init
✓ Vault initialized

# Add encrypted file
$ zault add secrets.txt
✓ File added
Hash: 8578287ea915b760...

# List files (decrypted metadata)
$ zault list
Files in vault: 1
Filename      Size Type        Hash
secrets.txt     27 text/plain  8578287ea915b760

# Retrieve and decrypt
$ zault get 8578287e... output.txt
✓ File retrieved: output.txt
```

---

## Documentation Structure

### User Guide
- [Getting Started](./getting-started.md)
- [CLI Reference](./cli-reference.md)
- [FAQ](./faq.md)

### Protocol
- [Specification](./protocol-specification.md)
- [Security Model](./security-model.md)
- [Cryptographic Primitives](./cryptography.md)

### Developer Guide
- [Architecture](./architecture.md)
- [API Reference](./api-reference.md)
- [Contributing](./contributing.md)

### Reference
- [Wire Format](./wire-format.md)
- [Test Vectors](./test-vectors.md)

---

## Status

- **Version:** v0.1.0-alpha
- **Status:** Alpha (usable but not yet audited)
- **Tests:** 22/22 passing ✅
- **Lines:** 1,593 (core + CLI)
- **License:** MIT

---

## Get Help

- **GitHub Issues:** Bug reports and feature requests
- **Discussions:** Questions and ideas
- **Security:** security@zault.io (for vulnerabilities)

---

**Ready to get started?** → [Getting Started Guide](./getting-started.md)

---

*"Vault zero. Trust zero. Quantum zero."*
