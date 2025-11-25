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

test.describe("Offline Sync", () => {
  test("messages sync when navigating back to chat", async ({ browser, baseURL }) => {
    // Create two users
    const alice = await setupUser(browser, baseURL!);
    const bob = await setupUser(browser, baseURL!);
    
    // Alice adds Bob and stays in chat
    await addContactViaLink(alice.page, bob.shareLink, "Bob");
    
    // Bob adds Alice
    await addContactViaLink(bob.page, alice.shareLink, "Alice");
    
    // Wait for P2P connections
    await alice.page.waitForTimeout(2000);
    await bob.page.waitForTimeout(2000);
    
    // Bob navigates AWAY from chat (back to home)
    await bob.page.locator('.navbar-start button').first().click();
    await expect(bob.page).toHaveURL("/");
    await bob.page.waitForTimeout(500);
    
    // Alice sends a message while Bob is NOT on the chat page
    await sendMessage(alice.page, "Message while Bob away");
    
    // Wait a moment for the message to be "missed"
    await alice.page.waitForTimeout(1000);
    
    // Bob navigates BACK to chat with Alice
    const aliceContact = bob.page.locator('a:has-text("Alice")').first();
    await aliceContact.click();
    await bob.page.waitForURL(/\/chat\//, { timeout: 5000 });
    
    // Bob should see the message after sync (without page refresh)
    await waitForMessage(bob.page, "Message while Bob away", 10000);
    
    await alice.context.close();
    await bob.context.close();
  });

  test("messages sync after closing and reopening chat multiple times", async ({ browser, baseURL }) => {
    // This test simulates the exact user scenario: close chat, receive message, reopen
    const alice = await setupUser(browser, baseURL!);
    const bob = await setupUser(browser, baseURL!);
    
    // Setup contacts
    await addContactViaLink(alice.page, bob.shareLink, "Bob");
    await addContactViaLink(bob.page, alice.shareLink, "Alice");
    
    // Wait for P2P connections
    await alice.page.waitForTimeout(2000);
    await bob.page.waitForTimeout(2000);
    
    // === Round 1: Bob leaves, Alice sends, Bob returns ===
    
    // Bob goes home
    await bob.page.goto(baseURL!);
    await bob.page.waitForTimeout(500);
    
    // Alice sends message 1
    await sendMessage(alice.page, "First offline message");
    await alice.page.waitForTimeout(500);
    
    // Bob opens chat - should sync
    await bob.page.locator('a:has-text("Alice")').first().click();
    await bob.page.waitForURL(/\/chat\//, { timeout: 5000 });
    await waitForMessage(bob.page, "First offline message", 10000);
    
    // === Round 2: Bob leaves again, Alice sends another ===
    
    // Bob goes home again
    await bob.page.goto(baseURL!);
    await bob.page.waitForTimeout(500);
    
    // Alice sends message 2
    await sendMessage(alice.page, "Second offline message");
    await alice.page.waitForTimeout(500);
    
    // Bob opens chat again - should sync the new message
    await bob.page.locator('a:has-text("Alice")').first().click();
    await bob.page.waitForURL(/\/chat\//, { timeout: 5000 });
    
    // Should see BOTH messages
    await waitForMessage(bob.page, "First offline message", 5000);
    await waitForMessage(bob.page, "Second offline message", 10000);
    
    await alice.context.close();
    await bob.context.close();
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
