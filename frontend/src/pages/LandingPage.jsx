import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const PLANS = [
  {
    id: "solo",
    name: "Solo",
    price: 49,
    annual: 39,
    desc: "Para el abogado independiente",
    color: "#C9A84C",
    features: [
      "Hasta 30 casos activos",
      "Gestión de clientes",
      "Calendario judicial",
      "Timer de horas",
      "Generación de documentos",
      "1 usuario",
      "Soporte por email",
    ],
    notIncluded: ["Múltiples abogados", "Asistente IA", "Facturación electrónica"],
  },
  {
    id: "firma",
    name: "Firma",
    price: 99,
    annual: 79,
    desc: "Para firmas y despachos en crecimiento",
    color: "#C9A84C",
    popular: true,
    features: [
      "Casos ilimitados",
      "Hasta 5 abogados",
      "Poderes y escrituras",
      "Facturación ITBMS",
      "Asistente IA legal",
      "Reportes financieros",
      "Soporte prioritario WhatsApp",
    ],
    notIncluded: ["Usuarios ilimitados", "API pública"],
  },
  {
    id: "despacho",
    name: "Despacho",
    price: 179,
    annual: 143,
    desc: "Para grandes despachos multiequipo",
    color: "#C9A84C",
    features: [
      "Todo lo del plan Firma",
      "Abogados ilimitados",
      "Plantillas personalizadas",
      "Reportes avanzados",
      "Integración bancaria",
      "Gerente de cuenta dedicado",
      "Onboarding incluido",
    ],
    notIncluded: [],
  },
];

const FEATURES = [
  { icon: "⚖", title: "Gestión de Casos", desc: "Registra cada expediente con su estado, juzgado, juez y contraparte. Historial completo y seguimiento en tiempo real." },
  { icon: "📅", title: "Calendario Judicial", desc: "Audiencias, términos procesales y vencimientos en un solo lugar. Alertas automáticas para no perder ningún plazo." },
  { icon: "📄", title: "Documentos y Poderes", desc: "Genera escrituras, poderes judiciales y especiales desde plantillas. Firma y comparte al instante." },
  { icon: "⏱", title: "Timer de Horas", desc: "Registra el tiempo trabajado por caso y abogado. Genera reportes de honorarios listos para facturar." },
  { icon: "💰", title: "Facturación con ITBMS", desc: "Emite facturas con ITBMS 7%, retenciones y pagos a plazos. Cuentas por cobrar siempre actualizadas." },
  { icon: "✦", title: "Asistente IA Legal", desc: "Consulta jurisprudencia, redacta borradores de documentos y obtén análisis de riesgo con inteligencia artificial." },
];

const TESTIMONIALS = [
  { name: "Lic. Gabriela Torres", role: "Socia, Torres & Asociados", text: "Teníamos 3 sistemas distintos para casos, facturación y agenda. Gestar Lex los unificó todos. Ahora mi equipo trabaja el doble de rápido.", avatar: "GT" },
  { name: "Dr. Andrés Fonseca", role: "Abogado independiente", text: "El timer de horas es invaluable. Antes perdía tiempo sin cobrar. Ahora facturo cada minuto trabajado con un clic.", avatar: "AF" },
  { name: "Lcda. Patricia Ríos", role: "Firma Ríos & Partners", text: "El asistente IA me ayuda a redactar contratos en minutos. Lo que antes me tomaba horas, ahora lo tengo listo antes del almuerzo.", avatar: "PR" },
];

const FAQS = [
  { q: "¿Está adaptado al sistema judicial de Panamá?", a: "Sí. Gestar Lex está diseñado para la estructura judicial panameña: circuitos judiciales, tipos de procesos del COGEP y el Código Procesal Civil, plazos hábiles panameños y terminología local." },
  { q: "¿Los documentos generados tienen validez legal?", a: "Los documentos se generan como borradores en DOCX/PDF. La firma electrónica con validez legal requiere notarización conforme a la Ley 51 de 2008 de Panamá." },
  { q: "¿Cuántos usuarios puedo agregar?", a: "El plan Solo incluye 1 usuario. Firma hasta 5 abogados. Despacho es ilimitado. También puedes dar acceso de solo lectura a asistentes." },
  { q: "¿Hay período de prueba?", a: "Sí. 14 días de prueba gratuita con acceso completo. Sin tarjeta de crédito. Al finalizar, elige tu plan o escríbenos." },
  { q: "¿Mis expedientes están seguros?", a: "Sí. Los datos se almacenan en infraestructura en la nube con encriptación AES-256 en reposo y backups diarios automáticos. La conexión siempre va por HTTPS cifrado." },
];

export default function GestarLexLanding() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const pricingRef = useRef(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const scrollToPricing = () => pricingRef.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", background: "#F8F7F4", color: "#111827", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --gold: #C9A84C;
          --gold-light: #FDF8EE;
          --navy: #1E3A5F;
          --dark: #0D1B2A;
          --text: #111827;
          --muted: #6B7280;
          --border: #E5E7EB;
        }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        .btn-gold {
          background: var(--gold); color: #fff; border: none; border-radius: 10px;
          padding: 13px 28px; font-size: 15px; font-weight: 700; cursor: pointer;
          font-family: 'Outfit', sans-serif; transition: all 0.18s ease;
          box-shadow: 0 4px 20px rgba(201,168,76,0.4);
        }
        .btn-gold:hover { background: #b8953e; transform: translateY(-1px); box-shadow: 0 6px 28px rgba(201,168,76,0.5); }
        .btn-outline {
          background: transparent; color: #fff; border: 1.5px solid rgba(255,255,255,0.25);
          border-radius: 10px; padding: 12px 24px; font-size: 14px; font-weight: 600;
          cursor: pointer; font-family: 'Outfit', sans-serif; transition: all 0.15s ease;
        }
        .btn-outline:hover { border-color: var(--gold); color: var(--gold); }
        .btn-outline-dark {
          background: transparent; color: var(--navy); border: 1.5px solid #D1D5DB;
          border-radius: 10px; padding: 9px 20px; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: 'Outfit', sans-serif; transition: all 0.15s ease;
        }
        .btn-outline-dark:hover { border-color: var(--gold); color: var(--gold); }
        .plan-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .plan-card:hover { transform: translateY(-4px); box-shadow: 0 20px 60px rgba(0,0,0,0.12); }
        .faq-item { cursor: pointer; transition: background 0.15s; border-radius: 12px; }
        .faq-item:hover { background: #F3F4F6; }
        .feature-card { transition: all 0.2s ease; }
        .feature-card:hover { background: #fff; box-shadow: 0 8px 32px rgba(0,0,0,0.07); transform: translateY(-2px); }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.6s ease forwards; }
        .badge-popular {
          position: absolute; top: -14px; left: 50%; transform: translateX(-50%);
          background: linear-gradient(135deg, #C9A84C, #b8953e);
          color: #fff; font-size: 11px; font-weight: 800; letter-spacing: 0.08em;
          text-transform: uppercase; padding: 4px 16px; border-radius: 20px;
          white-space: nowrap; box-shadow: 0 4px 16px rgba(201,168,76,0.4);
        }
        .toggle-track { width: 44px; height: 24px; border-radius: 12px; background: #E5E7EB; position: relative; cursor: pointer; transition: background 0.2s; }
        .toggle-track.on { background: var(--gold); }
        .toggle-thumb { position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: left 0.2s; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
        .toggle-track.on .toggle-thumb { left: 23px; }
        /* ── Responsive ─────────────────────────────────────────── */
        @media (max-width: 767px) {
          nav { padding-left: 20px !important; padding-right: 20px !important; }
          section { padding-left: 20px !important; padding-right: 20px !important; }
          footer { padding-left: 20px !important; padding-right: 20px !important; flex-direction: column !important; align-items: flex-start !important; }
          .lp-nav-links { display: none !important; }
          .lp-nav-login { display: none !important; }
          .lp-hero-btns { flex-direction: column !important; align-items: stretch !important; }
          .lp-hero-btns button, .lp-hero-btns a { width: 100% !important; text-align: center !important; justify-content: center !important; }
          .lp-grid-3, .lp-grid-4 { grid-template-columns: 1fr !important; }
          .lp-grid-dash { grid-template-columns: repeat(2,1fr) !important; }
          .lp-cta-h2 { font-size: clamp(26px, 7vw, 36px) !important; line-height: 1.15 !important; }
          .lp-footer-links { gap: 14px !important; flex-wrap: wrap !important; }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .lp-grid-3, .lp-grid-4 { grid-template-columns: repeat(2,1fr) !important; }
          .lp-grid-dash { grid-template-columns: repeat(2,1fr) !important; }
        }
      `}</style>

      {/* NAVBAR */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? "rgba(255,255,255,0.96)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(0,0,0,0.07)" : "none",
        padding: "16px 48px", display: "flex", alignItems: "center", justifyContent: "space-between",
        transition: "all 0.25s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="https://gestarsoft.com" style={{
            fontSize: 12, fontWeight: 600, color: scrolled ? "#6B7280" : "rgba(255,255,255,0.5)",
            textDecoration: "none", transition: "color 0.15s",
          }}
            onMouseEnter={e => e.target.style.color = "#C9A84C"}
            onMouseLeave={e => e.target.style.color = scrolled ? "#6B7280" : "rgba(255,255,255,0.5)"}
          >← GestarSoft</a>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, #1E3A5F 0%, #C9A84C 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, fontWeight: 900, color: "#fff",
            }}>G</div>
            <span style={{ fontSize: 18, fontWeight: 800, color: scrolled ? "#1E3A5F" : "#fff", letterSpacing: "-0.02em" }}>
              Gestar <span style={{ color: "#C9A84C" }}>Lex</span>
            </span>
          </div>
        </div>
        <div className="lp-nav-links" style={{ display: "flex", gap: 32, alignItems: "center" }}>
          {["Funciones", "Precios", "FAQ"].map(item => (
            <a key={item} href={`#${item.toLowerCase()}`}
              style={{ fontSize: 14, fontWeight: 600, color: scrolled ? "#4B5563" : "rgba(255,255,255,0.8)", textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={e => e.target.style.color = "#C9A84C"}
              onMouseLeave={e => e.target.style.color = scrolled ? "#4B5563" : "rgba(255,255,255,0.8)"}
            >{item}</a>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn-outline-dark lp-nav-login" onClick={() => navigate("/login")}>Iniciar sesión</button>
          <button className="btn-gold" style={{ padding: "9px 20px", fontSize: 13 }} onClick={scrollToPricing}>Empezar gratis</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(155deg, #0D1B2A 0%, #1E3A5F 55%, #2C4A70 100%)",
        position: "relative", overflow: "hidden", paddingTop: 80,
      }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)", backgroundSize: "44px 44px" }} />
        <div style={{ position: "absolute", top: "15%", right: "8%", width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.1) 0%, transparent 70%)", filter: "blur(50px)" }} />
        <div style={{ position: "absolute", bottom: "20%", left: "5%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%)", filter: "blur(40px)" }} />

        <div style={{ textAlign: "center", maxWidth: 820, padding: "0 24px", position: "relative", zIndex: 1 }}>
          <div className="fade-up" style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)",
            borderRadius: 20, padding: "6px 18px", marginBottom: 32,
          }}>
            <span style={{ fontSize: 10, color: "#C9A84C", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>🇵🇦 Software Legal para Panamá</span>
          </div>

          <h1 className="fade-up" style={{
            fontSize: "clamp(34px, 5.5vw, 64px)", fontWeight: 900, color: "#FFFFFF",
            lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: 24, animationDelay: "0.1s",
          }}>
            La plataforma que tu<br />
            <span style={{ background: "linear-gradient(90deg, #C9A84C, #E8C96B)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              firma legal merece
            </span>
          </h1>

          <p className="fade-up" style={{
            fontSize: 18, color: "rgba(255,255,255,0.6)", lineHeight: 1.7,
            maxWidth: 560, margin: "0 auto 40px", animationDelay: "0.2s",
          }}>
            Casos, clientes, calendario judicial, timer de horas, poderes y facturación — todo integrado en un sistema diseñado para abogados panameños.
          </p>

          <div className="fade-up lp-hero-btns" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", animationDelay: "0.3s" }}>
            <button className="btn-gold" style={{ fontSize: 16, padding: "15px 36px" }} onClick={scrollToPricing}>
              Empezar 14 días gratis
            </button>
            <button className="btn-outline" style={{ fontSize: 16, padding: "15px 32px" }} onClick={() => navigate("/login")}>
              Iniciar sesión →
            </button>
          </div>

          <div className="fade-up" style={{ marginTop: 48, display: "flex", gap: 40, justifyContent: "center", flexWrap: "wrap", animationDelay: "0.4s" }}>
            {[["Casos", "Ilimitados"], ["Poderes", "Digitales"], ["Timer", "Integrado"], ["IA", "Legal"]].map(([t, s]) => (
              <div key={t} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#C9A84C", fontFamily: "'DM Mono', monospace" }}>{t}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 500, letterSpacing: "0.06em" }}>{s}</div>
              </div>
            ))}
          </div>

          {/* Dashboard mockup */}
          <div style={{
            marginTop: 56, borderRadius: 16, overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.08)",
            boxShadow: "0 40px 120px rgba(0,0,0,0.5)",
            background: "#111620",
          }}>
            <div style={{ background: "#0D1117", padding: "10px 16px", display: "flex", gap: 6, alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              {["#FF6B6B", "#F5A623", "#00C896"].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />)}
              <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 18, marginLeft: 8, display: "flex", alignItems: "center", paddingLeft: 8 }}>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Mono', monospace" }}>lex.gestarsoft.com/casos</span>
              </div>
            </div>
            <div className="lp-grid-dash" style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
              {[
                { l: "Casos activos", v: "47", c: "#C9A84C" },
                { l: "Audiencias hoy", v: "3", c: "#4E9AF1" },
                { l: "Términos vence", v: "2", c: "#FF6B6B" },
                { l: "Horas este mes", v: "186h", c: "#00C896" },
              ].map(k => (
                <div key={k.l} style={{ background: "#0D1117", borderRadius: 8, padding: "12px 14px", border: `1px solid ${k.c}18` }}>
                  <div style={{ fontSize: 9, color: "#4B5675", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>{k.l}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#E8EDFF", fontFamily: "'DM Mono', monospace" }}>{k.v}</div>
                  <div style={{ marginTop: 6, height: 2, background: `${k.c}22`, borderRadius: 1 }}>
                    <div style={{ height: "100%", width: "70%", background: k.c, borderRadius: 1 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="funciones" style={{ padding: "100px 48px", background: "#F8F7F4" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div style={{ display: "inline-block", background: "#FDF8EE", color: "#B8953E", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "5px 14px", borderRadius: 20, marginBottom: 16 }}>Funcionalidades</div>
            <h2 style={{ fontSize: 38, fontWeight: 900, color: "#1E3A5F", letterSpacing: "-0.025em", marginBottom: 14 }}>
              Todo lo que tu firma necesita,<br />en un solo lugar
            </h2>
            <p style={{ fontSize: 16, color: "#6B7280", maxWidth: 500, margin: "0 auto" }}>Construido para la realidad jurídica panameña. Sin adaptaciones de software extranjero.</p>
          </div>
          <div className="lp-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            {FEATURES.map(f => (
              <div key={f.title} className="feature-card" style={{ background: "#F0EDE6", borderRadius: 14, padding: "28px 24px", border: "1px solid transparent" }}>
                <div style={{ fontSize: 26, marginBottom: 14 }}>{f.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1E3A5F", marginBottom: 8 }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.65 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="precios" ref={pricingRef} style={{ padding: "100px 48px", background: "#1E3A5F" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <div style={{ display: "inline-block", background: "rgba(201,168,76,0.12)", color: "#C9A84C", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "5px 14px", borderRadius: 20, marginBottom: 16 }}>Precios</div>
            <h2 style={{ fontSize: 38, fontWeight: 900, color: "#fff", letterSpacing: "-0.025em", marginBottom: 16 }}>Planes para cada etapa de tu firma</h2>
            <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", marginBottom: 28 }}>Sin contratos. Cancela cuando quieras.</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12 }}>
              <span style={{ fontSize: 14, color: !annual ? "#fff" : "rgba(255,255,255,0.4)", fontWeight: 600 }}>Mensual</span>
              <div className={`toggle-track${annual ? " on" : ""}`} onClick={() => setAnnual(!annual)}>
                <div className="toggle-thumb" />
              </div>
              <span style={{ fontSize: 14, color: annual ? "#C9A84C" : "rgba(255,255,255,0.4)", fontWeight: 600 }}>
                Anual <span style={{ fontSize: 11, background: "rgba(201,168,76,0.15)", color: "#C9A84C", borderRadius: 10, padding: "2px 8px", fontWeight: 700 }}>−20%</span>
              </span>
            </div>
          </div>

          <div className="lp-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20, alignItems: "start" }}>
            {PLANS.map(plan => (
              <div key={plan.id} className="plan-card" style={{
                background: plan.popular ? "#fff" : "rgba(255,255,255,0.04)",
                border: plan.popular ? "2px solid #C9A84C" : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16, padding: "28px 22px", position: "relative",
              }}>
                {plan.popular && <div className="badge-popular">⭐ Más popular</div>}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: plan.popular ? "#1E3A5F" : "#fff", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{plan.name}</div>
                  <p style={{ fontSize: 12, color: plan.popular ? "#6B7280" : "rgba(255,255,255,0.4)" }}>{plan.desc}</p>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
                    <span style={{ fontSize: 38, fontWeight: 900, color: plan.popular ? "#1E3A5F" : "#fff", fontFamily: "'DM Mono', monospace" }}>
                      B/. {annual ? plan.annual : plan.price}
                    </span>
                    <span style={{ fontSize: 13, color: plan.popular ? "#9CA3AF" : "rgba(255,255,255,0.35)", marginBottom: 8 }}>/mes</span>
                  </div>
                  {annual && <div style={{ fontSize: 11, color: "#C9A84C", fontWeight: 600 }}>Ahorras B/. {(plan.price - plan.annual) * 12}/año</div>}
                </div>
                <div style={{ fontSize: 11, color: "#C9A84C", fontWeight: 700, marginBottom: 10, textAlign: "center" }}>✓ 14 días gratis · Sin tarjeta</div>
                <button
                  onClick={() => navigate("/registro")}
                  style={{
                    width: "100%", marginBottom: 20, padding: "12px", fontSize: 13, fontWeight: 700,
                    borderRadius: 10, border: plan.popular ? "none" : "1px solid rgba(255,255,255,0.15)",
                    background: plan.popular ? "#C9A84C" : "rgba(255,255,255,0.06)",
                    color: "#fff", cursor: "pointer", fontFamily: "'Outfit', sans-serif",
                    boxShadow: plan.popular ? "0 4px 20px rgba(201,168,76,0.4)" : "none",
                    transition: "all 0.15s",
                  }}
                >Comenzar prueba gratis</button>

                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: "#C9A84C", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>✓</span>
                      <span style={{ fontSize: 12, color: plan.popular ? "#374151" : "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>{f}</span>
                    </div>
                  ))}
                  {plan.notIncluded.map(f => (
                    <div key={f} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <span style={{ color: "rgba(255,255,255,0.15)", fontSize: 12, flexShrink: 0 }}>✗</span>
                      <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: "center", marginTop: 40 }}>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginBottom: 14, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>Métodos de pago</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 10 }}>
              {[{ label: "🅿️ PayPal", note: "Principal" }, { label: "📱 Yappy", note: "Contáctenos" }, { label: "🏦 ACH Panamá", note: "Contáctenos" }].map(m => (
                <div key={m.label} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 16px", fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 500, textAlign: "center" }}>
                  <div>{m.label}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 2 }}>{m.note}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>El pago se configura dentro de la plataforma vía PayPal al finalizar el registro.</p>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: "100px 48px", background: "#F8F7F4" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: "#1E3A5F", letterSpacing: "-0.025em" }}>Lo que dicen los abogados que ya usan Gestar Lex</h2>
          </div>
          <div className="lp-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }}>
            {TESTIMONIALS.map(t => (
              <div key={t.name} style={{ background: "#fff", borderRadius: 16, padding: 28, border: "1px solid #E5E7EB", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 18, color: "#C9A84C", marginBottom: 12, letterSpacing: 2 }}>★★★★★</div>
                <p style={{ fontSize: 13, color: "#4B5563", lineHeight: 1.7, marginBottom: 20 }}>"{t.text}"</p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #1E3A5F, #C9A84C)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#fff" }}>{t.avatar}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#1E3A5F" }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: "100px 48px", background: "#fff" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 56 }}>
            <h2 style={{ fontSize: 36, fontWeight: 900, color: "#1E3A5F", letterSpacing: "-0.025em" }}>Preguntas frecuentes</h2>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {FAQS.map((faq, i) => (
              <div key={i} className="faq-item" onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{faq.q}</span>
                  <span style={{ fontSize: 18, color: "#C9A84C", flexShrink: 0, transition: "transform 0.2s", transform: openFaq === i ? "rotate(45deg)" : "none" }}>+</span>
                </div>
                {openFaq === i && <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.7, marginTop: 10, paddingRight: 32 }}>{faq.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "100px 48px", background: "linear-gradient(135deg, #0D1B2A 0%, #1E3A5F 60%, #2C4A70 100%)", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.08) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div style={{ position: "relative", zIndex: 1, maxWidth: 600, margin: "0 auto" }}>
          <h2 className="lp-cta-h2" style={{ fontSize: 44, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", marginBottom: 16 }}>Tu firma, al siguiente nivel</h2>
          <p style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", marginBottom: 36, lineHeight: 1.7 }}>
            Únete a firmas panameñas que ya gestionan sus casos, clientes y facturación con Gestar Lex.
          </p>
          <button className="btn-gold" style={{ fontSize: 16, padding: "16px 44px" }} onClick={scrollToPricing}>
            Empezar 14 días gratis →
          </button>
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 14 }}>Sin tarjeta · Sin contratos · Cancela cuando quieras</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: "#060C14", padding: "40px 48px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg, #1E3A5F, #C9A84C)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 900, color: "#fff" }}>G</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>Gestar Lex · GestarSoft</span>
        </div>
        <div className="lp-footer-links" style={{ display: "flex", gap: 24 }}>
          <a href="https://gestarsoft.com" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>Términos</a>
          <a href="https://gestarsoft.com" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>Privacidad</a>
          <a href="https://wa.me/50765143637" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>Soporte</a>
          <a href="https://www.linkedin.com/company/gestarsoft" target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", textDecoration: "none" }}>LinkedIn</a>
        </div>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)" }}>© 2026 GestarSoft · Ciudad de Panamá, República de Panamá</span>
      </footer>
    </div>
  );
}
