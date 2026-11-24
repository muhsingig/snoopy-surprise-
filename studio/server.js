/*
  Gift Studio: a small local server for making personalised copies of the
  Snoopy gift. Run "Make a Gift.bat" (or: node studio/server.js) and it opens
  http://localhost:5191/studio/ in your browser.

  It serves the site itself (so previews work), saves each gift into
  gifts/<link-name>/, and "Publish" commits + pushes so Vercel redeploys.
  No packages needed, only Node.
*/
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execFile, exec } = require("child_process");

const PORT = Number(process.env.PORT) || 5191;
const ROOT = path.resolve(__dirname, "..");
const GIFTS = path.join(ROOT, "gifts");
const LIVE = "https://snoopy-surprise.vercel.app";
const SLUG = /^[a-z0-9-]{1,48}$/;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json",
  ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon",
};

const git = (args) => new Promise((resolve) => {
  execFile("git", args, { cwd: ROOT, windowsHide: true }, (err, stdout, stderr) =>
    resolve({ ok: !err, out: (stdout + stderr).trim() }));
});

function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

function readBody(req, limit = 40e6) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("Too big")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

function readGift(slug) {
  const file = path.join(GIFTS, slug, "gift.js");
  if (!fs.existsSync(file)) return null;
  const src = fs.readFileSync(file, "utf8");
  const start = src.indexOf("{"), end = src.lastIndexOf("}");
  return JSON.parse(src.slice(start, end + 1));
}

async function status(slug) {
  const rel = `gifts/${slug}`;
  const s = await git(["status", "--porcelain", "--", rel]);
  if (s.out.startsWith("??")) return "draft";
  if (s.out) return "changed";
  const live = await git(["ls-tree", "--name-only", "origin/main", "--", `${rel}/gift.js`]);
  return live.out ? "live" : "draft";
}

async function listGifts() {
  if (!fs.existsSync(GIFTS)) return [];
  const out = [];
  for (const slug of fs.readdirSync(GIFTS)) {
    if (!SLUG.test(slug)) continue;
    try {
      const g = readGift(slug);
      if (!g) continue;
      const mtime = fs.statSync(path.join(GIFTS, slug, "gift.js")).mtimeMs;
      out.push({ slug, name: g.name, tone: g._tone || "", status: await status(slug), mtime, url: `${LIVE}/${slug}` });
    } catch { /* skip broken folders */ }
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}

function saveGift(slug, gift) {
  const dir = path.join(GIFTS, slug);
  fs.mkdirSync(dir, { recursive: true });
  const photoGift = (gift.gifts || []).find((g) => g.type === "photos");
  const keep = new Set();
  if (photoGift) {
    const stamp = Date.now();
    photoGift.photos = (photoGift.photos || []).map((p, i) => {
      const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(p || "");
      if (m) {
        const ext = m[1] === "jpeg" ? "jpg" : m[1];
        const name = `photo-${i + 1}-${stamp}.${ext}`;
        fs.writeFileSync(path.join(dir, name), Buffer.from(m[2], "base64"));
        keep.add(name);
        return `gifts/${slug}/${name}`;
      }
      if (typeof p === "string" && p.startsWith(`gifts/${slug}/`)) keep.add(p.split("/").pop());
      if (typeof p === "string" && (p.startsWith(`gifts/${slug}/`) || /^assets\/photo-\d\.jpg$/.test(p))) return p;
      return `assets/photo-${i + 1}.jpg`;
    });
  }
  // remove photos this gift no longer uses
  for (const f of fs.readdirSync(dir)) {
    if (/^photo-.*\.(jpg|png|webp)$/.test(f) && !keep.has(f)) fs.unlinkSync(path.join(dir, f));
  }
  const body = `/* Made in Gift Studio. Opens at ${LIVE}/${slug} */\nwindow.GIFT = ${JSON.stringify(gift, null, 2)};\n`;
  fs.writeFileSync(path.join(dir, "gift.js"), body);
  return gift;
}

async function publish(slug) {
  const branch = await git(["rev-parse", "--abbrev-ref", "HEAD"]);
  if (branch.out !== "main") return { ok: false, log: `This folder is on branch "${branch.out}", not main, so it can't publish.` };
  const log = [];
  const add = await git(["add", "-A"]); log.push(add.out);
  const staged = await git(["diff", "--cached", "--quiet"]);
  if (!staged.ok) {
    const c = await git(["commit", "-m", `Gift: ${slug}`]);
    log.push(c.out);
    if (!c.ok) return { ok: false, log: log.join("\n") };
  }
  const p = await git(["push", "origin", "main"]);
  log.push(p.out);
  return { ok: p.ok, log: log.filter(Boolean).join("\n"), url: `${LIVE}/${slug}` };
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath);
  if (rel.endsWith("/")) rel += "index.html";
  let file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep) || file.includes(`${path.sep}.git`)) return send(res, 403, "Forbidden", "text/plain");
  // same rule as vercel.json: /<link-name> shows the site
  if (!fs.existsSync(file) && SLUG.test(rel.replace(/^\//, ""))) file = path.join(ROOT, "index.html");
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, "Not found", "text/plain");
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const parts = url.pathname.split("/").filter(Boolean);
  try {
    if (parts[0] === "api") {
      if (req.method === "GET" && parts[1] === "gifts" && !parts[2]) return send(res, 200, await listGifts());
      const slug = parts[2];
      if (!slug || !SLUG.test(slug)) return send(res, 400, { error: "Bad link name" });
      if (req.method === "GET" && parts[1] === "gifts") {
        const g = readGift(slug);
        return g ? send(res, 200, { gift: g, status: await status(slug) }) : send(res, 404, { error: "No gift with that link" });
      }
      if (req.method === "POST" && parts[1] === "gifts") {
        const { gift } = await readBody(req);
        if (!gift || typeof gift !== "object" || !Array.isArray(gift.gifts)) return send(res, 400, { error: "Missing gift" });
        return send(res, 200, { gift: saveGift(slug, gift), status: await status(slug) });
      }
      if (req.method === "POST" && parts[1] === "publish") return send(res, 200, await publish(slug));
      return send(res, 404, { error: "Unknown endpoint" });
    }
    if (url.pathname === "/" + "studio") { res.writeHead(302, { Location: "/studio/" }); return res.end(); }
    serveStatic(req, res, url.pathname);
  } catch (e) {
    send(res, 500, { error: String(e.message || e) });
  }
});

server.on("error", (e) => {
  if (e.code === "EADDRINUSE") {
    console.log(`Gift Studio is already running. Open http://localhost:${PORT}/studio/`);
    if (!process.env.NO_OPEN && !process.argv.includes("--no-open")) exec(`start "" "http://localhost:${PORT}/studio/"`);
  } else console.error(e);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  Gift Studio is running at http://localhost:${PORT}/studio/`);
  console.log("  Keep this window open while you make gifts. Close it when you're done.\n");
  if (process.platform === "win32" && !process.env.NO_OPEN && !process.argv.includes("--no-open")) exec(`start "" "http://localhost:${PORT}/studio/"`);
});
