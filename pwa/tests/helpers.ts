/**
 * Test helpers for Zault E2E tests
 */
import { Page, BrowserContext, Browser, expect } from "@playwright/test";

/**
 * Wait for WASM to load and app to be ready
 */
export async function waitForAppReady(page: Page, timeout = 30000) {
  // Wait for the app to hydrate - look for common elements
  // On home page: "Zault" title
  // On chat page: navbar with back button
  // On any page: the base-100 background
  await page.waitForFunction(() => {
    // Check if we have any hydrated content
    const hasNavbar = document.querySelector('.navbar');
    const hasZault = document.body.innerText.includes('Zault');
    const hasChat = document.querySelector('.chat-bubble') || document.querySelector('input[placeholder="Message"]');
    const hasContent = document.querySelector('.bg-base-100');
    return hasNavbar || hasZault || hasChat || hasContent;
  }, { timeout });
  
  // Wait for loading spinner to disappear if present
  await page.waitForFunction(() => {
    const loading = document.querySelector('.loading');
    return !loading;
  }, { timeout: 10000 }).catch(() => {
    // Loading might have finished before we started waiting
  });
  
  // Small delay for hydration
  await page.waitForTimeout(300);
}

/**
 * Create a new identity if none exists
 */
export async function ensureIdentity(page: Page) {
  await waitForAppReady(page);
  
  // Check if "Get Started" button exists (no identity)
  const getStarted = page.getByRole("button", { name: "Get Started" });
  if (await getStarted.isVisible({ timeout: 2000 }).catch(() => false)) {
    await getStarted.click();
    // Wait for identity to be created - share input appears
    await page.waitForSelector('input[readonly]', { timeout: 15000 });
    // Wait a bit more for state to settle
    await page.waitForTimeout(500);
  }
}

/**
 * Get the share link from the home page
 */
export async function getShareLink(page: Page): Promise<string> {
  const input = page.locator('input[readonly]').first();
  await expect(input).toBeVisible({ timeout: 5000 });
  return await input.inputValue();
}

/**
 * Get the short ID from the share link
 */
export async function getShortId(page: Page): Promise<string> {
  const link = await getShareLink(page);
  const url = new URL(link);
  const id = url.searchParams.get("id");
  if (!id) throw new Error("No id in share link");
  return id.slice(0, 16);
}

/**
 * Add a contact using their share link
 */
export async function addContactViaLink(page: Page, shareLink: string, name: string) {
  const url = new URL(shareLink);
  const id = url.searchParams.get("id");
  
  await page.goto(`/add?id=${id}`);
  await waitForAppReady(page);
  
  // Fill in the name (placeholder is "Alice")
  const nameInput = page.getByPlaceholder("Alice");
  await expect(nameInput).toBeVisible();
  await nameInput.fill(name);
  
  // Click add
  await page.getByRole("button", { name: "Add Contact" }).click();
  
  // Wait for navigation to chat (the app navigates to chat after adding)
  await page.waitForURL(/\/chat\//, { timeout: 10000 });
}

/**
 * Navigate to chat with a contact
 */
export async function openChat(page: Page, contactName: string) {
  await page.goto("/");
  await waitForAppReady(page);
  await ensureIdentity(page);
  
  // Click on the contact in the list
  const contactLink = page.locator(`a:has-text("${contactName}")`).first();
  await expect(contactLink).toBeVisible({ timeout: 5000 });
  await contactLink.click();
  
  // Wait for chat to load
  await page.waitForSelector('input[placeholder="Message"]', { timeout: 10000 });
}

/**
 * Send a message in the current chat
 */
export async function sendMessage(page: Page, message: string) {
  // Try different placeholder texts (1:1 chat vs group chat)
  let input = page.getByPlaceholder("Message");
  if (!await input.isVisible({ timeout: 1000 }).catch(() => false)) {
    input = page.getByPlaceholder("Type a message...");
  }
  await expect(input).toBeVisible();
  await input.fill(message);
  
  // Find and click send button (btn-primary with or without btn-square)
  const sendButton = page.locator('button.btn-primary');
  await sendButton.click();
  
  // Wait for message to appear in chat
  await expect(page.locator(`.chat-bubble:has-text("${message}")`)).toBeVisible({ timeout: 10000 });
}

/**
 * Wait for a message to be received
 */
export async function waitForMessage(page: Page, message: string, timeout = 30000) {
  await expect(page.locator(`.chat-bubble:has-text("${message}")`)).toBeVisible({ timeout });
}

/**
 * Clear storage by navigating to settings and using clear all data
 * This is more reliable than trying to access IndexedDB directly
 */
export async function clearStorageViaUI(page: Page) {
  await page.goto("/settings");
  await waitForAppReady(page);
  
  // Click "Clear All Data" twice (confirmation)
  const clearButton = page.getByRole("button", { name: /Clear All Data/i });
  await clearButton.click();
  
  // Confirm
  const confirmButton = page.getByRole("button", { name: /Confirm/i });
  await confirmButton.click();
  
  // Wait for redirect to home
  await page.waitForURL("/", { timeout: 10000 });
}

/**
 * Clear storage directly via page evaluate
 * Note: This clears localforage's default database
 */
export async function clearStorage(page: Page) {
  await page.evaluate(async () => {
    // Clear localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    
    // Delete known IndexedDB databases used by localforage
    const dbs = ['localforage'];
    for (const db of dbs) {
      try {
        indexedDB.deleteDatabase(db);
      } catch {}
    }
  });
}

/**
 * Create a fresh browser context with clean storage
 */
export async function createFreshContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext();
  return context;
}

/**
 * Setup a user with identity in a fresh context
 */
export async function setupUser(browser: Browser, baseURL: string): Promise<{ context: BrowserContext; page: Page; shareLink: string }> {
  const context = await createFreshContext(browser);
  const page = await context.newPage();
  
  await page.goto(baseURL);
  await waitForAppReady(page);
  await ensureIdentity(page);
  
  const shareLink = await getShareLink(page);
  
  return { context, page, shareLink };
}

/**
 * Wait for P2P connection to be established
 */
export async function waitForP2PConnected(page: Page, timeout = 30000) {
  // Look for the success status indicator or "online" text
  await page.waitForFunction(() => {
    const text = document.body.innerText;
    return text.includes("online") || text.includes("Connected");
  }, { timeout });
}

/**
 * Get the connection status text
 */
export async function getConnectionStatus(page: Page): Promise<string> {
  const statusText = page.locator(".navbar-end .text-sm").first();
  if (await statusText.isVisible({ timeout: 2000 }).catch(() => false)) {
    return await statusText.textContent() || "";
  }
  return "";
}

/**
 * Switch to Groups tab
 */
export async function switchToGroupsTab(page: Page) {
  const groupsTab = page.locator('button:has-text("Groups")');
  await expect(groupsTab).toBeVisible();
  await groupsTab.click();
  await page.waitForTimeout(200);
}

/**
 * Switch to Contacts tab
 */
export async function switchToContactsTab(page: Page) {
  const contactsTab = page.locator('button:has-text("Contacts")');
  await expect(contactsTab).toBeVisible();
  await contactsTab.click();
  await page.waitForTimeout(200);
}

/**
 * Create a new group
 */
export async function createGroup(page: Page, name: string, contactNames: string[]) {
  await page.goto("/");
  await waitForAppReady(page);
  await ensureIdentity(page);
  
  // Switch to groups tab
  await switchToGroupsTab(page);
  
  // Click FAB or "Create Group" link
  const fab = page.locator('a.btn-circle').first();
  await fab.click();
  
  await page.waitForURL("/group/new", { timeout: 5000 });
  
  // Fill group name
  const nameInput = page.getByPlaceholder("Enter group name");
  await nameInput.fill(name);
  
  // Select contacts by clicking their checkboxes
  for (const contactName of contactNames) {
    const checkbox = page.locator(`label:has-text("${contactName}") input[type="checkbox"]`);
    await checkbox.check();
  }
  
  // Create
  await page.getByRole("button", { name: "Create Group" }).click();
  
  // Wait for navigation to group chat (not /group/new)
  await page.waitForURL(/\/group\/(?!new)[^/]+$/, { timeout: 15000 });
  
  // Wait for the group page to load
  await page.waitForTimeout(500);
}

/**
 * Open a group chat
 */
export async function openGroupChat(page: Page, groupName: string) {
  await page.goto("/");
  await waitForAppReady(page);
  await ensureIdentity(page);
  
  await switchToGroupsTab(page);
  
  const groupLink = page.locator(`a:has-text("${groupName}")`).first();
  await expect(groupLink).toBeVisible({ timeout: 5000 });
  await groupLink.click();
  
  // Wait for chat to load
  await page.waitForSelector('input[placeholder="Message"]', { timeout: 10000 });
}

/**
 * Wait for WebSocket connection to be ready
 */
export async function waitForWebSocket(page: Page, timeout = 10000) {
  await page.waitForFunction(() => {
    // Check if we see any connection status
    const text = document.body.innerText.toLowerCase();
    return text.includes("online") || text.includes("connecting") || text.includes("offline");
  }, { timeout });
}
