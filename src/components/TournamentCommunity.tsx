import React, { useEffect, useState } from "react";
import { MessageSquare, Heart, ThumbsUp, Sparkles, Send, Trash2, Video, Image, FileText, User, HelpCircle, ShieldCheck, ExternalLink } from "lucide-react";
import { motion } from "motion/react";

interface Props {
  tournamentId: string;
  isOrganizer?: boolean; // Checks if current logged-in user is organizer for moderation
}

interface PostComment {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
}

interface CommunityPost {
  id: string;
  tournamentId: string;
  authorType: "organizer" | "athlete" | "fan" | "guest" | "institution" | "staff";
  authorName: string;
  authorAvatar: string;
  content: string;
  mediaUrl: string;
  mediaType: "image" | "video" | "none";
  createdAt: string;
  reactions: { like: number; love: number; applause: number; is_pending?: boolean };
  comments: PostComment[];
}

export function getUserConditionAndBadge(role: string) {
  const r = (role || "").toLowerCase();
  if (r === "super_admin" || r === "organizer") {
    return {
      label: "Organizador",
      authorType: "organizer" as const,
      emoji: "👑",
      bgColor: "bg-indigo-50",
      borderColor: "border-indigo-200",
      textColor: "text-indigo-800"
    };
  } else if (r === "institution") {
    return {
      label: "Instituição",
      authorType: "institution" as const,
      emoji: "🏢",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      textColor: "text-blue-700"
    };
  } else if (r === "guardian") {
    return {
      label: "Atleta / Família",
      authorType: "athlete" as const,
      emoji: "👟",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      textColor: "text-emerald-700"
    };
  } else if (r === "staff" || r === "referee" || r === "table_official") {
    return {
      label: "Staff",
      authorType: "staff" as const,
      emoji: "⏱️",
      bgColor: "bg-orange-50",
      borderColor: "border-orange-200",
      textColor: "text-orange-700"
    };
  } else {
    return {
      label: "Torcedor",
      authorType: "fan" as const,
      emoji: "📣",
      bgColor: "bg-slate-50",
      borderColor: "border-slate-200",
      textColor: "text-slate-700"
    };
  }
}

export default function TournamentCommunity({ tournamentId, isOrganizer: isOrganizerProp = false }: Props) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(isOrganizerProp);
  const [orgDetails, setOrgDetails] = useState<any>(null);
  
  // Login Session & Notices
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [successNotice, setSuccessNotice] = useState("");
  const [customRegisteredAvatar, setCustomRegisteredAvatar] = useState<string | null>(null);

  // Post Creation States
  const [newContent, setNewContent] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorType, setAuthorType] = useState<"fan" | "athlete" | "organizer">("fan");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"none" | "image" | "video">("none");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Comment state per post ID
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [commentNames, setCommentNames] = useState<Record<string, string>>({});
  const [postToDelete, setPostToDelete] = useState<string | null>(null);

  const fetchPosts = (forceIsOrganizer?: boolean) => {
    setLoading(true);
    const currentIsOrg = forceIsOrganizer !== undefined ? forceIsOrganizer : isOrganizer;
    const url = currentIsOrg ? `/api/tournaments/${tournamentId}/posts?all=true` : `/api/tournaments/${tournamentId}/posts`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        setPosts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching community posts:", err);
        setLoading(false);
      });
  };

  useEffect(() => {
    let userIsOrganizer = isOrganizerProp;
    try {
      const savedUserStr = localStorage.getItem("currentUser");
      if (savedUserStr) {
        const u = JSON.parse(savedUserStr);
        setCurrentUser(u);
        setAuthorName(u.name || "");
        if (u.role === "organizer" || u.role === "super_admin") {
          userIsOrganizer = true;
          setIsOrganizer(true);
          const headers: any = {};
          if (u.token) {
            headers["Authorization"] = `Bearer ${u.token}`;
          }
          if (u.id) {
            headers["x-organizer-id"] = u.id;
          }
          fetch("/api/tournaments/organization", { headers })
            .then(res => res.json())
            .then(data => {
              if (data && !data.error) {
                setOrgDetails(data);
                if (data.logo_url) {
                  setCustomRegisteredAvatar(data.logo_url);
                }
              }
            })
            .catch(console.error);
        } else if (u.role === "institution" && u.referenceId) {
          setIsOrganizer(isOrganizerProp);
          fetch(`/api/institutions/${u.referenceId}`)
            .then(res => res.json())
            .then(data => {
              if (data && data.logo_url) {
                setCustomRegisteredAvatar(data.logo_url);
              }
            })
            .catch(console.error);
        } else if (u.role === "guardian" && u.email) {
          setIsOrganizer(isOrganizerProp);
          fetch(`/api/auth/guardian/${encodeURIComponent(u.email)}/athletes`)
            .then(res => res.json())
            .then(data => {
              if (Array.isArray(data)) {
                const withPhoto = data.find(sub => sub.photoUrl || sub.photo_url);
                if (withPhoto) {
                  setCustomRegisteredAvatar(withPhoto.photoUrl || withPhoto.photo_url);
                }
              }
            })
            .catch(console.error);
        } else {
          setIsOrganizer(isOrganizerProp);
        }
      } else {
        setIsOrganizer(isOrganizerProp);
        fetch("/api/tournaments/organization")
          .then(res => res.json())
          .then(data => {
            if (data && !data.error) {
              setOrgDetails(data);
            }
          })
          .catch(console.error);
      }
    } catch (e) {
      console.error(e);
    }
    fetchPosts(userIsOrganizer);
  }, [tournamentId, isOrganizerProp]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim() && !mediaUrl.trim()) {
      setErrorMsg("Escreva alguma mensagem ou insira o link de uma imagem/vídeo para postar.");
      return;
    }

    const isLoggedUser = !!currentUser;
    const isPending = !isOrganizer && !isLoggedUser;

    const name = isOrganizer
      ? (orgDetails?.name || currentUser?.name || authorName.trim() || "Organizador Principal")
      : (authorName.trim() || (isLoggedUser ? (currentUser?.name || "Usuário") : "Competidor Anônimo"));
    setIsSubmitting(true);
    setErrorMsg("");
    setSuccessNotice("");

    try {
      let finalAuthorType: "organizer" | "athlete" | "fan" | "guest" | "institution" | "staff" = "guest";
      let finalAvatar = "📣";

      if (isOrganizer) {
        finalAuthorType = "organizer";
        finalAvatar = customRegisteredAvatar || orgDetails?.logo_url || "👑";
      } else if (isLoggedUser && currentUser) {
        const cond = getUserConditionAndBadge(currentUser.role);
        finalAuthorType = cond.authorType;
        finalAvatar = customRegisteredAvatar || cond.emoji;
      } else {
        finalAuthorType = "guest";
        finalAvatar = "📣";
      }

      const res = await fetch(`/api/tournaments/${tournamentId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorType: finalAuthorType,
          authorName: name,
          authorAvatar: finalAvatar,
          content: newContent,
          mediaUrl,
          mediaType,
          isPending
        })
      });

      if (!res.ok) throw new Error("Could not create post");
      
      setNewContent("");
      setMediaUrl("");
      setMediaType("none");
      if (!isOrganizer && !isLoggedUser) setAuthorName("");
      
      if (isPending) {
        setSuccessNotice("Publicação enviada com sucesso! Como você não está logado, ela será exibida no feed público assim que for aprovada pelo organizador.");
      } else {
        setSuccessNotice("Sua publicação foi postada com sucesso!");
      }
      
      fetchPosts(); // Refresh feed
    } catch (err) {
      console.error(err);
      setErrorMsg("Não foi possível enviar a publicação. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReact = async (postId: string, type: "like" | "love" | "applause") => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/posts/${postId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type })
      });
      if (res.ok) {
        const updatedPost = await res.json();
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions: updatedPost.reactions } : p));
      }
    } catch (err) {
      console.error("Error reacting to post:", err);
    }
  };

  const handleAddComment = async (postId: string) => {
    const text = commentTexts[postId]?.trim();
    if (!text) return;

    const name = commentNames[postId]?.trim() || "Visitante";

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName: name, content: text })
      });

      if (res.ok) {
        const updatedPost = await res.json();
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments: updatedPost.comments } : p));
        // Clear inputs
        setCommentTexts(prev => ({ ...prev, [postId]: "" }));
        setCommentNames(prev => ({ ...prev, [postId]: "" }));
      }
    } catch (err) {
      console.error("Error adding comment:", err);
    }
  };

  const handleDeletePost = (postId: string) => {
    setPostToDelete(postId);
  };

  const executeDeletePost = async (postId: string) => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/posts/${postId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setPosts(prev => prev.filter(p => p.id !== postId));
      }
    } catch (err) {
      console.error("Error deleting post:", err);
    }
  };

  const handleApprovePost = async (postId: string) => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/posts/${postId}/approve`, {
        method: "POST"
      });
      if (res.ok) {
        const updatedPost = await res.json();
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions: updatedPost.reactions } : p));
      }
    } catch (err) {
      console.error("Error approving post:", err);
    }
  };

  const detectYoutubeInText = (text: string) => {
    if (!text) return null;
    const regExp = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
    const match = text.match(regExp);
    if (match && match[1]) {
      return match[1];
    }
    return null;
  };

  const getEmbedHtml = (urlStr: string) => {
    if (!urlStr) return null;
    let videoId = "";
    
    // Standard and highly robust YouTube ID extraction regex to prevent mismatch and casing errors
    const regExp = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;
    const match = urlStr.match(regExp);
    if (match && match[1]) {
      videoId = match[1];
    }
    
    if (videoId) {
      // Use youtube-nocookie.com to bypass standard sandbox and partitionless cookie block policies in sandboxed iframes.
      // Append the origin query parameter for proper hosting verification.
      const originUrl = typeof window !== "undefined" ? encodeURIComponent(window.location.origin) : "";
      const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&origin=${originUrl}`;

      return (
        <div className="aspect-video w-full rounded-2xl overflow-hidden border border-slate-200/80 shadow-sm bg-slate-900 relative mt-3 animate-in fade-in duration-300">
          <iframe
            className="w-full h-full"
            src={embedUrl}
            title="Vídeo do Torneio"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          ></iframe>
        </div>
      );
    }

    // Direct Video file preview fallback
    return (
      <div className="mt-3">
        <video src={urlStr} controls className="w-full rounded-2xl border border-slate-100 shadow-sm max-h-[350px] object-contain bg-black" />
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Col 1: Creation Panel & Tips */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
              <Sparkles className="text-amber-500 animate-pulse" size={20} />
              Criar Publicação
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Compartilhe fotos, vídeos do Youtube, comunicados ou torça pelo seu time predileto!
            </p>
          </div>

          <form onSubmit={handleCreatePost} className="space-y-4">
            {successNotice && (
              <div className="p-3 bg-emerald-50 border border-emerald-250 text-emerald-800 text-xs font-semibold rounded-2xl animate-in fade-in flex items-center justify-between gap-2">
                <span className="flex-1">{successNotice}</span>
                <button type="button" onClick={() => setSuccessNotice("")} className="text-[10px] font-bold text-emerald-700 underline shrink-0">Fechar</button>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-red-50 border border-red-250 text-red-650 text-xs font-semibold rounded-2xl">
                {errorMsg}
              </div>
            )}

            {isOrganizer ? (
              <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center gap-2.5">
                {orgDetails?.logo_url ? (
                  <img src={orgDetails.logo_url} alt="Logo" className="w-8 h-8 rounded-full object-cover border border-indigo-250 bg-white" />
                ) : (
                  <span className="text-base">👑</span>
                )}
                <div>
                  <p className="text-xs font-black text-indigo-900 animate-in fade-in">Postando como {orgDetails?.name || "Organizador"}</p>
                  <p className="text-[10px] text-indigo-700">Seus comunicados têm o selo verificado de organizador principal do evento.</p>
                </div>
              </div>
            ) : currentUser ? (() => {
              const cond = getUserConditionAndBadge(currentUser.role);
              return (
                <div className="space-y-3 animate-in fade-in duration-300">
                  <div className="p-3.5 bg-emerald-50/40 border border-emerald-250 rounded-2xl flex items-center gap-2.5 shadow-ultra-sm relative overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-800 shrink-0 overflow-hidden border border-emerald-200">
                      {customRegisteredAvatar ? (
                        <img src={customRegisteredAvatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : currentUser.name ? (
                        currentUser.name.substring(0, 2).toUpperCase()
                      ) : (
                        "U"
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-900">Postando como <span className="text-emerald-700">{currentUser.name}</span></p>
                      <p className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                        <span>✓</span> Conta Ativa • Postagens reconhecidas e publicadas livremente!
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-extrabold text-slate-650 mb-1">Seu Nome / Apelido</label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 text-slate-400" size={16} />
                        <input
                          type="text"
                          required
                          placeholder="Ex: João Silva"
                          value={authorName}
                          onChange={(e) => setAuthorName(e.target.value)}
                          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-all font-semibold bg-slate-50 text-slate-600 cursor-not-allowed"
                          disabled
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-extrabold text-slate-650 mb-1">Condição do Autor</label>
                      <div className={`px-4.5 py-2.5 text-sm border rounded-xl flex items-center gap-2 font-black select-none ${cond.bgColor} ${cond.borderColor} ${cond.textColor}`}>
                        <span>{cond.emoji}</span>
                        <span>{cond.label} (Reconhecido)</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="space-y-3 animate-in fade-in duration-300">
                <div className="p-3.5 bg-amber-50/70 border border-amber-250 rounded-2xl space-y-2">
                  <div className="flex items-start gap-2.5">
                    <span className="text-sm shrink-0">⚠️</span>
                    <div>
                      <p className="text-xs font-black text-amber-900 leading-tight">Postagem sob Moderação</p>
                      <p className="text-[10px] text-amber-700 font-bold leading-relaxed mt-0.5">
                        Para postar livremente (com publicação instantânea), você precisa estar logado na plataforma.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-amber-200/50">
                    <button
                      type="button"
                      onClick={() => window.location.href = "/"}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-xs shrink-0 select-none cursor-pointer"
                    >
                      Entrar / Cadastrar
                    </button>
                    <span className="text-[9px] text-amber-600 font-bold leading-tight">
                      ou continue como visitante (aparecerá somente após aprovação)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-650 mb-1">Seu Nome / Apelido</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 text-slate-400" size={16} />
                      <input
                        type="text"
                        required
                        placeholder="Ex: João Silva (Visitante)"
                        value={authorName}
                        onChange={(e) => setAuthorName(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-slate-650 mb-1">Perfil do Autor</label>
                    <div className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-slate-50 font-bold text-slate-500 select-none">
                      👤 Visitante (Anônimo)
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-extrabold text-slate-650 mb-1">Mensagem</label>
              <textarea
                placeholder="O que está acontecendo no torneio? Escreva aqui..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                maxLength={400}
                rows={3}
                className="w-full p-4 text-sm border border-slate-200 rounded-2xl outline-none focus:border-indigo-500 transition-all font-medium resize-none shadow-inner"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-slate-650 mb-1">Deseja adicionar fotos ou vídeos?</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => { setMediaType("none"); setMediaUrl(""); }}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                    mediaType === "none" ? "bg-slate-900 border-slate-900 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <FileText size={14} /> Nenhum
                </button>
                <button
                  type="button"
                  onClick={() => { setMediaType("image"); }}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                    mediaType === "image" ? "bg-indigo-650 border-indigo-650 text-white shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Image size={14} /> Imagem (URL)
                </button>
                <button
                  type="button"
                  onClick={() => { setMediaType("video"); }}
                  className={`py-2 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 ${
                    mediaType === "video" ? "bg-red-650 border-red-655 text-white shadow-sm" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Video size={14} /> Vídeo
                </button>
              </div>

              {mediaType !== "none" && (
                <div className="mt-3 animate-in slide-in-from-top-2 duration-300">
                  <input
                    type="url"
                    placeholder={mediaType === 'image' ? "Cole a URL da sua imagem (ex: https://...)" : "Cole a URL do vídeo (ex: Youtube, direct link)"}
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    className="w-full px-4 py-2 text-sm border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-all font-medium"
                  />
                  <p className="text-[10px] text-slate-400 font-semibold mt-1.5">
                    {mediaType === 'image' 
                      ? "Use URLs da internet, como fotos hospedadas publicamente." 
                      : "Insira links padrão do YouTube para gerarmos o player interativo."}
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3 rounded-2xl transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-2 text-sm"
            >
              <Send size={16} />
              {isSubmitting ? "Publicando..." : "Publicar no Feed"}
            </button>
          </form>
        </div>

        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-6 rounded-3xl border border-indigo-950 shadow-sm space-y-4">
          <h4 className="font-bold text-sm tracking-tight text-indigo-200 flex items-center gap-1.5">
            <HelpCircle size={16} className="text-indigo-400" />
            Regras da Comunidade
          </h4>
          <ul className="text-xs text-indigo-100/80 space-y-2 list-disc list-inside font-medium leading-relaxed">
            <li>Mantenha o fair play e respeito por todas as equipes e atletas.</li>
            <li>Use imagens e mídias apropriadas ao ecossistema escolar/esportivo.</li>
            <li>Denuncie comentários agressivos ao organizador principal do evento.</li>
          </ul>
        </div>
      </div>

      {/* Col 2: Feed of Posts */}
      <div className="lg:col-span-7 space-y-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-3xl">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-xs font-semibold text-slate-400 mt-3">Carregando feed...</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl space-y-3">
            <div className="text-3xl">💬</div>
            <h4 className="font-black text-slate-800">Seja o primeiro a publicar!</h4>
            <p className="text-sm text-slate-500 font-medium max-w-sm mx-auto">
              Nenhuma postagem foi criada ainda para este torneio. Compartilhe novidades, placares ou fotos agora mesmo.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => {
              const isPending = post.reactions && post.reactions.is_pending === true;
              return (
                <div 
                  key={post.id} 
                  className={`bg-white border shadow-xs rounded-3xl overflow-hidden transition-all duration-300 ${
                    isPending ? "border-amber-300 bg-amber-50/5" : "border-slate-250"
                  }`}
                >
                  {/* Moderation Banner for Organizers */}
                  {isPending && isOrganizer && (
                    <div className="p-4 bg-amber-50/60 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in">
                      <div className="flex items-start gap-2">
                        <span className="text-base">⏳</span>
                        <div>
                          <p className="text-xs font-black text-amber-900 leading-tight">Post de Visitante (Aguardando Aprovação)</p>
                          <p className="text-[10px] text-amber-700/80 font-bold">Esta publicação só é exibida para você (organizador) e aguarda sua moderação.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleApprovePost(post.id)}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <span>✓</span> Aprovar Post
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePost(post.id)}
                          className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                        >
                          <span>✕</span> Recusar
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Post Header */}
                  <div className="p-6 border-b border-slate-50 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-50 border border-slate-200 rounded-full flex items-center justify-center text-lg select-none overflow-hidden">
                        {post.authorAvatar && (post.authorAvatar.startsWith("http") || post.authorAvatar.startsWith("/") || post.authorAvatar.startsWith("data:")) ? (
                          <img src={post.authorAvatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          post.authorAvatar || "👑"
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-sm text-slate-900">{post.authorName}</span>
                          {post.authorType === "organizer" && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[9px] font-black uppercase rounded-full">
                              <ShieldCheck size={10} /> Organizador
                            </span>
                          )}
                          {post.authorType === "athlete" && (
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-105 text-[9px] font-black uppercase rounded-full">
                              Atleta / Família
                            </span>
                          )}
                          {post.authorType === "institution" && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-105 text-[9px] font-black uppercase rounded-full">
                              🏢 Instituição
                            </span>
                          )}
                          {post.authorType === "staff" && (
                            <span className="px-2 py-0.5 bg-orange-50 text-orange-705 border border-orange-105 text-[9px] font-black uppercase rounded-full">
                              ⏱️ Staff
                            </span>
                          )}
                          {isPending && (
                            <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-205 text-[9px] font-black uppercase rounded-full">
                              Pendente
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">
                          {new Date(post.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>
                    </div>

                    {(isOrganizer || post.authorType === "organizer") && (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="p-2 text-slate-400 hover:text-rose-650 hover:bg-rose-50 rounded-xl transition-all"
                        title="Apagar Postagem"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                {/* Content body */}
                <div className="px-6 py-4 space-y-3">
                  {post.content && (
                    <p className="text-slate-800 text-sm font-medium leading-relaxed whitespace-pre-wrap">{post.content}</p>
                  )}

                  {/* Render media */}
                  {post.mediaUrl ? (
                    <>
                      {post.mediaType === "image" ? (
                        <div className="rounded-2xl border border-slate-100 overflow-hidden shadow-sm max-h-[400px] bg-slate-50 flex items-center justify-center mt-2">
                          <img 
                            src={post.mediaUrl} 
                            alt="Mídia da Comunidade" 
                            className="w-full h-full object-contain max-h-[400px]" 
                            referrerPolicy="no-referrer"
                            onError={(e: any) => e.target.parentElement.style.display = 'none'}
                          />
                        </div>
                      ) : (
                        getEmbedHtml(post.mediaUrl)
                      )}
                    </>
                  ) : (
                    // Intelligent fallback: Detect a YouTube link in the text description itself
                    post.content && detectYoutubeInText(post.content) && (
                      getEmbedHtml(post.content)
                    )
                  )}
                </div>

                {/* Interactions/Reactions bar */}
                <div className="px-6 py-3 bg-slate-50/50 border-t border-b border-slate-50 flex items-center gap-4 justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReact(post.id, "like")}
                      className="flex items-center gap-1 px-3 py-1.5 hover:bg-slate-100 rounded-xl transition-all text-slate-600 font-bold text-xs"
                    >
                      <ThumbsUp size={14} className="text-indigo-500" />
                      <span>{post.reactions?.like || 0}</span>
                    </button>
                    <button
                      onClick={() => handleReact(post.id, "love")}
                      className="flex items-center gap-1 px-3 py-1.5 hover:bg-slate-100 rounded-xl transition-all text-slate-650 font-bold text-xs"
                    >
                      <Heart size={14} className="text-rose-500 fill-rose-500" />
                      <span>{post.reactions?.love || 0}</span>
                    </button>
                    <button
                      onClick={() => handleReact(post.id, "applause")}
                      className="flex items-center gap-1 px-3 py-1.5 hover:bg-slate-100 rounded-xl transition-all text-slate-650 font-bold text-xs"
                    >
                      <span>👏</span>
                      <span>{post.reactions?.applause || 0}</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setActiveCommentPostId(activeCommentPostId === post.id ? null : post.id)}
                    className="flex items-center gap-1.5 text-xs font-bold text-indigo-650 hover:text-indigo-800 bg-indigo-50/70 hover:bg-indigo-50 px-3.5 py-1.5 rounded-xl transition-all"
                  >
                    <MessageSquare size={14} />
                    <span>Respostas ({post.comments?.length || 0})</span>
                  </button>
                </div>

                {/* Comments Section */}
                {(activeCommentPostId === post.id || (post.comments && post.comments.length > 0)) && (
                  <div className="bg-slate-50/80 p-6 space-y-4 border-t border-slate-50">
                    {/* List of comments */}
                    {post.comments && post.comments.length > 0 && (
                      <div className="space-y-3">
                        {post.comments.map((comment: PostComment) => (
                          <div key={comment.id} className="bg-white p-3 rounded-2xl border border-slate-150/60 shadow-xxs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-extrabold text-xs text-slate-800">{comment.authorName}</span>
                              <span className="text-[9px] font-bold text-slate-400">
                                {new Date(comment.createdAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-700 font-medium mt-1 leading-relaxed">{comment.content}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Write new comment form */}
                    <div className="space-y-2 pt-2 border-t border-slate-150">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Seu nome"
                          value={commentNames[post.id] || ""}
                          onChange={(e) => setCommentNames(prev => ({ ...prev, [post.id]: e.target.value }))}
                          className="px-3 py-1.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-all font-medium bg-white"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Escreva um comentário..."
                            value={commentTexts[post.id] || ""}
                            onChange={(e) => setCommentTexts(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === "Enter" && handleAddComment(post.id)}
                            className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-xl outline-none focus:border-indigo-500 transition-all font-medium bg-white"
                          />
                          <button
                            onClick={() => handleAddComment(post.id)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 rounded-xl transition-all"
                            title="Comentar"
                          >
                            <Send size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )})}
          </div>
        )}
      </div>

      {/* Custom Confirmation Modal for Deletion to avoid iframe sandbox confirm limitations */}
      {postToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-150 shadow-xl space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center text-xl">
              ⚠️
            </div>
            <div>
              <h4 className="font-extrabold text-slate-900 text-lg">Confirmar Exclusão</h4>
              <p className="text-sm text-slate-500 font-medium mt-1">
                Deseja realmente apagar esta publicação da comunidade? Esta ação é irreversível e removerá todos os comentários e reações associados.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPostToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-all"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (postToDelete) {
                    executeDeletePost(postToDelete);
                    setPostToDelete(null);
                  }
                }}
                className="px-4 py-2 text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all shadow-xs"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
