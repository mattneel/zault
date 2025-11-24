/**
 * Identity management tests
 */
import { test, expect } from "@playwright/test";
import { 
  waitForAppReady, 
  ensureIdentity, 
  getShareLink,
  createFreshContext,
} from "./helpers";

test.describe("Identity", () => {
  test("shows welcome screen when no identity exists", async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    
    await page.goto("/");
    await waitForAppReady(page);
    
    await expect(page.getByText("Welcome to Zault")).toBeVisible();
    await expect(page.getByRole("button", { name: "Get Started" })).toBeVisible();
    
    await context.close();
  });

  test("creates new identity on Get Started click", async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    
    await page.goto("/");
    await waitForAppReady(page);
    
    await page.getByRole("button", { name: "Get Started" }).click();
    
    // Should show share link input
    const shareInput = page.locator('input[readonly]').first();
    await expect(shareInput).toBeVisible({ timeout: 15000 });
    
    // Share link should contain the origin and id param
    const link = await shareInput.inputValue();
    expect(link).toContain("/add?id=");
    
    await context.close();
  });

  test("identity persists across page reload", async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    
    await page.goto("/");
    await ensureIdentity(page);
    
    const linkBefore = await getShareLink(page);
    
    // Reload
    await page.reload();
    await waitForAppReady(page);
    
    // Wait for share input to appear again
    await page.waitForSelector('input[readonly]', { timeout: 10000 });
    
    const linkAfter = await getShareLink(page);
    expect(linkAfter).toBe(linkBefore);
    
    await context.close();
  });

  test("copy button copies share link to clipboard", async ({ browser }) => {
    const context = await createFreshContext(browser);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const page = await context.newPage();
    
    await page.goto("/");
    await ensureIdentity(page);
    
    const expectedLink = await getShareLink(page);
    
    // Click copy button
    await page.getByRole("button", { name: "Copy" }).click();
    
    // Should show "Copied" feedback
    await expect(page.getByText("Copied")).toBeVisible();
    
    // Verify clipboard content
    const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardContent).toBe(expectedLink);
    
    await context.close();
  });

  test("share modal opens with options", async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    
    await page.goto("/");
    await ensureIdentity(page);
    
    // Click share button (the share icon in the share section)
    const shareButton = page.locator('.btn-ghost').filter({ has: page.locator('svg') }).last();
    await shareButton.click();
    
    // Modal should open
    await expect(page.getByText("Share Identity")).toBeVisible();
    await expect(page.getByRole("button", { name: /Show QR/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Export JSON/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Import JSON/i })).toBeVisible();
    
    await context.close();
  });

  test("QR code modal displays two QR codes", async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    
    await page.goto("/");
    await ensureIdentity(page);
    
    // Open share modal
    const shareButton = page.locator('.btn-ghost').filter({ has: page.locator('svg') }).last();
    await shareButton.click();
    await expect(page.getByText("Share Identity")).toBeVisible();
    
    // Click show QR
    await page.getByRole("button", { name: /Show QR/i }).click();
    
    // QR modal should open
    await expect(page.getByText("Scan both codes")).toBeVisible();
    
    // Should have an image (the combined QR codes)
    const qrImage = page.locator('img[alt="QR Codes"]');
    await expect(qrImage).toBeVisible({ timeout: 10000 });
    
    await context.close();
  });

  test("export JSON downloads file", async ({ browser }) => {
    const context = await createFreshContext(browser);
    const page = await context.newPage();
    
    await page.goto("/");
    await ensureIdentity(page);
    
    // Open share modal
    const shareButton = page.locator('.btn-ghost').filter({ has: page.locator('svg') }).last();
    await shareButton.click();
    await expect(page.getByText("Share Identity")).toBeVisible();
    
    // Set up download listener
    const downloadPromise = page.waitForEvent("download");
    
    // Click export
    await page.getByRole("button", { name: /Export JSON/i }).click();
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^zault-.*\.json$/);
    
    await context.close();
  });
});
