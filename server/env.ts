// Where the settings live. On the server they are process.env, kept in .env
// so they survive restarts. The online version has no server: the same code
// runs in the browser, and the settings are kept in localStorage instead.
export const isNode =
  typeof process !== "undefined" && !!process.versions?.node;

const WEB_KEY = "crush-monitor-web-settings";
let web: Record<string, string> | undefined;
function webValues() {
  if (!web) {
    try {
      web = JSON.parse(localStorage.getItem(WEB_KEY) ?? "{}");
    } catch {
      web = {};
    }
  }
  return web!;
}

/** The current settings; read on every call so changes apply at once. */
export function env(): Record<string, string | undefined> {
  return isNode ? process.env : webValues();
}

/** Applies settings now and keeps them for the next start. */
export async function setEnv(values: Record<string, string>) {
  if (!isNode) {
    Object.assign(webValues(), values);
    localStorage.setItem(WEB_KEY, JSON.stringify(web));
    return;
  }
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
  await writeDotEnv(values);
}

function quote(v: string) {
  // Never let a value span lines; single quotes can't be escaped in .env, so drop them.
  const clean = v.replace(/[\r\n]+/g, " ").replace(/'/g, "");
  return /[\s#"`]/.test(clean) ? `'${clean}'` : clean;
}

// Loaded by name so the browser build never bundles Node's modules.
async function writeDotEnv(values: Record<string, string>) {
  const [fsName, pathName] = ["node:fs/promises", "node:path"];
  const fs: typeof import("node:fs/promises") = await import(
    /* @vite-ignore */ fsName
  );
  const path: typeof import("node:path") = await import(
    /* @vite-ignore */ pathName
  );
  const file = path.join(process.cwd(), ".env");
  const text = await fs.readFile(file, "utf8").catch(() => "");
  const lines = text
    ? text.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n")
    : [];
  for (const [key, value] of Object.entries(values)) {
    const line = `${key}=${quote(value)}`;
    const at = lines.findIndex((l) => new RegExp(`^\\s*${key}\\s*=`).test(l));
    if (at >= 0) lines[at] = line;
    else lines.push(line);
  }
  await fs.writeFile(file, lines.join("\n") + "\n", "utf8");
}
