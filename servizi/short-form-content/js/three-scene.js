/* ============================================================
   SHORT FORM – three-scene.js
   La storia in 4 trasformazioni:
   1. Telefono SOLIDO con un feed che scorre sullo schermo
   2. Il telefono si APRE in 12 card 3D
   3. Le card si FONDONO in un laptop che si apre
   4. Il laptop ESCE dallo schermo verso l'utente (+ fulmini)

   Le timeline GSAP scrivono su window.VERTEX_STATE,
   il render loop legge. FX fulmini su canvas 2D separato.
============================================================ */
(function () {
  "use strict";

  /* ---------------- stato centralizzato ---------------- */
  window.VERTEX_STATE = {
    phonePos: { x: 2.4, y: -6.5, z: 0 },
    phoneRot: { x: 0, y: -0.42, z: 0 },
    phoneScale: 1,

    feedProgress: 0,     // 0..1 → il feed scorre dentro lo schermo
    glitch: 0,           // 0..1 → overlay problema

    explodeProgress: 0,  // 0..1 → telefono → griglia di card
    gatherProgress: 0,   // 0..1 → card → laptop
    lidOpen: 0,          // 0..1 → apertura del coperchio
    laptopPos: { x: 0, y: -0.4, z: 0 },
    laptopRotY: 0,
    forwardProgress: 0,  // 0..1 → il laptop "esce" dallo schermo

    activeProcessStep: 0,
    laptopScreen: "steps",   // steps | cta
    selectedPackage: null
  };

  const S = window.VERTEX_STATE;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = matchMedia("(max-width: 720px)").matches;
  const isTablet = matchMedia("(max-width: 1080px)").matches;

  /* ============================================================
     FX – FULMINI (canvas 2D sopra il WebGL)
  ============================================================ */
  const FX = window.FX = (function () {
    const c = document.getElementById("fx-canvas");
    if (!c) return { strike() {}, burst() {} };
    const g = c.getContext("2d");
    let bolts = [], raf = null;

    function size() { c.width = innerWidth; c.height = innerHeight; }
    size(); addEventListener("resize", size);

    function boltPath(x0, y0, x1, y1, jag) {
      let pts = [{ x: x0, y: y0 }, { x: x1, y: y1 }];
      for (let d = 0; d < 5; d++) {
        const next = [pts[0]];
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          const mx = (a.x + b.x) / 2 + (Math.random() - .5) * jag;
          const my = (a.y + b.y) / 2 + (Math.random() - .5) * jag;
          next.push({ x: mx, y: my }, b);
        }
        pts = next; jag *= 0.55;
      }
      return pts;
    }

    function strike(x0, y0, x1, y1, color) {
      if (reduced) return;
      const main = boltPath(x0, y0, x1, y1, 120);
      const branches = [];
      for (let i = 0; i < 3; i++) {
        const p = main[8 + Math.floor(Math.random() * (main.length - 16))];
        branches.push(boltPath(p.x, p.y,
          p.x + (Math.random() - .5) * 220,
          p.y + Math.random() * 180, 60));
      }
      bolts.push({ main, branches, life: 1, color: color || "#09D7F5" });
      if (!raf) raf = requestAnimationFrame(draw);
    }

    function burst(cx, cy, n, color) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, r = 160 + Math.random() * 260;
        strike(cx, cy, cx + Math.cos(a) * r, cy + Math.sin(a) * r, color);
      }
    }

    function draw() {
      g.clearRect(0, 0, c.width, c.height);
      bolts = bolts.filter(b => (b.life -= 0.06) > 0);
      bolts.forEach(b => {
        g.save();
        g.globalAlpha = Math.min(1, b.life * 1.4);
        g.strokeStyle = b.color; g.lineWidth = 2.2;
        g.shadowColor = b.color; g.shadowBlur = 18;
        path(b.main);
        g.lineWidth = 1.1; g.globalAlpha *= 0.8;
        b.branches.forEach(path);
        g.strokeStyle = "#fff"; g.lineWidth = 0.8; g.shadowBlur = 0;
        g.globalAlpha = Math.min(1, b.life);
        path(b.main);
        g.restore();
      });
      raf = bolts.length ? requestAnimationFrame(draw) : (g.clearRect(0, 0, c.width, c.height), null);
      function path(p) {
        g.beginPath(); g.moveTo(p[0].x, p[0].y);
        for (let i = 1; i < p.length; i++) g.lineTo(p[i].x, p[i].y);
        g.stroke();
      }
    }
    return { strike, burst };
  })();

  /* ============================================================
     BOOT / GUARDIE
  ============================================================ */
  function webglOK() {
    try {
      const c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) { return false; }
  }
  window.VERTEX_HAS_3D = false;

  function boot() {
    if (typeof THREE === "undefined" || !webglOK()) {
      const w = document.getElementById("noWebgl"); if (w) w.hidden = false;
      const wrap = document.querySelector(".gl-wrap"); if (wrap) wrap.style.display = "none";
      document.documentElement.classList.add("no-3d");
      return;
    }
    window.VERTEX_HAS_3D = true;
    init();
  }

  /* ============================================================
     SCENA
  ============================================================ */
  let renderer, scene, camera;
  let phone, slabGroup, slabs = [], laptop, lid, lidPivot;
  let feedCtx, feedTex, lapCtx, lapTex;
  let running = true, lastFeed = 0, lastLap = 0;
  const mouse = { x: 0, y: 0 };

  const PW = 2.0, PH = 4.1, PD = 0.18, PR = 0.3;      // telefono
  const COLS = 3, ROWS = 4;                             // frammenti
  const LW = 3.6, LDp = 2.3, LT = 0.14;               // laptop

  function init() {
    const canvas = document.getElementById("gl-canvas");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(innerWidth, innerHeight);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 80);
    camera.position.set(0, 0, 9.5);

    scene.add(new THREE.HemisphereLight(0x9db4e0, 0x0a1020, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(4, 5, 7); scene.add(key);
    const rim = new THREE.DirectionalLight(0x086cff, 1.4); rim.position.set(-6, 2, -3); scene.add(rim);
    const cy = new THREE.PointLight(0x09d7f5, 0.9, 26); cy.position.set(2, -3, 6); scene.add(cy);

    buildPhone();
    buildSlabs();
    buildLaptop();

    addEventListener("resize", onResize);
    if (!isMobile && !reduced) {
      addEventListener("pointermove", (e) => {
        mouse.x = e.clientX / innerWidth - 0.5;
        mouse.y = e.clientY / innerHeight - 0.5;
      }, { passive: true });
    }
    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
      if (running && !reduced) requestAnimationFrame(loop);
    });

    if (reduced) {
      S.phonePos = { x: isMobile ? 0 : 2.4, y: 0, z: 0 };
      applyState(0); renderer.render(scene, camera);
      return;
    }
    requestAnimationFrame(loop);
  }

  /* ---------------- forme di base ---------------- */
  function rrect(w, h, r) {
    const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  /* ============================================================
     1) TELEFONO – solido, luminoso, con feed vivo
  ============================================================ */
  function buildPhone() {
    phone = new THREE.Group(); scene.add(phone);

    const frameGeo = new THREE.ExtrudeGeometry(rrect(PW, PH, PR), {
      depth: PD, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025,
      bevelSegments: isMobile ? 1 : 3, curveSegments: isMobile ? 10 : 22
    });
    frameGeo.translate(0, 0, -PD / 2);
    const frame = new THREE.Mesh(frameGeo, new THREE.MeshStandardMaterial({
      color: 0x1b2740, metalness: 0.65, roughness: 0.28
    }));
    phone.add(frame);

    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(frameGeo, 20),
      new THREE.LineBasicMaterial({ color: 0x09d7f5, transparent: true, opacity: 0.45 })
    );
    phone.add(edge);

    const bezel = new THREE.Mesh(
      new THREE.PlaneGeometry(PW - 0.1, PH - 0.1),
      new THREE.MeshBasicMaterial({ color: 0x03050b })
    );
    bezel.position.z = PD / 2 + 0.008; phone.add(bezel);

    const fc = document.createElement("canvas"); fc.width = 320; fc.height = 656;
    feedCtx = fc.getContext("2d");
    feedTex = new THREE.CanvasTexture(fc);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(PW - 0.2, PH - 0.2),
      new THREE.MeshBasicMaterial({ map: feedTex })
    );
    screen.position.z = PD / 2 + 0.014; phone.add(screen);

    const camPlate = new THREE.Mesh(
      new THREE.ExtrudeGeometry(rrect(0.6, 0.6, 0.16), { depth: 0.05, bevelEnabled: false, curveSegments: 10 }),
      new THREE.MeshStandardMaterial({ color: 0x101b30, metalness: 0.8, roughness: 0.3 })
    );
    camPlate.position.set(PW / 2 - 0.44, PH / 2 - 0.44, -PD / 2 - 0.05);
    phone.add(camPlate);
    [[-0.13, 0.13], [0.13, 0.13], [-0.13, -0.13]].forEach(([lx, ly]) => {
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.085, 0.08, 18),
        new THREE.MeshStandardMaterial({ color: 0x04060c, metalness: 0.5, roughness: 0.15 })
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.set(PW / 2 - 0.44 + lx, PH / 2 - 0.44 + ly, -PD / 2 - 0.09);
      phone.add(lens);
    });
  }

  /* ============================================================
     2) CARD – 12 frammenti del telefono
  ============================================================ */
  function buildSlabs() {
    slabGroup = new THREE.Group(); slabGroup.visible = false; scene.add(slabGroup);
    const sw = PW / COLS, sh = PH / ROWS;
    const palette = [0x086cff, 0x09d7f5, 0xffb800, 0x00d88a, 0xff2e70, 0x086cff];

    let idx = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const geo = new THREE.BoxGeometry(sw * 0.94, sh * 0.94, 0.1);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x0e1830, metalness: 0.5, roughness: 0.35, transparent: true, opacity: 1
      });
      const m = new THREE.Mesh(geo, mat);
      const line = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: palette[idx % palette.length], transparent: true, opacity: 0.9 })
      );
      m.add(line);

      const p0 = {
        pos: new THREE.Vector3((c - (COLS - 1) / 2) * sw, ((ROWS - 1) / 2 - r) * sh, 0),
        rot: new THREE.Euler(0, 0, 0)
      };
      const gc = idx % 4, gr = Math.floor(idx / 4);
      const spread = isMobile ? 1.05 : 1.85;
      const p1 = {
        pos: new THREE.Vector3((gc - 1.5) * spread, (1 - gr) * spread * 0.78, 1.6),
        rot: new THREE.Euler((Math.random() - .5) * 0.2, (Math.random() - .5) * 0.35, (Math.random() - .5) * 0.12)
      };
      let p2;
      if (idx < 6) {
        p2 = {
          pos: new THREE.Vector3((idx % 3 - 1) * (LW / 3.2), -0.75, (idx < 3 ? -0.5 : 0.35)),
          rot: new THREE.Euler(-Math.PI / 2, 0, 0)
        };
      } else {
        const j = idx - 6;
        p2 = {
          pos: new THREE.Vector3((j % 3 - 1) * (LW / 3.2), 0.35 + (j < 3 ? 0.7 : 0), -1.1),
          rot: new THREE.Euler(-0.18, 0, 0)
        };
      }
      m.userData = { p0, p1, p2 };
      slabGroup.add(m); slabs.push(m); idx++;
    }
  }

  /* ============================================================
     3) LAPTOP – base + coperchio che si apre
  ============================================================ */
  function buildLaptop() {
    laptop = new THREE.Group(); laptop.visible = false; scene.add(laptop);
    const alu = () => new THREE.MeshStandardMaterial({
      color: 0x1b2740, metalness: 0.7, roughness: 0.3, transparent: true, opacity: 0
    });

    const base = new THREE.Mesh(new THREE.BoxGeometry(LW, LT, LDp), alu());
    laptop.add(base);

    const kb = document.createElement("canvas"); kb.width = 512; kb.height = 328;
    const kg = kb.getContext("2d");
    kg.fillStyle = "#0b1322"; kg.fillRect(0, 0, 512, 328);
    kg.fillStyle = "#15203a";
    for (let r = 0; r < 5; r++) for (let c = 0; c < 13; c++)
      kg.fillRect(14 + c * 38, 16 + r * 42, 32, 34);
    kg.fillRect(150, 236, 212, 40);
    kg.fillStyle = "#0e1830"; kg.fillRect(166, 288, 180, 32);
    kg.strokeStyle = "#09d7f5"; kg.strokeRect(166, 288, 180, 32);
    const kbTex = new THREE.CanvasTexture(kb);
    const kbPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(LW * 0.94, LDp * 0.9),
      new THREE.MeshBasicMaterial({ map: kbTex, transparent: true, opacity: 0 })
    );
    kbPlane.rotation.x = -Math.PI / 2;
    kbPlane.position.y = LT / 2 + 0.004; laptop.add(kbPlane);

    lidPivot = new THREE.Group();
    lidPivot.position.set(0, LT / 2, -LDp / 2);
    laptop.add(lidPivot);
    lid = new THREE.Group();
    const lidBody = new THREE.Mesh(new THREE.BoxGeometry(LW, LDp, 0.1), alu());
    lidBody.position.y = LDp / 2; lid.add(lidBody);

    const lc = document.createElement("canvas"); lc.width = 512; lc.height = 320;
    lapCtx = lc.getContext("2d");
    lapTex = new THREE.CanvasTexture(lc);
    const lidScreen = new THREE.Mesh(
      new THREE.PlaneGeometry(LW * 0.92, LDp * 0.86),
      new THREE.MeshBasicMaterial({ map: lapTex, transparent: true, opacity: 0 })
    );
    lidScreen.position.set(0, LDp / 2, 0.055); lid.add(lidScreen);

    const lidEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(LW, LDp, 0.1)),
      new THREE.LineBasicMaterial({ color: 0x09d7f5, transparent: true, opacity: 0 })
    );
    lidEdge.position.y = LDp / 2; lid.add(lidEdge);

    lidPivot.add(lid);
    lid.rotation.x = Math.PI / 2 - 0.12;
    laptop.userData = { base, kbPlane, lidBody, lidScreen, lidEdge };
  }

  /* ============================================================
     SCHERMI DINAMICI
  ============================================================ */
  const REELS = [
    { c1: "#0d3a1e", c2: "#062713", cap: "TOP 5 GOL DELLA SETTIMANA ⚽", likes: "128K" },
    { c1: "#3a0d22", c2: "#270616", cap: "POV: alleni la squadra alle 6 🥶", likes: "89K" },
    { c1: "#0d2a3a", c2: "#061a27", cap: "SKILL CHALLENGE con @creator 🔥", likes: "312K" },
    { c1: "#3a2a0d", c2: "#271b06", cap: "Il tuo BRAND merita questo hook", likes: "54K" },
    { c1: "#1c0d3a", c2: "#120627", cap: "UGC che converte davvero 📱", likes: "201K" },
    { c1: "#0d3a35", c2: "#062723", cap: "RECAP partita in 30 secondi 🎬", likes: "97K" }
  ];

  function drawFeed(now) {
    if (now - lastFeed < 50) return; lastFeed = now;
    const g = feedCtx, W = 320, H = 656, t = now / 1000;
    const total = (REELS.length - 1) * H;
    const off = S.feedProgress * total;

    g.fillStyle = "#03050b"; g.fillRect(0, 0, W, H);
    const first = Math.floor(off / H);
    for (let k = first; k <= first + 1 && k < REELS.length; k++) {
      const R = REELS[k], y = k * H - off;
      const grd = g.createLinearGradient(0, y, 0, y + H);
      grd.addColorStop(0, R.c1); grd.addColorStop(1, R.c2);
      g.fillStyle = grd; g.fillRect(0, y, W, H);

      const bx = W / 2 + Math.sin(t * 1.3 + k) * 60, by = y + H / 2 + Math.cos(t * 1.1 + k) * 80;
      g.fillStyle = "rgba(255,255,255,.92)"; g.beginPath(); g.arc(bx, by, 12, 0, 7); g.fill();
      g.strokeStyle = "#09D7F5"; g.setLineDash([6, 6]); g.lineWidth = 2;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 46, by - 52); g.stroke(); g.setLineDash([]);

      g.fillStyle = "rgba(255,255,255,.9)"; g.font = "22px Inter";
      g.fillText("♥", W - 42, y + H - 240); g.fillText("💬", W - 46, y + H - 180);
      g.fillText("↪", W - 42, y + H - 120);
      g.font = "600 11px Inter"; g.fillStyle = "#c8d2e4";
      g.fillText(R.likes, W - 50, y + H - 218);

      g.fillStyle = "rgba(3,5,11,.72)"; g.fillRect(0, y + H - 86, W, 86);
      g.fillStyle = "#F5F7FA"; g.font = "700 14px Inter";
      g.fillText(R.cap, 16, y + H - 52);
      g.fillStyle = "#8A94A8"; g.font = "600 10px Inter";
      g.fillText("@shortform.studio · sound originale", 16, y + H - 30);
      g.fillStyle = "#086CFF";
      g.fillRect(0, y + H - 4, W * ((t * 0.21 + k * 0.3) % 1), 4);
    }

    g.fillStyle = "rgba(3,5,11,.55)"; g.fillRect(0, 0, W, 44);
    g.fillStyle = "#F5F7FA"; g.font = "800 13px Inter"; g.textAlign = "center";
    g.fillText("Per te   |   Seguiti", W / 2, 28); g.textAlign = "left";

    if (S.glitch > 0.02) {
      if (Math.sin(t * 9) > 0) { g.fillStyle = `rgba(255,46,112,${0.16 * S.glitch})`; g.fillRect(0, 0, W, H); }
      g.globalAlpha = S.glitch;
      g.fillStyle = "rgba(3,5,11,.92)"; g.fillRect(34, 250, W - 68, 64);
      g.strokeStyle = "#FF2E70"; g.strokeRect(34, 250, W - 68, 64);
      g.fillStyle = "#FF2E70"; g.font = "800 15px Inter"; g.textAlign = "center";
      g.fillText("⚠ LOW RETENTION", W / 2, 278);
      g.fillStyle = "#8A94A8"; g.font = "600 10px Inter";
      g.fillText("il pubblico scorre oltre", W / 2, 298);
      g.textAlign = "left"; g.globalAlpha = 1;
    }
    feedTex.needsUpdate = true;
  }

  function drawLaptop(now) {
    if (!laptop.visible || now - lastLap < 66) return; lastLap = now;
    const g = lapCtx, W = 512, H = 320, t = now / 1000;
    g.fillStyle = "#050810"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#0A1020"; g.fillRect(0, 0, W, 40);
    g.fillStyle = "#F5F7FA"; g.font = "800 15px Inter"; g.fillText("SHORT FORM / EDIT", 16, 26);
    g.fillStyle = "#00D88A"; g.font = "700 11px Inter"; g.fillText("● REC", W - 60, 26);

    if (S.laptopScreen === "cta") {
      const p = (Math.sin(t * 3) + 1) / 2;
      g.strokeStyle = `rgba(9,215,245,${0.35 + p * 0.5})`; g.lineWidth = 2 + p * 2;
      g.beginPath(); g.arc(W / 2, 140, 46 + p * 6, 0, 7); g.stroke();
      g.fillStyle = "#086CFF"; g.beginPath();
      g.moveTo(W / 2 - 13, 118); g.lineTo(W / 2 + 21, 140); g.lineTo(W / 2 - 13, 162); g.closePath(); g.fill();
      g.fillStyle = "#F5F7FA"; g.font = "800 24px Inter"; g.textAlign = "center";
      g.fillText("INIZIA ORA", W / 2, 234);
      g.font = "600 12px Inter"; g.fillStyle = "#8A94A8"; g.fillText("vert-ex.it", W / 2, 258);
      g.textAlign = "left";
    } else {
      const cols = ["#086CFF", "#09D7F5", "#FFB800", "#00D88A"];
      ["V1", "V2", "SFX", "MUS"].forEach((tr, i) => {
        const y = 62 + i * 58;
        g.fillStyle = "#8A94A8"; g.font = "700 11px Inter"; g.fillText(tr, 12, y + 22);
        g.fillStyle = "rgba(245,247,250,.05)"; g.fillRect(44, y, W - 60, 36);
        for (let k = 0; k < 4; k++) {
          g.fillStyle = cols[(i + k) % 4]; g.globalAlpha = .85;
          g.fillRect(50 + k * 108 + (i % 2) * 22, y + 4, 88, 28);
          g.globalAlpha = 1;
        }
      });
      const px = 44 + (W - 60) * Math.min(1, S.activeProcessStep / 4);
      g.strokeStyle = "#FF2E70"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(px, 50); g.lineTo(px, H - 18); g.stroke();
      g.fillStyle = "#FF2E70";
      g.beginPath(); g.moveTo(px - 7, 50); g.lineTo(px + 7, 50); g.lineTo(px, 62); g.closePath(); g.fill();
      g.fillStyle = "#8A94A8"; g.font = "600 11px Inter";
      g.fillText("STEP 0" + Math.max(1, Math.round(S.activeProcessStep)) + " / 04", 12, H - 10);
    }
    lapTex.needsUpdate = true;
  }

  /* ============================================================
     APPLICAZIONE STATO + LOOP
  ============================================================ */
  const ez = (x) => x < .5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;

  function applyState(t) {
    const float = reduced ? 0 : Math.sin(t * 0.9) * 0.07;
    const scGlobal = isMobile ? 0.72 : isTablet ? 0.88 : 1;

    const showPhone = S.explodeProgress < 0.03;
    phone.visible = showPhone;
    if (showPhone) {
      phone.position.set(S.phonePos.x, S.phonePos.y + float, S.phonePos.z);
      phone.rotation.set(
        S.phoneRot.x + (isMobile ? 0 : mouse.y * 0.1),
        S.phoneRot.y + (isMobile ? 0 : mouse.x * 0.2),
        S.phoneRot.z
      );
      const s = S.phoneScale * scGlobal;
      phone.scale.set(s, s, s);
    }

    const showSlabs = S.explodeProgress >= 0.03 && S.gatherProgress < 0.98;
    slabGroup.visible = showSlabs;
    if (showSlabs) {
      const e = ez(S.explodeProgress), gth = ez(S.gatherProgress);
      slabGroup.position.set(
        S.phonePos.x * (1 - e),
        (S.phonePos.y + float) * (1 - e) - 0.2 * gth,
        S.phonePos.z * (1 - e) + 0.6 * e
      );
      slabGroup.scale.setScalar(scGlobal);
      slabs.forEach((m) => {
        const { p0, p1, p2 } = m.userData;
        const px = lerp3(p0.pos, p1.pos, e), rx = lerpE(p0.rot, p1.rot, e);
        m.position.set(
          px.x + (p2.pos.x - px.x) * gth,
          px.y + (p2.pos.y - px.y) * gth,
          px.z + (p2.pos.z - px.z) * gth
        );
        m.rotation.set(
          rx.x + (p2.rot.x - rx.x) * gth,
          rx.y + (p2.rot.y - rx.y) * gth,
          rx.z + (p2.rot.z - rx.z) * gth
        );
        const op = 1 - Math.max(0, (gth - 0.55) / 0.45);
        m.material.opacity = op;
        m.children[0].material.opacity = 0.9 * op;
      });
    }

    const g = ez(S.gatherProgress);
    laptop.visible = g > 0.35;
    if (laptop.visible) {
      const u = laptop.userData;
      const op = Math.min(1, (g - 0.35) / 0.4);
      [u.base.material, u.lidBody.material].forEach(m => m.opacity = op);
      u.kbPlane.material.opacity = op;
      u.lidScreen.material.opacity = op;
      u.lidEdge.material.opacity = op * 0.7;

      const f = ez(S.forwardProgress);
      laptop.position.set(
        S.laptopPos.x,
        S.laptopPos.y + float * 0.6 - 0.1 * f,
        S.laptopPos.z + f * 4.6
      );
      laptop.rotation.y = S.laptopRotY + (isMobile ? 0 : mouse.x * 0.12);
      laptop.rotation.x = 0.12 + (isMobile ? 0 : mouse.y * 0.08);
      const ls = (0.72 + 0.28 * g) * (1 + f * 0.12) * scGlobal;
      laptop.scale.set(ls, ls, ls);

      lid.rotation.x = (Math.PI / 2 - 0.12) * (1 - ez(S.lidOpen)) - 0.22 * ez(S.lidOpen);
    }
  }

  function lerp3(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
  }
  function lerpE(a, b, t) {
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
  }

  function loop(now) {
    if (!running) return;
    applyState(now / 1000);
    drawFeed(now);
    drawLaptop(now);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
