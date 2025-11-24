/**
 * Contact management tests
 */
import { test, expect } from "@playwright/test";
import { 
  waitForAppReady, 
  ensureIdentity, 
  getShareLink,
  addContactViaLink,
  createFreshContext,
  setupUser,
} from "./helpers";

test.describe("Contacts", () => {
  test("shows empty state when no contacts", async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    
    await page.goto("/");
    await ensureIdentity(page);
    
    await expect(page.getByText("No contacts yet")).toBeVisible();
    
    await context.close();
  });

  test("FAB navigates to add contact page", async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    
    await page.goto("/");
    await ensureIdentity(page);
    
    // Click the FAB - it's a link with href="/add"
    const fab = page.locator('a[href="/add"]').last();
    await fab.click();
    
    await expect(page).toHaveURL("/add");
    
    await context.close();
  });

  test("add contact page has input fields", async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    
    await page.goto("/add");
    await waitForAppReady(page);
    
    // Check for name input (placeholder is "Alice")
    await expect(page.getByPlaceholder("Alice")).toBeVisible();
    
    // Check for identity textarea
    await expect(page.getByPlaceholder(/identity|share link/i)).toBeVisible();
    
    await context.close();
  });

  test("can add contact via share link", async ({ browser, baseURL }) => {
    // User 1
    const user1 = await setupUser(browser, baseURL!);
    
    // User 2
    const user2 = await setupUser(browser, baseURL!);
    
    // User 1 adds User 2 as contact
    await addContactViaLink(user1.page, user2.shareLink, "Test Contact");
    
    // Should navigate to chat after adding
    await expect(user1.page).toHaveURL(/\/chat\//);
    
    // Go home and check contact is there
    await user1.page.goto("/");
    await waitForAppReady(user1.page);
    await expect(user1.page.getByText("Test Contact")).toBeVisible();
    
    await user1.context.close();
    await user2.context.close();
  });

  test("contact appears in list after adding", async ({ browser, baseURL }) => {
    const user1 = await setupUser(browser, baseURL!);
    const user2 = await setupUser(browser, baseURL!);
    
    await addContactViaLink(user1.page, user2.shareLink, "Alice");
    
    // Navigate home
    await user1.page.goto("/");
    await waitForAppReady(user1.page);
    
    // Contact should be in the list
    await expect(user1.page.getByText("Alice")).toBeVisible();
    
    await user1.context.close();
    await user2.context.close();
  });

  test("adding contact navigates to chat", async ({ browser, baseURL }) => {
    // This test verifies that after adding a contact, we're taken to the chat
    const user1 = await setupUser(browser, baseURL!);
    const user2 = await setupUser(browser, baseURL!);
    
    // Add contact - this should navigate to chat
    await addContactViaLink(user1.page, user2.shareLink, "Bob");
    
    // Should be on chat page
    await expect(user1.page).toHaveURL(/\/chat\//);
    await expect(user1.page.getByPlaceholder("Message")).toBeVisible();
    
    // Chat header should show contact name
    await expect(user1.page.getByText("Bob")).toBeVisible();
    
    await user1.context.close();
    await user2.context.close();
  });

  test("contacts persist after reload", async ({ browser, baseURL }) => {
    const user1 = await setupUser(browser, baseURL!);
    const user2 = await setupUser(browser, baseURL!);
    
    await addContactViaLink(user1.page, user2.shareLink, "Persistent Contact");
    
    // Navigate home
    await user1.page.goto("/");
    await waitForAppReady(user1.page);
    await expect(user1.page.getByText("Persistent Contact")).toBeVisible();
    
    // Reload
    await user1.page.reload();
    await waitForAppReady(user1.page);
    
    // Contact should still be there
    await expect(user1.page.getByText("Persistent Contact")).toBeVisible();
    
    await user1.context.close();
    await user2.context.close();
  });

  test("shows error for invalid identity", async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    
    await page.goto("/add");
    await waitForAppReady(page);
    
    // Fill name
    await page.getByPlaceholder("Alice").fill("Invalid");
    
    // Fill invalid identity
    await page.getByPlaceholder(/identity|share link/i).fill("not-valid-data");
    
    // Click add
    await page.getByRole("button", { name: "Add Contact" }).click();
    
    // Should show error alert
    await expect(page.locator('.alert-error')).toBeVisible();
    
    await context.close();
  });

  test("back button returns to home", async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    
    await page.goto("/add");
    await waitForAppReady(page);
    
    // Click back button (the square button in navbar-start)
    await page.locator('.navbar-start button').click();
    
    await expect(page).toHaveURL("/");
    
    await context.close();
  });
});
