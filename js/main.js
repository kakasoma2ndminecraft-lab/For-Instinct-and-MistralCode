/* PICO — immersive one-pager
   1. opening (first video frame + logo)  2. scroll-scrubbed video
   3. product carousel (white-bg shots)   5. scroll story                    */

(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------ 2. scroll-scrubbed video */
  const video = document.getElementById("heroVideo");
  const stage = document.getElementById("heroStage");
  const logo = document.getElementById("heroLogo");
  const hint = document.getElementById("scrollHint");
  const scenes = Array.from(document.querySelectorAll("#heroScenes .scene"));
  const bar = document.getElementById("progressBar");
  const nav = document.getElementById("siteNav");

  let duration = 0;
  const scrub = { target: 0, current: 0 };

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function primeMetadata() {
    if (!video.duration) return;
    duration = video.duration;
    if (reduced) video.currentTime = duration - 0.05;
  }
  video.addEventListener("loadedmetadata", primeMetadata);
  primeMetadata();

  const scenesAt = (p) =>
    scenes.filter((s) => p >= parseFloat(s.dataset.from) && p < parseFloat(s.dataset.to));

  let lastY = 0;
  function updateNav(y) {
    if (y <= 120 || y < lastY - 2) nav.classList.remove("is-hidden");
    else if (y > lastY + 2) nav.classList.add("is-hidden");
    lastY = y;
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  function update() {
    ticking = false;
    const y = window.scrollY;
    updateNav(y);
    const rect = stage.getBoundingClientRect();
    const total = rect.height - window.innerHeight;
    const p = clamp01(-rect.top / total);

    bar.style.transform = `scaleX(${p})`;

    if (duration && !reduced) scrub.target = p * (duration - 0.05);

    /* logo dissolves into the scene as brewing begins */
    const logoFade = 1 - clamp01((p - 0.06) / 0.16);
    const logoScale = 1 - clamp01(p / 1.2) * 0.18;
    logo.style.opacity = logoFade.toFixed(3);
    logo.style.transform = `translateY(${(-p * 60).toFixed(1)}px) scale(${logoScale.toFixed(3)})`;

    hint.style.opacity = p < 0.02 ? "" : "0";

    const visible = scenesAt(p);
    scenes.forEach((s) => s.classList.toggle("is-visible", visible.includes(s)));
  }

  function tick() {
    if (!reduced && duration) {
      scrub.current = lerp(scrub.current, scrub.target, 0.12);
      if (Math.abs(video.currentTime - scrub.current) > 0.02) {
        video.currentTime = scrub.current;
      }
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  requestAnimationFrame(tick);
  update();

  /* ------------------------------------------------ 3. product carousel */
  const PRODUCTS = [
    {
      src: "assets/img/products/brazil.jpg",
      origin: "BRAZIL",
      name: "SOL BRAZIL — 200g",
      roast: "MEDIUM ROAST",
      note: '深い苦味が特徴。<br class="sp-only" />ダークチョコ×ローストナッツ。',
    },
    {
      src: "assets/img/products/sumatra.jpg",
      origin: "SUMATRA",
      name: "NOIR SUMATRA — 200g",
      roast: "DARK ROAST",
      note: '重厚なコクとスパイス。<br class="sp-only" />余韻は長く、静かに残る。',
    },
    {
      src: "assets/img/products/jamaica.jpg",
      origin: "JAMAICA",
      name: "ÉQUILIBRE — BLUE MOUNTAIN — 200g",
      roast: "MEDIUM ROAST",
      note: '気品ある酸味と甘み。<br class="sp-only" />奇跡のバランス。',
    },
    {
      src: "assets/img/products/colombia.jpg",
      origin: "COLOMBIA",
      name: "SOL MELLOW — 200g",
      roast: "MEDIUM ROAST",
      note: 'まろやかな甘みとコク。<br class="sp-only" />キャラメル×オレンジ。',
    },
  ];

  /* slots are tracked by role, not by fixed DOM position */
  const slots = {
    prev: document.getElementById("slotPrev"),
    current: document.getElementById("slotCurrent"),
    next: document.getElementById("slotNext"),
  };
  const elOrigin = document.getElementById("productOrigin");
  const elName = document.getElementById("productName");
  const elRoast = document.getElementById("productRoast");
  const elNote = document.getElementById("productNote");
  const elCursor = document.getElementById("productCursor");
  const stageEl = document.querySelector(".carousel-stage");
  const pad2 = (n) => String(n).padStart(2, "0");
  const mod = (n) => (n + PRODUCTS.length) % PRODUCTS.length;

  let index = 0;
  let busy = false;

  PRODUCTS.forEach((p) => { new Image().src = p.src; });

  function applyMeta() {
    const p = PRODUCTS[index];
    elOrigin.textContent = p.origin;
    elName.textContent = p.name;
    elRoast.textContent = p.roast;
    elNote.innerHTML = p.note;
    const spans = elCursor.querySelectorAll("span");
    spans[0].textContent = pad2(index + 1);
    spans[1].textContent = pad2(PRODUCTS.length);
  }

  function paintSlots() {
    const set = (slot, product, role) => {
      const img = slot.querySelector("img");
      img.src = product.src;
      img.alt = `PICO ${product.origin}パッケージ`;
      slot.className = `slot slot--${role}`;
    };
    set(slots.prev, PRODUCTS[mod(index - 1)], "prev");
    set(slots.current, PRODUCTS[index], "current");
    set(slots.next, PRODUCTS[mod(index + 1)], "next");
  }

  function freeze(on) {
    [slots.prev, slots.current, slots.next].forEach((s) => {
      s.style.transition = on ? "none" : "";
    });
  }

  function paintStatic() {
    freeze(true);
    paintSlots();
    void stageEl.offsetWidth;
    requestAnimationFrame(() => freeze(false));
  }

  function go(dir) {
    if (busy) return;
    busy = true;
    index = mod(index + dir);
    applyMeta();

    const incoming = dir > 0 ? slots.next : slots.prev;
    const outgoing = slots.current;

    outgoing.classList.remove("slot--current");
    outgoing.classList.add(dir > 0 ? "is-leaving-right" : "is-leaving-left");
    incoming.classList.remove("slot--next", "slot--prev");
    incoming.classList.add("slot--current");

    window.setTimeout(() => {
      /* rotate roles, then repaint canonically with transitions disabled */
      if (dir > 0) {
        const oldPrev = slots.prev;
        slots.prev = outgoing;
        slots.current = incoming;
        slots.next = oldPrev;
      } else {
        const oldNext = slots.next;
        slots.next = outgoing;
        slots.current = incoming;
        slots.prev = oldNext;
      }
      paintStatic();
      busy = false;
    }, 860);
  }

  paintStatic();
  applyMeta();
  document.getElementById("prevBtn").addEventListener("click", () => go(-1));
  document.getElementById("nextBtn").addEventListener("click", () => go(1));

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") go(-1);
    if (e.key === "ArrowRight") go(1);
  });

  let touchX = null;
  stageEl.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
  stageEl.addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 48) go(dx < 0 ? 1 : -1);
    touchX = null;
  }, { passive: true });

  /* ------------------------------------------------ 5. story reveal + parallax */
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => en.isIntersecting && en.target.classList.add("in")),
    { threshold: 0.18 }
  );
  document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

  if (!reduced) {
    const pxEls = Array.from(document.querySelectorAll("[data-parallax]"));
    let pq = false;
    function parallax() {
      pq = false;
      const vh = window.innerHeight;
      pxEls.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        const speed = parseFloat(el.dataset.parallax);
        const center = r.top + r.height / 2 - vh / 2;
        const img = el.querySelector("img");
        if (img) img.style.transform = `scale(1.12) translateY(${(-center * speed).toFixed(1)}px)`;
      });
    }
    window.addEventListener("scroll", () => {
      if (!pq) { pq = true; requestAnimationFrame(parallax); }
    }, { passive: true });
    parallax();
  }

  document.getElementById("year").textContent = new Date().getFullYear();
})();
