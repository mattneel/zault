"use client";

/**
 * Group chat page
 */
import { createSignal, onMount, onCleanup, Show, For, createEffect } from "solid-js";
import { A, useParams } from "@solidjs/router";
import {
  getIdentityBytes,
  getGroup,
  getGroupMessages,
  addGroupMessage,
  type Group,
  type StoredGroupMessage,
} from "~/lib/storage";
import { getPublicIdentity, getShortId } from "~/lib/crypto";
import { encryptGroupMessage, decryptGroupMessage } from "~/lib/group-crypto";
import {
  sendGroupMessage,
  onGroupMessage,
  type P2PGroupMessage,
} from "~/lib/p2p";

export default function GroupChat() {
  const params = useParams();
  const [group, setGroup] = createSignal<Group | null>(null);
  const [messages, setMessages] = createSignal<StoredGroupMessage[]>([]);
  const [decryptedMessages, setDecryptedMessages] = createSignal<Map<string, string>>(new Map());
  const [newMessage, setNewMessage] = createSignal("");
  const [myId, setMyId] = createSignal("");
  const [sending, setSending] = createSignal(false);

  let messagesContainer: HTMLDivElement | undefined;
  let unsubscribe: (() => void) | undefined;

  onMount(async () => {
    const identity = getIdentityBytes();
    if (!identity) return;

    const pubId = getPublicIdentity(identity);
    setMyId(getShortId(pubId));

    const g = getGroup(params.id);
    if (g) {
      setGroup(g);
      const msgs = await getGroupMessages(params.id);
      setMessages(msgs);
      
      // Decrypt messages
      await decryptAllMessages(msgs);
    }

    // Subscribe to incoming group messages
    unsubscribe = onGroupMessage(handleIncomingMessage);
  });

  onCleanup(() => {
    unsubscribe?.();
  });

  // Auto-scroll on new messages
  createEffect(() => {
    messages(); // Track messages
    setTimeout(() => {
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 50);
  });

  const decryptAllMessages = async (msgs: StoredGroupMessage[]) => {
    const decrypted = new Map<string, string>();
    
    for (const msg of msgs) {
      try {
        const plaintext = await decryptGroupMessage(
          msg.groupId,
          msg.ciphertext,
          msg.keyVersion
        );
        decrypted.set(msg.id, plaintext);
      } catch (err) {
        console.error("Failed to decrypt message:", msg.id, err);
        decrypted.set(msg.id, "[Failed to decrypt]");
      }
    }
    
    setDecryptedMessages(decrypted);
  };

  const handleIncomingMessage = async (msg: P2PGroupMessage) => {
    if (msg.groupId !== params.id) return;

    // Store encrypted message
    const storedMsg: StoredGroupMessage = {
      id: msg.id,
      groupId: msg.groupId,
      senderId: msg.from,
      ciphertext: msg.ciphertext,
      timestamp: msg.timestamp,
      keyVersion: msg.keyVersion,
    };

    await addGroupMessage(storedMsg);
    setMessages((prev) => [...prev, storedMsg]);

    // Decrypt and add to cache
    try {
      const plaintext = await decryptGroupMessage(
        msg.groupId,
        msg.ciphertext,
        msg.keyVersion
      );
      setDecryptedMessages((prev) => {
        const next = new Map(prev);
        next.set(msg.id, plaintext);
        return next;
      });
    } catch (err) {
      console.error("Failed to decrypt incoming message:", err);
      setDecryptedMessages((prev) => {
        const next = new Map(prev);
        next.set(msg.id, "[Failed to decrypt]");
        return next;
      });
    }
  };

  const handleSend = async () => {
    const content = newMessage().trim();
    if (!content || !group() || sending()) return;

    setSending(true);

    try {
      // Encrypt with group key
      const { ciphertext, keyVersion } = await encryptGroupMessage(params.id, content);

      const msgId = crypto.randomUUID();
      const timestamp = Date.now();

      // Store locally
      const storedMsg: StoredGroupMessage = {
        id: msgId,
        groupId: params.id,
        senderId: myId(),
        ciphertext,
        timestamp,
        keyVersion,
      };

      await addGroupMessage(storedMsg);
      setMessages((prev) => [...prev, storedMsg]);

      // Add to decrypted cache (we know the plaintext)
      setDecryptedMessages((prev) => {
        const next = new Map(prev);
        next.set(msgId, content);
        return next;
      });

      // Send to all members
      const memberIds = group()!.members.map((m) => m.id);
      await sendGroupMessage(
        {
          type: "group_chat",
          from: myId(),
          groupId: params.id,
          ciphertext,
          timestamp,
          id: msgId,
          keyVersion,
        },
        memberIds
      );

      setNewMessage("");
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSending(false);
    }
  };

  const getMemberName = (senderId: string): string => {
    if (senderId === myId()) return "Me";
    const member = group()?.members.find((m) => m.id === senderId);
    return member?.name || senderId.slice(0, 8);
  };

  const getMemberInitial = (senderId: string): string => {
    const name = getMemberName(senderId);
    return name.charAt(0).toUpperCase();
  };

  return (
    <div class="min-h-dvh flex flex-col bg-base-100">
      {/* Navbar */}
      <div class="navbar bg-base-200">
        <div class="navbar-start">
          <A href="/" class="btn btn-ghost btn-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </A>
        </div>
        <div class="navbar-center">
          <Show when={group()} fallback={<span class="loading loading-dots" />}>
            <div class="flex items-center gap-2">
              <div class="avatar avatar-placeholder">
                <div class="bg-primary text-primary-content w-8 rounded-full">
                  <span class="text-sm">{group()!.name.charAt(0).toUpperCase()}</span>
                </div>
              </div>
              <div>
                <div class="font-semibold">{group()!.name}</div>
                <div class="text-xs opacity-60">{group()!.members.length} members</div>
              </div>
            </div>
          </Show>
        </div>
        <div class="navbar-end">
          <A href={`/group-settings/${params.id}`} class="btn btn-ghost btn-sm">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
              />
            </svg>
          </A>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainer} class="flex-1 overflow-y-auto p-4 space-y-4">
        <Show
          when={messages().length > 0}
          fallback={
            <div class="flex items-center justify-center h-full text-base-content/50">
              No messages yet
            </div>
          }
        >
          <For each={messages()}>
            {(msg) => {
              const isMe = msg.senderId === myId();
              return (
                <div class={`chat ${isMe ? "chat-end" : "chat-start"}`}>
                  <div class="chat-image avatar avatar-placeholder">
                    <div class={`w-8 rounded-full ${isMe ? "bg-primary text-primary-content" : "bg-neutral text-neutral-content"}`}>
                      <span class="text-xs">{getMemberInitial(msg.senderId)}</span>
                    </div>
                  </div>
                  <div class="chat-header text-xs opacity-60 mb-1">
                    {getMemberName(msg.senderId)}
                    <time class="ml-2">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                  <div
                    class={`chat-bubble ${
                      isMe ? "chat-bubble-primary" : ""
                    }`}
                  >
                    {decryptedMessages().get(msg.id) || (
                      <span class="loading loading-dots loading-xs" />
                    )}
                  </div>
                </div>
              );
            }}
          </For>
        </Show>
      </div>

      {/* Input */}
      <div class="p-4 border-t border-base-300">
        <form
          class="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <input
            type="text"
            class="input input-bordered flex-1"
            placeholder="Type a message..."
            value={newMessage()}
            onInput={(e) => setNewMessage(e.currentTarget.value)}
            disabled={sending()}
          />
          <button
            type="submit"
            class="btn btn-primary"
            disabled={!newMessage().trim() || sending()}
          >
            <Show when={sending()} fallback={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            }>
              <span class="loading loading-spinner loading-sm" />
            </Show>
          </button>
        </form>
      </div>
    </div>
  );
}

