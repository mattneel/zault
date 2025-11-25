# WASM & Browser Integration

Zault compiles to WebAssembly, enabling post-quantum cryptography in the browser.

## Building

```bash
zig build

# Output: zig-out/bin/zault.wasm
```

The WASM module is built with `wasm32-wasi` target and `ReleaseSmall` optimization.

## Quick Start

```html
<!DOCTYPE html>
<html>
<head>
    <title>Zault WASM Demo</title>
</head>
<body>
    <script type="module">
        import { Zault } from './wasm/zault.js';
        
        // Initialize WASM module
        await Zault.init();
        console.log('Zault version:', Zault.version);
        
        // Generate identities
        const alice = Zault.generateIdentity();
        const bob = Zault.generateIdentity();
        
        // Get Bob's public key
        const bobPublic = Zault.serializePublicIdentity(bob);
        const bobKemPk = Zault.parsePublicIdentityKemPk(bobPublic);
        
        // Encrypt message to Bob
        const message = "Hello from post-quantum land! 🔐";
        const ciphertext = Zault.encryptMessage(alice, bobKemPk, message);
        
        // Bob decrypts
        const plaintext = Zault.decryptMessage(bob, ciphertext);
        console.log('Decrypted:', plaintext);
    </script>
</body>
</html>
```

## JavaScript API

### Initialization

```javascript
import { Zault } from './wasm/zault.js';

// Load WASM module (required before any operations)
await Zault.init();

// Or with custom WASM path
await Zault.init('/path/to/zault.wasm');

// Check version
console.log(Zault.version); // "0.2.0-wasm"
```

### Identity Management

```javascript
// Generate new identity (ML-DSA-65 + ML-KEM-768 keypairs)
const identity = Zault.generateIdentity();
// Returns: Uint8Array (9577 bytes)

// Serialize identity for storage
const bytes = identity; // Already Uint8Array
localStorage.setItem('identity', btoa(String.fromCharCode(...bytes)));

// Load identity from storage
const stored = localStorage.getItem('identity');
const loaded = new Uint8Array([...atob(stored)].map(c => c.charCodeAt(0)));

// Get public identity (for sharing)
const publicIdentity = Zault.serializePublicIdentity(identity);
// Returns: Uint8Array (3136 bytes)

// Parse public identity components
const kemPk = Zault.parsePublicIdentityKemPk(publicIdentity);
// Returns: Uint8Array (1184 bytes) - ML-KEM-768 public key

const dsaPk = Zault.parsePublicIdentityDsaPk(publicIdentity);
// Returns: Uint8Array (1952 bytes) - ML-DSA-65 public key
```

### Message Encryption (1:1 Chat)

```javascript
// Encrypt message to recipient
const ciphertext = Zault.encryptMessage(
    senderIdentity,      // Uint8Array - sender's full identity
    recipientKemPk,      // Uint8Array - recipient's ML-KEM-768 public key
    "Hello!"             // string - message to encrypt
);
// Returns: Uint8Array (message.length + 1116 bytes overhead)

// Decrypt message
const plaintext = Zault.decryptMessage(
    recipientIdentity,   // Uint8Array - recipient's full identity
    ciphertext           // Uint8Array - encrypted message
);
// Returns: string

// String variants (base64url encoded)
const ciphertextB64 = Zault.encryptMessageString(identity, kemPk, "Hello!");
// Returns: string (base64url)

const plaintextStr = Zault.decryptMessageString(identity, ciphertextB64);
// Returns: string
```

### Symmetric Encryption (Group Chat)

```javascript
// Generate random group key
const groupKey = Zault.generateGroupKey();
// Returns: Uint8Array (32 bytes)

// Encrypt with symmetric key
const ciphertext = Zault.encryptWithKey(
    groupKey,            // Uint8Array (32 bytes)
    "Group message!"     // string
);
// Returns: Uint8Array (message.length + 28 bytes overhead)

// Decrypt with symmetric key
const plaintext = Zault.decryptWithKey(
    groupKey,            // Uint8Array (32 bytes)
    ciphertext           // Uint8Array
);
// Returns: string
```

### Digital Signatures

```javascript
// Sign data
const signature = Zault.sign(
    identity,            // Uint8Array - signer's identity
    data                 // Uint8Array - data to sign
);
// Returns: Uint8Array (3309 bytes)

// Verify signature
const isValid = Zault.verify(
    dsaPublicKey,        // Uint8Array - ML-DSA-65 public key
    data,                // Uint8Array - signed data
    signature            // Uint8Array - signature to verify
);
// Returns: boolean
```

### Cryptographic Utilities

```javascript
// SHA3-256 hash
const hash = Zault.sha3_256(data);
// Returns: Uint8Array (32 bytes)

// Random bytes
const random = Zault.randomBytes(32);
// Returns: Uint8Array
```

## Constants

```javascript
Zault.IDENTITY_LEN           // 9577  - Full identity size
Zault.PUBLIC_IDENTITY_LEN    // 3136  - Public identity size
Zault.MLKEM768_PK_LEN        // 1184  - ML-KEM-768 public key
Zault.MLDSA65_PK_LEN         // 1952  - ML-DSA-65 public key
Zault.SIGNATURE_LEN          // 3309  - ML-DSA-65 signature
Zault.MSG_OVERHEAD           // 1116  - ML-KEM encryption overhead
Zault.CHACHA20_OVERHEAD      // 28    - ChaCha20-Poly1305 overhead
Zault.CHACHA20_KEY_LEN       // 32    - Symmetric key size
Zault.HASH_LEN               // 32    - SHA3-256 output
```

## Error Handling

```javascript
try {
    const plaintext = Zault.decryptMessage(identity, ciphertext);
} catch (err) {
    if (err instanceof ZaultError) {
        console.error('Zault error:', err.message, 'code:', err.code);
        // err.code: -1 (invalid param), -4 (auth failed), etc.
    }
}
```

## Usage Patterns

### Identity Persistence

```javascript
import localforage from 'localforage';

// Save identity
await localforage.setItem('identity', identity);

// Load identity
const identity = await localforage.getItem('identity');
if (!identity) {
    // Generate new identity
    identity = Zault.generateIdentity();
    await localforage.setItem('identity', identity);
}
```

### Sharing Identity via URL

```javascript
// Create share link
function createShareLink(identity) {
    const publicIdentity = Zault.serializePublicIdentity(identity);
    const encoded = toBase64Url(publicIdentity);
    return `https://zault.chat/add?id=${encoded}`;
}

// Parse share link
function parseShareLink(url) {
    const params = new URL(url).searchParams;
    const encoded = params.get('id');
    return fromBase64Url(encoded);
}

// Base64URL helpers
function toBase64Url(bytes) {
    return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

function fromBase64Url(str) {
    const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    return new Uint8Array([...atob(base64)].map(c => c.charCodeAt(0)));
}
```

### 1:1 Chat Flow

```javascript
// Alice sends message to Bob
async function sendMessage(myIdentity, bobPublicIdentity, message) {
    const bobKemPk = Zault.parsePublicIdentityKemPk(bobPublicIdentity);
    const ciphertext = Zault.encryptMessage(myIdentity, bobKemPk, message);
    
    // Also encrypt to self for local storage
    const myKemPk = Zault.parsePublicIdentityKemPk(
        Zault.serializePublicIdentity(myIdentity)
    );
    const selfCiphertext = Zault.encryptMessage(myIdentity, myKemPk, message);
    
    return { ciphertext, selfCiphertext };
}

// Bob receives message
function receiveMessage(myIdentity, ciphertext) {
    return Zault.decryptMessage(myIdentity, ciphertext);
}
```

### Group Chat Flow

```javascript
// Create group with initial members
async function createGroup(myIdentity, memberPublicIdentities) {
    const groupKey = Zault.generateGroupKey();
    const encryptedKeys = {};
    
    for (const [memberId, pubId] of Object.entries(memberPublicIdentities)) {
        const kemPk = Zault.parsePublicIdentityKemPk(pubId);
        encryptedKeys[memberId] = Zault.encryptMessage(null, kemPk, groupKey);
    }
    
    return { groupKey, encryptedKeys };
}

// Send group message
function sendGroupMessage(groupKey, message) {
    return Zault.encryptWithKey(groupKey, message);
}

// Receive group message
function receiveGroupMessage(groupKey, ciphertext) {
    return Zault.decryptWithKey(groupKey, ciphertext);
}

// Key rotation on member removal
async function rotateGroupKey(myIdentity, remainingMembers) {
    const newGroupKey = Zault.generateGroupKey();
    const encryptedKeys = {};
    
    for (const [memberId, pubId] of Object.entries(remainingMembers)) {
        const kemPk = Zault.parsePublicIdentityKemPk(pubId);
        encryptedKeys[memberId] = Zault.encryptMessage(null, kemPk, newGroupKey);
    }
    
    return { groupKey: newGroupKey, encryptedKeys };
}
```

## Browser Compatibility

The WASM module works in all modern browsers:

- Chrome 57+
- Firefox 52+
- Safari 11+
- Edge 16+

### Service Worker Usage

```javascript
// In service worker
importScripts('./wasm/zault.js');

self.addEventListener('message', async (event) => {
    if (event.data.type === 'init') {
        await Zault.init();
        event.ports[0].postMessage({ ready: true });
    }
});
```

## Bundle Size

| Build | Size |
|-------|------|
| zault.wasm | ~2MB |
| zault.wasm (gzipped) | ~800KB |

## Security Considerations

1. **Memory**: WASM memory is isolated but not encrypted. Don't leave sensitive data in memory longer than needed.

2. **Random Numbers**: Uses `crypto.getRandomValues()` via WASI `random_get`.

3. **Side Channels**: Zig's crypto implementations are designed to be constant-time, but browser JIT may introduce timing variations.

4. **Key Storage**: Use IndexedDB with appropriate security measures. Consider using the Web Crypto API's `CryptoKey` for additional protection.

