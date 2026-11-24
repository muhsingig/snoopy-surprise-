(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const LIVE = "https://snoopy-surprise.vercel.app";

  /* ---------- what the form edits ---------- */
  const SECTIONS = [
    { title: "Who's it for?", fields: [
      { kind: "tone" },
      { label: "Their name", path: "name", kind: "text", ph: "e.g. Riya", hint: "Shows up as “Happy birthday, Riya!”. Anywhere you type {name}, it becomes this." },
      { kind: "slug" },
    ]},
    { title: "Opening", jump: "", fields: [
      { label: "Snoopy's line on the first screen", path: "landing.caption", kind: "text" },
      { label: "Birthday headline", path: "birthday.title", kind: "text" },
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
  let gift, tone, slug, isNew, dirty, previewJump = "";
  let photos = [];          // 3 entries: a saved path or a new data: URL

  const get = (o, p) => p.split(".").reduce((a, k) => (a == null ? a : a[k]), o);
  const set = (o, p, v) => { const ks = p.split("."); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
  const photoGift = () => gift.gifts.find((g) => g.type === "photos");
  const isSample = (p) => /^assets\/photo-\d\.jpg$/.test(p);

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

  /* ---------- build the form ---------- */
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
      wrap.innerHTML = `<span class="label">Their link</span>
        <div class="slug"><span>snoopy-surprise.vercel.app/</span><input id="slug" spellcheck="false"></div>
        <p class="hint">${isNew ? "Made from their name plus 4 random letters so nobody can guess it. You can change it until you save." : "Saved, so this link stays the same."}</p>`;
      const inp = $("input", wrap);
      inp.value = slug || "";
      inp.placeholder = "fills in from their name";
      inp.disabled = !isNew;
      inp.addEventListener("input", () => {
        inp.value = inp.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").slice(0, 48);
        slug = inp.value; inp.dataset.touched = "1"; markDirty();
      });
      return wrap;
    }

    if (f.kind === "photos") {
      wrap.innerHTML = `<span class="label">Three photos of you two</span><div class="photos"></div>
        <p class="hint">Tap a square to pick a photo (JPG or PNG). Square-ish photos fit best.</p>`;
      const row = $(".photos", wrap);
      photos.forEach((src, i) => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "photo" + (isSample(src) ? " is-sample" : "");
        b.innerHTML = `<img src="${src.startsWith("data:") ? src : "/" + src}" alt="Photo ${i + 1}"><span>${isSample(src) ? "+ Add photo" : "Change"}</span>`;
        const file = document.createElement("input");
        file.type = "file"; file.accept = "image/*"; file.hidden = true;
        file.addEventListener("change", async () => {
          if (!file.files[0]) return;
          try { photos[i] = await shrink(file.files[0]); markDirty(); render(); }
          catch { alert("That photo couldn't be opened. Try a JPG or PNG (iPhone HEIC photos: take a screenshot of it, or export as JPG)."); }
        });
        b.addEventListener("click", () => file.click());
        row.append(b, file);
      });
      return wrap;
    }

    if (f.kind === "bouquet") {
      const fg = gift.gifts[1];
      const src = fg.bouquet ? (fg.bouquet.startsWith("data:") ? fg.bouquet : "/" + fg.bouquet) : "/assets/snoopy-bouquet.webp";
      wrap.innerHTML = `<span class="label">Flower picture</span>
        <div class="bouquet-pick">
          <div class="bouquet-ring${fg.bouquet && fg.bouquetFit === "cover" ? " is-fill" : ""}"><img src="${src}" alt=""></div>
          <div class="bouquet-btns">
            <button type="button" class="btn btn--ghost" data-act="upload">${fg.bouquet ? "Change picture" : "Use their favourite flowers"}</button>
            ${fg.bouquet ? `<button type="button" class="linkish" data-act="reset">Go back to Snoopy's red flowers</button>` : ""}
          </div>
        </div>
        <p class="hint">Lilies, sunflowers, anything. A cut-out picture (PNG with a see-through background) sits inside the circle like Snoopy does; a normal photo fills the circle.</p>`;
      const file = document.createElement("input");
      file.type = "file"; file.accept = "image/*"; file.hidden = true;
      wrap.appendChild(file);
      file.addEventListener("change", async () => {
        if (!file.files[0]) return;
        try {
          const { url, transparent } = await shrinkBouquet(file.files[0]);
          fg.bouquet = url; fg.bouquetFit = transparent ? "contain" : "cover";
          markDirty(); render();
        } catch { alert("That picture couldn't be opened. Try a JPG or PNG."); }
      });
      $('[data-act="upload"]', wrap).addEventListener("click", () => file.click());
      $('[data-act="reset"]', wrap)?.addEventListener("click", () => {
        delete fg.bouquet; delete fg.bouquetFit; markDirty(); render();
      });
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
      if (f.kind === "lines") v = v.split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 10);
      if (f.kind === "paras") v = v.split(/\n\s*\n/).map((s) => s.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
      if (f.kind === "textarea") v = v.replace(/\r/g, "");
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
        if (s && !s.dataset.touched) { slug = inp.value.trim() ? makeSlug(inp.value) : ""; s.value = slug; }
      }
      markDirty();
    });
    if (f.kind === "lines") {
      inp.addEventListener("input", () => {
        const n = inp.value.split("\n").filter((s) => s.trim()).length;
        hint.textContent = n > 10 ? `Only the first 10 show (you have ${n}).` : f.hint;
        hint.classList.toggle("is-bad", n > 10);
      });
    }
    return wrap;
  }

  /* ---------- photos: shrink before upload ---------- */
  function shrink(file, max = 1200) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.86));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
      img.src = url;
    });
  }

  // flower picture: keep a see-through background if it has one
  function shrinkBouquet(file, max = 800) {
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
        const px = x.getImageData(0, 0, c.width, c.height).data;
        let clear = 0;
        for (let i = 3; i < px.length; i += 16) if (px[i] < 200) clear++;
        const transparent = clear > px.length / 16 * 0.02;   // >2% see-through
        let url;
        if (transparent) {
          url = c.toDataURL("image/webp", 0.9);
          if (!url.startsWith("data:image/webp")) url = c.toDataURL("image/png");
        } else url = c.toDataURL("image/jpeg", 0.88);
        resolve({ url, transparent });
      };
      img.onerror = () => { URL.revokeObjectURL(u); reject(new Error("bad image")); };
      img.src = u;
    });
  }

  /* ---------- tone switch ---------- */
  function switchTone(key) {
    if (key === tone) return;
    if (dirty && !confirm(`Swap the wording for the ${TEMPLATES[key].label.toLowerCase()} version? Their name, link, photos, flower picture and song stay; the rest of the text is replaced.`)) return;
    const keep = { name: gift.name, yt: gift.gifts[2].youtubeId, label: gift.gifts[2].songLabel, b: gift.gifts[1].bouquet, bf: gift.gifts[1].bouquetFit };
    gift = TEMPLATES[key].build();
    gift.name = keep.name; gift.gifts[2].youtubeId = keep.yt; gift.gifts[2].songLabel = keep.label;
    if (keep.b) { gift.gifts[1].bouquet = keep.b; gift.gifts[1].bouquetFit = keep.bf; }
    tone = key; gift._tone = key;
    markDirty(); render();
  }

  /* ---------- status bar ---------- */
  function markDirty() { dirty = true; updateBar(); }
  function updateBar(state) {
    const who = gift.name ? `Gift for ${gift.name}` : "New gift";
    const text = state || (dirty ? "unsaved changes" : isNew ? "not saved" : "saved");
    $("#bar-status").innerHTML = `<b>${esc(who)}</b> · ${esc(text)}`;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- preview ---------- */
  const frame = $("#preview");
  function jumpTo(h) {
    previewJump = h;
    document.querySelectorAll("#jumps button").forEach((b) => b.classList.toggle("is-on", b.dataset.jump === h));
    refreshPreview();
  }
  function refreshPreview() {
    const ready = slug && !isNew;
    $("#preview-empty").hidden = !!ready;
    frame.hidden = !ready;
    if (ready) frame.src = `/?for=${slug}&t=${Date.now()}${previewJump ? "#" + previewJump : ""}`;
  }
  document.querySelectorAll("#jumps button").forEach((b) => b.addEventListener("click", () => jumpTo(b.dataset.jump)));

  /* ---------- load / save / publish ---------- */
  function startNew() {
    tone = "bestie";
    gift = TEMPLATES[tone].build(); gift._tone = tone;
    slug = ""; isNew = true; dirty = false;
    photos = photoGift().photos.slice(0, 3);
    render(); updateBar(); refreshPreview(); highlightSaved();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function load(s) {
    form.inert = true; form.style.opacity = ".5";
    const r = await fetch(`/api/gifts/${s}`).finally(() => { form.inert = false; form.style.opacity = ""; });
    if (!r.ok) return alert("Couldn't open that gift.");
    const data = await r.json();
    gift = data.gift; tone = gift._tone || "bestie"; slug = s; isNew = false; dirty = false;
    photos = photoGift().photos.slice(0, 3);
    while (photos.length < 3) photos.push(`assets/photo-${photos.length + 1}.jpg`);
    render(); updateBar(statusText(data.status)); refreshPreview(); highlightSaved();
  }

  const statusText = (s) => ({ draft: "saved, not sent yet", changed: "saved, changes not published", live: "live" }[s] || "saved");

  async function save() {
    if (!gift.name || !gift.name.trim()) { alert("Type their name first."); $("#f-name")?.focus(); return false; }
    if (!slug || !/^[a-z0-9-]{1,48}$/.test(slug)) { alert("Their link can only use lowercase letters, numbers and dashes."); return false; }
    if (isNew) {
      const list = await (await fetch("/api/gifts")).json();
      if (list.some((g) => g.slug === slug)) { alert("You already have a gift with that link. Change the link a little."); return false; }
    }
    photoGift().photos = photos.slice();
    updateBar("saving…");
    const r = await fetch(`/api/gifts/${slug}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gift }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) { alert("Saving failed: " + (data.error || r.status)); updateBar(); return false; }
    gift = data.gift; photos = photoGift().photos.slice(0, 3);
    isNew = false; dirty = false;
    render(); updateBar(statusText(data.status)); refreshPreview(); loadList();
    return true;
  }

  async function publish() {
    if ((dirty || isNew) && !(await save())) return;
    const samples = photos.filter(isSample).length;
    if (samples && !confirm(`${samples} of the photos are still the sample dog pictures. Publish anyway?`)) return;
    const btn = $("#publish");
    btn.disabled = true; btn.textContent = "Publishing…";
    try {
      const r = await fetch(`/api/publish/${slug}`, { method: "POST" });
      const data = await r.json();
      showDone(data);
      loadList();
      if (data.ok) updateBar("live in about a minute");
    } catch (e) {
      showDone({ ok: false, log: String(e) });
    } finally {
      btn.disabled = false; btn.textContent = "Publish & get link";
    }
  }

  function showDone(data) {
    const dlg = $("#done");
    const url = data.url || `${LIVE}/${slug}`;
    $("#done-title").textContent = data.ok ? "It's on its way!" : "Publishing didn't work";
    $("#done-text").textContent = data.ok
      ? "Give it about a minute to go live, then send this link:"
      : "Your gift is saved on this computer, but it couldn't be pushed online. The details are below.";
    $("#done-link").value = url;
    $("#open-link").href = url;
    $("#wa-link").href = "https://wa.me/?text=" + encodeURIComponent(`Snoopy has something for you 🎁 ${url}`);
    $(".linkbox", dlg).hidden = !data.ok;
    $(".done-actions", dlg).querySelectorAll("a").forEach((a) => (a.hidden = !data.ok));
    const log = $("#done-log");
    log.hidden = data.ok; log.textContent = data.log || "";
    dlg.showModal();
  }
  $("#copy-link").addEventListener("click", async () => {
    const v = $("#done-link").value;
    try { await navigator.clipboard.writeText(v); } catch { $("#done-link").select(); document.execCommand("copy"); }
    $("#copy-link").textContent = "Copied!";
    setTimeout(() => ($("#copy-link").textContent = "Copy"), 1500);
  });
  $("#close-done").addEventListener("click", () => $("#done").close());

  /* ---------- saved gifts list ---------- */
  let savedCache = [];
  async function loadList() {
    try { savedCache = await (await fetch("/api/gifts")).json(); } catch { savedCache = []; }
    const box = $("#saved-list");
    if (!savedCache.length) { box.innerHTML = `<p class="muted">Nothing saved yet. Fill in the form below to make your first one.</p>`; return; }
    box.innerHTML = "";
    savedCache.forEach((g) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.dataset.slug = g.slug;
      b.innerHTML = `<b>${esc(g.name || g.slug)}</b><span class="pill pill--${g.status}">${{ draft: "not sent", changed: "edited", live: "live" }[g.status] || g.status}</span>`;
      b.addEventListener("click", () => {
        if (g.slug === slug) return;
        if (dirty && !confirm("You have unsaved changes. Leave them?")) return;
        load(g.slug);
      });
      box.appendChild(b);
    });
    highlightSaved();
  }
  function highlightSaved() {
    document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-on", c.dataset.slug === slug && !isNew));
  }

  $("#new-gift").addEventListener("click", () => {
    if (dirty && !confirm("You have unsaved changes. Start a new gift anyway?")) return;
    startNew();
  });
  $("#save").addEventListener("click", save);
  $("#publish").addEventListener("click", publish);
  form.addEventListener("submit", (e) => e.preventDefault());
  window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
  document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); } });

  startNew();
  loadList();
})();
