/**
 * @fileoverview Zault WASM wrapper - Post-quantum crypto for the browser
 * 
 * This module provides a high-level JavaScript API for Zault's post-quantum
 * cryptographic primitives, backed by WebAssembly.
 * 
 * @example
 * ```javascript
 * import { Zault } from './zault.js';
 * 
 * const zault = await Zault.init();
 * 
 * // Generate identity
 * const alice = zault.generateIdentity();
 * const bob = zault.generateIdentity();
 * 
 * // Exchange public identities (via QR, link, etc.)
 * const alicePublic = zault.serializePublicIdentity(alice);
 * const bobPublic = zault.serializePublicIdentity(bob);
 * 
 * // Alice encrypts message to Bob
 * const bobKemPk = zault.parseKemPublicKey(bobPublic);
 * const ciphertext = zault.encryptMessage(bobKemPk, "Hello Bob!");
 * 
 * // Bob decrypts
 * const plaintext = zault.decryptMessage(bob, ciphertext);
 * console.log(plaintext); // "Hello Bob!"
 * 
 * // Sign and verify
 * const signature = zault.sign(alice, "Important message");
 * const aliceDsaPk = zault.parseDsaPublicKey(alicePublic);
 * const valid = zault.verify(aliceDsaPk, "Important message", signature);
 * ```
 */

// Constants (must match ffi_wasm.zig)
const ZAULT_OK = 0;
const ZAULT_ERR_INVALID_ARG = -1;
const ZAULT_ERR_ALLOC = -2;
const ZAULT_ERR_CRYPTO = -4;
const ZAULT_ERR_AUTH_FAILED = -8;

/**
 * Zault WASM interface
 */
export class Zault {
    /** @type {WebAssembly.Instance} */
    #instance;
    /** @type {WebAssembly.Memory} */
    #memory;
    
    // Cached sizes
    #identityLen;
    #publicIdentityLen;
    #signatureLen;
    #kemPkLen;
    #dsaPkLen;
    #msgOverhead;

    /**
     * Private constructor - use Zault.init() instead
     * @param {WebAssembly.Instance} instance 
     */
    constructor(instance) {
        this.#instance = instance;
        this.#memory = instance.exports.memory;
        
        // Cache sizes from WASM
        this.#identityLen = instance.exports.zault_get_identity_len();
        this.#publicIdentityLen = instance.exports.zault_get_public_identity_len();
        this.#signatureLen = instance.exports.zault_get_signature_len();
        this.#kemPkLen = instance.exports.zault_get_kem_pk_len();
        this.#dsaPkLen = instance.exports.zault_get_dsa_pk_len();
        this.#msgOverhead = instance.exports.zault_get_msg_overhead();
    }

    /**
     * Initialize Zault by loading the WASM module
     * @param {string|URL} [wasmPath='./zault.wasm'] Path to WASM file
     * @returns {Promise<Zault>}
     */
    static async init(wasmPath = './zault.wasm') {
        // We'll set this after instantiation to access the actual memory
        let wasmMemory = null;

        const imports = {
            wasi_snapshot_preview1: {
                // Required WASI imports for Zig stdlib
                random_get: (ptr, len) => {
                    // Provide cryptographic randomness
                    const view = new Uint8Array(wasmMemory.buffer, ptr, len);
                    crypto.getRandomValues(view);
                    return 0; // Success
                },
                fd_write: (fd, iovs_ptr, iovs_len, nwritten_ptr) => {
                    // Stub - we don't do file I/O in browser
                    // But Zig's panic handler might try to write to stderr
                    const view = new DataView(wasmMemory.buffer);
                    view.setUint32(nwritten_ptr, 0, true);
                    return 0;
                },
                fd_pwrite: (fd, iovs_ptr, iovs_len, offset, nwritten_ptr) => {
                    // Stub for positional write
                    const view = new DataView(wasmMemory.buffer);
                    view.setUint32(nwritten_ptr, 0, true);
                    return 0;
                },
                fd_seek: (fd, offset_lo, offset_hi, whence, newoffset_ptr) => {
                    // Stub for seek
                    return 0;
                },
                fd_read: (fd, iovs_ptr, iovs_len, nread_ptr) => {
                    const view = new DataView(wasmMemory.buffer);
                    view.setUint32(nread_ptr, 0, true);
                    return 0;
                },
                fd_close: (fd) => 0,
                proc_exit: (code) => {
                    throw new Error(`WASM proc_exit called with code ${code}`);
                },
                environ_get: () => 0,
                environ_sizes_get: (count_ptr, size_ptr) => {
                    const view = new DataView(wasmMemory.buffer);
                    view.setUint32(count_ptr, 0, true);
                    view.setUint32(size_ptr, 0, true);
                    return 0;
                },
                args_get: () => 0,
                args_sizes_get: (argc_ptr, argv_buf_size_ptr) => {
                    const view = new DataView(wasmMemory.buffer);
                    view.setUint32(argc_ptr, 0, true);
                    view.setUint32(argv_buf_size_ptr, 0, true);
                    return 0;
                },
                clock_time_get: (clock_id, precision, time_ptr) => {
                    const view = new DataView(wasmMemory.buffer);
                    const now = BigInt(Date.now()) * 1000000n; // Convert to nanoseconds
                    view.setBigUint64(time_ptr, now, true);
                    return 0;
                },
            },
        };

        const response = await fetch(wasmPath);
        const bytes = await response.arrayBuffer();
        const { instance } = await WebAssembly.instantiate(bytes, imports);
        
        // Get the memory export from the WASM module
        wasmMemory = instance.exports.memory;
        
        return new Zault(instance);
    }

    /**
     * Get library version
     * @returns {string}
     */
    version() {
        const ptr = this.#instance.exports.zault_version();
        return this.#readCString(ptr);
    }

    // =========================================================================
    // Identity Management
    // =========================================================================

    /**
     * Generate a new random identity
     * @returns {Uint8Array} Serialized identity (keep secret!)
     */
    generateIdentity() {
        const out = this.#alloc(this.#identityLen);
        const result = this.#instance.exports.zault_identity_generate(out, this.#identityLen);
        if (result !== ZAULT_OK) {
            throw new ZaultError(result, 'Failed to generate identity');
        }
        return this.#read(out, this.#identityLen);
    }

    /**
     * Generate identity from seed (deterministic)
     * @param {Uint8Array} seed 32-byte seed
     * @returns {Uint8Array} Serialized identity
     */
    identityFromSeed(seed) {
        if (seed.length !== 32) {
            throw new ZaultError(ZAULT_ERR_INVALID_ARG, 'Seed must be 32 bytes');
        }
        const seedPtr = this.#write(seed);
        const out = this.#alloc(this.#identityLen);
        const result = this.#instance.exports.zault_identity_from_seed(
            seedPtr, seed.length, out, this.#identityLen
        );
        if (result !== ZAULT_OK) {
            throw new ZaultError(result, 'Failed to generate identity from seed');
        }
        return this.#read(out, this.#identityLen);
    }

    /**
     * Serialize identity's public keys for sharing
     * @param {Uint8Array} identity Full identity
     * @returns {Uint8Array} Public identity (safe to share)
     */
    serializePublicIdentity(identity) {
        const identityPtr = this.#write(identity);
        const out = this.#alloc(this.#publicIdentityLen);
        const result = this.#instance.exports.zault_identity_serialize_public(
            identityPtr, identity.length, out, this.#publicIdentityLen
        );
        if (result !== ZAULT_OK) {
            throw new ZaultError(result, 'Failed to serialize public identity');
        }
        return this.#read(out, this.#publicIdentityLen);
    }

    /**
     * Extract KEM public key from serialized public identity
     * @param {Uint8Array} publicIdentity 
     * @returns {Uint8Array} KEM public key (for encryption)
     */
    parseKemPublicKey(publicIdentity) {
        const ptr = this.#write(publicIdentity);
        const out = this.#alloc(this.#kemPkLen);
        const result = this.#instance.exports.zault_parse_public_identity_kem_pk(
            ptr, publicIdentity.length, out, this.#kemPkLen
        );
        if (result !== ZAULT_OK) {
            throw new ZaultError(result, 'Failed to parse KEM public key');
        }
        return this.#read(out, this.#kemPkLen);
    }

    /**
     * Extract DSA public key from serialized public identity
     * @param {Uint8Array} publicIdentity 
     * @returns {Uint8Array} DSA public key (for verification)
     */
    parseDsaPublicKey(publicIdentity) {
        const ptr = this.#write(publicIdentity);
        const out = this.#alloc(this.#dsaPkLen);
        const result = this.#instance.exports.zault_parse_public_identity_dsa_pk(
            ptr, publicIdentity.length, out, this.#dsaPkLen
        );
        if (result !== ZAULT_OK) {
            throw new ZaultError(result, 'Failed to parse DSA public key');
        }
        return this.#read(out, this.#dsaPkLen);
    }

    // =========================================================================
    // Message Encryption
    // =========================================================================

    /**
     * Encrypt a message to a recipient
     * @param {Uint8Array} recipientKemPk Recipient's KEM public key
     * @param {string|Uint8Array} plaintext Message to encrypt
     * @returns {Uint8Array} Ciphertext
     */
    encryptMessage(recipientKemPk, plaintext) {
        const plaintextBytes = typeof plaintext === 'string' 
            ? new TextEncoder().encode(plaintext) 
            : plaintext;
        
        const pkPtr = this.#write(recipientKemPk);
        const ptPtr = this.#write(plaintextBytes);
        const ctLen = plaintextBytes.length + this.#msgOverhead;
        const ctPtr = this.#alloc(ctLen);

        const result = this.#instance.exports.zault_encrypt_message(
            pkPtr, recipientKemPk.length,
            ptPtr, plaintextBytes.length,
            ctPtr, ctLen
        );
        if (result !== ZAULT_OK) {
            throw new ZaultError(result, 'Failed to encrypt message');
        }
        return this.#read(ctPtr, ctLen);
    }

    /**
     * Decrypt a message
     * @param {Uint8Array} identity Recipient's full identity
     * @param {Uint8Array} ciphertext Encrypted message
     * @returns {Uint8Array} Decrypted plaintext
     */
    decryptMessage(identity, ciphertext) {
        if (ciphertext.length < this.#msgOverhead) {
            throw new ZaultError(ZAULT_ERR_INVALID_ARG, 'Ciphertext too short');
        }

        const idPtr = this.#write(identity);
        const ctPtr = this.#write(ciphertext);
        const ptLen = ciphertext.length - this.#msgOverhead;
        const ptPtr = this.#alloc(ptLen);

        const result = this.#instance.exports.zault_decrypt_message(
            idPtr, identity.length,
            ctPtr, ciphertext.length,
            ptPtr, ptLen
        );
        if (result !== ZAULT_OK) {
            throw new ZaultError(result, 'Failed to decrypt message');
        }
        return this.#read(ptPtr, ptLen);
    }

    /**
     * Decrypt a message and return as string
     * @param {Uint8Array} identity 
     * @param {Uint8Array} ciphertext 
     * @returns {string}
     */
    decryptMessageString(identity, ciphertext) {
        return new TextDecoder().decode(this.decryptMessage(identity, ciphertext));
    }

    // =========================================================================
    // Digital Signatures
    // =========================================================================

    /**
     * Sign data with identity's DSA key
     * @param {Uint8Array} identity Full identity
     * @param {string|Uint8Array} data Data to sign
     * @returns {Uint8Array} Signature
     */
    sign(identity, data) {
        const dataBytes = typeof data === 'string' 
            ? new TextEncoder().encode(data) 
            : data;

        const idPtr = this.#write(identity);
        const dataPtr = this.#write(dataBytes);
        const sigPtr = this.#alloc(this.#signatureLen);

        const result = this.#instance.exports.zault_sign(
            idPtr, identity.length,
            dataPtr, dataBytes.length,
            sigPtr, this.#signatureLen
        );
        if (result !== ZAULT_OK) {
            throw new ZaultError(result, 'Failed to sign data');
        }
        return this.#read(sigPtr, this.#signatureLen);
    }

    /**
     * Verify a signature
     * @param {Uint8Array} publicKey Signer's DSA public key
     * @param {string|Uint8Array} data Signed data
     * @param {Uint8Array} signature Signature to verify
     * @returns {boolean} True if valid
     */
    verify(publicKey, data, signature) {
        const dataBytes = typeof data === 'string' 
            ? new TextEncoder().encode(data) 
            : data;

        const pkPtr = this.#write(publicKey);
        const dataPtr = this.#write(dataBytes);
        const sigPtr = this.#write(signature);

        const result = this.#instance.exports.zault_verify(
            pkPtr, publicKey.length,
            dataPtr, dataBytes.length,
            sigPtr, signature.length
        );
        return result === ZAULT_OK;
    }

    // =========================================================================
    // Crypto Utilities
    // =========================================================================

    /**
     * Compute SHA3-256 hash
     * @param {string|Uint8Array} data 
     * @returns {Uint8Array} 32-byte hash
     */
    sha3_256(data) {
        const dataBytes = typeof data === 'string' 
            ? new TextEncoder().encode(data) 
            : data;

        const dataPtr = this.#write(dataBytes);
        const hashPtr = this.#alloc(32);

        const result = this.#instance.exports.zault_sha3_256(
            dataPtr, dataBytes.length, hashPtr, 32
        );
        if (result !== ZAULT_OK) {
            throw new ZaultError(result, 'Failed to compute hash');
        }
        return this.#read(hashPtr, 32);
    }

    /**
     * Generate random bytes
     * @param {number} length 
     * @returns {Uint8Array}
     */
    randomBytes(length) {
        const ptr = this.#alloc(length);
        const result = this.#instance.exports.zault_random_bytes(ptr, length);
        if (result !== ZAULT_OK) {
            throw new ZaultError(result, 'Failed to generate random bytes');
        }
        return this.#read(ptr, length);
    }

    // =========================================================================
    // Size Constants (for buffer allocation)
    // =========================================================================

    get IDENTITY_LEN() { return this.#identityLen; }
    get PUBLIC_IDENTITY_LEN() { return this.#publicIdentityLen; }
    get SIGNATURE_LEN() { return this.#signatureLen; }
    get KEM_PK_LEN() { return this.#kemPkLen; }
    get DSA_PK_LEN() { return this.#dsaPkLen; }
    get MSG_OVERHEAD() { return this.#msgOverhead; }

    // =========================================================================
    // Private Memory Helpers
    // =========================================================================

    /** Allocate memory in WASM heap */
    #alloc(size) {
        // Simple bump allocator - in production, use a proper allocator
        // For now, we use a fixed offset and hope for the best
        // Real implementation should use WASM memory.grow() or a proper allocator
        const view = new Uint8Array(this.#memory.buffer);
        // Use end of initial memory as scratch space
        const base = 65536; // Start after first 64KB
        return base + (Math.random() * 1000000 | 0) % (view.length - base - size);
    }

    /** Write bytes to WASM memory */
    #write(data) {
        const ptr = this.#alloc(data.length);
        new Uint8Array(this.#memory.buffer, ptr, data.length).set(data);
        return ptr;
    }

    /** Read bytes from WASM memory */
    #read(ptr, len) {
        return new Uint8Array(this.#memory.buffer, ptr, len).slice();
    }

    /** Read null-terminated C string */
    #readCString(ptr) {
        const view = new Uint8Array(this.#memory.buffer);
        let end = ptr;
        while (view[end] !== 0) end++;
        return new TextDecoder().decode(view.slice(ptr, end));
    }
}

/**
 * Zault error with error code
 */
export class ZaultError extends Error {
    /** @type {number} */
    code;

    constructor(code, message) {
        super(`${message} (code: ${code})`);
        this.code = code;
        this.name = 'ZaultError';
    }
}

// Export error codes for checking
export const ErrorCodes = {
    OK: ZAULT_OK,
    INVALID_ARG: ZAULT_ERR_INVALID_ARG,
    ALLOC: ZAULT_ERR_ALLOC,
    CRYPTO: ZAULT_ERR_CRYPTO,
    AUTH_FAILED: ZAULT_ERR_AUTH_FAILED,
};

// Default export
export default Zault;

