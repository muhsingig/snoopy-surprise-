(() => {
  const G = window.GIFT;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const FADE = 380;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const get = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), G);

  /* ---------- fill static text from data.js ---------- */
  document.title = G.pageTitle;
  $$("[data-text]").forEach((el) => { el.textContent = get(el.dataset.text) ?? ""; });
  $("#birthday-title").textContent = G.birthday.title.replace("{name}", G.name);

  /* ---------- screen router (crossfade) ---------- */
  let current = null;
  const enterHooks = {};
  function show(id, arg) {
    const next = document.getElementById(id);
    if (!next || next === current) return;
    clearTimers();
    stopMic();
    const prev = current;
    if (prev) {
      prev.classList.remove("is-active");
      setTimeout(() => { if (prev !== current) prev.classList.remove("on"); }, FADE + 40);
    }
    if (enterHooks[id]) enterHooks[id](arg);
    next.scrollTop = 0;
    // restart CSS entrance animations even if the screen is still fading out
    next.classList.remove("on");
    void next.offsetWidth;
    next.classList.add("is-active", "on");
    current = next;
  }

  document.addEventListener("click", (e) => {
    const go = e.target.closest("[data-go]");
    if (go) show(go.dataset.go);
  });

  /* ---------- 1. landing: caption, then Accept, then Decline ---------- */
  let seenCaption = false;
  enterHooks.landing = () => {
    const cap = $("#landing .caption");
    const [acc, dec] = $$("#landing .choices .pill");
    [cap, acc, dec].forEach((el) => el.classList.remove("is-in", "is-out"));
    const showButtons = (start) => {
      later(() => acc.classList.add("is-in"), start);
      later(() => dec.classList.add("is-in"), start + 550);
    };
    if (!seenCaption) {
      seenCaption = true;
      later(() => cap.classList.add("is-in"), 250);
      later(() => cap.classList.add("is-out"), 2900);
      showButtons(3350);
    } else {
      cap.classList.add("is-out");
      showButtons(250);
    }
  };

  /* ---------- 3. confetti ---------- */
  const confettiColors = ["#f28b8b", "#f6d26b", "#9fd3c7", "#a9c4ee", "#f4a9c9", "#c5b3ea"];
  (function buildConfetti() {
    const box = $("#birthday .confetti");
    const n = innerWidth < 720 ? 34 : 60;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("i");
      p.style.left = Math.random() * 100 + "%";
      p.style.background = confettiColors[i % confettiColors.length];
      p.style.setProperty("--r", Math.random() * 360 + "deg");
      p.style.setProperty("--dx", (Math.random() * 80 - 40) + "px");
      p.style.animationDuration = 9 + Math.random() * 9 + "s";
      p.style.animationDelay = -Math.random() * 18 + "s";
      box.appendChild(p);
    }
  })();

  /* ---------- 4. hub tiles ---------- */
  const opened = new Set();
  const tiles = $("#tiles");
  G.gifts.forEach((g, i) => {
    const b = document.createElement("button");
    b.className = "tile";
    b.style.setProperty("--i", i);
    b.setAttribute("aria-label", "Open gift: " + g.title);
    b.innerHTML = `<img src="${esc(g.tile)}" alt="">`;
    b.addEventListener("click", () => show("gift", i));
    tiles.appendChild(b);
  });
  enterHooks.hub = () => {
    $$(".tile", tiles).forEach((t, i) => t.classList.toggle("is-opened", opened.has(i)));
  };

  /* ---------- 5. gift pages ---------- */
  const card = $("#gift-card");
  const renderers = {
    cake(g) {
      // flame centres measured on assets/snoopy-cake.webp (x%, y%)
      const flames = [[68.5, 35.2], [74, 35.2], [78.6, 35.6], [84.2, 34.8]];
      card.className = "card";
      card.innerHTML = `
        <h2 class="chewy gift-title">${esc(g.title)}</h2>
        <div class="cake">
          <div class="cake-art" role="button" tabindex="0" aria-label="Blow out the candles">
            <img class="lit" src="assets/snoopy-cake.webp" alt="Snoopy holding a birthday cake with lit candles">
            <img class="blown" src="assets/snoopy-cake-blown.webp" alt="" aria-hidden="true">
            ${flames.map(([x, y]) => `<span class="glow" style="left:${x}%;top:${y}%"></span>`).join("")}
          </div>
          <p class="cake-hint">${esc(g.hint)}</p>
          ${navigator.mediaDevices?.getUserMedia ? `<button class="pill pill--small mic-btn">${esc(g.micButton)}</button>` : ""}
        </div>
        <div class="burst" aria-hidden="true"></div>`;
      const art = $(".cake-art", card);
      const blow = () => {
        if (art.classList.contains("is-blown")) return;
        stopMic();
        art.classList.add("is-blown");
        flames.forEach(([x, y], i) => {
          const s = document.createElement("span");
          s.className = "smoke";
          s.style.left = x + "%"; s.style.top = y - 3 + "%";
          s.style.setProperty("--sx", (i - 1.5) * 8 + "px");
          s.style.animationDelay = i * 70 + "ms";
          art.appendChild(s);
        });
        $(".gift-title", card).textContent = g.doneTitle;
        $(".cake-hint", card).textContent = g.doneHint;
        $(".mic-btn", card)?.remove();
        burst($(".burst", card));
      };
      art.addEventListener("click", blow);
      art.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); blow(); } });
      $(".mic-btn", card)?.addEventListener("click", (e) => listenForBlow(blow, e.currentTarget));
    },

    flowers(g) {
      const half = Math.ceil(g.notes.length / 2);
      const L = g.notes.slice(0, half), R = g.notes.slice(half);
      // stagger: alternate left/right, top to bottom (as in the original)
      const chip = (t, idx) => `<span class="note" style="--i:${idx}">${esc(t)}</span>`;
      card.className = "card";
      card.innerHTML = `
        <h2 class="chewy gift-title">${esc(g.title)}</h2>
        <p class="gift-sub">${esc(g.subtitle)}</p>
        <div class="bouquet">
          <div class="notes notes--l">${L.map((t, i) => chip(t, i * 2)).join("")}</div>
          <div class="ring"><img src="assets/snoopy-bouquet.webp" alt="Snoopy holding a bouquet of red flowers"></div>
          <div class="notes notes--r">${R.map((t, i) => chip(t, i * 2 + 1)).join("")}</div>
        </div>`;
    },

    song(g) {
      card.className = "card";
      card.innerHTML = `
        <h2 class="chewy gift-title">${esc(g.title)}</h2>
        <div class="player">
          <div class="cd" aria-hidden="true"></div>
          <div class="video">
            <iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(g.youtubeId)}?rel=0&modestbranding=1"
              title="${esc(g.songLabel)}" loading="lazy"
              allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
          </div>
          <p class="song-label">${esc(g.songLabel)}</p>
        </div>
        <img class="side-sticker side-sticker--l" src="assets/sticker-woodstock.webp" alt="">
        <img class="side-sticker side-sticker--r" src="assets/sticker-heart.webp" alt="">`;
      // the "why" paragraph sits in its own box between the card and BACK, like the original
      const box = document.createElement("p");
      box.className = "note-box";
      box.textContent = g.note;
      card.after(box);
    },

    photos(g) {
      const stickers = [["8%", "62%"], ["31%", "6%"], ["64%", "70%"], ["91%", "48%"]];
      card.className = "card card--photos";
      card.innerHTML = `
        <div class="polaroids">
          ${g.photos.map((src, i) => `<figure class="polaroid"><img src="${esc(src)}" alt="Photo ${i + 1}"></figure>`).join("")}
        </div>
        ${stickers.map(([l, t]) => `<img class="photo-sticker" style="left:${l};top:${t}" src="assets/sticker-love.webp" alt="">`).join("")}
        <h2 class="chewy gift-title photos-title">${esc(g.title)}</h2>`;
    },

    letter(g) {
      card.className = "card";
      const words = (t) => esc(t).split(/(\s+)/).map((w) => (/\s/.test(w) ? w : `<span class="w">${w}</span>`)).join("");
      card.innerHTML = `
        <div class="letter">
          <h2 class="chewy gift-title">${esc(g.title)}</h2>
          <div class="letter-body">
            ${g.paragraphs.map((p) => `<p>${words(p)}</p>`).join("")}
            <p class="signoff">${words(g.signoff).replace(/\n/g, "<br>")}</p>
          </div>
          <img class="letter-art" src="assets/snoopy-hearts.webp" alt="Snoopy hugging a bunch of red hearts">
        </div>`;
      const ws = $$(".w", card);
      const step = Math.max(12, Math.min(28, 2600 / ws.length));
      ws.forEach((w, i) => later(() => w.classList.add("is-in"), 450 + i * step));
    },
  };

  enterHooks.gift = (i) => {
    const g = G.gifts[i];
    opened.add(i);
    $("#gift").setAttribute("aria-label", g.title);
    $$("#gift .note-box").forEach((n) => n.remove());
    renderers[g.type](g);
  };

  /* ---------- confetti burst ---------- */
  function burst(box) {
    if (reduced) return;
    for (let i = 0; i < 70; i++) {
      const p = document.createElement("i");
      const a = Math.random() * Math.PI * 2, d = 140 + Math.random() * 260;
      p.style.background = confettiColors[i % confettiColors.length];
      p.style.setProperty("--bx", Math.cos(a) * d + "px");
      p.style.setProperty("--by", Math.sin(a) * d - 60 + "px");
      p.style.setProperty("--br", Math.random() * 720 + "deg");
      p.style.animationDelay = Math.random() * 120 + "ms";
      box.appendChild(p);
    }
    setTimeout(() => (box.innerHTML = ""), 1700);
  }

  /* ---------- blow into the mic ---------- */
  let mic = null;
  async function listenForBlow(onBlow, btn) {
    try {
      btn.disabled = true; btn.textContent = "listening… blow!";
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser(); an.fftSize = 1024; src.connect(an);
      const buf = new Float32Array(an.fftSize);
      let loud = 0, raf;
      const tick = () => {
        an.getFloatTimeDomainData(buf);
        let sum = 0; for (const v of buf) sum += v * v;
        const rms = Math.sqrt(sum / buf.length);
        loud = rms > 0.12 ? loud + 1 : Math.max(0, loud - 1);
        if (loud > 8) { onBlow(); return; }
        raf = requestAnimationFrame(tick);
      };
      mic = { stop() { cancelAnimationFrame(raf); stream.getTracks().forEach((t) => t.stop()); ctx.close(); } };
      tick();
    } catch {
      btn.disabled = false; btn.textContent = "no mic? just tap the cake";
    }
  }
  function stopMic() { if (mic) { mic.stop(); mic = null; } }

  show("landing");
})();
