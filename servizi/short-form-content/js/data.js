/* ============================================================
   Short Form Content - data.js
   Tutti i dati modificabili (pacchetti, contatti, metriche).
   Modifica qui prezzi, feature e contatti senza toccare il resto.
============================================================ */
window.VERTEX_DATA = {

  contacts: {
    email: "info@vertexgroup.it",
    instagram: "@vertexgroup",
    whatsapp: "+39 000 000 0000", // placeholder - sostituire con numero reale
    web: "www.vertexgroup.it"
  },

  packages: [
    {
      id: "basic",
      name: "BASIC",
      price: 150,
      perVideo: "&euro;5 per video",
      videos: "30 video / mese",
      badge: null,
      color: "#086CFF",
      featured: false,
      features: [
        "Video 9:16 ottimizzati",
        "Transizioni standard",
        "Colori brand",
        "Tagli e zoom professionali"
      ],
      ideal: [
        "Creator e professionisti in fase di crescita",
        "Pagine social emergenti",
        "Piccole attivita e personal brand"
      ]
    },
    {
      id: "medium",
      name: "MEDIUM",
      price: 210,
      perVideo: "&euro;7 per video",
      videos: "30 video / mese",
      badge: "PIU SCELTO",
      color: "#09D7F5",
      featured: true,
      features: [
        "Tutto del piano Basic",
        "Motion graphics avanzate",
        "Hook visivi ottimizzati",
        "Priorita media in coda"
      ],
      ideal: [
        "Pagine short form in crescita",
        "Brand locali e creator continuativi",
        "Community e progetti editoriali digitali"
      ]
    },
    {
      id: "premium",
      name: "PREMIUM",
      price: 300,
      perVideo: "&euro;10 per video",
      videos: "30 video / mese",
      badge: "CONSIGLIATO",
      color: "#FFB800",
      featured: true,
      features: [
        "Tutto del piano Medium",
        "Effetti cinematici & glow",
        "Sub-titles animati",
        "Rubriche settimanali incluse",
        "Alta priorita in coda"
      ],
      ideal: [
        "Profili da 100K+ follower",
        "Aziende e creator strutturati",
        "Media, podcast e format social"
      ]
    },
    {
      id: "ultimate",
      name: "ULTIMATE",
      price: 600,
      perVideo: "&euro;20 per video",
      videos: "30 video / mese",
      badge: null,
      color: "#FF2E70",
      featured: false,
      features: [
        "Tutto del piano Premium",
        "Brand identity video system",
        "Intro/Outro personalizzati",
        "Short-form + long-form",
        "Strategia editoriale mensile"
      ],
      ideal: [
        "Brand nazionali e campagne multi-canale",
        "Agenzie media e marketing",
        "Startup, aziende e personal brand"
      ]
    }
  ],

  semestrale: [
    { t: "-10% su ogni pacchetto", d: "Sconto diretto applicato al totale mensile per tutta la durata del contratto." },
    { t: "Priorita in coda garantita", d: "I clienti semestrali hanno accesso prioritario al team di editing in tutti i periodi." },
    { t: "Onboarding brand gratuito", d: "Sessione completa di brand setup: colori, loghi, font, stile grafico personalizzato." },
    { t: "Report performance mensile", d: "Analisi delle metriche sociali dei tuoi contenuti: views, retention, engagement rate." },
    { t: "Pack template esclusivo", d: "5 template grafici personalizzati con la tua identita visiva inclusi nel piano." },
    { t: "Consulenza strategica 2x/mese", d: "Due sessioni mensili con il nostro responsabile content strategy incluse." }
  ],

  annuale: [
    { t: "-20% su ogni pacchetto", d: "Il doppio risparmio rispetto al semestrale: massimizza il ritorno sull'investimento." },
    { t: "Account manager dedicato", d: "Un referente dedicato alla tua produzione short form per 12 mesi." },
    { t: "Sistema brand identity completo", d: "20 template, 3 set di stili, intro/outro animati personalizzati al 100%." },
    { t: "Strategia editoriale annuale", d: "Piano contenuti completo con calendario editoriale, trend social e momenti key." },
    { t: "Report performance settimanale", d: "Dashboard analitica aggiornata ogni settimana con insights sui tuoi contenuti." },
    { t: "Bonus: 5 video extra/mese", d: "5 video addizionali ogni mese inclusi senza costo aggiuntivo." }
  ],

  results: [
    { value: 340, prefix: "+", suffix: "%", label: "Aumento medio engagement" },
    { value: 50,  prefix: "",  suffix: "+", label: "Clienti soddisfatti" },
    { value: 2500,prefix: "",  suffix: "+", label: "Video consegnati" }
  ]
};
