# Crush Monitor (DeepSeek / OpenAI edition)

[简体中文](README.md) · English

> **About this version:** an adaptation of [Crush Monitor](https://github.com/FerryCorleone/crush-monitor) by [**FerryCorleone**](https://github.com/FerryCorleone). The original uses TypeSafe's Jev model; because TypeSafe paused new sign-ups, this version calls DeepSeek / OpenAI-compatible APIs by default, can still switch back to Jev (via OpenRouter, Vercel or TypeSafe) in the settings, and adds a number of improvements. Published with the original author's permission; it keeps the original MIT license and copyright notice ([LICENSE](LICENSE)).

A tool for looking at conversations with your crush or partner. It helps you make sense of emotions and intentions, and spot replies you could have worded better.

AI doesn't know your relationship or what happens outside the chat. Take the results lightly—as another perspective. Your own judgment and an honest conversation still matter more.

## Features

- **WeChat-style conversation view:** analysis sits beneath each message.
- **Emotions and intentions:** the top three probabilities from 12 emotion and 36 intention categories (including academic discussion).
- **Affection score and reply grades:** a conversation-level score, SSS–D grades for your replies, and suggested next steps.
- **Reasons you can read:** every label and score comes with a one-line, context-based explanation from the model, plus an overall reading.
- **Relationship trend:** a weekly affection curve with turning points marked.
- **Key moments:** invitations, care, confessions, refusals and similar events in one timeline; click to jump to the message.
- **Reply suggestions:** ask for two better ways to phrase any of your own replies.
- **Report export:** download a one-page HTML report.
- **Timing and quotes:** reply gaps, late-night chats and WeChat quoted replies are understood; images, stickers, recalls and pats are shown as context only.
- **Ten relationship types:** from "just met" to "cold war" and "exes", each with its own reading guidance.
- **Your own key, cost shown:** runs locally with your own API credits and shows the estimated spend.
- **Privacy masking:** phone numbers, emails, ID and card numbers, and words you choose are replaced with placeholders before sending.

The interface and analysis labels are in Chinese. This README provides English setup instructions; it does not add an English UI.

## Model

This version calls an OpenAI-compatible Chat Completions API (DeepSeek by default). `server/llm.ts` asks the model to write a reason and then a probability distribution for each question, and converts that into the same choices, scores and confidences the original used, so the rules layer is largely unchanged. General chat models are not calibrated the way Jev is, so results may be less precise than the original.

- [Get a DeepSeek API key](https://platform.deepseek.com/api_keys)
- OpenAI or other compatible services work too: change the address and model in the settings page.

**You can still use the original Jev model:** in the settings page, switch to **Jev（原版模型）**, pick a platform ([OpenRouter](https://openrouter.ai/settings/keys), Vercel AI Gateway or TypeSafe) and paste that platform's key. Jev returns calibrated probabilities but no written reasons. Choose **仅 Jev** (Jev only, no reply suggestions) or **Jev + DeepSeek / OpenAI** (Jev analyzes, the chat model writes reply suggestions). Jev reads at most 500 messages / 12,000 characters per request; longer chats are sent in batches automatically, and the status bar shows which messages are being analyzed. Each service keeps its own key, so you can switch back and forth.

## Run locally

Install Node.js 22.12+. Download or clone this repository, then in the project directory:

```sh
npm ci
npm run setup
npm run build
npm start
```

Open [http://127.0.0.1:3178/](http://127.0.0.1:3178/), click the settings icon at the bottom left, paste your API key under **模型与接口** (Model & API), then **保存并测试连接** (Save & test). Leave the terminal running. On Windows you can also double-click `启动.bat`.

## Usage

1. Paste a conversation, or click **导入文件** (Import file) to pick a `.txt` export. Export-tool summary headers are skipped automatically.
2. Select your own name and click **开始分析** (Analyze). Relationship type and background are in **聊天设置** (Chat settings).
3. Click a label for details and the model's reasons. The three buttons at the top right are trend, key moments and report export.
4. Import more of the same conversation later: overlaps are merged and only new messages are analyzed.

### Supported text formats

| Source                | What to paste                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------- |
| WeChat                | Desktop multi-message copy (name, date/time, body on separate lines), or export-tool "name time" + body format |
| QQ                    | `Name: 09-17 19:26:53`, followed by the body on the next line; dates with a year also work                     |
| WhatsApp              | [Export a chat](https://faq.whatsapp.com/1180414079177245/), open the `.txt` file and copy its contents        |
| iMessage / other apps | Format each message as `Name: body`                                                                            |

```text
[9/17/26, 7:26:53 PM] Alex: Dinner tonight?
17/09/2026, 19:27 - Me: Sounds good
```

Only two-person text conversations are supported—not images, audio, ZIP/HTML exports or chat databases.

## Notes

- The affection score combines six weighted dimensions. An explicit refusal that still applies limits the score. **It is not the probability that someone likes you.**
- Each model request holds up to 2,000 messages / 60,000 characters. The overview reads the most recent ~1,950 messages; per-line analysis sees the previous 150 and next 20. Total history is limited only by browser storage.
- Model replies are cached in `.cache/` so re-analyzing the same content is free; you can clear or disable this in settings. The cache contains chat text—never commit it.
- Chats and results stay in this browser's local database. Text needed for analysis (after masking) is sent to your configured model service, billed to your account.
- Never commit `.env`, `.cache/` or private conversations.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) (in Chinese). Current version v2.1.0: switch back to the original Jev model, and long chats are sent in batches automatically.

## Development

React + TypeScript + Vite + Express.

```sh
npm run dev        # http://127.0.0.1:5178/
npm test           # local tests; no model calls
npm run check:live # real model check; uses your API credits
```

## License

[MIT](LICENSE). Copyright of the original project belongs to its author. Not affiliated with WeChat, Tencent, TypeSafe, DeepSeek, OpenAI or any messaging platform mentioned here.
