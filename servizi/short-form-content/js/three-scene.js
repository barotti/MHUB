/* ============================================================
   Short Form Content - three-scene.js
   Smartphone 3D procedurale + layer esplodibili + schermo dinamico.

   Lo stato è centralizzato in window.VERTEX_STATE:
   le timeline GSAP (scroll-animations.js) SCRIVONO i valori,
   il render loop qui li LEGGE ad ogni frame.
============================================================ */
(function () {
  "use strict";

  /* ---------------- stato centralizzato ---------------- */
  window.VERTEX_STATE = {
    phonePosition: { x: 2.2, y: -6, z: 0 },   // parte fuori scena, dal basso
    phoneRotation: { x: 0, y: -0.35, z: 0 },
    phoneScale: 1,
    explodedProgress: 0,     // 0 = ricomposto, 1 = esploso
    glowIntensity: 0,        // impulso lungo il bordo (finale)
    activeProcessStep: 0,    // 0..4
    beforeAfterProgress: 0,  // 0..1
    selectedPackage: null,   // id pacchetto
    screenMode: "clip"       // clip | glitch | timeline | cta
  };

  const S = window.VERTEX_STATE;
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = window.matchMedia("(max-width: 720px)").matches;
  const isTablet = window.matchMedia("(max-width: 1080px)").matches;

  /* ---------------- guardie: WebGL / Three ---------------- */
  function webglAvailable() {
    try {
      const c = document.createElement("canvas");
      return !!(window.WebGLRenderingContext &&
        (c.getContext("webgl") || c.getContext("experimental-webgl")));
    } catch (e) { return false; }
  }

  window.VERTEX_HAS_3D = false;

  function boot() {
    if (typeof THREE === "undefined" || !webglAvailable()) {
      const warn = document.getElementById("noWebgl");
      if (warn) warn.hidden = false;
      const wrap = document.querySelector(".gl-wrap");
      if (wrap) wrap.style.display = "none";
      document.documentElement.classList.add("no-3d");
      return;
    }
    window.VERTEX_HAS_3D = true;
    init();
  }

  /* ============================================================
     INIT SCENA
  ============================================================ */
  let renderer, scene, camera, phone, layers = [], edgeLine, screenCtx, screenTex;
  let labelEls = [];
  let mouse = { x: 0, y: 0 };
  let running = true;
  let lastDraw = 0;

  function init() {
    const canvas = document.getElementById("gl-canvas");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // cap DPR
    renderer.setSize(window.innerWidth, window.innerHeight);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 60);
    camera.position.set(0, 0, 9);

    /* luci: poche e semplici (performance) */
    scene.add(new THREE.AmbientLight(0x8090b0, 0.55));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(3, 4, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x086cff, 1.1);
    rim.position.set(-5, 1, -4);
    scene.add(rim);
    const cyanFill = new THREE.PointLight(0x09d7f5, 0.7, 20);
    cyanFill.position.set(0, -3, 5);
    scene.add(cyanFill);

    buildPhoneProcedural();
    tryOptionalGLB(); // se assets/models/vertex-phone.glb esiste lo usa, altrimenti resta il procedurale
    buildLabels();

    window.addEventListener("resize", onResize);
    if (!isMobile && !prefersReduced) {
      window.addEventListener("pointermove", (e) => {
        mouse.x = (e.clientX / window.innerWidth - 0.5);
        mouse.y = (e.clientY / window.innerHeight - 0.5);
      }, { passive: true });
    }
    /* pausa quando la tab non è visibile */
    document.addEventListener("visibilitychange", () => {
      running = !document.hidden;
      if (running) requestAnimationFrame(loop);
    });

    if (prefersReduced) {
      /* stato statico: telefono frontale, un solo render */
      S.phonePosition = { x: isMobile ? 0 : 2.2, y: 0, z: 0 };
      S.phoneRotation = { x: 0, y: -0.25, z: 0 };
      applyState(0);
      renderer.render(scene, camera);
      return;
    }
    requestAnimationFrame(loop);
  }

  /* ============================================================
     COSTRUZIONE TELEFONO PROCEDURALE
     Dispositivo generico premium, nessun marchio.
  ============================================================ */
  const PHONE_W = 1.9, PHONE_H = 3.9, PHONE_D = 0.16, R = 0.28;

  function roundedRectShape(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  function buildPhoneProcedural() {
    phone = new THREE.Group();
    scene.add(phone);

    /* ---- FRAME (scocca) ---- */
    const frameGeo = new THREE.ExtrudeGeometry(roundedRectShape(PHONE_W, PHONE_H, R), {
      depth: PHONE_D, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: isMobile ? 1 : 3, curveSegments: isMobile ? 8 : 20
    });
    frameGeo.translate(0, 0, -PHONE_D / 2);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0d1424, metalness: 0.75, roughness: 0.32 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    addLayer(frame, "FRAME", 0, -1.6);

    /* bordo luminoso (impulso finale) */
    const edgeGeo = new THREE.EdgesGeometry(new THREE.ExtrudeGeometry(roundedRectShape(PHONE_W + 0.02, PHONE_H + 0.02, R), { depth: PHONE_D + 0.02, bevelEnabled: false, curveSegments: 14 }));
    edgeGeo.translate(0, 0, -(PHONE_D + 0.02) / 2);
    edgeLine = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0x09d7f5, transparent: true, opacity: 0 }));
    phone.add(edgeLine);

    /* ---- CAMERA MODULE (retro) ---- */
    const camGroup = new THREE.Group();
    const camPlate = new THREE.Mesh(
      new THREE.ExtrudeGeometry(roundedRectShape(0.62, 0.62, 0.16), { depth: 0.05, bevelEnabled: false, curveSegments: 10 }),
      new THREE.MeshStandardMaterial({ color: 0x131c30, metalness: 0.8, roughness: 0.3 })
    );
    camGroup.add(camPlate);
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x05070d, metalness: 0.4, roughness: 0.15 });
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x086cff, metalness: 0.6, roughness: 0.4 });
    [[-0.14, 0.14], [0.14, 0.14], [-0.14, -0.14]].forEach(([lx, ly]) => {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.06, 20), ringMat);
      ring.rotation.x = Math.PI / 2; ring.position.set(lx, ly, 0.06); camGroup.add(ring);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 20), lensMat);
      lens.rotation.x = Math.PI / 2; lens.position.set(lx, ly, 0.065); camGroup.add(lens);
    });
    camGroup.position.set(PHONE_W / 2 - 0.45, PHONE_H / 2 - 0.45, -PHONE_D / 2 - 0.02);
    camGroup.rotation.y = Math.PI; // guarda indietro
    addLayer(camGroup, "CAMERA MODULE", 0, -2.4);

    /* ---- DISPLAY (schermo con canvas dinamico) ---- */
    const sw = PHONE_W - 0.18, sh = PHONE_H - 0.18;
    const screenCanvas = document.createElement("canvas");
    screenCanvas.width = 288; screenCanvas.height = 592;
    screenCtx = screenCanvas.getContext("2d");
    screenTex = new THREE.CanvasTexture(screenCanvas);
    const display = new THREE.Mesh(
      new THREE.PlaneGeometry(sw, sh),
      new THREE.MeshBasicMaterial({ map: screenTex })
    );
    display.position.z = PHONE_D / 2 + 0.012;
    addLayer(display, "DISPLAY", 0.012, 0.5);

    /* ---- LAYER EDITING (piani sottili sopra il display) ----
       visibili davvero solo durante l'esplosione */
    layersPlane("VIDEO",           0.014, 1.0, makeVideoLayerTex(sw, sh));
    layersPlane("SOTTOTITOLI",     0.016, 1.5, makeSubtitleTex());
    layersPlane("MOTION GRAPHICS", 0.018, 2.0, makeMotionTex());
    layersPlane("COLOR GRADING",   0.020, 2.5, makeGradingTex(), 0.5);
    layersPlane("WAVEFORM AUDIO",  0.022, 3.0, makeWaveformTex());

    /* ---- VETRO frontale ---- */
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(sw + 0.06, sh + 0.06),
      new THREE.MeshStandardMaterial({ color: 0xaad4ff, transparent: true, opacity: 0.07, metalness: 0.9, roughness: 0.08, depthWrite: false })
    );
    glass.position.z = PHONE_D / 2 + 0.03;
    addLayer(glass, "VETRO FRONTALE", 0.03, 3.6);

    function layersPlane(name, zBase, zExp, texture, opacity) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(sw * 0.94, name === "SOTTOTITOLI" ? sh * 0.16 : name === "WAVEFORM AUDIO" ? sh * 0.14 : sh * 0.94),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: opacity ?? 0.92, depthWrite: false })
      );
      if (name === "SOTTOTITOLI") m.position.y = -sh * 0.28;
      if (name === "WAVEFORM AUDIO") m.position.y = -sh * 0.42;
      m.position.z = PHONE_D / 2 + zBase;
      m.material.userData.hideWhenComposed = true;
      m.material.opacity = 0; // nascosti da ricomposto
      addLayer(m, name, zBase, zExp, opacity ?? 0.92);
    }
  }

  /* registro layer: base z, z esploso, opacità target */
  function addLayer(obj, label, zBase, zExploded, opTarget) {
    phone.add(obj);
    layers.push({
      obj, label,
      baseZ: obj.position.z,
      explodedZ: zExploded,
      baseX: obj.position.x, baseY: obj.position.y,
      opTarget: opTarget ?? null
    });
  }

  /* ---------------- texture 2D dei layer ---------------- */
  function cnv(w, h, draw) {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const t = new THREE.CanvasTexture(c); return t;
  }
  function makeVideoLayerTex(w, h) {
    return cnv(256, 512, (g) => {
      const grd = g.createLinearGradient(0, 0, 0, 512);
      grd.addColorStop(0, "#123c1e"); grd.addColorStop(1, "#0a2413");
      g.fillStyle = grd; g.fillRect(0, 0, 256, 512);
      g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 3;
      g.strokeRect(20, 60, 216, 380); // campo
      g.beginPath(); g.moveTo(20, 250); g.lineTo(236, 250); g.stroke();
      g.beginPath(); g.arc(128, 250, 42, 0, 7); g.stroke();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(150, 200, 8, 0, 7); g.fill();
    });
  }
  function makeSubtitleTex() {
    return cnv(256, 64, (g) => {
      g.fillStyle = "rgba(5,8,16,.85)"; g.fillRect(8, 8, 240, 48);
      g.fillStyle = "#F5F7FA"; g.font = "bold 21px Inter, sans-serif"; g.textAlign = "center";
      g.fillText("CHE GOL ASSURDO 🔥", 128, 40);
    });
  }
  function makeMotionTex() {
    return cnv(256, 512, (g) => {
      g.strokeStyle = "#09D7F5"; g.lineWidth = 2;
      g.strokeRect(30, 90, 110, 74);
      g.beginPath(); g.moveTo(140, 90); g.lineTo(200, 46); g.stroke();
      g.fillStyle = "#09D7F5"; g.font = "700 15px Inter"; g.fillText("PLAYER 10", 148, 40);
      g.strokeStyle = "#FFB800";
      g.beginPath(); g.moveTo(40, 420); g.quadraticCurveTo(130, 330, 220, 380); g.stroke();
      g.setLineDash([6, 6]); g.strokeStyle = "#FF2E70";
      g.beginPath(); g.moveTo(60, 470); g.lineTo(210, 470); g.stroke();
    });
  }
  function makeGradingTex() {
    return cnv(128, 256, (g) => {
      const grd = g.createLinearGradient(0, 0, 128, 256);
      grd.addColorStop(0, "rgba(8,108,255,.55)");
      grd.addColorStop(.5, "rgba(9,215,245,.25)");
      grd.addColorStop(1, "rgba(255,46,112,.4)");
      g.fillStyle = grd; g.fillRect(0, 0, 128, 256);
    });
  }
  function makeWaveformTex() {
    return cnv(256, 56, (g) => {
      g.fillStyle = "#00D88A";
      for (let x = 0; x < 256; x += 6) {
        const h = 8 + Math.abs(Math.sin(x * .35)) * 38;
        g.fillRect(x, 28 - h / 2, 3, h);
      }
    });
  }

  /* ---------------- GLB opzionale ---------------- */
  function tryOptionalGLB() {
    /* Se assets/models/vertex-phone.glb esiste, carichiamo GLTFLoader e lo usiamo.
       In caso di qualsiasi errore restiamo silenziosamente sul telefono procedurale.
       (via file:// il fetch può fallire: nessun problema, nessun errore in console) */
    fetch("assets/models/vertex-phone.glb", { method: "HEAD" }).then((r) => {
      if (!r.ok) return;
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js";
      s.onload = () => {
        new THREE.GLTFLoader().load("assets/models/vertex-phone.glb", (gltf) => {
          layers.forEach(l => { l.obj.visible = false; });
          phone.add(gltf.scene);
        }, undefined, () => { /* fallback: procedurale già visibile */ });
      };
      document.head.appendChild(s);
    }).catch(() => { /* nessun modello: ok */ });
  }

  /* ---------------- label tecniche HTML ---------------- */
  function buildLabels() {
    if (isMobile) return; // niente label su mobile
    const wrap = document.getElementById("layerLabels");
    layers.forEach((l) => {
      const el = document.createElement("span");
      el.className = "layer-label";
      el.textContent = l.label;
      wrap.appendChild(el);
      labelEls.push({ el, layer: l });
    });
  }

  const _v = new THREE.Vector3();
  function updateLabels() {
    if (isMobile || !labelEls.length) return;
    const show = S.explodedProgress > 0.45;
    labelEls.forEach(({ el, layer }) => {
      if (!show) { el.style.opacity = 0; return; }
      layer.obj.getWorldPosition(_v).project(camera);
      const x = (_v.x * 0.5 + 0.5) * window.innerWidth;
      const y = (-_v.y * 0.5 + 0.5) * window.innerHeight;
      el.style.left = (x + 70) + "px";
      el.style.top = y + "px";
      el.style.opacity = Math.min(1, (S.explodedProgress - 0.45) / 0.3);
    });
  }

  /* ============================================================
     SCHERMO DINAMICO (canvas 2D → texture)
  ============================================================ */
  let t0 = performance.now();
  function drawScreen(now) {
    if (now - lastDraw < 50) return; // ~20fps: basta ed è leggero
    lastDraw = now;
    const g = screenCtx, W = 288, H = 592;
    const t = (now - t0) / 1000;
    const mode = S.screenMode;

    /* base: clip sportiva */
    const grd = g.createLinearGradient(0, 0, 0, H);
    grd.addColorStop(0, "#0e3a1c"); grd.addColorStop(1, "#071f10");
    g.fillStyle = grd; g.fillRect(0, 0, W, H);

    const jitter = mode === "glitch" ? Math.sin(t * 30) * 4 : 0;

    /* campo + palla in movimento */
    g.save(); g.translate(jitter, 0);
    g.strokeStyle = "rgba(255,255,255,.45)"; g.lineWidth = 2;
    g.strokeRect(22, 90, W - 44, H - 220);
    g.beginPath(); g.moveTo(22, H / 2); g.lineTo(W - 22, H / 2); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, 40, 0, 7); g.stroke();
    const bx = W / 2 + Math.sin(t * 1.4) * 80, by = H / 2 + Math.cos(t * 1.1) * 120;
    g.fillStyle = "#fff"; g.beginPath(); g.arc(bx, by, 7, 0, 7); g.fill();
    /* linea di motion tracking sulla palla */
    g.strokeStyle = "#09D7F5"; g.setLineDash([5, 5]);
    g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 40, by - 46); g.stroke();
    g.setLineDash([]);
    g.fillStyle = "#09D7F5"; g.font = "700 11px Inter"; g.fillText("TRACK 01", bx + 44, by - 50);
    g.restore();

    /* score bug */
    g.fillStyle = "rgba(5,8,16,.85)"; g.fillRect(18, 26, 150, 34);
    g.fillStyle = "#086CFF"; g.fillRect(18, 26, 5, 34);
    g.fillStyle = "#F5F7FA"; g.font = "800 16px Inter"; g.fillText("VRX 2 – 1 ⚽", 34, 49);

    /* timecode */
    g.fillStyle = "#8A94A8"; g.font = "600 11px Inter";
    g.fillText("REC ● 00:" + String(Math.floor(t % 60)).padStart(2, "0") + ":" + String(Math.floor((t * 30) % 30)).padStart(2, "0"), 18, H - 26);

    if (mode === "glitch") {
      /* problemi: warning, retention che scende, frame drop */
      if (Math.sin(t * 8) > 0) {
        g.fillStyle = "rgba(255,46,112,.16)"; g.fillRect(0, 0, W, H);
      }
      g.fillStyle = "rgba(5,8,16,.9)"; g.fillRect(30, 200, 228, 60);
      g.strokeStyle = "#FF2E70"; g.strokeRect(30, 200, 228, 60);
      g.fillStyle = "#FF2E70"; g.font = "800 14px Inter"; g.textAlign = "center";
      g.fillText("⚠ LOW RETENTION", W / 2, 226);
      g.font = "600 10px Inter"; g.fillStyle = "#8A94A8";
      g.fillText("dropped frames · audio grezzo", W / 2, 246);
      g.textAlign = "left";
      /* retention line discendente */
      g.strokeStyle = "#FF2E70"; g.lineWidth = 3; g.beginPath();
      g.moveTo(30, 300);
      for (let x = 0; x <= 220; x += 10)
        g.lineTo(30 + x, 300 + Math.pow(x / 220, 1.6) * 120 + Math.sin(x * .3 + t * 4) * 4);
      g.stroke();
    }

    if (mode === "timeline") {
      /* editor: tracce + playhead guidato dagli step */
      g.fillStyle = "#050810"; g.fillRect(0, 0, W, H);
      g.fillStyle = "#0A1020"; g.fillRect(0, 0, W, 54);
      g.fillStyle = "#F5F7FA"; g.font = "800 15px Inter"; g.fillText("SHORT / EDIT", 16, 34);
      const tracks = ["V1", "V2", "SFX", "MUS"];
      const cols = ["#086CFF", "#09D7F5", "#FFB800", "#00D88A"];
      tracks.forEach((tr, i) => {
        const y = 110 + i * 92;
        g.fillStyle = "#8A94A8"; g.font = "700 11px Inter"; g.fillText(tr, 14, y + 26);
        g.fillStyle = "rgba(245,247,250,.05)"; g.fillRect(44, y, W - 60, 44);
        for (let k = 0; k < 3; k++) {
          g.fillStyle = cols[(i + k) % 4];
          g.globalAlpha = .85;
          g.fillRect(50 + k * 78 + (i % 2) * 18, y + 5, 62, 34);
          g.globalAlpha = 1;
        }
      });
      /* playhead: segue lo step attivo (0..4) */
      const px = 44 + (W - 60) * Math.min(1, S.activeProcessStep / 4);
      g.strokeStyle = "#FF2E70"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(px, 80); g.lineTo(px, H - 60); g.stroke();
      g.fillStyle = "#FF2E70"; g.beginPath();
      g.moveTo(px - 7, 80); g.lineTo(px + 7, 80); g.lineTo(px, 94); g.closePath(); g.fill();
      g.fillStyle = "#8A94A8"; g.font = "600 11px Inter";
      g.fillText("STEP 0" + Math.max(1, Math.round(S.activeProcessStep)) + " / 04", 16, H - 24);
    }

    if (mode === "cta") {
      g.fillStyle = "#050810"; g.fillRect(0, 0, W, H);
      const pulse = (Math.sin(t * 3) + 1) / 2;
      g.strokeStyle = "rgba(9,215,245," + (.3 + pulse * .5) + ")";
      g.lineWidth = 2 + pulse * 2;
      g.beginPath(); g.arc(W / 2, 240, 58 + pulse * 8, 0, 7); g.stroke();
      g.fillStyle = "#086CFF";
      g.beginPath(); g.moveTo(W / 2 - 16, 214); g.lineTo(W / 2 + 26, 240); g.lineTo(W / 2 - 16, 266); g.closePath(); g.fill();
      g.fillStyle = "#F5F7FA"; g.font = "800 26px Inter"; g.textAlign = "center";
      g.fillText("INIZIA ORA", W / 2, 360);
      g.font = "600 13px Inter"; g.fillStyle = "#8A94A8";
      g.fillText("vert-ex.it", W / 2, 390);
      g.textAlign = "left";
    }

    screenTex.needsUpdate = true;
  }

  /* ============================================================
     APPLICAZIONE STATO + RENDER LOOP
  ============================================================ */
  function applyState(t) {
    /* posizione / rotazione / scala dal state (+ parallasse mouse + idle float) */
    const float = prefersReduced ? 0 : Math.sin(t * 0.9) * 0.07;
    phone.position.set(S.phonePosition.x, S.phonePosition.y + float, S.phonePosition.z);
    phone.rotation.set(
      S.phoneRotation.x + (isMobile ? 0 : mouse.y * 0.12),
      S.phoneRotation.y + (isMobile ? 0 : mouse.x * 0.22),
      S.phoneRotation.z
    );
    const sc = S.phoneScale * (isMobile ? 0.8 : isTablet ? 0.9 : 1);
    phone.scale.set(sc, sc, sc);

    /* esplosione layer lungo Z */
    const e = S.explodedProgress;
    const eased = e < .5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2;
    layers.forEach((l) => {
      l.obj.position.z = l.baseZ + (l.explodedZ - l.baseZ) * eased;
      if (l.opTarget !== null) {
        /* i layer di editing appaiono solo esplosi */
        l.obj.material.opacity = l.opTarget * Math.min(1, eased * 1.6);
      }
    });

    /* impulso bordo */
    if (edgeLine) edgeLine.material.opacity = S.glowIntensity;
  }

  function loop(now) {
    if (!running) return;
    const t = now / 1000;
    applyState(t);
    drawScreen(now);
    updateLabels();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else { boot(); }
})();
