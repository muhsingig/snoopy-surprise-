/*
  Online Gift Studio (runs as a claude.ai artifact page).
  Gifts are saved in the artifact's db at gifts/<link-name>; photos are
  uploaded as artifact assets and kept in the gift as "asset:<id>".
  "Ready for link" marks a gift status "ready"; Claude then builds
  gifts/<link-name>/ in the repo, pushes, and writes back status "live".
*/
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const LIVE = "https://snoopy-surprise.vercel.app";

  const SECTIONS = [
    { title: "Who's it for?", fields: [
      { kind: "tone" },
      { label: "Their name", path: "name", kind: "text", ph: "e.g. Riya", hint: "Shows up as “Happy birthday, Riya!”. Anywhere you type {name}, it becomes their name." },
      { kind: "slug" },
    ]},
    { title: "Opening", jump: "", fields: [
      { label: "Snoopy's line on the first screen", path: "landing.caption", kind: "text" },
      { label: "Birthday headline", path: "birthday.title", kind: "text", hint: "Keep {name} in it to show their name." },
    ]},
    { title: "Gift 1 · Cake", jump: "gift-0", fields: [
      { label: "Title", path: "gifts.0.title", kind: "text" },
      { label: "After the candles are blown", path: "gifts.0.doneTitle", kind: "text" },
      { label: "Small line under it", path: "gifts.0.doneHint", kind: "text" },
    ]},
    { title: "Gift 2 · Flowers", jump: "gift-1", fields: [
      { label: "Title", path: "gifts.1.title", kind: "text" },
      { label: "Subtitle", path: "gifts.1.subtitle", kind: "text" },
      { kind: "bouquet" },
      { label: "Little things you love about them", path: "gifts.1.notes", kind: "lines", rows: 10, hint: "One per line, up to 10. Short ones look best." },
    ]},
    { title: "Gift 3 · Song", jump: "gift-2", fields: [
      { label: "YouTube link", path: "gifts.2.youtubeId", kind: "youtube", ph: "Paste a YouTube link", hint: "Any YouTube link works: youtube.com/watch?v=…, youtu.be/…, or Shorts." },
      { label: "Song · artist", path: "gifts.2.songLabel", kind: "text" },
      { label: "Why it reminds you of them", path: "gifts.2.note", kind: "textarea", rows: 4 },
    ]},
    { title: "Gift 4 · Photos", jump: "gift-3", fields: [
      { kind: "photos" },
      { label: "Caption", path: "gifts.3.title", kind: "text" },
    ]},
    { title: "Gift 5 · Letter", jump: "gift-4", fields: [
      { label: "Heading", path: "gifts.4.title", kind: "text" },
      { label: "Your letter", path: "gifts.4.paragraphs", kind: "paras", rows: 12, hint: "Leave an empty line between paragraphs." },
      { label: "Sign-off", path: "gifts.4.signoff", kind: "textarea", rows: 2 },
    ]},
  ];

  /* ---------- state ---------- */
  let db = null, assets = null;
  let gift, tone, slug, isNew, dirty, previewJump = "";
  let photos = [];                 // "asset:<id>", "assets/photo-N.jpg" or a new data: URL
  let current = null;              // the saved doc for the open gift
  let saved = [];                  // all saved gift docs
  const blobs = new Map();         // data: URL -> Blob waiting to upload

  const get = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  const set = (o, p, v) => { const ks = p.split("."); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const isSample = (p) => /^assets\/photo-\d\.jpg$/.test(p);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const srcOf = (p) => (!p ? "" : p.startsWith("asset:") ? "/_blob/" + p.slice(6) : p);
  const flowers = () => gift.gifts[1];
  const photoGift = () => gift.gifts[3];

  function makeSlug(name) {
    const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "gift";
    return base + "-" + Math.random().toString(36).slice(2, 6);
  }
  function youtubeId(v) {
    v = (v || "").trim();
    const m = v.match(/(?:youtu\.be\/|v=|shorts\/|embed\/|live\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    return /^[A-Za-z0-9_-]{11}$/.test(v) ? v : "";
  }

  /* ---------- small UI helpers (the viewer blocks alert/confirm) ---------- */
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3200);
  }
  function ask(title, text, yes = "Yes") {
    return new Promise((resolve) => {
      const d = $("#ask");
      $("#ask-title").textContent = title; $("#ask-text").textContent = text; $("#ask-yes").textContent = yes;
      const done = (v) => { d.close(); $("#ask-yes").onclick = $("#ask-no").onclick = null; resolve(v); };
      $("#ask-yes").onclick = () => done(true);
      $("#ask-no").onclick = () => done(false);
      d.oncancel = () => done(false);
      d.showModal();
    });
  }
  async function copy(input, btn) {
    try { await navigator.clipboard.writeText(input.value); } catch { input.select(); }
    btn.textContent = "Copied!"; setTimeout(() => (btn.textContent = "Copy"), 1500);
  }

  /* ---------- form ---------- */
  const form = $("#editor");
  function render() {
    form.innerHTML = "";
    SECTIONS.forEach((sec) => {
      const box = document.createElement("fieldset");
      box.className = "sec";
      box.innerHTML = `<legend>${sec.title}</legend>`;
      if (sec.jump != null) {
        const pv = document.createElement("button");
        pv.type = "button"; pv.className = "sec-peek"; pv.textContent = "preview this";
        pv.addEventListener("click", () => jumpTo(sec.jump));
        box.appendChild(pv);
      }
      sec.fields.forEach((f) => box.appendChild(field(f)));
      form.appendChild(box);
    });
  }

  function imagePicker(onPick) {
    const file = document.createElement("input");
    file.type = "file"; file.accept = "image/*"; file.hidden = true;
    file.addEventListener("change", async () => {
      const f = file.files[0]; file.value = "";
      if (!f) return;
      try { await onPick(f); } catch { toast("That picture couldn't be opened. Try a JPG or PNG (for iPhone HEIC photos, use a screenshot)."); }
    });
    return file;
  }

  function field(f) {
    const wrap = document.createElement("div");
    wrap.className = "field";

    if (f.kind === "tone") {
      wrap.innerHTML = `<span class="label">Who are they to you?</span><div class="tones"></div>
        <p class="hint">Picks the starting wording. You can change every line below.</p>`;
      Object.entries(TEMPLATES).forEach(([key, t]) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "tone" + (key === tone ? " is-on" : ""); b.textContent = t.label;
        b.addEventListener("click", () => switchTone(key));
        $(".tones", wrap).appendChild(b);
      });
      return wrap;
    }

    if (f.kind === "slug") {
      wrap.innerHTML = `<label class="label" for="slug">Their link</label>
        <div class="slug"><span>snoopy-surprise.vercel.app/</span><input id="slug" spellcheck="false"></div>
        <p class="hint">${isNew ? "Made from their name plus 4 random letters so nobody can guess it. You can change it until you save." : "Saved, so this link stays the same."}</p>`;
      const inp = $("input", wrap);
      inp.value = slug || ""; inp.placeholder = "fills in from their name"; inp.disabled = !isNew;
      inp.addEventListener("input", () => {
        inp.value = inp.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 48);
        slug = inp.value; inp.dataset.touched = "1"; markDirty(false);
      });
      return wrap;
    }

    if (f.kind === "photos") {
      wrap.innerHTML = `<span class="label">Three photos of you two</span><div class="photos"></div>
        <p class="hint">${assets ? "Tap a square to pick a photo (JPG or PNG). Square-ish photos fit best." : "Only the artifact's owner or editors can add photos."}</p>`;
      const row = $(".photos", wrap);
      photos.forEach((src, i) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "photo" + (isSample(src) ? " is-sample" : "");
        b.disabled = !assets;
        b.innerHTML = `<img src="${esc(srcOf(src))}" alt="Photo ${i + 1}"><span>${isSample(src) ? "+ Add photo" : "Change"}</span>`;
        const file = imagePicker(async (fl) => {
          const { url, blob } = await shrink(fl, 1200, false);
          blobs.set(url, blob); photos[i] = url; markDirty(); render();
        });
        b.addEventListener("click", () => file.click());
        row.append(b, file);
      });
      return wrap;
    }

    if (f.kind === "bouquet") {
      const fg = flowers();
      const src = fg.bouquet ? srcOf(fg.bouquet) : "assets/snoopy-bouquet.webp";
      wrap.innerHTML = `<span class="label">Flower picture</span>
        <div class="bouquet-pick">
          <div class="bouquet-ring${fg.bouquet && fg.bouquetFit === "cover" ? " is-fill" : ""}"><img src="${esc(src)}" alt=""></div>
          <div class="bouquet-btns">
            <button type="button" class="btn btn--ghost" data-act="upload"${assets ? "" : " disabled"}>${fg.bouquet ? "Change picture" : "Use their favourite flowers"}</button>
            ${fg.bouquet ? `<button type="button" class="linkish" data-act="reset">Go back to Snoopy's red flowers</button>` : ""}
          </div>
        </div>
        <p class="hint">Lilies, sunflowers, anything. A cut-out picture (PNG with a see-through background) sits inside the circle like Snoopy does; a normal photo fills the circle.</p>`;
      const file = imagePicker(async (fl) => {
        const { url, blob, transparent } = await shrink(fl, 800, true);
        blobs.set(url, blob);
        fg.bouquet = url; fg.bouquetFit = transparent ? "contain" : "cover";
        markDirty(); render();
      });
      wrap.appendChild(file);
      $('[data-act="upload"]', wrap).addEventListener("click", () => file.click());
      $('[data-act="reset"]', wrap)?.addEventListener("click", () => { delete fg.bouquet; delete fg.bouquetFit; markDirty(); render(); });
      return wrap;
    }

    const id = "f-" + f.path.replace(/\./g, "-");
    const value = get(gift, f.path);
    let shown = value;
    if (f.kind === "lines") shown = (value || []).join("\n");
    if (f.kind === "paras") shown = (value || []).join("\n\n");
    if (f.kind === "youtube") shown = value ? "https://youtu.be/" + value : "";

    wrap.innerHTML = `<label class="label" for="${id}">${f.label}</label>`;
    const multi = ["textarea", "lines", "paras"].includes(f.kind);
    const inp = document.createElement(multi ? "textarea" : "input");
    inp.id = id;
    if (multi) inp.rows = f.rows || 3;
    if (f.ph) inp.placeholder = f.ph;
    inp.value = shown ?? "";
    wrap.appendChild(inp);
    const hint = document.createElement("p");
    hint.className = "hint"; hint.textContent = f.hint || "";
    if (f.hint || f.kind === "youtube") wrap.appendChild(hint);

    inp.addEventListener("input", () => {
      let v = inp.value;
      if (f.kind === "lines") {
        const all = v.split("\n").map((s) => s.trim()).filter(Boolean);
        hint.textContent = all.length > 10 ? `Only the first 10 show (you have ${all.length}).` : f.hint;
        hint.classList.toggle("is-bad", all.length > 10);
        v = all.slice(0, 10);
      }
      if (f.kind === "paras") v = v.split(/\n\s*\n/).map((s) => s.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
      if (f.kind === "textarea") v = v.replace(/\r/g, "");
      if (f.kind === "text") v = f.path === "name" ? v.replace(/\s+/g, " ").replace(/^\s+/, "") : v;
      if (f.kind === "youtube") {
        const yid = youtubeId(v);
        hint.textContent = v && !yid ? "That doesn't look like a YouTube link yet." : f.hint;
        hint.classList.toggle("is-bad", !!v && !yid);
        if (!yid) return;
        v = yid;
      }
      set(gift, f.path, v);
      if (f.path === "name" && isNew) {
        const s = $("#slug");
        if (s && !s.dataset.touched) { slug = inp.value.trim() ? makeSlug(inp.value.trim()) : ""; s.value = slug; }
      }
      markDirty();
    });
    return wrap;
  }

  /* ---------- pictures: shrink before upload ---------- */
  function shrink(file, max, keepAlpha) {
    return new Promise((resolve, reject) => {
      const u = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        const x = c.getContext("2d");
        x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        let transparent = false;
        if (keepAlpha) {
          const px = x.getImageData(0, 0, c.width, c.height).data;
          let clear = 0;
          for (let i = 3; i < px.length; i += 16) if (px[i] < 200) clear++;
          transparent = clear > (px.length / 16) * 0.02;
        }
        const type = transparent ? "image/png" : "image/jpeg";
        const url = c.toDataURL(type, 0.86);
        c.toBlob((blob) => (blob ? resolve({ url, blob, transparent }) : reject(new Error("no blob"))), type, 0.86);
      };
      img.onerror = () => { URL.revokeObjectURL(u); reject(new Error("bad image")); };
      img.src = u;
    });
  }

  /* ---------- tone switch ---------- */
  async function switchTone(key) {
    if (key === tone) return;
    if (dirty && !(await ask(`Use the ${TEMPLATES[key].label.toLowerCase()} wording?`,
      "Their name, link, photos, flower picture and song stay. The rest of the text is replaced.", "Replace wording"))) return;
    const old = gift;
    gift = TEMPLATES[key].build();
    gift.name = old.name;
    gift.gifts[2].youtubeId = old.gifts[2].youtubeId; gift.gifts[2].songLabel = old.gifts[2].songLabel;
    if (old.gifts[1].bouquet) { gift.gifts[1].bouquet = old.gifts[1].bouquet; gift.gifts[1].bouquetFit = old.gifts[1].bouquetFit; }
    tone = key; gift._tone = key;
    markDirty(); render();
  }

  /* ---------- status + link card ---------- */
  const STATUS = { draft: "saved, not sent yet", ready: "waiting for Claude to make the link", live: "live", changed: "live, but your latest edits aren't on the link yet" };
  function markDirty(preview = true) { dirty = true; updateBar(); if (preview) schedulePreview(); }
  function updateBar() {
    const who = gift.name ? `Gift for ${gift.name}` : "New gift";
    const text = dirty ? "unsaved changes" : isNew ? "not saved" : STATUS[current?.status] || "saved";
    $("#bar-status").innerHTML = `<b>${esc(who)}</b> · ${esc(text)}`;
    updateLinkCard();
  }
  function updateLinkCard() {
    const card = $("#linkcard");
    const st = !isNew && current ? current.status : null;
    const url = current?.liveUrl;
    if (!st || (st !== "live" && st !== "changed" && st !== "ready")) { card.hidden = true; return; }
    card.hidden = false;
    card.className = "linkcard linkcard--" + st;
    $("#linkcard-title").textContent = st === "live" ? `${gift.name}'s gift is live` : st === "ready" ? "Waiting for Claude" : "Live, with older text";
    $("#linkcard-text").textContent = st === "live" ? "Send this link:"
      : st === "ready" ? `Tell Claude “make the link for ${gift.name}” in your chat. The link appears here when it's done.`
      : "Your newest edits aren't on the link yet. Click Ready for link, then ask Claude to update it.";
    const show = !!url && st !== "ready";
    $(".linkbox", card).hidden = !show; $(".done-actions", card).hidden = !show;
    if (show) {
      $("#linkcard-url").value = url;
      $("#linkcard-open").href = url;
      $("#linkcard-wa").href = "https://wa.me/?text=" + encodeURIComponent(`Snoopy has something for you 🎁 ${url}`);
    }
  }

  /* ---------- preview ---------- */
  let frame = $("#preview"), previewTimer;
  function previewGift() {
    const g = clone(gift);
    g.gifts[3].photos = photos.map(srcOf);
    if (g.gifts[1].bouquet) g.gifts[1].bouquet = srcOf(g.gifts[1].bouquet);
    return g;
  }
  function refreshPreview() {
    const f = document.createElement("iframe");
    f.id = "preview"; f.title = "Gift preview";
    f.src = "preview.html" + (previewJump ? "#" + previewJump : "");
    frame.replaceWith(f); frame = f;
    $("#song-note").hidden = previewJump !== "gift-2";
  }
  function schedulePreview() { clearTimeout(previewTimer); previewTimer = setTimeout(refreshPreview, 900); }
  window.addEventListener("message", (e) => {
    if (e.source === frame.contentWindow && e.data && e.data.type === "snoopy-preview-ready") {
      frame.contentWindow.postMessage({ type: "snoopy-gift", gift: previewGift() }, "*");
    }
  });
  function jumpTo(h) {
    previewJump = h;
    document.querySelectorAll("#jumps button").forEach((b) => b.classList.toggle("is-on", b.dataset.jump === h));
    refreshPreview();
  }
  document.querySelectorAll("#jumps button").forEach((b) => b.addEventListener("click", () => jumpTo(b.dataset.jump)));

  /* ---------- new / open ---------- */
  function startNew() {
    tone = "bestie";
    gift = TEMPLATES[tone].build(); gift._tone = tone;
    slug = ""; isNew = true; dirty = false; current = null;
    photos = photoGift().photos.slice(0, 3);
    render(); updateBar(); refreshPreview(); highlightSaved();
  }
  function open(doc) {
    current = doc;
    gift = clone(doc.gift); tone = doc.tone || gift._tone || "bestie";
    slug = doc.slug; isNew = false; dirty = false;
    photos = (photoGift().photos || []).slice(0, 3);
    while (photos.length < 3) photos.push(`assets/photo-${photos.length + 1}.jpg`);
    render(); updateBar(); refreshPreview(); highlightSaved();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- save ---------- */
  let saving = false;
  const assetIdsIn = (g) => [...(g.gifts[3].photos || []), g.gifts[1].bouquet || ""].filter((p) => p && p.startsWith("asset:")).map((p) => p.slice(6));

  async function upload(dataUrl) {
    const blob = blobs.get(dataUrl);
    if (!blob) throw new Error("missing picture");
    const r = await assets.upload(blob, { type: blob.type || "image/jpeg" });
    blobs.delete(dataUrl);
    return "asset:" + r.id;
  }

  async function save(nextStatus) {
    if (!db) { toast("Saving needs you signed in to claude.ai with access to this page."); return false; }
    if (saving) return false;
    if (!gift.name || !gift.name.trim()) { toast("Type their name first."); $("#f-name")?.focus(); return false; }
    if (!slug || !/^[a-z0-9-]{1,48}$/.test(slug)) { toast("Their link can only use lowercase letters, numbers and dashes."); return false; }
    if (isNew && saved.some((d) => d.slug === slug)) { toast("You already have a gift with that link. Change the link a little."); return false; }
    saving = true; $("#bar-status").textContent = "Saving…";
    try {
      gift.name = gift.name.trim();
      for (let i = 0; i < photos.length; i++) if (photos[i].startsWith("data:")) photos[i] = await upload(photos[i]);
      if (flowers().bouquet && flowers().bouquet.startsWith("data:")) flowers().bouquet = await upload(flowers().bouquet);
      photoGift().photos = photos.slice();
      const before = current;
      let status = nextStatus || before?.status || "draft";
      if (!nextStatus && (status === "live") && dirty) status = "changed";
      const doc = { slug, name: gift.name, tone, gift: clone(gift), status, updatedAt: Date.now() };
      if (before?.liveUrl) doc.liveUrl = before.liveUrl;
      await db.doc("gifts/" + slug).set(doc);
      // pictures this gift no longer uses
      if (before) {
        const keep = new Set(assetIdsIn(gift));
        for (const id of assetIdsIn(before.gift)) if (!keep.has(id)) assets?.delete(id).catch(() => {});
      }
      current = doc; isNew = false; dirty = false;
      render(); updateBar(); highlightSaved();
      return true;
    } catch (e) {
      const code = e && e.code;
      toast(code === "quota_exceeded" || code === "quota_or_state" ? "Storage is full. Delete an old gift's photos first."
        : code === "too_large" ? "That picture is too big. Try a smaller one."
        : "Saving didn't work. Check your connection and try again.");
      updateBar();
      return false;
    } finally { saving = false; }
  }

  async function markReady() {
    const samples = photos.filter(isSample).length;
    if (samples && !(await ask("Use the sample photos?", `${samples} of the 3 photos are still the sample dog pictures.`, "Yes, that's fine"))) return;
    if (!(await save("ready"))) return;
    $("#ready-msg").value = `Make the link for ${gift.name} (${slug})`;
    $("#readydlg").showModal();
  }

  /* ---------- saved list (live) ---------- */
  function renderList() {
    const box = $("#saved-list");
    if (!saved.length) { box.innerHTML = `<p class="muted">Nothing saved yet. Fill in the form below and click Save.</p>`; return; }
    box.innerHTML = "";
    saved.forEach((d) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.dataset.slug = d.slug;
      const label = { draft: "draft", ready: "waiting", live: "live", changed: "edited" }[d.status] || d.status;
      b.innerHTML = `<b>${esc(d.name || d.slug)}</b><span class="pill pill--${esc(d.status)}">${esc(label)}</span>`;
      b.addEventListener("click", async () => {
        if (d.slug === slug && !isNew) return;
        if (dirty && !(await ask("Leave unsaved changes?", "Your changes to this gift haven't been saved.", "Leave them"))) return;
        open(d);
      });
      box.appendChild(b);
    });
    highlightSaved();
  }
  function highlightSaved() {
    document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-on", c.dataset.slug === slug && !isNew));
  }

  /* ---------- wire up ---------- */
  $("#new-gift").addEventListener("click", async () => {
    if (dirty && !(await ask("Start a new gift?", "Your changes to this gift haven't been saved.", "Start new"))) return;
    startNew();
  });
  $("#save").addEventListener("click", () => save().then((ok) => ok && toast("Saved")));
  $("#ready").addEventListener("click", markReady);
  $("#ready-copy").addEventListener("click", () => copy($("#ready-msg"), $("#ready-copy")));
  $("#ready-close").addEventListener("click", () => $("#readydlg").close());
  $("#linkcard-copy").addEventListener("click", () => copy($("#linkcard-url"), $("#linkcard-copy")));
  form.addEventListener("submit", (e) => e.preventDefault());

  startNew();

  (async () => {
    const claude = window.claude;
    if (!claude || !claude.use) { $("#saved-list").innerHTML = `<p class="muted">Open this page on claude.ai to save gifts.</p>`; return; }
    [db, assets] = await Promise.all([claude.use("db"), claude.use("assets")]);
    if (!db) {
      $("#saved-list").innerHTML = "";
      const n = $("#notice");
      n.textContent = "You can try the form, but saving needs you signed in to claude.ai on the account that owns this page.";
      n.hidden = false;
      return;
    }
    render();
    const slow = setTimeout(() => { if (!saved.length) $("#saved-list").innerHTML = `<p class="muted">Still loading your gifts…</p>`; }, 10000);
    db.collection("gifts").onSnapshot((snap) => {
      if (!snap.metadata.fromCache) clearTimeout(slow);
      saved = snap.docs.filter((d) => d.exists).map((d) => d.data()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      // pick up status changes Claude writes (e.g. ready -> live)
      if (current && !isNew) {
        const fresh = saved.find((d) => d.slug === current.slug);
        if (fresh && (fresh.status !== current.status || fresh.liveUrl !== current.liveUrl)) {
          current = { ...current, status: fresh.status, liveUrl: fresh.liveUrl };
          if (!dirty) current = fresh;
          updateBar();
        }
      }
      renderList();
    }, () => {
      clearTimeout(slow);
      $("#saved-list").innerHTML = `<p class="muted">Your saved gifts couldn't be loaded. Reload the page to try again.</p>`;
    });
  })();
})();
