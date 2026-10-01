import { test, expect } from "@playwright/test";
import { acceptDisclaimer, chat } from "./helpers";

// The online version: the static build served on its own, with no app server.
// The page keeps the settings itself and calls the model service directly.
const WEB = "http://127.0.0.1:3193/";
const MOCK = "http://127.0.0.1:3191";

test("在线版：设置存在浏览器里，分析直接从页面发给模型服务，不经过任何服务器", async ({
  page,
}) => {
  const model: string[] = [];
  const api: string[] = [];
  // The page's Content-Security-Policy must not block anything the app needs.
  const blocked: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") blocked.push(m.text());
  });
  page.on("request", (r) => {
    if (r.url().startsWith(MOCK)) model.push(r.url());
    if (r.url().includes("/api/")) api.push(r.url());
  });
  // Settings saved by an earlier visit: the same keys the server reads from .env.
  await page.addInitScript((mock: string) => {
    localStorage.setItem(
      "crush-monitor-web-settings",
      JSON.stringify({
        OPENAI_API_KEY: "test-key",
        OPENAI_BASE_URL: `${mock}/v1`,
        OPENAI_MODEL: "mock-model",
        LLM_CACHE: "off",
      }),
    );
  }, MOCK);
  // Unlike the demo, the online version asks for the disclaimer: it can analyze.
  await acceptDisclaimer(page, WEB);
  await expect(page.locator(".demo-banner")).toContainText("在线版");
  // It opens on the sample chat, already analyzed.
  await expect(page.locator(".emotion-tag").first()).toBeVisible();

  // More chat with the same person is appended to the sample.
  await page.getByLabel("粘贴聊天记录").fill(chat());
  await page
    .locator(".composer-actions")
    .getByRole("button", { name: "导入聊天" })
    .click();
  await page
    .getByRole("dialog", { name: "这段可能重复了" })
    .getByRole("button", { name: "作为新消息追加" })
    .click();
  const who = page.getByRole("dialog", { name: "确认聊天里的你" });
  await who.waitFor({ state: "visible", timeout: 2000 }).catch(() => {});
  if (await who.isVisible()) {
    await who.getByRole("button", { name: "我", exact: true }).click();
    await who.getByRole("button", { name: "导入聊天" }).click();
  }
  await expect(page.locator(".pending-run")).toContainText(/待分析 \d+ 条/);

  const firstCall = page.waitForRequest((r) =>
    r.url().includes("/chat/completions"),
  );
  await page.getByRole("button", { name: "开始分析" }).click();
  await firstCall;
  await expect(page.locator(".pending-run")).toBeHidden();
  // The new messages get their tags (the list is virtualized: scroll to them).
  await page.getByRole("button", { name: "滚动到最新聊天" }).click();
  await expect(
    page.getByRole("button", { name: /查看情绪分析：再说吧/ }).last(),
  ).toBeVisible({ timeout: 45_000 });
  // Every model call went straight from the page to the model service.
  expect(model.filter((u) => u.includes("/chat/completions")).length).toBeGreaterThan(0);
  expect(api).toEqual([]);

  // The settings page reads the same saved values.
  await page.getByRole("button", { name: "聊天设置", exact: true }).click();
  await page.locator("summary", { hasText: "模型与接口" }).click();
  await expect(page.getByText(/在线版：Key 只保存在这个浏览器里/)).toBeVisible();
  await expect(page.getByLabel(/接口地址/)).toHaveValue(`${MOCK}/v1`);

  // Installable on a phone: a manifest, and a service worker for this site only.
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    /manifest\.webmanifest$/,
  );
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => !!r)), { timeout: 15_000 })
    .toBe(true);
  // On a phone-sized screen the paste box says how to get a chat in.
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".composer-hint")).toBeVisible();
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  expect(blocked).toEqual([]);
});
