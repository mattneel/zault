# CLI Reference

Complete reference for all Zault command-line commands.

---

## Global Options

### Environment Variables

- `ZAULT_PATH` - Vault directory location (default: `~/.zault`)

```bash
# Use custom location
export ZAULT_PATH=/mnt/encrypted-storage
zault init
```

---

## Commands

### `zault init`

Initialize a new vault and generate identity.

**Usage:**
```bash
zault init
```

**What it does:**
1. Creates vault directory (`$ZAULT_PATH` or `~/.zault`)
2. Generates ML-DSA-65 keypair
3. Saves identity to `identity.bin`
4. Creates `blocks/` subdirectory

**Output:**
```
Initializing vault at /home/user/.zault
✓ Vault initialized
✓ Identity generated: zpub1d2af5e4b3b3dc249...
```

**Notes:**
- Safe to run multiple times (won't overwrite existing identity)
- Backup `identity.bin` immediately!

---

### `zault add <file>`

Add a file to the vault (encrypted).

**Usage:**
```bash
zault add <file>
```

**Arguments:**
- `<file>` - Path to file to add

**Examples:**
```bash
# Add a single file
zault add document.pdf

# Add with custom vault
ZAULT_PATH=/backup zault add important.txt

# Add from stdin (not yet supported)
```

**What it does:**
1. Reads the file
2. Generates random encryption key for this file
3. Encrypts file with ChaCha20-Poly1305
4. Creates content block (encrypted data)
5. Creates metadata block (encrypted filename + key)
6. Signs both blocks with ML-DSA-65
7. Stores both blocks

**Returns:** Metadata block hash (use this to retrieve the file)

**Output:**
```
Adding file: document.pdf
✓ File added
Hash: 8578287ea915b76074d6aee8b4be7e0cd00a21103e4340c71d57f6fce1f56bcd
```

**Limits:**
- Max file size: 100MB (configurable in code)
- Supported: Any file type

**Security:**
- File is encrypted with unique key
- Filename is encrypted in metadata
- Server never sees plaintext

---

### `zault get <hash> [output]`

Retrieve and decrypt a file from the vault.

**Usage:**
```bash
zault get <hash> [output]
```

**Arguments:**
- `<hash>` - Metadata block hash (from `zault add`)
- `[output]` - Output file path (default: `output.bin`)

**Examples:**
```bash
# Retrieve with custom output name
zault get 8578287ea915b760... document.pdf

# Retrieve with default name
zault get 8578287ea915b760...
# Creates: output.bin

# Full hash or prefix works
zault get 8578287e... output.pdf
```

**What it does:**
1. Retrieves metadata block by hash
2. Verifies ML-DSA signature
3. Decrypts metadata with vault master key
4. Gets content block hash and encryption key
5. Retrieves content block
6. Verifies ML-DSA signature
7. Decrypts content with per-file key
8. Writes plaintext to output file

**Output:**
```
Retrieving block: 8578287ea915b760...
✓ File retrieved: document.pdf
```

**Errors:**
- `NotFound` - Block doesn't exist
- `SignatureVerificationFailed` - Block was tampered with
- `AuthenticationFailed` - Decryption failed (wrong key/corrupted)

**Security:**
- Signature verified before decryption
- Tampering detected immediately
- Wrong vault/identity will fail

---

### `zault list`

List all files in the vault with metadata.

**Usage:**
```bash
zault list
```

**Output:**
```
Files in vault: 3

Filename                    Size Type              Hash
------------------------------------------------------------------------
passwords.txt                 28 text/plain        8578287ea915b760
notes.md                      16 text/markdown     41b8082409849578
config.json                   17 application/json  1cd638cc9269db77
```

**Columns:**
- **Filename** - Original filename (decrypted from metadata)
- **Size** - File size in bytes (decrypted from metadata)
- **Type** - MIME type (auto-detected on upload)
- **Hash** - First 16 characters of metadata block hash

**What it does:**
1. Lists all blocks in `blocks/` directory
2. Filters for metadata blocks
3. Decrypts each metadata block
4. Extracts filename, size, type
5. Displays in table format

**Notes:**
- Only shows metadata blocks (not raw content blocks)
- Decryption happens client-side
- Server never sees filenames

---

### `zault verify <hash>`

Verify a block's ML-DSA signature.

**Usage:**
```bash
zault verify <hash>
```

**Arguments:**
- `<hash>` - Block hash to verify (metadata or content)

**Examples:**
```bash
# Verify metadata block
zault verify 8578287ea915b760...

# Verify content block (get hash from metadata)
zault verify 96bdbcab68534461...
```

**What it does:**
1. Retrieves block by hash
2. Parses ML-DSA-65 signature
3. Reconstructs public key from author field
4. Verifies signature against block data

**Output:**
```
Verifying block: 8578287ea915b760...
✓ Signature valid
```

**Use Cases:**
- Verify file integrity before downloading
- Audit trail verification
- Detect tampering
- Compliance reporting

**Security:**
- Signature verification is fast (~2ms)
- Uses post-quantum ML-DSA-65
- Cannot be forged without private key

---

## Advanced Usage

### Multiple Vaults

```bash
# Personal vault
export ZAULT_PATH=~/personal-vault
zault init
zault add diary.txt

# Work vault
export ZAULT_PATH=~/work-vault
zault init
zault add report.pdf
```

### Scripting

```bash
#!/bin/bash
# Backup all documents

export ZAULT_PATH=/mnt/backup/vault

for file in ~/Documents/*.pdf; do
    echo "Backing up: $file"
    zault add "$file"
done

# List what was backed up
zault list
```

### Finding Files

```bash
# List all files
zault list

# Find specific file (use grep)
zault list | grep passwords

# Get file by partial hash
zault get 8578287e... output.txt
```

---

## Common Workflows

### Daily Backup

```bash
# Backup important files
zault add ~/Documents/work.xlsx
zault add ~/Documents/notes.md
zault add ~/.ssh/config

# Verify backups
zault list
```

### Retrieving Old Files

```bash
# See what's in vault
zault list

# Find the file you need
# Retrieve it
zault get <hash> recovered-file.pdf
```

### Verifying Integrity

```bash
# List all files
zault list | while read -r line; do
    # Extract hash
    hash=$(echo "$line" | awk '{print $NF}')

    # Verify signature
    zault verify "$hash" || echo "FAILED: $hash"
done
```

---

## Tips and Best Practices

### Do's ✅

- **Backup your identity.bin** - Cannot recover without it
- **Use unique vault per device** - Simpler than sync (for now)
- **Verify signatures** - Especially after network transfer
- **Test recovery** - Make sure you can actually decrypt

### Don'ts ❌

- **Don't lose identity.bin** - No password recovery possible
- **Don't share identity.bin** - It's your private key
- **Don't trust the server** - Verify signatures always
- **Don't modify blocks manually** - Will break signatures

---

## Performance

Typical operations on modern hardware:

| Operation | Time | Throughput |
|-----------|------|------------|
| Add 1KB file | ~8ms | ~125 files/sec |
| Add 1MB file | ~15ms | ~67 files/sec |
| Add 100MB file | ~800ms | ~125 MB/sec |
| List 100 files | ~25ms | - |
| Get 1MB file | ~10ms | ~100 MB/sec |
| Verify | ~2ms | ~500 verifications/sec |

**Bottlenecks:**
- Disk I/O (SSD recommended)
- ML-DSA signing/verification (~2ms each)

---

## Comparison with Other Tools

### vs rsync + gpg

**Zault advantages:**
- Post-quantum crypto (gpg is not quantum-resistant)
- Automatic encryption (no manual gpg commands)
- Content-addressed (deduplication ready)
- Cryptographic signatures (verifiable)

**rsync advantages:**
- Incremental sync (Zault doesn't have this yet)
- Mature ecosystem

### vs git-crypt

**Zault advantages:**
- Zero-knowledge (git server sees filenames)
- Post-quantum crypto
- Not tied to git
- Proper encryption (git-crypt has issues)

**git-crypt advantages:**
- Integrates with git workflow
- Selective encryption

### vs Cryptomator

**Zault advantages:**
- Command-line (scriptable)
- Post-quantum crypto
- Signed blocks (verifiable integrity)
- Open protocol

**Cryptomator advantages:**
- GUI (easier for non-technical users)
- Cloud provider integration
- Mature (in production)

---

## Next Steps

- **[CLI Reference](./cli-reference.md)** - Complete command reference
- **[Security Model](./security-model.md)** - Understand threat model
- **[Protocol Specification](./protocol-specification.md)** - Technical details

---

**Ready to secure your data with post-quantum cryptography!** 🔒
