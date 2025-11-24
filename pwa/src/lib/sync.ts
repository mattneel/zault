/**
 * CRDT-based message sync for Zault Chat
 * 
 * Messages are stored and synced ENCRYPTED.
 * Uses vector clocks to track what each peer has seen.
 */

import { getMessages, addMessage, type StoredMessage } from "./storage";

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
 * Returns the full encrypted messages for sync
 */
export async function getMissingMessages(
  contactId: string,
  peerClock: VectorClock
): Promise<StoredMessage[]> {
  const messages = await getMessages(contactId);
  const missing: StoredMessage[] = [];
  
  for (const msg of messages) {
    // From our perspective: our outgoing = peer's incoming
    // So "me" in our clock = "them" in peer's clock
    const peerSender = msg.incoming ? "me" : "them";
    const peerLastSeen = peerClock[peerSender] || 0;
    
    if (msg.timestamp > peerLastSeen) {
      missing.push(msg);
    }
  }
  
  return missing;
}

/**
 * Merge incoming messages with local state
 * Messages come with flipped incoming flag (their outgoing = our incoming)
 */
export async function mergeMessages(
  contactId: string,
  incoming: StoredMessage[]
): Promise<StoredMessage[]> {
  const existing = await getMessages(contactId);
  const existingIds = new Set(existing.map((m) => m.id));
  const added: StoredMessage[] = [];
  
  for (const msg of incoming) {
    if (existingIds.has(msg.id)) continue;
    
    // Flip the incoming flag - their perspective is opposite of ours
    const flippedMsg: StoredMessage = {
      ...msg,
      contactId,
      incoming: !msg.incoming,
    };
    
    await addMessage(flippedMsg);
    added.push(flippedMsg);
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
