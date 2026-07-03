/* ============================================================
   Short Form Content - app.js
   UI: costruzione DOM dai dati, navbar, menu mobile,
   espansione moduli pacchetto, form demo.
============================================================ */
(function () {
  "use strict";

  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;

  document.addEventListener("DOMContentLoaded", () => {
    buildModules();
    buildBenefits();
    buildMetrics();
    buildContacts();
    initNavbar();
    initForm();
  });

  /* ---------------- pacchetti (moduli) ---------------- */
  function buildModules() {
    const wrap = document.getElementById("modules");
    if (!wrap || !window.VERTEX_DATA) return;

    window.VERTEX_DATA.packages.forEach((p) => {
      const art = document.createElement("article");
      art.className = "module" + (p.featured ? " featured" : "");
      art.style.setProperty("--mc", p.color);
      art.dataset.id = p.id;

      art.innerHTML = `
        ${p.badge ? `<span class="module-badge">${p.badge}</span>` : ""}
        <button class="module-head" aria-expanded="false" aria-controls="det-${p.id}">
          <h3>${p.name}</h3>
          <p class="module-price">&euro;${p.price}<small> /mese</small></p>
          <p class="module-videos">${p.videos}</p>
          <p class="module-pervideo">solo ${p.perVideo}</p>
          <span class="module-open-hint">Dettagli e destinatari</span>
        </button>
        <div class="module-details" id="det-${p.id}">
          <ul>${p.features.map(f => `<li>${f}</li>`).join("")}</ul>
          <p class="module-ideal-title">Ideale per</p>
          <ul class="ideal">${p.ideal.map(f => `<li>${f}</li>`).join("")}</ul>
          <a class="module-cta" href="#demo">Scegli questo pacchetto &rarr;</a>
        </div>`;
      wrap.appendChild(art);

      const head = art.querySelector(".module-head");
      head.addEventListener("click", () => {
        const open = art.classList.toggle("open");
        head.setAttribute("aria-expanded", String(open));
        window.VERTEX_STATE.selectedPackage = open ? p.id : null;
      });

      /* reazione al mouse (solo desktop, no reduced-motion) */
      if (finePointer && !prefersReduced) {
        art.addEventListener("pointermove", (e) => {
          const r = art.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          art.style.transform =
            `rotateY(${px * 10}deg) rotateX(${-py * 10}deg) translateZ(6px)`;
        });
        art.addEventListener("pointerleave", () => { art.style.transform = ""; });
      }
    });
  }

  /* ---------------- contratti ---------------- */
  function buildBenefits() {
    const D = window.VERTEX_DATA;
    if (!D) return;
    fill("benefitSem", D.semestrale);
    fill("benefitAnn", D.annuale);
    function fill(id, arr) {
      const ul = document.getElementById(id);
      if (!ul) return;
      ul.innerHTML = arr.map(b =>
        `<li class="reveal"><h3>&check; ${b.t}</h3><p>${b.d}</p></li>`).join("");
    }
  }

  /* ---------------- metriche risultati ---------------- */
  function buildMetrics() {
    const wrap = document.getElementById("metrics");
    if (!wrap || !window.VERTEX_DATA) return;
    wrap.innerHTML = window.VERTEX_DATA.results.map(m => `
      <div class="metric reveal">
        <b><span class="m-prefix">${m.prefix}</span><span class="m-value" data-value="${m.value}">0</span><span class="m-suffix">${m.suffix}</span></b>
        <span>${m.label}</span>
      </div>`).join("");
  }

  /* ---------------- contatti ---------------- */
  function buildContacts() {
    const wrap = document.getElementById("contactGrid");
    if (!wrap || !window.VERTEX_DATA) return;
    const c = window.VERTEX_DATA.contacts;
    wrap.innerHTML = `
      <div><dt>Email</dt><dd><a href="mailto:${c.email}" style="color:inherit">${c.email}</a></dd></div>
      <div><dt>Instagram</dt><dd>${c.instagram}</dd></div>
      <div><dt>WhatsApp</dt><dd>${c.whatsapp}</dd></div>
      <div><dt>Web</dt><dd>${c.web}</dd></div>`;
  }

  /* ---------------- navbar + menu mobile ---------------- */
  function initNavbar() {
    const navbar = document.getElementById("navbar");
    const burger = document.getElementById("navBurger");
    const menu = document.getElementById("navMenu");

    const onScroll = () => navbar.classList.toggle("scrolled", window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    function setMenu(open) {
      menu.classList.toggle("open", open);
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Chiudi menu" : "Apri menu");
      document.body.style.overflow = open ? "hidden" : ""; // blocco scroll
      if (open) menu.querySelector("a").focus();
    }
    burger.addEventListener("click", () =>
      setMenu(!menu.classList.contains("open")));
    menu.querySelectorAll("a").forEach(a =>
      a.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("open")) {
        setMenu(false); burger.focus();
      }
    });
  }

  /* ---------------- form demo ---------------- */
  function initForm() {
    const form = document.getElementById("demo");
    if (!form) return;
    const nome = form.querySelector("#f-nome");
    const email = form.querySelector("#f-email");
    const privacy = form.querySelector("#f-privacy");
    const success = form.querySelector("#formSuccess");

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let ok = true;
      ok = check(nome, nome.value.trim().length >= 2, "err-nome") && ok;
      ok = check(email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value), "err-email") && ok;
      ok = check(privacy, privacy.checked, "err-privacy") && ok;

      if (!ok) {
        form.querySelector('[aria-invalid="true"], input:invalid')?.focus();
        return;
      }
      /* Successo SIMULATO: nessun backend collegato.
         Per attivarlo: vedi README (Formspree / Netlify Forms / API). */
      success.hidden = false;
      form.querySelector('button[type="submit"]').disabled = true;
      success.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "nearest" });
    });

    function check(input, valid, errId) {
      const err = document.getElementById(errId);
      input.setAttribute("aria-invalid", String(!valid));
      if (err) err.hidden = valid;
      return valid;
    }
    /* rimuove l'errore mentre l'utente corregge */
    [nome, email].forEach(i => i.addEventListener("input", () => {
      i.setAttribute("aria-invalid", "false");
      const err = document.getElementById("err-" + i.id.slice(2));
      if (err) err.hidden = true;
    }));
    privacy.addEventListener("change", () => {
      document.getElementById("err-privacy").hidden = privacy.checked;
    });
  }
})();
