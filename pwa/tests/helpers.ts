/**
 * Test helpers for Zault E2E tests
 */
import { Page, BrowserContext, expect } from "@playwright/test";

/**
 * Wait for WASM to load and app to be ready
 */
export async function waitForAppReady(page: Page) {
  // Wait for loading to finish
  await page.waitForFunction(() => {
    const loading = document.querySelector(".loading-spinner");
    return !loading || loading.closest(".min-h-dvh") === null;
  }, { timeout: 30000 });
  
  // Wait a bit for hydration
  await page.waitForTimeout(500);
}

/**
 * Create a new identity if none exists
 */
export async function ensureIdentity(page: Page) {
  await waitForAppReady(page);
  
  // Check if "Get Started" button exists (no identity)
  const getStarted = page.getByRole("button", { name: "Get Started" });
  if (await getStarted.isVisible({ timeout: 1000 }).catch(() => false)) {
    await getStarted.click();
    // Wait for identity to be created
    await page.waitForSelector('input[readonly]', { timeout: 10000 });
  }
}

/**
 * Get the share link from the home page
 */
export async function getShareLink(page: Page): Promise<string> {
  const input = page.locator('input[readonly]');
  await expect(input).toBeVisible();
  return await input.inputValue();
}

/**
 * Get the short ID from the share link
 */
export async function getShortId(page: Page): Promise<string> {
  const link = await getShareLink(page);
  // Extract the id parameter
  const url = new URL(link);
  const id = url.searchParams.get("id");
  if (!id) throw new Error("No id in share link");
  // The short ID is the first 16 chars of the base64url encoded public identity
  return id.slice(0, 16);
}

/**
 * Add a contact using their share link
 */
export async function addContactViaLink(page: Page, shareLink: string, name: string) {
  // Extract the id from the link
  const url = new URL(shareLink);
  const id = url.searchParams.get("id");
  
  // Navigate to add page with the id
  await page.goto(`/add?id=${id}`);
  await waitForAppReady(page);
  
  // Fill in the name
  const nameInput = page.getByPlaceholder("Enter a name");
  await nameInput.fill(name);
  
  // Click add
  await page.getByRole("button", { name: "Add Contact" }).click();
  
  // Wait for navigation back to home
  await page.waitForURL("/", { timeout: 10000 });
}

/**
 * Navigate to chat with a contact
 */
export async function openChat(page: Page, contactName: string) {
  await page.goto("/");
  await waitForAppReady(page);
  
  // Click on the contact
  await page.getByText(contactName).click();
  
  // Wait for chat to load
  await page.waitForSelector('input[placeholder="Type a message..."]');
}

/**
 * Send a message in the current chat
 */
export async function sendMessage(page: Page, message: string) {
  const input = page.getByPlaceholder("Type a message...");
  await input.fill(message);
  await page.getByRole("button", { name: /send/i }).or(page.locator('button[type="submit"]')).click();
  
  // Wait for message to appear
  await expect(page.getByText(message)).toBeVisible({ timeout: 10000 });
}

/**
 * Wait for a message to be received
 */
export async function waitForMessage(page: Page, message: string, timeout = 30000) {
  await expect(page.getByText(message)).toBeVisible({ timeout });
}

/**
 * Clear IndexedDB storage for a fresh start
 */
export async function clearStorage(page: Page) {
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    for (const db of dbs) {
      if (db.name) {
        indexedDB.deleteDatabase(db.name);
      }
    }
    localStorage.clear();
    sessionStorage.clear();
  });
}

/**
 * Create a new browser context with isolated storage
 */
export async function createIsolatedContext(browser: any): Promise<BrowserContext> {
  return await browser.newContext({
    storageState: undefined, // Fresh storage
  });
}

/**
 * Wait for P2P connection to be established
 */
export async function waitForP2PConnected(page: Page, timeout = 30000) {
  await page.waitForFunction(() => {
    const status = document.querySelector('[aria-label="connected"]');
    return status !== null;
  }, { timeout });
}

/**
 * Get the connection status text
 */
export async function getConnectionStatus(page: Page): Promise<string> {
  const statusText = page.locator(".navbar-end .text-sm");
  return await statusText.textContent() || "";
}

/**
 * Switch to Groups tab
 */
export async function switchToGroupsTab(page: Page) {
  await page.getByRole("button", { name: "Groups" }).click();
}

/**
 * Switch to Contacts tab
 */
export async function switchToContactsTab(page: Page) {
  await page.getByRole("button", { name: "Contacts" }).click();
}

/**
 * Create a new group
 */
export async function createGroup(page: Page, name: string, contactNames: string[]) {
  await page.goto("/");
  await waitForAppReady(page);
  
  // Switch to groups tab
  await switchToGroupsTab(page);
  
  // Click create group (FAB or link)
  const createLink = page.getByRole("link", { name: "Create Group" });
  if (await createLink.isVisible({ timeout: 1000 }).catch(() => false)) {
    await createLink.click();
  } else {
    // Click FAB
    await page.locator(".fixed.bottom-6.right-6 a").click();
  }
  
  await page.waitForURL("/group/new");
  
  // Fill group name
  await page.getByPlaceholder("Enter group name").fill(name);
  
  // Select contacts
  for (const contactName of contactNames) {
    await page.getByText(contactName).click();
  }
  
  // Create
  await page.getByRole("button", { name: "Create Group" }).click();
  
  // Wait for navigation to group chat
  await page.waitForURL(/\/group\//, { timeout: 10000 });
}

/**
 * Open a group chat
 */
export async function openGroupChat(page: Page, groupName: string) {
  await page.goto("/");
  await waitForAppReady(page);
  
  await switchToGroupsTab(page);
  await page.getByText(groupName).click();
  
  // Wait for chat to load
  await page.waitForSelector('input[placeholder="Type a message..."]');
}

