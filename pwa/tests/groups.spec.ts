/**
 * Group chat tests
 */
import { test, expect } from "@playwright/test";
import { 
  waitForAppReady, 
  ensureIdentity, 
  addContactViaLink,
  switchToGroupsTab,
  switchToContactsTab,
  createGroup,
  sendMessage,
  waitForMessage,
  createFreshContext,
  setupUser,
} from "./helpers";

test.describe("Groups", () => {
  test("groups tab shows empty state", async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    
    await page.goto("/");
    await ensureIdentity(page);
    
    await switchToGroupsTab(page);
    
    await expect(page.getByText("No groups yet")).toBeVisible();
    
    await context.close();
  });

  test("tabs switch between contacts and groups", async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    
    await page.goto("/");
    await ensureIdentity(page);
    
    // Should start on contacts
    await expect(page.getByText("No contacts yet")).toBeVisible();
    
    // Switch to groups
    await switchToGroupsTab(page);
    await expect(page.getByText("No groups yet")).toBeVisible();
    
    // Switch back to contacts
    await switchToContactsTab(page);
    await expect(page.getByText("No contacts yet")).toBeVisible();
    
    await context.close();
  });

  test("FAB changes based on active tab", async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    
    await page.goto("/");
    await ensureIdentity(page);
    
    // On contacts tab, FAB goes to /add
    const fab = page.locator('a.btn-circle').first();
    await expect(fab).toHaveAttribute("href", "/add");
    
    // Switch to groups
    await switchToGroupsTab(page);
    
    // FAB should go to /group/new
    await expect(fab).toHaveAttribute("href", "/group/new");
    
    await context.close();
  });

  test("create group page shows contact selection", async ({ browser, baseURL }) => {
    const user1 = await setupUser(browser, baseURL!);
    const user2 = await setupUser(browser, baseURL!);
    
    // Add contact first
    await addContactViaLink(user1.page, user2.shareLink, "Group Member");
    
    // Navigate to create group
    await user1.page.goto("/group/new");
    await waitForAppReady(user1.page);
    
    // Should show group name input
    await expect(user1.page.getByPlaceholder(/group name/i)).toBeVisible();
    
    // Should show the contact
    await expect(user1.page.getByText("Group Member")).toBeVisible();
    
    await user1.context.close();
    await user2.context.close();
  });

  test("can create a group", async ({ browser, baseURL }) => {
    const user1 = await setupUser(browser, baseURL!);
    const user2 = await setupUser(browser, baseURL!);
    
    await addContactViaLink(user1.page, user2.shareLink, "Group Buddy");
    
    // Go home and verify contact is there
    await user1.page.goto("/");
    await waitForAppReady(user1.page);
    await expect(user1.page.getByText("Group Buddy")).toBeVisible({ timeout: 5000 });
    
    // Switch to groups tab
    await switchToGroupsTab(user1.page);
    
    // Click the "Create Group" link
    await user1.page.getByRole("link", { name: "Create Group" }).click();
    await user1.page.waitForURL("/group/new");
    
    // Fill group name
    await user1.page.getByPlaceholder("Enter group name").fill("Test Group");
    
    // Select contact
    const checkbox = user1.page.locator('label').filter({ hasText: "Group Buddy" }).locator('input[type="checkbox"]');
    await checkbox.check();
    
    // Create
    await user1.page.getByRole("button", { name: "Create Group" }).click();
    
    // Wait for navigation to group chat
    await user1.page.waitForFunction(() => {
      const url = window.location.pathname;
      return url.startsWith('/group/') && url !== '/group/new';
    }, { timeout: 15000 });
    
    // Should be in the group chat
    await expect(user1.page.locator('.font-semibold:has-text("Test Group")')).toBeVisible({ timeout: 10000 });
    
    await user1.context.close();
    await user2.context.close();
  });

  test("group appears in groups list after creation", async ({ browser, baseURL }) => {
    const user1 = await setupUser(browser, baseURL!);
    const user2 = await setupUser(browser, baseURL!);
    
    await addContactViaLink(user1.page, user2.shareLink, "List Test");
    
    await user1.page.goto("/");
    await waitForAppReady(user1.page);
    
    await createGroup(user1.page, "Listed Group", ["List Test"]);
    
    // Go back to home
    await user1.page.goto("/");
    await waitForAppReady(user1.page);
    
    await switchToGroupsTab(user1.page);
    
    // Group should be visible
    await expect(user1.page.getByText("Listed Group")).toBeVisible();
    
    await user1.context.close();
    await user2.context.close();
  });

  test("group chat shows empty state initially", async ({ browser, baseURL }) => {
    const user1 = await setupUser(browser, baseURL!);
    const user2 = await setupUser(browser, baseURL!);
    
    await addContactViaLink(user1.page, user2.shareLink, "Empty Chat Test");
    
    await user1.page.goto("/");
    await waitForAppReady(user1.page);
    
    await createGroup(user1.page, "Empty Chat Group", ["Empty Chat Test"]);
    
    await expect(user1.page.getByText("No messages yet")).toBeVisible();
    
    await user1.context.close();
    await user2.context.close();
  });

  test("can send message in group", async ({ browser, baseURL }) => {
    const user1 = await setupUser(browser, baseURL!);
    const user2 = await setupUser(browser, baseURL!);
    
    await addContactViaLink(user1.page, user2.shareLink, "Message Test");
    
    await user1.page.goto("/");
    await waitForAppReady(user1.page);
    
    await createGroup(user1.page, "Message Group", ["Message Test"]);
    
    await sendMessage(user1.page, "Hello group!");
    
    await expect(user1.page.locator('.chat-bubble:has-text("Hello group!")')).toBeVisible();
    
    await user1.context.close();
    await user2.context.close();
  });

  test("group messages persist after reload", async ({ browser, baseURL }) => {
    const user1 = await setupUser(browser, baseURL!);
    const user2 = await setupUser(browser, baseURL!);
    
    await addContactViaLink(user1.page, user2.shareLink, "Persist Test");
    
    await user1.page.goto("/");
    await waitForAppReady(user1.page);
    
    await createGroup(user1.page, "Persist Group", ["Persist Test"]);
    await sendMessage(user1.page, "Persistent group message");
    
    // Reload
    await user1.page.reload();
    await waitForAppReady(user1.page);
    
    await expect(user1.page.locator('.chat-bubble:has-text("Persistent group message")')).toBeVisible();
    
    await user1.context.close();
    await user2.context.close();
  });
});

test.describe("Group Settings", () => {
  test("can access group settings", async ({ browser, baseURL }) => {
    const user1 = await setupUser(browser, baseURL!);
    const user2 = await setupUser(browser, baseURL!);
    
    await addContactViaLink(user1.page, user2.shareLink, "Settings Test");
    
    await user1.page.goto("/");
    await waitForAppReady(user1.page);
    
    await createGroup(user1.page, "Settings Group", ["Settings Test"]);
    
    // Click settings button (in navbar-end)
    await user1.page.locator('.navbar-end a').click();
    
    // Settings page is now at /group-settings/:id
    await expect(user1.page).toHaveURL(/\/group-settings\//);
    
    await user1.context.close();
    await user2.context.close();
  });
});
