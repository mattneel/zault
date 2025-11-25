# Zault ⚡🔒

**Post-quantum encrypted storage and secure P2P messaging.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zig](https://img.shields.io/badge/Zig-0.16.0+-orange.svg)](https://ziglang.org)
[![Tests](https://img.shields.io/badge/Tests-34%2F34-brightgreen.svg)]()
[![PWA Tests](https://img.shields.io/badge/PWA_Tests-41%2F41-brightgreen.svg)]()
[![Release](https://img.shields.io/badge/Release-v0.2.0-blue.svg)](https://github.com/mattneel/zault/releases/tag/v0.2.0)
[![Live](https://img.shields.io/badge/Live-zault.chat-green.svg)](https://zault.chat)

```bash
# CLI: Share files with post-quantum security
$ zault share secret.pdf --to <recipient_pubkey> --expires 1800000000 --export share.zault
✓ Share token created (ML-KEM-768)

# PWA: P2P encrypted chat at zault.chat
# No accounts. No servers reading your messages. Post-quantum secure.
```

---

## ⚡ What is Zault?

**Your cloud storage provider can read your files.** Even "encrypted" ones.

**Your messaging app can read your messages.** Even "end-to-end encrypted" ones (they hold the keys).

**Nation-states are harvesting encrypted data NOW** to decrypt when quantum computers arrive.

Zault makes that **cryptographically infeasible** with:
- **ML-KEM-768** (Kyber-768, NIST FIPS 203) - Post-quantum key encapsulation
- **ML-DSA-65** (Dilithium, NIST FIPS 204) - Post-quantum digital signatures
- **ChaCha20-Poly1305** (RFC 8439) - Authenticated encryption
- **Zero-knowledge** - Server never receives decryption keys
- **True E2E** - Keys generated and stored only on your device

Built in Zig with **NIST-standardized post-quantum cryptography**.

---

## 🌐 Try It Now

### [zault.chat](https://zault.chat) - Post-Quantum P2P Chat

- **No accounts** - Your identity is a cryptographic keypair
- **No servers reading messages** - E2E encrypted, decrypted only in your browser
- **Post-quantum secure** - ML-KEM-768 for key exchange
- **Offline-first** - Works without network, syncs when connected
- **PWA** - Install on any device

---

## 🔥 Why Zault?

### Current "Secure" Solutions are Security Theater

| Provider | Can Read Data | Post-Quantum | True E2E | Open Source |
|----------|--------------|--------------|----------|-------------|
| Dropbox | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Google Drive | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Signal | 🤷 Claims E2E | ❌ No | ⚠️ Server-mediated | ✅ Yes |
| WhatsApp | 🤷 "Trust us" | ❌ No | ⚠️ Meta owns keys | ❌ No |
| **Zault** | **❌ Impossible** | **✅ Yes** | **✅ Yes** | **✅ Yes** |

### Zault's Guarantees

- **Quantum-resistant:** ML-DSA-65 + ML-KEM-768 (NIST FIPS 203/204)
- **Zero-knowledge:** Server cannot decrypt files or messages
- **True E2E:** Keys never leave your device
- **Verifiable:** All data cryptographically signed
- **Open source:** Auditable Zig + TypeScript

---

## ✨ Features

### 🔐 Post-Quantum Cryptography

- **ML-DSA-65** - Digital signatures (quantum-resistant)
- **ML-KEM-768** - Key encapsulation (quantum-resistant)
- **ChaCha20-Poly1305** - Authenticated encryption
- **SHA3-256** - Content addressing
- **HKDF-SHA3-256** - Key derivation

### 📦 libzault - C FFI

Embed post-quantum crypto in any language:

```c
#include <zault.h>

// Generate identity (ML-DSA-65 + ML-KEM-768 keypairs)
ZaultIdentity* id = zault_identity_generate();

// Encrypt message to recipient
zault_encrypt_message(id, recipient_kem_pk, 1184,
                      plaintext, len, ciphertext, &out_len);

// Sign data
zault_sign(id, data, data_len, signature, &sig_len);
```

### 🌐 WASM - Browser Integration

```javascript
import { Zault } from './zault.js';

await Zault.init();
const alice = Zault.generateIdentity();
const ciphertext = Zault.encryptMessage(alice, bobPubKey, "Hello!");
```

### 💬 PWA - P2P Encrypted Chat

- **1:1 Chat** - Direct encrypted messaging
- **Group Chat** - Shared symmetric keys, key rotation on member removal
- **Offline Sync** - CRDT-based eventual consistency
- **QR Sharing** - Split QR codes for identity exchange
- **41 E2E Tests** - Full Playwright test coverage

---

## 🚀 Quick Start

### Option 1: Use the PWA

Visit [zault.chat](https://zault.chat) - no installation required.

### Option 2: CLI Installation

```bash
# Download binary
# From: https://github.com/mattneel/zault/releases/latest

# Or build from source
git clone https://github.com/mattneel/zault
cd zault
zig build -Doptimize=ReleaseFast
zig build install --prefix ~/.local
```

### Option 3: Library Integration

```bash
# Build libzault
zig build

# Outputs:
# - zig-out/lib/libzault.so (shared)
# - zig-out/lib/libzault_static.a (static)
# - zig-out/include/zault.h (header)
# - zig-out/bin/zault.wasm (WebAssembly)
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Applications                          │
├─────────────┬─────────────┬─────────────┬──────────────────┤
│   CLI       │   PWA       │   WASM      │   Your App       │
│  (Zig)      │ (SolidJS)   │ (Browser)   │   (C/C++/...)    │
├─────────────┴─────────────┴─────────────┴──────────────────┤
│                        libzault                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Identity │ Vault │ Sharing │ Message Crypto │ FFI  │   │
│  └─────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────┤
│                    Crypto Primitives                         │
│  ML-DSA-65 │ ML-KEM-768 │ ChaCha20-Poly1305 │ SHA3-256    │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧪 Development

### Core Library

```bash
zig build              # Build everything
zig build test         # Run all tests (FFI, fuzz, NIST KAT)
zig build run -- init  # Run CLI
```

### PWA

```bash
cd pwa
bun install
bun run dev            # Development server
bun run build          # Production build
bunx playwright test   # E2E tests (41 tests)
```

### Build Outputs

| Output | Description |
|--------|-------------|
| `zig-out/bin/zault` | CLI binary |
| `zig-out/lib/libzault.so` | Shared library |
| `zig-out/lib/libzault_static.a` | Static library |
| `zig-out/include/zault.h` | C header |
| `zig-out/bin/zault.wasm` | WebAssembly module |

---

## 🚀 Roadmap

### v0.2.0 - Sharing & Chat ✅ RELEASED

- [x] ML-KEM-768 post-quantum key encapsulation
- [x] File sharing (offline workflow)
- [x] libzault C FFI
- [x] WASM build target
- [x] PWA with P2P chat
- [x] 1:1 encrypted messaging
- [x] Group chat with key rotation
- [x] Offline sync (CRDT)
- [x] Live deployment at zault.chat

### v0.3.0 - Server & Sync (Planned)

- [ ] HTTP server for block storage
- [ ] S3-compatible backend
- [ ] Multi-device sync protocol
- [ ] Message history persistence

### v1.0.0 - Production Ready (Planned)

- [ ] External security audit
- [ ] Mobile apps (iOS/Android)
- [ ] Enterprise features

---

## 📚 Documentation

- **[Protocol Specification](book/src/protocol-specification.md)** - Cryptographic details
- **[Security Model](book/src/security-model.md)** - Threat model and guarantees
- **[libzault Guide](book/src/libzault.md)** - C FFI documentation
- **[WASM Guide](book/src/wasm.md)** - Browser integration
- **[PWA Guide](pwa/README.md)** - Chat app development

---

## ⚠️ Security Status

**What's Working:**
- ✅ Post-quantum crypto (ML-DSA-65, ML-KEM-768)
- ✅ E2E encryption (keys never leave device)
- ✅ NIST KAT test vectors
- ✅ Fuzz testing
- ✅ 75+ automated tests

**What's Pending:**
- ⚠️ External security audit (planned)
- ⚠️ Formal verification (in progress)

**Recommended for:**
- Learning post-quantum cryptography
- Personal/hobby projects
- Non-critical communications

**NOT recommended yet for:**
- Regulated data (HIPAA, SOC2)
- High-value secrets
- Life-safety applications

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

**Built with ⚡ Zig • Protected by 🔒 post-quantum crypto • Live at 🌐 [zault.chat](https://zault.chat)**

*"Vault zero. Trust zero. Quantum zero."*
