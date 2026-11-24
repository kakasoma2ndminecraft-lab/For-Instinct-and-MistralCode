(() => {
  const TOTAL = 96;
  const FRAME_W = 1200, FRAME_H = 1200;
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const scrolly = document.getElementById('scrolly');
  const loader = document.getElementById('loader');
  const loaderFill = document.getElementById('loaderFill');
  const loaderPct = document.getElementById('loaderPct');

  const frames = new Array(TOTAL + 1); // 1-based
  let loaded = 0;
  let lastDrawn = -1;
  let progress = 0;

  // ---- canvas sizing (contain fit, DPR aware) ----
  let vw = 0, vh = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = canvas.clientWidth; vh = canvas.clientHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    lastDrawn = -1;
    requestDraw();
  }
  window.addEventListener('resize', resize);

  function draw(i) {
  const TOTAL = 96;
  const FRAME_W = 1200, FRAME_H = 1200;
  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const scrolly = document.getElementById('scrolly');
  const loader = document.getElementById('loader');
  const loaderFill = document.getElementById('loaderFill');
  const loaderPct = document.getElementById('loaderPct');

  const frames = new Array(TOTAL + 1); // 1-based
  let loaded = 0;
  let lastDrawn = -1;
  let progress = 0;

  // ---- canvas sizing (contain fit, DPR aware) ----
  let vw = 0, vh = 0, dpr = 1;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = canvas.clientWidth; vh = canvas.clientHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    lastDrawn = -1;
    requestDraw();
  }
  window.addEventListener('resize', resize);

  function draw(i) {
    const img = frames[i] || frames[nearestLoaded(i)];
    if (!img) return;
    lastDrawn = i;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, vw, vh);
    const scale = Math.min(vw / FRAME_W, vh / FRAME_H);
    const w = FRAME_W * scale, h = FRAME_H * scale;
    ctx.drawImage(img, (vw - w) / 2, (vh - h) / 2, w, h);
  }

  function nearestLoaded(i) {
    for (let d = 1; d < TOTAL; d++) {
      if (i - d >= 1 && frames[i - d]) return i - d;
      if (i + d <= TOTAL && frames[i + d]) return i + d;
    }
    return 1;
  }

  // ---- progressive loading: first frames fast, rest in background ----
  function loadOne(i) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { frames[i] = img; loaded++; updateLoader(); resolve(); };
      img.onerror = () => { loaded++; updateLoader(); resolve(); };
      img.src = `frames/${i}-f${String(i).padStart(3, '0')}.jpg`;
    });
  }

  function updateLoader() {
    const pct = Math.round((loaded / TOTAL) * 100);
    loaderFill.style.width = pct + '%';
    loaderPct.textContent = pct + '%';
    if (loaded >= TOTAL) loader.classList.add('done');
  }

  async function preload() {
    // priority: every 8th frame so the whole range is drawable quickly
    const first = [];
    for (let i = 1; i <= TOTAL; i += 8) first.push(i);
    if (!first.includes(TOTAL)) first.push(TOTAL);
    await Promise.all(first.map(loadOne));
    loader.classList.add('done');
    requestDraw();
    // then the rest, in order, small batches
    const rest = [];
    for (let i = 1; i <= TOTAL; i++) if (!frames[i]) rest.push(i);
    const BATCH = 6;
    for (let k = 0; k < rest.length; k += BATCH) {
      await Promise.all(rest.slice(k, k + BATCH).map(loadOne));
    }
  }

  // ---- scroll ----
  const caps = Array.from(document.querySelectorAll('.cap'));
  let ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const rect = scrolly.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      if (fixedP === null) progress = Math.min(1, Math.max(0, -rect.top / total));
      requestDraw();
      updateCaps();
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  function requestDraw() {
    const i = 1 + Math.round(progress * (TOTAL - 1));
    if (i !== lastDrawn) draw(i);
  }

  function updateCaps() {
    for (const el of caps) {
      const from = parseFloat(el.dataset.from);
      const to = parseFloat(el.dataset.to);
      const fade = 0.035;
      let o = 0;
      if (el.classList.contains('cap-hero')) {
        if (progress <= to) o = Math.min(1, (to - progress) / fade);
      } else if (progress >= from && progress <= to) {
        o = Math.min(1, (progress - from) / fade, (to - progress) / fade);
      }
      el.style.opacity = o.toFixed(3);
      const drift = (1 - o) * 18;
      if (el.classList.contains('cap-hero')) {
        el.style.transform = `translateY(${-drift}px)`;
      } else if (el.classList.contains('cap-final')) {
        el.style.transform = `translateY(${drift}px)`;
      }
    }
  }

  // ---- content reveal ----
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  // ---- debug helpers for local screenshot verification ----
  const qs = new URLSearchParams(location.search);
  const fixedP = qs.has('p') ? parseFloat(qs.get('p')) : null;
  const fixedY = qs.has('y') ? parseFloat(qs.get('y')) : null;

  updateCaps();
  resize();
  preload().then(() => {
    updateCaps();
    if (fixedP !== null) { progress = fixedP; requestDraw(); updateCaps(); }
    if (fixedY !== null) {
      document.body.style.marginTop = (-fixedY) + 'px';
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
    }
  });
})();
