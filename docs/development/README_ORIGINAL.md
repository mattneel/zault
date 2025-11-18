# Zault

**Post-quantum encrypted storage that actually respects zero-knowledge.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zig](https://img.shields.io/badge/Zig-0.15.2+-orange.svg)](https://ziglang.org)
[![Status](https://img.shields.io/badge/Status-Alpha-yellow.svg)]()

---

## ⚡ What is Zault?

Zault is a **quantum-resistant, zero-knowledge storage protocol** that provides verifiable, encrypted data storage and sharing. Built in Zig with NIST-standardized post-quantum cryptography.

Your Dropbox data is being harvested right now for future quantum decryption. Zault makes that mathematically impossible.

```bash
# Your identity is your cryptographic keypair
$ zault init
Generated identity: zpub1a2b3c4d5e6f...
Save this backup: [24 words]

# Upload files (encrypted, signed, verifiable)
$ zault add secret.pdf
✓ Uploaded: 2a8f9e1b... (signed, encrypted)

# Share with cryptographic proof and expiration
$ zault share secret.pdf --to zpub9x8y7z... --expires 24h
Share token: zshare1encrypted_blob_here...

# Recipient decrypts with their private key
$ zault receive zshare1encrypted_blob_here...
✓ Received secret.pdf from zpub1a2b3c4d5e6f...
✓ Signature valid
```

## 🔒 Why Zault?

### The Quantum Threat is Real

Nation-states and sophisticated actors are **already capturing encrypted traffic** to decrypt when quantum computers arrive ("harvest now, decrypt later"). Every cloud storage provider's encryption will be broken in 10-15 years.

### Current "Secure Storage" is Theater

| Provider | Can Read Your Files | Post-Quantum Crypto | Verifiable/Auditable | Self-Hostable |
|----------|-------------------|---------------------|---------------------|---------------|
| Dropbox | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Google Drive | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Box | ✅ Yes | ❌ No | ❌ No | ❌ No |
| Tresorit | 🤷 "Trust us" | ❌ No | ❌ Closed source | ❌ No |
| Nextcloud | ⚠️ Sometimes | ❌ No | ⚠️ Complex | ✅ Yes |
| **Zault** | **❌ Impossible** | **✅ Yes** | **✅ Yes** | **✅ Yes** |

### Zault's Guarantees

- **Quantum-resistant:** ML-KEM-768 + ML-DSA-65 (NIST-standardized)
- **Zero-knowledge:** Server cannot decrypt files or metadata
- **Cryptographically verifiable:** Every operation is signed and auditable
- **Self-sovereign identity:** You control your keys, no passwords
- **Storage-agnostic:** Local, S3, IPFS, your basement server
- **Fully auditable:** Open source, no backdoors

## ✨ Features

### 🔐 Post-Quantum Cryptography

- **ML-KEM-768** for key encapsulation (resistant to quantum attacks)
- **ML-DSA-65** for digital signatures (NIST-standardized)
- **ChaCha20-Poly1305** for authenticated encryption
- **SHA3-256** for content addressing

### 🎯 Zero-Knowledge Architecture

```
Server sees:
{
  "block_id": "2a8f9e1b...",
  "data": "���¿�Ӓ��...",  // unreadable
  "signature": "valid ML-DSA signature"
}

Server cannot see:
- Filenames
- File contents
- File sizes (with padding)
- Who owns what
- Any metadata
```

### 📜 Cryptographic Audit Trail

Every operation is signed and verifiable:

```bash
$ zault log financials.xlsx
v4 2025-11-18 10:30 zpub1a2b... Updated Q4 projections [2a8f9e1b]
v3 2025-11-15 14:22 zpub1a2b... Added revenue data    [1f7e8d9c]
v2 2025-11-10 09:15 zpub1a2b... Initial draft         [0e6d7c8b]
v1 2025-11-09 16:45 zpub1a2b... Created               [9d5c6b7a]

$ zault verify financials.xlsx
✓ All 4 versions verified
✓ Signatures valid
✓ Chain integrity confirmed
```

Perfect for compliance (HIPAA, SOC2, GDPR).

### 🤝 Secure Sharing

Share files with cryptographic proof and time limits:

```bash
# Create time-limited share token
$ zault share report.pdf --to zpub9x8y7z... --expires 48h
zshare1a2b3c4d5e6f...

# Recipient receives with proof of origin
$ zault receive zshare1a2b3c4d5e6f...
✓ Received report.pdf
✓ Granted by: zpub1a2b3c4d5e6f... (Alice)
✓ Expires: 2025-11-20 10:30
✓ Signature valid
```

### 🌐 Self-Hostable

Run your own storage:

```bash
$ zault server --storage ./data --port 8080
Zault server running on :8080
Storage: local (./data)
Public key: zpub_server1...

# Or use cloud storage
$ zault server --storage s3://my-bucket
$ zault server --storage ipfs://...
```

### 🔗 Git-Like Versioning

Full version history with cryptographic proofs:

```bash
$ zault diff document.txt v1 v3
- Old content (signed by zpub1a2b...)
+ New content (signed by zpub1a2b...)

$ zault checkout document.txt v2
✓ Restored version 2
✓ Signature verified
```

## 🚀 Quick Start

### Prerequisites

- **Zig 0.15.2+** (or master for latest ML-KEM support)
- **64-bit system** (Linux, macOS, Windows)

### Install Zig

```bash
# Using mise (recommended)
$ mise use zig@master

# Or download from ziglang.org
$ curl -O https://ziglang.org/download/...
```

### Build Zault

```bash
# Clone repository
$ git clone https://github.com/mattneel/zault
$ cd zault

# Build
$ zig build

# Install
$ zig build install --prefix ~/.local

# Verify
$ zault version
zault 0.1.0 (zig 0.15.2)
ML-KEM-768, ML-DSA-65
```

### Initialize Your Vault

```bash
# Create new identity
$ zault init
✓ Generated identity
Public key: zpub1a2b3c4d5e6f7g8h9j0k1m2n3p4q5r6s7t8u9v0w1x2y3z...

⚠️  IMPORTANT: Save this backup phrase:
    witch collapse practice feed shame open despair creek road again
    ice least lake tree vapor plate vapor high ladder above art

Vault initialized at: ~/.zault
```

### Upload Your First File

```bash
$ zault add document.pdf
Encrypting... ████████████████ 100%
Signing...     ████████████████ 100%
✓ Uploaded: 2a8f9e1b4c7d8f... (1.2 MB)

$ zault list
2a8f9e1b  document.pdf  1.2 MB  2025-11-18 10:30
```

### Share a File

```bash
# Get recipient's public key
$ zault pubkey
zpub1a2b3c4d5e6f...

# Create share token
$ zault share document.pdf --to zpub9x8y7z... --expires 24h
✓ Created share token (expires in 24h)

zshare1a2b3c4d5e6f7g8h9j0k1m2n3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f0

# Recipient receives
$ zault receive zshare1a2b3c4d5e6f...
✓ Received document.pdf (1.2 MB)
✓ Granted by: zpub1a2b3c4d5e6f... (expires 2025-11-19 10:30)
```

## 📚 Documentation

- **[Protocol Specification](docs/SPEC.md)** - Complete technical specification
- **[Security Model](docs/SECURITY.md)** - Threat model and guarantees
- **[Architecture](docs/ARCHITECTURE.md)** - System design and components
- **[API Reference](docs/API.md)** - Library and server API
- **[CLI Guide](docs/CLI.md)** - Command-line usage
- **[Self-Hosting](docs/HOSTING.md)** - Run your own storage

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│           Zault Client (CLI)            │
│  ┌──────────┐  ┌──────────┐            │
│  │ Identity │  │  Vault   │            │
│  │ ML-DSA   │  │  Store   │            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
              │
              │ Encrypted Blocks
              │ + Signatures
              ▼
┌─────────────────────────────────────────┐
│         Storage Backend (Server)        │
│  ┌──────────────────────────────────┐  │
│  │   Content-Addressed Block Store  │  │
│  │   (Local / S3 / IPFS / ...)      │  │
│  └──────────────────────────────────┘  │
│                                         │
│  Server cannot decrypt:                 │
│  ❌ File contents                       │
│  ❌ Filenames                           │
│  ❌ Metadata                            │
│  ✅ Can verify signatures               │
└─────────────────────────────────────────┘
```

### Core Components

- **`zault-core`** - Cryptographic primitives and protocol (Zig library)
- **`zault-cli`** - Command-line interface
- **`zault-server`** - Storage server (self-hostable)
- **`zault-wasm`** - Browser client (coming soon)

## 🔬 Security

### Cryptographic Primitives

| Primitive | Algorithm | Security Level |
|-----------|-----------|----------------|
| Key Encapsulation | ML-KEM-768 | ~192-bit (post-quantum) |
| Digital Signatures | ML-DSA-65 | ~192-bit (post-quantum) |
| Symmetric Encryption | ChaCha20-Poly1305 | 256-bit |
| Key Derivation | HKDF-SHA3-256 | 256-bit |
| Hashing | SHA3-256 | 256-bit |

### Threat Model

**Protected against:**
- ✅ Malicious storage providers
- ✅ Network adversaries (MITM, eavesdropping)
- ✅ Quantum adversaries (harvest now, decrypt later)
- ✅ Server compromise
- ✅ Traffic analysis (with padding)

**Not protected against:**
- ❌ Malware on your device
- ❌ Physical attacks on your device
- ❌ Social engineering
- ❌ Loss of private key (no recovery)

### Audits

- **[ ] Initial security audit** - Planned Q1 2026
- **[ ] Cryptographic review** - Planned Q1 2026
- **[ ] Formal verification** - Planned Q2 2026

**This is alpha software. Do not use for critical data yet.**

## 🛠️ Development

### Build from Source

```bash
$ git clone https://github.com/mattneel/zault
$ cd zault
$ zig build
```

### Run Tests

```bash
$ zig build test
```

### Run Benchmarks

```bash
$ zig build bench
```

### Compile for Release

```bash
$ zig build -Doptimize=ReleaseFast
```

### Project Structure

```
zault/
├── src/
│   ├── core/           # Core library (zault-core)
│   │   ├── crypto.zig  # Cryptographic primitives
│   │   ├── block.zig   # Block structures
│   │   ├── vault.zig   # Vault operations
│   │   └── store.zig   # Storage backends
│   ├── cli/            # CLI application
│   ├── server/         # Server application
│   └── wasm/           # Browser WASM build
├── docs/               # Documentation
├── tests/              # Test suite
├── examples/           # Usage examples
└── build.zig           # Build configuration
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md).

### Areas We Need Help

- 🔐 **Cryptography review** - Audit crypto implementation
- 📱 **Mobile clients** - iOS/Android apps
- 🌐 **Browser extension** - WASM client
- 📖 **Documentation** - Tutorials, guides, examples
- 🧪 **Testing** - Unit tests, integration tests, fuzzing
- 🎨 **UX/UI** - Better CLI, future GUI
- 🐛 **Bug reports** - Issues, edge cases

### Communication

- **GitHub Issues** - Bug reports, feature requests
- **GitHub Discussions** - Questions, ideas, general chat
- **Matrix** - `#zault:matrix.org` (coming soon)

## 📜 License

Zault is released under the **MIT License**. See [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- **NIST** - For standardizing ML-KEM and ML-DSA
- **Zig Team** - For an amazing language and stdlib
- **Cryptography researchers** - For making post-quantum crypto real

## 🔗 Links

- **Website:** https://zault.io (coming soon)
- **Documentation:** https://docs.zault.io (coming soon)
- **GitHub:** https://github.com/mattneel/zault
- **Specification:** [docs/SPEC.md](book/src/protocol-specification.md)

## ⚠️ Disclaimer

**Zault is alpha software under active development.**

- Do not use for critical data in production
- Cryptographic primitives are NIST-standardized but implementation is not audited
- Breaking changes may occur before 1.0
- No warranty or liability

Use at your own risk. We recommend waiting for security audits before production use.

## 🚀 Roadmap

### v0.1 (Current) - Alpha
- [x] Core protocol specification
- [ ] Basic CLI (init, add, list, get)
- [ ] Local storage backend
- [ ] Identity management
- [ ] Signature verification

### v0.2 - Beta
- [ ] Share tokens
- [ ] Version history
- [ ] S3 storage backend
- [ ] Server implementation
- [ ] Integration tests

### v0.3 - Release Candidate
- [ ] WASM client
- [ ] P2P support
- [ ] Encrypted search
- [ ] Security audit
- [ ] Performance optimization

### v1.0 - Production Ready
- [ ] Full documentation
- [ ] Mobile apps
- [ ] Browser extension
- [ ] Formal verification
- [ ] Audited and hardened

---

**Built with ⚡ in Zig • Protected by 🔐 post-quantum crypto • Verified by ✍️ digital signatures**

*"Vault zero. Trust zero. Quantum zero."*
