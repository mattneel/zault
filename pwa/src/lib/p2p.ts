/**
 * WebSocket-based P2P transport for Zault Chat
 * 
 * Messages are stored and transferred ENCRYPTED.
 * Includes CRDT-style sync for offline message recovery.
 */
import { createSignal } from "solid-js";
import { isServer } from "solid-js/web";
import { 
  createSyncRequest, 
  createSyncResponse, 
  handleSyncResponse,
  markSynced,
  needsSync,
  type VectorClock,
} from "./sync";
import type { StoredMessage } from "./storage";

// Message types
export interface P2PMessage {
  type: "chat";
  from: string;
  to: string;
  ciphertext: string; // base64 encoded encrypted content
  timestamp: number;
  id: string;
}

// Group message (encrypted with group key)
export interface P2PGroupMessage {
  type: "group_chat";
  from: string;
  groupId: string;
  ciphertext: string; // base64 encoded (encrypted with group key)
  timestamp: number;
  id: string;
  keyVersion: number;
}

// Group key distribution message
export interface P2PGroupKeyMessage {
  type: "group_key";
  from: string;
  to: string;
  groupId: string;
  encryptedKey: string; // base64 encoded (encrypted to recipient's KEM pk)
  keyVersion: number;
  groupName: string;
  memberIds: string[];
}

// Group membership update
export interface P2PGroupUpdateMessage {
  type: "group_update";
  from: string;
  groupId: string;
  action: "member_added" | "member_removed" | "key_rotated";
  memberId?: string;
  memberName?: string;
  newEncryptedKey?: string; // For key rotation, encrypted to each recipient
  keyVersion: number;
}

// Connection state
export type ConnectionState = "disconnected" | "connecting" | "connected";

// Signals for reactive state
const [connectionState, setConnectionState] = createSignal<ConnectionState>("disconnected");
const [peerId, setPeerId] = createSignal<string | null>(null);
const [peerCount, setPeerCount] = createSignal(0);
const [onlinePeers, setOnlinePeers] = createSignal<string[]>([]);

export { connectionState, peerId, peerCount, onlinePeers };

// WebSocket connection
let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;
let currentZaultId: string | null = null;

// Message handlers
type MessageHandler = (msg: P2PMessage) => void;
type GroupMessageHandler = (msg: P2PGroupMessage) => void;
type GroupKeyHandler = (msg: P2PGroupKeyMessage) => void;
type GroupUpdateHandler = (msg: P2PGroupUpdateMessage) => void;
type SyncHandler = (contactId: string, messages: StoredMessage[]) => void;

const messageHandlers: Set<MessageHandler> = new Set();
const groupMessageHandlers: Set<GroupMessageHandler> = new Set();
const groupKeyHandlers: Set<GroupKeyHandler> = new Set();
const groupUpdateHandlers: Set<GroupUpdateHandler> = new Set();
const syncHandlers: Set<SyncHandler> = new Set();

/**
 * Get WebSocket URL based on current location
 */
function getWsUrl(): string {
  if (isServer) return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/_ws`;
}

/**
 * Initialize WebSocket connection
 */
export async function initP2P(zaultId: string): Promise<void> {
  if (isServer) return;
  
  if (ws && ws.readyState === WebSocket.OPEN) {
    console.log("[P2P] Already connected");
    return;
  }

  currentZaultId = zaultId;
  setConnectionState("connecting");
  setPeerId(zaultId);

  return new Promise((resolve, reject) => {
    try {
      ws = new WebSocket(getWsUrl());

      ws.onopen = () => {
        console.log("[P2P] WebSocket connected");
        
        // Register our Zault ID
        ws!.send(JSON.stringify({
          type: "register",
          from: zaultId,
          timestamp: Date.now(),
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleServerMessage(data, zaultId, resolve);
        } catch (err) {
          console.error("[P2P] Failed to parse message:", err);
        }
      };

      ws.onclose = () => {
        console.log("[P2P] WebSocket closed");
        setConnectionState("disconnected");
        setOnlinePeers([]);
        ws = null;
        
        // Auto-reconnect after 3 seconds
        if (currentZaultId && !reconnectTimer) {
          reconnectTimer = window.setTimeout(() => {
            reconnectTimer = null;
            if (currentZaultId) {
              console.log("[P2P] Reconnecting...");
              initP2P(currentZaultId);
            }
          }, 3000);
        }
      };

      ws.onerror = (err) => {
        console.error("[P2P] WebSocket error:", err);
        reject(err);
      };

    } catch (err) {
      setConnectionState("disconnected");
      reject(err);
    }
  });
}

/**
 * Handle messages from the server
 */
function handleServerMessage(data: any, zaultId: string, resolveInit?: () => void) {
  switch (data.type) {
    case "registered":
      console.log("[P2P] Registered, peers online:", data.peersOnline);
      setConnectionState("connected");
      setPeerCount(data.peersOnline);
      setOnlinePeers(data.onlinePeers || []);
      resolveInit?.();
      
      // Initiate sync with online peers
      for (const peerId of data.onlinePeers || []) {
        if (needsSync(peerId)) {
          requestSyncWithPeer(peerId);
        }
      }
      break;

    case "peer_online":
      console.log("[P2P] Peer came online:", data.peerId);
      setOnlinePeers((prev) => [...prev.filter(id => id !== data.peerId), data.peerId]);
      setPeerCount((prev) => prev + 1);
      
      // Initiate sync with newly online peer
      if (needsSync(data.peerId)) {
        requestSyncWithPeer(data.peerId);
      }
      break;

    case "peer_offline":
      console.log("[P2P] Peer went offline:", data.peerId);
      setOnlinePeers((prev) => prev.filter(id => id !== data.peerId));
      setPeerCount((prev) => Math.max(0, prev - 1));
      break;

    case "message":
      console.log("[P2P] Received message from:", data.from);
      const payloadData = JSON.parse(data.payload);
      const msg: P2PMessage = {
        type: "chat",
        from: data.from,
        to: data.to || zaultId,
        ciphertext: payloadData.ciphertext,
        timestamp: payloadData.timestamp,
        id: payloadData.id,
      };
      messageHandlers.forEach((handler) => handler(msg));
      break;

    case "group_message":
      console.log("[P2P] Received group message from:", data.from, "for group:", data.groupId);
      const groupPayload = JSON.parse(data.payload);
      const groupMsg: P2PGroupMessage = {
        type: "group_chat",
        from: data.from,
        groupId: data.groupId,
        ciphertext: groupPayload.ciphertext,
        timestamp: groupPayload.timestamp,
        id: groupPayload.id,
        keyVersion: groupPayload.keyVersion,
      };
      groupMessageHandlers.forEach((handler) => handler(groupMsg));
      break;

    case "group_key":
      console.log("[P2P] Received group key from:", data.from, "for group:", data.groupId);
      const keyPayload = JSON.parse(data.payload);
      const keyMsg: P2PGroupKeyMessage = {
        type: "group_key",
        from: data.from,
        to: data.to,
        groupId: data.groupId,
        encryptedKey: keyPayload.encryptedKey,
        keyVersion: keyPayload.keyVersion,
        groupName: keyPayload.groupName,
        memberIds: keyPayload.memberIds,
      };
      groupKeyHandlers.forEach((handler) => handler(keyMsg));
      break;

    case "group_update":
      console.log("[P2P] Received group update from:", data.from, "for group:", data.groupId);
      const updatePayload = JSON.parse(data.payload);
      const updateMsg: P2PGroupUpdateMessage = {
        type: "group_update",
        from: data.from,
        groupId: data.groupId,
        action: updatePayload.action,
        memberId: updatePayload.memberId,
        memberName: updatePayload.memberName,
        newEncryptedKey: updatePayload.newEncryptedKey,
        keyVersion: updatePayload.keyVersion,
      };
      groupUpdateHandlers.forEach((handler) => handler(updateMsg));
      break;

    case "sync_request":
      console.log("[P2P] Sync request from:", data.from);
      handleIncomingSyncRequest(data.from, JSON.parse(data.payload));
      break;

    case "sync_response":
      console.log("[P2P] Sync response from:", data.from);
      handleIncomingSyncResponse(data.from, JSON.parse(data.payload));
      break;

    case "delivered":
      console.log("[P2P] Message delivered to:", data.to);
      break;

    case "offline":
      console.log("[P2P] Recipient offline:", data.to);
      break;

    default:
      console.log("[P2P] Unknown message type:", data.type);
  }
}

/**
 * Request sync with a peer
 */
async function requestSyncWithPeer(contactId: string): Promise<void> {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  
  const syncReq = await createSyncRequest(contactId);
  console.log("[P2P] Requesting sync with:", contactId);
  
  ws.send(JSON.stringify({
    type: "sync_request",
    from: currentZaultId,
    to: contactId,
    payload: JSON.stringify(syncReq),
    timestamp: Date.now(),
  }));
}

/**
 * Handle incoming sync request - send our encrypted messages
 */
async function handleIncomingSyncRequest(from: string, request: { vectorClock: VectorClock }): Promise<void> {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  
  const syncResp = await createSyncResponse(from, request.vectorClock);
  console.log("[P2P] Sending sync response to:", from, "with", syncResp.messages.length, "encrypted messages");
  
  ws.send(JSON.stringify({
    type: "sync_response",
    from: currentZaultId,
    to: from,
    payload: JSON.stringify(syncResp),
    timestamp: Date.now(),
  }));
}

/**
 * Handle incoming sync response - merge encrypted messages
 */
async function handleIncomingSyncResponse(from: string, response: { messages: StoredMessage[], vectorClock: VectorClock }): Promise<void> {
  const added = await handleSyncResponse(from, response.messages);
  console.log("[P2P] Synced", added.length, "encrypted messages from:", from);
  
  markSynced(from);
  
  // Notify handlers of new synced messages
  if (added.length > 0) {
    syncHandlers.forEach((handler) => handler(from, added));
  }
}

/**
 * Send an encrypted message via WebSocket
 */
export async function sendMessage(msg: P2PMessage): Promise<void> {
  if (isServer || !ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("[P2P] Cannot send - not connected");
    return;
  }

  ws.send(JSON.stringify({
    type: "message",
    from: msg.from,
    to: msg.to,
    payload: JSON.stringify({
      id: msg.id,
      ciphertext: msg.ciphertext,
      timestamp: msg.timestamp,
    }),
    timestamp: msg.timestamp,
  }));

  console.log("[P2P] Sent message:", msg.id);
}

/**
 * Register a message handler
 */
export function onMessage(handler: MessageHandler): () => void {
  messageHandlers.add(handler);
  return () => messageHandlers.delete(handler);
}

/**
 * Register a sync handler (called when encrypted messages are synced)
 */
export function onSync(handler: SyncHandler): () => void {
  syncHandlers.add(handler);
  return () => syncHandlers.delete(handler);
}

/**
 * Register a group message handler
 */
export function onGroupMessage(handler: GroupMessageHandler): () => void {
  groupMessageHandlers.add(handler);
  return () => groupMessageHandlers.delete(handler);
}

/**
 * Register a group key handler (for receiving group invites)
 */
export function onGroupKey(handler: GroupKeyHandler): () => void {
  groupKeyHandlers.add(handler);
  return () => groupKeyHandlers.delete(handler);
}

/**
 * Register a group update handler
 */
export function onGroupUpdate(handler: GroupUpdateHandler): () => void {
  groupUpdateHandlers.add(handler);
  return () => groupUpdateHandlers.delete(handler);
}

/**
 * Send an encrypted group message
 */
export async function sendGroupMessage(msg: P2PGroupMessage, memberIds: string[]): Promise<void> {
  if (isServer || !ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("[P2P] Cannot send - not connected");
    return;
  }

  // Send to each member (broadcast)
  for (const memberId of memberIds) {
    if (memberId === currentZaultId) continue; // Don't send to self
    
    ws.send(JSON.stringify({
      type: "group_message",
      from: msg.from,
      to: memberId,
      groupId: msg.groupId,
      payload: JSON.stringify({
        id: msg.id,
        ciphertext: msg.ciphertext,
        timestamp: msg.timestamp,
        keyVersion: msg.keyVersion,
      }),
      timestamp: msg.timestamp,
    }));
  }

  console.log("[P2P] Sent group message:", msg.id, "to", memberIds.length - 1, "members");
}

/**
 * Send a group key to a member (for invites or key rotation)
 */
export async function sendGroupKey(msg: P2PGroupKeyMessage): Promise<void> {
  if (isServer || !ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("[P2P] Cannot send - not connected");
    return;
  }

  ws.send(JSON.stringify({
    type: "group_key",
    from: msg.from,
    to: msg.to,
    groupId: msg.groupId,
    payload: JSON.stringify({
      encryptedKey: msg.encryptedKey,
      keyVersion: msg.keyVersion,
      groupName: msg.groupName,
      memberIds: msg.memberIds,
    }),
    timestamp: Date.now(),
  }));

  console.log("[P2P] Sent group key for:", msg.groupId, "to:", msg.to);
}

/**
 * Broadcast group update to all members
 */
export async function sendGroupUpdate(msg: P2PGroupUpdateMessage, memberIds: string[]): Promise<void> {
  if (isServer || !ws || ws.readyState !== WebSocket.OPEN) {
    console.warn("[P2P] Cannot send - not connected");
    return;
  }

  for (const memberId of memberIds) {
    if (memberId === currentZaultId) continue;
    
    ws.send(JSON.stringify({
      type: "group_update",
      from: msg.from,
      to: memberId,
      groupId: msg.groupId,
      payload: JSON.stringify({
        action: msg.action,
        memberId: msg.memberId,
        memberName: msg.memberName,
        newEncryptedKey: msg.newEncryptedKey,
        keyVersion: msg.keyVersion,
      }),
      timestamp: Date.now(),
    }));
  }

  console.log("[P2P] Sent group update:", msg.action, "to", memberIds.length - 1, "members");
}

/**
 * Check if a peer is online
 */
export function isPeerOnline(peerId: string): boolean {
  return onlinePeers().includes(peerId);
}

/**
 * Stop the P2P connection
 */
export async function stopP2P(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  
  currentZaultId = null;
  
  if (ws) {
    ws.close();
    ws = null;
  }
  
  setConnectionState("disconnected");
  setPeerId(null);
  setPeerCount(0);
  setOnlinePeers([]);
}

/**
 * Check if P2P is ready
 */
export function isP2PReady(): boolean {
  if (isServer) return false;
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

/**
 * Get multiaddrs (not used with WebSocket)
 */
export function getMultiaddrs(): string[] {
  return [];
}
