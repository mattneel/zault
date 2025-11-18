# Zault Roadmap

**Last Updated:** 2025-11-18
**Current Phase:** Phase 1 Complete ✅ - Ready for v0.1.0 Release

---

## Vision

Build the world's most secure, verifiable, and user-friendly post-quantum storage system. Make zero-knowledge encryption accessible to everyone, not just cryptography experts.

## Guiding Principles

1. **Security First** - No compromises on cryptographic correctness
2. **Verifiable by Default** - Everything signed, everything auditable
3. **User Sovereignty** - Users own their data and keys
4. **Simplicity** - Complex crypto, simple UX
5. **Open & Auditable** - Full transparency, no backdoors

---

## Phases

### Phase 0: Pre-Alpha ✅ COMPLETE

**Timeline:** Nov 2025
**Status:** ✅ Complete

- [x] Protocol specification written
- [x] Core cryptographic primitives identified
- [x] Repository structure established
- [x] Documentation framework (mdBook) setup

---

### Phase 1: v0.1.0 Alpha - Foundation ✅ COMPLETE

**Timeline:** Nov 2025 (completed in 1 day!)
**Goal:** Core protocol working end-to-end with local storage
**Status:** ✅ COMPLETE - Ready for Release

#### Milestone 1.1: Core Library ✅ COMPLETE

**Focus:** Cryptographic primitives and data structures

- [x] **Identity management**
  - [x] ML-DSA-65 keypair generation
  - [x] Identity serialization (binary format)
  - [x] Save/load from file
  - [x] Deterministic generation from seed
  - [ ] BIP39 mnemonic backup (deferred to v0.2)
  - [ ] zpub/zprv encoding (deferred to v0.2)

- [x] **Block operations**
  - [x] Block structure and serialization
  - [x] Content addressing (SHA3-256)
  - [x] Block signing and verification (ML-DSA-65)
  - [x] Block data encryption/decryption
  - [ ] Block chain validation (basic implementation, full validation in v0.2)

- [x] **Encryption/Decryption**
  - [x] ChaCha20-Poly1305 wrapper and integration
  - [x] Key derivation (HKDF-SHA3-256)
  - [x] Metadata encryption
  - [x] Content encryption
  - [x] Two-block system (content + metadata)

- [x] **Storage interface**
  - [x] BlockStore interface
  - [x] Local filesystem backend
  - [x] Content-addressed storage
  - [x] Block indexing (directory walking)
  - [x] Atomic writes

**Success Criteria:** ✅ All Met
- All core types compile and pass unit tests ✅
- 22/22 tests passing ✅
- Operations complete in <10ms ✅

#### Milestone 1.2: CLI Foundation ✅ COMPLETE

**Focus:** Professional command-line interface

- [x] **Identity commands**
  - [x] `zault init` - Create new vault
  - [x] `zault --version` - Show version and crypto info
  - [ ] `zault identity show` - Display public key (deferred)
  - [ ] `zault identity export` - Export backup (deferred)
  - [ ] `zault identity import` - Restore from backup (deferred)

- [x] **File operations**
  - [x] `zault add <file>` - Upload file (encrypted)
  - [x] `zault get <hash>` - Download file (decrypted)
  - [x] `zault list` - List files with metadata
  - [ ] `zault rm <hash>` - Delete file (deferred to v0.2)

- [x] **Verification**
  - [x] `zault verify <hash>` - Verify ML-DSA signature
  - [ ] `zault log <hash>` - Show version history (deferred to v0.2)

- [x] **Professional CLI (zig-clap)**
  - [x] Subcommand parsing
  - [x] Global options (--help, --version, --vault)
  - [x] Per-command options (get -o, list --hashes)
  - [x] Per-command help messages
  - [x] Clean error reporting

**Success Criteria:** ✅ All Met
- Can upload, download, and verify files ✅
- CLI has helpful error messages ✅
- Professional formatting and help ✅

#### Milestone 1.3: Documentation & Release ✅ COMPLETE

**Focus:** Documentation and polish for release

- [x] **Documentation**
  - [x] README with examples and comparisons
  - [x] Getting Started guide
  - [x] CLI reference
  - [x] Security model
  - [x] FAQ
  - [x] API documentation (inline)
  - [x] Protocol specification
  - [x] Demo GIF
  - [x] CHANGELOG

- [x] **Developer experience**
  - [x] CI/CD pipeline (GitHub Actions)
  - [x] Automated testing on commit
  - [x] Multi-platform builds (Linux x86/ARM, macOS x86/ARM, Windows)
  - [x] GitHub Pages deployment
  - [x] mdBook with Shiki syntax highlighting

- [x] **Testing**
  - [x] 22/22 unit tests passing
  - [x] Integration tests
  - [x] CI tested locally (act)
  - [x] End-to-end verification

**Deliverables:** ✅ All Complete
- `zault v0.1.0` binary (5 platforms)
- Complete CLI with professional interface
- Comprehensive documentation
- Working CI/CD pipeline

---

### Phase 2: v0.2.0 - Sharing & Sync

**Timeline:** Jan-Mar 2026 (8-12 weeks)
**Goal:** Enable secure sharing and multi-device sync
**Status:** 🔜 Next

#### Milestone 2.1: Share Tokens (Weeks 1-4)

- [ ] **ML-KEM-768 integration**
  - [ ] Key encapsulation for recipients
  - [ ] Share token creation
  - [ ] Share token encryption
  - [ ] Expiration handling

- [ ] **Share CLI commands**
  - [ ] `zault share <hash> --to <pubkey>` - Create share
  - [ ] `zault share <hash> --expires <time>` - Time-limited
  - [ ] `zault receive <token>` - Redeem share
  - [ ] `zault shares list` - Show active shares
  - [ ] `zault shares revoke <token>` - Revoke share

- [ ] **Share token format**
  - [ ] URI scheme (zshare1:...)
  - [ ] QR code generation
  - [ ] Server hint embedding

**Success Criteria:**
- Can share file between two identities
- Expired shares are rejected
- Share tokens work offline (no server)

#### Milestone 2.2: Version History (Weeks 4-7)

- [ ] **DAG operations**
  - [ ] Version chain traversal (use prev_hash)
  - [ ] Branch handling
  - [ ] Merge detection
  - [ ] Diff computation

- [ ] **Version CLI commands**
  - [ ] `zault log <hash>` - Show history
  - [ ] `zault diff <hash> v1 v2` - Compare versions
  - [ ] `zault checkout <hash> <version>` - Restore version
  - [ ] `zault blame <hash>` - Show authorship per block

**Success Criteria:**
- Can track 1000+ versions per file
- Diffs show actual content changes
- Version verification works

#### Milestone 2.3: Server & Sync (Weeks 7-12)

- [ ] **Server implementation**
  - [ ] REST API (PUT/GET/DELETE blocks)
  - [ ] ML-DSA authentication
  - [ ] Rate limiting
  - [ ] Quota management
  - [ ] Health checks

- [ ] **Storage backends**
  - [ ] S3-compatible storage
  - [ ] Backblaze B2
  - [ ] Cloudflare R2
  - [ ] Generic HTTP backend

- [ ] **Sync protocol**
  - [ ] Block discovery
  - [ ] Delta sync (only missing blocks)
  - [ ] Conflict detection
  - [ ] Multi-device coordination

- [ ] **Server CLI commands**
  - [ ] `zault server start` - Run server
  - [ ] `zault remote add <url>` - Add remote
  - [ ] `zault push` - Upload to remote
  - [ ] `zault pull` - Download from remote
  - [ ] `zault sync` - Bidirectional sync

**Success Criteria:**
- Server handles 100+ concurrent clients
- Sync completes in <5s for typical vault
- Can run on commodity VPS (<$5/mo)

**Deliverables:**
- `zault v0.2.0` with sharing and sync
- Self-hostable server
- S3 backend support
- Multi-device documentation

---

### Phase 3: v0.3.0 - Advanced Features

**Timeline:** Apr-Aug 2026 (16 weeks)
**Goal:** Production-ready features and hardening
**Status:** 📋 Planned

#### Milestone 3.1: WASM Client (Weeks 1-5)

- [ ] **Browser compatibility**
  - [ ] Compile core to WASM
  - [ ] IndexedDB storage backend
  - [ ] Web Crypto API integration
  - [ ] Service Worker for offline

- [ ] **Web UI**
  - [ ] File upload/download interface
  - [ ] Share link generation
  - [ ] Identity management
  - [ ] Progress indicators

- [ ] **Browser extension**
  - [ ] Chrome/Firefox extension
  - [ ] Right-click "Share with Zault"
  - [ ] Auto-decrypt share links

**Success Criteria:**
- Runs in all modern browsers
- <2MB WASM bundle size
- Works offline with Service Worker

#### Milestone 3.2: P2P Support (Weeks 5-9)

- [ ] **DHT implementation**
  - [ ] Kademlia routing
  - [ ] Block announcement
  - [ ] Peer discovery
  - [ ] NAT traversal

- [ ] **Direct transfer**
  - [ ] QUIC transport
  - [ ] Stream multiplexing
  - [ ] Resumable transfers

**Success Criteria:**
- Can find peers in <5s
- Direct transfers faster than server
- Works on NAT-restricted networks

#### Milestone 3.3: Security Audit (Weeks 13-16)

- [ ] **External audit**
  - [ ] Hire reputable crypto auditor
  - [ ] Full protocol review
  - [ ] Implementation review
  - [ ] Penetration testing

- [ ] **Remediation**
  - [ ] Fix all critical/high findings
  - [ ] Document medium/low findings
  - [ ] Publish audit report

**Success Criteria:**
- Zero critical vulnerabilities
- Audit report published
- All recommendations addressed

**Deliverables:**
- `zault v0.3.0` release candidate
- WASM client and browser extension
- P2P support
- Security audit report

---

### Phase 4: v1.0.0 - Production Release

**Timeline:** Sep 2026 - Dec 2026 (16 weeks)
**Goal:** Stable, audited, production-ready release
**Status:** 🔮 Future

#### Milestone 4.1: Mobile Apps (Weeks 1-8)

- [ ] **iOS app**
  - [ ] Native UI (SwiftUI)
  - [ ] Zig C API bindings
  - [ ] Keychain integration

- [ ] **Android app**
  - [ ] Native UI (Jetpack Compose)
  - [ ] Zig C API bindings
  - [ ] Keystore integration

#### Milestone 4.2: Enterprise Features (Weeks 8-12)

- [ ] **Team management**
  - [ ] Organization identities
  - [ ] Role-based access control
  - [ ] Audit log exports

#### Milestone 4.3: Final Hardening (Weeks 12-16)

- [ ] **Stability**
  - [ ] Beta testing program
  - [ ] Bug bounty program
  - [ ] 99%+ test coverage

- [ ] **Release prep**
  - [ ] Final security review
  - [ ] Performance benchmarks
  - [ ] Marketing materials

**Deliverables:**
- `zault v1.0.0` stable release
- iOS and Android apps
- Enterprise features
- Complete documentation

---

## Current Status

### ✅ Phase 1 Complete (v0.1.0)

**What's Working:**
- Post-quantum cryptography (ML-DSA-65, ChaCha20-Poly1305)
- Zero-knowledge encryption (two-block system)
- Content-addressed storage
- Professional CLI (zig-clap, 5 commands)
- Comprehensive documentation
- CI/CD with multi-platform builds
- 22/22 tests passing

**What's Ready:**
- Linux (x86_64, ARM64)
- macOS (Intel, Apple Silicon)
- Windows (x86_64)

**Known Limitations:**
- Single-device only (no sync yet)
- No sharing (Phase 2.1)
- No version history (Phase 2.2)
- Not yet audited (Phase 3.3)

### 🔜 Next: Phase 2 (v0.2.0)

**Focus:** Sharing and multi-device sync

**Timeline:** Jan-Mar 2026

**Key Features:**
- Share tokens with ML-KEM-768
- Version history
- Server implementation
- Multi-device sync

---

## Success Metrics

### Technical Metrics

**Current (v0.1.0):**
- ✅ Performance: <10ms for typical operations
- ✅ Security: NIST-standardized algorithms
- ✅ Reliability: 22/22 tests passing
- ✅ Efficiency: <50MB memory usage

**Target (v1.0.0):**
- Zero critical vulnerabilities (after audit)
- 99%+ test coverage
- Support 1TB+ vaults
- <100ms for all operations

### Adoption Metrics

**v0.1.0 Goals:**
- Week 1: 100 GitHub stars
- Month 1: 1,000 downloads
- Month 3: Community feedback
- Identify early adopters

**v1.0.0 Goals:**
- 100,000 active users
- 50+ contributors
- 10+ third-party integrations
- Enterprise pilot customers

---

## Risk Mitigation

### Technical Risks

**Risk:** Security vulnerabilities
**Mitigation:** External audit (Phase 3.3), open source review, comprehensive testing

**Risk:** Platform compatibility
**Mitigation:** Multi-platform CI, cross-compilation testing ✅

**Risk:** Performance issues
**Mitigation:** Benchmarks, profiling, optimization passes

### Project Risks

**Risk:** Low adoption
**Mitigation:** Clear value proposition, excellent documentation ✅, active community building

**Risk:** Maintainer burnout
**Mitigation:** Build contributor community, modular design, good documentation

---

## How to Contribute

See [book/src/contributing.md](book/src/contributing.md) for contribution guidelines.

**Priority Areas for v0.2.0:**
1. ML-KEM-768 share token implementation
2. Version history (prev_hash chain traversal)
3. Server implementation (REST API)
4. Testing and bug reports

---

## Contact & Updates

- **GitHub:** https://github.com/mattneel/zault
- **Discussions:** https://github.com/mattneel/zault/discussions
- **Documentation:** https://mattneel.github.io/zault

---

**Last Updated:** 2025-11-18
**Next Review:** After v0.1.0 release

This roadmap is a living document and will be updated as the project evolves.
