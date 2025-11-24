import { createSignal, onMount, onCleanup, For, Show, createEffect, createMemo } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import {
  getContacts,
  getMessages,
  addMessage,
  updateMessageStatus,
  getIdentityBytes,
  type Contact,
  type StoredMessage,
} from "~/lib/storage";
import { encryptMessage, encryptToSelf, decryptMessage, getPublicIdentity, getShortId, toBase64Url, fromBase64Url } from "~/lib/crypto";
import { sendMessage, onMessage, onSync, isP2PReady, isPeerOnline, type P2PMessage } from "~/lib/p2p";

interface DisplayMessage {
  id: string;
  content: string;
  timestamp: number;
  incoming: boolean;
  status: StoredMessage["status"];
}

export default function Chat() {
  const params = useParams();
  const navigate = useNavigate();

  const [contact, setContact] = createSignal<Contact | null>(null);
  const [storedMessages, setStoredMessages] = createSignal<StoredMessage[]>([]);
  const [input, setInput] = createSignal("");
  const [sending, setSending] = createSignal(false);
  const [myShortId, setMyShortId] = createSignal<string | null>(null);
  const [identity, setIdentity] = createSignal<Uint8Array | null>(null);

  let messagesEndRef: HTMLDivElement | undefined;
  let unsubscribeMessage: (() => void) | undefined;
  let unsubscribeSync: (() => void) | undefined;

  const displayMessages = createMemo((): DisplayMessage[] => {
    const id = identity();
    const contact_ = contact();
    if (!id || !contact_) return [];

    return storedMessages()
      .map((msg): DisplayMessage | null => {
        try {
          if (!msg.incoming) {
            // Outgoing messages: decrypt selfCiphertext (encrypted to our own key)
            if (!msg.selfCiphertext) {
              return {
                id: msg.id,
                content: "[No encrypted copy]",
                timestamp: msg.timestamp,
                incoming: false,
                status: msg.status,
              };
            }
            const selfCiphertext = fromBase64Url(msg.selfCiphertext);
            const plaintext = decryptMessage(id, selfCiphertext);
            return {
              id: msg.id,
              content: plaintext,
              timestamp: msg.timestamp,
              incoming: false,
              status: msg.status,
            };
          }
          
          // Incoming messages: decrypt the ciphertext (encrypted to our key)
          const ciphertext = fromBase64Url(msg.ciphertext);
          const plaintext = decryptMessage(id, ciphertext);
          return {
            id: msg.id,
            content: plaintext,
            timestamp: msg.timestamp,
            incoming: true,
            status: msg.status,
          };
        } catch (err) {
          console.error("[Chat] Failed to decrypt message:", msg.id, err);
          return {
            id: msg.id,
            content: "[Decryption failed]",
            timestamp: msg.timestamp,
            incoming: msg.incoming,
            status: msg.status,
          };
        }
      })
      .filter((m): m is DisplayMessage => m !== null)
      .sort((a, b) => a.timestamp - b.timestamp);
  });

  onMount(async () => {
    const contacts = getContacts();
    const found = contacts.find((c) => c.id === params.id);
    if (!found) {
      navigate("/");
      return;
    }
    setContact(found);

    const id = getIdentityBytes();
    if (id) {
      setIdentity(id);
      const pubId = getPublicIdentity(id);
      setMyShortId(getShortId(pubId));
    }

    const msgs = await getMessages(params.id);
    setStoredMessages(msgs);

    unsubscribeMessage = onMessage(async (p2pMsg: P2PMessage) => {
      if (p2pMsg.from !== contact()?.id) return;
      if (storedMessages().find(m => m.id === p2pMsg.id)) return;

      const storedMsg: StoredMessage = {
        id: p2pMsg.id,
        contactId: contact()!.id,
        ciphertext: p2pMsg.ciphertext,
        timestamp: p2pMsg.timestamp,
        incoming: true,
        status: "delivered",
      };

      await addMessage(storedMsg);
      setStoredMessages((prev) => [...prev, storedMsg]);
    });

    unsubscribeSync = onSync(async (contactId, syncedMessages) => {
      if (contactId !== contact()?.id) return;
      const allMsgs = await getMessages(contactId);
      setStoredMessages(allMsgs);
    });
  });

  onCleanup(() => {
    unsubscribeMessage?.();
    unsubscribeSync?.();
  });

  createEffect(() => {
    displayMessages();
    messagesEndRef?.scrollIntoView({ behavior: "smooth" });
  });

  const handleSend = async () => {
    const text = input().trim();
    const contact_ = contact();
    const id = identity();
    if (!text || !contact_ || !id || sending()) return;

    setSending(true);

    try {
      // Encrypt to recipient (for sending/sync)
      const ciphertext = encryptMessage(contact_.publicIdentity, text);
      const ciphertextB64 = toBase64Url(ciphertext);
      
      // Encrypt to self (for local display) - NO PLAINTEXT STORED
      const selfCiphertext = encryptToSelf(id, text);
      const selfCiphertextB64 = toBase64Url(selfCiphertext);
      
      const messageId = crypto.randomUUID();
      const timestamp = Date.now();

      const storedMsg: StoredMessage = {
        id: messageId,
        contactId: contact_.id,
        ciphertext: ciphertextB64,       // Encrypted to recipient (for sync)
        selfCiphertext: selfCiphertextB64, // Encrypted to self (for display)
        timestamp,
        incoming: false,
        status: "pending",
      };

      await addMessage(storedMsg);
      setStoredMessages((prev) => [...prev, storedMsg]);
      setInput("");

      if (isP2PReady() && myShortId()) {
        const p2pMsg: P2PMessage = {
          type: "chat",
          from: myShortId()!,
          to: contact_.id,
          ciphertext: ciphertextB64,
          timestamp,
          id: messageId,
        };

        await sendMessage(p2pMsg);
        await updateMessageStatus(contact_.id, messageId, "sent");
        setStoredMessages((prev) =>
          prev.map((m) => m.id === messageId ? { ...m, status: "sent" } : m)
        );
      } else {
        await updateMessageStatus(contact_.id, messageId, "sent");
        setStoredMessages((prev) =>
          prev.map((m) => m.id === messageId ? { ...m, status: "sent" } : m)
        );
      }
    } catch (err) {
      console.error("Failed to send:", err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div class="h-dvh flex flex-col bg-base-100">
      {/* Header */}
      <div class="navbar bg-base-200 min-h-0 h-14">
        <div class="navbar-start">
          <button class="btn btn-ghost btn-sm btn-square" onClick={() => navigate("/")}>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>
        <div class="navbar-center">
          <Show when={contact()}>
            <div class="flex items-center gap-3">
              <div class={`avatar avatar-placeholder ${isPeerOnline(contact()!.id) ? "avatar-online" : ""}`}>
                <div class="bg-neutral text-neutral-content w-8 rounded-full">
                  <span>{contact()!.name.charAt(0).toUpperCase()}</span>
                </div>
              </div>
              <span class="font-medium">{contact()!.name}</span>
            </div>
          </Show>
        </div>
        <div class="navbar-end" />
      </div>

      {/* Messages */}
      <div class="flex-1 overflow-y-auto p-4">
        <Show
          when={displayMessages().length > 0}
          fallback={
            <div class="flex items-center justify-center h-full">
              <p class="text-base-content/50">No messages yet</p>
            </div>
          }
        >
          <div class="space-y-1">
            <For each={displayMessages()}>
              {(msg) => (
                <div class={`chat ${msg.incoming ? "chat-start" : "chat-end"}`}>
                  <div class={`chat-bubble ${msg.incoming ? "chat-bubble-neutral" : "chat-bubble-primary"}`}>
                    {msg.content}
                  </div>
                  <div class="chat-footer opacity-50 text-xs">
                    {formatTime(msg.timestamp)}
                    <Show when={!msg.incoming}>
                      <span class="ml-1">
                        {msg.status === "pending" && "○"}
                        {msg.status === "sent" && "✓"}
                        {msg.status === "delivered" && "✓✓"}
                      </span>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div class="p-3 bg-base-200">
        <div class="flex gap-2">
          <input
            type="text"
            class="input flex-1"
            placeholder="Message"
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            onKeyPress={handleKeyPress}
            disabled={sending()}
          />
          <button
            class="btn btn-primary btn-square"
            onClick={handleSend}
            disabled={!input().trim() || sending()}
          >
            <Show
              when={!sending()}
              fallback={<span class="loading loading-spinner loading-sm" />}
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </Show>
          </button>
        </div>
      </div>
    </div>
  );
}
