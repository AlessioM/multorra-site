"use strict";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ------------------------------------------------------------------
 * Background: a pixel forest at night with a dirt road, three parallax
 * rows of trees, a little squad (two archers and a mage) collecting
 * coins, fireflies and falling leaves. Everything is drawn here (no game
 * sprites), on a low-res canvas scaled up crisp.
 * ------------------------------------------------------------------ */
(() => {
  const canvas = document.getElementById("forest");
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, P = 4, roadTop = 0, roadH = 0;
  let scrollY = window.scrollY, running = true, last = 0, t = 0, dist = 0;
  let coins = [], sparks = [], flies = [], leaves = [];

  const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const rand = (a, b) => a + Math.random() * (b - a);

  // Far to near: scroll speed, colour, ground line (fraction of the road top), tree spacing.
  const LAYERS = [
    { speed: 0.12, color: "#173a24", base: 0.86, size: 1.0, gap: 9, seed: 11 },
    { speed: 0.3, color: "#11301b", base: 0.94, size: 0.85, gap: 12, seed: 37 },
    { speed: 0.6, color: "#0b2112", base: 1.0, size: 0.7, gap: 15, seed: 73 },
  ];
  const RUNNER = [   // a hooded runner, two frames (o = outline, h = hood, f = face, b = body, l = legs)
    ["...ooooo...", "..ohhhhho..", ".ohhffffho.", ".ohfyfyfho.", ".ohhffffho.", "..ohhhhhoo.", ".obbbbbbbo.", "obbobbbbobo", ".obbbbbbo..", "..ollool...", ".ol....lo..", ".o......o.."],
    ["...ooooo...", "..ohhhhho..", ".ohhffffho.", ".ohfyfyfho.", ".ohhffffho.", "..ohhhhhoo.", ".obbbbbbbo.", "obbobbbbobo", ".obbbbbbo..", "...olo.....", "...oll.....", "....oo....."],
  ];
  // the squad: same shape, recoloured per hero (archer green hood, mage purple robe)
  const SQUAD = [
    { dx: 0, col: { o: "#1a1208", h: "#5c9442", f: "#d9a066", y: "#2a1a10", b: "#54843c", l: "#5c3e2a" } },
    { dx: -13, col: { o: "#1a1208", h: "#8a3fa0", f: "#e8e8f0", y: "#2a1a10", b: "#7a3590", l: "#5a2470" } },
    { dx: -26, col: { o: "#1a1208", h: "#5c9442", f: "#d9a066", y: "#2a1a10", b: "#54843c", l: "#5c3e2a" } },
  ];

  function layout() {
    const cw = canvas.clientWidth || window.innerWidth, ch = canvas.clientHeight || window.innerHeight;
    P = Math.max(3, Math.round(Math.min(cw, ch) / 170));
    W = Math.ceil(cw / P); H = Math.ceil(ch / P);
    canvas.width = W; canvas.height = H;
    roadH = Math.max(24, Math.round(H * 0.13));
    roadTop = H - roadH - Math.round(H * 0.03);
    flies = Array.from({ length: Math.round(W * H / 1400) }, () => ({ x: rand(0, W), y: rand(H * 0.15, roadTop), ph: rand(0, 6.3), sp: rand(0.6, 1.6) }));
    leaves = Array.from({ length: Math.round(W / 22) }, (_, i) => ({ x: rand(0, W), y: rand(0, H), v: rand(6, 14), c: ["#d98a32", "#f0b84a", "#8cbf4a", "#c4552a"][i % 4] }));
    coins = []; sparks = [];
  }

  function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

  function tree(x, ground, h, kind, c) {
    if (kind < 0.55) {                          // pine: stacked triangles
      for (let y = 0; y < h; y++) {
        const k = y / h, tier = (y % Math.max(4, Math.round(h / 4))) / Math.max(4, Math.round(h / 4));
        const half = Math.max(1, Math.round((k * 0.45 + tier * 0.25) * h * 0.42));
        px(x - half, ground - h + y, half * 2 + 1, 1, c);
      }
      px(x - 1, ground - 3, 3, 3, c);
    } else {                                    // round tree: trunk + blob crown
      const r = Math.round(h * 0.34);
      px(x - 1, ground - h * 0.45, 3, h * 0.45, c);
      for (let y = -r; y <= r; y++) {
        const half = Math.round(Math.sqrt(r * r - y * y) * (1 + 0.08 * Math.sin(y * 1.7)));
        px(x - half, ground - h * 0.45 - r + y, half * 2 + 1, 1, c);
      }
    }
  }

  function drawLayer(L) {
    const ground = roadTop * L.base + 1, off = dist * L.speed, unit = L.gap;
    const first = Math.floor((off - 40) / unit), lastCol = Math.ceil((off + W + 40) / unit);
    for (let i = first; i <= lastCol; i++) {
      const r = hash(i * 13.7 + L.seed);
      if (r < 0.18) continue;                   // clearings
      const x = i * unit - off + (hash(i + L.seed) - 0.5) * unit * 0.8;
      const h = (roadTop * 0.32 + hash(i * 3.1 + L.seed) * roadTop * 0.36) * L.size;
      tree(x, ground, h, hash(i * 7.7 + L.seed), L.color);
    }
    px(0, ground, W, H - ground, L.color);
  }

  function draw() {
    // sky: banded night gradient with a moon
    const bands = ["#0a1424", "#0c1a28", "#0f2129", "#122a29", "#153225", "#173a24"];
    for (let i = 0; i < bands.length; i++) px(0, Math.floor(i * roadTop / bands.length), W, Math.ceil(roadTop / bands.length) + 1, bands[i]);
    const mx = Math.round(W * 0.78), my = Math.round(H * 0.16), mr = Math.max(6, Math.round(H * 0.05));
    for (let y = -mr * 2; y <= mr * 2; y++) {
      const half = Math.round(Math.sqrt(Math.max(0, 4 * mr * mr - y * y)));
      ctx.globalAlpha = 0.06; px(mx - half, my + y, half * 2, 1, "#fff6c8");
    }
    ctx.globalAlpha = 1;
    for (let y = -mr; y <= mr; y++) {
      const half = Math.round(Math.sqrt(mr * mr - y * y));
      px(mx - half, my + y, half * 2, 1, y < -mr * 0.4 ? "#fff8d8" : "#f2e6b0");
    }
    px(mx - mr * 0.3, my - mr * 0.1, Math.max(2, mr * 0.3), Math.max(2, mr * 0.25), "#d8cc96");
    px(mx + mr * 0.25, my + mr * 0.35, Math.max(1, mr * 0.2), Math.max(1, mr * 0.18), "#d8cc96");
    for (const L of LAYERS) drawLayer(L);
    // road: grass verge, dirt, lane dashes scrolling at running speed
    px(0, roadTop - 2, W, 3, "#2f5a23");
    for (let x = 0; x < W; x += 3) if (hash(Math.floor((x + dist) / 3)) > 0.5) px(x, roadTop - 3, 2, 1, "#3d7a2c");
    px(0, roadTop + 1, W, roadH, "#6b4a2a");
    px(0, roadTop + 1, W, 2, "#4f3520");
    for (let lane = 1; lane < 3; lane++) {
      const y = roadTop + 1 + Math.round(lane * roadH / 3);
      for (let x = -((dist) % 14); x < W; x += 14) px(x, y, 6, 1, "#5a3d22");
    }
    px(0, roadTop + roadH + 1, W, H, "#24461c");
    // coins and sparkles
    for (const c of coins) {
      const bob = Math.round(Math.sin(t * 6 + c.x) * 1);
      const y = laneY(c.lane) - 6 + bob, x = c.x;
      px(x - 1, y - 2, 3, 1, "#7a4a10"); px(x - 2, y - 1, 5, 3, "#ffd04f"); px(x - 1, y + 2, 3, 1, "#7a4a10");
      px(x - 1, y - 1, 1, 1, "#fff6c0");
    }
    for (const s of sparks) { ctx.globalAlpha = Math.max(0, s.life * 2); px(s.x, s.y, 1, 1, "#fff2a0"); }
    ctx.globalAlpha = 1;
    // runner
    const rx = Math.round(W * (W > 260 ? 0.2 : 0.32)), ry = laneY(runnerLane()) - 12 + (Math.floor(t * 10) % 2 ? -1 : 0);
    SQUAD.forEach((hero, k) => {
      const frame = RUNNER[(Math.floor(t * 10) + k) % 2], hy = ry + ((Math.floor(t * 10) + k) % 2 ? 1 : 0);
      ctx.globalAlpha = 0.35; px(rx + hero.dx + 1, laneY(runnerLane()) - 1, 9, 2, "#000"); ctx.globalAlpha = 1;
      frame.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (hero.col[row[x]]) px(rx + hero.dx + x, hy + y, 1, 1, hero.col[row[x]]); });
    });
    // fireflies and leaves
    for (const f of flies) {
      const g = (Math.sin(t * f.sp * 2 + f.ph) + 1) / 2;
      if (g < 0.25) continue;
      const x = ((f.x - dist * 0.3 + Math.sin(t * 0.7 + f.ph) * 4) % W + W) % W, y = f.y + Math.sin(t * f.sp + f.ph) * 3;
      ctx.globalAlpha = 0.18 * g; px(x - 1, y - 1, 3, 3, "#fff59a");
      ctx.globalAlpha = 0.9 * g; px(x, y, 1, 1, "#fffbd0");
    }
    ctx.globalAlpha = 1;
    for (const l of leaves) {
      const flip = Math.floor(t * 3 + l.v) % 2;
      px(l.x, l.y, flip ? 2 : 1, flip ? 1 : 2, l.c);
    }
    // dim as the page scrolls so the content reads
    const dim = Math.min(0.7, scrollY / (window.innerHeight * 1.2) * 0.7);
    if (dim > 0) { ctx.globalAlpha = dim; px(0, 0, W, H, "#060e07"); ctx.globalAlpha = 1; }
  }

  const laneY = (lane) => roadTop + 1 + Math.round((lane + 0.75) * roadH / 3);
  let lane = 1, laneT = 0;
  const runnerLane = () => lane;

  function step(dt) {
    t += dt; dist += dt * 38;
    laneT -= dt;
    if (laneT <= 0) {                           // hop to the lane with the next coin, like Wayfinder
      laneT = 0.9;
      const next = coins.filter((c) => c.x > W * (W > 260 ? 0.22 : 0.34)).sort((a, b) => a.x - b.x)[0];
      if (next) lane = next.lane;
    }
    if (Math.random() < dt * 1.4) {
      const ln = Math.floor(Math.random() * 3);
      for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) coins.push({ x: W + 8 + i * 9, lane: ln });
    }
    const rx = W * (W > 260 ? 0.2 : 0.32) + 5;
    for (const c of coins) {
      c.x -= dt * 38;
      if (c.lane === lane && Math.abs(c.x - rx) < 4) {
        c.gone = true;
        for (let i = 0; i < 5; i++) sparks.push({ x: c.x, y: laneY(c.lane) - 6, vx: rand(-12, 12), vy: rand(-20, -4), life: rand(0.3, 0.6) });
      }
    }
    coins = coins.filter((c) => !c.gone && c.x > -10);
    for (const s of sparks) { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 40 * dt; s.life -= dt; }
    sparks = sparks.filter((s) => s.life > 0);
    for (const l of leaves) {
      l.y += l.v * dt; l.x += (Math.sin(t + l.v) * 6 - 10) * dt;
      if (l.y > H) { l.y = -2; l.x = rand(0, W * 1.2); }
      if (l.x < -2) l.x = W;
    }
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    step(dt); draw();
    requestAnimationFrame(frame);
  }

  layout();
  if (reduceMotion) {
    for (let i = 0; i < 240; i++) step(1 / 60);
    draw();
  } else {
    requestAnimationFrame((n) => { last = n; frame(n); });
  }
  let resizeTimer;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { layout(); draw(); }, 150); });
  window.addEventListener("scroll", () => { scrollY = window.scrollY; if (reduceMotion) draw(); }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (reduceMotion) return;
    running = !document.hidden;
    if (running) requestAnimationFrame((n) => { last = n; frame(n); });
  });
})();

/* ------------------------------------------------------------------
 * Gallery, road marquee, lightbox, scroll reveal.
 * ------------------------------------------------------------------ */
const SHOTS = [
  ["02_quiz", "A question opens", "Time slows down; swipe toward the right answer before the rim runs out."],
  ["01_run", "On the road", "Archers and mages fire up three lanes while orcs and skeletons come down."],
  ["03_wrong", "Right and wrong", "The right answer lights up green; a wrong pick shakes red and the road rushes for a moment."],
  ["04_boss", "Boss fights", "Every fifth level ends with a boss that summons help."],
  ["05_map", "The level map", "A winding path up the meadow, with stars and locks on every level."],
  ["06_menu", "Title screen", "A squad keeps playing behind the menu."],
  ["07_result", "Results", "Up to three stars: win, answer three of four right, lose at most two heroes."],
];

(() => {
  const gallery = document.getElementById("gallery");
  SHOTS.forEach(([file, title, cap], k) => {
    const fig = document.createElement("figure");
    fig.innerHTML = `<button class="shot" data-i="${k}" aria-label="Enlarge: ${title}">
      <img class="pixel" src="img/screens/${file}-360.webp" width="360" height="720" loading="lazy" alt="${cap}"></button>
      <figcaption><b>${title}</b>${cap}</figcaption>`;
    gallery.appendChild(fig);
  });

  const things = [["Archers", "#9ad86a"], ["Mages", "#c9a0ff"], ["Orcs", "#f08a4b"], ["Skeletons", "#f4f0dc"],
    ["Orc Shaman", "#e0607e"], ["Skeleton Mage", "#c9a0ff"], ["7 × 6", "#ffd04f"], ["63 ÷ 9", "#ffd04f"], ["48 + 17", "#ffd04f"],
    ["Bombs", "#f08a4b"], ["Rapid fire", "#9fd0ff"], ["Slow motion", "#9fd0ff"], ["Stars", "#ffd04f"], ["Bosses", "#e0607e"]];
  const track = document.getElementById("track");
  const chips = things.map(([c, col]) => `<span class="chip"><b style="color:${col}">●</b>${c}</span>`).join("");
  track.innerHTML = chips + chips;                       // doubled for a seamless loop
  [...track.children].slice(things.length).forEach((el) => el.setAttribute("aria-hidden", "true"));

  const dlg = document.getElementById("lightbox"), img = document.getElementById("lb-img"), cap = document.getElementById("lb-cap");
  let cur = 0;
  const show = (i) => {
    cur = (i + SHOTS.length) % SHOTS.length;
    const [file, title, text] = SHOTS[cur];
    img.src = `img/screens/${file}.webp`; img.alt = text; cap.textContent = `${title} — ${text}`;
  };
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".shot");
    if (b) { show(+b.dataset.i); dlg.showModal(); }
  });
  dlg.querySelector(".lb-close").addEventListener("click", () => dlg.close());
  dlg.querySelector(".lb-prev").addEventListener("click", () => show(cur - 1));
  dlg.querySelector(".lb-next").addEventListener("click", () => show(cur + 1));
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(cur - 1);
    if (e.key === "ArrowRight") show(cur + 1);
  });

  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  document.querySelectorAll(".reveal").forEach((el, i) => { el.style.transitionDelay = `${(i % 3) * 80}ms`; io.observe(el); });
})();
