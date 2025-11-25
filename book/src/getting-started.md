# Getting Started with Zault

Zault offers three ways to use post-quantum cryptography:

1. **[zault.chat](https://zault.chat)** - Instant P2P encrypted chat (no install)
2. **CLI** - Command-line file encryption and sharing
3. **Libraries** - Embed in your own applications

---

## Option 1: Use zault.chat (Easiest)

Visit [zault.chat](https://zault.chat) for instant post-quantum encrypted messaging:

1. Open [zault.chat](https://zault.chat) in your browser
2. Your identity is automatically generated
3. Share your link or QR code with contacts
4. Start chatting with end-to-end encryption

**No accounts. No installation. Post-quantum secure.**

---

## Option 2: CLI Installation

### Prerequisites

- **Zig 0.16.0 or later** (master branch recommended)
- **64-bit system** (Linux, macOS, or Windows)

### Install Zig

```bash
# Option A: Using mise (recommended)
curl https://mise.run | sh
mise use zig@master

# Option B: Manual download
# Visit https://ziglang.org/download/
```

### Build Zault

```bash
git clone https://github.com/mattneel/zault
cd zault
zig build -Doptimize=ReleaseFast
zig build install --prefix ~/.local

# Add to PATH
export PATH="$HOME/.local/bin:$PATH"

# Verify
zault --version
```

### Your First Vault

```bash
# Initialize vault
$ zault init
✓ Vault initialized
✓ Identity generated

# Add encrypted file
$ zault add secret.pdf
✓ File added
Hash: 8578287ea915b760...

# List files
$ zault list
Filename      Size Type            Hash
secret.pdf    1.2M application/pdf 8578287e...

# Retrieve file
$ zault get 8578287e... decrypted.pdf
✓ File retrieved
```

### Share Files

```bash
# Get recipient's public key
$ zault pubkey
zpub1d2af5e4b3b3dc249...

# Create share (recipient runs this)
$ zault share 8578287e... --to zpub1... --expires 1900000000 --export share.zault

# Receive share
$ zault import share.zault
$ zault receive <token> -o received.pdf
```

---

## Option 3: Library Integration

### C/C++ (libzault)

```bash
zig build
# Outputs: zig-out/lib/libzault.so, zig-out/include/zault.h
```

```c
#include <zault.h>

ZaultIdentity* id = zault_identity_generate();
zault_encrypt_message(id, recipient_pk, 1184, msg, len, out, &out_len);
zault_identity_destroy(id);
```

See [libzault documentation](./libzault.md) for full API.

### JavaScript/Browser (WASM)

```javascript
import { Zault } from './wasm/zault.js';

await Zault.init();
const identity = Zault.generateIdentity();
const ciphertext = Zault.encryptMessage(identity, recipientPk, "Hello!");
```

See [WASM documentation](./wasm.md) for full API.

---

## Understanding Zault's Cryptography

### Post-Quantum Algorithms

| Algorithm | Purpose | Size |
|-----------|---------|------|
| ML-DSA-65 | Digital signatures | 3309 bytes |
| ML-KEM-768 | Key encapsulation | 1184 bytes (pk) |
| ChaCha20-Poly1305 | Symmetric encryption | 28 bytes overhead |
| SHA3-256 | Hashing | 32 bytes |

### Two-Block System (CLI)

Every file creates two encrypted blocks:

1. **Content Block** - Your encrypted file data
2. **Metadata Block** - Encrypted filename, size, content key

You receive the metadata hash to retrieve files later.

### Message Encryption (Chat/Library)

For P2P messaging:

1. **1:1 Chat** - ML-KEM-768 encapsulates a per-message key
2. **Group Chat** - Shared ChaCha20 key, rotated on member changes

---

## Security Notes

### What's Protected

- ✅ File contents (encrypted)
- ✅ Message contents (E2E encrypted)
- ✅ Filenames (encrypted in metadata)
- ✅ Private keys (never transmitted)

### What's Visible

- ⚠️ Block/message sizes (approximate)
- ⚠️ Access patterns (timing)
- ⚠️ Online status (in chat)

### Backup Your Identity

**Critical:** Your identity file is the ONLY way to decrypt your data.

```bash
# CLI: Backup identity.bin
cp ~/.zault/identity.bin /safe/backup/

# PWA: Export via Settings > Export Identity
```

---

## Next Steps

- **CLI Users:** [CLI Reference](./cli-reference.md)
- **Developers:** [libzault](./libzault.md) | [WASM](./wasm.md)
- **Chat Users:** [PWA Guide](./pwa.md)
- **Security:** [Security Model](./security-model.md)

---

## Troubleshooting

### CLI: "command not found: zault"

```bash
export PATH="$HOME/.local/bin:$PATH"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
```

### CLI: "FileNotFound: identity.bin"

```bash
zault init  # Initialize vault first
```

### PWA: "Decryption failed"

Clear browser data and regenerate identity (Settings > Clear All Data).

### Build Errors

```bash
zig version  # Must be 0.16.0+
zig build test --summary all  # Run tests
```

---

**Ready to go! 🚀**

- **Instant chat:** [zault.chat](https://zault.chat)
- **CLI:** `zault init && zault add myfile.pdf`
- **Library:** `#include <zault.h>` or `import { Zault }`

