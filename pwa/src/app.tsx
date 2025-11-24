import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense, onMount, onCleanup, createSignal, createEffect } from "solid-js";
import { initZault, isLoading, loadError, getShortId, getPublicIdentity } from "~/lib/crypto";
import { 
  getIdentityBytes, 
  identityRaw, 
  addGroup, 
  getGroup, 
  updateGroup,
  storeMyGroupKey,
  getContacts,
  type Group,
  type GroupMember,
} from "~/lib/storage";
import { 
  initP2P, 
  onGroupKey, 
  onGroupUpdate,
  type P2PGroupKeyMessage,
  type P2PGroupUpdateMessage,
} from "~/lib/p2p";
import { initSettings } from "~/lib/settings";
import OfflineIndicator from "~/components/OfflineIndicator";
import "./app.css";

function LoadingScreen() {
  return (
    <div class="min-h-dvh flex items-center justify-center bg-base-100">
      <div class="text-center">
        <h1 class="text-xl font-bold mb-4">Zault</h1>
        <span class="loading loading-spinner loading-lg text-primary"></span>
      </div>
    </div>
  );
}

function ErrorScreen(props: { error: string }) {
  return (
    <div class="min-h-dvh flex items-center justify-center bg-base-100">
      <div class="text-center max-w-md p-6">
        <h1 class="text-xl font-bold text-error mb-2">Failed to Load</h1>
        <p class="text-base-content/60 mb-4">{props.error}</p>
        <button class="btn btn-primary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [ready, setReady] = createSignal(false);
  const [p2pStarted, setP2pStarted] = createSignal(false);

  let unsubGroupKey: (() => void) | undefined;
  let unsubGroupUpdate: (() => void) | undefined;

  onMount(async () => {
    try {
      // Initialize settings (loads theme)
      await initSettings();
      
      await initZault();
      setReady(true);

      // Subscribe to group key messages (invites)
      unsubGroupKey = onGroupKey(handleGroupKey);
      unsubGroupUpdate = onGroupUpdate(handleGroupUpdate);
    } catch (err) {
      console.error("Failed to init Zault:", err);
    }
  });

  onCleanup(() => {
    unsubGroupKey?.();
    unsubGroupUpdate?.();
  });

  // Handle incoming group key (group invite)
  const handleGroupKey = async (msg: P2PGroupKeyMessage) => {
    console.log("[App] Received group key:", msg.groupId, "from:", msg.from);

    // Check if we already have this group
    const existing = getGroup(msg.groupId);
    if (existing) {
      // Just update our key
      await storeMyGroupKey(msg.groupId, msg.keyVersion, msg.encryptedKey);
      return;
    }

    // Create new group from invite
    const contacts = getContacts();
    const members: GroupMember[] = [];

    for (const memberId of msg.memberIds) {
      const contact = contacts.find(c => c.id === memberId);
      if (contact) {
        members.push({
          id: contact.id,
          name: contact.name,
          publicIdentity: contact.publicIdentity,
          role: memberId === msg.from ? "admin" : "member",
          joinedAt: Date.now(),
        });
      } else {
        // Unknown member - add with ID as name
        members.push({
          id: memberId,
          name: memberId.slice(0, 8),
          publicIdentity: new Uint8Array(0), // Will be filled when we get their info
          role: memberId === msg.from ? "admin" : "member",
          joinedAt: Date.now(),
        });
      }
    }

    const group: Group = {
      id: msg.groupId,
      name: msg.groupName,
      members,
      encryptedKeys: { [msg.from]: msg.encryptedKey },
      keyVersion: msg.keyVersion,
      createdAt: Date.now(),
      createdBy: msg.from,
    };

    await addGroup(group);
    await storeMyGroupKey(msg.groupId, msg.keyVersion, msg.encryptedKey);

    console.log("[App] Joined group:", msg.groupName);
  };

  // Handle group updates (member added/removed, key rotation)
  const handleGroupUpdate = async (msg: P2PGroupUpdateMessage) => {
    console.log("[App] Group update:", msg.action, "for:", msg.groupId);

    const group = getGroup(msg.groupId);
    if (!group) {
      console.warn("[App] Update for unknown group:", msg.groupId);
      return;
    }

    switch (msg.action) {
      case "member_added":
        if (msg.memberId && msg.memberName) {
          const contacts = getContacts();
          const contact = contacts.find(c => c.id === msg.memberId);
          
          const newMember: GroupMember = {
            id: msg.memberId,
            name: contact?.name || msg.memberName,
            publicIdentity: contact?.publicIdentity || new Uint8Array(0),
            role: "member",
            joinedAt: Date.now(),
          };

          if (!group.members.find(m => m.id === msg.memberId)) {
            await updateGroup(msg.groupId, {
              members: [...group.members, newMember],
            });
          }
        }
        break;

      case "member_removed":
        if (msg.memberId) {
          await updateGroup(msg.groupId, {
            members: group.members.filter(m => m.id !== msg.memberId),
          });
        }
        break;

      case "key_rotated":
        if (msg.newEncryptedKey) {
          await storeMyGroupKey(msg.groupId, msg.keyVersion, msg.newEncryptedKey);
          await updateGroup(msg.groupId, {
            keyVersion: msg.keyVersion,
          });
        }
        break;
    }
  };

  createEffect(() => {
    const isReady = ready();
    const hasStarted = p2pStarted();
    const rawIdentity = identityRaw();
    
    if (!isReady || hasStarted || !rawIdentity) return;

    const identity = getIdentityBytes();
    if (identity) {
      const pubId = getPublicIdentity(identity);
      const shortId = getShortId(pubId);
      setP2pStarted(true);
      
      initP2P(shortId).catch((err) => {
        console.error("[App] P2P init failed:", err);
      });
    }
  });

  return (
    <>
      <OfflineIndicator />
      {isLoading() ? (
        <LoadingScreen />
      ) : loadError() ? (
        <ErrorScreen error={loadError()!} />
      ) : (
        <Router
          root={(props) => (
            <Suspense fallback={<LoadingScreen />}>
              {props.children}
            </Suspense>
          )}
        >
          <FileRoutes />
        </Router>
      )}
    </>
  );
}
