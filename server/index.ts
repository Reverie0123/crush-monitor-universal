import "dotenv/config";
import express from "express";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";
import { analyze, requestSchema } from "./analysis";
import { clearCache, config, pruneCache } from "./llm";
import { API_VERSION } from "../shared/types";
import { errorBody, type ErrorCode } from "./errors";
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
    res.status(403).json(errorBody("forbidden"));
    return;
  }
  next();
});
// The page is rebuilt on disk while an old server may still be running. A page
// newer than the server would send fields the server rejects, so say so plainly.
app.use("/api", (req, res, next) => {
  const client = req.headers["x-api-version"];
  if (req.method === "POST" && client && client !== API_VERSION) {
    res.status(409).json(errorBody("versionMismatch"));
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
    res.status(400).json(errorBody("badSettings"));
    return;
  }
  try {
    res.json(await updateConfig(valid.data));
  } catch {
    res.status(500).json(errorBody("envWrite"));
  }
});
app.post("/api/config/test", async (_req, res) => {
  try {
    res.json(await testConnection(AbortSignal.timeout(30000)));
  } catch (error) {
    const status = Number((error as { status?: number }).status);
    res.status(200).json({
      ok: false,
      // A timeout here has no status; it is about the connection, not an analysis.
      ...errorBody(
        status
          ? errorCode(
              status,
              (error as Error).message,
              config().provider === "jev",
            )
          : "testTimeout",
      ),
    });
  }
});
app.delete("/api/cache", async (_req, res) => {
  await clearCache();
  res.json({ ok: true });
});

// Upstream statuses that have their own advice. The same statuses mean
// different fixes on Jev, whose settings have no model name or address.
const HTTP_CODES = [400, 401, 402, 403, 404, 413, 422, 429, 529];
const JEV_CODES = [400, 401, 402, 403, 404, 502];
function errorCode(status: number, detail?: string, jev = false): ErrorCode {
  if (jev && JEV_CODES.includes(status)) return `jev${status}` as ErrorCode;
  if (HTTP_CODES.includes(status)) return `http${status}` as ErrorCode;
  return status === 502 && detail === "network error"
    ? "network"
    : "unfinished";
}
function fail(
  res: express.Response,
  error: unknown,
  aborted: boolean,
  jev = false,
) {
  const code = Number((error as { status?: number }).status) || 502;
  if (!res.headersSent && !aborted)
    res
      .status(code >= 400 && code < 600 ? code : 502)
      .json(errorBody(errorCode(code, (error as Error).message, jev)));
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
    res.status(400).json(errorBody("badChat"));
    return;
  }
  if (!config().apiKey) {
    res.status(503).json(errorBody("noKey"));
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
    res.status(429).json(errorBody("busy"));
    return;
  }
  minute.count++;
  hour.count++;
  active++;
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  // Errors are explained for the model this request used, even if the
  // settings change while it runs.
  const jev = config().provider === "jev";
  try {
    res.json(await analyze(valid.data, controller.signal));
  } catch (error) {
    fail(res, error, controller.signal.aborted, jev);
  } finally {
    active--;
  }
});
app.post("/api/suggest", async (req, res) => {
  const valid = suggestSchema.safeParse(req.body);
  if (!valid.success) {
    res.status(400).json(errorBody("badRequest"));
    return;
  }
  // Jev only scores; rewriting a reply needs a chat model.
  if (!config().suggest) {
    res
      .status(503)
      .json(
        errorBody(
          config().provider === "jev" && !config().jevSuggest
            ? "noSuggestJevOnly"
            : "noSuggestKey",
        ),
      );
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
      .json(errorBody("unsupported"));
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
