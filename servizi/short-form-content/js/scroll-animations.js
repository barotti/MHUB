/* ============================================================
   SHORT FORM – scroll-animations.js
   Coreografia dello scroll:
   HERO (pin)      → il feed scorre dentro il telefono
   PROBLEMA        → glitch sul feed
   SOLUZIONE (pin) → il telefono si apre in card → i servizi
   PROCESSO (pin)  → le card si fondono → laptop che si apre
   PACCHETTI       → il laptop ESCE dallo schermo (+ fulmini)
   FINALE          → schermo laptop in modalità CTA
============================================================ */
(function () {
  "use strict";

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isMobile = matchMedia("(max-width: 720px)").matches;
  const isTablet = matchMedia("(max-width: 1080px)").matches;

  addEventListener("load", init);

  function init() {
    if (typeof gsap === "undefined") { staticFallback(); return; }
    gsap.registerPlugin(ScrollTrigger);
    const S = window.VERTEX_STATE;

    /* ---------- reduced motion: stati statici ---------- */
    if (reduced) {
      gsap.utils.toArray(".reveal").forEach(el => gsap.set(el, { opacity: 1, y: 0 }));
      document.querySelectorAll(".mask-line span").forEach(s => s.style.transform = "none");
      document.querySelectorAll(".pstep").forEach(p => p.classList.add("active"));
      document.querySelectorAll(".m-value").forEach(el =>
        el.textContent = Number(el.dataset.value).toLocaleString("it-IT"));
      document.querySelectorAll("#servicesGrid .service").forEach(s => {
        s.style.opacity = 1; s.style.transform = "none";
      });
      const rp = document.getElementById("retentionPath");
      if (rp) rp.style.strokeDasharray = "none";
      S.gatherProgress = 1; S.lidOpen = 1; S.explodeProgress = 1;
      S.laptopPos = { x: isMobile ? 0 : 2.2, y: -0.4, z: 0 };
      return;
    }

    const X = (v) => isMobile ? 0 : isTablet ? v * 0.72 : v;

    const ctx = gsap.context(() => {

      /* ============ reveal generico ============ */
      gsap.utils.toArray(".reveal").forEach((el) => {
        gsap.to(el, {
          opacity: 1, y: 0, duration: 0.9, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%" }
        });
      });

      /* ============ HERO: ingresso + FEED CHE SCORRE (pin) ============ */
      gsap.timeline({ defaults: { ease: "power3.out" } })
        .to(".mask-line span", { y: 0, duration: 1.1, stagger: 0.12 }, 0.15)
        .to(S.phonePos, { y: 0, x: X(2.6), duration: 1.6, ease: "power2.out" }, 0.3)
        .to(S.phoneRot, { y: -0.42, duration: 1.6 }, 0.3);

      const heroPin = gsap.timeline({
        scrollTrigger: {
          trigger: "#hero", start: "top top", end: "+=220%",
          scrub: 0.5, pin: true, anticipatePin: 1
        }
      });
      heroPin
        .to(S.phonePos, { x: X(2.3), z: 2.0, y: 0.1, ease: "none" }, 0)
        .to(S.phoneRot, { y: -0.16, x: 0.02, ease: "none" }, 0)
        .to(S, { feedProgress: 1, ease: "none" }, 0)
        .to(".hero-inner", { opacity: 0, y: -60, ease: "power1.in" }, 0.55)
        .to("#feedHint", { opacity: 1, duration: 0.15 }, 0.15)
        .to("#feedHint", { opacity: 0, duration: 0.15 }, 0.85);

      /* ============ PROBLEMA: glitch sul feed ============ */
      gsap.to(S, {
        glitch: 1, ease: "none",
        scrollTrigger: { trigger: "#problema", start: "top 70%", end: "top 25%", scrub: 0.5 }
      });
      gsap.to(S, {
        glitch: 0, ease: "none",
        scrollTrigger: { trigger: "#problema", start: "bottom 70%", end: "bottom 40%", scrub: 0.5 }
      });
      gsap.to(S.phonePos, {
        x: X(2.8), z: 0.4,
        scrollTrigger: { trigger: "#problema", start: "top bottom", end: "top 20%", scrub: 0.6 }
      });
      gsap.to(S.phoneRot, {
        z: -0.1, y: -0.3,
        scrollTrigger: { trigger: "#problema", start: "top bottom", end: "top 20%", scrub: 0.6 }
      });
      const rp = document.getElementById("retentionPath");
      if (rp) {
        const len = rp.getTotalLength();
        gsap.set(rp, { strokeDasharray: len, strokeDashoffset: len });
        gsap.to(rp, {
          strokeDashoffset: 0, ease: "none",
          scrollTrigger: { trigger: "#problema", start: "top 50%", end: "center 40%", scrub: true }
        });
      }

      /* ============ SOLUZIONE: telefono → CARD → servizi (pin) ============ */
      gsap.set("#servicesGrid .service", { opacity: 0, y: 46, rotateY: -14 });

      const boom = gsap.timeline({
        scrollTrigger: {
          trigger: "#soluzione", start: "top top", end: "+=190%",
          scrub: 0.6, pin: !isMobile, anticipatePin: 1,
          onUpdate(st) {
            if (!boom._zapped && st.progress > 0.1) {
              boom._zapped = true;
              window.FX.burst(innerWidth * (isMobile ? 0.5 : 0.62), innerHeight * 0.42, 5);
            }
            if (st.progress < 0.05) boom._zapped = false;
          }
        }
      });
      boom
        .to(S.phonePos, { x: X(0.6), y: 0, z: 1.2, duration: 0.12, ease: "none" }, 0)
        .to(S.phoneRot, { x: 0, y: 0, z: 0, duration: 0.12, ease: "none" }, 0)
        .to(S, { explodeProgress: 1, duration: 0.4, ease: "none" }, 0.12)
        .to("#servicesGrid .service", {
          opacity: 1, y: 0, rotateY: 0, stagger: 0.05, duration: 0.25, ease: "power2.out"
        }, 0.5)
        .to({}, { duration: 0.2 });

      /* ============ PROCESSO: card → LAPTOP che si apre (pin) ============ */
      const forge = gsap.timeline({
        scrollTrigger: {
          trigger: "#processo", start: "top top", end: "+=200%",
          scrub: 0.6, pin: !isMobile, anticipatePin: 1,
          onUpdate(st) {
            if (!forge._zap && st.progress > 0.42) {
              forge._zap = true;
              window.FX.burst(innerWidth / 2, innerHeight * 0.55, 6);
            }
            if (st.progress < 0.3) forge._zap = false;
          }
        }
      });
      forge
        .to(S, { gatherProgress: 1, duration: 0.45, ease: "none" }, 0)
        .set(S, { laptopScreen: "steps" }, 0)
        .to(S.laptopPos, { x: X(2.3), y: -0.5, z: 0, duration: 0.45, ease: "none" }, 0)
        .to(S, { laptopRotY: -0.32, duration: 0.45, ease: "none" }, 0)
        .to(S, { lidOpen: 1, duration: 0.3, ease: "none" }, 0.5)
        .to({}, { duration: 0.2 });

      const counter = document.getElementById("stepCounter");
      gsap.utils.toArray(".pstep").forEach((el) => {
        ScrollTrigger.create({
          trigger: "#processo",
          start: () => "top+=" + ((Number(el.dataset.step) - 1) * innerHeight * 0.5) + " top",
          end: () => "top+=" + (Number(el.dataset.step) * innerHeight * 0.5) + " top",
          onToggle: (st) => {
            if (!st.isActive) return;
            document.querySelectorAll(".pstep").forEach(p => p.classList.remove("active"));
            el.classList.add("active");
            const n = Number(el.dataset.step);
            S.activeProcessStep = n;
            if (counter) counter.textContent = "0" + n + " / 04";
          }
        });
      });

      /* ============ PACCHETTI: il laptop ESCE DALLO SCHERMO ============ */
      gsap.timeline({
        scrollTrigger: {
          trigger: "#pacchetti", start: "top 85%", end: "top 15%", scrub: 0.6,
          onUpdate(st) {
            const self = this;
            if (!self._pop && st.progress > 0.45) {
              self._pop = true;
              window.FX.burst(innerWidth * (isMobile ? 0.5 : 0.7), innerHeight * 0.45, 9, "#086CFF");
              gsap.fromTo("main", { x: -5 }, { x: 0, duration: 0.4, ease: "elastic.out(1,0.35)" });
            }
            if (st.progress < 0.3) self._pop = false;
          }
        }
      })
        .to(S, { forwardProgress: 1, ease: "none" }, 0)
        .to(S.laptopPos, { x: X(2.9), y: -0.2, ease: "none" }, 0)
        .to(S, { laptopRotY: -0.5, ease: "none" }, 0);

      gsap.timeline({
        scrollTrigger: { trigger: "#contratti", start: "top 90%", end: "top 30%", scrub: 0.6 }
      })
        .to(S, { forwardProgress: 0.25, ease: "none" }, 0)
        .to(S.laptopPos, { x: X(3.6), y: -0.6, ease: "none" }, 0);

      gsap.from(".module", {
        opacity: 0, y: 90, rotateY: -28, z: -160, stagger: 0.12,
        duration: 1, ease: "power3.out",
        scrollTrigger: { trigger: "#modules", start: "top 82%" }
      });

      let sparkTimer = null;
      ScrollTrigger.create({
        trigger: "#pacchetti", start: "top 60%", endTrigger: "#risultati", end: "bottom bottom",
        onToggle(st) {
          clearInterval(sparkTimer); sparkTimer = null;
          if (st.isActive && !isMobile) {
            sparkTimer = setInterval(() => {
              const x = innerWidth * (0.62 + Math.random() * 0.3);
              const y = innerHeight * (0.3 + Math.random() * 0.4);
              window.FX.strike(x, y, x + (Math.random() - .5) * 160, y + 90 + Math.random() * 120);
            }, 2600);
          }
        }
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

      /* ============ FINALE: schermo laptop in modalità CTA ============ */
      ScrollTrigger.create({
        trigger: "#contatti", start: "top 70%",
        onEnter: () => {
          S.laptopScreen = "cta";
          window.FX.burst(innerWidth * (isMobile ? 0.5 : 0.75), innerHeight * 0.4, 4);
        },
        onLeaveBack: () => S.laptopScreen = "steps"
      });
      gsap.timeline({
        scrollTrigger: { trigger: "#contatti", start: "top 90%", end: "top 20%", scrub: 0.6 }
      })
        .to(S.laptopPos, { x: X(3), y: 0, ease: "none" }, 0)
        .to(S, { laptopRotY: -0.15, forwardProgress: 0.55, ease: "none" }, 0);

      /* ============ NAVBAR: sezione attiva ============ */
      const links = document.querySelectorAll(".nav-link");
      ["#soluzione", "#processo", "#pacchetti", "#risultati", "#contatti"].forEach((sel) => {
        ScrollTrigger.create({
          trigger: sel, start: "top 45%", end: "bottom 45%",
          onToggle: (st) => {
            if (!st.isActive) return;
            links.forEach(l => l.classList.toggle("active", l.getAttribute("href") === sel));
          }
        });
      });

    });

    ScrollTrigger.refresh();
    addEventListener("beforeunload", () => ctx.revert());
  }

  function staticFallback() {
    document.querySelectorAll(".reveal, #servicesGrid .service").forEach(el => {
      el.style.opacity = 1; el.style.transform = "none";
    });
    document.querySelectorAll(".mask-line span").forEach(s => s.style.transform = "none");
    document.querySelectorAll(".pstep").forEach(p => p.classList.add("active"));
    document.querySelectorAll(".m-value").forEach(el => {
      el.textContent = Number(el.dataset.value).toLocaleString("it-IT");
    });
  }
})();
