# Getting Started with Zault

This guide will walk you through installing Zault and performing your first encrypted file storage operations.

---

## Prerequisites

- **Zig 0.16.0 or later** (master branch recommended)
- **64-bit system** (Linux, macOS, or Windows)
- **~100MB disk space** for Zig installation

---

## Installation

### Option 1: Install Zig with mise (Recommended)

```bash
# Install mise if you don't have it
curl https://mise.run | sh

# Install Zig master
mise use zig@master

# Verify installation
zig version
```

### Option 2: Download Zig Manually

Visit [ziglang.org/download](https://ziglang.org/download/) and download the latest master build for your platform.

### Build Zault

```bash
# Clone the repository
git clone https://github.com/mattneel/zault
cd zault

# Build
zig build

# Test (optional but recommended)
zig build test --summary all
# Should show: 22/22 tests passed ✅

# Install to ~/.local/bin
zig build install --prefix ~/.local

# Add to PATH if needed
export PATH="$HOME/.local/bin:$PATH"

# Verify installation
zault
```

You should see the usage message.

---

## Your First Vault

### 1. Initialize a Vault

```bash
$ zault init
Initializing vault at /home/user/.zault
✓ Vault initialized
✓ Identity generated: zpub1d2af5e4b3b3dc249...
```

This creates:

- `~/.zault/` directory
- `~/.zault/identity.bin` - Your ML-DSA-65 keypair
- `~/.zault/blocks/` - Content-addressed storage

**⚠️ IMPORTANT:** Backup `identity.bin` - it's your ONLY way to decrypt files!

```bash
# Backup your identity
cp ~/.zault/identity.bin /safe/backup/location/
```

### 2. Add Your First File

```bash
# Create a test file
echo "This is a secret document" > secret.txt

# Add to vault (encrypts automatically)
$ zault add secret.txt
Adding file: secret.txt
✓ File added
Hash: 8578287ea915b760...
```

**What just happened:**

1. Zault read `secret.txt`
2. Generated a random encryption key for this file
3. Encrypted the file with ChaCha20-Poly1305
4. Created a content block (encrypted file)
5. Created a metadata block (encrypted filename + key)
6. Signed both blocks with ML-DSA-65
7. Stored both in `~/.zault/blocks/`

The returned hash is for the **metadata block** - save it to retrieve the file later!

### 3. List Your Files

```bash
$ zault list
Files in vault: 1

Filename      Size Type        Hash
-----------------------------------------------------
secret.txt      27 text/plain  8578287ea915b760
```

**Notice:** Zault decrypted the metadata to show the filename. The server never saw "secret.txt"!

### 4. Retrieve and Decrypt

```bash
# Get the file back
$ zault get 8578287ea915b760... decrypted.txt
Retrieving block: 8578287ea915b760...
✓ File retrieved: decrypted.txt

# Verify it matches
$ cat decrypted.txt
This is a secret document

$ diff secret.txt decrypted.txt
(no differences) ✅
```

**What happened:**

1. Retrieved metadata block
2. Verified ML-DSA signature
3. Decrypted metadata with vault master key
4. Got content block hash and encryption key
5. Retrieved content block
6. Verified ML-DSA signature
7. Decrypted with per-file key
8. Wrote plaintext to output file

### 5. Verify Security

```bash
# Check that storage is actually encrypted
$ grep -r "secret document" ~/.zault/blocks/
(no matches) ✅

# Look at raw block data
$ od -A x -t x1z ~/.zault/blocks/*/* | head -5
000000 01 02 00 00 00 00 00 00 00 00 47 b3 d0 c0 32 a4  >..........G...2.<
000010 82 59 26 5c 0e 9d ca 6b ef 87 a8 6e 6e 71 8c a3  >.Y&\...k...nnq..<
```

**Encrypted gibberish** - no plaintext visible! ✅

---

## Understanding the Two-Block System

Every file you add creates **two blocks**:

### Content Block (Encrypted File Data)

```
- Type: content
- Data: [your file, encrypted with random key]
- Nonce: [12 random bytes]
- Signature: [ML-DSA-65 signature]
```

### Metadata Block (Encrypted File Info)

```
- Type: metadata
- Data: [encrypted metadata containing:]
  - filename: "secret.txt"
  - size: 27
  - mime_type: "text/plain"
  - content_hash: [points to content block]
  - content_key: [key to decrypt content]
  - content_nonce: [nonce for content]
- Signature: [ML-DSA-65 signature]
```

**You get the metadata block hash.** Use it to retrieve the file.

---

## Custom Vault Location

```bash
# Use a custom location
export ZAULT_PATH=/mnt/encrypted-backup
zault init

# Or specify inline
ZAULT_PATH=/mnt/backup zault add file.txt
```

Default is `~/.zault` if `ZAULT_PATH` is not set.

---

## Next Steps

- Read the [CLI Reference](./cli-reference.md) for all commands
- Understand the [Security Model](./security-model.md)
- See [Protocol Specification](./protocol-specification.md) for technical details

---

## Troubleshooting

### "command not found: zault"

Make sure `~/.local/bin` is in your PATH:

```bash
export PATH="$HOME/.local/bin:$PATH"

# Add to ~/.bashrc or ~/.zshrc to make permanent
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
```

### "FileNotFound: identity.bin"

You haven't initialized a vault yet:

```bash
zault init
```

### "SignatureVerificationFailed"

The block was tampered with. This is a **security feature** - don't ignore it!

Possible causes:

- Storage corruption
- Malicious modification
- Using wrong vault/identity

### Tests Failing

```bash
# Run tests to diagnose
zig build test --summary all

# Check Zig version
zig version
# Should be 0.16.0 or later
```

---

## Backup Strategy

**Critical:** Your `identity.bin` file is the ONLY way to decrypt your vault.

### Backup Your Identity

```bash
# Copy to safe location
cp ~/.zault/identity.bin /backup/zault-identity-$(date +%Y%m%d).bin

# Or export to encrypted USB drive
cp ~/.zault/identity.bin /media/usb/zault-backup/
```

### What to Backup

- ✅ `identity.bin` - **CRITICAL** (cannot recover without this)
- ✅ `blocks/` directory - Your encrypted data
- ❌ No need to backup anything else

### Recovery

```bash
# On new machine:
mkdir -p ~/.zault
cp /backup/identity.bin ~/.zault/
rsync -av /backup/blocks/ ~/.zault/blocks/

# Verify
zault list
```

---

## Performance Tips

Zault is designed to be fast:

- **Small files (<1MB):** ~10ms per file
- **Large files (100MB):** ~100ms (mostly I/O)
- **Listing:** Fast even with thousands of files

If performance is slow:

- Check disk I/O (SSD recommended)
- Ensure Zig is built with optimization: `zig build -Doptimize=ReleaseFast`

---

**You're ready to use Zault! 🚀**

Next: [CLI Reference](./cli-reference.md) for complete command documentation.
