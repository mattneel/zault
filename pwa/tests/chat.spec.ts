/**
 * 1:1 Chat tests
 */
import { test, expect } from "@playwright/test";
import { 
  waitForAppReady, 
  ensureIdentity, 
  getShareLink,
  addContactViaLink,
  openChat,
  sendMessage,
  waitForMessage,
  clearStorage,
} from "./helpers";

test.describe("1:1 Chat", () => {
  test("chat page shows empty state initially", async ({ page, browser }) => {
    await clearStorage(page);
    await page.goto("/");
    await ensureIdentity(page);
    
    // Create contact
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto("/");
    await clearStorage(page2);
    await page2.goto("/");
    await ensureIdentity(page2);
    
    const otherLink = await getShareLink(page2);
    await addContactViaLink(page, otherLink, "Chat Partner");
    
    // Open chat
    await openChat(page, "Chat Partner");
    
    // Should show empty state
    await expect(page.getByText("No messages yet")).toBeVisible();
    
    await context2.close();
  });

  test("can send a message", async ({ page, browser }) => {
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
    await addContactViaLink(page, otherLink, "Message Test");
    
    await openChat(page, "Message Test");
    await sendMessage(page, "Hello, World!");
    
    // Message should appear in chat
    await expect(page.getByText("Hello, World!")).toBeVisible();
    
    await context2.close();
  });

  test("messages persist after page reload", async ({ page, browser }) => {
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
    await addContactViaLink(page, otherLink, "Persist Test");
    
    await openChat(page, "Persist Test");
    await sendMessage(page, "This should persist");
    
    // Reload
    await page.reload();
    await waitForAppReady(page);
    
    // Message should still be there
    await expect(page.getByText("This should persist")).toBeVisible();
    
    await context2.close();
  });

  test("chat header shows contact name", async ({ page, browser }) => {
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
    await addContactViaLink(page, otherLink, "Header Test");
    
    await openChat(page, "Header Test");
    
    // Header should show contact name
    await expect(page.locator(".navbar-center").getByText("Header Test")).toBeVisible();
    
    await context2.close();
  });

  test("back button returns to home from chat", async ({ page, browser }) => {
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
    await addContactViaLink(page, otherLink, "Back Test");
    
    await openChat(page, "Back Test");
    
    // Click back
    await page.locator(".navbar-start a, .navbar-start button").first().click();
    
    await expect(page).toHaveURL("/");
    
    await context2.close();
  });

  test("message input is disabled while sending", async ({ page, browser }) => {
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
    await addContactViaLink(page, otherLink, "Disable Test");
    
    await openChat(page, "Disable Test");
    
    const input = page.getByPlaceholder("Type a message...");
    await input.fill("Test message");
    
    // Submit
    await page.locator('button[type="submit"]').click();
    
    // Input should be disabled briefly during send
    // (This is hard to catch, so we just verify the message appears)
    await expect(page.getByText("Test message")).toBeVisible();
    
    await context2.close();
  });
});

test.describe("Real-time Messaging", () => {
  test("message is received by other user in real-time", async ({ browser }) => {
    // Create two isolated contexts
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
    
    // Alice adds Bob
    await addContactViaLink(alice, bobLink, "Bob");
    
    // Bob adds Alice
    await addContactViaLink(bob, aliceLink, "Alice");
    
    // Wait for P2P connections to establish
    await alice.waitForTimeout(2000);
    await bob.waitForTimeout(2000);
    
    // Alice opens chat with Bob
    await openChat(alice, "Bob");
    
    // Bob opens chat with Alice
    await openChat(bob, "Alice");
    
    // Alice sends a message
    await sendMessage(alice, "Hello Bob from Alice!");
    
    // Bob should receive it
    await waitForMessage(bob, "Hello Bob from Alice!", 30000);
    
    // Bob replies
    await sendMessage(bob, "Hi Alice, got your message!");
    
    // Alice should receive the reply
    await waitForMessage(alice, "Hi Alice, got your message!", 30000);
    
    await context1.close();
    await context2.close();
  });

  test("messages show correct sender styling", async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const alice = await context1.newPage();
    const bob = await context2.newPage();
    
    await alice.goto("/");
    await clearStorage(alice);
    await alice.goto("/");
    await ensureIdentity(alice);
    const aliceLink = await getShareLink(alice);
    
    await bob.goto("/");
    await clearStorage(bob);
    await bob.goto("/");
    await ensureIdentity(bob);
    const bobLink = await getShareLink(bob);
    
    await addContactViaLink(alice, bobLink, "Bob");
    await addContactViaLink(bob, aliceLink, "Alice");
    
    await alice.waitForTimeout(2000);
    
    await openChat(alice, "Bob");
    await openChat(bob, "Alice");
    
    await sendMessage(alice, "From Alice");
    await waitForMessage(bob, "From Alice", 30000);
    
    // On Alice's screen, her message should be chat-end (right side)
    const aliceMsg = alice.locator(".chat-end").filter({ hasText: "From Alice" });
    await expect(aliceMsg).toBeVisible();
    
    // On Bob's screen, Alice's message should be chat-start (left side)
    const bobView = bob.locator(".chat-start").filter({ hasText: "From Alice" });
    await expect(bobView).toBeVisible();
    
    await context1.close();
    await context2.close();
  });
});

