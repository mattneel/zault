/**
 * CRDT-based message sync for Zault Chat
 * 
 * NOTE: Message sync is currently DISABLED for E2E encrypted chats.
 * 
 * The fundamental problem with syncing E2E messages:
 * - Each message is encrypted to ONE recipient's public key
 * - The sender stores plaintext locally (for display)
 * - The recipient stores ciphertext (encrypted to them)
 * - You can't "sync" a message encrypted to Alice to Bob - Bob can't decrypt it
 * 
 * Future solutions:
 * 1. Store the ciphertext on sender side too (doubles storage)
 * 2. Use a shared secret between peers (changes the crypto model)
 * 3. Server-side message queue (messages wait until recipient is online)
 * 
 * For now, messages are delivered in real-time only. If recipient is offline,
 * they miss the message. This is a known limitation of the current design.
 */

import { getMessages, type StoredMessage } from "./storage";

// Vector clock: sender -> last timestamp
export interface VectorClock {
  [sender: string]: number;
}

// Sync state per contact
export interface SyncState {
  pendingSync: boolean;
}

// Global sync state
const syncStates = new Map<string, SyncState>();

/**
 * Get or create sync state for a contact
 */
export function getSyncState(contactId: string): SyncState {
  let state = syncStates.get(contactId);
  if (!state) {
    state = { pendingSync: true };
    syncStates.set(contactId, state);
  }
  return state;
}

/**
 * Build vector clock from local messages
 */
export async function buildVectorClock(contactId: string): Promise<VectorClock> {
  const messages = await getMessages(contactId);
  const clock: VectorClock = {};
  
  for (const msg of messages) {
    const sender = msg.incoming ? "them" : "me";
    if (!clock[sender] || msg.timestamp > clock[sender]) {
      clock[sender] = msg.timestamp;
    }
  }
  
  return clock;
}

/**
 * Get messages that peer is missing based on their vector clock
 * 
 * DISABLED: E2E encrypted messages can't be synced between peers.
 * Each message is encrypted to one recipient only.
 */
export async function getMissingMessages(
  contactId: string,
  peerClock: VectorClock
): Promise<StoredMessage[]> {
  // Sync is disabled - return empty array
  return [];
}

/**
 * Merge incoming messages with local state
 * 
 * DISABLED: E2E encrypted messages can't be synced between peers.
 */
export async function mergeMessages(
  contactId: string,
  incoming: StoredMessage[]
): Promise<StoredMessage[]> {
  // Sync is disabled - nothing to merge
  return [];
}

/**
 * Create a sync request
 */
export async function createSyncRequest(contactId: string): Promise<{
  type: "sync_request";
  vectorClock: VectorClock;
}> {
  const clock = await buildVectorClock(contactId);
  return {
    type: "sync_request",
    vectorClock: clock,
  };
}

/**
 * Create a sync response with encrypted messages peer is missing
 */
export async function createSyncResponse(
  contactId: string,
  peerClock: VectorClock
): Promise<{
  type: "sync_response";
  vectorClock: VectorClock;
  messages: StoredMessage[];
}> {
  const ourClock = await buildVectorClock(contactId);
  const missing = await getMissingMessages(contactId, peerClock);
  
  return {
    type: "sync_response",
    vectorClock: ourClock,
    messages: missing,
  };
}

/**
 * Handle incoming sync response - merge encrypted messages
 */
export async function handleSyncResponse(
  contactId: string,
  messages: StoredMessage[]
): Promise<StoredMessage[]> {
  return mergeMessages(contactId, messages);
}

/**
 * Mark sync as complete for a contact
 */
export function markSynced(contactId: string): void {
  const state = getSyncState(contactId);
  state.pendingSync = false;
}

/**
 * Check if sync is needed for a contact
 */
export function needsSync(contactId: string): boolean {
  const state = getSyncState(contactId);
  return state.pendingSync;
}

/**
 * Request sync on next connection
 */
export function requestSync(contactId: string): void {
  const state = getSyncState(contactId);
  state.pendingSync = true;
}
