import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Trophy, ChevronRight, ChevronLeft, Activity, ArrowRight, Users, Building2, Clock, CheckCircle2, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

function getStatusInfo(t: any) {
  const now = new Date();
  const start = t.start_date ? new Date(t.start_date) : null;
  const end = t.end_date ? new Date(t.end_date) : null;
  const regEnd = t.rules_config?.registration_end_date ? new Date(t.rules_config.registration_end_date) : null;

  if (end && now > end) return { label: "Realizado", color: "bg-slate-500", dot: "bg-slate-400" };
  if (start && now >= start) return { label: "Em Andamento", color: "bg-emerald-600", dot: "bg-emerald-400" };
  if (regEnd && now < regEnd) return { label: "Inscrições Abertas", color: "bg-indigo-600", dot: "bg-indigo-400" };
  return { label: "Em Breve", color: "bg-amber-500", dot: "bg-amber-400" };
}

export default function LandingPage() {
  const [config, setConfig] = useState<any>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [filterStatus, setFilterStatus] = useState<"all" | "open" | "ongoing" | "done">("all");
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/platform/landing-config").then(r => r.ok ? r.json() : null),
      fetch("/api/platform/public-organizations").then(r => r.ok ? r.json() : []),
      fetch("/api/platform/public-tournaments").then(r => r.ok ? r.json() : []),
    ]).then(([cfg, orgs, tours]) => {
      if (cfg) setConfig(cfg);
      setOrganizations(Array.isArray(orgs) ? orgs : []);
      setTournaments(Array.isArray(tours) ? tours : []);
    }).catch(console.error);
  }, []);

  const slides = config?.hero?.slides || [];
  const features = config?.features || [];

  useEffect(() => {
    if (slides.length < 2) return;
    intervalRef.current = setInterval(() => {
      setCurrentSlide(p => (p + 1) % slides.length);
    }, 5000);
    return () => clearInterval(intervalRef.current);
  }, [slides.length]);

  const prevSlide = () => {
    clearInterval(intervalRef.current);
    setCurrentSlide(p => (p - 1 + slides.length) % slides.length);
  };
  const nextSlide = () => {
    clearInterval(intervalRef.current);
    setCurrentSlide(p => (p + 1) % slides.length);
  };

  const filteredTournaments = tournaments.filter(t => {
    const status = getStatusInfo(t).label;
    if (filterStatus === "open") return status === "Inscrições Abertas";
    if (filterStatus === "ongoing") return status === "Em Andamento";
    if (filterStatus === "done") return status === "Realizado";
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Activity size={20} className="text-white" />
          </div>
          <span className="text-lg font-extrabold tracking-tight text-white">Quero Competir</span>
        </Link>
        <div className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-400">
          <a href="#organizacoes" className="hover:text-white transition">Organizações</a>
          <a href="#torneios" className="hover:text-white transition">Torneios</a>
          <a href="#diferenciais" className="hover:text-white transition">Diferenciais</a>
        </div>
        <Link
          to="/login"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold rounded-xl transition shadow-lg shadow-indigo-600/30"
        >
          Entrar
          <ArrowRight size={14} />
        </Link>
      </nav>

      {/* ── HERO CAROUSEL ── */}
      <section className="relative h-screen min-h-[600px] overflow-hidden">
        <AnimatePresence mode="wait">
          {slides.length > 0 ? (
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0"
            >
              <img
                src={slides[currentSlide]?.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/20" />
            </motion.div>
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950" />
          )}
        </AnimatePresence>

        {/* Slide Content */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-6 pt-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-3xl"
            >
              <h1 className="text-4xl md:text-6xl font-black text-white leading-tight mb-4 drop-shadow-lg">
                {slides[currentSlide]?.title || "Quero Competir"}
              </h1>
              <p className="text-lg md:text-xl text-slate-300 font-medium mb-8 max-w-xl mx-auto leading-relaxed">
                {slides[currentSlide]?.subtitle || "A plataforma de gestão esportiva mais completa do Brasil."}
              </p>
              <Link
                to={slides[currentSlide]?.ctaUrl || "/login"}
                className="inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl text-base transition shadow-2xl shadow-indigo-600/40 hover:shadow-indigo-500/50"
              >
                {slides[currentSlide]?.ctaText || "Começar Agora"}
                <ArrowRight size={18} />
              </Link>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Carousel Controls */}
        {slides.length > 1 && (
          <>
            <button onClick={prevSlide} className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10 transition cursor-pointer">
              <ChevronLeft size={20} />
            </button>
            <button onClick={nextSlide} className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/10 transition cursor-pointer">
              <ChevronRight size={20} />
            </button>
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-2">
              {slides.map((_: any, i: number) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`rounded-full transition-all cursor-pointer ${i === currentSlide ? "w-8 h-2.5 bg-indigo-500" : "w-2.5 h-2.5 bg-white/30 hover:bg-white/50"}`}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* ── ORGANIZATIONS ── */}
      {organizations.length > 0 && (
        <section id="organizacoes" className="py-24 px-6 bg-slate-950">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <span className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-3 block">Nossos Parceiros</span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white">Organizações na Plataforma</h2>
              <p className="text-slate-400 mt-3 max-w-lg mx-auto">Federações, ligas e academias que confiam no Quero Competir.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {organizations.map((org: any) => (
                <Link
                  key={org.id}
                  to={org.subdomain ? `/o/${org.subdomain}` : "#"}
                  className="group bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-5 flex flex-col items-center gap-3 transition text-center"
                >
                  {org.logo_url ? (
                    <img src={org.logo_url} alt={org.name} className="w-14 h-14 rounded-xl object-cover border border-slate-700 group-hover:border-indigo-500/40 transition" />
                  ) : (
                    <div className="w-14 h-14 bg-indigo-950 rounded-xl flex items-center justify-center text-indigo-400 border border-indigo-900">
                      <Building2 size={22} />
                    </div>
                  )}
                  <span className="text-xs font-bold text-slate-300 group-hover:text-white transition leading-snug">{org.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── TOURNAMENTS ── */}
      <section id="torneios" className="py-24 px-6 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <span className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-3 block">Competições</span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-white">Torneios na Plataforma</h2>
            <p className="text-slate-400 mt-3 max-w-lg mx-auto">Acompanhe os eventos mais recentes hospedados na plataforma.</p>
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2 justify-center flex-wrap mb-10">
            {[
              { key: "all", label: "Todos" },
              { key: "open", label: "Inscrições Abertas" },
              { key: "ongoing", label: "Em Andamento" },
              { key: "done", label: "Realizados" },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key as any)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer border ${
                  filterStatus === f.key
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredTournaments.length === 0 ? (
            <div className="text-center py-16 text-slate-500 font-semibold">Nenhum torneio encontrado neste filtro.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTournaments.map((t: any) => {
                const st = getStatusInfo(t);
                const startDate = t.start_date ? new Date(t.start_date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" }) : null;
                return (
                  <Link
                    key={t.id}
                    to={`/public/tournament/${t.id}`}
                    className="group bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-indigo-500/30 rounded-2xl p-5 flex flex-col gap-3 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-10 h-10 bg-indigo-950 rounded-xl flex items-center justify-center border border-indigo-900/60 shrink-0">
                        <Trophy size={18} className="text-indigo-400" />
                      </div>
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full text-white ${st.color} flex items-center gap-1.5`}>
                        <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${st.dot}`} />
                        {st.label}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white group-hover:text-indigo-300 transition leading-snug">{t.name}</h3>
                      {startDate && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <Calendar size={11} />
                          {startDate}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-indigo-400 text-xs font-bold mt-auto">
                      Ver torneio <ArrowRight size={12} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── FEATURES ── */}
      {features.length > 0 && (
        <section id="diferenciais" className="py-24 px-6 bg-slate-950">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <span className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-3 block">Por que escolher</span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-white">Diferenciais da Plataforma</h2>
              <p className="text-slate-400 mt-3 max-w-lg mx-auto">Tudo que você precisa para organizar competições de alto nível.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((f: any, i: number) => (
                <motion.div
                  key={f.id || i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.07 }}
                  className="bg-slate-900/70 border border-slate-800 hover:border-indigo-500/30 rounded-2xl p-6 flex flex-col gap-3 transition group"
                >
                  <span className="text-3xl">{f.icon}</span>
                  <h3 className="font-extrabold text-white group-hover:text-indigo-300 transition">{f.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA FINAL ── */}
      <section className="py-20 px-6 bg-gradient-to-br from-indigo-700 via-indigo-600 to-purple-700 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Pronto para organizar seu próximo evento?</h2>
          <p className="text-indigo-200 mb-8 font-medium">Entre em contato e faça parte da plataforma esportiva que está transformando a gestão de torneios no Brasil.</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-indigo-700 font-extrabold rounded-2xl hover:bg-indigo-50 transition shadow-2xl text-base"
          >
            Acessar a Plataforma
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-slate-950 border-t border-slate-900 py-10 px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Activity size={14} className="text-white" />
          </div>
          <span className="text-sm font-bold text-slate-400">Quero Competir</span>
        </div>
        <p className="text-xs text-slate-600 font-semibold">© {new Date().getFullYear()} Quero Competir · Sistema Oficial de Gestão Esportiva</p>
        <div className="flex justify-center gap-6 mt-4 text-xs text-slate-600 font-medium">
          <Link to="/login" className="hover:text-slate-400 transition">Entrar</Link>
          <a href="#organizacoes" className="hover:text-slate-400 transition">Organizações</a>
          <a href="#torneios" className="hover:text-slate-400 transition">Torneios</a>
        </div>
      </footer>
    </div>
  );
}
