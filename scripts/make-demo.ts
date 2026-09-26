// Makes the online demo's sample data (src/demo/en.json and zh.json): imports
// the sample chats into a running app, analyzes them with the real model set
// up in that app's .env, asks for rewrites of two replies, and saves what the
// page stored. Uses your API credits (well under ¥1 / $0.15 in total).
//
//   npm start                      (in another terminal, with a key configured)
//   npx tsx scripts/make-demo.ts [http://127.0.0.1:3178]
import { chromium, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { DEMO_CHATS } from "./demo-chats";
import { en } from "../src/locales/en";
import { zh } from "../src/locales/zh";

const BASE = process.argv[2] ?? "http://127.0.0.1:3178";
const TEXT = { en, zh };

async function make(page: Page, lang: "en" | "zh") {
  const t = TEXT[lang];
  const chat = DEMO_CHATS[lang];
  await page.goto(BASE);
  await page
    .getByRole("dialog", { name: t.disclaimer.title })
    .getByRole("button", { name: t.disclaimer.accept })
    .click();
  await page.getByLabel(t.composer.label).fill(chat.text);
  await page
    .locator(".composer-actions")
    .getByRole("button", { name: t.composer.importChat })
    .click();
  const who = page.getByRole("dialog", { name: t.importer.title });
  await who.getByRole("button", { name: chat.me, exact: true }).click();
  await who.getByRole("button", { name: t.importer.import }).click();
  // Everything the app can show: emotions, intents and reply grades.
  await page.getByLabel(t.status.level).selectOption("full");
  await page.getByRole("button", { name: t.status.start }).click();
  await page
    .locator(".analysis-status .completed")
    .filter({ hasText: t.status.done })
    .waitFor({ timeout: 10 * 60_000 });

  // The list only renders what is on screen; the replies are near the end.
  await page.getByRole("button", { name: t.app.scrollLatest }).click();
  await page.waitForTimeout(500);
  for (const text of chat.rewrite) {
    await page.getByRole("button", { name: t.row.replyAria(text) }).click();
    const review = page.getByRole("dialog", { name: t.line.replyTitle });
    await review.getByRole("button", { name: t.line.howBetter }).click();
    await review.locator(".suggestion").first().waitFor({ timeout: 120_000 });
    await page.keyboard.press("Escape");
  }
  // Let the page's debounced save land, then read what it stored.
  await page.waitForTimeout(1500);
  const saved = await page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const open = indexedDB.open("crush-monitor", 1);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const get = open.result
            .transaction("workspace")
            .objectStore("workspace")
            .get("current");
          get.onsuccess = () => resolve(get.result);
          get.onerror = () => reject(get.error);
        };
      }),
  );
  writeFileSync(`src/demo/${lang}.json`, JSON.stringify(saved));
  console.log(`src/demo/${lang}.json written`);
}

const browser = await chromium.launch({ channel: "msedge" });
for (const lang of ["en", "zh"] as const) {
  // A fresh profile per language: its own storage, and the language to match.
  const context = await browser.newContext({ locale: DEMO_CHATS[lang].locale });
  await make(await context.newPage(), lang);
  await context.close();
}
await browser.close();
