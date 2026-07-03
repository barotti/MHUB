/* ============================================================
   Short Form Content - scroll-animations.js
   Tutte le timeline GSAP + ScrollTrigger.
   Le timeline SCRIVONO su window.VERTEX_STATE,
   il render loop 3D LEGGE i valori (three-scene.js).
============================================================ */
(function () {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = window.matchMedia("(max-width: 720px)").matches;
  const isTablet = window.matchMedia("(max-width: 1080px)").matches;

  window.addEventListener("load", init);

  function init() {
    if (typeof gsap === "undefined") { staticFallback(); return; }
    gsap.registerPlugin(ScrollTrigger);
    const S = window.VERTEX_STATE;

    /* ============ REDUCED MOTION: solo fade semplici ============ */
    if (prefersReduced) {
      gsap.utils.toArray(".reveal").forEach(el => gsap.set(el, { opacity: 1, y: 0 }));
      document.querySelectorAll(".mask-line span").forEach(s => s.style.transform = "none");
      document.querySelectorAll(".pstep").forEach(p => p.classList.add("active"));
      /* contatori: valore finale immediato */
      document.querySelectorAll(".m-value").forEach(el => {
        el.textContent = Number(el.dataset.value).toLocaleString("it-IT");
      });
      const rp = document.getElementById("retentionPath");
      if (rp) rp.style.strokeDasharray = "none";
      return;
    }

    const ctx = gsap.context(() => {

      /* ============ REVEAL GENERICO ============ */
      gsap.utils.toArray(".reveal").forEach((el) => {
        gsap.to(el, {
          opacity: 1, y: 0, duration: 0.9, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%" }
        });
      });

      /* ============ HERO: intro + ingresso telefono ============ */
      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro
        .to(".mask-line span", { y: 0, duration: 1.1, stagger: 0.12 }, 0.15)
        .to(S.phonePosition, { y: 0, x: phoneX(2.3), duration: 1.6, ease: "power2.out" }, 0.3)
        .to(S.phoneRotation, { y: -0.35, duration: 1.6 }, 0.3);

      /* leggero avvicinamento della camera legato allo scroll dell'hero */
      gsap.to(S.phonePosition, {
        z: 1.2,
        scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: 0.6 }
      });
      gsap.to(S.phoneRotation, {
        y: 0.4,
        scrollTrigger: { trigger: "#hero", start: "top top", end: "bottom top", scrub: 0.6 }
      });

      /* ============ PROBLEMA: schermo in modalità glitch ============ */
      ScrollTrigger.create({
        trigger: "#problema", start: "top 60%", end: "bottom 40%",
        onEnter: () => S.screenMode = "glitch",
        onEnterBack: () => S.screenMode = "glitch",
        onLeave: () => S.screenMode = "clip",
        onLeaveBack: () => S.screenMode = "clip"
      });
      /* telefono a destra, leggermente inclinato "in difficoltà" */
      gsap.to(S.phonePosition, {
        x: phoneX(2.6), z: 0,
        scrollTrigger: { trigger: "#problema", start: "top bottom", end: "top 20%", scrub: 0.6 }
      });
      gsap.to(S.phoneRotation, {
        z: -0.12, y: -0.2,
        scrollTrigger: { trigger: "#problema", start: "top bottom", end: "top 20%", scrub: 0.6 }
      });
      /* retention line SVG: disegno in negativo */
      const rp = document.getElementById("retentionPath");
      if (rp) {
        const len = rp.getTotalLength();
        gsap.set(rp, { strokeDasharray: len, strokeDashoffset: len });
        gsap.to(rp, {
          strokeDashoffset: 0, ease: "none",
          scrollTrigger: { trigger: "#problema", start: "top 50%", end: "center 40%", scrub: true }
        });
      }

      /* ============ SOLUZIONE: esplosione layer (pinned) ============ */
      S.screenModeDefault = "clip";
      const exp = gsap.timeline({
        scrollTrigger: {
          trigger: "#soluzione", start: "top top", end: "+=140%",
          scrub: 0.8, pin: !isMobile, anticipatePin: 1
        }
      });
      exp
        /* il telefono viene al centro e si raddrizza */
        .to(S.phonePosition, { x: phoneX(1.9), y: 0, z: 1.6, duration: 0.2 }, 0)
        .to(S.phoneRotation, { x: 0, y: 0.15, z: 0, duration: 0.2 }, 0)
        /* esplosione */
        .to(S, { explodedProgress: 1, duration: 0.35, ease: "none" }, 0.2)
        .to(S.phoneRotation, { y: 0.55, duration: 0.35 }, 0.2)
        /* pausa contemplativa */
        .to({}, { duration: 0.15 }, 0.55)
        /* ricomposizione */
        .to(S, { explodedProgress: 0, duration: 0.3, ease: "power1.inOut" }, 0.7)
        .to(S.phoneRotation, { y: -0.2, duration: 0.3 }, 0.7);

      /* ============ PROCESSO: telefono → timeline ============ */
      gsap.timeline({
        scrollTrigger: { trigger: "#processo", start: "top 70%", end: "top 15%", scrub: 0.6 }
      })
        .to(S.phoneRotation, { z: -Math.PI / 2, y: 0, x: 0 }, 0)
        .to(S.phonePosition, { x: phoneX(2.2), y: 0.4, z: 0.6 }, 0)
        .call(() => S.screenMode = "timeline", null, 0.5);

      ScrollTrigger.create({
        trigger: "#processo", start: "top 60%", end: "bottom 60%",
        onEnter: () => S.screenMode = "timeline",
        onEnterBack: () => S.screenMode = "timeline",
        onLeaveBack: () => S.screenMode = "clip"
      });

      /* attivazione step al centro viewport + counter 01/04 */
      const counter = document.getElementById("stepCounter");
      gsap.utils.toArray(".pstep").forEach((el) => {
        ScrollTrigger.create({
          trigger: el, start: "top 62%", end: "bottom 30%",
          onToggle: (st) => {
            if (st.isActive) {
              document.querySelectorAll(".pstep").forEach(p => p.classList.remove("active"));
              el.classList.add("active");
              const n = Number(el.dataset.step);
              window.VERTEX_STATE.activeProcessStep = n;
              if (counter) counter.textContent = "0" + n + " / 04";
            }
          }
        });
      });
      /* uscendo dal processo la "timeline" torna telefono */
      gsap.timeline({
        scrollTrigger: { trigger: "#processo", start: "bottom 70%", end: "bottom 20%", scrub: 0.6 }
      })
        .to(S.phoneRotation, { z: 0, y: -0.3 }, 0)
        .call(() => S.screenMode = "clip", null, 0.8);

      /* ============ BEFORE / AFTER: slider da scroll ============ */
      /* il telefono si fa da parte per lasciare la scena allo slider */
      gsap.to(S.phonePosition, {
        x: phoneX(4.6), z: -2,
        scrollTrigger: { trigger: "#beforeafter", start: "top 90%", end: "top 30%", scrub: 0.6 }
      });
      gsap.to(S, {
        beforeAfterProgress: 1, ease: "none",
        scrollTrigger: {
          trigger: "#beforeafter", start: "top 20%", end: "bottom bottom", scrub: true,
          onUpdate: (st) => {
            const p = st.progress * 100;
            const after = document.getElementById("baAfter");
            const div = document.getElementById("baDivider");
            if (after) after.style.clipPath = `inset(0 0 0 ${100 - p}%)`;
            if (div) div.style.left = (100 - p) + "%";
          }
        }
      });

      /* ============ PACCHETTI: ingresso moduli nello spazio ============ */
      gsap.from(".module", {
        opacity: 0, y: 90, rotateY: -28, z: -160, stagger: 0.12,
        duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: "#modules", start: "top 82%" }
      });
      /* telefono a sinistra, di nuovo in modalità clip */
      gsap.to(S.phonePosition, {
        x: phoneX(-3.4), z: -1,
        scrollTrigger: { trigger: "#pacchetti", start: "top 80%", end: "top 20%", scrub: 0.6 }
      });
      gsap.to(S.phoneRotation, {
        y: 0.5, z: 0,
        scrollTrigger: { trigger: "#pacchetti", start: "top 80%", end: "top 20%", scrub: 0.6 }
      });

      /* ============ RISULTATI: counter una sola volta ============ */
      gsap.utils.toArray(".m-value").forEach((el) => {
        const target = Number(el.dataset.value);
        ScrollTrigger.create({
          trigger: el, start: "top 88%", once: true,
          onEnter: () => {
            const o = { v: 0 };
            gsap.to(o, {
              v: target, duration: 1.8, ease: "power2.out",
              onUpdate: () => el.textContent = Math.round(o.v).toLocaleString("it-IT")
            });
          }
        });
      });

      /* ============ FINALE: ricomposizione + impulso + logo ============ */
      const fin = gsap.timeline({
        scrollTrigger: { trigger: "#contatti", start: "top 80%", end: "top 5%", scrub: 0.7 }
      });
      fin
        .to(S.phonePosition, { x: phoneX(3), y: 0.2, z: 2.2 }, 0)
        .to(S.phoneRotation, { x: 0, y: 0, z: 0 }, 0)
        .to(S, { explodedProgress: 0 }, 0)
        .call(() => S.screenMode = "cta", null, 0.35)
        /* impulso blu/ciano lungo il bordo */
        .to(S, { glowIntensity: 1, duration: 0.2 }, 0.5)
        .to(S, { glowIntensity: 0.15, duration: 0.2 }, 0.75)
        /* il telefono arretra e "entra" nel logo */
        .to(S.phonePosition, { z: -0.5, x: phoneX(2.4) }, 0.8)
        .to(S, { phoneScale: 0.85 }, 0.8);

      /* ============ NAVBAR: sezione attiva ============ */
      const links = document.querySelectorAll(".nav-link");
      const map = { soluzione: "#soluzione", processo: "#processo", pacchetti: "#pacchetti", risultati: "#risultati", contatti: "#contatti" };
      Object.values(map).forEach((sel) => {
        ScrollTrigger.create({
          trigger: sel, start: "top 45%", end: "bottom 45%",
          onToggle: (st) => {
            if (!st.isActive) return;
            links.forEach(l => l.classList.toggle("active", l.getAttribute("href") === sel));
          }
        });
      });

    });

    /* refresh dopo il caricamento completo degli asset */
    ScrollTrigger.refresh();
    window.addEventListener("beforeunload", () => ctx.revert());
  }

  /* posizione X del telefono: su mobile resta centrato/ridotto */
  function phoneX(x) {
    if (isMobile) return 0;
    if (isTablet) return x * 0.7;
    return x;
  }

  /* fallback senza GSAP: tutto visibile e statico */
  function staticFallback() {
    document.querySelectorAll(".reveal").forEach(el => {
      el.style.opacity = 1; el.style.transform = "none";
    });
    document.querySelectorAll(".mask-line span").forEach(s => s.style.transform = "none");
    document.querySelectorAll(".pstep").forEach(p => p.classList.add("active"));
    document.querySelectorAll(".m-value").forEach(el => {
      el.textContent = Number(el.dataset.value).toLocaleString("it-IT");
    });
  }
})();
