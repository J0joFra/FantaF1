import { Component } from "react";

/* ─── ULTIMA RETE DI SICUREZZA ──────────────────────────────────────────────
   Un errore non gestito durante il render smonta tutta l'app e lascia una
   pagina bianca: per chi la apre (e per la revisione di Google Play) è
   un'app che «non si carica». Qui l'errore diventa una schermata con un
   pulsante per ricaricare.

   Sta fuori da I18nProvider di proposito, perché potrebbe essere proprio
   quello a rompersi: i testi sono qui, in italiano e in inglese. */
const TEXT = {
  it: { title: "Qualcosa è andato storto", body: "L'app ha avuto un problema durante il caricamento.", retry: "Riprova" },
  en: { title: "Something went wrong", body: "The app ran into a problem while loading.", retry: "Try again" },
};

export default class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[AppErrorBoundary]", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    let lang = "en";
    try {
      const saved = localStorage.getItem("lang");
      lang = (saved || navigator.language || "en").slice(0, 2) === "it" ? "it" : "en";
    } catch { /* ignore */ }
    const t = TEXT[lang];
    return (
      <div style={{
        position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24, background: "#ffffff", fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}>
        <div style={{ maxWidth: 360, textAlign: "center" }}>
          <img src="/icons/icon-192.png" alt="GridUp" width={88} height={88} style={{ borderRadius: 20 }} />
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: "20px 0 8px", color: "#1a1a1e" }}>{t.title}</h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>{t.body}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 24, width: "100%", padding: "12px 16px", border: 0, borderRadius: 12,
              background: "#E8002D", color: "#fff", fontSize: 15, fontWeight: 700,
            }}>
            {t.retry}
          </button>
        </div>
      </div>
    );
  }
}
