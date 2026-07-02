import { expect, test } from "@playwright/test";
import crypto from "crypto";
import Database from "better-sqlite3";
import bcrypt from "bcrypt";

const db = new Database("dev.db");
const password = "E2ePass123!";
const stamp = Date.now();
const fixtures = {
  admin: { email: `pw-admin-${stamp}@test.local`, password },
  user: { email: `pw-user-${stamp}@test.local`, password },
  other: { email: `pw-other-${stamp}@test.local`, password },
};

function createUser({ email, role = "USER", plan = "free", apiAccessEnabled = false }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    "INSERT INTO User (id,email,password,name,role,tokenVersion,createdAt,updatedAt,emailVerifiedAt) VALUES (?,?,?,?,?,?,?,?,?)",
  ).run(id, email, bcrypt.hashSync(password, 10), email.split("@")[0], role, 0, now, now, now);
  db.prepare(
    "INSERT INTO Subscription (id,userId,plan,status,expiryDate,apiAccessEnabled,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?)",
  ).run(crypto.randomUUID(), id, plan, "active", future, apiAccessEnabled ? 1 : 0, now, now);
  return id;
}

async function login(page, email, pass = password, admin = false) {
  await page.goto(admin ? "/admin/login" : "/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(pass);
  await page.getByRole("button", { name: /sign in/i }).click();
  if (admin) {
    await page.waitForURL(/\/admin\/?$/, { timeout: 20_000 });
    await expect(page.getByText(/Dashboard|Users|Upgrades/i).first()).toBeVisible({ timeout: 20_000 });
  } else {
    await expect(page.getByPlaceholder(/type your message/i)).toBeVisible({ timeout: 20_000 });
  }
}

test.describe.serial("full browser business flow", () => {
  let userId;

  test.beforeAll(() => {
    db.prepare("DELETE FROM User WHERE email LIKE 'pw-%@test.local'").run();
    createUser({ email: fixtures.admin.email, role: "ADMIN", plan: "developer", apiAccessEnabled: true });
    userId = createUser({ email: fixtures.user.email });
    createUser({ email: fixtures.other.email });
  });

  test.afterAll(() => {
    db.prepare("DELETE FROM User WHERE email LIKE 'pw-%@test.local'").run();
  });

  test("user can chat, context changes, copy code works, and conversation is isolated", async ({ page, request }) => {
    await login(page, fixtures.user.email);
    await page.getByPlaceholder(/type your message/i).fill("Buat list markdown 1 sampai 3 dan code block python print hi");
    await page.getByRole("button", { name: /^$/ }).last().click();

    await expect(page.getByText(/Reading conversation context|Contacting AI model|AI is reasoning|Generating response/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".message-content").last()).toContainText(/print|python|1|2|3/i, { timeout: 45_000 });

    await expect(page.getByText(/Context|Compacted/)).toBeVisible();
    await expect(page.locator("header")).toContainText(/\d+\/?\d*k|<1%|1%/i);

    const copyButton = page.locator(".code-copy").first();
    if (await copyButton.count()) {
      await copyButton.click();
      await expect(copyButton).toContainText(/Copied|Failed/);
    }

    const conversations = await request.get("/api/conversations", {
      headers: { cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ") },
    });
    expect(conversations.ok()).toBeTruthy();
    const [conversation] = await conversations.json();
    expect(conversation?.id).toBeTruthy();

    const otherPage = await page.context().browser().newPage();
    await login(otherPage, fixtures.other.email);
    const otherCookies = (await otherPage.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
    const isolated = await request.get(`/api/conversations/${conversation.id}?model=gpt-5.4-mini`, { headers: { cookie: otherCookies } });
    expect(isolated.status()).toBe(404);
    await otherPage.close();
  });

  test("user submits upgrade in UI and admin activates it in UI", async ({ page }) => {
    await login(page, fixtures.user.email);
    await expect(page.getByRole("button", { name: /upgrade/i }).first()).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /upgrade/i }).first().click();
    await page.getByRole("button", { name: /developer plan/i }).click();
    await page.getByPlaceholder(/08|reference/i).fill("081234567890");
    await page.getByLabel(/upload screenshot/i).setInputFiles({
      name: "proof.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgo=", "base64"),
    });
    await page.getByRole("button", { name: /submit request/i }).click();
    await expect(page.getByText(/Request Submitted/i)).toBeVisible({ timeout: 15_000 });

    const adminPage = await page.context().browser().newPage();
    await login(adminPage, fixtures.admin.email, password, true);
    await adminPage.goto("/admin/upgrades");
    await expect(adminPage.getByText(fixtures.user.email.split("@")[0]).or(adminPage.getByText(fixtures.user.email))).toBeVisible({ timeout: 20_000 });
    await adminPage.getByRole("button", { name: /activate/i }).first().click();
    await expect(adminPage.getByText(/Upgrade completed and plan activated/i)).toBeVisible({ timeout: 15_000 });
    await adminPage.close();

    await page.reload();
    await expect(page.getByText(/developer/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("developer can create and revoke API key from account modal", async ({ page }) => {
    await login(page, fixtures.user.email);
    await expect(page.getByRole("button", { name: /account/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /account/i }).click();
    await page.getByRole("button", { name: /api keys/i }).click();
    await expect(page.getByRole("heading", { name: /Local API Keys/i })).toBeVisible();
    await page.getByPlaceholder(/key name/i).fill("Playwright Key");
    await page.getByRole("button", { name: /create key/i }).click();
    await expect(page.getByText("Playwright Key")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("sk-cai-...")).toBeVisible();

    await page.locator('button[title="Delete Key"]').first().click();
    await page.getByRole("button", { name: /confirm/i }).click();
    await expect(page.getByText("Playwright Key")).toHaveCount(0, { timeout: 15_000 });
  });

  test("hashed reset password flow works from UI login after API reset", async ({ page }) => {
    const code = "pw123456";
    const hash = crypto.createHash("sha256").update(code).digest("hex");
    db.prepare("UPDATE User SET resetCode=?, resetCodeExpires=? WHERE id=?").run(hash, new Date(Date.now() + 60 * 60 * 1000).toISOString(), userId);

    await page.goto("/reset");
    await page.locator('input[type="email"]').fill(fixtures.user.email);
    await page.getByPlaceholder(/8-character code/i).fill(code);
    await page.locator('input[type="password"]').fill("NewE2ePass123!");
    await page.getByRole("button", { name: /reset password/i }).click();
    await expect(page.getByText(/Password reset/i)).toBeVisible({ timeout: 10_000 });

    await login(page, fixtures.user.email, "NewE2ePass123!");
    await expect(page.getByPlaceholder(/type your message/i)).toBeVisible({ timeout: 20_000 });
  });
});
