/**
 * Identity management tests
 */
import { test, expect } from "@playwright/test";
import { 
  waitForAppReady, 
  ensureIdentity, 
  getShareLink, 
  clearStorage 
} from "./helpers";

test.describe("Identity", () => {
  test.beforeEach(async ({ page }) => {
    await clearStorage(page);
    await page.goto("/");
  });

  test("shows welcome screen when no identity exists", async ({ page }) => {
    await waitForAppReady(page);
    
    await expect(page.getByText("Welcome to Zault")).toBeVisible();
    await expect(page.getByRole("button", { name: "Get Started" })).toBeVisible();
  });

  test("creates new identity on Get Started click", async ({ page }) => {
    await waitForAppReady(page);
    
    await page.getByRole("button", { name: "Get Started" }).click();
    
    // Should show share link input
    const shareInput = page.locator('input[readonly]');
    await expect(shareInput).toBeVisible({ timeout: 15000 });
    
    // Share link should contain the origin
    const link = await shareInput.inputValue();
    expect(link).toContain(page.url().split("/")[2]); // hostname
    expect(link).toContain("/add?id=");
  });

  test("identity persists across page reload", async ({ page }) => {
    await ensureIdentity(page);
    
    const linkBefore = await getShareLink(page);
    
    // Reload
    await page.reload();
    await waitForAppReady(page);
    
    const linkAfter = await getShareLink(page);
    
    expect(linkAfter).toBe(linkBefore);
  });

  test("copy button copies share link to clipboard", async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    
    await ensureIdentity(page);
    
    const expectedLink = await getShareLink(page);
    
    // Click copy button
    await page.getByRole("button", { name: "Copy" }).click();
    
    // Should show "Copied" feedback
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    
    // Verify clipboard content
    const clipboardContent = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardContent).toBe(expectedLink);
  });

  test("share modal opens with options", async ({ page }) => {
    await ensureIdentity(page);
    
    // Click share button (the icon button)
    await page.locator('button:has(svg)').filter({ hasText: "" }).nth(1).click();
    
    // Modal should open
    await expect(page.getByText("Share Identity")).toBeVisible();
    await expect(page.getByRole("button", { name: "Show QR Code" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Export JSON File" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Import JSON File" })).toBeVisible();
  });

  test("QR code modal displays two QR codes", async ({ page }) => {
    await ensureIdentity(page);
    
    // Open share modal
    await page.locator('button:has(svg)').filter({ hasText: "" }).nth(1).click();
    await expect(page.getByText("Share Identity")).toBeVisible();
    
    // Click show QR
    await page.getByRole("button", { name: "Show QR Code" }).click();
    
    // QR modal should open
    await expect(page.getByText("Scan both codes")).toBeVisible();
    
    // Should have an image (the combined QR codes)
    const qrImage = page.locator('img[alt="QR Codes"]');
    await expect(qrImage).toBeVisible();
  });

  test("export JSON downloads file", async ({ page }) => {
    await ensureIdentity(page);
    
    // Open share modal
    await page.locator('button:has(svg)').filter({ hasText: "" }).nth(1).click();
    
    // Set up download listener
    const downloadPromise = page.waitForEvent("download");
    
    // Click export
    await page.getByRole("button", { name: "Export JSON File" }).click();
    
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^zault-.*\.json$/);
  });
});

