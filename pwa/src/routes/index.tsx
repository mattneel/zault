import { createSignal, onMount, Show, For } from "solid-js";
import { A } from "@solidjs/router";
import QRCode from "qrcode";
import {
  getIdentityBytes,
  setIdentityBytes,
  getContacts,
  getGroups,
  type Contact,
  type Group,
} from "~/lib/storage";
import {
  generateIdentity,
  getPublicIdentity,
  getShortId,
  toBase64Url,
  fromBase64Url,
} from "~/lib/crypto";
import { connectionState, peerCount } from "~/lib/p2p";

export default function Home() {
  const [identity, setIdentity] = createSignal<Uint8Array | null>(null);
  const [publicId, setPublicId] = createSignal<string>("");
  const [contacts, setContacts] = createSignal<Contact[]>([]);
  const [groups, setGroupsList] = createSignal<Group[]>([]);
  const [copied, setCopied] = createSignal(false);
  const [qrDataUrl, setQrDataUrl] = createSignal<string>("");
  const [activeTab, setActiveTab] = createSignal<"contacts" | "groups">("contacts");

  let shareModal: HTMLDialogElement | undefined;
  let qrModal: HTMLDialogElement | undefined;
  let fileInput: HTMLInputElement | undefined;

  onMount(() => {
    const stored = getIdentityBytes();
    if (stored) {
      setIdentity(stored);
      const pubId = getPublicIdentity(stored);
      setPublicId(getShortId(pubId));
    }
    setContacts(getContacts());
    setGroupsList(getGroups());
  });

  const handleCreateIdentity = async () => {
    const newIdentity = generateIdentity();
    await setIdentityBytes(newIdentity);
    setIdentity(newIdentity);
    const pubId = getPublicIdentity(newIdentity);
    setPublicId(getShortId(pubId));
  };

  const getShareLink = () => {
    if (!identity()) return "";
    const pubId = getPublicIdentity(identity()!);
    const encoded = toBase64Url(pubId);
    return `${window.location.origin}/add?id=${encoded}`;
  };

  const copyShareLink = async () => {
    await navigator.clipboard.writeText(getShareLink());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const showQR = async () => {
    if (!identity()) return;
    
    try {
      const pubId = getPublicIdentity(identity()!);
      
      // Split into two halves
      const half = Math.ceil(pubId.length / 2);
      const part1 = pubId.slice(0, half);
      const part2 = pubId.slice(half);
      
      // Encode with prefix for reassembly: "1:" and "2:"
      const encoded1 = "1:" + toBase64Url(part1);
      const encoded2 = "2:" + toBase64Url(part2);
      
      // Generate both QR codes
      const qr1 = await QRCode.toCanvas(encoded1, {
        width: 200,
        margin: 1,
        errorCorrectionLevel: "L",
        color: { dark: "#000000", light: "#ffffff" },
      });
      
      const qr2 = await QRCode.toCanvas(encoded2, {
        width: 200,
        margin: 1,
        errorCorrectionLevel: "L",
        color: { dark: "#000000", light: "#ffffff" },
      });
      
      // Combine into single canvas (stacked vertically)
      const combined = document.createElement("canvas");
      const gap = 16;
      combined.width = Math.max(qr1.width, qr2.width);
      combined.height = qr1.height + gap + qr2.height;
      
      const ctx = combined.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, combined.width, combined.height);
      ctx.drawImage(qr1, (combined.width - qr1.width) / 2, 0);
      ctx.drawImage(qr2, (combined.width - qr2.width) / 2, qr1.height + gap);
      
      setQrDataUrl(combined.toDataURL());
      qrModal?.showModal();
    } catch (err) {
      console.error("Failed to generate QR:", err);
    }
  };

  const exportIdentity = () => {
    if (!identity()) return;
    
    const pubId = getPublicIdentity(identity()!);
    const data = {
      version: 1,
      publicIdentity: toBase64Url(pubId),
      shortId: publicId(),
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zault-${publicId()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importIdentity = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.publicIdentity) {
        alert("Invalid file format");
        return;
      }

      const publicIdentity = fromBase64Url(data.publicIdentity);
      if (publicIdentity.length !== 3136) {
        alert("Invalid identity data");
        return;
      }

      // Navigate to add contact with the identity
      const encoded = encodeURIComponent(data.publicIdentity);
      window.location.href = `/add?id=${encoded}`;
    } catch (err) {
      console.error("Failed to import:", err);
      alert("Failed to read file");
    }
    
    // Reset input
    input.value = "";
  };

  return (
    <div class="min-h-dvh flex flex-col bg-base-100">
      {/* Navbar */}
      <div class="navbar bg-base-200">
        <div class="navbar-start">
          <span class="text-xl font-bold px-4">Zault</span>
        </div>
        <div class="navbar-end gap-2 pr-2">
          <Show when={identity()}>
            <div class="flex items-center gap-2">
              <span
                aria-label={connectionState()}
                class={`status ${
                  connectionState() === "connected"
                    ? "status-success"
                    : connectionState() === "connecting"
                    ? "status-warning"
                    : "status-neutral"
                }`}
              />
              <span class="text-sm opacity-70">
                {connectionState() === "connected"
                  ? `${peerCount()} online`
                  : connectionState() === "connecting"
                  ? "Connecting"
                  : "Offline"}
              </span>
            </div>
          </Show>
          <A href="/settings" class="btn btn-ghost btn-sm btn-square">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </A>
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto">
        {/* No Identity */}
        <Show when={!identity()}>
          <div class="flex flex-col items-center justify-center min-h-[60vh] p-8">
            <h2 class="text-2xl font-bold mb-2">Welcome to Zault</h2>
            <p class="text-base-content/60 mb-6 text-center">
              Secure messaging with post-quantum encryption
            </p>
            <button class="btn btn-primary" onClick={handleCreateIdentity}>
              Get Started
            </button>
          </div>
        </Show>

        {/* Has Identity */}
        <Show when={identity()}>
          {/* Share Section */}
          <div class="p-4 border-b border-base-300">
            <div class="flex items-center gap-2">
              <input
                type="text"
                class="input input-sm flex-1 font-mono text-xs"
                value={getShareLink()}
                readonly
              />
              <button class="btn btn-sm btn-ghost" onClick={copyShareLink}>
                {copied() ? "Copied" : "Copy"}
              </button>
              <button class="btn btn-sm btn-ghost" onClick={() => shareModal?.showModal()}>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div class="tabs tabs-box bg-base-200 mx-4 mt-4">
            <button
              class={`tab flex-1 ${activeTab() === "contacts" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("contacts")}
            >
              Contacts
            </button>
            <button
              class={`tab flex-1 ${activeTab() === "groups" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("groups")}
            >
              Groups
            </button>
          </div>

          {/* Contacts Tab */}
          <Show when={activeTab() === "contacts"}>
            <Show
              when={contacts().length > 0}
              fallback={
                <div class="flex flex-col items-center justify-center py-16 px-8">
                  <p class="text-base-content/60 mb-4">No contacts yet</p>
                  <A href="/add" class="btn btn-primary btn-sm">
                    Add Contact
                  </A>
                </div>
              }
            >
              <ul class="list">
                <For each={contacts()}>
                  {(contact) => (
                    <li class="list-row">
                      <A
                        href={`/chat/${contact.id}`}
                        class="flex items-center gap-3 w-full"
                      >
                        <div class="avatar avatar-placeholder">
                          <div class="bg-neutral text-neutral-content w-12 rounded-full">
                            <span class="text-lg">
                              {contact.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="font-medium">{contact.name}</div>
                          <div class="text-xs opacity-50 font-mono truncate">
                            {contact.id}
                          </div>
                        </div>
                      </A>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </Show>

          {/* Groups Tab */}
          <Show when={activeTab() === "groups"}>
            <Show
              when={groups().length > 0}
              fallback={
                <div class="flex flex-col items-center justify-center py-16 px-8">
                  <p class="text-base-content/60 mb-4">No groups yet</p>
                  <A href="/group/new" class="btn btn-primary btn-sm">
                    Create Group
                  </A>
                </div>
              }
            >
              <ul class="list">
                <For each={groups()}>
                  {(group) => (
                    <li class="list-row">
                      <A
                        href={`/group/${group.id}`}
                        class="flex items-center gap-3 w-full"
                      >
                        <div class="avatar avatar-placeholder">
                          <div class="bg-primary text-primary-content w-12 rounded-full">
                            <span class="text-lg">
                              {group.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="font-medium">{group.name}</div>
                          <div class="text-xs opacity-50">
                            {group.members.length} members
                          </div>
                        </div>
                      </A>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </Show>
        </Show>
      </div>

      {/* FAB */}
      <Show when={identity()}>
        <div class="fixed bottom-6 right-6">
          <A
            href={activeTab() === "contacts" ? "/add" : "/group/new"}
            class="btn btn-primary btn-circle shadow-lg"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
          </A>
        </div>
      </Show>

      {/* Share Modal */}
      <dialog ref={shareModal} class="modal">
        <div class="modal-box">
          <h3 class="text-lg font-bold mb-4">Share Identity</h3>
          <div class="space-y-2">
            <button class="btn btn-block btn-outline gap-2" onClick={showQR}>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Show QR Code
            </button>
            <button class="btn btn-block btn-outline gap-2" onClick={exportIdentity}>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export JSON File
            </button>
            <div class="divider text-xs">Import Contact</div>
            <input
              ref={fileInput}
              type="file"
              accept=".json"
              class="hidden"
              onChange={importIdentity}
            />
            <button class="btn btn-block btn-outline gap-2" onClick={() => fileInput?.click()}>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import JSON File
            </button>
          </div>
          <div class="modal-action">
            <form method="dialog">
              <button class="btn">Close</button>
            </form>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* QR Modal */}
      <dialog ref={qrModal} class="modal">
        <div class="modal-box flex flex-col items-center">
          <h3 class="text-lg font-bold mb-2">Scan both codes</h3>
          <p class="text-sm text-base-content/60 mb-4">Point camera at each QR code</p>
          <Show when={qrDataUrl()}>
            <img src={qrDataUrl()} alt="QR Codes" class="rounded-lg" />
          </Show>
          <p class="text-sm text-base-content/60 mt-4 font-mono">{publicId()}</p>
          <div class="modal-action">
            <form method="dialog">
              <button class="btn">Close</button>
            </form>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
}
