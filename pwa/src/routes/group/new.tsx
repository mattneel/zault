/**
 * Create new group page
 */
import { createSignal, onMount, Show, For } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import {
  getIdentityBytes,
  getContacts,
  addGroup,
  type Contact,
} from "~/lib/storage";
import { getPublicIdentity, getShortId } from "~/lib/crypto";
import { createGroup } from "~/lib/group-crypto";
import { sendGroupKey, peerId } from "~/lib/p2p";

export default function NewGroup() {
  const navigate = useNavigate();
  const [contacts, setContacts] = createSignal<Contact[]>([]);
  const [selectedIds, setSelectedIds] = createSignal<Set<string>>(new Set());
  const [groupName, setGroupName] = createSignal("");
  const [creating, setCreating] = createSignal(false);
  const [error, setError] = createSignal("");

  onMount(() => {
    setContacts(getContacts());
  });

  const toggleContact = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!groupName().trim()) {
      setError("Please enter a group name");
      return;
    }
    if (selectedIds().size === 0) {
      setError("Please select at least one contact");
      return;
    }

    setCreating(true);
    setError("");

    try {
      const identity = getIdentityBytes();
      if (!identity) throw new Error("No identity");

      const myPublicIdentity = getPublicIdentity(identity);
      const myId = getShortId(myPublicIdentity);

      // Get selected contacts
      const selectedContacts = contacts().filter((c) =>
        selectedIds().has(c.id)
      );

      // Create the group with encrypted keys
      const group = await createGroup({
        name: groupName().trim(),
        members: selectedContacts.map((c) => ({
          id: c.id,
          name: c.name,
          publicIdentity: c.publicIdentity,
        })),
        myId,
        myPublicIdentity,
      });

      // Save group locally
      await addGroup(group);

      // Send group keys to all members
      for (const member of selectedContacts) {
        const encryptedKey = group.encryptedKeys[member.id];
        if (encryptedKey) {
          await sendGroupKey({
            type: "group_key",
            from: myId,
            to: member.id,
            groupId: group.id,
            encryptedKey,
            keyVersion: group.keyVersion,
            groupName: group.name,
            memberIds: group.members.map((m) => m.id),
          });
        }
      }

      // Navigate to the new group
      navigate(`/group/${group.id}`);
    } catch (err) {
      console.error("Failed to create group:", err);
      setError("Failed to create group");
      setCreating(false);
    }
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
          <span class="text-lg font-semibold">New Group</span>
        </div>
        <div class="navbar-end" />
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-4">
        {/* Group Name */}
        <fieldset class="fieldset mb-6">
          <legend class="fieldset-legend">Group Name</legend>
          <input
            type="text"
            class="input input-bordered w-full"
            placeholder="Enter group name"
            value={groupName()}
            onInput={(e) => setGroupName(e.currentTarget.value)}
          />
        </fieldset>

        {/* Error */}
        <Show when={error()}>
          <div class="alert alert-error mb-4">
            <span>{error()}</span>
          </div>
        </Show>

        {/* Contact Selection */}
        <fieldset class="fieldset">
          <legend class="fieldset-legend">
            Select Members ({selectedIds().size} selected)
          </legend>

          <Show
            when={contacts().length > 0}
            fallback={
              <div class="text-center py-8 text-base-content/60">
                <p class="mb-4">No contacts to add</p>
                <A href="/add" class="btn btn-sm btn-outline">
                  Add Contact First
                </A>
              </div>
            }
          >
            <div class="space-y-2">
              <For each={contacts()}>
                {(contact) => (
                  <label class="flex items-center gap-3 p-3 rounded-lg hover:bg-base-200 cursor-pointer">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-primary"
                      checked={selectedIds().has(contact.id)}
                      onChange={() => toggleContact(contact.id)}
                    />
                    <div class="avatar avatar-placeholder">
                      <div class="bg-neutral text-neutral-content w-10 rounded-full">
                        <span>{contact.name.charAt(0).toUpperCase()}</span>
                      </div>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium">{contact.name}</div>
                      <div class="text-xs opacity-50 font-mono truncate">
                        {contact.id}
                      </div>
                    </div>
                  </label>
                )}
              </For>
            </div>
          </Show>
        </fieldset>
      </div>

      {/* Create Button */}
      <div class="p-4 border-t border-base-300">
        <button
          class="btn btn-primary btn-block"
          onClick={handleCreate}
          disabled={creating() || !groupName().trim() || selectedIds().size === 0}
        >
          <Show when={creating()} fallback="Create Group">
            <span class="loading loading-spinner loading-sm" />
            Creating...
          </Show>
        </button>
      </div>
    </div>
  );
}

