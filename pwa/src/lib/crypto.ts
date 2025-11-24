/**
 * Zault WASM crypto wrapper for SolidJS
 */
import { createSignal, createResource } from "solid-js";
import { Zault } from "./zault.js";

// Singleton WASM instance
let zaultInstance: Zault | null = null;

// Loading state
const [isLoading, setIsLoading] = createSignal(true);
const [loadError, setLoadError] = createSignal<string | null>(null);

/**
 * Initialize the WASM module
 */
export async function initZault(): Promise<Zault> {
  if (zaultInstance) return zaultInstance;

  try {
    setIsLoading(true);
    setLoadError(null);
    zaultInstance = await Zault.init("/zault.wasm");
    console.log(`[Zault] Loaded ${zaultInstance.version()}`);
    return zaultInstance;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to load WASM";
    setLoadError(msg);
    throw err;
  } finally {
    setIsLoading(false);
  }
}

/**
 * Get the WASM instance (throws if not initialized)
 */
export function getZault(): Zault {
  if (!zaultInstance) {
    throw new Error("Zault WASM not initialized. Call initZault() first.");
  }
  return zaultInstance;
}

/**
 * Check if WASM is ready
 */
export function isZaultReady(): boolean {
  return zaultInstance !== null;
}

// Export loading state
export { isLoading, loadError };

// Re-export types
export { Zault, ZaultError, ErrorCodes } from "./zault.js";

/**
 * Helper: Generate a new identity
 */
export function generateIdentity(): Uint8Array {
  return getZault().generateIdentity();
}

/**
 * Helper: Get public identity from full identity
 */
export function getPublicIdentity(identity: Uint8Array): Uint8Array {
  return getZault().serializePublicIdentity(identity);
}

/**
 * Helper: Get short ID from public identity (first 8 bytes of DSA pk as hex)
 */
export function getShortId(publicIdentity: Uint8Array): string {
  const dsaPk = getZault().parseDsaPublicKey(publicIdentity);
  return Array.from(dsaPk.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Helper: Encrypt message to recipient
 */
export function encryptMessage(
  recipientPublicIdentity: Uint8Array,
  plaintext: string
): Uint8Array {
  const kemPk = getZault().parseKemPublicKey(recipientPublicIdentity);
  return getZault().encryptMessage(kemPk, plaintext);
}

/**
 * Helper: Encrypt message to self (for storing outgoing messages encrypted)
 */
export function encryptToSelf(
  identity: Uint8Array,
  plaintext: string
): Uint8Array {
  const publicIdentity = getZault().serializePublicIdentity(identity);
  const kemPk = getZault().parseKemPublicKey(publicIdentity);
  return getZault().encryptMessage(kemPk, plaintext);
}

/**
 * Helper: Decrypt message
 */
export function decryptMessage(
  identity: Uint8Array,
  ciphertext: Uint8Array
): string {
  return getZault().decryptMessageString(identity, ciphertext);
}

/**
 * Helper: Sign data
 */
export function sign(identity: Uint8Array, data: string): Uint8Array {
  return getZault().sign(identity, data);
}

/**
 * Helper: Verify signature
 */
export function verify(
  publicIdentity: Uint8Array,
  data: string,
  signature: Uint8Array
): boolean {
  const dsaPk = getZault().parseDsaPublicKey(publicIdentity);
  return getZault().verify(dsaPk, data, signature);
}

/**
 * Helper: Encode bytes to base64url (for sharing)
 */
export function toBase64Url(bytes: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Helper: Decode base64url to bytes
 */
export function fromBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}


