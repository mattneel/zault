/**
 * 1:1 Chat tests
 */
import { test, expect } from "@playwright/test";
import { 
  waitForAppReady, 
  ensureIdentity, 
  addContactViaLink,
  sendMessage,
  waitForMessage,
  createFreshContext,
  setupUser,
} from "./helpers";

test.describe("1:1 Chat", () => {
  test("chat page shows empty state initially", async ({ browser, baseURL }) => {
    const user1 = await setupUser(browser, baseURL!);
    const user2 = await setupUser(browser, baseURL!);
    
    // Add contact - this navigates to chat
    await addContactViaLink(user1.page, user2.shareLink, "Chat Partner");
    
    // Should show empty state
    await expect(user1.page.getByText("No messages yet")).toBeVisible();
    
    await user1.context.close();
    await user2.context.close();
  });

  test("can send a message", async ({ browser, baseURL }) => {
    const user1 = await setupUser(browser, baseURL!);
    const user2 = await setupUser(browser, baseURL!);
    
    await addContactViaLink(user1.page, user2.shareLink, "Message Test");
    
    // We're now in chat
    await sendMessage(user1.page, "Hello, World!");
    
    // Message should appear in chat
    await expect(user1.page.locator('.chat-bubble:has-text("Hello, World!")')).toBeVisible();
    
    await user1.context.close();
    await user2.context.close();
  });

  test("messages persist after page reload", async ({ browser, baseURL }) => {
    const user1 = await setupUser(browser, baseURL!);
    const user2 = await setupUser(browser, baseURL!);
    
    await addContactViaLink(user1.page, user2.shareLink, "Persist Test");
    await sendMessage(user1.page, "This should persist");
    
    // Get the current URL (chat page)
    const chatUrl = user1.page.url();
    
    // Reload
    await user1.page.reload();
    await waitForAppReady(user1.page);
    
    // Message should still be there
    await expect(user1.page.locator('.chat-bubble:has-text("This should persist")')).toBeVisible();
    
    await user1.context.close();
    await user2.context.close();
  });

  test("chat header shows contact name", async ({ browser, baseURL }) => {
    const user1 = await setupUser(browser, baseURL!);
    const user2 = await setupUser(browser, baseURL!);
    
    await addContactViaLink(user1.page, user2.shareLink, "Header Test");
    
    // Header should show contact name
    await expect(user1.page.getByText("Header Test")).toBeVisible();
    
    await user1.context.close();
    await user2.context.close();
  });

  test("back button returns to home from chat", async ({ browser, baseURL }) => {
    const user1 = await setupUser(browser, baseURL!);
    const user2 = await setupUser(browser, baseURL!);
    
    await addContactViaLink(user1.page, user2.shareLink, "Back Test");
    
    // Click back button
    await user1.page.locator('.navbar-start button').click();
    
    await expect(user1.page).toHaveURL("/");
    
    await user1.context.close();
    await user2.context.close();
  });

  test("can send message with send button", async ({ browser, baseURL }) => {
    const user1 = await setupUser(browser, baseURL!);
    const user2 = await setupUser(browser, baseURL!);
    
    await addContactViaLink(user1.page, user2.shareLink, "Send Test");
    
    const input = user1.page.getByPlaceholder("Message");
    await input.fill("Test message");
    
    // Submit via button
    await user1.page.locator('button.btn-primary.btn-square').click();
    
    // Message should appear
    await expect(user1.page.locator('.chat-bubble:has-text("Test message")')).toBeVisible();
    
    await user1.context.close();
    await user2.context.close();
  });
});

test.describe("Real-time Messaging", () => {
  test("message is received by other user in real-time", async ({ browser, baseURL }) => {
    // Create two users
    const alice = await setupUser(browser, baseURL!);
    const bob = await setupUser(browser, baseURL!);
    
    // Alice adds Bob
    await addContactViaLink(alice.page, bob.shareLink, "Bob");
    
    // Bob adds Alice
    await addContactViaLink(bob.page, alice.shareLink, "Alice");
    
    // Both are now in their respective chats
    // Wait for P2P connections
    await alice.page.waitForTimeout(2000);
    await bob.page.waitForTimeout(2000);
    
    // Alice sends a message
    await sendMessage(alice.page, "Hello Bob from Alice!");
    
    // Bob should receive it
    await waitForMessage(bob.page, "Hello Bob from Alice!", 30000);
    
    // Bob replies
    await sendMessage(bob.page, "Hi Alice, got your message!");
    
    // Alice should receive the reply
    await waitForMessage(alice.page, "Hi Alice, got your message!", 30000);
    
    await alice.context.close();
    await bob.context.close();
  });

  test("messages show correct sender styling", async ({ browser, baseURL }) => {
    const alice = await setupUser(browser, baseURL!);
    const bob = await setupUser(browser, baseURL!);
    
    await addContactViaLink(alice.page, bob.shareLink, "Bob");
    await addContactViaLink(bob.page, alice.shareLink, "Alice");
    
    await alice.page.waitForTimeout(2000);
    
    await sendMessage(alice.page, "From Alice");
    await waitForMessage(bob.page, "From Alice", 30000);
    
    // On Alice's screen, her message should be chat-end (right side)
    const aliceMsg = alice.page.locator(".chat-end").filter({ hasText: "From Alice" });
    await expect(aliceMsg).toBeVisible();
    
    // On Bob's screen, Alice's message should be chat-start (left side)
    const bobView = bob.page.locator(".chat-start").filter({ hasText: "From Alice" });
    await expect(bobView).toBeVisible();
    
    await alice.context.close();
    await bob.context.close();
  });
});
