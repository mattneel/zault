/**
 * CRDT-based message sync for Zault Chat
 * 
 * All messages are stored ENCRYPTED:
 * - Incoming messages: encrypted to our KEM public key
 * - Outgoing messages: ciphertext (encrypted to recipient) + selfCiphertext (encrypted to self)
 * 
 * Sync transfers the `ciphertext` field which is encrypted to the recipient.
 * When syncing outgoing messages TO the recipient, they can decrypt with their key.
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
 * We sync OUTGOING messages (encrypted to the peer) so they can receive
 * messages they missed while offline.
 */
export async function getMissingMessages(
  contactId: string,
  peerClock: VectorClock
): Promise<StoredMessage[]> {
  const messages = await getMessages(contactId);
  const missing: StoredMessage[] = [];
  
  for (const msg of messages) {
    // Only sync OUTGOING messages - they're encrypted to the peer
    // Incoming messages are encrypted to US, peer can't decrypt them
    if (msg.incoming) continue;
    
    // Check if peer has seen this message
    // Our outgoing = their incoming, so check "them" in peer's clock
    const peerLastSeen = peerClock["them"] || 0;
    
    if (msg.timestamp > peerLastSeen) {
      // Send only the ciphertext (encrypted to peer), not selfCiphertext
      missing.push({
        ...msg,
        selfCiphertext: undefined, // Don't send our self-encrypted copy
      });
    }
  }
  
  return missing;
}

/**
 * Merge incoming messages with local state
 * 
 * Synced messages are OUTGOING messages from peer's perspective,
 * which means they're encrypted to US. We store them as INCOMING.
 */
export async function mergeMessages(
  contactId: string,
  incoming: StoredMessage[]
): Promise<StoredMessage[]> {
  const { addMessage } = await import("./storage");
  const existing = await getMessages(contactId);
  const existingIds = new Set(existing.map((m) => m.id));
  const added: StoredMessage[] = [];
  
  for (const msg of incoming) {
    if (existingIds.has(msg.id)) continue;
    
    // Their outgoing (encrypted to us) becomes our incoming
    const storedMsg: StoredMessage = {
      id: msg.id,
      contactId,
      ciphertext: msg.ciphertext, // This is encrypted to US
      timestamp: msg.timestamp,
      incoming: true, // Flip: their outgoing = our incoming
      status: "delivered",
    };
    
    await addMessage(storedMsg);
    added.push(storedMsg);
  }
  
  return added;
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
