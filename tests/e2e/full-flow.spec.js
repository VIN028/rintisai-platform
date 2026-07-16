import { expect, test } from "@playwright/test";
import crypto from "crypto";
import Database from "better-sqlite3";
import bcrypt from "bcrypt";

const db = new Database("dev.db");
const password = "E2ePass123!";
const stamp = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const fixtures = {
  admin: { email: `pw-admin-${stamp}@test.local`, password },
  user: { email: `pw-user-${stamp}@test.local`, password },
  other: { email: `pw-other-${stamp}@test.local`, password },
  apiSwitch: { email: `pw-api-switch-${stamp}@test.local`, password },
  gptChat: { email: `pw-gpt-chat-${stamp}@test.local`, password },
  gptCode: { email: `pw-gpt-code-${stamp}@test.local`, password },
  codexPro: { email: `pw-codex-pro-${stamp}@test.local`, password },
  gptCodeWeekly: { email: `pw-gpt-code-weekly-${stamp}@test.local`, password },
  gptCodeThreeDay: { email: `pw-gpt-code-3day-${stamp}@test.local`, password },
  claudeCode: { email: `pw-claude-code-${stamp}@test.local`, password },
  renewal: { email: `pw-renewal-${stamp}@test.local`, password },
  expiredAdmin: { email: `pw-expired-admin-${stamp}@test.local`, password },
  adminPatch: { email: `pw-admin-patch-${stamp}@test.local`, password },
};
const fixtureEmails = Object.values(fixtures).map((fixture) => fixture.email);

function cleanupFixtures() {
  const placeholders = fixtureEmails.map(() => "?").join(",");
  db.prepare(`DELETE FROM ApiCreditLedger WHERE userId IN (SELECT id FROM User WHERE email IN (${placeholders}))`).run(...fixtureEmails);
  if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='CashoutRequest'").get()) {
    db.prepare(`DELETE FROM CashoutRequest WHERE userId IN (SELECT id FROM User WHERE email IN (${placeholders}))`).run(...fixtureEmails);
  }
  db.prepare(`DELETE FROM ApiKey WHERE userId IN (SELECT id FROM User WHERE email IN (${placeholders}))`).run(...fixtureEmails);
  db.prepare(`DELETE FROM UpgradeRequest WHERE userId IN (SELECT id FROM User WHERE email IN (${placeholders}))`).run(...fixtureEmails);
  if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='PlanEntitlement'").get()) {
    db.prepare(`DELETE FROM PlanEntitlement WHERE userId IN (SELECT id FROM User WHERE email IN (${placeholders}))`).run(...fixtureEmails);
  }
  db.prepare(`DELETE FROM User WHERE email IN (${placeholders})`).run(...fixtureEmails);
}

function createUser({ email, role = "USER", plan = "free", apiAccessEnabled = false, billingInterval = "monthly" }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    "INSERT INTO User (id,email,password,name,role,tokenVersion,createdAt,updatedAt,emailVerifiedAt) VALUES (?,?,?,?,?,?,?,?,?)",
  ).run(id, email, bcrypt.hashSync(password, 10), email.split("@")[0], role, 0, now, now, now);
  db.prepare(
    "INSERT INTO Subscription (id,userId,plan,billingInterval,status,expiryDate,apiAccessEnabled,createdAt,updatedAt) VALUES (?,?,?,?,?,?,?,?,?)",
  ).run(crypto.randomUUID(), id, plan, billingInterval, "active", future, apiAccessEnabled ? 1 : 0, now, now);
  return id;
}

function hashApiKey(key) {
  return `sha256:${crypto.createHash("sha256").update(key).digest("hex")}`;
}

async function createSyntheticJpeg(page, { width = 2400, height = 1600, text = "INVOICE 12345" } = {}) {
  const dataUrl = await page.evaluate(({ width, height, text }) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    for (let y = 0; y < height; y += 48) {
      ctx.fillStyle = y % 96 === 0 ? "#f3f4f6" : "#ffffff";
      ctx.fillRect(0, y, width, 24);
    }
    ctx.fillStyle = "#111827";
    ctx.font = "bold 92px Arial";
    ctx.fillText(text, 96, 160);
    ctx.font = "56px Arial";
    ctx.fillText("Paid screenshot proof", 96, 260);
    ctx.fillText("Reference: 081234567890", 96, 340);
    ctx.fillText("Amount: Rp 250.000", 96, 420);
    ctx.font = "42px Arial";
    for (let i = 0; i < 18; i += 1) {
      ctx.fillText(`Line ${i + 1} - ${text} - ${new Date().toISOString().slice(0, 10)}`, 96, 520 + i * 64);
    }
    for (let x = 0; x < width; x += 64) {
      ctx.fillStyle = x % 128 === 0 ? "rgba(59, 130, 246, 0.18)" : "rgba(16, 185, 129, 0.12)";
      ctx.fillRect(x, 0, 18, height);
    }
    return canvas.toDataURL("image/jpeg", 0.96);
  }, { width, height, text });

  return Buffer.from(dataUrl.split(",")[1], "base64");
}

function ensureApiKeyMetadataColumns() {
  try { db.prepare('ALTER TABLE ApiKey ADD COLUMN providerScope TEXT NOT NULL DEFAULT "all"').run(); } catch {}
  try { db.prepare('ALTER TABLE ApiKey ADD COLUMN quotaUsdMicros INTEGER NOT NULL DEFAULT 0').run(); } catch {}
  try { db.prepare('ALTER TABLE ApiKey ADD COLUMN status TEXT NOT NULL DEFAULT "active"').run(); } catch {}
}

async function login(page, email, pass = password, admin = false) {
  await page.goto(admin ? "/admin/login" : "/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(pass);
  await page.getByRole("button", { name: /sign in/i }).click();
  if (admin) {
    const otpInput = page.getByPlaceholder(/6-digit code/i);
    try {
      await expect(otpInput).toBeVisible({ timeout: 5_000 });
      await otpInput.fill(process.env.ADMIN_2FA_CODE || "123456");
      await page.getByRole("button", { name: /verify otp/i }).click();
    } catch {}
    await page.waitForURL(/\/admin\/?$/, { timeout: 20_000 });
    await expect(page.getByText(/Dashboard|Users|Upgrades/i).first()).toBeVisible({ timeout: 20_000 });
  } else {
    await expect(page.getByPlaceholder(/type your message/i)).toBeVisible({ timeout: 20_000 });
  }
}

test.describe.serial("full browser business flow", () => {
  let userId;
  let gptCodeUserId;
  let renewalUserId;
  let apiSwitchUserId;
  let expiredAdminUserId;
  let adminPatchUserId;
  let apiSwitchRawKey;

  test.beforeAll(() => {
    ensureApiKeyMetadataColumns();
    cleanupFixtures();
    createUser({ email: fixtures.admin.email, role: "ADMIN", plan: "developer", apiAccessEnabled: true });
    userId = createUser({ email: fixtures.user.email });
    createUser({ email: fixtures.other.email });
    createUser({ email: fixtures.gptChat.email, plan: "gpt_chat" });
    gptCodeUserId = createUser({ email: fixtures.gptCode.email, plan: "gpt_code", apiAccessEnabled: true });
    createUser({ email: fixtures.codexPro.email, plan: "codex_pro", apiAccessEnabled: true });
    createUser({ email: fixtures.gptCodeWeekly.email, plan: "gpt_code", billingInterval: "weekly", apiAccessEnabled: true });
    const gptCodeThreeDayUserId = createUser({ email: fixtures.gptCodeThreeDay.email, plan: "gpt_code", billingInterval: "3day", apiAccessEnabled: true });
    db.prepare("INSERT INTO TokenUsage (id,userId,timestamp,modelUsed,promptTokens,completionTokens,totalTokens,source) VALUES (?,?,?,?,?,?,?,?)")
      .run(crypto.randomUUID(), gptCodeThreeDayUserId, new Date().toISOString(), "gpt-5.4", 200_000, 50_000, 20_000_000, "web");
    createUser({ email: fixtures.claudeCode.email, plan: "claude_code", apiAccessEnabled: true });
    renewalUserId = createUser({ email: fixtures.renewal.email, plan: "gpt_code", apiAccessEnabled: true });
    expiredAdminUserId = createUser({ email: fixtures.expiredAdmin.email, plan: "gpt_code", billingInterval: "3day", apiAccessEnabled: true });
    db.prepare("UPDATE Subscription SET status=?, expiryDate=? WHERE userId=?").run("active", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), expiredAdminUserId);
    adminPatchUserId = createUser({ email: fixtures.adminPatch.email, plan: "free" });
    db.prepare("UPDATE Subscription SET status=?, plan=?, billingInterval=?, expiryDate=? WHERE userId=?").run("active", "free", "monthly", new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), adminPatchUserId);
    apiSwitchUserId = createUser({ email: fixtures.apiSwitch.email, plan: "api_claude", apiAccessEnabled: true });
    apiSwitchRawKey = `sk-cai-e2e-api-switch-${apiSwitchUserId}`;
    db.prepare("UPDATE Subscription SET apiCreditBalanceUsdMicros=?, apiCreditBalanceRp=0 WHERE userId=?").run(0, apiSwitchUserId);
    db.prepare("INSERT INTO ApiKey (id,key,name,userId,createdAt) VALUES (?,?,?,?,?)").run(crypto.randomUUID(), hashApiKey(apiSwitchRawKey), "Existing API Key", apiSwitchUserId, new Date().toISOString());
    db.prepare("INSERT INTO ApiCreditLedger (id,userId,type,amountRp,amountUsdMicros,fxRate,note,createdAt) VALUES (?,?,?,?,?,?,?,?)")
      .run(crypto.randomUUID(), apiSwitchUserId, "topup", 37000, 2_000_000, 18500, "Existing API balance", new Date().toISOString());
    db.prepare("INSERT INTO ApiCreditLedger (id,userId,type,amountRp,amountUsdMicros,fxRate,modelUsed,promptTokens,completionTokens,apiKeyId,providerPool,fallbackUsed,note,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(crypto.randomUUID(), apiSwitchUserId, "usage", -1, -1, 18500, "claude-haiku", 1, 1, null, "kiro", 0, "Internal pool should not leak", new Date().toISOString());
  });

  test.afterAll(() => {
    cleanupFixtures();
  });

  test("new users can register and send two free chats", async ({ page }, testInfo) => {
    const projectSlug = testInfo.project.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const signupEmail = `pw-signup-${projectSlug}-${stamp}@e2e.rintisai.site`;

    await page.goto("/register");
    await page.getByPlaceholder("Budi Santoso").fill("Signup Tester");
    await page.getByPlaceholder("nama@email.com").fill(signupEmail);
    await page.getByPlaceholder(/at least 8 characters/i).fill(password);
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page.getByPlaceholder(/type your message/i)).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("button", { name: /account/i })).toBeVisible({ timeout: 20_000 });

    if (testInfo.project.name === "chromium") {
      await page.route("**/api/chat", async (route) => {
        const conversationId = crypto.randomUUID();
        await route.fulfill({
          status: 200,
          headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform" },
          body: [
            `event: metadata\ndata: ${JSON.stringify({ conversationId, contextUsage: { used: 0, displayUsed: 0, limit: 32000, percent: 0, compacted: false, omittedMessages: 0 } })}\n\n`,
            `data: ${JSON.stringify({ content: "OK" })}\n\n`,
            "data: [DONE]\n\n",
          ].join(""),
        });
      });

      const composer = page.getByPlaceholder(/type your message/i);
      await composer.fill("hi");
      await page.getByRole("button", { name: /send message/i }).click();
      await expect(page.locator(".message-content").last()).toContainText("OK", { timeout: 10_000 });

      await expect(composer).toBeEnabled({ timeout: 10_000 });
      await composer.fill("buat logo sederhana untuk toko kopi, jawab singkat");
      await page.getByRole("button", { name: /send message/i }).click();
      await expect(page.locator(".message-content").last()).toContainText("OK", { timeout: 10_000 });
      await expect(page.getByText(/Usage limit reached/i)).toHaveCount(0);
      await expect(composer).toBeEnabled({ timeout: 10_000 });
    }
  });

  test("user can chat, context changes, copy code works, and conversation is isolated", async ({ page, request }) => {
    await login(page, fixtures.user.email);
    const chatJpeg = await createSyntheticJpeg(page, { text: "CHAT OCR SAMPLE" });
    await page.locator('form input[type="file"]').first().setInputFiles({
      name: "chat-proof.jpg",
      mimeType: "image/jpeg",
      buffer: chatJpeg,
    });
    await expect(page.getByText("chat-proof.jpg")).toBeVisible({ timeout: 20_000 });
    await page.getByPlaceholder(/type your message/i).fill("Buat list markdown 1 sampai 3 dan code block python print hi");
    await page.getByRole("button", { name: /send message/i }).click();

    await expect(page.getByText(/Reading conversation context|Contacting AI model|AI is reasoning|Generating response/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".message-content").last()).toContainText(/print|python|1|2|3/i, { timeout: 45_000 });

    const responseCopyButton = page.locator('button[title="Copy response"]').first();
    await expect(responseCopyButton).toBeVisible({ timeout: 10_000 });
    await responseCopyButton.click();
    await expect(responseCopyButton).toContainText(/Copied/i, { timeout: 5_000 });

    const contextLabel = page.getByText(/Context|Compacted/).first();
    if (await contextLabel.isVisible()) {
      await expect(contextLabel).toBeVisible();
      await expect(page.locator("header")).toContainText(/\d+\/?\d*k|<1%|1%/i);
    }

    const copyButton = page.locator(".code-copy").first();
    if (await copyButton.count()) {
      await copyButton.click();
      await expect(copyButton).toBeVisible();
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
    await page.getByRole("button", { name: /weekly/i }).click();
    await expect(page.getByText(/15M weekly units/i)).toBeVisible();
    await expect(page.getByText(/35M weekly units/i)).toBeVisible();
    await expect(page.getByText(/45M weekly units/i).first()).toBeVisible();
    await page.getByRole("button", { name: /codex code/i }).click();
    await page.getByPlaceholder(/08|reference/i).fill("081234567890");
    const proofJpeg = await createSyntheticJpeg(page, { text: "PAYMENT PROOF" });
    await page.getByLabel(/upload screenshot/i).setInputFiles({
      name: "proof.jpg",
      mimeType: "image/jpeg",
      buffer: proofJpeg,
    });
    await page.getByRole("button", { name: /submit request/i }).click();
    await expect(page.getByText(/Request Submitted/i)).toBeVisible({ timeout: 15_000 });

    const adminPage = await page.context().browser().newPage();
    await login(adminPage, fixtures.admin.email, password, true);
    await adminPage.goto("/admin/upgrades");
    await adminPage.getByPlaceholder(/search user/i).fill(fixtures.user.email);
    await expect(adminPage.getByText(fixtures.user.email).first()).toBeVisible({ timeout: 20_000 });
    await adminPage.getByRole("button", { name: /activate/i }).first().click();
    await expect(adminPage.getByText(/Upgrade completed and plan activated/i)).toBeVisible({ timeout: 15_000 });
    await adminPage.close();

    await page.reload();
    await expect(page.getByText(/codex code/i).first()).toBeVisible({ timeout: 20_000 });
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
    await expect(page.locator('button[title="Copy API key"]')).toBeVisible();

    await page.locator('button[title="Delete Key"]').first().click();
    await page.getByRole("button", { name: /confirm/i }).click();
    await expect(page.getByText("Playwright Key")).toHaveCount(0, { timeout: 15_000 });
  });

  test("monthly plans only show monthly package usage", async ({ page }) => {
    await login(page, fixtures.gptCode.email);
    await page.getByRole("button", { name: /account/i }).click();
    await page.getByRole("button", { name: /^plan$/i }).click();
    await expect(page.getByText(/Package Usage/i)).toBeVisible();
    await expect(page.getByText("0/90M units").first()).toBeVisible();
    await expect(page.getByText(/Limit Windows/i)).toHaveCount(0);
    await expect(page.getByText("5h", { exact: true })).toHaveCount(0);
    await expect(page.getByText("0/40M units")).toHaveCount(0);
    await expect(page.getByText("0/70M units")).toHaveCount(0);
  });

  test("3-day users see one package usage bar", async ({ page }) => {
    await login(page, fixtures.gptCodeThreeDay.email);
    await expect(page.getByText(/3-Day Usage/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/50% used/i)).toBeVisible();
    await expect(page.getByText(/20M\/40M units/i)).toBeVisible();

    await page.getByRole("button", { name: /account/i }).click();
    await page.getByRole("button", { name: /^plan$/i }).click();
    await expect(page.getByText(/Package Usage/i)).toBeVisible();
    await expect(page.getByText("3-Day").first()).toBeVisible();
    await expect(page.getByText(/Limit Windows|Active session/i)).toHaveCount(0);
  });

  test("weekly plans only show package usage", async ({ page }) => {
    await login(page, fixtures.gptCodeWeekly.email);
    await expect(page.getByText(/Weekly Usage/i)).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /account/i }).click();
    await page.getByRole("button", { name: /^plan$/i }).click();
    await expect(page.getByText(/Package Usage/i)).toBeVisible();
    await expect(page.getByText("0/70M units").first()).toBeVisible();
    await expect(page.getByText(/Limit Windows/i)).toHaveCount(0);
    await expect(page.getByText("5h", { exact: true })).toHaveCount(0);
    await expect(page.getByText("0/40M units")).toHaveCount(0);
    await expect(page.getByText("Monthly", { exact: true })).toHaveCount(0);
  });

  test("admin subscription expiry is synchronized and manual plan changes recalculate duration", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Admin backend regression only needs one browser project.");
    await login(page, fixtures.admin.email, password, true);
    const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");

    const expiredRes = await request.get(`/api/admin/users/${expiredAdminUserId}`, { headers: { cookie } });
    expect(expiredRes.ok(), await expiredRes.text()).toBeTruthy();
    const expiredData = await expiredRes.json();
    expect(expiredData.subscription.plan).toBe("free");
    expect(expiredData.subscription.status).toBe("active");
    const expiredDbRow = db.prepare("SELECT plan,status,apiAccessEnabled FROM Subscription WHERE userId=?").get(expiredAdminUserId);
    expect(expiredDbRow.plan).toBe("free");
    expect(expiredDbRow.status).toBe("active");
    expect(Boolean(expiredDbRow.apiAccessEnabled)).toBe(false);

    const original = db.prepare("SELECT expiryDate FROM Subscription WHERE userId=?").get(adminPatchUserId);
    const patchRes = await request.patch("/api/admin/users", {
      headers: { cookie },
      data: {
        userId: adminPatchUserId,
        plan: "gpt_code",
        billingInterval: "3day",
        status: "active",
        expiryDate: new Date(original.expiryDate).toISOString().slice(0, 10),
        apiAccessEnabled: true,
      },
    });
    expect(patchRes.ok(), await patchRes.text()).toBeTruthy();
    const patched = await patchRes.json();
    const expiryMs = new Date(patched.subscription.expiryDate).getTime();
    expect(expiryMs).toBeGreaterThan(Date.now() + 2 * 24 * 60 * 60 * 1000);
    expect(expiryMs).toBeLessThan(Date.now() + 4 * 24 * 60 * 60 * 1000);
  });

  test("API PAYG keys validate every supported model from one balance", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "API model matrix runs once to avoid shared proxy rate limits.");
    const apiHeaders = { Authorization: `Bearer ${apiSwitchRawKey}`, "x-forwarded-for": "10.250.10.1" };
    for (const model of ["gpt-5.4-mini", "gpt-5.4", "gpt-5.5", "gpt-5.6-terra", "gpt-5.6-sol", "claude-haiku", "claude-sonnet", "claude-opus"]) {
      const res = await request.post("/api/v1/chat/completions", {
        headers: apiHeaders,
        data: { model, max_tokens: 1, messages: [{ role: "user", content: "ping" }] },
      });
      const body = await res.json();
      expect(res.status(), `${model}: ${JSON.stringify(body)}`).toBe(402);
      expect(body.error?.code).toBe("insufficient_api_credit");
    }
  });

  test("API users can create more than three keys", async ({ page, request }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(fixtures.apiSwitch.email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("heading", { name: /API Dashboard/i })).toBeVisible({ timeout: 20_000 });
    const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
    for (let i = 1; i <= 4; i += 1) {
      const res = await request.post("/api/auth/keys", {
        headers: { cookie },
        data: { name: `Extra API Key ${i}` },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
    }
    const list = await request.get("/api/auth/keys", { headers: { cookie } });
    expect(list.ok()).toBeTruthy();
    const data = await list.json();
    expect(data.keys.length).toBeGreaterThanOrEqual(5);
  });

  test("user-facing API workspace data hides internal provider pools", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "API response shape coverage runs once.");
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(fixtures.apiSwitch.email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("heading", { name: /API Dashboard/i })).toBeVisible({ timeout: 20_000 });
    const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");
    const res = await request.get("/api/auth/me", { headers: { cookie } });
    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    expect(JSON.stringify(data.usage?.apiCreditLedger || [])).not.toContain("providerPool");
    expect(JSON.stringify(data.usage?.apiCreditLedger || [])).not.toContain("kiro");
  });

  test("reasoning selector is available across plans and model families", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Reasoning control is hidden on mobile header.");
    await login(page, fixtures.gptChat.email);
    await expect(page.getByRole("button", { name: /Medium/i }).first()).toBeVisible({ timeout: 20_000 });

    const claudePage = await page.context().browser().newPage();
    await login(claudePage, fixtures.claudeCode.email);
    await expect(claudePage.getByRole("button", { name: /Claude Haiku/i })).toBeVisible({ timeout: 20_000 });
    await expect(claudePage.getByRole("button", { name: /Medium/i }).first()).toBeVisible({ timeout: 20_000 });
    await claudePage.getByRole("button", { name: /Medium/i }).first().click();
    await expect(claudePage.getByRole("button", { name: /^high/i })).toBeVisible();
    await expect(claudePage.getByRole("button", { name: /x-high/i })).toHaveCount(0);
    await claudePage.close();
  });

  test("scoped API keys enforce group, status, and quota", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Backend policy coverage runs once to avoid shared fixture rate limits.");
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(fixtures.apiSwitch.email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("heading", { name: /API Dashboard/i })).toBeVisible({ timeout: 20_000 });
    const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join("; ");

    const createKey = async (providerScope, quotaUsd = 0) => {
      const res = await request.post("/api/auth/keys", {
        headers: { cookie },
        data: { name: `${providerScope} scoped key`, providerScope, quotaUsd },
      });
      expect(res.ok(), await res.text()).toBeTruthy();
      return (await res.json()).key;
    };

    const codexKey = await createKey("codex");
    const claudeKey = await createKey("claude");
    const quotaKey = await createKey("codex", 0.000001);
    const discontinuedGrok = await request.post("/api/auth/keys", {
      headers: { cookie },
      data: { name: "deprecated grok scoped key", providerScope: "grok" },
    });
    expect(discontinuedGrok.status()).toBe(400);

    for (const [index, item] of [
      { key: codexKey.key, model: "claude-haiku", code: "api_key_scope_mismatch" },
      { key: claudeKey.key, model: "gpt-5.4-mini", code: "api_key_scope_mismatch" },
      { key: claudeKey.key, model: "gpt-5.6-terra", code: "api_key_scope_mismatch" },
      { key: quotaKey.key, model: "gpt-5.6-terra", code: "api_key_quota_exceeded" },
    ].entries()) {
      const res = await request.post("/api/v1/chat/completions", {
        headers: { Authorization: `Bearer ${item.key}`, "x-forwarded-for": `10.250.20.${index + 1}` },
        data: { model: item.model, max_tokens: 100, messages: [{ role: "user", content: "ping" }] },
      });
      const body = await res.json();
      expect(body.error?.code, `${item.model}: ${JSON.stringify(body)}`).toBe(item.code);
    }

    const disable = await request.patch("/api/auth/keys", {
      headers: { cookie },
      data: { action: "toggle", keyId: codexKey.id, status: "disabled" },
    });
    expect(disable.ok(), await disable.text()).toBeTruthy();
    const disabledRes = await request.post("/api/v1/chat/completions", {
      headers: { Authorization: `Bearer ${codexKey.key}`, "x-forwarded-for": "10.250.20.100" },
      data: { model: "gpt-5.4-mini", max_tokens: 1, messages: [{ role: "user", content: "ping" }] },
    });
    const disabledBody = await disabledRes.json();
    expect(disabledBody.error?.code).toBe("api_key_disabled");
  });

  test("API Dashboard UI keeps selected group context and survives reload", async ({ page, request }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Dashboard state coverage only needs one browser project.");
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(fixtures.gptCode.email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByPlaceholder(/type your message/i)).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /^API( Dashboard)?$/i }).click();
    await expect(page.getByRole("heading", { name: /API Dashboard/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /API Keys/i }).click();
    await expect(page.getByText(/Create New Key/i)).toBeVisible({ timeout: 10_000 });

    const createKeyForm = page.locator("form", { hasText: /Name.*Group.*Quota/i }).first();
    await createKeyForm.locator('input[placeholder="Example: VS Code Codex"]').fill("Claude UI Context");
    await createKeyForm.locator("select").selectOption("claude");
    await createKeyForm.locator('input[placeholder="USD"]').fill("3");
    await page.getByRole("button", { name: /^Create$/i }).click();
    await expect(page.getByText("Claude UI Context")).toBeVisible({ timeout: 15_000 });
    const claudeKeyCard = page.getByText("Claude UI Context").locator("xpath=ancestor::div[contains(@class, 'rounded-xl')][1]");
    await claudeKeyCard.getByRole("button", { name: /^Use$/i }).click();
    await expect(page.getByText(/Selected Key Group/i)).toBeVisible();
    await expect(page.getByText(/Claude group\. Models/i)).toBeVisible();
    await expect(page.getByText(/claude-haiku, claude-sonnet, claude-opus/i).first()).toBeVisible();
    await expect(createKeyForm.locator("select")).toHaveValue("claude");

    await page.reload();
    await expect(page.getByRole("heading", { name: /API Dashboard/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Create New Key/i)).toBeVisible({ timeout: 10_000 });
  });

  test("chat composer shrinks after sending a long prompt", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Composer height behavior is covered once.");
    await login(page, fixtures.gptCode.email);
    const composer = page.getByPlaceholder(/type your message/i);
    const longPrompt = `Please answer briefly. ${"long text ".repeat(120)}`;
    await composer.fill(longPrompt);
    const tallBox = await composer.boundingBox();
    expect(tallBox?.height || 0).toBeGreaterThan(70);
    await page.getByRole("button", { name: /send message/i }).click();
    await expect(composer).toHaveValue("", { timeout: 5_000 });
    await expect.poll(async () => (await composer.boundingBox())?.height || 0, { timeout: 5_000 }).toBeLessThan(80);
  });

  test("interrupted conversation shows retry recovery", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Interrupted state coverage only needs one browser project.");
    const convId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare("INSERT INTO Conversation (id,userId,title,createdAt,updatedAt) VALUES (?,?,?,?,?)").run(convId, gptCodeUserId, "Interrupted E2E", now, now);
    db.prepare("INSERT INTO Message (id,conversationId,role,content,createdAt) VALUES (?,?,?,?,?)").run(crypto.randomUUID(), convId, "user", "This prompt was interrupted", now);

    await login(page, fixtures.gptCode.email);
    await page.evaluate(([key, value]) => window.localStorage.setItem(key, value), [`rintis:lastConversation:${gptCodeUserId}`, convId]);
    await page.reload();
    await expect(page.getByText(/Generation interrupted/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /^Retry$/i })).toBeVisible();
  });

  test("each subscription plan exposes only its allowed model family in the UI", async ({ page }) => {
    const cases = [
      { email: fixtures.gptChat.email, selected: "GPT-5.4 Mini", allowed: [], blocked: [/GPT-5\.4 Pro/i, /Claude/i, /Grok/i] },
      { email: fixtures.gptCode.email, selected: "GPT-5.4 Mini", allowed: [/GPT-5\.4 Pro/i, /GPT-5\.5 Ultra/i, /GPT-5\.6 Terra/i], blocked: [/GPT-5\.6 Sol/i, /Claude/i, /Grok/i] },
      { email: fixtures.codexPro.email, selected: "GPT-5.4 Mini", allowed: [/GPT-5\.6 Terra/i, /GPT-5\.6 Sol/i], blocked: [/Claude/i, /Grok/i] },
      { email: fixtures.claudeCode.email, selected: "Claude Haiku", allowed: [/Claude Sonnet/i, /Claude Opus/i], blocked: [/GPT-5\.4/i, /Grok/i] },
    ];

    for (const item of cases) {
      const casePage = await page.context().browser().newPage();
      await login(casePage, item.email);
      await expect(casePage.getByRole("button", { name: item.selected, exact: true })).toBeVisible({ timeout: 20_000 });
      await casePage.getByRole("button", { name: item.selected, exact: true }).click();
      for (const allowed of item.allowed) await expect(casePage.getByRole("button", { name: allowed })).toBeVisible();
      for (const blocked of item.blocked) await expect(casePage.getByRole("button", { name: blocked })).toHaveCount(0);
      await casePage.close();
    }
  });

  test("admin-completed cross-family purchase stacks without shortening existing expiry", async ({ page }) => {
    const before = db.prepare("SELECT expiryDate FROM Subscription WHERE userId=?").get(renewalUserId);
    const previousExpiry = new Date(before.expiryDate).getTime();

    await login(page, fixtures.renewal.email);
    await page.getByRole("button", { name: /upgrade/i }).first().click();
    await page.getByRole("button", { name: /weekly/i }).click();
    await page.getByRole("button", { name: /claude code/i }).click();
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
    await adminPage.getByPlaceholder(/search user/i).fill(fixtures.renewal.email);
    await expect(adminPage.getByText(fixtures.renewal.email).first()).toBeVisible({ timeout: 20_000 });
    await adminPage.getByRole("button", { name: /activate/i }).first().click();
    await expect(adminPage.getByText(/Upgrade completed and plan activated/i)).toBeVisible({ timeout: 15_000 });
    await adminPage.close();

    const after = db.prepare("SELECT plan, billingInterval, expiryDate FROM Subscription WHERE userId=?").get(renewalUserId);
    expect(after.plan).toBe("claude_code");
    expect(after.billingInterval).toBe("weekly");
    expect(new Date(after.expiryDate).getTime()).toBeGreaterThanOrEqual(previousExpiry);
    const claudePackage = db.prepare("SELECT plan, billingInterval, status, startsAt, expiresAt FROM PlanEntitlement WHERE userId=? AND family=? ORDER BY createdAt DESC LIMIT 1").get(renewalUserId, "claude");
    expect(claudePackage?.plan).toBe("claude_code");
    expect(claudePackage?.billingInterval).toBe("weekly");
    expect(new Date(claudePackage.expiresAt).getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
  });

  test("API workspace survives switching from API-only plan to Claude Code", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill(fixtures.apiSwitch.email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("heading", { name: /API Dashboard/i })).toBeVisible({ timeout: 20_000 });

    db.prepare("UPDATE Subscription SET plan=?, billingInterval=?, apiAccessEnabled=? WHERE userId=(SELECT id FROM User WHERE email=?)")
      .run("claude_code", "weekly", 1, fixtures.apiSwitch.email);

    await page.reload();
    await expect(page.getByRole("heading", { name: /API Dashboard/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /open web chat/i }).click();
    await expect(page.getByPlaceholder(/type your message/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("button", { name: /Claude Haiku/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /Claude Haiku/i }).click();
    await expect(page.getByRole("button", { name: /Claude Sonnet/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Claude Opus/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /GPT-5\.4/i })).toHaveCount(0);
    await page.getByRole("button", { name: /Claude Sonnet/i }).click();

    await page.getByRole("button", { name: /^API( Dashboard)?$/i }).click();
    await expect(page.getByRole("heading", { name: /API Dashboard/i })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /API Keys/i }).click();
    await expect(page.getByText("Existing API Key")).toBeVisible({ timeout: 10_000 });
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
