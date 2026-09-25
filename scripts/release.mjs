// Publishes the version in package.json: checks, tags, pushes, and creates the
// GitHub release from that version's section of CHANGELOG.md.
// Bump "version" in package.json and add a "## vX.Y.Z" section to CHANGELOG.md
// first, commit them, then run: npm run release
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = (cmd, quiet = false) =>
  execSync(cmd, { stdio: quiet ? "pipe" : "inherit", encoding: "utf8" });
const out = (cmd) => execSync(cmd, { encoding: "utf8" }).trim();
const fail = (msg) => {
  console.error(`\n✗ ${msg}`);
  process.exit(1);
};

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const tag = `v${version}`;

if (out("git status --porcelain"))
  fail("有未提交的改动，请先提交。 / Commit your changes first.");
if (out("git rev-parse --abbrev-ref HEAD") !== "main")
  fail("请在 main 分支上发布。 / Release from the main branch.");
if (out(`git tag --list ${tag}`))
  fail(
    `${tag} 已经存在。请先在 package.json 里升版本号。 / ${tag} already exists.`,
  );
// Checked before anything is pushed, so a failure leaves nothing half-done.
try {
  run("gh auth status", true);
} catch {
  fail(
    "需要安装并登录 GitHub CLI（gh auth login）。 / Install the gh CLI and run gh auth login.",
  );
}
run("git fetch origin main --tags", true);
if (out("git rev-list --count HEAD..origin/main") !== "0")
  fail(
    "GitHub 上有本地没有的提交，请先 git pull。 / origin/main has commits you don't; pull first.",
  );
if (out(`git ls-remote --tags origin refs/tags/${tag}`))
  fail(`GitHub 上已经有 ${tag}。 / ${tag} already exists on GitHub.`);

const changelog = readFileSync("CHANGELOG.md", "utf8");
const start = changelog.indexOf(`## ${tag}`);
if (start < 0)
  fail(
    `CHANGELOG.md 里没有「## ${tag}」这一节。 / Add a "## ${tag}" section to CHANGELOG.md.`,
  );
const next = changelog.indexOf("\n## v", start + 1);
const section = changelog.slice(start, next < 0 ? undefined : next).trim();
const title = section.split("\n")[0].replace(/^##\s*/, "");
const notes = section.split("\n").slice(1).join("\n").trim();
if (!notes)
  fail(`CHANGELOG.md 里 ${tag} 这一节是空的。 / The ${tag} section is empty.`);

console.log(`发布 / Releasing ${tag}\n`);
run("npm test");
run("npm run build");

run(`git tag -a ${tag} -m "${title.replace(/"/g, "'")}"`);
run("git push origin main");
run(`git push origin ${tag}`);

const file = join(mkdtempSync(join(tmpdir(), "release-")), "notes.md");
writeFileSync(file, notes);
try {
  run(
    `gh release create ${tag} --title "${title.replace(/"/g, "'")}" --notes-file "${file}" --latest`,
  );
} catch {
  fail(
    `标签已推送，但创建 GitHub Release 失败（需要安装并登录 gh）。可以在 GitHub 网页上手动创建。 / Tag pushed, but creating the GitHub release failed (needs the gh CLI, logged in).`,
  );
}
console.log(`\n✓ ${tag} 已发布 / released`);
