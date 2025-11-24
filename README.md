# Zault ⚡🔒

**Post-quantum encrypted storage with secure file sharing.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zig](https://img.shields.io/badge/Zig-0.16.0+-orange.svg)](https://ziglang.org)
[![Tests](https://img.shields.io/badge/Tests-34%2F34-brightgreen.svg)]()
[![Release](https://img.shields.io/badge/Release-v0.2.0-blue.svg)](https://github.com/mattneel/zault/releases/tag/v0.2.0)

```bash
# Share files with post-quantum security
$ zault share secret.pdf --to <recipient_pubkey> --expires 1800000000 --export share.zault
✓ Share token created (ML-KEM-768)
✓ Blocks exported

$ zault receive <token> -o secret.pdf
✓ File retrieved and decrypted
```

---

## ⚡ What is Zault?

**Your cloud storage provider can read your files.** Even "encrypted" ones.

**Nation-states are harvesting encrypted data NOW** to decrypt when quantum computers arrive.

Zault makes that **cryptographically infeasible** (under standard assumptions for ML-KEM-768/ML-DSA-65) with:
- **ML-KEM-768** (Kyber-768, NIST FIPS 203) - Post-quantum key encapsulation
- **ML-DSA-65** (Dilithium, NIST FIPS 204) - Post-quantum digital signatures
- **ChaCha20-Poly1305** (RFC 8439) - Authenticated encryption
- **Zero-knowledge** - Server never receives decryption keys
- **File sharing** - Secure, quantum-safe sharing

Built in Zig with **NIST-standardized post-quantum cryptography**.

---

## 🔥 Why Zault?

### Current "Secure Storage" is Security Theater

| Provider | Can Read Files | Post-Quantum | File Sharing | Zero-Knowledge |
|----------|---------------|--------------|--------------|----------------|
| Dropbox | ✅ Yes | ❌ No | ✅ Yes | ❌ No |
| Google Drive | ✅ Yes | ❌ No | ✅ Yes | ❌ No |
| ProtonDrive | 🤷 Claims | ❌ No | ⚠️ Limited | ⚠️ Claims |
| Tresorit | 🤷 "Trust us" | ❌ No | ✅ Yes | ❌ Closed source |
| **Zault** | **❌ E2E Encrypted** | **✅ Yes** | **✅ Yes** | **✅ Yes** |

### Zault's Guarantees

- **Quantum-resistant:** ML-DSA-65 + ML-KEM-768 (NIST FIPS 203/204)
- **Zero-knowledge:** Server cannot decrypt files or metadata
- **Secure sharing:** ML-KEM-768 key encapsulation
- **Verifiable:** All blocks cryptographically signed
- **Open source:** 2,600 lines of auditable Zig

---

## ✨ Features

### 🔐 Post-Quantum Cryptography

- **ML-DSA-65** - Digital signatures (quantum-resistant)
- **ML-KEM-768** - Key encapsulation for sharing (quantum-resistant)
- **ChaCha20-Poly1305** - Authenticated encryption
- **SHA3-256** - Content addressing

### 🎯 Zero-Knowledge Architecture

Server sees only encrypted blobs:
```json
{
  "block_id": "8578287e...",
  "data": "���¿�Ӓ��...",
  "signature": "✓ Valid"
}
```

**Server CANNOT see:**
- File contents (encrypted with ChaCha20-Poly1305)
- Filenames (encrypted in metadata blocks)
- Encryption keys (never transmitted)
- MIME types (encrypted in metadata)

**Server CAN see:**
- Number of blocks stored
- Block sizes (reveals approximate file sizes)
- Access patterns (timing, frequency)

**Note:** True size hiding would require fixed-size blocks with padding (planned feature).

### 🤝 Secure File Sharing (v0.2.0)

```bash
# Alice shares with Bob
$ zault pubkey  # Bob gets his ML-KEM public key
$ zault share <file_hash> --to <bob_pubkey> --expires 1900000000 --export share.zault

# Bob receives
$ zault import share.zault
$ zault receive <token> -o received.pdf
✓ File decrypted!
```

**Post-quantum secure. Zero-knowledge. Offline sharing workflow** (export/import via files, no always-online server requirement).

---

## 🚀 Quick Start

### Install

```bash
# Download binary for your platform
# From: https://github.com/mattneel/zault/releases/latest

# Or build from source
git clone https://github.com/mattneel/zault
cd zault
zig build -Doptimize=ReleaseFast
zig build install --prefix ~/.local
```

### First Vault

```bash
$ zault init
✓ Vault initialized
✓ Identity generated

$ zault add secret.pdf
✓ File added (encrypted)
Hash: 8578287e...

$ zault list
Filename      Size Type            Hash
secret.pdf    1.2M application/pdf 8578287e...

$ zault get 8578287e... -o output.pdf
✓ File retrieved (decrypted)
```

---

## 🚀 Roadmap

### v0.2.0 - Sharing ✅ RELEASED (2025-11-23)
- [x] ML-KEM-768 post-quantum key encapsulation
- [x] Share token creation/redemption
- [x] Offline sharing workflow
- [x] Block export/import
- [x] Commands: share, receive, import, pubkey

### v0.3.0 - Server & Sync (Planned: Q1 2026)
- [ ] HTTP server for block storage
- [ ] S3-compatible backend
- [ ] Multi-device sync protocol
- [ ] Remote commands (push, pull, sync)
- [ ] Version history and diffs

### v0.4.0 - Advanced Features (Planned: Q2 2026)
- [ ] WASM client (browser)
- [ ] P2P support (DHT-based)
- [ ] Encrypted search
- [ ] Performance optimization

### v1.0.0 - Production Ready (Planned: Q3 2026)
- [ ] External security audit
- [ ] Mobile apps (iOS/Android)
- [ ] Enterprise features
- [ ] Fully audited and hardened

---

## ⚠️ Alpha Status - v0.2.0

**What's Working:**
- ✅ Zero-knowledge encryption (34/34 tests)
- ✅ Post-quantum crypto (ML-DSA-65, ML-KEM-768)
- ✅ File sharing (offline workflow)
- ✅ Professional CLI
- ✅ Multi-platform (5 platforms)

**What's Missing:**
- ⚠️ **Not yet audited** by external security firm (planned v1.0)
- ⚠️ **No server/sync** (planned v0.3.0)
- ⚠️ **Offline sharing only** (export/import workflow, no automatic sync)

**Recommended for:**
- Experimentation and learning about post-quantum cryptography
- Hobby projects and personal backups
- Non-irreplaceable data
- Understanding zero-knowledge architecture

**NOT recommended yet for:**
- Regulated/compliance data (HIPAA, SOC2, GDPR) - wait for audit
- Safety-critical or high-value data
- Production deployments
- Irreplaceable data without other backups

**Why:** Alpha software, not yet independently audited. Cryptography is NIST-standardized but implementation needs external review (planned v1.0).

---

## 📚 Documentation

- **[Quick Start](https://mattneel.github.io/zault/getting-started.html)**
- **[CLI Reference](https://mattneel.github.io/zault/cli-reference.html)**
- **[Security Model](https://mattneel.github.io/zault/security-model.html)**
- **[FAQ](https://mattneel.github.io/zault/faq.html)**
## 🧪 Development & Testing

- `zig test src/root.zig --summary fail` – includes Zig's built-in fuzz harnesses (block serialization/CLI parsing) plus NIST/BoringSSL KAT coverage for ML-DSA-65, ML-KEM-768, ChaCha20-Poly1305, SHA3-256, and HKDF-SHA3-256.

--- 

**Built with ⚡ Zig • Protected by 🔒 post-quantum crypto • Shared with 🤝 ML-KEM-768**

*"Vault zero. Trust zero. Quantum zero. Share secure."*
