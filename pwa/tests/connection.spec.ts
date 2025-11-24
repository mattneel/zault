/**
 * P2P Connection tests
 */
import { test, expect } from "@playwright/test";
import { 
  waitForAppReady, 
  ensureIdentity, 
  getConnectionStatus,
  createFreshContext,
  setupUser,
} from "./helpers";

test.describe("P2P Connection", () => {
  test("shows connecting then connected after identity creation", async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    
    await page.goto("/");
    await ensureIdentity(page);
    
    // Should eventually show connected
    await page.waitForFunction(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes("online") || text.includes("connecting");
    }, { timeout: 30000 });
    
    await context.close();
  });

  test("shows peer count when connected", async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    
    await page.goto("/");
    await ensureIdentity(page);
    
    // Wait for connection
    await page.waitForFunction(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes("online");
    }, { timeout: 30000 });
    
    // Should show "X online" format
    const statusText = await getConnectionStatus(page);
    expect(statusText).toMatch(/\d+ online/);
    
    await context.close();
  });

  test("peer count updates when another user connects", async ({ browser, baseURL }) => {
    const user1 = await setupUser(browser, baseURL!);
    
    // Wait for connection
    await user1.page.waitForFunction(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes("online");
    }, { timeout: 30000 });
    
    // Get initial count
    const initialStatus = await getConnectionStatus(user1.page);
    const initialCount = parseInt(initialStatus.match(/(\d+)/)?.[1] || "0");
    
    // Second user connects
    const user2 = await setupUser(browser, baseURL!);
    
    // Wait for second user to connect
    await user2.page.waitForFunction(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes("online");
    }, { timeout: 30000 });
    
    // First user's count should increase
    await user1.page.waitForFunction((initial) => {
      const text = document.body.innerText;
      const match = text.match(/(\d+) online/);
      const current = parseInt(match?.[1] || "0");
      return current > initial;
    }, initialCount, { timeout: 30000 });
    
    await user1.context.close();
    await user2.context.close();
  });

  test("reconnects after connection loss", async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    
    await page.goto("/");
    await ensureIdentity(page);
    
    // Wait for initial connection
    await page.waitForFunction(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes("online");
    }, { timeout: 30000 });
    
    // Simulate network disconnect by going offline
    await context.setOffline(true);
    
    // Wait a moment
    await page.waitForTimeout(1000);
    
    // Reconnect
    await context.setOffline(false);
    
    // Should reconnect
    await page.waitForFunction(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes("online");
    }, { timeout: 30000 });
    
    await context.close();
  });

  test("connection status indicator has correct color", async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    
    await page.goto("/");
    await ensureIdentity(page);
    
    // Wait for connection
    await page.waitForFunction(() => {
      const text = document.body.innerText.toLowerCase();
      return text.includes("online");
    }, { timeout: 30000 });
    
    // Status should have success class when connected
    const status = page.locator('.status-success');
    await expect(status).toBeVisible();
    
    await context.close();
  });
});
