// The online version has no server: the page runs the same analysis code the
// server does, and calls the model service the user set up straight from the
// browser. This answers the page's API calls the way server/index.ts would.
import { analyze, requestSchema } from "../server/analysis";
import { clearCache, pruneCache } from "../server/cache";
import { errorBody, errorCode } from "../server/errors";
import { config } from "../server/llm";
import {
  publicConfig,
  settingsSchema,
  testConnection,
  updateConfig,
} from "../server/settings";
import { suggest, suggestSchema } from "../server/suggest";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const parse = (init: RequestInit) =>
  init.body ? JSON.parse(String(init.body)) : {};
const fail = (error: unknown, jev = false) => {
  const code = Number((error as { status?: number }).status) || 502;
  return json(
    errorBody(errorCode(code, (error as Error).message, jev)),
    code >= 400 && code < 600 ? code : 502,
  );
};

let pruned = false;
export async function webFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const method = init.method ?? "GET";
  const signal = init.signal ?? undefined;
  // Expired cache entries are removed once per visit.
  if (!pruned) {
    pruned = true;
    void pruneCache().catch(() => {});
  }
  if (path === "/api/config" && method === "GET") return json(publicConfig());
  if (path === "/api/config" && method === "POST") {
    const valid = settingsSchema.safeParse(parse(init));
    if (!valid.success) return json(errorBody("badSettings"), 400);
    try {
      return json(await updateConfig(valid.data));
    } catch {
      return json(errorBody("envWrite"), 500);
    }
  }
  if (path === "/api/config/test") {
    try {
      return json(await testConnection(AbortSignal.timeout(30000)));
    } catch (error) {
      const status = Number((error as { status?: number }).status);
      return json({
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
  }
  if (path === "/api/cache" && method === "DELETE") {
    await clearCache();
    return json({ ok: true });
  }
  if (path === "/api/analyze") {
    const valid = requestSchema.safeParse(parse(init));
    if (!valid.success) return json(errorBody("badChat"), 400);
    if (!config().apiKey) return json(errorBody("noKey"), 503);
    // Errors are explained for the model this request used, even if the
    // settings change while it runs.
    const jev = config().provider === "jev";
    try {
      return json(await analyze(valid.data, signal));
    } catch (error) {
      if (signal?.aborted) throw error;
      return fail(error, jev);
    }
  }
  if (path === "/api/suggest") {
    const valid = suggestSchema.safeParse(parse(init));
    if (!valid.success) return json(errorBody("badRequest"), 400);
    // Jev only scores; rewriting a reply needs a chat model.
    if (!config().suggest)
      return json(
        errorBody(
          config().provider === "jev" && !config().jevSuggest
            ? "noSuggestJevOnly"
            : "noSuggestKey",
        ),
        503,
      );
    try {
      return json(await suggest(valid.data, signal));
    } catch (error) {
      if (signal?.aborted) throw error;
      return fail(error);
    }
  }
  return json(errorBody("badRequest"), 404);
}
