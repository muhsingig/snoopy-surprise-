/*
  Turns a gift saved in the online Gift Studio (claude.ai artifact db doc
  gifts/<link-name>) into gifts/<link-name>/ in this repo.

    node studio/import-online.js <doc.json> <folder with downloaded assets>

  doc.json is the db document ({slug, name, gift, ...}). Pictures in the gift
  are "asset:<id>"; each must be downloaded into the folder as <id>.<ext>.
  Prints the live URL. Commit + push afterwards to put it live.
*/
const fs = require("fs");
const path = require("path");

const [docFile, assetDir] = process.argv.slice(2);
if (!docFile || !assetDir) { console.error("usage: node studio/import-online.js <doc.json> <assets folder>"); process.exit(1); }

const ROOT = path.resolve(__dirname, "..");
const LIVE = "https://snoopy-surprise.vercel.app";
const raw = JSON.parse(fs.readFileSync(docFile, "utf8"));
const doc = raw.data && raw.data.gift ? raw.data : raw;
const slug = doc.slug;
if (!/^[a-z0-9-]{1,48}$/.test(slug || "")) { console.error("bad link name: " + slug); process.exit(1); }
const gift = doc.gift;
if (!gift || !Array.isArray(gift.gifts)) { console.error("doc has no gift"); process.exit(1); }

const dir = path.join(ROOT, "gifts", slug);
fs.mkdirSync(dir, { recursive: true });
const files = fs.readdirSync(assetDir);
const stamp = Date.now();
const keep = new Set();

function bring(ref, base) {
  const id = ref.slice(6);
  const hit = files.find((f) => f.startsWith(id));
  if (!hit) throw new Error(`asset ${id} not downloaded into ${assetDir}`);
  let ext = path.extname(hit).toLowerCase().replace(".jpeg", ".jpg") || ".jpg";
  const name = `${base}-${stamp}${ext}`;
  fs.copyFileSync(path.join(assetDir, hit), path.join(dir, name));
  keep.add(name);
  return `gifts/${slug}/${name}`;
}

const photoGift = gift.gifts.find((g) => g.type === "photos");
if (photoGift) {
  photoGift.photos = (photoGift.photos || []).slice(0, 3).map((p, i) =>
    typeof p === "string" && p.startsWith("asset:") ? bring(p, `photo-${i + 1}`)
      : /^assets\/photo-\d\.jpg$/.test(p) ? p : `assets/photo-${i + 1}.jpg`);
}
const flowerGift = gift.gifts.find((g) => g.type === "flowers");
if (flowerGift) {
  if (typeof flowerGift.bouquet === "string" && flowerGift.bouquet.startsWith("asset:")) flowerGift.bouquet = bring(flowerGift.bouquet, "bouquet");
  else { delete flowerGift.bouquet; delete flowerGift.bouquetFit; }
}
gift.name = String(gift.name || doc.name || "").trim();
if (!gift._tone && doc.tone) gift._tone = doc.tone;

for (const f of fs.readdirSync(dir)) {
  if (/^(photo|bouquet)-.*\.(jpg|png|webp)$/.test(f) && !keep.has(f)) fs.unlinkSync(path.join(dir, f));
}
fs.writeFileSync(path.join(dir, "gift.js"),
  `/* Made in the online Gift Studio. Opens at ${LIVE}/${slug} */\nwindow.GIFT = ${JSON.stringify(gift, null, 2)};\n`);
console.log(`${LIVE}/${slug}`);
