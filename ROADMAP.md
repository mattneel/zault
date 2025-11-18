# Zault Roadmap

**Last Updated:** 2025-11-18  
**Current Phase:** v0.1 Alpha - Foundation

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

### Phase 0: Pre-Alpha (Completed ✅)
**Timeline:** Nov 2025  
**Status:** ✅ Complete

- [x] Protocol specification written
- [x] Core cryptographic primitives identified
- [x] Repository structure established
- [x] Documentation framework (mdBook) setup

---

### Phase 1: v0.1 Alpha - Foundation
**Timeline:** Nov 2025 - Jan 2026 (8 weeks)  
**Goal:** Core protocol working end-to-end with local storage

#### Milestone 1.1: Core Library (Weeks 1-3)
**Focus:** Cryptographic primitives and data structures

- [ ] **Identity management**
  - [ ] ML-DSA keypair generation
  - [ ] Identity serialization (zpub/zprv format)
  - [ ] BIP39 mnemonic backup
  - [ ] Import/export functions
  
- [ ] **Block operations**
  - [ ] Block structure and serialization
  - [ ] Content addressing (SHA3-256)
  - [ ] Block signing and verification
  - [ ] Block chain validation

- [ ] **Encryption/Decryption**
  - [ ] ChaCha20-Poly1305 wrapper
  - [ ] Key derivation (HKDF)
  - [ ] Metadata encryption
  - [ ] Content encryption

- [ ] **Storage interface**
  - [ ] BlockStore trait/interface
  - [ ] Local filesystem backend
  - [ ] Content-addressed storage
  - [ ] Block indexing

**Success Criteria:**
- All core types compile and pass unit tests
- 100% test coverage on crypto operations
- Benchmarks show <5ms per block operation

#### Milestone 1.2: CLI Foundation (Weeks 3-5)
**Focus:** Basic command-line interface

- [ ] **Identity commands**
  - [ ] `zault init` - Create new vault
  - [ ] `zault identity show` - Display public key
  - [ ] `zault identity export` - Export backup
  - [ ] `zault identity import` - Restore from backup

- [ ] **File operations**
  - [ ] `zault add <file>` - Upload file
  - [ ] `zault get <hash>` - Download file
  - [ ] `zault list` - List files
  - [ ] `zault rm <hash>` - Delete file

- [ ] **Verification**
  - [ ] `zault verify <hash>` - Verify signature
  - [ ] `zault log <hash>` - Show version history

**Success Criteria:**
- Can upload, download, and verify a file
- CLI has helpful error messages
- Man pages and `--help` output complete

#### Milestone 1.3: Testing & Documentation (Weeks 6-8)
**Focus:** Quality and usability

- [ ] **Test suite**
  - [ ] Unit tests for all modules
  - [ ] Integration tests (end-to-end flows)
  - [ ] Property-based tests (round-trip encoding)
  - [ ] Test vectors for interoperability

- [ ] **Documentation**
  - [ ] API documentation (autodoc)
  - [ ] CLI usage guide
  - [ ] Protocol spec in mdBook
  - [ ] Architecture diagrams
  - [ ] Getting started tutorial

- [ ] **Developer experience**
  - [ ] CI/CD pipeline (GitHub Actions)
  - [ ] Automated testing on commit
  - [ ] Release builds for Linux/macOS/Windows
  - [ ] Installation script

**Success Criteria:**
- 80%+ test coverage
- All public APIs documented
- CI passing on all platforms
- First alpha release published

**Deliverables:**
- `zault v0.1.0` binary
- Complete CLI for local storage
- Comprehensive test suite
- Basic documentation

---

### Phase 2: v0.2 Beta - Sharing & Sync
**Timeline:** Feb 2026 - Apr 2026 (12 weeks)  
**Goal:** Enable secure sharing and multi-device sync

#### Milestone 2.1: Share Tokens (Weeks 1-4)

- [ ] **ML-KEM integration**
  - [ ] Key encapsulation for recipients
  - [ ] Share token creation
  - [ ] Share token encryption
  - [ ] Expiration handling

- [ ] **Share CLI commands**
  - [ ] `zault share <file> --to <pubkey>` - Create share
  - [ ] `zault share <file> --expires <time>` - Time-limited
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
  - [ ] Version chain traversal
  - [ ] Branch handling
  - [ ] Merge detection
  - [ ] Diff computation

- [ ] **Version CLI commands**
  - [ ] `zault log <file>` - Show history
  - [ ] `zault diff <file> v1 v2` - Compare versions
  - [ ] `zault checkout <file> <version>` - Restore version
  - [ ] `zault blame <file>` - Show authorship

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

### Phase 3: v0.3 RC - Advanced Features
**Timeline:** May 2026 - Aug 2026 (16 weeks)  
**Goal:** Production-ready features and hardening

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
  - [ ] Password manager integration

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
  - [ ] Bandwidth limiting

- [ ] **P2P CLI commands**
  - [ ] `zault p2p start` - Start DHT node
  - [ ] `zault p2p peers` - List peers
  - [ ] `zault p2p send <file> <peer>` - Direct send
  - [ ] `zault p2p receive` - Listen for transfers

**Success Criteria:**
- Can find peers in <5s
- Direct transfers faster than server
- Works on NAT-restricted networks

#### Milestone 3.3: Encrypted Search (Weeks 9-12)

- [ ] **Index encryption**
  - [ ] Searchable encryption scheme
  - [ ] Encrypted filename index
  - [ ] Fuzzy search support
  - [ ] Tag system

- [ ] **Search CLI commands**
  - [ ] `zault search <query>` - Search files
  - [ ] `zault tag <file> <tags>` - Add tags
  - [ ] `zault tags list` - List all tags
  - [ ] `zault find --before <date>` - Date filters

**Success Criteria:**
- Search 10,000 files in <100ms
- Server cannot read search queries
- Supports wildcards and regex

#### Milestone 3.4: Security Audit (Weeks 13-16)

- [ ] **Preparation**
  - [ ] Code freeze for audit
  - [ ] Complete test coverage
  - [ ] Fuzzing with AFL/libFuzzer
  - [ ] Static analysis (Zig built-in)

- [ ] **External audit**
  - [ ] Hire reputable crypto auditor
  - [ ] Full protocol review
  - [ ] Implementation review
  - [ ] Penetration testing

- [ ] **Remediation**
  - [ ] Fix all critical/high findings
  - [ ] Document medium/low findings
  - [ ] Publish audit report
  - [ ] Update threat model

**Success Criteria:**
- Zero critical vulnerabilities
- Audit report published
- All recommendations addressed

**Deliverables:**
- `zault v0.3.0` release candidate
- WASM client and browser extension
- P2P support
- Security audit report
- Production-ready documentation

---

### Phase 4: v1.0 - Production Release
**Timeline:** Sep 2026 - Dec 2026 (16 weeks)  
**Goal:** Stable, audited, production-ready release

#### Milestone 4.1: Mobile Apps (Weeks 1-8)

- [ ] **iOS app**
  - [ ] Native UI (SwiftUI)
  - [ ] Zig C API bindings
  - [ ] Keychain integration
  - [ ] Share extension
  - [ ] Background sync

- [ ] **Android app**
  - [ ] Native UI (Jetpack Compose)
  - [ ] Zig C API bindings
  - [ ] Keystore integration
  - [ ] Share sheet
  - [ ] Background sync

**Success Criteria:**
- Apps on App Store and Play Store
- Native performance
- Battery-efficient sync

#### Milestone 4.2: Enterprise Features (Weeks 8-12)

- [ ] **Team management**
  - [ ] Organization identities
  - [ ] Role-based access control
  - [ ] Audit log exports
  - [ ] Compliance reports

- [ ] **Administration**
  - [ ] Admin dashboard
  - [ ] User provisioning
  - [ ] Storage quotas
  - [ ] Usage analytics

- [ ] **Integration**
  - [ ] LDAP/Active Directory
  - [ ] SAML SSO
  - [ ] Webhooks
  - [ ] API for automation

**Success Criteria:**
- SOC 2 Type II ready
- HIPAA-compliant configuration
- Enterprise customer pilot

#### Milestone 4.3: Performance & Scale (Weeks 12-14)

- [ ] **Optimization**
  - [ ] Block compression
  - [ ] Parallel uploads
  - [ ] Streaming decryption
  - [ ] Memory-efficient storage

- [ ] **Scalability**
  - [ ] Handle 1TB+ vaults
  - [ ] 100,000+ blocks per vault
  - [ ] 1,000+ concurrent users per server
  - [ ] CDN integration

**Success Criteria:**
- 10x performance improvement
- <100MB memory usage for CLI
- Handles enterprise workloads

#### Milestone 4.4: Final Hardening (Weeks 14-16)

- [ ] **Stability**
  - [ ] Beta testing program
  - [ ] Bug bounty program
  - [ ] Stress testing
  - [ ] Edge case handling

- [ ] **Documentation**
  - [ ] Complete user guide
  - [ ] Administrator handbook
  - [ ] Developer documentation
  - [ ] Security whitepaper

- [ ] **Release prep**
  - [ ] Final security review
  - [ ] Performance benchmarks
  - [ ] Migration tools
  - [ ] Marketing materials

**Success Criteria:**
- 99.9% test coverage
- Zero known critical bugs
- Complete documentation
- Ready for production use

**Deliverables:**
- `zault v1.0.0` stable release
- iOS and Android apps
- Enterprise features
- Complete documentation
- Marketing website

---

## Post-1.0 Features (Future)

### Advanced Cryptography
- [ ] Threshold signatures (multi-sig vaults)
- [ ] Zero-knowledge proofs (selective disclosure)
- [ ] Homomorphic encryption (compute on encrypted data)
- [ ] Forward secrecy (ratcheting keys)

### Collaboration
- [ ] Real-time collaborative editing
- [ ] Operational transforms
- [ ] Conflict-free replicated data types (CRDTs)
- [ ] Team channels

### Platform Integration
- [ ] Desktop apps (Electron alternative)
- [ ] Command Palette for text editors
- [ ] Git LFS backend
- [ ] Database backup integration

### Decentralization
- [ ] IPFS/Filecoin integration
- [ ] Blockchain storage commitments
- [ ] Federated servers
- [ ] Self-sovereign hosting network

### Advanced Features
- [ ] File deduplication
- [ ] Compression
- [ ] Streaming video playback
- [ ] Photo gallery with thumbnails
- [ ] Document preview

---

## Success Metrics

### Technical Metrics
- **Performance:** <100ms for typical operations
- **Security:** Zero critical vulnerabilities
- **Reliability:** 99.9% uptime for hosted service
- **Scalability:** Support 1TB+ vaults
- **Efficiency:** <100MB memory usage

### Adoption Metrics
- **Week 1:** 100 GitHub stars
- **Month 1:** 1,000 active users
- **Month 3:** 10,000 active users
- **Month 6:** 100,000 active users
- **Year 1:** 1M active users

### Community Metrics
- **Contributors:** 50+ contributors
- **Pull Requests:** 500+ merged PRs
- **Issues:** <50 open bugs
- **Documentation:** 100+ pages
- **Integrations:** 10+ third-party tools

---

## Risk Mitigation

### Technical Risks

**Risk:** Zig breaking changes  
**Mitigation:** Pin to specific commits, maintain compatibility layer

**Risk:** Cryptographic vulnerabilities  
**Mitigation:** Use NIST-standardized algorithms, external audits

**Risk:** Performance issues  
**Mitigation:** Benchmark early and often, profile before optimizing

**Risk:** Storage backend failures  
**Mitigation:** Support multiple backends, implement retry logic

### Project Risks

**Risk:** Maintainer burnout  
**Mitigation:** Build contributor community, share maintenance load

**Risk:** Funding for audits  
**Mitigation:** Sponsorships, grants, enterprise licensing

**Risk:** Regulatory compliance  
**Mitigation:** Early consultation with legal experts

**Risk:** Competition from big tech  
**Mitigation:** Open source moat, community-driven development

---

## How to Contribute

### For Developers
1. Check [GitHub Issues](https://github.com/yourusername/zault/issues)
2. Pick an issue tagged `good-first-issue`
3. Read [CONTRIBUTING.md](../CONTRIBUTING.md)
4. Submit a PR!

### For Cryptographers
- Review protocol specification
- Audit implementation
- Suggest improvements
- Write security analysis

### For Users
- Test alpha/beta releases
- Report bugs
- Request features
- Write documentation

### For Organizations
- Sponsor development
- Fund security audits
- Provide hosting infrastructure
- Partner for enterprise features

---

## Contact & Updates

- **GitHub:** https://github.com/yourusername/zault
- **Discussions:** https://github.com/yourusername/zault/discussions
- **Matrix:** `#zault:matrix.org`
- **Email:** dev@zault.io
- **Blog:** https://zault.io/blog (coming soon)

---

**Last Updated:** 2025-11-18  
**Next Review:** 2025-12-01

This roadmap is a living document and will be updated as the project evolves.
