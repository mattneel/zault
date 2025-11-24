/**
 * P2P Connection tests
 */
import { test, expect } from "@playwright/test";
import { 
  waitForAppReady, 
  ensureIdentity, 
  clearStorage,
  getConnectionStatus,
} from "./helpers";

test.describe("P2P Connection", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await page.goto("/");
  });

  test("shows offline status before identity", async ({ page }) => {
    await waitForAppReady(page);
    
    // No status indicator should be visible without identity
    const status = page.locator(".navbar-end .status");
    await expect(status).not.toBeVisible();
  });

  test("shows connecting then connected after identity creation", async ({ page }) => {
    await ensureIdentity(page);
    
    // Should eventually show connected
    await page.waitForFunction(() => {
      const text = document.querySelector(".navbar-end .text-sm");
      return text?.textContent?.includes("online") || text?.textContent?.includes("Connecting");
    }, { timeout: 30000 });
    
    // Status indicator should be visible
    const status = page.locator(".navbar-end .status");
    await expect(status).toBeVisible();
  });

  test("shows peer count when connected", async ({ page }) => {
    await ensureIdentity(page);
    
    // Wait for connection
    await page.waitForFunction(() => {
      const text = document.querySelector(".navbar-end .text-sm");
      return text?.textContent?.includes("online");
    }, { timeout: 30000 });
    
    // Should show "X online" format
    const statusText = await getConnectionStatus(page);
    expect(statusText).toMatch(/\d+ online/);
  });

  test("peer count updates when another user connects", async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // First user
    await page1.goto("/");
    await clearStorage(page1);
    await page1.goto("/");
    await ensureIdentity(page1);
    
    // Wait for connection
    await page1.waitForFunction(() => {
      const text = document.querySelector(".navbar-end .text-sm");
      return text?.textContent?.includes("online");
    }, { timeout: 30000 });
    
    // Get initial count
    const initialStatus = await getConnectionStatus(page1);
    const initialCount = parseInt(initialStatus.match(/(\d+)/)?.[1] || "0");
    
    // Second user connects
    await page2.goto("/");
    await clearStorage(page2);
    await page2.goto("/");
    await ensureIdentity(page2);
    
    // Wait for second user to connect
    await page2.waitForFunction(() => {
      const text = document.querySelector(".navbar-end .text-sm");
      return text?.textContent?.includes("online");
    }, { timeout: 30000 });
    
    // First user's count should increase
    await page1.waitForFunction((initial) => {
      const text = document.querySelector(".navbar-end .text-sm");
      const match = text?.textContent?.match(/(\d+)/);
      const current = parseInt(match?.[1] || "0");
      return current > initial;
    }, initialCount, { timeout: 30000 });
    
    await context1.close();
    await context2.close();
  });

  test("reconnects after connection loss", async ({ page }) => {
    await ensureIdentity(page);
    
    // Wait for initial connection
    await page.waitForFunction(() => {
      const text = document.querySelector(".navbar-end .text-sm");
      return text?.textContent?.includes("online");
    }, { timeout: 30000 });
    
    // Simulate network disconnect by going offline
    await page.context().setOffline(true);
    
    // Wait a moment
    await page.waitForTimeout(1000);
    
    // Should show disconnected/offline state
    await page.waitForFunction(() => {
      const text = document.querySelector(".navbar-end .text-sm");
      return text?.textContent?.includes("Offline") || text?.textContent?.includes("Connecting");
    }, { timeout: 10000 });
    
    // Reconnect
    await page.context().setOffline(false);
    
    // Should reconnect
    await page.waitForFunction(() => {
      const text = document.querySelector(".navbar-end .text-sm");
      return text?.textContent?.includes("online");
    }, { timeout: 30000 });
  });

  test("connection status indicator has correct color", async ({ page }) => {
    await ensureIdentity(page);
    
    // Wait for connection
    await page.waitForFunction(() => {
      const text = document.querySelector(".navbar-end .text-sm");
      return text?.textContent?.includes("online");
    }, { timeout: 30000 });
    
    // Status should have success class when connected
    const status = page.locator(".navbar-end .status");
    await expect(status).toHaveClass(/status-success/);
  });
});

