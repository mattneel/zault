/**
 * Contact management tests
 */
import { test, expect } from "@playwright/test";
import { 
  waitForAppReady, 
  ensureIdentity, 
  getShareLink,
  addContactViaLink,
  clearStorage,
} from "./helpers";

test.describe("Contacts", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await page.goto("/");
    await ensureIdentity(page);
  });

  test("shows empty state when no contacts", async ({ page }) => {
    await expect(page.getByText("No contacts yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Add Contact" })).toBeVisible();
  });

  test("FAB navigates to add contact page", async ({ page }) => {
    // Click the FAB (+ button)
    await page.locator(".fixed.bottom-6.right-6 a").click();
    
    await expect(page).toHaveURL("/add");
    await expect(page.getByText("Add Contact")).toBeVisible();
  });

  test("add contact page has input fields", async ({ page }) => {
    await page.goto("/add");
    await waitForAppReady(page);
    
    await expect(page.getByPlaceholder("Enter a name")).toBeVisible();
    await expect(page.getByPlaceholder("Paste identity or link")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Contact" })).toBeVisible();
  });

  test("can add contact via share link", async ({ page, browser }) => {
    // Create a second browser context to get a different identity
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    
    await page2.goto("/");
    await clearStorage(page2);
    await page2.goto("/");
    await ensureIdentity(page2);
    
    const otherShareLink = await getShareLink(page2);
    
    // Add the other user as a contact
    await addContactViaLink(page, otherShareLink, "Test Contact");
    
    // Should be back on home page with contact visible
    await expect(page.getByText("Test Contact")).toBeVisible();
    
    await context2.close();
  });

  test("contact appears in list after adding", async ({ page, browser }) => {
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    
    await page2.goto("/");
    await clearStorage(page2);
    await page2.goto("/");
    await ensureIdentity(page2);
    
    const otherShareLink = await getShareLink(page2);
    await addContactViaLink(page, otherShareLink, "Alice");
    
    // Contact should be in the list
    const contactItem = page.locator("li").filter({ hasText: "Alice" });
    await expect(contactItem).toBeVisible();
    
    // Should show the short ID
    await expect(contactItem.locator(".font-mono")).toBeVisible();
    
    await context2.close();
  });

  test("clicking contact navigates to chat", async ({ page, browser }) => {
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    
    await page2.goto("/");
    await clearStorage(page2);
    await page2.goto("/");
    await ensureIdentity(page2);
    
    const otherShareLink = await getShareLink(page2);
    await addContactViaLink(page, otherShareLink, "Bob");
    
    // Click on the contact
    await page.getByText("Bob").click();
    
    // Should navigate to chat
    await expect(page).toHaveURL(/\/chat\//);
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();
    
    await context2.close();
  });

  test("contacts persist after reload", async ({ page, browser }) => {
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    
    await page2.goto("/");
    await clearStorage(page2);
    await page2.goto("/");
    await ensureIdentity(page2);
    
    const otherShareLink = await getShareLink(page2);
    await addContactViaLink(page, otherShareLink, "Persistent Contact");
    
    await expect(page.getByText("Persistent Contact")).toBeVisible();
    
    // Reload
    await page.reload();
    await waitForAppReady(page);
    
    // Contact should still be there
    await expect(page.getByText("Persistent Contact")).toBeVisible();
    
    await context2.close();
  });

  test("rejects invalid identity data", async ({ page }) => {
    await page.goto("/add");
    await waitForAppReady(page);
    
    await page.getByPlaceholder("Enter a name").fill("Invalid");
    await page.getByPlaceholder("Paste identity or link").fill("not-valid-data");
    
    await page.getByRole("button", { name: "Add Contact" }).click();
    
    // Should show error
    await expect(page.getByText(/invalid/i)).toBeVisible();
  });

  test("back button returns to home", async ({ page }) => {
    await page.goto("/add");
    await waitForAppReady(page);
    
    // Click back button
    await page.locator(".navbar-start a, .navbar-start button").first().click();
    
    await expect(page).toHaveURL("/");
  });
});

