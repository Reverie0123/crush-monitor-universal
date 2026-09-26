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

test("条款确认前没有关闭按钮；设置里可以切到 Jev 并选是否要回复建议", async ({
  page,
}) => {
  await page.goto("/");
  const disclaimer = page.getByRole("dialog", { name: "使用前请阅读" });
  await expect(disclaimer.getByRole("button", { name: "关闭" })).toHaveCount(0);
  await disclaimer.getByRole("button", { name: /我已阅读/ }).click();
  await page.getByRole("button", { name: "更多聊天设置" }).click();
  const dialog = page.getByRole("dialog", { name: "聊天设置" });
  await dialog.getByText("模型与接口").click();
  // Only switches the form; nothing is saved, so the test server's settings stay.
  await dialog.getByRole("button", { name: "Jev（原版模型）" }).click();
  await expect(dialog.getByText("保存后切换")).toBeVisible();
  await expect(dialog.getByLabel("Jev 调用平台")).toBeVisible();
  await expect(dialog.getByText(/不提供回复建议/)).toBeVisible();
  await expect(dialog.getByLabel("接口地址")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Jev + DeepSeek / OpenAI" }).click();
  await expect(dialog.getByLabel(/回复建议用的 API Key/)).toBeVisible();
  await expect(dialog.getByLabel("接口地址")).toBeVisible();
});

// ---- Jev mode: the same page served by a second server set to Jev only ----
const JEV = "http://127.0.0.1:3192";
const jevStats = async (page: Page) =>
  (await page.request.get("http://127.0.0.1:3191/jev-stats")).json();

async function openJev(page: Page, text: string) {
  await page.goto(JEV);
  await page
    .getByRole("dialog", { name: "使用前请阅读" })
    .getByRole("button", { name: /我已阅读/ })
    .click();
  await page.getByLabel("粘贴聊天记录").fill(text);
  await page
    .locator(".composer-actions")
    .getByRole("button", { name: "导入聊天" })
    .click();
  const dialog = page.getByRole("dialog", { name: "确认聊天里的你" });
  await dialog.getByRole("button", { name: "我", exact: true }).click();
  await dialog.getByRole("button", { name: "导入聊天" }).click();
  await expect(dialog).toBeHidden();
}

test("Jev 模式：完整分析跑通，请求是 Jev 的原生格式，仅 Jev 时没有回复建议", async ({
  page,
}) => {
  await openJev(page, chat());
  await expect(page.locator(".pending-run")).toContainText(
    "Jev 以平台账单为准",
  );
  await runAnalysis(page);
  await expect(page.locator(".affinity-number")).not.toHaveText("—");
  await expect(page.locator(".emotion-tag").first()).toBeVisible();
  await expect(page.locator(".reply-tag").first()).toBeVisible();
  await expect(page.locator(".retry-tag")).toHaveCount(0);
  // Jev writes no reasons: no empty reason sections.
  await page.locator(".header-affinity").click();
  await expect(page.getByText("模型的整体解读")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.locator(".reply-tag").first().click();
  const detail = page.getByRole("dialog", { name: "回复评价" });
  await expect(detail.getByText("当前是「仅 Jev」模式")).toBeVisible();
  await expect(
    detail.getByRole("button", { name: /怎么说更好|换两种说法/ }),
  ).toHaveCount(0);
  const stats = await jevStats(page);
  expect(stats.rejected).toEqual([]);
  expect(stats.requests).toBeGreaterThan(0);
});

test("Jev 模式：长聊天自动分批，每次不超过原版上限，并发不超过 2 路", async ({
  page,
}) => {
  // 700 messages, about 17,000 characters: over Jev's 500 / 12,000.
  const pad = (n: number) => String(n).padStart(2, "0");
  const lines = ["【聊天记录摘要】", "会话名称：小雨", "", ""];
  for (let i = 0; i < 700; i++)
    lines.push(
      `${i % 2 ? "我" : "小雨"} 2026-08-${pad(1 + Math.floor(i / 40))} 20:${pad(i % 60)}:00`,
      `第${i}句聊天内容，今天过得怎么样呀`,
      "",
    );
  await openJev(page, lines.join("\n"));
  await page.getByLabel("分析档位").selectOption("standard");
  await expect(page.locator(".pending-run")).toContainText(
    "超过单次上限，将分批上传",
  );
  await page.getByRole("button", { name: "开始分析" }).click();
  await expect(page.locator(".batch-note")).toContainText(
    /分批上传中：正在分析第 [\d,]+–[\d,]+ 条，共 700 条/,
  );
  // Model settings can't be saved mid-run: that would switch models under it.
  await page.getByRole("button", { name: "更多聊天设置" }).click();
  const settings = page.getByRole("dialog", { name: "聊天设置" });
  await settings.getByText("模型与接口").click();
  await expect(settings.getByText("正在分析，停止或完成后")).toBeVisible();
  await expect(settings.getByRole("button", { name: "仅保存" })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(page.getByText("分析完成")).toBeVisible({ timeout: 90_000 });
  const stats = await jevStats(page);
  expect(stats.rejected).toEqual([]);
  expect(stats.maxMessages).toBeLessThanOrEqual(500);
  expect(stats.maxChars).toBeLessThanOrEqual(12000);
  expect(stats.maxInFlight).toBeLessThanOrEqual(2);
  // Every counterpart line was analyzed despite the batching.
  await expect(page.locator(".emotion-tag")).not.toHaveCount(0);
  await expect(page.locator(".retry-tag")).toHaveCount(0);
});

test.describe("English interface", () => {
  test.use({ locale: "en-US" });

  test("英文浏览器默认英文界面，能切到中文再切回来，刷新后记住选择", async ({
    page,
  }) => {
    await page.goto("/");
    await page
      .getByRole("dialog", { name: "Please read before using" })
      .getByRole("button", { name: /I've read this/ })
      .click();
    await page.getByLabel("Paste a chat").fill(chat());
    await page
      .locator(".composer-actions")
      .getByRole("button", { name: "Import chat" })
      .click();
    const who = page.getByRole("dialog", { name: "Which one is you?" });
    await who.getByRole("button", { name: "我", exact: true }).click();
    await who.getByRole("button", { name: "Import chat" }).click();
    await expect(page.locator(".pending-run")).toContainText(
      /\d+ messages? to analyze · Est\./,
    );
    // A new English visitor sees costs in dollars.
    await expect(page.locator(".pending-run")).toContainText("$");
    // Every analysis request asks the model to answer in English.
    const languages: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/analyze"))
        languages.push(JSON.parse(r.postData() ?? "{}").language);
    });
    await page.getByRole("button", { name: "Start Analysis" }).click();
    const done = page.locator(".analysis-status .completed");
    await expect(done).toContainText("Done", { timeout: 45_000 });
    await expect(page.locator(".emotion-tag").first()).toContainText("Happy");
    expect(languages.length).toBeGreaterThan(0);
    expect(new Set(languages)).toEqual(new Set(["en"]));
    await page.locator(".reply-tag").first().click();
    const review = page.getByRole("dialog", { name: "Reply review" });
    await expect(review).toContainText("Reply Rating:");
    await page.keyboard.press("Escape");

    // Switch to Chinese: everything on screen changes at once, no reload.
    // The reasons were written in English, so a Chinese re-run is offered.
    await page.getByRole("button", { name: "切换到中文" }).click();
    const rerun = page.locator(".pending-run");
    await expect(rerun).toContainText("现有的分析是英文写的");
    await expect(page.locator(".emotion-tag").first()).toContainText("开心");
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");

    // The choice survives a reload, and switching back works too.
    await page.reload();
    await expect(rerun).toContainText("现有的分析是英文写的");
    await page.getByRole("button", { name: "Switch to English" }).click();
    await expect(done).toContainText("Done");
    await expect(page.locator(".emotion-tag").first()).toContainText("Happy");
  });
});

test.describe("Other browser languages", () => {
  test.use({ locale: "fr-FR" });

  test("非中英文浏览器默认英文界面", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("dialog", { name: "Please read before using" }),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});
