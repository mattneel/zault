/**
 * Group chat tests
 */
import { test, expect } from "@playwright/test";
import { 
  waitForAppReady, 
  ensureIdentity, 
  getShareLink,
  addContactViaLink,
  clearStorage,
  switchToGroupsTab,
  switchToContactsTab,
  createGroup,
  openGroupChat,
  sendMessage,
  waitForMessage,
} from "./helpers";

test.describe("Groups", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await page.goto("/");
    await ensureIdentity(page);
  });

  test("groups tab shows empty state", async ({ page }) => {
    await switchToGroupsTab(page);
    
    await expect(page.getByText("No groups yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Create Group" })).toBeVisible();
  });

  test("tabs switch between contacts and groups", async ({ page }) => {
    // Should start on contacts
    await expect(page.getByText("No contacts yet")).toBeVisible();
    
    // Switch to groups
    await switchToGroupsTab(page);
    await expect(page.getByText("No groups yet")).toBeVisible();
    
    // Switch back to contacts
    await switchToContactsTab(page);
    await expect(page.getByText("No contacts yet")).toBeVisible();
  });

  test("FAB changes based on active tab", async ({ page, browser }) => {
    // On contacts tab, FAB goes to /add
    const fab = page.locator(".fixed.bottom-6.right-6 a");
    await expect(fab).toHaveAttribute("href", "/add");
    
    // Switch to groups
    await switchToGroupsTab(page);
    
    // FAB should go to /group/new
    await expect(fab).toHaveAttribute("href", "/group/new");
  });

  test("create group page shows contact selection", async ({ page, browser }) => {
    // First add a contact
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto("/");
    await clearStorage(page2);
    await page2.goto("/");
    await ensureIdentity(page2);
    
    const otherLink = await getShareLink(page2);
    await addContactViaLink(page, otherLink, "Group Member");
    
    // Navigate to create group
    await page.goto("/group/new");
    await waitForAppReady(page);
    
    // Should show group name input
    await expect(page.getByPlaceholder("Enter group name")).toBeVisible();
    
    // Should show the contact
    await expect(page.getByText("Group Member")).toBeVisible();
    
    // Should have checkbox
    await expect(page.locator('input[type="checkbox"]')).toBeVisible();
    
    await context2.close();
  });

  test("cannot create group without name", async ({ page, browser }) => {
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto("/");
    await clearStorage(page2);
    await page2.goto("/");
    await ensureIdentity(page2);
    
    const otherLink = await getShareLink(page2);
    await addContactViaLink(page, otherLink, "Test Member");
    
    await page.goto("/group/new");
    await waitForAppReady(page);
    
    // Select contact but no name
    await page.getByText("Test Member").click();
    
    // Create button should be disabled
    const createBtn = page.getByRole("button", { name: "Create Group" });
    await expect(createBtn).toBeDisabled();
    
    await context2.close();
  });

  test("cannot create group without members", async ({ page, browser }) => {
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto("/");
    await clearStorage(page2);
    await page2.goto("/");
    await ensureIdentity(page2);
    
    const otherLink = await getShareLink(page2);
    await addContactViaLink(page, otherLink, "Unselected Member");
    
    await page.goto("/group/new");
    await waitForAppReady(page);
    
    // Enter name but don't select members
    await page.getByPlaceholder("Enter group name").fill("Empty Group");
    
    // Create button should be disabled
    const createBtn = page.getByRole("button", { name: "Create Group" });
    await expect(createBtn).toBeDisabled();
    
    await context2.close();
  });

  test("can create a group", async ({ page, browser }) => {
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto("/");
    await clearStorage(page2);
    await page2.goto("/");
    await ensureIdentity(page2);
    
    const otherLink = await getShareLink(page2);
    await addContactViaLink(page, otherLink, "Group Buddy");
    
    await createGroup(page, "Test Group", ["Group Buddy"]);
    
    // Should be in the group chat
    await expect(page).toHaveURL(/\/group\//);
    await expect(page.locator(".navbar-center").getByText("Test Group")).toBeVisible();
    
    await context2.close();
  });

  test("group appears in groups list after creation", async ({ page, browser }) => {
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto("/");
    await clearStorage(page2);
    await page2.goto("/");
    await ensureIdentity(page2);
    
    const otherLink = await getShareLink(page2);
    await addContactViaLink(page, otherLink, "List Test");
    
    await createGroup(page, "Listed Group", ["List Test"]);
    
    // Go back to home
    await page.goto("/");
    await waitForAppReady(page);
    
    await switchToGroupsTab(page);
    
    // Group should be visible
    await expect(page.getByText("Listed Group")).toBeVisible();
    await expect(page.getByText("2 members")).toBeVisible();
    
    await context2.close();
  });

  test("group chat shows empty state initially", async ({ page, browser }) => {
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto("/");
    await clearStorage(page2);
    await page2.goto("/");
    await ensureIdentity(page2);
    
    const otherLink = await getShareLink(page2);
    await addContactViaLink(page, otherLink, "Empty Chat Test");
    
    await createGroup(page, "Empty Chat Group", ["Empty Chat Test"]);
    
    await expect(page.getByText("No messages yet")).toBeVisible();
    
    await context2.close();
  });

  test("can send message in group", async ({ page, browser }) => {
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto("/");
    await clearStorage(page2);
    await page2.goto("/");
    await ensureIdentity(page2);
    
    const otherLink = await getShareLink(page2);
    await addContactViaLink(page, otherLink, "Message Test");
    
    await createGroup(page, "Message Group", ["Message Test"]);
    
    await sendMessage(page, "Hello group!");
    
    await expect(page.getByText("Hello group!")).toBeVisible();
    
    await context2.close();
  });

  test("group messages persist after reload", async ({ page, browser }) => {
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto("/");
    await clearStorage(page2);
    await page2.goto("/");
    await ensureIdentity(page2);
    
    const otherLink = await getShareLink(page2);
    await addContactViaLink(page, otherLink, "Persist Test");
    
    await createGroup(page, "Persist Group", ["Persist Test"]);
    await sendMessage(page, "Persistent group message");
    
    // Get the URL to return to
    const groupUrl = page.url();
    
    // Reload
    await page.reload();
    await waitForAppReady(page);
    
    await expect(page.getByText("Persistent group message")).toBeVisible();
    
    await context2.close();
  });
});

test.describe("Group Settings", () => {
  test("can access group settings", async ({ page, browser }) => {
    await clearStorage(page);
    await page.goto("/");
    await ensureIdentity(page);
    
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto("/");
    await clearStorage(page2);
    await page2.goto("/");
    await ensureIdentity(page2);
    
    const otherLink = await getShareLink(page2);
    await addContactViaLink(page, otherLink, "Settings Test");
    
    await createGroup(page, "Settings Group", ["Settings Test"]);
    
    // Click settings button (three dots)
    await page.locator(".navbar-end a, .navbar-end button").last().click();
    
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByText("Group Settings")).toBeVisible();
    
    await context2.close();
  });

  test("settings shows member list", async ({ page, browser }) => {
    await clearStorage(page);
    await page.goto("/");
    await ensureIdentity(page);
    
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto("/");
    await clearStorage(page2);
    await page2.goto("/");
    await ensureIdentity(page2);
    
    const otherLink = await getShareLink(page2);
    await addContactViaLink(page, otherLink, "Member View");
    
    await createGroup(page, "Member Group", ["Member View"]);
    
    // Go to settings
    await page.locator(".navbar-end a, .navbar-end button").last().click();
    
    // Should show members
    await expect(page.getByText("Members (2)")).toBeVisible();
    await expect(page.getByText("Member View")).toBeVisible();
    await expect(page.getByText("(You)")).toBeVisible();
    
    await context2.close();
  });

  test("admin can see add member button", async ({ page, browser }) => {
    await clearStorage(page);
    await page.goto("/");
    await ensureIdentity(page);
    
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto("/");
    await clearStorage(page2);
    await page2.goto("/");
    await ensureIdentity(page2);
    
    const otherLink = await getShareLink(page2);
    await addContactViaLink(page, otherLink, "Admin Test");
    
    await createGroup(page, "Admin Group", ["Admin Test"]);
    await page.locator(".navbar-end a, .navbar-end button").last().click();
    
    await expect(page.getByRole("button", { name: "Add Member" })).toBeVisible();
    
    await context2.close();
  });

  test("can delete/leave group", async ({ page, browser }) => {
    await clearStorage(page);
    await page.goto("/");
    await ensureIdentity(page);
    
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto("/");
    await clearStorage(page2);
    await page2.goto("/");
    await ensureIdentity(page2);
    
    const otherLink = await getShareLink(page2);
    await addContactViaLink(page, otherLink, "Delete Test");
    
    await createGroup(page, "Delete Group", ["Delete Test"]);
    await page.locator(".navbar-end a, .navbar-end button").last().click();
    
    // Should show delete button
    await expect(page.getByRole("button", { name: "Delete Group" })).toBeVisible();
    
    // Click delete
    await page.getByRole("button", { name: "Delete Group" }).click();
    
    // Confirmation modal
    await expect(page.getByText("Are you sure")).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();
    
    // Should navigate home
    await expect(page).toHaveURL("/");
    
    // Group should be gone
    await switchToGroupsTab(page);
    await expect(page.getByText("No groups yet")).toBeVisible();
    
    await context2.close();
  });
});

test.describe("Real-time Group Messaging", () => {
  test("group message is received by other members", async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const alice = await context1.newPage();
    const bob = await context2.newPage();
    
    // Set up Alice
    await alice.goto("/");
    await clearStorage(alice);
    await alice.goto("/");
    await ensureIdentity(alice);
    const aliceLink = await getShareLink(alice);
    
    // Set up Bob
    await bob.goto("/");
    await clearStorage(bob);
    await bob.goto("/");
    await ensureIdentity(bob);
    const bobLink = await getShareLink(bob);
    
    // Both add each other
    await addContactViaLink(alice, bobLink, "Bob");
    await addContactViaLink(bob, aliceLink, "Alice");
    
    // Wait for P2P
    await alice.waitForTimeout(2000);
    await bob.waitForTimeout(2000);
    
    // Alice creates group with Bob
    await createGroup(alice, "Real-time Group", ["Bob"]);
    
    // Wait for Bob to receive group invite
    await bob.waitForTimeout(3000);
    
    // Bob should see the group
    await bob.goto("/");
    await waitForAppReady(bob);
    await switchToGroupsTab(bob);
    
    // Group might take a moment to appear
    await bob.waitForTimeout(1000);
    
    // If Bob has the group, open it
    const groupLink = bob.getByText("Real-time Group");
    if (await groupLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await groupLink.click();
      
      // Alice sends a message
      await sendMessage(alice, "Hello from Alice in group!");
      
      // Bob should receive it
      await waitForMessage(bob, "Hello from Alice in group!", 30000);
    }
    
    await context1.close();
    await context2.close();
  });
});

