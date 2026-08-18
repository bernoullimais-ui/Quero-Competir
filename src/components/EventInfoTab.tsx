import React, { useEffect, useState } from "react";
import { Calendar, MapPin, Trophy, Users, Image as ImageIcon, Sparkles, User, Shield, ArrowRight, Award, FileText, Download } from "lucide-react";
import { motion } from "motion/react";

interface Category {
  id: string;
  name: string;
  gender?: string;
  age_group?: string;
  max_teams?: number;
}

interface Tournament {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date?: string;
  location?: string;
  logo_url?: string;
}

interface EventInfoTabProps {
  tournament: Tournament;
  categories: Category[];
}

export interface Sponsor {
  name: string;
  logoUrl: string;
  title: string;
}

export interface Attachment {
  title: string;
  url: string;
}

interface ParsedDesc {
  description: string;
  photos: string[];
  bannerUrl: string;
  sponsors: Sponsor[];
  attachments: Attachment[];
}

function parseDescription(raw?: string): ParsedDesc {
  if (!raw) return { description: "", photos: [], bannerUrl: "", sponsors: [], attachments: [] };
  let description = raw;
  let photos: string[] = [];
  let bannerUrl = "";
  let sponsors: Sponsor[] = [];
  let attachments: Attachment[] = [];

  const photosRegex = /<!--OFFICIAL_PHOTOS:(.*?)-->/;
  const photosMatch = raw.match(photosRegex);
  if (photosMatch) {
    photos = photosMatch[1].split(",").map(u => u.trim()).filter(Boolean);
  }

  const bannerRegex = /<!--BANNER_URL:(.*?)-->/;
  const bannerMatch = raw.match(bannerRegex);
  if (bannerMatch) {
    bannerUrl = bannerMatch[1].trim();
  }

  const sponsorsRegex = /<!--SPONSORS:(.*?)-->/;
  const sponsorsMatch = raw.match(sponsorsRegex);
  if (sponsorsMatch) {
    try {
      sponsors = JSON.parse(sponsorsMatch[1]);
    } catch(e){}
  }

  const attachmentsRegex = /<!--ATTACHMENTS:(.*?)-->/;
  const attachmentsMatch = raw.match(attachmentsRegex);
  if (attachmentsMatch) {
    try {
      attachments = JSON.parse(attachmentsMatch[1]);
    } catch(e){}
  }

  // Completely remove ALL metadata HTML comments (<!--...-->) from displayed description text
  const cleanDescription = description.replace(/<!--[\s\S]*?-->/g, "").replace(/&nbsp;/g, " ").trim();

  return { description: cleanDescription, photos, bannerUrl, sponsors, attachments };
}

export default function EventInfoTab({ tournament, categories }: EventInfoTabProps) {
  const [communityImages, setCommunityImages] = useState<string[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [currentFanIndex, setCurrentFanIndex] = useState(0);

  useEffect(() => {
    // Fetch real posts to extract user-posted images
    fetch(`/api/tournaments/${tournament.id}/posts`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const imgUrls = data
            .filter((post: any) => post.mediaType === "image" && post.mediaUrl)
            .map((post: any) => post.mediaUrl);
          setCommunityImages(imgUrls);
          if (imgUrls.length > 0) {
            // Pick a random starting index
            setCurrentFanIndex(Math.floor(Math.random() * imgUrls.length));
          }
        }
      })
      .catch((err) => console.error("Error fetching event gallery:", err));
  }, [tournament.id]);

  // Auto-rotate fan photo every 6 seconds if multiple exist
  useEffect(() => {
    if (communityImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentFanIndex((prev) => {
        const next = Math.floor(Math.random() * communityImages.length);
        return next === prev ? (next + 1) % communityImages.length : next;
      });
    }, 6000);
    return () => clearInterval(interval);
  }, [communityImages]);

  // Parse custom description metadata for official photos
  const parsedDesc = parseDescription(tournament.description);

  // Premium fallback action-sports/tournament imagery
  const defaultPhotos = [
    "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1200", // Futsal / Game action
    "https://images.unsplash.com/photo-1592656094267-764a451502c1?auto=format&fit=crop&q=80&w=1200", // Volleyball / Match
    "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&q=80&w=1200", // Basketball
    "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&q=80&w=1200", // Stadium vibe
    "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&q=80&w=1200", // Running / Track field
  ];

  // Map 5 slot spaces, filling empty slots with default photos
  const organizerPhotos = parsedDesc.photos.length >= 5
    ? parsedDesc.photos.slice(0, 5)
    : [...parsedDesc.photos, ...defaultPhotos].slice(0, 5);

  const fallbackFanPhoto = "https://images.unsplash.com/photo-1511406584103-83c24cf53949?auto=format&fit=crop&q=80&w=1200";
  const finalFanPhoto = communityImages.length > 0
    ? communityImages[currentFanIndex]
    : fallbackFanPhoto;

  const handleShuffleFanPhoto = (e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering full screen view
    if (communityImages.length > 1) {
      let nextIndex = Math.floor(Math.random() * communityImages.length);
      if (nextIndex === currentFanIndex) {
        nextIndex = (currentFanIndex + 1) % communityImages.length;
      }
      setCurrentFanIndex(nextIndex);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      // adjust for timezone offset if needed, but standard locale format is fine
      return date.toLocaleDateString("pt-BR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getGenderLabel = (g?: string) => {
    if (!g) return "Misto / Geral";
    const low = g.toLowerCase();
    if (low === "male" || low === "masculino") return "Masculino";
    if (low === "female" || low === "feminino") return "Feminino";
    if (low === "mixed" || low === "misto") return "Misto";
    return g;
  };

  const heroBgImage = parsedDesc.bannerUrl || organizerPhotos[0];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Bento Grid layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Columns - Info & Modalities */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* About / Description card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-indigo-600"></div>
            <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-4">
              <Sparkles className="text-indigo-600" size={20} /> Sobre o Evento
            </h2>
            {parsedDesc.description ? (
              <div 
                className="prose prose-sm sm:prose-base prose-indigo max-w-none prose-p:leading-relaxed prose-p:text-justify prose-headings:font-black prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline break-words"
                dangerouslySetInnerHTML={{ __html: parsedDesc.description }}
              />
            ) : (
              <p className="text-slate-400 text-sm italic">
                Nenhuma descrição disponível para este torneio. Jogue com garra, respeito e aproveite a competição ao máximo!
              </p>
            )}
          </div>

          {/* Anexos / Documentos (Optional) */}
          {parsedDesc.attachments && parsedDesc.attachments.length > 0 && (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 mb-4">
                <FileText className="text-emerald-500" size={20} /> Documentos e Anexos
              </h2>
              <div className="flex flex-wrap gap-3">
                {parsedDesc.attachments.map((att, idx) => (
                  <a
                    key={idx}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition-all text-sm font-bold text-slate-700 group shadow-sm"
                  >
                    <Download size={16} className="text-slate-400 group-hover:text-emerald-600 transition-colors" />
                    {att.title || "Documento"}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Modalities/Categories Section */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-black text-slate-850 flex items-center gap-2">
                  <Trophy className="text-amber-500" size={22} /> Modalidades & Categorias
                </h2>
                <p className="text-xs text-slate-500 font-bold mt-1">Disputas e divisões confirmadas para o evento</p>
              </div>
              <span className="px-3 py-1 text-xs font-black bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                {categories.length} {categories.length === 1 ? "Categoria" : "Categorias"}
              </span>
            </div>

            {categories.length > 0 ? (
              (() => {
                const isSwimming = categories.some(cat => 
                  cat.name.toLowerCase().includes("natação") || 
                  cat.name.toLowerCase().includes("natacao") ||
                  tournament.name?.toLowerCase().includes("natação") ||
                  tournament.name?.toLowerCase().includes("natacao")
                );

                if (isSwimming) {
                  const uniqueProvas = Array.from(new Set(categories.map(c => 
                    c.name.replace(/natação\s*-\s*/i, "").replace(/natacao\s*-\s*/i, "").trim()
                  )));

                  const uniqueAges = Array.from(new Set(categories.map(c => c.age_group).filter(Boolean))).sort((a, b) => {
                    const numA = parseInt(a!.replace(/\D/g, '')) || 0;
                    const numB = parseInt(b!.replace(/\D/g, '')) || 0;
                    return numA - numB;
                  }) as string[];

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                        <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 border-b border-slate-200 pb-2 mb-3">
                          🏊 As Provas (Estilos)
                        </h3>
                        <div className="flex flex-col gap-2">
                          {uniqueProvas.map((prova, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm font-bold text-slate-700 bg-white px-3 py-2 rounded-xl border border-slate-200/60 shadow-sm">
                              <span className="text-indigo-600 w-5 font-black">{idx + 1}º</span> {prova}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-3 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                        <h3 className="font-black text-slate-800 text-sm flex items-center gap-2 border-b border-slate-200 pb-2 mb-3">
                          🎂 Classes de Idade
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {uniqueAges.map((age, idx) => (
                            <span key={idx} className="px-3 py-1.5 bg-white text-slate-700 border border-slate-200/60 text-xs font-black rounded-xl shadow-sm">
                              {age}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Default rendering for other sports
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {categories.map((cat, index) => (
                      <div
                        key={cat.id || index}
                        className="p-5 border border-slate-100 bg-slate-50/40 rounded-2xl flex items-start gap-3.5 hover:border-indigo-100 hover:bg-indigo-50/10 transition-all duration-350 shadow-ultra-sm relative overflow-hidden group"
                      >
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0 font-bold group-hover:scale-110 transition-transform">
                          <Users size={18} />
                        </div>
                        
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <h3 className="font-extrabold text-sm text-slate-800 truncate select-none">{cat.name}</h3>
                          <div className="flex flex-wrap gap-1.5">
                            <span className="px-2 py-0.5 bg-white text-slate-600 border border-slate-205 text-[10px] font-black rounded-lg">
                              🤼 {getGenderLabel(cat.gender)}
                            </span>
                            {cat.age_group && (
                              <span className="px-2 py-0.5 bg-white text-slate-600 border border-slate-205 text-[10px] font-black rounded-lg">
                                🎂 {cat.age_group}
                              </span>
                            )}
                            {cat.max_teams && (
                              <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-black rounded-lg">
                                🛡️ Máx: {cat.max_teams} Times
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            ) : (
              <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl">
                <p className="text-slate-400 font-medium text-sm">Nenhuma categoria confirmada neste evento.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Patrocinadores, Apoio & Media / Photos Image Gallery */}
        <div className="space-y-6">
          {/* Patrocinadores & Apoio (Exibido acima das imagens do evento) */}
          {parsedDesc.sponsors && parsedDesc.sponsors.length > 0 && (
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div>
                <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <Shield className="text-amber-500" size={18} /> Patrocinadores & Apoio
                </h2>
                <p className="text-xs text-slate-500 font-bold mt-0.5">Parceiros e realizadores oficiais deste evento</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {parsedDesc.sponsors.map((sp, idx) => (
                  <div key={idx} className="bg-slate-50/70 p-3 rounded-2xl border border-slate-100 flex flex-col items-center justify-between text-center min-h-[100px] group hover:border-indigo-200 hover:bg-indigo-50/20 transition-all">
                    <div className="flex-1 flex items-center justify-center w-full py-1">
                      {sp.logoUrl ? (
                        <img
                          src={sp.logoUrl}
                          alt={sp.name}
                          className="h-12 max-w-full object-contain filter group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                          onError={(e: any) => e.target.style.display = 'none'}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center font-bold text-slate-500 text-xs uppercase">
                          {sp.name ? sp.name.slice(0, 2) : "PA"}
                        </div>
                      )}
                    </div>
                    <div className="mt-1.5 flex flex-col items-center gap-1 w-full">
                      {sp.name && <span className="text-[11px] font-bold text-slate-700 truncate w-full">{sp.name}</span>}
                      <span className="text-[8px] font-bold text-slate-500 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-md uppercase tracking-wider">
                        {sp.title || "Apoio"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div>
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <ImageIcon className="text-fuchsia-500" size={18} /> Imagens do Evento
              </h2>
              <p className="text-xs text-slate-500 font-bold mt-0.5">Fotos da arquibancada, quadras e lances</p>
            </div>

            {/* Gallery Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* First 5: Organizer Photos */}
              {organizerPhotos.map((img, idx) => (
                <div
                  key={`org-${idx}`}
                  onClick={() => setSelectedPhoto(img)}
                  className="relative aspect-square rounded-2xl overflow-hidden border border-slate-150 cursor-zoom-in hover:brightness-95 transition-all group shadow-sm bg-slate-900"
                >
                  <img
                    src={img}
                    alt={`Foto Oficial ${idx + 1}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-slate-950/10 group-hover:bg-slate-950/0 transition-colors"></div>
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-indigo-600/95 text-white text-[9px] font-black rounded-md border border-indigo-400/20 uppercase tracking-wider shadow-sm">
                    Oficial
                  </span>
                </div>
              ))}

              {/* 6th: Dynamic Fan Photo */}
              <div
                onClick={() => setSelectedPhoto(finalFanPhoto)}
                className="relative aspect-square rounded-2xl overflow-hidden border-2 border-dashed border-fuchsia-300 bg-fuchsia-50/5 cursor-zoom-in hover:brightness-95 transition-all group shadow-md"
              >
                <img
                  src={finalFanPhoto}
                  alt="Enviada por fãs"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  referrerPolicy="no-referrer"
                />
                
                {/* Dark Overlay */}
                <div className="absolute inset-0 bg-slate-950/20 group-hover:bg-slate-950/10 transition-colors"></div>
                
                {/* Fan Badge with Glow */}
                <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white text-[9px] font-black rounded-md border border-fuchsia-300/30 uppercase tracking-wider shadow-lg flex items-center gap-1">
                  <Sparkles size={8} /> Enviado por fãs
                </span>

                {/* Optional manual shuffle control if we have multiple community images */}
                {communityImages.length > 1 && (
                  <button
                    onClick={handleShuffleFanPhoto}
                    title="Alternar foto da torcida"
                    className="absolute top-2 right-2 w-7 h-7 bg-white/90 hover:bg-white text-fuchsia-700 rounded-full flex items-center justify-center border border-fuchsia-205 shadow-md backdrop-blur-xs transition-transform hover:rotate-180 duration-500 scale-90 group-hover:scale-100"
                  >
                    🔄
                  </button>
                )}
              </div>
            </div>

            {communityImages.length > 0 && (
              <div className="p-3 bg-fuchsia-50/50 border border-fuchsia-100 rounded-2xl flex items-center gap-2 text-[11px] font-semibold text-fuchsia-800">
                <Sparkles size={14} className="shrink-0 text-fuchsia-600 animate-bounce" />
                <span>As fotos publicadas pelos usuários no mural aparecem aqui automaticamente!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo Viewer Modal Overlay */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4 backdrop-blur-sm cursor-zoom-out animate-in fade-in duration-200"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl bg-black flex items-center justify-center shadow-2xl border border-white/10">
            <img
              src={selectedPhoto}
              alt="Visualização Cheia"
              className="max-w-full max-h-[80vh] object-contain rounded-xl"
              referrerPolicy="no-referrer"
            />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 w-9 h-9 bg-black/60 hover:bg-black text-white rounded-full flex items-center justify-center text-xl font-bold border border-white/20 transition-all shadow-md"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
