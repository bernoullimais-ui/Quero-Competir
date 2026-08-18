import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Settings, Timer, AlertCircle, Users, Plus, Trash2, Eye, Download, FileText, X, Copy, Share2 } from "lucide-react";
import { useToast } from "./ui/Toast.tsx";
import { useConfirm } from "./ui/ConfirmDialog.tsx";
import AthleteEnrollmentModal from "./AthleteEnrollmentModal.tsx";

interface SubscriptionsTabProps {
  tournamentId: string;
  registrations: any[];
  refreshSummary: () => void;
  categories: any[];
  institutions: any[];
  refreshAthleteSubs?: () => void;
}

export default function SubscriptionsTab({
  tournamentId,
  registrations,
  refreshSummary,
  categories,
  institutions,
  refreshAthleteSubs
}: SubscriptionsTabProps) {
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const { confirm } = useConfirm();

  const [loadingSubs, setLoadingSubs] = useState(false);
  const [subSettings, setSubSettings] = useState({
    deadline: "",
    feeType: "free" as "free" | "by_team" | "by_team_and_athlete_institution" | "by_team_and_athlete_parent",
    teamFee: 0,
    athleteFee: 0,
    status: "open" as "open" | "closed",
    requireMembership: false
  });
  const [athleteSubs, setAthleteSubs] = useState<any[]>([]);
  const [subSettingsStatus, setSubSettingsStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  
  const [subViewMode, setSubViewMode] = useState<"institutions" | "athletes">("institutions");
  const [subFilter, setSubFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [subSearch, setSubSearch] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [selectedInstitutionFilter, setSelectedInstitutionFilter] = useState("all");
  const [selectedGenderFilter, setSelectedGenderFilter] = useState("all");
  const [selectedAgeGroupFilter, setSelectedAgeGroupFilter] = useState("all");
  
  const [showRejectModal, setShowRejectModal] = useState<string[] | null>(null);
  const [validationFeedback, setValidationFeedback] = useState("");
  const [viewingDocument, setViewingDocument] = useState<{ url: string; athleteName: string } | null>(null);
  
  const [showRegModal, setShowRegModal] = useState(false);
  const [selectedInstId, setSelectedInstId] = useState("");
  const [modalError, setModalError] = useState<string | null>(null);
  
  const [showAthleteModal, setShowAthleteModal] = useState(false);
  const [selectedReg, setSelectedReg] = useState<any>(null);

  const fetchSubscriptionDbs = async () => {
    if (!tournamentId) return;
    setLoadingSubs(true);
    try {
      const [resSettings, resSubs] = await Promise.all([
        fetch(`/api/tournaments/${tournamentId}/subscription-settings`).then(r => r.json()),
        fetch(`/api/tournaments/${tournamentId}/athlete-subscriptions`).then(r => r.json())
      ]);
      if (resSettings && !resSettings.error) {
        setSubSettings(resSettings);
      }
      if (resSubs && !resSubs.error) {
        setAthleteSubs(resSubs);
      }
    } catch (err) {
      console.error("Erro ao carregar dados de inscrições", err);
    } finally {
      setLoadingSubs(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionDbs();
  }, [tournamentId]);

  const handleSaveSubSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubSettingsStatus(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/subscription-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subSettings)
      });
      if (res.ok) {
        setSubSettingsStatus({ type: "success", text: "Configurações de inscrições e taxas salvas com sucesso!" });
        toastSuccess("Configurações das inscrições e taxas salvas com sucesso!");
        fetchSubscriptionDbs();
        setTimeout(() => setSubSettingsStatus(null), 4000);
      } else {
        setSubSettingsStatus({ type: "error", text: "Erro ao salvar configurações de inscrições." });
        toastError("Erro ao salvar configurações de inscrições");
        setTimeout(() => setSubSettingsStatus(null), 4000);
      }
    } catch (err: any) {
      console.error(err);
      setSubSettingsStatus({ type: "error", text: "Erro ao conectar com o servidor: " + err.message });
      toastError("Erro ao conectar com o servidor.");
      setTimeout(() => setSubSettingsStatus(null), 4000);
    }
  };

  const handleValidateAthlete = async (subIds: string[], status: "approved" | "rejected") => {
    if (status === "rejected" && !validationFeedback) {
      setShowRejectModal(subIds);
      return;
    }
    try {
      const results = await Promise.all(subIds.map(subId => fetch(`/api/tournaments/${tournamentId}/athlete-subscriptions/${subId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          validationStatus: status,
          validationFeedback: status === "rejected" ? validationFeedback : null
        })
      })));
      
      if (results.every(r => r.ok)) {
        setShowRejectModal(null);
        setValidationFeedback("");
        fetchSubscriptionDbs();
        if (refreshAthleteSubs) {
          refreshAthleteSubs();
        }
        toastSuccess(status === "approved" ? "Inscrição aprovada com sucesso!" : "Inscrição rejeitada com sucesso!");
      } else {
        toastError("Erro ao validar algumas inscrições.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRegistration = async (regId: string) => {
    const isConfirmed = await confirm({
      title: "Remover Instituição",
      message: "Tem certeza que deseja remover esta instituição do torneio?",
      variant: "danger",
      confirmText: "Remover",
      cancelText: "Cancelar"
    });
    if (!isConfirmed) return;
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/registrations/${regId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        refreshSummary();
        toastSuccess("Instituição removida com sucesso.");
      } else {
        toastError("Erro ao excluir inscrição.");
      }
    } catch (err) {
      toastError("Erro ao conectar com o servidor.");
    }
  };

  const handleOpenAthleteModal = (reg: any) => {
    setSelectedReg(reg);
    setModalError(null);
    setShowAthleteModal(true);
  };

  const handleRegisterInstitution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstId) return;
    setModalError(null);

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institution_id: selectedInstId })
      });
      
      if (res.ok) {
        refreshSummary();
        setShowRegModal(false);
        toastSuccess("Instituição inscrita com sucesso!");
      } else {
        const err = await res.json();
        setModalError(err.error || "Erro desconhecido.");
      }
    } catch (err) {
      setModalError("Erro ao conectar com o servidor.");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">

      {/* SELETOR DE SUB-TABELAS */}
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setSubViewMode("institutions")}
          className={`pb-3 text-sm font-bold transition-all relative cursor-pointer ${
            subViewMode === "institutions" ? "text-indigo-600 font-extrabold border-b-2 border-indigo-600" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Instituições Confirmadas ({registrations.length})
        </button>
        <button
          onClick={() => setSubViewMode("athletes")}
          className={`pb-3 text-sm font-bold transition-all relative cursor-pointer ${
            subViewMode === "athletes" ? "text-indigo-600 font-extrabold border-b-2 border-indigo-600" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Fichas de Validação de Atletas ({athleteSubs.length})
        </button>
      </div>

      {/* CONTEÚDO 2: VALIDAÇÃO DE ATLETAS (24H APÓS PRAZO) */}
      {subViewMode === "athletes" && (
        <div className="space-y-6">
          
          {/* CALCULAR E EXIBIR PRAZO DE VALIDAÇÃO (24H PÓS DEADLINE) */}
          {(() => {
            if (!subSettings.deadline) {
              return (
                <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-amber-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle size={16} /> Defina o "Prazo Limite de Inscrição" acima para ativar e exibir o cronômetro oficial de validação das inscrições pela organização (até 24h pós prazo).
                </div>
              );
            }

            const deadlineTime = new Date(subSettings.deadline).getTime() + (24 * 60 * 60 * 1000); // 24 horas adicionais
            const nowTime = new Date().getTime();
            const diff = deadlineTime - nowTime;
            const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
            const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

            return (
              <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                diff < 0 ? "bg-red-50 border-red-100 text-red-800" : "bg-emerald-50 border-emerald-100 text-emerald-800"
              }`}>
                <div>
                  <h4 className="text-sm font-bold flex items-center gap-1.5 uppercase tracking-wide">
                    <Timer size={16} /> Cronômetro de Validação Regulamentar
                  </h4>
                  <p className="text-xs font-medium mt-1">
                    A organização deve auditar e validar ou rejeitar as pendências em até 24h após o encerramento do prazo regulamentar.
                  </p>
                </div>
                <div className="text-[20px] font-black tracking-tight self-end sm:self-center font-mono">
                  {diff < 0 ? (
                    <span className="text-red-600">PRAZO EXPIRADO</span>
                  ) : (
                    <span>FALTAM {hoursLeft}h {minutesLeft}min</span>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Lista de Fichas individuais e Filtros */}
          {(() => {
            let filtered = athleteSubs;
            if (subFilter !== "all") {
              filtered = filtered.filter(s => s.validationStatus === subFilter);
            }
            if (subSearch) {
              filtered = filtered.filter(s => (s.athleteName || "").toLowerCase().includes(subSearch.toLowerCase()));
            }
            if (selectedCategoryFilter !== "all") {
              filtered = filtered.filter(s => s.categoryId === selectedCategoryFilter);
            }
            if (selectedInstitutionFilter !== "all") {
              filtered = filtered.filter(s => s.institutionId === selectedInstitutionFilter);
            }
            if (selectedGenderFilter !== "all") {
              filtered = filtered.filter(s => {
                const cat = categories.find(c => c.id === s.categoryId);
                if (!cat) return false;
                return (cat.gender || "").toLowerCase() === selectedGenderFilter.toLowerCase();
              });
            }
            if (selectedAgeGroupFilter !== "all") {
              filtered = filtered.filter(s => {
                const cat = categories.find(c => c.id === s.categoryId);
                const ageGroupStr = s.additionalData?.age_group || cat?.age_group || "";
                return ageGroupStr === selectedAgeGroupFilter;
              });
            }

            const exportToCSV = () => {
              if (filtered.length === 0) {
                toastWarning("Nenhum participante localizado para exportação.");
                return;
              }

              const headers = ["Nome do Atleta", "CPF", "Instituição", "Prova / Categoria", "Classe de Idade", "Gênero", "Status Validação", "Status Pagamento", "Responsável", "Telefone Resp.", "Check-in Presencial"];
              const rows = filtered.map(sub => {
                const inst = institutions.find(i => i.id === sub.institutionId);
                const cat = categories.find(c => c.id === sub.categoryId);
                const ageGroupStr = sub.additionalData?.age_group || cat?.age_group || (cat?.rules_config?.ages?.join(", ")) || "Livre";
                const checkInStr = sub.checkedInAt ? `Realizado às ${new Date(sub.checkedInAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', timeZone: 'America/Sao_Paulo'})}` : "Pendente";
                
                return [
                  `"${sub.athleteName || ''}"`,
                  `"${sub.document || ''}"`,
                  `"${inst?.name || 'Independente'}"`,
                  `"${cat?.name || 'Mista'}"`,
                  `"${ageGroupStr}"`,
                  `"${cat?.gender || 'Geral'}"`,
                  `"${sub.validationStatus === 'approved' ? 'Aprovado' : sub.validationStatus === 'rejected' ? 'Recusado' : 'Pendente'}"`,
                  `"${sub.paymentStatus === 'paid' ? 'Pago' : 'Pendente'}"`,
                  `"${sub.parentName || ''}"`,
                  `"${sub.parentPhone || ''}"`,
                  `"${checkInStr}"`
                ];
              });

              const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
              const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.setAttribute("href", url);
              link.setAttribute("download", `inscricoes_atletas_${tournamentId}_${new Date().toISOString().slice(0, 10)}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              toastSuccess(`Lista com ${filtered.length} participante(s) exportada com sucesso (CSV)!`);
            };

            const groupedFiltered = Object.values(filtered.reduce((acc, sub) => {
              const key = `${sub.athleteName}_${sub.document || sub.parentPhone}`;
              if (!acc[key]) {
                acc[key] = { ...sub, subIds: [sub.id], categoryIds: [sub.categoryId] };
              } else {
                acc[key].subIds.push(sub.id);
                if (!acc[key].categoryIds.includes(sub.categoryId)) {
                  acc[key].categoryIds.push(sub.categoryId);
                }
              }
              return acc;
            }, {} as Record<string, any>));

            return (
              <>
                {/* Painel Completo de Filtros e Busca */}
                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200/80 mb-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Filtros por Status */}
                    <div className="flex flex-wrap gap-1.5 p-1 bg-slate-200/60 rounded-xl">
                      {(["all", "pending", "approved", "rejected"] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setSubFilter(f)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            subFilter === f ? "bg-white shadow-sm text-indigo-700 font-extrabold" : "text-slate-600 hover:text-slate-900"
                          }`}
                        >
                          {f === "all" && "Todos os Status"}
                          {f === "pending" && "Pendentes"}
                          {f === "approved" && "Aprovados"}
                          {f === "rejected" && "Recusados"}
                        </button>
                      ))}
                    </div>

                    {/* Botão Exportar Relatório / CSV */}
                    <button
                      type="button"
                      onClick={exportToCSV}
                      className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-emerald-700 transition flex items-center justify-center gap-2 shadow-sm shadow-emerald-200 cursor-pointer"
                    >
                      <Download size={15} /> Exportar Lista ({filtered.length} Atletas)
                    </button>
                  </div>

                  {/* Linha de Filtros Avançados */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-3 border-t border-slate-200/60">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Buscar por Nome</label>
                      <input 
                        type="text"
                        placeholder="Nome do atleta..."
                        value={subSearch}
                        onChange={e => setSubSearch(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-xs font-semibold bg-white focus:border-indigo-500 shadow-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Prova / Categoria</label>
                      <select
                        value={selectedCategoryFilter}
                        onChange={e => setSelectedCategoryFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-xs font-semibold bg-white text-slate-700 focus:border-indigo-500 shadow-sm cursor-pointer"
                      >
                        <option value="all">Todas as Provas</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.age_group ? `(${c.age_group})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Classe de Idade</label>
                      <select
                        value={selectedAgeGroupFilter}
                        onChange={e => setSelectedAgeGroupFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-xs font-semibold bg-white text-slate-700 focus:border-indigo-500 shadow-sm cursor-pointer"
                      >
                        <option value="all">Todas as Classes</option>
                        {Array.from(new Set([
                          ...categories.map(c => c.age_group).filter(Boolean),
                          ...athleteSubs.map(s => s.additionalData?.age_group).filter(Boolean)
                        ])).map(ag => (
                          <option key={ag} value={ag}>{ag}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Clube / Instituição</label>
                      <select
                        value={selectedInstitutionFilter}
                        onChange={e => setSelectedInstitutionFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-xs font-semibold bg-white text-slate-700 focus:border-indigo-500 shadow-sm cursor-pointer"
                      >
                        <option value="all">Todas as Instituições</option>
                        {institutions.map(i => (
                          <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Gênero</label>
                      <select
                        value={selectedGenderFilter}
                        onChange={e => setSelectedGenderFilter(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-xs font-semibold bg-white text-slate-700 focus:border-indigo-500 shadow-sm cursor-pointer"
                      >
                        <option value="all">Todos os Gêneros</option>
                        <option value="Feminino">Feminino</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Misto">Misto</option>
                      </select>
                    </div>
                  </div>
                </div>

                {filtered.length === 0 ? (
                  <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
                    <Users size={32} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-500">Nenhum atleta localizado para os filtros declarados.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {groupedFiltered.map((group) => {
                  const inst = institutions.find(i => i.id === group.institutionId);
                  const subCats = categories.filter(c => group.categoryIds.includes(c.id));
                  const catNames = subCats.map(c => c.name).join(" + ");
                  const ageGroups = [...new Set(subCats.map(c => c.age_group || group.additionalData?.age_group).filter(Boolean))].join(", ");

                  return (
                    <div key={group.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                      
                      {/* Header do Card Atleta */}
                      <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-800 text-md">{group.athleteName}</h4>
                            {group.additionalData?.registration_source === "self" && (
                              <span className="px-2 py-0.5 rounded-md text-[9px] uppercase font-black bg-cyan-50 border border-cyan-200 text-cyan-700">Auto-Inscrição</span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 font-bold uppercase mt-0.5">
                            {inst?.name || "Independente"} • Cat: {catNames || "Mista"}
                          </p>
                          {ageGroups && (
                            <span className="inline-block mt-1 px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-150 text-[10px] font-extrabold rounded-md uppercase">
                              Classe de Idade: {ageGroups}
                            </span>
                          )}
                        </div>
                        <span className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-black border ${
                          group.validationStatus === "approved" ? "bg-emerald-50 border-emerald-250 text-emerald-600" :
                          group.validationStatus === "rejected" ? "bg-red-50 border-red-200 text-red-600" :
                          "bg-amber-50 border-amber-250 text-amber-600"
                        }`}>
                          {group.validationStatus === "approved" && "Aprovado"}
                          {group.validationStatus === "rejected" && "Recusado"}
                          {group.validationStatus === "pending" && "Aguardando"}
                        </span>
                      </div>

                      {/* Informações médicas e preenchimento */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs font-medium text-slate-600">
                        <div>
                          <span className="block text-[10px] uppercase font-bold text-slate-400">Tipo Sanguíneo</span>
                          <span>{group.additionalData?.bloodType || "Não preenchido"}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase font-bold text-slate-400">Responsável</span>
                          <span className="truncate block max-w-[150px]">{group.parentName || "Não preenchido"}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase font-bold text-slate-400">Alergias</span>
                          <span className="truncate block max-w-[150px]">{group.additionalData?.allergies || "Nenhuma registrada"}</span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase font-bold text-slate-400">Contato Resp.</span>
                          <span>{group.parentPhone || "Não Informado"}</span>
                        </div>
                      </div>

                      {group.additionalData && (
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-xs font-semibold text-indigo-650 bg-indigo-50/20 p-2.5 rounded-xl border border-indigo-150">
                          <div>
                            <span className="block text-[9px] uppercase font-bold text-slate-400 leading-none mb-1">Classe</span>
                            <span>{group.additionalData.age_group || "N/A"}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] uppercase font-bold text-slate-400 leading-none mb-1">Graduação</span>
                            <span>{group.additionalData.graduation || "N/A"}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] uppercase font-bold text-slate-400 leading-none mb-1">Peso</span>
                            <span>{group.additionalData.weight_class || "N/A"}</span>
                          </div>
                        </div>
                      )}

                      {/* Detalhes de conformidade */}
                      <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 border border-slate-100">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                          <span className={`w-2 h-2 rounded-full ${group.authorizedImageUse ? "bg-emerald-500" : "bg-slate-300"}`} />
                          Autorização de Imagem: {group.authorizedImageUse ? "Sim" : "Pendente"}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                          <span className={`w-2 h-2 rounded-full ${group.liabilityWaiver ? "bg-emerald-500" : "bg-slate-300"}`} />
                          Termo de Aptidão Física: {group.liabilityWaiver ? "Sim" : "Pendente"}
                        </div>
                        {subSettings.feeType === "by_team_and_athlete_parent" && (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                            <span className={`w-2 h-2 rounded-full ${group.paymentStatus === "paid" ? "bg-emerald-500" : "bg-red-400"}`} />
                            Taxa Individual Responsável: {group.paymentStatus === "paid" ? "Pago" : "Pendente"}
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">
                          <span className={`w-2 h-2 rounded-full ${group.checkedInAt ? "bg-indigo-500" : "bg-slate-300"}`} />
                          Check-in Presencial: {group.checkedInAt ? `Realizado às ${new Date(group.checkedInAt).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', timeZone: 'America/Sao_Paulo'})}` : "Pendente"}
                        </div>
                      </div>

                      {/* Link de Pagamento para Responsável */}
                      {group.paymentStatus !== "paid" && (
                        <div className="bg-amber-50/70 border border-amber-200/70 p-3 rounded-2xl flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <span className="text-[10px] font-black uppercase text-amber-800 tracking-wider block">💳 Pagamento Pendente</span>
                            <span className="text-[11px] font-semibold text-slate-600">Envie o link de pagamento para o responsável</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                const ticketUrl = `${window.location.origin}/public/ticket/${group.id}`;
                                window.open(ticketUrl, "_blank");
                              }}
                              className="px-2.5 py-1.5 bg-purple-500 text-white rounded-xl text-xs font-bold hover:bg-purple-600 transition shadow-xs flex items-center gap-1 cursor-pointer"
                              title="Ver Credencial Digital do Atleta"
                            >
                              🎟️ Credencial
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const payUrl = `${window.location.origin}/public/register-athlete/${group.id}`;
                                navigator.clipboard.writeText(payUrl);
                                toastSuccess(`Link de pagamento copiado para ${group.athleteName}!`);
                              }}
                              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-xs flex items-center gap-1 cursor-pointer"
                            >
                              <Copy size={12} /> Copiar Link
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const payUrl = `${window.location.origin}/public/register-athlete/${group.id}`;
                                const msg = `Olá! Segue o link para pagamento da inscrição de *${group.athleteName}*:\n\n${payUrl}`;
                                const phone = (group.parentPhone || group.additionalData?.phone || "").replace(/\D/g, "");
                                const waUrl = phone ? `https://api.whatsapp.com/send?phone=55${phone}&text=${encodeURIComponent(msg)}` : `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
                                window.open(waUrl, "_blank");
                              }}
                              className="px-2.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition shadow-xs flex items-center gap-1 cursor-pointer"
                            >
                              <Share2 size={12} /> WhatsApp
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Preview de Foto e Documento */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                        {group.photoUrl && (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Foto do Aluno</span>
                            <button
                              type="button"
                              onClick={() => {
                                setViewingDocument({ url: group.photoUrl, athleteName: `Foto do Aluno - ${group.athleteName}` });
                              }}
                              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold border border-slate-200 rounded-lg hover:bg-slate-50 duration-150 text-indigo-600 hover:text-indigo-700 bg-white cursor-pointer"
                            >
                              <Eye size={12} /> Ver Foto (3x4)
                            </button>
                          </div>
                        )}
                        {group.documentUrl ? (
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Documento de Identidade</span>
                            <button
                              type="button"
                              onClick={() => {
                                setViewingDocument({ url: group.documentUrl, athleteName: group.athleteName });
                              }}
                              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-bold border border-slate-200 rounded-lg hover:bg-slate-50 duration-150 text-indigo-600 hover:text-indigo-700 bg-white cursor-pointer"
                            >
                              <Eye size={12} /> Ver Documento
                            </button>
                          </div>
                        ) : null}
                      </div>

                      {/* Ações de Auditoria */}
                      {group.validationStatus === "pending" && (
                        <div className="pt-3 border-t border-slate-50 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleValidateAthlete(group.subIds, "approved")}
                            className="flex-1 min-h-[36px] bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition cursor-pointer"
                          >
                            Validar / Aprovar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setValidationFeedback("");
                              setShowRejectModal(group.subIds);
                            }}
                            className="px-4 min-h-[36px] bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition cursor-pointer"
                          >
                            Recusar
                          </button>
                        </div>
                      )}

                      {group.validationStatus === "rejected" && group.validationFeedback && (
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-xs">
                          <strong className="block mb-1">Motivo da Recusa:</strong>
                          {group.validationFeedback}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        );
      })()}
        </div>
      )}

      {/* CONTEÚDO 1: INSTITUIÇÕES INSCRITAS */}
      {subViewMode === "institutions" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-md font-bold text-slate-700">Inscrições das Instituições</h3>
              <p className="text-slate-500 text-xs">Acompanhe as instituições autorizadas a competir no evento.</p>
            </div>
            <button 
              onClick={() => {
                setModalError(null);
                setShowRegModal(true);
              }}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-700 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Plus size={16} />
              Inscrever Instituição
            </button>
          </div>
          {registrations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {registrations.map((reg, i) => (
                <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500">
                      <Users size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800">{reg.institution?.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Inscrita em {new Date(reg.created_at).toLocaleDateString()}</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteRegistration(reg.id)}
                      className="ml-auto p-2 text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                      title="Remover Instituição"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-slate-50 p-2 rounded-lg text-center">
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Modalidades</p>
                      <p className="text-sm font-bold text-indigo-600">{reg.modalityCount || 0}</p>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-lg text-center">
                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-tighter">Atletas</p>
                      <p className="text-sm font-bold text-indigo-600">{reg.athleteCount || 0}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-50">
                    <button 
                      onClick={() => handleOpenAthleteModal(reg)}
                      className="w-full py-2 bg-indigo-55 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors cursor-pointer"
                    >
                      Gerenciar Atletas
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-12 rounded-3xl border border-slate-100 text-center">
              <Users size={48} className="mx-auto text-slate-200 mb-4" />
              <h3 className="text-lg font-bold text-slate-700">Nenhuma instituição inscrita</h3>
              <p className="text-slate-500 text-sm mb-6 max-w-xs mx-auto">
                Para começar a cadastrar times e atletas, primeiro inscreva uma instituição no torneio.
              </p>
              <button 
                onClick={() => setShowRegModal(true)}
                className="text-indigo-600 font-bold hover:underline cursor-pointer"
              >
                Inscrever primeira agora
              </button>
            </div>
          )}

          {/* Modal de Inscrição de Instituição */}
          {showRegModal && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md"
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold">Inscrever Instituição</h3>
                  <button onClick={() => setShowRegModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleRegisterInstitution} className="space-y-4">
                  {modalError && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm font-medium border border-red-100 mb-4">
                      {modalError}
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold mb-2">Selecionar Instituição</label>
                    <select 
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none"
                      value={selectedInstId}
                      onChange={e => setSelectedInstId(e.target.value)}
                      required
                    >
                      <option value="">Selecione...</option>
                      {institutions.map(inst => (
                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-400 mt-2">
                      Apenas instituições cadastradas no módulo de "Instituições" aparecem aqui.
                    </p>
                  </div>
                  <div className="flex gap-4 pt-4">
                    <button 
                      type="button" 
                      onClick={() => setShowRegModal(false)}
                      className="flex-1 px-6 py-3 rounded-xl font-bold border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors cursor-pointer"
                    >
                      Confirmar Inscrição
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}

          {/* Modal de Gestão de Atletas */}
          <AthleteEnrollmentModal 
            isOpen={showAthleteModal}
            onClose={() => {
              setShowAthleteModal(false);
              refreshSummary();
              fetchSubscriptionDbs();
              if (refreshAthleteSubs) {
                refreshAthleteSubs();
              }
            }}
            tournamentId={tournamentId}
            institutionId={selectedReg?.institution_id}
            institutionName={selectedReg?.institution?.name}
            categories={categories}
          />
        </div>
      )}

      {/* Modal de confirmação/feedback de recusa */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">Recusar Inscrição</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">Especifique o motivo da recusa documental para que o atleta possa corrigir.</p>
            
            <textarea
              required
              rows={3}
              placeholder="Ex: Foto do RG está muito escura e ilegível."
              value={validationFeedback}
              onChange={e => setValidationFeedback(e.target.value)}
              className="w-full border border-slate-200 outline-none p-3 text-xs font-semibold rounded-xl focus:border-red-500 resize-none mb-4"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (showRejectModal) {
                    handleValidateAthlete(showRejectModal, "rejected");
                  }
                }}
                className="flex-1 min-h-[38px] bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition cursor-pointer"
              >
                Confirmar Recusa
              </button>
              <button
                type="button"
                onClick={() => setShowRejectModal(null)}
                className="px-4 min-h-[38px] border border-slate-200 text-slate-500 rounded-xl text-xs font-bold hover:bg-slate-50 transition cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO DE DOCUMENTO DIGITALIZADO */}
      <AnimatePresence>
        {viewingDocument && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            {/* Backdrop com efeito de desfoque */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingDocument(null)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
              id="doc-viewer-backdrop"
            />

            {/* Content Container */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden"
              id="doc-viewer-card"
            >
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                    <FileText size={20} />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Documento Digitalizado</span>
                    <h3 className="text-base font-bold text-slate-800 leading-tight">
                      {viewingDocument.athleteName}
                    </h3>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <a
                    href={viewingDocument.url}
                    download={`documento_${viewingDocument.athleteName.toLowerCase().replace(/\s+/g, "_")}`}
                    className="flex items-center gap-2 py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition duration-150"
                  >
                    <Download size={14} /> Baixar Arquivo
                  </a>
                  
                  <button
                    onClick={() => setViewingDocument(null)}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition duration-150 cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Main Preview Container */}
              <div className="p-6 overflow-auto bg-slate-100/50 flex flex-col items-center justify-center flex-1 min-h-[400px]">
                {viewingDocument.url.startsWith("data:application/pdf") ? (
                  <div className="w-full h-full flex flex-col items-center justify-center space-y-4">
                    <iframe
                      src={viewingDocument.url}
                      className="w-full h-[65vh] border border-slate-200 rounded-2xl shadow-inner bg-white"
                      title="Preview do Documento PDF"
                    />
                    <p className="text-xs text-slate-500 font-medium">
                      Nota: Se o documento PDF não carregar automaticamente no seu navegador, clique no botão <strong>Baixar Arquivo</strong> acima.
                    </p>
                  </div>
                ) : (
                  <div className="relative max-w-full max-h-[65vh] flex items-center justify-center">
                    <img
                      src={viewingDocument.url}
                      alt={`Documento de ${viewingDocument.athleteName}`}
                      className="max-w-full max-h-[65vh] rounded-2xl shadow-lg border border-white object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button
                  onClick={() => setViewingDocument(null)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition duration-150 cursor-pointer text-sm"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
