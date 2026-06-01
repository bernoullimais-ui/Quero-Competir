import React, { useState, useEffect } from "react";
import { Activity, ShieldCheck, CreditCard, Clock, FileText, Download, QrCode, UploadCloud, Users, ArrowRight, CheckCircle2, AlertCircle, Plus, Search, ExternalLink, ShieldAlert, Image, Calendar, Heart, X, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";

interface GuardianDashboardProps {
  onLogout: () => void;
  currentUser: any;
}

const formatBirthDate = (dateString?: string) => {
  if (!dateString) return "";
  const cleanDate = dateString.split("T")[0];
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanDate)) return cleanDate;
  const parts = cleanDate.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }
  return dateString;
};

export default function GuardianDashboard({ onLogout, currentUser }: GuardianDashboardProps) {
  const [athleteSubs, setAthleteSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Link/Vincular pre-inscription state
  const [searchDoc, setSearchDoc] = useState("");
  const [searchName, setSearchName] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkSuccess, setLinkSuccess] = useState<string | null>(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linking, setLinking] = useState(false);

  // Visitors & Matches states
  const [matches, setMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [showVisitorModal, setShowVisitorModal] = useState(false);
  const [visitorName, setVisitorName] = useState("");
  const [visitorDoc, setVisitorDoc] = useState("");
  const [editingVisitorsList, setEditingVisitorsList] = useState<{ name: string; document: string; isInherited?: boolean }[]>([]);
  const [savingVisitors, setSavingVisitors] = useState(false);
  const [visitorError, setVisitorError] = useState<string | null>(null);

  const fetchMyAthletes = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = currentUser.token;
      const res = await fetch(`/api/auth/guardian/${encodeURIComponent(currentUser.email)}/athletes?t=${Date.now()}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      const rawData = await res.json();
      
      if (Array.isArray(rawData)) {
        // Map raw data from snake_case (Supabase) to camelCase (Frontend representation)
        const data = rawData.map((d: any) => ({
          id: d.id,
          tournamentId: d.tournamentId || d.tournament_id,
          institutionId: d.institutionId || d.institution_id,
          categoryId: d.categoryId || d.category_id,
          athleteName: d.athleteName || d.athlete_name,
          birthDate: d.birthDate || d.birth_date,
          document: d.document,
          gender: d.gender,
          isCompleted: d.isCompleted !== undefined ? d.isCompleted : d.is_completed,
          validationStatus: d.validationStatus || d.validation_status,
          validationFeedback: d.validationFeedback || d.validation_feedback,
          validatedAt: d.validatedAt || d.validated_at,
          parentName: d.parentName || d.parent_name,
          parentPhone: d.parentPhone || d.parent_phone,
          additionalData: d.additionalData || d.additional_data || {},
          documentUrl: d.documentUrl || d.document_url,
          photoUrl: d.photoUrl || d.photo_url,
          authorizedImageUse: d.authorizedImageUse !== undefined ? d.authorizedImageUse : d.authorized_image_use,
          liabilityWaiver: d.liabilityWaiver !== undefined ? d.liabilityWaiver : d.liability_waiver,
          paymentStatus: d.paymentStatus || d.payment_status,
          createdAt: d.createdAt || d.created_at,
          createdBy: d.createdBy || d.created_by,
          institutionName: d.institutionName || d.institutions?.name || "Clube / Escola",
          tournamentName: d.tournamentName || d.tournaments?.name || "Torneio",
          organizerName: d.organizerName || d.organizer_name || "Organizador"
        }));

        // Filter based on matching parent email, phone, or name (case-insensitive) or items linked dynamically
        const matched = data.filter((s: any) => {
          const uEmail = currentUser.email.toLowerCase();
          const uName = currentUser.name.toLowerCase();
          return (
            (s.parentName && s.parentName.toLowerCase().includes(uName)) ||
            (s.additionalData && s.additionalData.parentEmail && s.additionalData.parentEmail.toLowerCase() === uEmail) ||
            s.document === searchDoc || // matches newly linked ones
            s.createdBy === currentUser.id
          );
        });
        setAthleteSubs(matched);
      } else {
        setAthleteSubs([]);
      }
    } catch (err: any) {
      setError("Erro ao se conectar para carregar inscrições: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyMatches = async () => {
    setLoadingMatches(true);
    try {
      const token = currentUser.token;
      const res = await fetch(`/api/tournaments/public/guardian/${encodeURIComponent(currentUser.email)}/matches-with-visitors?t=${Date.now()}`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        const sortedMatches = (data || []).sort((a: any, b: any) => {
          const hasTimeA = !!a.matchTime;
          const hasTimeB = !!b.matchTime;
          if (hasTimeA && !hasTimeB) return -1;
          if (!hasTimeA && hasTimeB) return 1;
          if (hasTimeA && hasTimeB) {
            return new Date(a.matchTime).getTime() - new Date(b.matchTime).getTime();
          }
          return 0;
        });
        setMatches(sortedMatches);
      }
    } catch (err) {
      console.error("Erro ao buscar partidas:", err);
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    fetchMyAthletes();
    fetchMyMatches();
  }, [currentUser]);

  // Handle looking up a pre-registered athlete in database to link
  const handleLinkAthlete = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError(null);
    setLinkSuccess(null);
    setLinking(true);

    if (!searchDoc.trim() && !searchName.trim()) {
      setLinkError("Por favor, preencha o Documento (CPF/RG) ou o Nome do Atleta.");
      setLinking(false);
      return;
    }

    try {
      // Scan all tournaments athlete subscriptions to find matching records
      const tournamentsRes = await fetch("/api/tournaments");
      const tournaments = await tournamentsRes.json();
      let foundRecord: any = null;

      for (const t of tournaments) {
        const subRes = await fetch(`/api/tournaments/${t.id}/athlete-subscriptions`);
        if (subRes.ok) {
          const subs = await subRes.ok ? await subRes.json() : [];
          const matched = subs.find((s: any) => {
            const matchesDoc = searchDoc ? s.document === searchDoc : false;
            const matchesName = searchName ? s.athleteName.toLowerCase().includes(searchName.toLowerCase()) : false;
            return matchesDoc || matchesName;
          });
          if (matched) {
            foundRecord = matched;
            break;
          }
        }
      }

      if (foundRecord) {
        // Post/Update the athlete subscription record to associate it with this parent
        const updateRes = await fetch(`/api/tournaments/public/athlete-subscription/${foundRecord.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentName: currentUser.name,
            parentPhone: foundRecord.parentPhone || "Verificar Cadastro",
            additionalData: {
              ...(foundRecord.additionalData || {}),
              parentEmail: currentUser.email,
              linkedBy: currentUser.id
            },
            documentUrl: foundRecord.documentUrl,
            authorizedImageUse: foundRecord.authorizedImageUse || false,
            liabilityWaiver: foundRecord.liabilityWaiver || false,
            paymentStatus: foundRecord.paymentStatus
          })
        });

        if (updateRes.ok) {
          setLinkSuccess(`Sucesso! O atleta "${foundRecord.athleteName}" foi vinculado ao seu painel.`);
          setSearchDoc("");
          setSearchName("");
          setTimeout(() => {
            setShowLinkModal(false);
            fetchMyAthletes();
          }, 1500);
        } else {
          setLinkError("Não foi possível acoplar a inscrição devido a uma falha no banco.");
        }
      } else {
        setLinkError("Nenhuma pré-inscrição ativa encontrada na liga esportiva com esses dados. Solicite o pré-cadastro para a escola/clube.");
      }
    } catch (err: any) {
      setLinkError("Erro na conexão: " + err.message);
    } finally {
      setLinking(false);
    }
  };

  const handleOpenVisitorModal = (match: any) => {
    setSelectedMatch(match);
    setEditingVisitorsList([...match.visitors]);
    setVisitorName("");
    setVisitorDoc("");
    setVisitorError(null);
    setShowVisitorModal(true);
  };

  const handleAddVisitor = (e: React.FormEvent) => {
    e.preventDefault();
    setVisitorError(null);
    
    if (!visitorName.trim() || !visitorDoc.trim()) {
      setVisitorError("Preencha o Nome e o Documento do acompanhante.");
      return;
    }

    if (selectedMatch.maxVisitors > 0 && editingVisitorsList.length >= selectedMatch.maxVisitors) {
      setVisitorError(`O limite máximo permitido é de ${selectedMatch.maxVisitors} visitantes por atleta.`);
      return;
    }

    const isDup = editingVisitorsList.some(v => v.document.trim() === visitorDoc.trim());
    if (isDup) {
      setVisitorError("Este documento já está adicionado na lista.");
      return;
    }

    setEditingVisitorsList([
      ...editingVisitorsList,
      { name: visitorName.trim(), document: visitorDoc.trim(), isInherited: false }
    ]);
    setVisitorName("");
    setVisitorDoc("");
  };

  const handleRemoveVisitor = (index: number) => {
    setEditingVisitorsList(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveVisitors = async () => {
    setSavingVisitors(true);
    setVisitorError(null);
    
    try {
      const res = await fetch(`/api/tournaments/public/athlete-subscription/match/${selectedMatch.matchId}/athlete/${selectedMatch.athleteId}/visitors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({ visitors: editingVisitorsList })
      });
      
      const data = await res.json();
      if (res.ok) {
        setShowVisitorModal(false);
        fetchMyMatches();
      } else {
        setVisitorError(data.error || "Erro ao salvar acompanhantes.");
      }
    } catch (err: any) {
      setVisitorError("Erro ao conectar: " + err.message);
    } finally {
      setSavingVisitors(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Dynamic Header */}
      <header className="bg-white py-5 px-8 flex items-center justify-between border-b border-slate-205 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <Users size={22} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">Portal do Responsável • Quero Competir</h1>
            <p className="text-xs text-slate-500 font-semibold">Espaço para preenchimento de fichas médicas, termos e taxas de inscrições</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowLinkModal(true)}
            className="hidden sm:flex items-center gap-2 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition duration-150 shrink-0"
          >
            <Plus size={14} /> Vincular Pré-Inscrição de Aluno
          </button>
          
          <button
            onClick={onLogout}
            className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-650 py-2 px-4 rounded-xl transition duration-150 border border-slate-200"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Primary Contents Spacer */}
      <main className="flex-1 p-8 max-w-7xl w-full mx-auto space-y-8">
        
        {/* Welcome Section Banner */}
        <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden shadow-lg border border-slate-800">
          <div className="absolute top-[-20%] right-[-10%] w-60 h-60 bg-indigo-600/20 rounded-full blur-[80px]" />
          
          <div className="relative space-y-2 max-w-2xl">
            <span className="text-indigo-400 text-xs font-extrabold uppercase tracking-widest block">Bem-vindo de volta</span>
            <h2 className="text-2xl font-black">Olá, {currentUser.name}!</h2>
            <p className="text-slate-350 text-xs font-medium leading-relaxed">
              Aqui você pode gerenciar todas as inscrições dos seus filhos ou atletas dependentes. Se o seu clube/escola pré-autorizou o atleta, acesse <strong>vincular pré-inscrição</strong> para listá-la abaixo.
            </p>
          </div>
        </div>

        {/* Mobile quick actions */}
        <div className="sm:hidden block">
          <button
            onClick={() => setShowLinkModal(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg"
          >
            <Plus size={16} /> Vincular Pré-Inscrição de Aluno
          </button>
        </div>

        {/* Athlete Subscriptions Section */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-805">Atletas sob sua Responsabilidade</h3>
              <p className="text-xs text-slate-400 font-medium">Acompanhe e preencha as etapas obrigatórias para confirmação do atleta</p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-150 px-3 py-1 rounded-full border border-slate-205">
              {athleteSubs.length} vinculados
            </span>
          </div>

          {loading ? (
            <div className="py-20 text-center font-bold text-slate-400 text-sm">Carregando inscrições...</div>
          ) : athleteSubs.length === 0 ? (
            <div className="py-20 text-center space-y-4 max-w-md mx-auto">
              <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto border border-slate-100">
                <Users size={28} />
              </div>
              <div>
                <h4 className="font-bold text-slate-700">Nenhum atleta listado</h4>
                <p className="text-xs text-slate-405 mt-1 font-medium">
                  Você não possui pré-inscrições vinculadas. Peça para a escola do atleta preenchê-la, ou vincule clicando no botão acima.
                </p>
              </div>
              <button
                onClick={() => setShowLinkModal(true)}
                className="py-2 px-5 bg-indigo-50 hover:bg-indigo-100 font-bold text-indigo-700 text-xs rounded-xl border border-indigo-100 transition duration-150 inline-flex items-center gap-1.5"
              >
                <Plus size={14} /> Vincular Primeiro Registro
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {athleteSubs.map((sub) => {
                const docOk = !!sub.documentUrl;
                const termsOk = !!(sub.authorizedImageUse && sub.liabilityWaiver);
                const payOk = sub.paymentStatus === "paid";
                const isApproved = sub.validationStatus === "approved";

                return (
                  <div key={sub.id} className="p-6 hover:bg-slate-50/40 transition duration-150 flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      
                      {/* Athlete Basic Info */}
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                          isApproved ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-150"
                        }`}>
                          <Users size={22} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-slate-800 text-base">{sub.athleteName}</h4>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-550 font-medium">
                            <span className="flex items-center gap-1">🆔 CPF: {sub.document}</span>
                            {sub.birthDate && (
                              <span className="flex items-center gap-1">
                                📅 Nasc: {formatBirthDate(sub.birthDate)}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-2 gap-y-1 pt-1.5">
                            <span className="bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                              🏢 {sub.institutionName}
                            </span>
                            <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                              🏆 {sub.tournamentName}
                            </span>
                            <span className="bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                              👤 {sub.organizerName}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Progress Checklist Indicators */}
                      <div className="flex flex-wrap items-center gap-3">
                        {/* Document Scans Indicator */}
                        <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                          docOk ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-rose-50 border-rose-100 text-rose-700"
                        }`}>
                          <FileText size={14} />
                          <span>Documento: {docOk ? "OK" : "Pendente"}</span>
                        </span>

                        {/* Parent Consent Terms Indicator */}
                        <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                          termsOk ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-rose-50 border-rose-100 text-rose-700"
                        }`}>
                          <CheckCircle2 size={14} />
                          <span>Termos: {termsOk ? "Aceitos" : "Falta Aceitar"}</span>
                        </span>

                        {/* Payment Fee Indicator */}
                        <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                          payOk ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-amber-50 border-amber-100 text-amber-700"
                        }`}>
                          <CreditCard size={14} />
                          <span>Taxa: {payOk ? "Paga" : "Aguardando"}</span>
                        </span>

                        {/* Validation/Approval Indicator */}
                        <span className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                          sub.validationStatus === "approved" 
                            ? "bg-emerald-100 border-emerald-200 text-emerald-800"
                            : sub.validationStatus === "rejected"
                            ? "bg-rose-100 border-rose-200 text-rose-800"
                            : "bg-slate-100 border-slate-200 text-slate-700"
                        }`}>
                          <span>Validação: {sub.validationStatus === "approved" ? "Aprovado" : sub.validationStatus === "rejected" ? "Recusado" : "Pendente Análise"}</span>
                        </span>
                      </div>

                      {/* Deep-link Action Button */}
                      <div>
                        <Link
                          to={`/public/register-athlete/${sub.id}`}
                          className="py-2.5 px-5 bg-indigo-50 hover:bg-indigo-100 duration-150 border border-indigo-100 hover:border-indigo-200 rounded-xl text-xs font-bold text-indigo-700 flex items-center gap-1 shadow-sm shrink-0 leading-none"
                        >
                          <span>Preencher Documentos/Ficha</span>
                          <ArrowRight size={14} />
                        </Link>
                      </div>

                    </div>

                    {/* Rejection Feedback Alert */}
                    {sub.validationStatus === "rejected" && sub.validationFeedback && (
                      <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl text-rose-700 text-xs flex items-start gap-2 max-w-2xl">
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <div>
                          <span className="font-extrabold uppercase text-[10px] tracking-wider text-rose-800 block mb-1">Motivo da Recusa:</span>
                          <span className="font-medium">{sub.validationFeedback}</span>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 2: Matches & Visitors list */}
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm mt-8">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800">Partidas Agendadas & Acompanhantes</h3>
              <p className="text-xs text-slate-500 font-medium">Cadastre e gerencie os acompanhantes/visitantes autorizados na portaria para cada partida.</p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-150 px-3 py-1 rounded-full border border-slate-200">
              {matches.length} jogos
            </span>
          </div>

          {loadingMatches ? (
            <div className="py-20 text-center font-bold text-slate-400 text-sm">Carregando jogos agendados...</div>
          ) : matches.length === 0 ? (
            <div className="py-16 text-center space-y-4 max-w-md mx-auto">
              <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto border border-slate-100">
                <Calendar size={24} />
              </div>
              <div>
                <h4 className="font-bold text-slate-700">Nenhum jogo agendado</h4>
                <p className="text-xs text-slate-450 mt-1 font-medium leading-relaxed">
                  Não foram encontradas partidas agendadas para seus atletas aprovados até o momento. As sedes aceitarão visitantes quando houver jogos definidos.
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {matches.map((match) => {
                const matchDate = match.matchTime 
                  ? new Date(match.matchTime).toLocaleString("pt-BR") 
                  : "Horário a agendar";

                return (
                  <div key={`${match.matchId}-${match.athleteId}`} className="p-6 hover:bg-slate-50/40 transition duration-150 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    
                    {/* Match Info */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-[9px] font-extrabold uppercase">
                          {match.tournamentName}
                        </span>
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-205 text-slate-600 rounded-lg text-[9px] font-extrabold uppercase">
                          {match.categoryName}
                        </span>
                        {match.maxVisitors > 0 && (
                          <span className="px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-lg text-[9px] font-bold">
                            Limite: {match.maxVisitors}
                          </span>
                        )}
                      </div>
                      
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-indigo-600 font-extrabold uppercase block tracking-wider">
                          Atleta Dependente: <span className="text-slate-700 font-bold">{match.athleteName}</span>
                        </span>
                        <h4 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5 pt-0.5">
                          <span>{match.myTeamName || "Minha Equipe"}</span>
                          <span className="text-indigo-600 font-bold text-xs px-1">vs</span>
                          <span>{match.opponentTeamName || "Oponente a definir"}</span>
                        </h4>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-semibold">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} className="text-slate-400" />
                          Horário: {matchDate}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin size={13} className="text-slate-400" />
                          Sede: {match.venueName} (Quadra: {match.court})
                        </span>
                      </div>

                      {/* Display active visitors list pills */}
                      <div className="pt-2 space-y-1">
                        <span className="text-[10px] text-slate-400 font-extrabold uppercase block tracking-wider">Acompanhantes autorizados para este jogo:</span>
                        {match.visitors && match.visitors.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {match.visitors.map((v: any, vIdx: number) => (
                              <span 
                                key={vIdx} 
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1.5 ${
                                  v.isInherited 
                                    ? "bg-amber-50 border-amber-100 text-amber-700 shadow-xs" 
                                    : "bg-indigo-50 border-indigo-100 text-indigo-700 shadow-xs"
                                }`}
                              >
                                <span className="font-semibold">{v.name}</span>
                                <span className="text-[9px] opacity-60 font-mono">({v.document})</span>
                                {v.isInherited && (
                                  <span className="text-[8px] bg-amber-200 text-amber-800 px-1 rounded-sm uppercase font-black tracking-wide" title="Repetido do jogo anterior automaticamente">Repetido</span>
                                )}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-450 italic font-medium">Nenhum acompanhante cadastrado para este jogo. Clique no botão ao lado para gerenciar.</span>
                        )}
                      </div>
                    </div>

                    {/* Manage visitors Action Button */}
                    <div className="shrink-0 flex items-center gap-2">
                      <button
                        onClick={() => handleOpenVisitorModal(match)}
                        className={`py-2.5 px-5 rounded-xl text-xs font-bold transition duration-150 flex items-center gap-1.5 border leading-none cursor-pointer ${
                          match.canEdit 
                            ? "bg-indigo-600 hover:bg-indigo-700 border-indigo-600 hover:border-indigo-700 text-white shadow-md shadow-indigo-100" 
                            : "bg-slate-100 hover:bg-slate-150 border-slate-200 text-slate-600"
                        }`}
                      >
                        <Users size={14} />
                        <span>{match.canEdit ? "Gerenciar Acompanhantes" : "Ver Visitantes (Bloqueado)"}</span>
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>

      {/* Vincular Pré-Inscrição school search modal */}
      <AnimatePresence>
        {showLinkModal && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLinkModal(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4"
              id="link-modal"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Search size={18} className="text-indigo-600" />
                  <h3 className="font-bold text-slate-805">Vincular Pré-Inscrição de Aluno</h3>
                </div>
                <button
                  onClick={() => setShowLinkModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X size={18} />
                </button>
              </div>

              <p className="text-slate-500 text-xs font-medium leading-relaxed">
                Insira o Nome Completo do atleta ou o Documento (CPF/RG) cadastrado pela escola ou clube dele para acoplá-lo ao seu painel.
              </p>

              {linkSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold border border-emerald-100 flex items-start gap-1.5 font-medium leading-relaxed">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                  <span>{linkSuccess}</span>
                </div>
              )}

              {linkError && (
                <div className="p-3 bg-rose-50 text-rose-800 rounded-xl text-xs font-bold border border-rose-150 flex items-start gap-1.5 font-medium leading-relaxed">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-600" />
                  <span>{linkError}</span>
                </div>
              )}

              <form onSubmit={handleLinkAthlete} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Documento do Atleta (CPF / RG)
                  </label>
                  <input
                    type="text"
                    value={searchDoc}
                    onChange={(e) => setSearchDoc(e.target.value)}
                    placeholder="Ex: 512.443.112-99"
                    className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none transition"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Nome Completo do Atleta
                  </label>
                  <input
                    type="text"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    placeholder="Ex: Pedro Henrique da Silva"
                    className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none transition"
                  />
                </div>

                <div className="flex gap-3 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowLinkModal(false)}
                    className="py-2 px-4 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={linking}
                    className="py-2 px-5 bg-indigo-600 hover:bg-indigo-700 font-bold text-white text-xs rounded-xl shadow-md transition inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {linking ? "Buscando..." : "Localizar e Vincular"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Gerenciar Acompanhantes/Visitantes modal */}
      <AnimatePresence>
        {showVisitorModal && selectedMatch && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowVisitorModal(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              className="relative bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-4"
              id="visitor-modal"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Users size={18} className="text-indigo-600" />
                  <div>
                    <h3 className="font-bold text-slate-800">Acompanhantes do Jogo</h3>
                    <p className="text-[10px] text-slate-400 font-semibold">{selectedMatch.athleteName} vs {selectedMatch.opponentTeamName || "Oponente"}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowVisitorModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {!selectedMatch.canEdit && (
                <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-805 rounded-2xl text-xs font-semibold flex items-start gap-2.5">
                  <ShieldAlert size={16} className="shrink-0 mt-0.5 text-rose-600" />
                  <div>
                    <span className="font-bold block text-rose-900">Prazo Encerrado</span>
                    A lista de visitantes só pode ser alterada até 24 horas antes do início da partida. Modificações estão bloqueadas.
                  </div>
                </div>
              )}

              {/* Limit indicator */}
              {selectedMatch.maxVisitors > 0 && (
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-3 rounded-2xl text-xs font-bold text-slate-600">
                  <span>Limite de Acompanhantes</span>
                  <span className={`px-2 py-0.5 rounded-lg text-xs font-extrabold ${
                    editingVisitorsList.length >= selectedMatch.maxVisitors ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800"
                  }`}>
                    {editingVisitorsList.length} / {selectedMatch.maxVisitors}
                  </span>
                </div>
              )}

              {visitorError && (
                <div className="p-3 bg-rose-50 text-rose-800 rounded-xl text-xs font-bold border border-rose-150 flex items-start gap-1.5 font-medium leading-relaxed">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-650" />
                  <span>{visitorError}</span>
                </div>
              )}

              {/* Add form if editable */}
              {selectedMatch.canEdit && (
                <form onSubmit={handleAddVisitor} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1 bg-slate-50/50 p-3.5 rounded-2xl border border-slate-150">
                  <div className="sm:col-span-5 space-y-1">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      Nome do Visitante
                    </label>
                    <input
                      type="text"
                      value={visitorName}
                      onChange={(e) => setVisitorName(e.target.value)}
                      placeholder="Nome completo"
                      disabled={selectedMatch.maxVisitors > 0 && editingVisitorsList.length >= selectedMatch.maxVisitors}
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none transition"
                    />
                  </div>

                  <div className="sm:col-span-5 space-y-1">
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                      Documento (CPF / RG)
                    </label>
                    <input
                      type="text"
                      value={visitorDoc}
                      onChange={(e) => setVisitorDoc(e.target.value)}
                      placeholder="Ex: 000.000.000-00"
                      disabled={selectedMatch.maxVisitors > 0 && editingVisitorsList.length >= selectedMatch.maxVisitors}
                      className="w-full bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none transition"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={selectedMatch.maxVisitors > 0 && editingVisitorsList.length >= selectedMatch.maxVisitors}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center cursor-pointer"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </form>
              )}

              {/* Current list */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                <span className="text-[10px] text-slate-400 font-extrabold uppercase block tracking-wider">Acompanhantes Cadastrados:</span>
                {editingVisitorsList.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-450 italic font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    Nenhum visitante adicionado para esta partida.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    {editingVisitorsList.map((v, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between hover:bg-slate-50/50 transition">
                        <div>
                          <p className="text-xs font-bold text-slate-800">{v.name}</p>
                          <p className="text-[10px] text-slate-450 font-mono mt-0.5">{v.document}</p>
                        </div>
                        {selectedMatch.canEdit && (
                          <button
                            type="button"
                            onClick={() => handleRemoveVisitor(idx)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex gap-3 justify-end pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowVisitorModal(false)}
                  className="py-2.5 px-4 text-xs font-bold text-slate-600 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition cursor-pointer"
                >
                  {selectedMatch.canEdit ? "Cancelar" : "Fechar"}
                </button>
                {selectedMatch.canEdit && (
                  <button
                    type="button"
                    onClick={handleSaveVisitors}
                    disabled={savingVisitors}
                    className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 font-bold text-white text-xs rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {savingVisitors ? "Salvando..." : "Salvar Alterações"}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
