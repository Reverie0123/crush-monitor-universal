import { expect, type Page } from "@playwright/test";

// Three weeks of chat in the export-tool format, cooling off in the last week.
export function chat() {
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

export async function acceptDisclaimer(page: Page, url = "/") {
  await page.goto(url);
  const dialog = page.getByRole("dialog", { name: "使用前请阅读" });
  await expect(dialog).toBeVisible();
  // It cannot be dismissed without accepting.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /我已阅读/ }).click();
  await expect(dialog).toBeHidden();
}

export async function importChat(page: Page) {
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

export async function runAnalysis(page: Page) {
  await page.getByRole("button", { name: "开始分析" }).click();
  await expect(page.getByText("分析完成")).toBeVisible({ timeout: 45_000 });
}
