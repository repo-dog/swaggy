import { test, expect } from "@playwright/test";

// Browser end-to-end: drive the real UI against the mock backend. Covers the core loop
// (find an operation → send → see the response) and that the multipart form renders a file
// picker. Selectors follow the shipped components; adjust here if the UI markup changes.

test("sends a request and renders the response", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Swaggy")).toBeVisible();

  // Find an operation via the command palette and open it.
  await page.getByRole("button", { name: /search operations/i }).click();
  await page.getByPlaceholder("Search operations…").fill("anything");
  await page.locator("[cmdk-item]").first().click();

  // The request panel shows the method + path for the selected op.
  await expect(page.getByRole("heading", { name: /\/anything/ })).toBeVisible();

  // Send it and assert the mock backend's 200 comes back.
  await page.getByRole("button", { name: /^send$/i }).click();
  await expect(page.getByText(/200 OK/)).toBeVisible();
});

test("renders a file picker for a multipart upload operation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /search operations/i }).click();
  await page.getByPlaceholder("Search operations…").fill("/upload");
  await page.locator("[cmdk-item]").first().click();

  await expect(page.getByRole("heading", { name: /\/upload/ })).toBeVisible();
  // The multipart FormBody renders a native file input for the binary `file` field.
  await expect(page.locator('input[type="file"]').first()).toBeVisible();
});
