/**
 * Group settings page
 */
import { createSignal, onMount, Show, For } from "solid-js";
import { A, useParams, useNavigate } from "@solidjs/router";
import {
  getIdentityBytes,
  getGroup,
  getContacts,
  updateGroup,
  deleteGroup,
  type Group,
  type GroupMember,
  type Contact,
} from "~/lib/storage";
import { getPublicIdentity, getShortId } from "~/lib/crypto";
import { addMemberToGroup, removeMemberFromGroup } from "~/lib/group-crypto";
import { sendGroupKey, sendGroupUpdate } from "~/lib/p2p";

export default function GroupSettings() {
  const params = useParams();
  const navigate = useNavigate();
  const [group, setGroupState] = createSignal<Group | null>(null);
  const [myId, setMyId] = createSignal("");
  const [isAdmin, setIsAdmin] = createSignal(false);
  const [contacts, setContacts] = createSignal<Contact[]>([]);
  const [showAddMember, setShowAddMember] = createSignal(false);
  const [processing, setProcessing] = createSignal(false);

  let addMemberModal: HTMLDialogElement | undefined;
  let deleteModal: HTMLDialogElement | undefined;

  onMount(() => {
    const identity = getIdentityBytes();
    if (!identity) return;

    const pubId = getPublicIdentity(identity);
    const id = getShortId(pubId);
    setMyId(id);

    const g = getGroup(params.id);
    if (g) {
      setGroupState(g);
      const myMember = g.members.find((m) => m.id === id);
      setIsAdmin(myMember?.role === "admin");
    }

    // Get contacts not in group
    setContacts(getContacts());
  });

  const getAvailableContacts = () => {
    const g = group();
    if (!g) return [];
    const memberIds = new Set(g.members.map((m) => m.id));
    return contacts().filter((c) => !memberIds.has(c.id));
  };

  const handleAddMember = async (contact: Contact) => {
    if (!group() || processing()) return;
    setProcessing(true);

    try {
      const { encryptedKeyForNewMember } = await addMemberToGroup(params.id, {
        id: contact.id,
        name: contact.name,
        publicIdentity: contact.publicIdentity,
      });

      // Refresh group state
      const g = getGroup(params.id);
      if (g) setGroupState(g);

      // Send key to new member
      await sendGroupKey({
        type: "group_key",
        from: myId(),
        to: contact.id,
        groupId: params.id,
        encryptedKey: encryptedKeyForNewMember,
        keyVersion: g?.keyVersion || 1,
        groupName: g?.name || "",
        memberIds: g?.members.map((m) => m.id) || [],
      });

      // Notify other members
      const memberIds = g?.members.map((m) => m.id) || [];
      await sendGroupUpdate(
        {
          type: "group_update",
          from: myId(),
          groupId: params.id,
          action: "member_added",
          memberId: contact.id,
          memberName: contact.name,
          keyVersion: g?.keyVersion || 1,
        },
        memberIds
      );

      addMemberModal?.close();
    } catch (err) {
      console.error("Failed to add member:", err);
    } finally {
      setProcessing(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!group() || processing() || memberId === myId()) return;
    setProcessing(true);

    try {
      const { newEncryptedKeys, newKeyVersion } = await removeMemberFromGroup(
        params.id,
        memberId,
        myId()
      );

      // Refresh group state
      const g = getGroup(params.id);
      if (g) setGroupState(g);

      // Send new keys to remaining members
      for (const member of g?.members || []) {
        if (member.id === myId()) continue;
        const encryptedKey = newEncryptedKeys[member.id];
        if (encryptedKey) {
          await sendGroupUpdate(
            {
              type: "group_update",
              from: myId(),
              groupId: params.id,
              action: "key_rotated",
              memberId,
              newEncryptedKey: encryptedKey,
              keyVersion: newKeyVersion,
            },
            [member.id]
          );
        }
      }
    } catch (err) {
      console.error("Failed to remove member:", err);
    } finally {
      setProcessing(false);
    }
  };

  const handleLeaveGroup = async () => {
    if (!group() || processing()) return;
    setProcessing(true);

    try {
      // If admin, need to handle differently
      // For now, just delete locally
      await deleteGroup(params.id);
      navigate("/");
    } catch (err) {
      console.error("Failed to leave group:", err);
      setProcessing(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!group() || processing()) return;
    setProcessing(true);

    try {
      // Notify members
      const memberIds = group()!.members.map((m) => m.id);
      await sendGroupUpdate(
        {
          type: "group_update",
          from: myId(),
          groupId: params.id,
          action: "member_removed",
          keyVersion: group()!.keyVersion,
        },
        memberIds
      );

      await deleteGroup(params.id);
      navigate("/");
    } catch (err) {
      console.error("Failed to delete group:", err);
      setProcessing(false);
    }
  };

  return (
    <div class="min-h-dvh flex flex-col bg-base-100">
      {/* Navbar */}
      <div class="navbar bg-base-200">
        <div class="navbar-start">
          <A href={`/group/${params.id}`} class="btn btn-ghost btn-sm">
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
          <span class="text-lg font-semibold">Group Settings</span>
        </div>
        <div class="navbar-end" />
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto">
        <Show when={group()} fallback={<div class="p-4">Loading...</div>}>
          {/* Group Info */}
          <div class="p-4 border-b border-base-300">
            <div class="flex items-center gap-4">
              <div class="avatar avatar-placeholder">
                <div class="bg-primary text-primary-content w-16 rounded-full">
                  <span class="text-2xl">{group()!.name.charAt(0).toUpperCase()}</span>
                </div>
              </div>
              <div>
                <h2 class="text-xl font-bold">{group()!.name}</h2>
                <p class="text-sm opacity-60">
                  Created {new Date(group()!.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Members */}
          <div class="p-4">
            <div class="flex items-center justify-between mb-4">
              <h3 class="font-semibold">Members ({group()!.members.length})</h3>
              <Show when={isAdmin()}>
                <button
                  class="btn btn-sm btn-outline"
                  onClick={() => addMemberModal?.showModal()}
                >
                  Add Member
                </button>
              </Show>
            </div>

            <ul class="space-y-2">
              <For each={group()!.members}>
                {(member) => (
                  <li class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-200">
                    <div class="avatar avatar-placeholder">
                      <div class="bg-neutral text-neutral-content w-10 rounded-full">
                        <span>{member.name.charAt(0).toUpperCase()}</span>
                      </div>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium">
                        {member.name}
                        {member.id === myId() && (
                          <span class="text-xs opacity-60 ml-2">(You)</span>
                        )}
                      </div>
                      <div class="text-xs opacity-50">
                        {member.role === "admin" ? "Admin" : "Member"}
                      </div>
                    </div>
                    <Show when={isAdmin() && member.id !== myId()}>
                      <button
                        class="btn btn-ghost btn-sm btn-circle text-error"
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={processing()}
                      >
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
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </div>

          {/* Danger Zone */}
          <div class="p-4 border-t border-base-300">
            <h3 class="font-semibold text-error mb-4">Danger Zone</h3>
            <div class="space-y-2">
              <button
                class="btn btn-outline btn-error btn-block"
                onClick={() => deleteModal?.showModal()}
              >
                {isAdmin() ? "Delete Group" : "Leave Group"}
              </button>
            </div>
          </div>
        </Show>
      </div>

      {/* Add Member Modal */}
      <dialog ref={addMemberModal} class="modal">
        <div class="modal-box">
          <h3 class="text-lg font-bold mb-4">Add Member</h3>
          <Show
            when={getAvailableContacts().length > 0}
            fallback={
              <p class="text-base-content/60">
                All your contacts are already in this group.
              </p>
            }
          >
            <ul class="space-y-2">
              <For each={getAvailableContacts()}>
                {(contact) => (
                  <li>
                    <button
                      class="flex items-center gap-3 p-3 w-full rounded-lg hover:bg-base-200"
                      onClick={() => handleAddMember(contact)}
                      disabled={processing()}
                    >
                      <div class="avatar avatar-placeholder">
                        <div class="bg-neutral text-neutral-content w-10 rounded-full">
                          <span>{contact.name.charAt(0).toUpperCase()}</span>
                        </div>
                      </div>
                      <div class="flex-1 text-left">
                        <div class="font-medium">{contact.name}</div>
                        <div class="text-xs opacity-50 font-mono">
                          {contact.id}
                        </div>
                      </div>
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
          <div class="modal-action">
            <form method="dialog">
              <button class="btn">Cancel</button>
            </form>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* Delete Confirmation Modal */}
      <dialog ref={deleteModal} class="modal">
        <div class="modal-box">
          <h3 class="text-lg font-bold mb-4">
            {isAdmin() ? "Delete Group" : "Leave Group"}
          </h3>
          <p class="text-base-content/70">
            {isAdmin()
              ? "Are you sure you want to delete this group? This action cannot be undone."
              : "Are you sure you want to leave this group?"}
          </p>
          <div class="modal-action">
            <form method="dialog">
              <button class="btn">Cancel</button>
            </form>
            <button
              class="btn btn-error"
              onClick={isAdmin() ? handleDeleteGroup : handleLeaveGroup}
              disabled={processing()}
            >
              {isAdmin() ? "Delete" : "Leave"}
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
}

