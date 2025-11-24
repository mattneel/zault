/**
 * WebSocket signaling server for Zault Chat
 * 
 * Handles:
 * - Peer registration and presence
 * - Message routing (encrypted payloads)
 * - Sync coordination (CRDT-style)
 */
import { eventHandler } from "vinxi/http";

// Map of Zault short ID -> peer connection
const peers = new Map<string, any>();

// Message types
type MessageType = 
  | "register" 
  | "message" 
  | "sync_request" 
  | "sync_response"
  | "presence"
  | "group_message"
  | "group_key"
  | "group_update";

interface SignalMessage {
  type: MessageType;
  from: string;
  to?: string;
  groupId?: string;
  payload?: string;
  timestamp: number;
}

export default eventHandler({
  handler() {
    return new Response("WebSocket endpoint", { status: 200 });
  },
  websocket: {
    async open(peer) {
      console.log("[WS] Connection opened:", peer.id);
    },

    async message(peer, msg) {
      try {
        const data: SignalMessage = JSON.parse(msg.text());
        
        switch (data.type) {
          case "register": {
            // Client registering their Zault ID
            const oldId = (peer as any).zaultId;
            if (oldId && peers.get(oldId) === peer) {
              peers.delete(oldId);
            }
            
            (peer as any).zaultId = data.from;
            peers.set(data.from, peer);
            console.log("[WS] Registered:", data.from, "| Online:", peers.size);
            
            // Acknowledge registration with list of online peers
            const onlinePeers = Array.from(peers.keys()).filter(id => id !== data.from);
            peer.send(JSON.stringify({
              type: "registered",
              peersOnline: peers.size,
              onlinePeers,
            }));
            
            // Notify other peers that this user is online
            for (const [id, p] of peers) {
              if (id !== data.from) {
                p.send(JSON.stringify({
                  type: "peer_online",
                  peerId: data.from,
                  timestamp: Date.now(),
                }));
              }
            }
            break;
          }

          case "message":
          case "sync_request":
          case "sync_response":
          case "group_key":
          case "group_update": {
            // Route to recipient
            if (!data.to) {
              console.warn("[WS] Message missing recipient");
              return;
            }
            
            const recipient = peers.get(data.to);
            if (recipient) {
              recipient.send(JSON.stringify(data));
              console.log(`[WS] Routed ${data.type}:`, data.from, "->", data.to);
              
              // Send delivery confirmation for messages
              if (data.type === "message") {
                peer.send(JSON.stringify({
                  type: "delivered",
                  messageId: data.payload ? JSON.parse(data.payload).id : null,
                  to: data.to,
                }));
              }
            } else {
              // Recipient offline
              peer.send(JSON.stringify({
                type: "offline",
                to: data.to,
                originalType: data.type,
              }));
              console.log("[WS] Recipient offline:", data.to);
            }
            break;
          }

          case "group_message": {
            // Group messages are sent to specific recipients (fan-out done by client)
            if (!data.to) {
              console.warn("[WS] Group message missing recipient");
              return;
            }
            
            const groupRecipient = peers.get(data.to);
            if (groupRecipient) {
              groupRecipient.send(JSON.stringify(data));
              console.log(`[WS] Routed group_message:`, data.from, "->", data.to, "group:", data.groupId);
            } else {
              // Recipient offline - message will sync later
              console.log("[WS] Group recipient offline:", data.to);
            }
            break;
          }

          case "presence": {
            console.log("[WS] Presence:", data.from);
            break;
          }

          default:
            console.warn("[WS] Unknown message type:", (data as any).type);
        }
      } catch (err) {
        console.error("[WS] Failed to parse message:", err);
      }
    },

    async close(peer) {
      const zaultId = (peer as any).zaultId;
      if (zaultId && peers.get(zaultId) === peer) {
        peers.delete(zaultId);
        console.log("[WS] Disconnected:", zaultId, "| Online:", peers.size);
        
        // Notify other peers that this user is offline
        for (const [id, p] of peers) {
          p.send(JSON.stringify({
            type: "peer_offline",
            peerId: zaultId,
            timestamp: Date.now(),
          }));
        }
      }
    },

    async error(peer, error) {
      console.error("[WS] Error:", peer.id, error);
    },
  },
});
