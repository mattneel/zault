/**
 * Group cryptography for Zault
 * 
 * Group keys are distributed via ML-KEM (post-quantum key encapsulation).
 * Group messages are encrypted with ChaCha20-Poly1305 using the shared group key.
 * 
 * Key distribution:
 * - Group creator generates a random 32-byte group key
 * - For each member, the group key is encrypted to their ML-KEM public key
 * - Each member stores their encrypted copy locally
 * - To send a message, decrypt your copy of the group key, then encrypt the message
 * 
 * Key rotation (on member removal):
 * - Generate new group key
 * - Re-encrypt to all remaining members
 * - Increment key version
 * - Old messages remain readable with old key versions (stored locally)
 */

import { getZault } from "./crypto";
import type { Group, GroupMember } from "./storage";
import { 
  storeMyGroupKey, 
  getMyGroupKey, 
  updateGroup, 
  getGroup,
  getIdentityBytes
} from "./storage";

// =============================================================================
// Key Generation & Distribution
// =============================================================================

/**
 * Generate a new random group key
 */
export function generateGroupKey(): Uint8Array {
  const zault = getZault();
  if (!zault) throw new Error("Zault not initialized");
  return zault.generateGroupKey();
}

/**
 * Encrypt a group key for a specific member using their KEM public key
 */
export function encryptGroupKeyForMember(
  groupKey: Uint8Array,
  memberPublicIdentity: Uint8Array
): Uint8Array {
  const zault = getZault();
  if (!zault) throw new Error("Zault not initialized");
  
  const kemPk = zault.parseKemPublicKey(memberPublicIdentity);
  return zault.encryptMessage(kemPk, groupKey);
}

/**
 * Decrypt my copy of the group key
 */
export function decryptGroupKey(
  identity: Uint8Array,
  encryptedKey: Uint8Array
): Uint8Array {
  const zault = getZault();
  if (!zault) throw new Error("Zault not initialized");
  
  return zault.decryptMessage(identity, encryptedKey);
}

// =============================================================================
// Group Creation
// =============================================================================

export interface CreateGroupParams {
  name: string;
  members: Array<{
    id: string;
    name: string;
    publicIdentity: Uint8Array;
    role?: "admin" | "member";
  }>;
  myId: string;
  myPublicIdentity: Uint8Array;
}

/**
 * Create a new group with encrypted keys for all members
 */
export async function createGroup(params: CreateGroupParams): Promise<Group> {
  const { name, members, myId, myPublicIdentity } = params;
  
  // Generate group key
  const groupKey = generateGroupKey();
  
  // Encrypt for each member (including self)
  const encryptedKeys: Record<string, string> = {};
  
  // Add self as admin
  const allMembers: GroupMember[] = [{
    id: myId,
    name: "Me",
    publicIdentity: myPublicIdentity,
    role: "admin",
    joinedAt: Date.now(),
  }];
  
  // Encrypt key for self
  const myEncryptedKey = encryptGroupKeyForMember(groupKey, myPublicIdentity);
  encryptedKeys[myId] = uint8ToBase64(myEncryptedKey);
  
  // Add other members and encrypt keys for them
  for (const member of members) {
    const encryptedKey = encryptGroupKeyForMember(groupKey, member.publicIdentity);
    encryptedKeys[member.id] = uint8ToBase64(encryptedKey);
    
    allMembers.push({
      id: member.id,
      name: member.name,
      publicIdentity: member.publicIdentity,
      role: member.role || "member",
      joinedAt: Date.now(),
    });
  }
  
  const group: Group = {
    id: crypto.randomUUID(),
    name,
    members: allMembers,
    encryptedKeys,
    keyVersion: 1,
    createdAt: Date.now(),
    createdBy: myId,
  };
  
  // Store my encrypted key locally for quick access
  await storeMyGroupKey(group.id, group.keyVersion, encryptedKeys[myId]);
  
  // Zero out the plaintext group key
  groupKey.fill(0);
  
  return group;
}

// =============================================================================
// Member Management
// =============================================================================

/**
 * Add a member to an existing group
 * Only admins should call this
 */
export async function addMemberToGroup(
  groupId: string,
  newMember: {
    id: string;
    name: string;
    publicIdentity: Uint8Array;
  }
): Promise<{ encryptedKeyForNewMember: string }> {
  const identity = getIdentityBytes();
  if (!identity) throw new Error("No identity");
  
  const group = getGroup(groupId);
  if (!group) throw new Error("Group not found");
  
  // Get my encrypted key and decrypt it
  const myEncryptedKey = await getMyGroupKey(groupId, group.keyVersion);
  if (!myEncryptedKey) throw new Error("No group key found");
  
  const groupKey = decryptGroupKey(identity, base64ToUint8(myEncryptedKey));
  
  // Encrypt for new member
  const encryptedKeyForNewMember = encryptGroupKeyForMember(groupKey, newMember.publicIdentity);
  const encryptedKeyBase64 = uint8ToBase64(encryptedKeyForNewMember);
  
  // Update group
  const updatedMembers = [...group.members, {
    id: newMember.id,
    name: newMember.name,
    publicIdentity: newMember.publicIdentity,
    role: "member" as const,
    joinedAt: Date.now(),
  }];
  
  const updatedEncryptedKeys = {
    ...group.encryptedKeys,
    [newMember.id]: encryptedKeyBase64,
  };
  
  await updateGroup(groupId, {
    members: updatedMembers,
    encryptedKeys: updatedEncryptedKeys,
  });
  
  // Zero out plaintext key
  groupKey.fill(0);
  
  return { encryptedKeyForNewMember: encryptedKeyBase64 };
}

/**
 * Remove a member and rotate the group key
 * Only admins should call this
 */
export async function removeMemberFromGroup(
  groupId: string,
  memberId: string,
  myId: string
): Promise<{ newEncryptedKeys: Record<string, string>; newKeyVersion: number }> {
  const identity = getIdentityBytes();
  if (!identity) throw new Error("No identity");
  
  const group = getGroup(groupId);
  if (!group) throw new Error("Group not found");
  
  // Generate NEW group key (key rotation)
  const newGroupKey = generateGroupKey();
  const newKeyVersion = group.keyVersion + 1;
  
  // Filter out removed member
  const remainingMembers = group.members.filter(m => m.id !== memberId);
  
  // Encrypt new key for all remaining members
  const newEncryptedKeys: Record<string, string> = {};
  for (const member of remainingMembers) {
    const encrypted = encryptGroupKeyForMember(newGroupKey, member.publicIdentity);
    newEncryptedKeys[member.id] = uint8ToBase64(encrypted);
  }
  
  // Update group
  await updateGroup(groupId, {
    members: remainingMembers,
    encryptedKeys: newEncryptedKeys,
    keyVersion: newKeyVersion,
  });
  
  // Store my new encrypted key
  await storeMyGroupKey(groupId, newKeyVersion, newEncryptedKeys[myId]);
  
  // Zero out plaintext key
  newGroupKey.fill(0);
  
  return { newEncryptedKeys, newKeyVersion };
}

// =============================================================================
// Message Encryption/Decryption
// =============================================================================

/**
 * Encrypt a message for the group using the current group key
 */
export async function encryptGroupMessage(
  groupId: string,
  plaintext: string
): Promise<{ ciphertext: string; keyVersion: number }> {
  const identity = getIdentityBytes();
  if (!identity) throw new Error("No identity");
  
  const zault = getZault();
  if (!zault) throw new Error("Zault not initialized");
  
  const group = getGroup(groupId);
  if (!group) throw new Error("Group not found");
  
  // Get my encrypted key and decrypt it
  const myEncryptedKey = await getMyGroupKey(groupId, group.keyVersion);
  if (!myEncryptedKey) throw new Error("No group key found");
  
  const groupKey = decryptGroupKey(identity, base64ToUint8(myEncryptedKey));
  
  // Encrypt message with group key (ChaCha20-Poly1305)
  const ciphertext = zault.encryptWithKey(groupKey, plaintext);
  
  // Zero out plaintext key
  groupKey.fill(0);
  
  return {
    ciphertext: uint8ToBase64(ciphertext),
    keyVersion: group.keyVersion,
  };
}

/**
 * Decrypt a group message
 * Uses the key version stored with the message to handle old messages
 */
export async function decryptGroupMessage(
  groupId: string,
  ciphertext: string,
  keyVersion: number
): Promise<string> {
  const identity = getIdentityBytes();
  if (!identity) throw new Error("No identity");
  
  const zault = getZault();
  if (!zault) throw new Error("Zault not initialized");
  
  // Get the appropriate key version
  const myEncryptedKey = await getMyGroupKey(groupId, keyVersion);
  if (!myEncryptedKey) throw new Error(`No group key for version ${keyVersion}`);
  
  const groupKey = decryptGroupKey(identity, base64ToUint8(myEncryptedKey));
  
  // Decrypt message
  const plaintext = zault.decryptWithKeyString(groupKey, base64ToUint8(ciphertext));
  
  // Zero out plaintext key
  groupKey.fill(0);
  
  return plaintext;
}

// =============================================================================
// Helpers
// =============================================================================

function uint8ToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

