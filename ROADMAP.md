# Zault Roadmap

**Last Updated:** 2025-11-25
**Current Phase:** Phase 2 Complete ✅ - v0.2.0 Released with P2P Chat

---

## Vision

Build the world's most secure, verifiable, and user-friendly post-quantum communication and storage system. Make zero-knowledge encryption accessible to everyone, not just cryptography experts.

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
**Status:** ✅ COMPLETE

- [x] Identity management (ML-DSA-65)
- [x] Block operations with content addressing
- [x] ChaCha20-Poly1305 encryption
- [x] Local filesystem storage
- [x] Professional CLI (zig-clap)
- [x] 22/22 tests passing
- [x] Multi-platform builds (Linux, macOS, Windows)

---

### Phase 2: v0.2.0 - Sharing & Chat ✅ COMPLETE

**Timeline:** Nov 2025 (completed in 2 days!)
**Goal:** Enable secure sharing and P2P communication
**Status:** ✅ COMPLETE - Released at [zault.chat](https://zault.chat)

#### Milestone 2.1: Share Tokens ✅ COMPLETE

- [x] ML-KEM-768 key encapsulation
- [x] Share token creation/redemption
- [x] Offline sharing workflow (export/import)
- [x] Commands: share, receive, import, pubkey

#### Milestone 2.2: libzault C FFI ✅ COMPLETE

- [x] C-callable API for all crypto operations
- [x] Message encryption/decryption
- [x] Digital signatures (sign/verify)
- [x] Identity serialization
- [x] Direct ChaCha20 for group messages
- [x] Shared and static library builds
- [x] `include/zault.h` header

#### Milestone 2.3: WASM Build ✅ COMPLETE

- [x] wasm32-wasi target compilation
- [x] WASI stubs for browser environment
- [x] JavaScript wrapper (`wasm/zault.js`)
- [x] All crypto operations in browser

#### Milestone 2.4: PWA - P2P Chat ✅ COMPLETE

- [x] SolidStart + Tailwind + DaisyUI
- [x] WebSocket signaling server
- [x] 1:1 encrypted messaging
- [x] Group chat with key rotation
- [x] CRDT-based offline sync
- [x] Split QR code sharing
- [x] JSON import/export
- [x] Offline-first with Service Worker
- [x] 30+ DaisyUI themes
- [x] 41 Playwright E2E tests
- [x] Deployed to Fly.io at zault.chat

**Deliverables:** ✅ All Complete
- `zault v0.2.0` CLI with sharing
- `libzault.so` / `libzault_static.a` C libraries
- `zault.wasm` WebAssembly module
- Live PWA at [zault.chat](https://zault.chat)
- 75+ automated tests (34 Zig + 41 Playwright)

---

### Phase 3: v0.3.0 - Server & Persistence

**Timeline:** Q1 2026
**Goal:** Persistent storage and multi-device sync
**Status:** 🔜 Next

#### Milestone 3.1: Message Persistence

- [ ] Server-side message storage
- [ ] Message history API
- [ ] Pagination and search
- [ ] Attachment support

#### Milestone 3.2: Block Server

- [ ] REST API for block storage
- [ ] S3-compatible backend
- [ ] Multi-device sync protocol
- [ ] Conflict resolution

#### Milestone 3.3: Push Notifications

- [ ] Web Push API integration
- [ ] Background sync
- [ ] Notification preferences

**Success Criteria:**
- Messages persist across sessions
- Multi-device access works
- <100ms sync latency

---

### Phase 4: v1.0.0 - Production Ready

**Timeline:** Q2-Q3 2026
**Goal:** Stable, audited, production-ready release
**Status:** 📋 Planned

#### Milestone 4.1: Security Audit

- [ ] External cryptographic audit
- [ ] Penetration testing
- [ ] Bug bounty program
- [ ] Publish audit report

#### Milestone 4.2: Mobile Apps

- [ ] iOS app (Swift + libzault)
- [ ] Android app (Kotlin + libzault)
- [ ] Push notification support

#### Milestone 4.3: Enterprise Features

- [ ] Organization management
- [ ] Admin controls
- [ ] Compliance exports
- [ ] SSO integration

**Deliverables:**
- `zault v1.0.0` stable release
- Security audit report
- Mobile apps
- Enterprise documentation

---

## Current Status

### ✅ What's Working (v0.2.0)

**Core:**
- Post-quantum crypto (ML-DSA-65, ML-KEM-768)
- Zero-knowledge encryption
- Content-addressed storage
- 34/34 Zig tests passing

**Libraries:**
- libzault C FFI (shared + static)
- WASM module for browsers
- JavaScript wrapper

**PWA (zault.chat):**
- P2P encrypted chat
- 1:1 and group messaging
- Offline-first with sync
- 41/41 Playwright tests
- 30+ themes

**Platforms:**
- Linux (x86_64, ARM64)
- macOS (Intel, Apple Silicon)
- Windows (x86_64)
- All modern browsers (WASM)

### 🔜 What's Next (v0.3.0)

- Message persistence
- Multi-device sync
- Push notifications
- Attachment support

---

## Success Metrics

### Technical Metrics (Current)

| Metric | v0.1.0 | v0.2.0 | v1.0.0 Target |
|--------|--------|--------|---------------|
| Zig Tests | 22/22 | 34/34 | 50+ |
| PWA Tests | N/A | 41/41 | 100+ |
| Test Coverage | ~80% | ~85% | 99%+ |
| WASM Size | N/A | ~2MB | <1MB |
| Latency | <10ms | <50ms | <100ms |

### Adoption Metrics

**v0.2.0 Goals:**
- ✅ Live deployment at zault.chat
- Week 1: 100 active users
- Month 1: 1,000 messages sent
- Gather user feedback

**v1.0.0 Goals:**
- 10,000 active users
- 99.9% uptime
- Zero critical vulnerabilities

---

## Risk Mitigation

### Technical Risks

| Risk | Mitigation |
|------|------------|
| Security vulnerabilities | External audit (v1.0), open source, comprehensive tests |
| Browser compatibility | WASM with polyfills, PWA fallbacks |
| Scalability | WebSocket clustering, CDN for static assets |

### Project Risks

| Risk | Mitigation |
|------|------------|
| Low adoption | Clear value prop, excellent UX, open source |
| Maintainer burnout | Modular design, good docs, community building |

---

## How to Contribute

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Priority Areas for v0.3.0:**
1. Message persistence backend
2. Multi-device sync protocol
3. Push notification integration
4. Performance optimization
5. Documentation improvements

---

## Links

- **Live App:** [zault.chat](https://zault.chat)
- **GitHub:** https://github.com/mattneel/zault
- **Documentation:** https://mattneel.github.io/zault

---

**Last Updated:** 2025-11-25
**Next Review:** After v0.3.0 planning

This roadmap is a living document and will be updated as the project evolves.
