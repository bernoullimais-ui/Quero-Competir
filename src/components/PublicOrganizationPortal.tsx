import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Building2, Calendar, MapPin, Trophy, ExternalLink, Globe, Instagram, Youtube, Sparkles, ArrowRight, Shield } from "lucide-react";
import { applyBrandColors } from "../utils/theme";
import { slugify } from "../utils/slugify";

interface PublicOrganizationPortalProps {
  overrideSubdomain?: string;
}

export default function PublicOrganizationPortal({ overrideSubdomain }: PublicOrganizationPortalProps) {
  const params = useParams();
  const subdomain = overrideSubdomain || params.subdomain || params.id;
  const [data, setData] = useState<{ organization: any; tournaments: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let targetSubdomain = subdomain;
    
    // Auto-detect subdomain from hostname if accessing subdomain.querocompetir.com.br
    if (!targetSubdomain && typeof window !== "undefined") {
      const host = window.location.hostname.toLowerCase();
      if (host.endsWith(".querocompetir.com.br") && host !== "www.querocompetir.com.br" && host !== "querocompetir.com.br") {
        targetSubdomain = host.split(".querocompetir.com.br")[0];
      } else if (host.endsWith(".vercel.app") && host.includes("-")) {
        // e.g. subdomain.vercel.app fallback
      }
    }

    if (!targetSubdomain) {
      setError("Subdomínio da organização não especificado.");
      setLoading(false);
      return;
    }

    fetch(`/api/tournaments/public/org/${encodeURIComponent(targetSubdomain)}`)
      .then(r => r.json())
      .then(res => {
        if (res.error) {
          setError(res.error);
        } else {
          setData(res);
          if (res.organization) {
            applyBrandColors(res.organization);
            document.title = `${res.organization.name} - Portal Oficial de Torneios`;
          }
        }
      })
      .catch(err => {
        console.error(err);
        setError("Erro ao carregar os dados da organização.");
      })
      .finally(() => setLoading(false));
  }, [subdomain]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-indigo-400/30 border-t-indigo-500 rounded-full animate-spin"></div>
          <span className="text-slate-400 text-sm font-semibold">Carregando portal da instituição...</span>
        </div>
      </div>
    );
  }

  if (error || !data || !data.organization) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
          <Building2 size={32} className="text-slate-400" />
        </div>
        <h2 className="text-2xl font-black text-white mb-2">Portal não encontrado</h2>
        <p className="text-slate-400 max-w-md text-sm mb-6">
          {error || "A instituição ou liga solicitada não possui um portal ativo no momento."}
        </p>
        <Link to="/" className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-sm transition">
          Voltar ao Início
        </Link>
      </div>
    );
  }

  const { organization: org, tournaments = [] } = data;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Branding Header */}
      <header className="relative bg-gradient-to-b from-indigo-900/60 via-slate-900 to-slate-950 border-b border-white/10 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-600/20 via-transparent to-transparent"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
            {/* Logo */}
            <div 
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl p-3 shrink-0 shadow-2xl flex items-center justify-center overflow-hidden border-2 border-white/20"
              style={{ backgroundColor: "#ffffff" }}
            >
              {org.logo_url ? (
                <img 
                  src={org.logo_url} 
                  alt={org.name} 
                  className="max-w-full max-h-full object-contain" 
                  style={{ backgroundColor: "#ffffff" }}
                />
              ) : (
                <Building2 size={48} className="text-indigo-600" />
              )}
            </div>

            {/* Main Info */}
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                <span className="px-3 py-1 bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-black rounded-full uppercase tracking-wider flex items-center gap-1.5">
                  <Shield size={12} /> Portal Oficial
                </span>
                {org.subdomain && (
                  <span className="text-xs text-slate-400 font-mono">
                    {org.subdomain}.querocompetir.com.br
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">{org.name}</h1>
              
              {org.description && (
                <p className="text-slate-300 text-sm sm:text-base max-w-3xl font-normal leading-relaxed">
                  {org.description}
                </p>
              )}

              {/* Social Links */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2 text-xs font-semibold">
                {org.website && (
                  <a
                    href={org.website.startsWith("http") ? org.website : `https://${org.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition"
                  >
                    <Globe size={14} className="text-indigo-400" /> Website
                  </a>
                )}
                {org.instagram && (
                  <a
                    href={`https://instagram.com/${org.instagram.replace("@", "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition"
                  >
                    <Instagram size={14} className="text-pink-400" /> @{org.instagram.replace("@", "")}
                  </a>
                )}
                {org.youtube && (
                  <a
                    href={org.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 transition"
                  >
                    <Youtube size={14} className="text-rose-500" /> YouTube
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div>
            <h2 className="text-2xl font-black text-white flex items-center gap-2">
              <Trophy className="text-amber-400" size={24} /> Torneios & Competições
            </h2>
            <p className="text-xs text-slate-400 font-semibold mt-1">
              Confira a lista de campeonatos oficiais organizados por {org.name}
            </p>
          </div>
          <span className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300">
            {tournaments.length} {tournaments.length === 1 ? "Torneio" : "Torneios"}
          </span>
        </div>

        {tournaments.length === 0 ? (
          <div className="text-center py-16 bg-white/5 rounded-3xl border border-white/10 p-8 space-y-3">
            <Trophy size={48} className="mx-auto text-slate-600" />
            <h3 className="text-lg font-bold text-slate-300">Nenhum torneio publicado no momento</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Fique atento! Em breve novos torneios e eventos serão divulgados aqui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tournaments.map((t) => {
              const friendlyUrl = `/public/torneio/${slugify(t.name || t.id)}`;
              const locationMatch = (t.description || "").match(/<!--EVENT_LOCATION:(.*?)-->/);
              const eventLocation = t.location || (locationMatch ? locationMatch[1].trim() : "");
              return (
                <div
                  key={t.id}
                  className="bg-slate-900/80 rounded-3xl border border-white/10 overflow-hidden hover:border-indigo-500/50 transition-all group flex flex-col justify-between shadow-xl"
                >
                  <div className="p-6 space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div 
                        className="w-14 h-14 rounded-2xl p-1.5 shrink-0 flex items-center justify-center overflow-hidden border border-slate-200 shadow-sm"
                        style={{ backgroundColor: "#ffffff" }}
                      >
                        {t.logo_url ? (
                          <img 
                            src={t.logo_url} 
                            alt={t.name} 
                            className="max-w-full max-h-full object-contain" 
                            style={{ backgroundColor: "#ffffff" }}
                          />
                        ) : (
                          <Trophy size={26} className="text-indigo-600" />
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        t.status === 'active' || t.status === 'open' 
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}>
                        {t.status === 'active' ? 'Em Andamento' : t.status === 'open' ? 'Inscrições Abertas' : 'Publicado'}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors line-clamp-2">
                        {t.name}
                      </h3>
                      {eventLocation && (
                        <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-2 font-medium">
                          <MapPin size={14} className="text-rose-400" /> {eventLocation}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="px-6 py-4 bg-white/5 border-t border-white/5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                      <Calendar size={14} className="text-indigo-400" />
                      {t.start_date ? new Date(t.start_date).toLocaleDateString("pt-BR") : "A definir"}
                    </span>

                    <Link
                      to={friendlyUrl}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/20"
                    >
                      Acessar <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-xs text-slate-500">
        <p>© {new Date().getFullYear()} {org.name} • Desenvolvido com Quero Competir</p>
      </footer>
    </div>
  );
}
