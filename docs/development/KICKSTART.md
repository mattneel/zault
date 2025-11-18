# Zault Development Kickstart Prompt

**For:** AI coding agents (Claude, Cursor, etc.)  
**Goal:** Bootstrap the Zault repository with core functionality  
**Context:** Zig 0.15.2+ (master), post-quantum cryptography, zero-knowledge storage

---

## ⚠️ CRITICAL: My Zig Knowledge is Outdated

I was trained on Zig ~0.13.0. You're working with **0.15.2 or master**. Major breaking changes have occurred. 

**DO NOT trust my Zig syntax or API knowledge without verification.**

---

## Project Overview

Read these files first (in order):

1. **`README.md`** - Project overview and goals
2. **`book/src/protocol-specification.md`** - Complete technical specification  
3. **`ROADMAP.md`** - Development phases and milestones
4. **`ZIG.md`** - Zig 0.15.x breaking changes reference

---

## Your Mission: Phase 1, Milestone 1.1

Implement the core cryptographic library following the specification.

**Priority Order:**
1. Identity management (ML-DSA keypairs, serialization)
2. Block structures (data types, serialization)
3. Encryption/decryption (ChaCha20-Poly1305, HKDF)
4. Storage interface (BlockStore, local filesystem backend)

---

## Working Method: Compiler-Driven Development

### Step 1: Always Check What Actually Exists

Before writing any code, **search the stdlib** to see what's actually there:
```bash
# Find ML-KEM (post-quantum crypto)
rg -t zig "pub const ML_KEM" ~/.mise/installs/zig/

# Find ML-DSA  
rg -t zig "pub const ML_DSA" ~/.mise/installs/zig/

# Find ChaCha20-Poly1305
rg -t zig "ChaCha20Poly1305" ~/.mise/installs/zig/

# Find HKDF
rg -t zig "pub const Hkdf" ~/.mise/installs/zig/
```

### Step 2: Look at the Actual Code

Once you find it, **read the actual implementation**:
```bash
# Example: What does ML_DSA actually look like?
rg -A 50 "pub const ML_DSA_65" ~/.mise/installs/zig/lib/std/crypto/

# What methods does KeyPair have?
rg -A 20 "pub const KeyPair" ~/.mise/installs/zig/lib/std/crypto/ml_dsa.zig
```

### Step 3: Trust the Compiler Errors

Zig's compiler is your best friend. When you get an error:
```
error: no field named 'bytes_length' in struct 'PublicKey'
note: available fields: 'encoded_length', 'toBytes', 'fromBytes'
```

**This tells you:**
- ❌ `bytes_length` doesn't exist
- ✅ `encoded_length` does exist  
- ✅ There are `toBytes()` and `fromBytes()` methods

Use what the compiler shows you, not what I suggest.

### Step 4: When Stuck, Search + Ask
```bash
# Can't find something? Search broadly
rg -t zig "function_name" ~/.mise/installs/zig/

# Still stuck? Check recent commits around the ML-KEM addition
cd ~/.mise/installs/zig
git log --oneline --grep="ML-KEM" --all
git show <commit-hash>
```

If truly stuck, **ask the user**. They know Zig better than I do.

---

## File Structure to Create
```
src/
├── main.zig              # CLI entry point (stub for now)
├── root.zig              # Library root (tests, exports)
└── core/
    ├── crypto.zig        # Crypto primitives wrapper
    ├── identity.zig      # ML-DSA keypairs, zpub/zprv encoding
    ├── block.zig         # Block structure and serialization
    ├── vault.zig         # Vault operations (stub)
    └── store.zig         # Storage backends
```

---

## Implementation Strategy

### Phase 1: Crypto Wrapper (Minimal)

**Goal:** Verify ML-KEM/ML-DSA are available and working.

**File:** `src/core/crypto.zig`
```zig
const std = @import("std");

// DO NOT assume these exist - verify with ripgrep first!
pub const ml_kem = std.crypto.ml_kem;  // or wherever it is
pub const ml_dsa = std.crypto.ml_dsa;  // or wherever it is

// TODO: Add other crypto imports as you find them

test "can access ML-DSA" {
    // This test will fail if ML-DSA isn't available
    // Use the compiler error to find the right import path
    const KeyPair = ml_dsa.ML_DSA_65.KeyPair;
    _ = KeyPair;
}
```

**Validation:**
```bash
zig build test
```

If it fails, **use the error message** to find the correct path.

---

### Phase 2: Identity (Empirical Approach)

**Goal:** Generate ML-DSA keypairs and serialize them.

**Method:**
1. Search for ML-DSA KeyPair generation examples in stdlib
2. Look at the actual methods available
3. Implement based on what you find, not what I suggested

**File:** `src/core/identity.zig`

**Discovery process:**
```bash
# What does ML_DSA_65 actually expose?
rg -A 100 "pub const ML_DSA_65" ~/.mise/installs/zig/lib/std/crypto/

# How do you generate a keypair?
rg "KeyPair.generate\|KeyPair.fromSeed" ~/.mise/installs/zig/lib/std/crypto/

# What's the actual size of the keys?
# Look for constants or use the compiler to tell you
```

**Start simple:**
```zig
const std = @import("std");
const crypto = @import("crypto.zig");

pub const Identity = struct {
    // Let the COMPILER tell you the correct field name
    // It might be encoded_length, not bytes_length
    public_key: [crypto.ml_dsa.ML_DSA_65.PublicKey.encoded_length]u8,
    secret_key: [crypto.ml_dsa.ML_DSA_65.SecretKey.encoded_length]u8,
    created_at: i64,
    version: u8,
};

pub fn generateIdentity(seed: ?[32]u8) !Identity {
    // Search stdlib for the ACTUAL generation method
    // Don't trust my pseudocode
    const keypair = if (seed) |s|
        try crypto.ml_dsa.ML_DSA_65.KeyPair.fromSeed(s)  // might not exist!
    else
        try crypto.ml_dsa.ML_DSA_65.KeyPair.generate(null);  // might not exist!
    
    // Let compiler errors guide you to the right API
    return Identity{
        .public_key = keypair.public_key.toBytes(),  // or whatever the method is
        .secret_key = keypair.secret_key.toBytes(),  // or whatever the method is
        .created_at = std.time.timestamp(),
        .version = 0x01,
    };
}

test "generate identity compiles" {
    _ = generateIdentity;
}
```

**Run the test, read the errors, fix accordingly.**

---

### Phase 3: Block Structure (Spec-Driven)

**Goal:** Implement the Block type from the spec.

**Reference:** `book/src/protocol-specification.md` section 4.1

**Method:**
1. Copy the structure from the spec
2. Adjust field types based on what you learned from Phase 1-2
3. Start with simple serialization (just writing fields)
4. Add signing/verification only after basic structure works

**File:** `src/core/block.zig`
```zig
const std = @import("std");
const crypto = @import("crypto.zig");

pub const BlockType = enum(u8) {
    content = 0x01,
    metadata = 0x02,
    index = 0x03,
    tombstone = 0x04,
    share = 0x05,
};

pub const Block = struct {
    version: u8,
    block_type: BlockType,
    timestamp: i64,
    author: [1952]u8,  // Verify this size with compiler
    data: []const u8,
    nonce: [12]u8,
    signature: [3309]u8,  // Verify this size with compiler
    prev_hash: [32]u8,
    hash: [32]u8,
    
    // Start with just this - get it working first
    pub fn computeHash(self: *Block) void {
        // Use SHA3-256 - find it in stdlib first!
        // rg "Sha3_256" ~/.mise/installs/zig/lib/std/crypto/
        _ = self;
        @panic("TODO: implement after finding SHA3-256");
    }
};

test "block structure compiles" {
    var block = Block{
        .version = 0x01,
        .block_type = .content,
        .timestamp = 0,
        .author = undefined,
        .data = &[_]u8{},
        .nonce = undefined,
        .signature = undefined,
        .prev_hash = undefined,
        .hash = undefined,
    };
    _ = block;
}
```

---

### Phase 4: Storage (Simple First)

**Goal:** Just get files written and read. Don't optimize yet.

**File:** `src/core/store.zig`
```zig
const std = @import("std");
const Block = @import("block.zig").Block;

pub const BlockStore = struct {
    base_path: []const u8,
    allocator: std.mem.Allocator,
    
    pub fn init(allocator: std.mem.Allocator, base_path: []const u8) !BlockStore {
        // Create directory if it doesn't exist
        // Look up std.fs API - it has changed in 0.15
        // rg "pub fn makePath" ~/.mise/installs/zig/lib/std/fs.zig
        
        return BlockStore{
            .base_path = base_path,
            .allocator = allocator,
        };
    }
    
    pub fn put(self: *BlockStore, hash: [32]u8, block: Block) !void {
        // TODO: Implement after figuring out current std.fs API
        _ = self;
        _ = hash;
        _ = block;
        @panic("TODO");
    }
};

test "blockstore init compiles" {
    const allocator = std.testing.allocator;
    var store = try BlockStore.init(allocator, "/tmp/test");
    _ = store;
}
```

---

## Testing Strategy

**Run tests frequently:**
```bash
zig build test

# Or test a specific file
zig test src/core/identity.zig
```

**Let compiler errors guide you:**
- Each error is information about the actual API
- Fix one error at a time
- Re-run tests after each fix

**Don't batch changes:**
- Make one small change
- Run test
- See what breaks
- Fix it
- Repeat

---

## Common Zig 0.15 Gotchas (from ZIG.md)

These are **verified breaking changes** to watch for:

1. **`bytes_length` → `encoded_length`** everywhere
2. **ArrayList requires allocator** on every operation
3. **Writer API needs explicit buffers** now
4. **Cast syntax changed:** `@intCast(T, val)` → `@as(T, @intCast(val))`
5. **Format methods simplified** - no more `fmt` parameter

**When you hit any of these, check ZIG.md for the fix.**

---

## Development Workflow
```bash
# 1. Make a small change
vim src/core/identity.zig

# 2. Compile and see what breaks
zig build test

# 3. Read error carefully
error: no field named 'bytes_length'
note: available fields: 'encoded_length'

# 4. Fix based on error message
# Change bytes_length to encoded_length

# 5. Repeat until tests pass

# 6. Commit working code
git add src/core/identity.zig
git commit -m "feat(identity): add ML-DSA keypair generation"
```

---

## Success Criteria

**You know you're done with Phase 1.1 when:**

- [ ] Can generate an ML-DSA identity
- [ ] Can serialize identity to bytes
- [ ] Can create a Block structure
- [ ] Can write blocks to filesystem
- [ ] Can read blocks from filesystem  
- [ ] All tests pass
- [ ] Code compiles without warnings

**Don't worry about:**
- Performance (optimize later)
- Complete CLI (that's Phase 1.2)
- Encryption (add after basic structure works)
- Signatures (add after basic structure works)

---

## When You Need Help

**Ask the user if:**
- You can't find ML-KEM or ML-DSA in stdlib
- Ripgrep doesn't find something you need
- The API seems completely different from spec
- You're stuck for >15 minutes

**Include in your question:**
- What you searched for
- What ripgrep returned (or didn't)
- The compiler error you're seeing
- What you've tried

---

## Final Reminder

**I don't know Zig 0.15.x syntax.**  
**The compiler knows. The stdlib code knows. Use those.**

When in doubt:
1. Search stdlib with ripgrep
2. Read the actual code
3. Trust compiler errors
4. Ask the user

Do NOT trust my pseudocode without verification.

---

**Good luck! The compiler is your friend. 🦎**
