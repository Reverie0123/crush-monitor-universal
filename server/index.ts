import "dotenv/config";
import express from "express";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { analyze, requestSchema } from "./analysis";
import { clearCache, config, pruneCache } from "./llm";
import { API_VERSION } from "../shared/types";
import { suggest, suggestSchema } from "./suggest";
import {
  publicConfig,
  settingsSchema,
  testConnection,
  updateConfig,
} from "./settings";
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "3mb" }));
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  // Only this app's own scripts may run on the page.
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  res.setHeader("X-Frame-Options", "DENY");
  next();
});
const sameHost = (origin: string, host?: string) => {
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
};
// The API spends model credit: only this page may call it. The Host check
// blocks DNS-rebinding pages that resolve their own name to 127.0.0.1.
app.use("/api", (req, res, next) => {
  const host = (req.headers.host ?? "").replace(/:\d+$/, "");
  const origin = req.headers.origin;
  if (
    !["127.0.0.1", "localhost", process.env.HOST ?? "127.0.0.1"].includes(
      host,
    ) ||
    (origin &&
      !sameHost(origin, req.headers.host) &&
      !["http://127.0.0.1:5178", "http://localhost:5178"].includes(origin))
  ) {
    res.status(403).json({ error: "请求来源不允许" });
    return;
  }
  next();
});
// The page is rebuilt on disk while an old server may still be running. A page
// newer than the server would send fields the server rejects, so say so plainly.
app.use("/api", (req, res, next) => {
  const client = req.headers["x-api-version"];
  if (req.method === "POST" && client && client !== API_VERSION) {
    res.status(409).json({
      error:
        "网页和后台版本不一致：请关掉启动窗口（黑色窗口）重新打开，再刷新网页",
    });
    return;
  }
  next();
});
app.get("/api/health", (_req, res) =>
  res.json({ configured: Boolean(config().apiKey), model: config().model }),
);
app.get("/api/config", (_req, res) => res.json(publicConfig()));
app.post("/api/config", async (req, res) => {
  const valid = settingsSchema.safeParse(req.body);
  if (!valid.success) {
    res.status(400).json({ error: "设置格式不正确，请检查接口地址等字段" });
    return;
  }
  try {
    res.json(await updateConfig(valid.data));
  } catch {
    res.status(500).json({ error: "写入 .env 失败，请检查文件权限" });
  }
});
app.post("/api/config/test", async (_req, res) => {
  try {
    res.json(await testConnection(AbortSignal.timeout(30000)));
  } catch (error) {
    const code = Number((error as { status?: number }).status) || 502;
    res
      .status(200)
      .json({ ok: false, error: errorText(code, (error as Error).message) });
  }
});
app.delete("/api/cache", async (_req, res) => {
  await clearCache();
  res.json({ ok: true });
});

const ERRORS: Record<number, string> = {
  400: "请求被模型拒绝，可能是输入过长或模型名不支持，请查看服务端日志",
  401: "API 认证失败，请在设置里检查 API Key",
  402: "API 账户余额不足，请充值后重试",
  403: "当前 API 账号没有调用权限",
  404: "找不到模型或接口，请在设置里检查模型名和接口地址",
  413: "聊天太长，超出模型一次能读的范围，请只分析最近 7 天或 30 天",
  422: "模型返回格式异常，请重试或缩小聊天范围",
  429: "模型服务限流，请稍后重试",
  529: "模型服务暂时繁忙，请重试",
};
function errorText(code: number, detail?: string) {
  return (
    ERRORS[code] ||
    (code === 502 && detail === "network error"
      ? "连不上模型服务，请检查网络和接口地址"
      : "分析未完成，可能是网络超时。已保留聊天，可重试。")
  );
}
function fail(res: express.Response, error: unknown, aborted: boolean) {
  const code = Number((error as { status?: number }).status) || 502;
  if (!res.headersSent && !aborted)
    res
      .status(code >= 400 && code < 600 ? code : 502)
      .json({ error: errorText(code, (error as Error).message) });
}

// Guards against runaway loops in the page, not normal use.
const MAX_ACTIVE = 12;
const MAX_PER_MINUTE = 240;
const MAX_PER_HOUR = 4000;
let active = 0;
let minute = { count: 0, at: Date.now() };
let hour = { count: 0, at: Date.now() };
app.post("/api/analyze", async (req, res) => {
  const valid = requestSchema.safeParse(req.body);
  if (!valid.success) {
    console.error(
      "Rejected analyze request:",
      valid.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    );
    res.status(400).json({ error: "聊天结构或长度不符合要求，请校正后重试" });
    return;
  }
  if (!config().apiKey) {
    res.status(503).json({ error: "还没有设置 API Key，请点左下角设置填写" });
    return;
  }
  const now = Date.now();
  if (now - minute.at > 60000) minute = { count: 0, at: now };
  if (now - hour.at > 3600000) hour = { count: 0, at: now };
  if (
    minute.count >= MAX_PER_MINUTE ||
    hour.count >= MAX_PER_HOUR ||
    active >= MAX_ACTIVE
  ) {
    res.setHeader(
      "Retry-After",
      String(
        hour.count >= MAX_PER_HOUR
          ? Math.max(1, Math.ceil((hour.at + 3600000 - now) / 1000))
          : active >= MAX_ACTIVE
            ? 1
            : Math.max(1, Math.ceil((minute.at + 60000 - now) / 1000)),
      ),
    );
    res.status(429).json({ error: "分析请求较多，已保留进度，请稍后继续" });
    return;
  }
  minute.count++;
  hour.count++;
  active++;
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  try {
    res.json(await analyze(valid.data, controller.signal));
  } catch (error) {
    fail(res, error, controller.signal.aborted);
  } finally {
    active--;
  }
});
app.post("/api/suggest", async (req, res) => {
  const valid = suggestSchema.safeParse(req.body);
  if (!valid.success) {
    res.status(400).json({ error: "请求格式不正确" });
    return;
  }
  // Jev only scores; rewriting a reply needs a chat model.
  if (!config().openaiKey) {
    res.status(503).json({
      error:
        config().provider === "jev"
          ? "Jev 只能打分，写回复建议还需要 DeepSeek / OpenAI 的 Key，请在设置里填写"
          : "还没有设置 API Key，请点左下角设置填写",
    });
    return;
  }
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  try {
    res.json(
      await suggest(
        valid.data,
        AbortSignal.any([controller.signal, AbortSignal.timeout(60000)]),
      ),
    );
  } catch (error) {
    fail(res, error, controller.signal.aborted);
  }
});
const dist = join(dirname(fileURLToPath(import.meta.url)), "../dist");
app.use(express.static(dist));
app.get("/", (_req, res) => res.sendFile(join(dist, "index.html")));
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    res
      .status(
        (err as { type?: string }).type === "entity.too.large" ? 413 : 400,
      )
      .json({ error: "输入格式或体积不受支持" });
  },
);
// Expired cache entries are removed at start-up and then hourly; a failed
// cleanup must never take the server down.
const prune = () => pruneCache().catch(() => {});
void prune();
setInterval(() => void prune(), 3600 * 1000).unref();
const port = Number(process.env.PORT || 3178);
// Only this machine may connect.
const host = process.env.HOST || "127.0.0.1";
app.listen(port, host, () =>
  console.log(
    `Crush API: http://${host}:${port} · model ${config().model} · key ${config().apiKey ? "configured" : "missing"}`,
  ),
);
