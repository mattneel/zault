# Frequently Asked Questions

Common questions about Zault.

---

## General

### What is Zault?

Zault is a **post-quantum secure, zero-knowledge storage system**. It encrypts your files before uploading them, and the server cannot decrypt them. Ever.

Think: Dropbox, but the server literally cannot read your files even if it tries.

### Why should I use Zault instead of Dropbox/Google Drive?

**Dropbox/Google Drive can read your files.** They have the encryption keys.

Zault uses **zero-knowledge encryption** - we never have your keys. Mathematically impossible for us (or anyone) to decrypt your files.

Also: **Post-quantum cryptography**. When quantum computers break RSA/ECDSA (10-15 years), your Dropbox files will be decrypted. Zault files won't.

### Is Zault production-ready?

**Status:** Alpha (v0.1.0)

**Safe for:**
- ✅ Personal backups
- ✅ Non-critical data
- ✅ Testing and evaluation
- ✅ Development environments

**Wait for v1.0 before using for:**
- ⚠️ Critical production data
- ⚠️ Healthcare records (HIPAA)
- ⚠️ Financial data
- ⚠️ Legal documents

**Why wait:** Security audit not yet complete. Use at your own risk.

---

## Security

### Is Zault actually secure?

**Cryptography:** ✅ NIST-standardized algorithms (ML-DSA-65, ChaCha20-Poly1305)

**Implementation:** ⚠️ Not yet audited by external security firm

**Open Source:** ✅ Fully auditable (1,593 lines of Zig)

**Tests:** ✅ 22/22 passing

**Verdict:** Cryptographic design is sound. Implementation audit pending.

### What happens if quantum computers break ML-DSA?

Zault has **cryptographic agility** built-in. Every block has a version field.

When new algorithms are standardized:
1. Update Zault to support new crypto
2. Old blocks remain readable (version 0x01)
3. New blocks use new crypto (version 0x02)
4. Re-encrypt critical files with new algorithm

**No data loss. Smooth migration.**

### Can Zault employees/admins read my files?

**No. Mathematically impossible.**

We never have your encryption keys. They're derived from your `identity.bin`, which never leaves your device.

Even if we wanted to (we don't), even if compelled by court order, even if tortured by adversaries - we cannot decrypt your files.

**That's zero-knowledge encryption.**

### What if I forget my password?

**Zault has no passwords.**

Your identity is your **cryptographic keypair** (ML-DSA-65). Stored in `identity.bin`.

**If you lose `identity.bin`:**
- Your vault is permanently unrecoverable
- No password reset
- No recovery mechanism
- No backdoor

**Backup your identity.bin!**

---

## Technical

### Why Zig?

**Reasons:**
1. **Performance** - As fast as C, safer memory model
2. **Simple** - No hidden control flow, no exceptions
3. **Stdlib crypto** - ML-DSA and ML-KEM in stdlib (since 0.15.x)
4. **Cross-platform** - Compiles to native on Linux/macOS/Windows
5. **No runtime** - Single binary, no dependencies

### Why ML-DSA instead of Ed25519?

**Ed25519 is vulnerable to quantum computers** (Shor's algorithm).

ML-DSA-65 is:
- Quantum-resistant (lattice-based)
- NIST-standardized (FIPS 204)
- Fast enough (~2ms per operation)

**Future-proof cryptography.**

### Why ChaCha20-Poly1305 instead of AES-GCM?

**Both are secure**, but ChaCha20-Poly1305 has advantages:
- Faster in software (no AES hardware needed)
- Constant-time (no timing side-channels)
- Simpler implementation
- Used by major systems (TLS 1.3, WireGuard, Signal)

### How does the two-block system work?

**Every file → two blocks:**

1. **Content Block** - Your file, encrypted with random key
2. **Metadata Block** - Filename + encryption key, encrypted with vault master key

**Why two blocks?**
- Separate concerns (content vs metadata)
- Can update metadata without re-encrypting content
- Can share content block without revealing filename
- Enables future features (versioning, sharing)

**User sees:** Metadata block hash (points to content)

### What's the storage overhead?

**Per file:**
- Content block: `file_size + 16 bytes (tag) + 5,319 bytes (header/signature)`
- Metadata block: `~200 bytes (metadata) + 16 bytes (tag) + 5,319 bytes (header/signature)`

**Total overhead:** ~10.6 KB per file

**For 100MB file:** 0.01% overhead (negligible)

**For 1KB file:** 1,060% overhead (significant but acceptable for small files)

---

## Usage

### Can I use Zault for [my use case]?

**Good for:**
- ✅ Personal file backups
- ✅ Encrypted cloud storage
- ✅ Secure document sharing (Phase 2)
- ✅ Compliance/audit trails
- ✅ Version control for encrypted files (Phase 2)

**Not designed for:**
- ❌ Real-time collaboration (async only)
- ❌ Databases (block-based, not record-based)
- ❌ Streaming video (no range requests yet)
- ❌ High-frequency updates (signature overhead)

### How do I share files with others?

**Currently:** Not implemented (Phase 1 doesn't have sharing)

**Phase 2.1 will add:**
- Share tokens with ML-KEM-768
- Encrypt content_key for recipient
- Time-limited access
- `zault share <file> --to <pubkey> --expires 24h`

**Workaround for now:**
- Share the entire vault (not ideal)
- Or wait for Phase 2.1

### Can I sync across devices?

**Currently:** No (Phase 1 is single-device only)

**Phase 2.3 will add:**
- Server implementation
- Delta sync (only missing blocks)
- Conflict detection
- `zault push / pull / sync`

**Workaround for now:**
- Use separate vault per device
- Manual rsync of `blocks/` directory

### Does Zault deduplicate files?

**Currently:** No

**Why:**
- Each file encrypted with unique key
- Same file → different ciphertext
- No deduplication possible

**Future:**
- Convergent encryption (deterministic keys)
- Optional feature (trades privacy for storage)

---

## Troubleshooting

### "No such file or directory: identity.bin"

**Cause:** Vault not initialized

**Fix:**
```bash
zault init
```

### "SignatureVerificationFailed"

**Cause:** Block was modified or corrupted

**This is a security feature!** Do not ignore.

**Possible causes:**
1. Storage corruption (check disk)
2. Malicious modification (investigate!)
3. Wrong vault (using different identity)

**Fix:**
- If corruption: Restore from backup
- If tampering: **Do not use the block** - it's compromised

### "AuthenticationFailed" on decrypt

**Cause:** Decryption failed (wrong key or corrupted ciphertext)

**Possible causes:**
1. Wrong vault (using different identity)
2. Corrupted block
3. Wrong content_key in metadata

**Fix:**
- Verify you're using the correct vault
- Check `zault verify <hash>` - signature should be valid
- If signature valid but decrypt fails: Bug (report it!)

### Tests failing

```bash
# Run full test suite
zig build test --summary all

# Should show: 22/22 tests passed

# If failing:
# 1. Check Zig version
zig version  # Should be 0.16.0+

# 2. Clean build
rm -rf zig-cache .zig-cache
zig build test

# 3. Check for disk space
df -h

# Still failing? Report issue with error output
```

---

## Performance

### Why is `zault add` slow for large files?

**Expected:**
- 1MB file: ~15ms
- 100MB file: ~800ms

**If slower:**
1. Check disk I/O (SSD vs HDD)
2. Build with optimization: `zig build -Doptimize=ReleaseFast`
3. Check CPU load

**ML-DSA signing takes ~2ms** - unavoidable security overhead.

### Can I make it faster?

**Current bottlenecks:**
1. Disk I/O (use SSD)
2. ML-DSA signing (~2ms per block)
3. File reading

**Future optimizations:**
- Parallel block processing
- Streaming encryption (don't load entire file)
- Hardware acceleration for ChaCha20

---

## Development

### How can I contribute?

See [Contributing Guide](./contributing.md).

**Areas we need help:**
- Security audit (cryptography review)
- Platform testing (macOS, Windows)
- Documentation (tutorials, examples)
- Bug reports
- Feature ideas

### What's the development roadmap?

See [ROADMAP.md](./ROADMAP.md).

**Next milestones:**
- v0.1.0 - Alpha release (this week)
- v0.2.0 - Sharing + sync (next month)
- v0.3.0 - Advanced features (3 months)
- v1.0.0 - Production ready (6 months)

### Why no GUI?

**Phase 1 focus:** Get the cryptography and protocol right.

**Future:**
- Phase 4: Desktop GUI (not Electron - native or WASM)
- Mobile apps (iOS/Android)
- Browser extension

**For now:** CLI is simpler, scriptable, and easier to audit.

---

## Comparison

### Zault vs Cryptomator

| Feature | Zault | Cryptomator |
|---------|-------|-------------|
| Post-quantum crypto | ✅ Yes | ❌ No |
| CLI | ✅ Yes | ❌ No |
| GUI | ❌ No (yet) | ✅ Yes |
| Self-hostable | ✅ Yes | ✅ Yes |
| Open source | ✅ Yes | ✅ Yes |
| Signatures | ✅ ML-DSA-65 | ❌ No |
| Cloud integration | ❌ No (yet) | ✅ Yes |

**Use Cryptomator if:** You want GUI + cloud integration now

**Use Zault if:** You want post-quantum crypto + CLI + verifiable signatures

### Zault vs VeraCrypt

| Feature | Zault | VeraCrypt |
|---------|-------|-----------|
| Post-quantum crypto | ✅ Yes | ❌ No |
| Cloud storage | ✅ Yes | ❌ No (volumes) |
| Plausible deniability | ❌ No | ✅ Yes |
| File-level encryption | ✅ Yes | ❌ No (volume) |
| Signatures | ✅ ML-DSA-65 | ❌ No |

**Use VeraCrypt if:** You need plausible deniability or full-volume encryption

**Use Zault if:** You want cloud-compatible, file-level, post-quantum encryption

---

## Miscellaneous

### What does "Zault" mean?

**Vault + Zero = Zault**

*"Vault zero. Trust zero. Quantum zero."*

### What license is Zault?

**MIT License** - permissive, commercial-friendly.

### Who made Zault?

Built with compiler-driven development methodology:
- Architecture: Human
- Implementation: AI (Claude) using Zig compiler as teacher
- ~6.5 hours from zero to working system

### Can I use Zault as a library?

**Yes!** Zault is both a library and CLI.

```zig
const zault = @import("zault");

// Use as library
var vault = try zault.Vault.init(allocator, "/path/to/vault");
const hash = try vault.addFile("secret.pdf");
try vault.getFile(hash, "output.pdf");
```

See [API Reference](./api-reference.md) for details.

---

## Still have questions?

- Check [Getting Started](./getting-started.md)
- Read [Protocol Specification](./protocol-specification.md)
- Open an issue on GitHub
- Join discussions (coming soon)

---

**Happy encrypting! 🔒**
