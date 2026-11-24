/* PICO — immersive one-pager
   1. opening (first frame + logo)  2. scroll-scrubbed frame sequence
   3. product carousel (white-bg shots)   5. scroll story                    */

(() => {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------ 2. scroll-scrubbed frames */
  /* iOS Safari decodes from the keyframe on every video.currentTime seek
     (this source has a single keyframe), so scrubbing is driven by a
     pre-extracted frame sequence instead. */
  const FRAME_COUNT = 101;
  const frameEl = document.getElementById("heroFrame");
  const stage = document.getElementById("heroStage");
  const logo = document.getElementById("heroLogo");
  const hint = document.getElementById("scrollHint");
  const bar = document.getElementById("progressBar");
  const nav = document.getElementById("siteNav");

  const frame = { target: 0, current: 0, shown: 0 };
  const loaded = new Set([0]);
  const frameUrl = (i) => `assets/img/frames/f${String(i + 1).padStart(4, "0")}.webp`;

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  function showFrame(i) {
    if (!loaded.has(i) || i === frame.shown) return;
    frame.shown = i;
    frameEl.src = frameUrl(i);
  }

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

    if (!reduced) frame.target = p * (FRAME_COUNT - 1);

    /* logo + tagline dissolve into the scene as brewing begins */
    const logoFade = 1 - clamp01((p - 0.06) / 0.16);
    const logoScale = 1 - clamp01(p / 1.2) * 0.18;
    logo.style.opacity = logoFade.toFixed(3);
    logo.style.transform = `translateY(${(-p * 60).toFixed(1)}px) scale(${logoScale.toFixed(3)})`;

    hint.style.opacity = p < 0.02 ? "" : "0";

  }

  function tick() {
    if (!reduced) {
      frame.current = lerp(frame.current, frame.target, 0.12);
      if (Math.abs(frame.target - frame.current) < 0.02) frame.current = frame.target;
      showFrame(Math.round(frame.current));
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  requestAnimationFrame(tick);
  update();

  /* ------------------------------------------------ 0. preloader */
  /* the scrub is only smooth once the first frames are decoded, so hold the
     stage on a branded loader until they arrive (with a hard time cap) */
  const preloader = document.getElementById("preloader");
  const preloaderFill = document.getElementById("preloaderFill");
  const PRELOAD_READY = 20;
  const PRELOADER_MIN = 1500;
  const preloaderStart = performance.now();
  let preloaderDone = false;

  function setPreloaderProgress(p) {
    if (preloaderFill) preloaderFill.style.transform = `scaleY(${clamp01(p).toFixed(3)})`;
  }

  function finishPreloader() {
    if (preloaderDone) return;
    preloaderDone = true;
    const wait = Math.max(0, PRELOADER_MIN - (performance.now() - preloaderStart));
    window.setTimeout(() => {
      document.documentElement.classList.remove("is-loading");
      if (!preloader) return;
      preloader.classList.add("is-done");
      window.setTimeout(() => preloader.classList.add("is-hidden"), 1200);
    }, wait);
  }

  setPreloaderProgress(0);

  /* warm the browser cache with the rest of the sequence, four at a time */
  if (reduced) {
    frameEl.src = frameUrl(FRAME_COUNT - 1);
    finishPreloader();
  } else {
    let next = 1;
    let inflight = 0;
    let ready = 0;
    function pump() {
      while (next < FRAME_COUNT && inflight < 4) {
        const i = next++;
        inflight++;
        const im = new Image();
        im.onload = () => {
          loaded.add(i);
          inflight--;
          ready++;
          setPreloaderProgress(ready / PRELOAD_READY);
          if (ready >= PRELOAD_READY) finishPreloader();
          if (Math.round(frame.current) === i) showFrame(i);
          pump();
        };
        im.onerror = () => { inflight--; pump(); };
        im.src = frameUrl(i);
      }
    }
    pump();
    window.setTimeout(finishPreloader, 4500);
  }

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
  const elMeta = document.querySelector(".product-meta");
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

    const incoming = dir > 0 ? slots.next : slots.prev;
    const outgoing = slots.current;
    const far = dir > 0 ? slots.prev : slots.next;

    /* the far slot teleports to the other side at repaint; hide that swap
       behind a fade so it never reads as a jump */
    far.style.transition = "opacity 0.3s ease";
    far.style.opacity = "0";

    /* crossfade the product text instead of swapping it mid-slide */
    elMeta.classList.add("is-switching");
    window.setTimeout(() => {
      applyMeta();
      elMeta.classList.remove("is-switching");
    }, 200);

    outgoing.classList.remove("slot--current");
    outgoing.classList.add(dir > 0 ? "is-leaving-left" : "is-leaving-right");
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
      freeze(true);
      paintSlots();
      far.style.transition = "none";
      far.style.opacity = "0";
      void stageEl.offsetWidth;
      requestAnimationFrame(() => {
        freeze(false);
        far.style.transition = "opacity 0.55s ease 0.12s";
        far.style.opacity = "";
        window.setTimeout(() => { far.style.transition = ""; }, 750);
      });
      busy = false;
    }, 720);
  }

  paintStatic();
  applyMeta();
  document.getElementById("prevBtn").addEventListener("click", () => go(-1));
  document.getElementById("nextBtn").addEventListener("click", () => go(1));

  document.addEventListener("keydown", (e) => {
    /* the drawer is modal: arrows must not swap the product behind it */
    if (document.documentElement.classList.contains("is-drawer-open")) return;
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

  /* ------------------------------------------------ 4. extraction drawer */
  const drawer = document.getElementById("beanDrawer");
  const scrim = document.getElementById("drawerScrim");
  const selectBtn = document.getElementById("selectBean");
  const drawerClose = document.getElementById("drawerClose");
  const drawerImage = document.getElementById("drawerImage");
  const drawerTitle = document.getElementById("drawerTitle");
  const drawerName = document.getElementById("drawerName");
  const drawerRoast = document.getElementById("drawerRoast");
  const drawerRoastText = document.getElementById("drawerRoastText");
  const drawerNote = document.getElementById("drawerNote");
  const roastMeter = document.getElementById("roastMeter");
  const ROAST_LEVEL = { "MEDIUM ROAST": 0.55, "DARK ROAST": 0.86 };
  let drawerFocus = null;

  function fillDrawer() {
    const p = PRODUCTS[index];
    drawerImage.src = p.src;
    drawerImage.alt = `PICO ${p.origin}パッケージ`;
    drawerTitle.textContent = p.origin;
    drawerName.textContent = p.name;
    drawerRoast.textContent = p.roast;
    drawerRoastText.textContent = p.roast.replace(" ROAST", "");
    drawerNote.innerHTML = p.note;
    roastMeter.style.transform = `scaleX(${ROAST_LEVEL[p.roast] || 0.6})`;
  }

  function openDrawer() {
    if (!drawer || !selectBtn) return;
    fillDrawer();
    drawerFocus = document.activeElement;
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    scrim.classList.add("is-open");
    document.documentElement.classList.add("is-drawer-open");
    window.setTimeout(() => drawerClose.focus({ preventScroll: true }), 80);
  }

  function closeDrawer() {
    if (!drawer || !drawer.classList.contains("is-open")) return;
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    scrim.classList.remove("is-open");
    document.documentElement.classList.remove("is-drawer-open");
    if (drawerFocus && drawerFocus.focus) drawerFocus.focus({ preventScroll: true });
  }

  if (drawer && selectBtn) {
    selectBtn.addEventListener("click", openDrawer);
    drawerClose.addEventListener("click", closeDrawer);
    scrim.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (e) => {
      if (!drawer.classList.contains("is-open")) return;
      if (e.key === "Escape") { closeDrawer(); return; }
      if (e.key !== "Tab") return;
      /* keep keyboard focus inside the open dialog */
      const focusables = drawer.querySelectorAll("button, [href], [tabindex]:not([tabindex='-1'])");
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

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
