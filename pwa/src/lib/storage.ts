/**
 * IndexedDB storage for Zault identity and messages
 * 
 * Messages are stored ENCRYPTED. Decryption only happens at render time.
 */
import { createSignal } from "solid-js";
import { isServer } from "solid-js/web";

// Types
export interface Contact {
  id: string; // hex of DSA public key prefix
  name: string;
  publicIdentity: Uint8Array; // Full serialized public identity
  addedAt: number;
}

// Messages stored with encrypted content
export interface StoredMessage {
  id: string;
  contactId: string;
  ciphertext: string; // base64 encoded encrypted content
  timestamp: number;
  incoming: boolean;
  status: "pending" | "sent" | "delivered" | "read";
}

// Group member
export interface GroupMember {
  id: string; // contact id (hex of DSA pk prefix)
  name: string;
  publicIdentity: Uint8Array;
  role: "admin" | "member";
  joinedAt: number;
}

// Group with encrypted keys per member
export interface Group {
  id: string;
  name: string;
  members: GroupMember[];
  // Each member's copy of the group key, encrypted to their ML-KEM pk
  // Map<memberId, base64-encoded encrypted key>
  encryptedKeys: Record<string, string>;
  keyVersion: number;
  createdAt: number;
  createdBy: string; // creator's contact id
}

// Group messages stored encrypted with group key
export interface StoredGroupMessage {
  id: string;
  groupId: string;
  senderId: string; // contact id of sender
  ciphertext: string; // base64 encoded (encrypted with group key)
  timestamp: number;
  keyVersion: number; // which key version was used
}

// Custom serializer for Uint8Array
const uint8ArraySerializer = {
  serialize: (value: Uint8Array | null): string | null => {
    if (!value) return null;
    return btoa(String.fromCharCode(...value));
  },
  deserialize: (value: string | null): Uint8Array | null => {
    if (!value) return null;
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  },
};

// Lazy localforage instance
let localforageInstance: any = null;

async function getLocalForage() {
  if (isServer) return null;
  if (!localforageInstance) {
    const localforage = (await import("localforage")).default;
    localforage.config({
      name: "zault-chat",
      storeName: "zault_store",
      description: "Zault encrypted chat storage",
    });
    localforageInstance = localforage;
  }
  return localforageInstance;
}

// Simple persisted signal
function createPersistedSignal<T>(key: string, defaultValue: T) {
  const [value, setValue] = createSignal<T>(defaultValue);

  // Load from storage on client
  if (!isServer) {
    getLocalForage().then(async (lf) => {
      if (lf) {
        const stored = await lf.getItem<T>(key);
        if (stored !== null) {
          setValue(() => stored as T);
        }
      }
    });
  }

  // Wrapper that persists on set
  const setAndPersist = async (newValue: T | ((prev: T) => T)) => {
    const resolved = typeof newValue === "function"
      ? (newValue as (prev: T) => T)(value())
      : newValue;
    setValue(() => resolved as T);

    if (!isServer) {
      const lf = await getLocalForage();
      if (lf) {
        await lf.setItem(key, resolved);
      }
    }
  };

  return [value, setAndPersist] as const;
}

// Persisted identity (secret - stored in IndexedDB)
const [identityRaw, setIdentityRaw] = createPersistedSignal<string | null>("identity", null);

// Export for reactivity tracking
export { identityRaw };

// Helper to get/set identity as Uint8Array
export function getIdentityBytes(): Uint8Array | null {
  const raw = identityRaw();
  return raw ? uint8ArraySerializer.deserialize(raw) : null;
}

export async function setIdentityBytes(bytes: Uint8Array | null) {
  await setIdentityRaw(bytes ? uint8ArraySerializer.serialize(bytes) : null);
}

// Persisted contacts
const [contactsRaw, setContactsRaw] = createPersistedSignal<string>("contacts", "[]");

// Helper to get/set contacts
export function getContacts(): Contact[] {
  try {
    const raw = contactsRaw();
    const parsed = JSON.parse(raw || "[]");
    return parsed.map((c: any) => ({
      ...c,
      publicIdentity: uint8ArraySerializer.deserialize(c.publicIdentity),
    }));
  } catch {
    return [];
  }
}

export async function setContactsList(list: Contact[]) {
  const serialized = list.map((c) => ({
    ...c,
    publicIdentity: uint8ArraySerializer.serialize(c.publicIdentity),
  }));
  await setContactsRaw(JSON.stringify(serialized));
}

export async function addContact(contact: Contact) {
  const current = getContacts();
  if (!current.find((c) => c.id === contact.id)) {
    await setContactsList([...current, contact]);
  }
}

// Persisted messages (per contact) - stored ENCRYPTED
export async function getMessages(contactId: string): Promise<StoredMessage[]> {
  if (isServer) return [];
  const lf = await getLocalForage();
  if (!lf) return [];
  const raw = await lf.getItem<string>(`messages:${contactId}`);
  return raw ? JSON.parse(raw) : [];
}

export async function addMessage(message: StoredMessage) {
  if (isServer) return;
  const lf = await getLocalForage();
  if (!lf) return;
  const messages = await getMessages(message.contactId);
  
  // Don't add duplicates
  if (messages.find(m => m.id === message.id)) return;
  
  messages.push(message);
  await lf.setItem(`messages:${message.contactId}`, JSON.stringify(messages));
}

export async function updateMessageStatus(contactId: string, messageId: string, status: StoredMessage["status"]) {
  if (isServer) return;
  const lf = await getLocalForage();
  if (!lf) return;
  const messages = await getMessages(contactId);
  const updated = messages.map(m => 
    m.id === messageId ? { ...m, status } : m
  );
  await lf.setItem(`messages:${contactId}`, JSON.stringify(updated));
}

export async function clearAllData() {
  if (isServer) return;
  const lf = await getLocalForage();
  if (lf) {
    await lf.clear();
  }
  // Reset in-memory signals
  setIdentityRaw(null);
  setContactsRaw("[]");
}

// =============================================================================
// Group Storage
// =============================================================================

// Persisted groups
const [groupsRaw, setGroupsRaw] = createPersistedSignal<string>("groups", "[]");

// Helper to serialize/deserialize groups with Uint8Array members
function serializeGroup(group: Group): any {
  return {
    ...group,
    members: group.members.map(m => ({
      ...m,
      publicIdentity: uint8ArraySerializer.serialize(m.publicIdentity),
    })),
  };
}

function deserializeGroup(raw: any): Group {
  return {
    ...raw,
    members: raw.members.map((m: any) => ({
      ...m,
      publicIdentity: uint8ArraySerializer.deserialize(m.publicIdentity),
    })),
  };
}

export function getGroups(): Group[] {
  try {
    const raw = groupsRaw();
    const parsed = JSON.parse(raw || "[]");
    return parsed.map(deserializeGroup);
  } catch {
    return [];
  }
}

export async function setGroupsList(list: Group[]) {
  const serialized = list.map(serializeGroup);
  await setGroupsRaw(JSON.stringify(serialized));
}

export async function addGroup(group: Group) {
  const current = getGroups();
  if (!current.find(g => g.id === group.id)) {
    await setGroupsList([...current, group]);
  }
}

export async function updateGroup(groupId: string, updates: Partial<Group>) {
  const current = getGroups();
  const updated = current.map(g => 
    g.id === groupId ? { ...g, ...updates } : g
  );
  await setGroupsList(updated);
}

export async function deleteGroup(groupId: string) {
  const current = getGroups();
  await setGroupsList(current.filter(g => g.id !== groupId));
  
  // Also delete group messages
  if (!isServer) {
    const lf = await getLocalForage();
    if (lf) {
      await lf.removeItem(`group-messages:${groupId}`);
    }
  }
}

export function getGroup(groupId: string): Group | undefined {
  return getGroups().find(g => g.id === groupId);
}

// Group messages
export async function getGroupMessages(groupId: string): Promise<StoredGroupMessage[]> {
  if (isServer) return [];
  const lf = await getLocalForage();
  if (!lf) return [];
  const raw = await lf.getItem<string>(`group-messages:${groupId}`);
  return raw ? JSON.parse(raw) : [];
}

export async function addGroupMessage(message: StoredGroupMessage) {
  if (isServer) return;
  const lf = await getLocalForage();
  if (!lf) return;
  const messages = await getGroupMessages(message.groupId);
  
  // Don't add duplicates
  if (messages.find(m => m.id === message.id)) return;
  
  messages.push(message);
  await lf.setItem(`group-messages:${message.groupId}`, JSON.stringify(messages));
}

// Store my encrypted copy of a group key (encrypted to my KEM pk)
// This is what I decrypt to get the actual group key
export async function storeMyGroupKey(groupId: string, keyVersion: number, encryptedKey: string) {
  if (isServer) return;
  const lf = await getLocalForage();
  if (!lf) return;
  
  // Store as map of version -> encrypted key
  const key = `my-group-keys:${groupId}`;
  const existing = await lf.getItem<Record<number, string>>(key) || {};
  existing[keyVersion] = encryptedKey;
  await lf.setItem(key, existing);
}

export async function getMyGroupKey(groupId: string, keyVersion: number): Promise<string | null> {
  if (isServer) return null;
  const lf = await getLocalForage();
  if (!lf) return null;
  
  const keys = await lf.getItem<Record<number, string>>(`my-group-keys:${groupId}`);
  return keys?.[keyVersion] || null;
}

// Get all my group key versions (for reading old messages)
export async function getAllMyGroupKeys(groupId: string): Promise<Record<number, string>> {
  if (isServer) return {};
  const lf = await getLocalForage();
  if (!lf) return {};
  
  return await lf.getItem<Record<number, string>>(`my-group-keys:${groupId}`) || {};
}
