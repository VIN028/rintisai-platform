import { expect, test } from "@playwright/test";

test("public auth pages render", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

  await page.goto("/register");
  await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
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
