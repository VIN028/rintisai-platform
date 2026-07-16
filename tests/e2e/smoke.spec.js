import { expect, test } from "@playwright/test";

test("public auth pages render", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

  await page.goto("/register");
  await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
});

test("public API snippets can be copied", async ({ page }) => {
  await page.goto("/docs/api");
  await page.getByRole("button", { name: /^copy$/i }).first().click();
  await expect(page.getByRole("button", { name: /^copied$/i }).first()).toBeVisible();

  await page.goto("/api-router");
  await page.getByRole("button", { name: /^copy$/i }).first().click();
  await expect(page.getByRole("button", { name: /^copied$/i }).first()).toBeVisible();
});

test("status API separates configured models from live latency", async ({ request }) => {
  const response = await request.get("/api/status");
  expect(response.ok()).toBeTruthy();
  const status = await response.json();
  expect(status.checkType).toBe("route-and-configuration");
  expect(status.note).toContain("actual chat/API requests");
  for (const group of status.modelGroups) {
    expect(group.status).toBe("available");
    expect(group.latencyMs).toBeUndefined();
  }
});

test("ordered lists keep numbering when split into separate lists", async ({ page }) => {
  await page.setContent(`
    <ol class="list-decimal"><li>First</li></ol>
    <p>Continuation text</p>
    <ol start="2" class="list-decimal"><li>Second</li></ol>
    <ol start="3" class="list-decimal"><li>Third</li></ol>
  `);

  await expect(page.locator("ol").nth(0)).not.toHaveAttribute("start", /.+/);
  await expect(page.locator("ol").nth(1)).toHaveAttribute("start", "2");
  await expect(page.locator("ol").nth(2)).toHaveAttribute("start", "3");
});

test("google oauth callback rejects missing state", async ({ request }) => {
  const response = await request.get("/api/auth/google/callback?code=fake", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/login?error=invalid_state");
});
