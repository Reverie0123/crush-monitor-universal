import { test, expect, type Page } from "@playwright/test";

// Three weeks of chat in the export-tool format, cooling off in the last week.
function chat() {
  const pad = (n: number) => String(n).padStart(2, "0");
  const warm = [
    ["小雨", "今天加班到九点，累死了"],
    ["我", "辛苦了！吃饭了没"],
    ["小雨", "还没，回家随便煮个面"],
    ["我", "别凑合啊，楼下那家牛肉面不是挺好吃的"],
    ["小雨", "哈哈你还记得那家"],
    ["小雨", "[表情]"],
    ["小雨", "下次一起去呗"],
    ["我", "好啊，周六？"],
  ];
  const cold = [
    ["我", "周末有空吗"],
    ["小雨", "再说吧"],
    ["我", "好的"],
  ];
  const lines: string[] = ["【聊天记录摘要】", "会话名称：小雨", "", ""];
  let day = 3;
  for (let w = 0; w < 3; w++)
    for (let d = 0; d < 3; d++, day += 2)
      (w === 2 ? cold : warm).forEach(([who, text], i) =>
        lines.push(`${who} 2026-08-${pad(day)} 21:${pad(i * 5)}:00`, text, ""),
      );
  return lines.join("\n");
}

async function acceptDisclaimer(page: Page) {
  await page.goto("/");
  const dialog = page.getByRole("dialog", { name: "使用前请阅读" });
  await expect(dialog).toBeVisible();
  // It cannot be dismissed without accepting.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /我已阅读/ }).click();
  await expect(dialog).toBeHidden();
}

async function importChat(page: Page) {
  await page.getByLabel("粘贴聊天记录").fill(chat());
  await page
    .locator(".composer-actions")
    .getByRole("button", { name: "导入聊天" })
    .click();
  const dialog = page.getByRole("dialog", { name: "确认聊天里的你" });
  await dialog.getByRole("button", { name: "我", exact: true }).click();
  await dialog.getByRole("button", { name: "导入聊天" }).click();
  await expect(dialog).toBeHidden();
}

async function runAnalysis(page: Page) {
  await page.getByRole("button", { name: "开始分析" }).click();
  await expect(page.getByText("分析完成")).toBeVisible({ timeout: 45_000 });
}

test("导入后先显示预计花费，不会自动开始分析", async ({ page }) => {
  const analyzeCalls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/analyze")) analyzeCalls.push(r.url());
  });
  await acceptDisclaimer(page);
  await importChat(page);
  // The export-tool header was skipped: two speakers, starting at the top.
  await expect(page.locator(".bubble").first()).toHaveText(
    "今天加班到九点，累死了",
  );
  await expect(page.locator(".pending-run")).toContainText(
    /待分析 \d+ 条 · 预计/,
  );
  await page.waitForTimeout(1000);
  expect(analyzeCalls).toHaveLength(0);
});

test("完整分析后出现标签、好感度和判断依据", async ({ page }) => {
  // The Content-Security-Policy must not block anything the app itself needs.
  const blocked: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") blocked.push(m.text());
  });
  await acceptDisclaimer(page);
  await importChat(page);
  await runAnalysis(page);
  await expect(page.locator(".affinity-number")).not.toHaveText("—");
  await expect(page.locator(".emotion-tag").first()).toBeVisible();
  await expect(page.locator(".bubble.unreadable").first()).toHaveText("[表情]");
  await page.locator(".header-affinity").click();
  await expect(page.getByText("模型的整体解读")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".spend")).toContainText("已花费");
  expect(blocked).toEqual([]);
});

test("快速档只做整体分析，不给每句打标签", async ({ page }) => {
  await acceptDisclaimer(page);
  await importChat(page);
  await page.getByLabel("分析档位").selectOption("quick");
  await expect(page.locator(".pending-run")).toContainText("只做整体分析");
  await runAnalysis(page);
  await expect(page.locator(".affinity-number")).not.toHaveText("—");
  await expect(page.locator(".emotion-tag")).toHaveCount(0);
});

test("判断不对时，可以按用户的说明重新判断这一句", async ({ page }) => {
  await acceptDisclaimer(page);
  await importChat(page);
  await runAnalysis(page);
  await page.locator(".emotion-tag").first().click();
  const dialog = page.getByRole("dialog", { name: "情绪与意图" });
  await dialog.getByRole("button", { name: /判断不对/ }).click();
  await dialog.getByRole("textbox").fill("这是我们之间的梗，她在开玩笑");
  await dialog.getByRole("button", { name: "按我的说明重新判断" }).click();
  await expect(dialog.getByText("你的说明")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".corrected-tag").first()).toBeVisible();
});

test("重试未完成的一句只发一个请求，不会变成整份重跑", async ({ page }) => {
  await acceptDisclaimer(page);
  await importChat(page);
  await runAnalysis(page);
  const retryTag = page.getByRole("button", { name: /重试这条/ });
  await expect(retryTag).toHaveCount(1);
  const calls: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/analyze")) calls.push(r.url());
  });
  await retryTag.click();
  await expect(retryTag).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(calls).toHaveLength(1);
  await expect(page.getByText("分析完成")).toBeVisible();
});

test("改了关系后刷新页面，仍然提示需要重新分析", async ({ page }) => {
  await acceptDisclaimer(page);
  await importChat(page);
  await page.getByLabel("分析档位").selectOption("quick");
  await runAnalysis(page);
  await page.getByRole("button", { name: "更多聊天设置" }).click();
  await page
    .getByRole("dialog", { name: "聊天设置" })
    .getByRole("combobox")
    .first()
    .selectOption("friend");
  await page.keyboard.press("Escape");
  await expect(page.locator(".pending-run")).toContainText("预计");
  // Let the save land, then reload: the pending re-analysis must survive.
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.locator(".pending-run")).toContainText("预计");
  await expect(page.getByText("分析完成")).toHaveCount(0);
});

test("搜索和筛选能找到消息并跳过去", async ({ page }) => {
  await acceptDisclaimer(page);
  await importChat(page);
  await page.getByRole("button", { name: "搜索与筛选" }).click();
  const dialog = page.getByRole("dialog", { name: "搜索与筛选" });
  await dialog.getByPlaceholder(/周末/).fill("牛肉面");
  await expect(dialog.locator(".search-results li")).toHaveCount(6);
  await dialog.locator(".search-results button").first().click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".message.highlight .bubble")).toContainText(
    "牛肉面",
  );
});

test("超过单次花费上限会自动暂停", async ({ page }) => {
  await acceptDisclaimer(page);
  await importChat(page);
  // Any spend is recorded only after a first request, so run a cheap one first.
  await page.getByLabel("分析档位").selectOption("quick");
  await runAnalysis(page);
  await page.locator(".spend").click();
  const dialog = page.getByRole("dialog", { name: "花费" });
  await dialog.getByLabel("上限（元）").fill("0.01");
  await dialog.getByRole("button", { name: "保存上限" }).click();
  await page.keyboard.press("Escape");
  await page.getByLabel("分析档位").selectOption("full");
  await page.getByRole("button", { name: "开始分析" }).click();
  await expect(page.locator(".pending-run")).toContainText(
    "已达到单次花费上限",
    {
      timeout: 30_000,
    },
  );
  await expect(page.getByRole("button", { name: "继续分析" })).toBeVisible();
});
