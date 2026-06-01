import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Check, Users, Trophy, ChevronRight, Search, Clock, Plus, Trash2, Calendar } from "lucide-react";
import { useToast } from "./ui/Toast.tsx";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  institutionId: string;
  institutionName: string;
  categories: any[];
}

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export default function AthleteEnrollmentModal({ isOpen, onClose, tournamentId, institutionId, institutionName, categories }: Props) {
  const { success: toastSuccess, error: toastError } = useToast();
  const [step, setStep] = useState<"category" | "athletes">("category");
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [athletes, setAthletes] = useState<any[]>([]);
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>([]);
  const [availability, setAvailability] = useState<{ day: string; start: string; end: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [requireMembership, setRequireMembership] = useState(false);
  const [organizationId, setOrganizationId] = useState("");
  const [tournamentYear, setTournamentYear] = useState(new Date().getFullYear());
  const [memberships, setMemberships] = useState<Record<string, { status: string; paymentStatus: string }>>({});
  const [loadingMemberships, setLoadingMemberships] = useState(false);

  useEffect(() => {
    if (isOpen && institutionId) {
      setLoading(true);
      
      const savedUser = localStorage.getItem("currentUser");
      const headers: Record<string, string> = {};
      if (savedUser) {
        try {
          const u = JSON.parse(savedUser);
          if (u && u.token) headers["Authorization"] = `Bearer ${u.token}`;
        } catch (e) {}
      }

      Promise.all([
        fetch(`/api/institutions/${institutionId}/athletes`, { headers }).then(res => res.json()),
        fetch(`/api/tournaments/${tournamentId}`, { headers }).then(res => res.json()),
        fetch(`/api/tournaments/${tournamentId}/subscription-settings`, { headers }).then(res => res.json())
      ])
      .then(async ([athletesData, tournamentData, settingsData]) => {
        const athletesList = Array.isArray(athletesData) ? athletesData : [];
        setAthletes(athletesList);

        if (tournamentData && !tournamentData.error) {
          setOrganizationId(tournamentData.owner_id || "");
          if (tournamentData.start_date) {
            setTournamentYear(new Date(tournamentData.start_date).getFullYear());
          }
        }

        const reqMembership = !!settingsData?.requireMembership;
        setRequireMembership(reqMembership);

        if (reqMembership && athletesList.length > 0 && tournamentData?.owner_id) {
          const year = tournamentData.start_date ? new Date(tournamentData.start_date).getFullYear() : new Date().getFullYear();
          setLoadingMemberships(true);
          try {
            const mRes = await fetch("/api/memberships/status-bulk", {
              method: "POST",
              headers: { "Content-Type": "application/json", ...headers },
              body: JSON.stringify({
                memberIds: athletesList.map((a: any) => a.id),
                organizationId: tournamentData.owner_id,
                year
              })
            });
            if (mRes.ok) {
              const mMap: Record<string, { status: string; paymentStatus: string }> = {};
              const mData = await mRes.json();
              mData.forEach((item: any) => {
                mMap[item.member_id] = {
                  status: item.status,
                  paymentStatus: item.payment_status
                };
              });
              setMemberships(mMap);
            }
          } catch (mErr) {
            console.error("Erro ao carregar filiações em lote:", mErr);
          } finally {
            setLoadingMemberships(false);
          }
        }

        if (categories && categories.length === 1) {
          const singleCat = categories[0];
          setSelectedCategory(singleCat);
          setStep("athletes");
          await loadMembers(singleCat, athletesList);
        } else {
          setStep("category");
        }
      })
      .catch(err => console.error("Erro ao carregar dados do modal:", err))
      .finally(() => setLoading(false));
    }
  }, [isOpen, institutionId, tournamentId, categories]);

  const handleApproveOffline = async (athleteId: string) => {
    const savedUser = localStorage.getItem("currentUser");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (savedUser) {
      try {
        const u = JSON.parse(savedUser);
        if (u && u.token) headers["Authorization"] = `Bearer ${u.token}`;
      } catch (e) {}
    }

    try {
      const res = await fetch("/api/memberships/offline-approve", {
        method: "POST",
        headers,
        body: JSON.stringify({
          memberId: athleteId,
          organizationId,
          year: tournamentYear
        })
      });
      if (res.ok) {
        toastSuccess("Filiação aprovada offline com sucesso!");
        setMemberships(prev => ({
          ...prev,
          [athleteId]: { status: "active", paymentStatus: "paid" }
        }));
      } else {
        const err = await res.json();
        toastError(err.error || "Erro ao aprovar filiação offline.");
      }
    } catch (err: any) {
      toastError("Erro ao conectar com o servidor.");
    }
  };

  const [combatData, setCombatData] = useState<Record<string, { age_group: string; graduation: string; weight_class: string }>>({});

  const loadMembers = async (cat: any, currentAthletes?: any[]) => {
    setLoading(true);
    const athletesToUse = currentAthletes || athletes;
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/categories/${cat.id}/institutions/${institutionId}/members`);
      const data = await res.json();
      const initialIds = Array.isArray(data?.athleteIds) ? data.athleteIds : Array.isArray(data) ? data : [];
      setSelectedAthleteIds(initialIds);
      setAvailability(Array.isArray(data?.availability) ? data.availability : []);

      if (cat.rules_config?.sport_type === "combat") {
        const resSubs = await fetch(`/api/tournaments/${tournamentId}/athlete-subscriptions/institution/${institutionId}`);
        const subs = await resSubs.json();
        if (Array.isArray(subs)) {
          const map: any = {};
          const selectedIds: string[] = [];
          subs.forEach((sub: any) => {
            if (sub.categoryId === cat.id) {
              const matchAth = athletesToUse.find(a => (a.document_number || a.document) === sub.document);
              if (matchAth) {
                selectedIds.push(matchAth.id);
                const addData = sub.additionalData || {};
                map[matchAth.id] = {
                  age_group: addData.age_group || cat.rules_config?.ages?.[0] || "",
                  graduation: addData.graduation || cat.rules_config?.graduations?.[0] || "",
                  weight_class: addData.weight_class || cat.rules_config?.weights?.[0] || ""
                };
              }
            }
          });
          setCombatData(map);
          setSelectedAthleteIds(selectedIds);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCategory = (cat: any) => {
    setSelectedCategory(cat);
    loadMembers(cat);
    setStep("athletes");
  };

  const toggleAthlete = (id: string) => {
    const isSelected = selectedAthleteIds.includes(id);
    setSelectedAthleteIds(prev => 
      isSelected ? prev.filter(a => a !== id) : [...prev, id]
    );

    if (!isSelected && !combatData[id] && selectedCategory?.rules_config?.sport_type === "combat") {
      setCombatData(prev => ({
        ...prev,
        [id]: {
          age_group: selectedCategory.rules_config.ages?.[0] || "",
          graduation: selectedCategory.rules_config.graduations?.[0] || "",
          weight_class: selectedCategory.rules_config.weights?.[0] || ""
        }
      }));
    }
  };

  const addAvailability = () => {
    setAvailability([...availability, { day: 'Segunda', start: '08:00', end: '22:00' }]);
  };

  const addUnavailableDate = () => {
    setAvailability([...availability, { type: 'unavailable', date: '' }]);
  };

  const removeAvailability = (index: number) => {
    const current = [...availability];
    current.splice(index, 1);
    setAvailability(current);
  };

  const updateAvailability = (index: number, field: string, value: string) => {
    const current = [...availability];
    current[index] = { ...current[index], [field]: value };
    setAvailability(current);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (selectedCategory.rules_config?.sport_type === "combat") {
        const athletesPayload = selectedAthleteIds.map(aid => {
          const a = athletes.find(ath => ath.id === aid);
          const cData = combatData[aid] || {};
          const age = cData.age_group || selectedCategory.rules_config?.ages?.[0] || "";
          const grad = cData.graduation || selectedCategory.rules_config?.graduations?.[0] || "";
          const wt = cData.weight_class || selectedCategory.rules_config?.weights?.[0] || "";
          
          return {
            name: a.full_name || a.name,
            birthDate: a.birth_date || a.birthDate,
            document: a.document_number || a.document,
            gender: a.gender || "Masculino",
            additionalData: {
              age_group: age,
              graduation: grad,
              weight_class: wt
            }
          };
        });

        // 1. Criar as inscrições de atletas
        const resSub = await fetch(`/api/tournaments/${tournamentId}/athlete-subscriptions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            institutionId,
            categoryId: selectedCategory.id,
            athletes: athletesPayload,
            sync: true
          })
        });

        if (!resSub.ok) {
          const err = await resSub.json();
          throw new Error(err.error || "Erro ao criar inscrições de combate");
        }

        const createdSubs = await resSub.json();

        // 2. Aprovar/validar cada inscrição criada para vincular no elenco
        for (const sub of createdSubs) {
          await fetch(`/api/tournaments/${tournamentId}/athlete-subscriptions/${sub.id}/validate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              validationStatus: "approved"
            })
          });
        }

        toastSuccess("Atletas de luta inscritos e homologados com sucesso!");
        onClose();
      } else {
        const res = await fetch(`/api/tournaments/${tournamentId}/categories/${selectedCategory.id}/institutions/${institutionId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ athleteIds: selectedAthleteIds, availability })
        });
        if (res.ok) {
          toastSuccess("Inscrição salva com sucesso!");
          onClose();
        } else {
          const err = await res.json();
          toastError(`Erro ao salvar: ${err.error || "Erro desconhecido. Verifique se as tabelas team_registrations e team_members existem e se o RLS está desativado."}`);
        }
      }
    } catch (err: any) {
      console.error(err);
      toastError(err.message || "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredAthletes = athletes.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.document_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-2xl font-bold text-slate-800">Inscrição de Atletas</h3>
            <p className="text-slate-500 font-medium">{institutionName}</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all text-slate-400 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            {step === "category" ? (
              <motion.div 
                key="cat"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 mb-6 text-slate-600">
                  <Trophy size={20} className="text-indigo-600" />
                  <span className="font-bold">Selecione a Modalidade</span>
                </div>
                
                {categories.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {categories.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => handleSelectCategory(cat)}
                        className="flex items-center justify-between p-5 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-indigo-600 font-bold">
                            {cat.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800">{cat.name}</h4>
                            <p className="text-xs text-slate-500 font-medium">{cat.gender} • {cat.age_group}{cat.birth_year_min || cat.birth_year_max ? ` • 🎂 ${cat.birth_year_min && cat.birth_year_max ? `${cat.birth_year_min}–${cat.birth_year_max}` : cat.birth_year_min ? `≥${cat.birth_year_min}` : `≤${cat.birth_year_max}`}` : ""}</p>
                          </div>
                        </div>
                        <ChevronRight size={20} className="text-slate-300 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                    Nenhuma modalidade disponível.
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="ath"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <button 
                    onClick={() => setStep("category")}
                    className="text-indigo-600 font-bold text-sm hover:underline flex items-center gap-1"
                  >
                    Voltar para modalidades
                  </button>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block">Modalidade</span>
                    <span className="font-bold text-slate-800">{selectedCategory.name} ({selectedCategory.gender})</span>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text" 
                    placeholder="Buscar atleta pelo nome..."
                    className="w-full pl-12 pr-4 py-3 bg-slate-100/50 rounded-2xl border border-transparent focus:border-indigo-500 focus:bg-white outline-none transition-all"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 px-1">Selecione os atletas ({selectedAthleteIds.length} selecionados)</p>
                  <div className="grid grid-cols-1 gap-2">
                    {filteredAthletes.map(athlete => {
                      const isSelected = selectedAthleteIds.includes(athlete.id);
                      const isAffiliated = !requireMembership || (
                        memberships[athlete.id]?.status === 'active' && 
                        memberships[athlete.id]?.paymentStatus === 'paid'
                      );

                      // Verificar compatibilidade de ano de nascimento
                      const birthYear = athlete.birth_date ? new Date(athlete.birth_date).getFullYear() : null;
                      const catMinYear = selectedCategory?.birth_year_min;
                      const catMaxYear = selectedCategory?.birth_year_max;
                      const isBirthYearCompatible = !birthYear || (
                        (!catMinYear || birthYear >= catMinYear) &&
                        (!catMaxYear || birthYear <= catMaxYear)
                      );
                      const hasBirthYearRestriction = !!(catMinYear || catMaxYear);

                      return (
                        <div
                          key={athlete.id}
                          className={`flex flex-col p-4 rounded-xl border transition-all gap-3 ${
                            isSelected 
                            ? "bg-indigo-50 border-indigo-200" 
                            : "bg-white border-slate-100 hover:border-slate-200"
                          } ${!isAffiliated ? "opacity-90 border-rose-100 bg-rose-50/20" : ""} ${!isBirthYearCompatible ? "opacity-70 border-amber-200 bg-amber-50/30" : ""}`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div 
                              className={`flex items-center gap-3 flex-1 ${isSelected || (isAffiliated && isBirthYearCompatible) ? "cursor-pointer" : "cursor-not-allowed"}`}
                              onClick={() => {
                                if (isSelected) {
                                  toggleAthlete(athlete.id);
                                  return;
                                }
                                if (!isAffiliated) {
                                  toastError(`O atleta ${athlete.name} não possui filiação ativa na liga. Aprove-o offline ou solicite a regularização.`);
                                  return;
                                }
                                if (!isBirthYearCompatible) {
                                  const rangeLabel = catMinYear && catMaxYear
                                    ? `entre ${catMinYear} e ${catMaxYear}`
                                    : catMinYear ? `a partir de ${catMinYear}` : `até ${catMaxYear}`;
                                  toastError(`O atleta ${athlete.name} (nascido em ${birthYear}) não se enquadra na faixa de nascimento desta categoria (nascidos ${rangeLabel}).`);
                                  return;
                                }
                                toggleAthlete(athlete.id);
                              }}
                            >
                              <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                                isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300"
                              } ${!isAffiliated ? "bg-slate-150 border-slate-200" : ""}`}>
                                {isSelected && isAffiliated && <Check size={14} strokeWidth={3} />}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className={`font-bold text-sm ${isSelected ? "text-indigo-900" : "text-slate-700"}`}>{athlete.name}</p>
                                  {requireMembership && (
                                    <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                                      isAffiliated ? "bg-emerald-50 text-emerald-600 border border-emerald-200" : "bg-rose-50 text-rose-600 border border-rose-200"
                                    }`}>
                                      {isAffiliated ? "🟢 Filiado" : "🔴 Não Filiado"}
                                    </span>
                                  )}
                                  {hasBirthYearRestriction && birthYear && !isBirthYearCompatible && (
                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                      ⚠️ Nasc. incomp.
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-slate-500 font-medium">
                                  {athlete.document_number || "Sem documento"}
                                  {birthYear ? ` • Nasc. ${birthYear}` : ""}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 self-end sm:self-center">
                              {isSelected && isAffiliated && (
                                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-tighter">Inscrito</span>
                              )}
                              {!isAffiliated && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const instructions = `Olá! O atleta ${athlete.name} precisa realizar a filiação anual para o torneio. Regularize acessando o portal do responsável para completar o cadastro e pagamento da taxa de anuidade.`;
                                      navigator.clipboard.writeText(instructions);
                                      toastSuccess("Mensagem de filiação copiada para a área de transferência!");
                                    }}
                                    className="px-2 py-1 border border-slate-200 hover:border-indigo-500 text-slate-500 hover:text-indigo-600 text-[10px] font-bold rounded-lg transition"
                                    title="Copiar instruções de filiação"
                                  >
                                    Copiar Instruções
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleApproveOffline(athlete.id)}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition shadow-ultra-sm"
                                    title="Aprovar anuidade offline para este atleta"
                                  >
                                    Aprovar Offline
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Se for categoria de Luta/Combate e estiver selecionado, renderizar seletores de subdivisões */}
                          {isSelected && selectedCategory?.rules_config?.sport_type === "combat" && (
                            <div className="mt-2 pt-3 border-t border-indigo-100 grid grid-cols-3 gap-2 animate-in slide-in-from-top-2 duration-200">
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Idade/Classe</label>
                                <select
                                  value={combatData[athlete.id]?.age_group || ""}
                                  onChange={e => setCombatData(prev => ({
                                    ...prev,
                                    [athlete.id]: {
                                      ...(prev[athlete.id] || {}),
                                      age_group: e.target.value
                                    }
                                  }))}
                                  className="w-full border border-slate-200 p-2 outline-none rounded-xl text-[10px] font-bold bg-white text-slate-700"
                                >
                                  {selectedCategory.rules_config.ages?.map((age: string) => (
                                    <option key={age} value={age}>{age}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Graduação</label>
                                <select
                                  value={combatData[athlete.id]?.graduation || ""}
                                  onChange={e => setCombatData(prev => ({
                                    ...prev,
                                    [athlete.id]: {
                                      ...(prev[athlete.id] || {}),
                                      graduation: e.target.value
                                    }
                                  }))}
                                  className="w-full border border-slate-200 p-2 outline-none rounded-xl text-[10px] font-bold bg-white text-slate-700"
                                >
                                  {selectedCategory.rules_config.graduations?.map((grad: string) => (
                                    <option key={grad} value={grad}>{grad}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Peso</label>
                                <select
                                  value={combatData[athlete.id]?.weight_class || ""}
                                  onChange={e => setCombatData(prev => ({
                                    ...prev,
                                    [athlete.id]: {
                                      ...(prev[athlete.id] || {}),
                                      weight_class: e.target.value
                                    }
                                  }))}
                                  className="w-full border border-slate-200 p-2 outline-none rounded-xl text-[10px] font-bold bg-white text-slate-700"
                                >
                                  {selectedCategory.rules_config.weights?.map((w: string) => (
                                    <option key={w} value={w}>{w}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1">
                        <Clock size={12} className="text-indigo-600" />
                        Disponibilidade do Time
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium">Informe os dias e horários que o time pode jogar</p>
                    </div>
                    <button 
                      onClick={addAvailability}
                      className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                    >
                      <Plus size={10} />
                      Adicionar
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                    {availability?.map((av, idx) => {
                      if (av.type === 'unavailable') return null;
                      return (
                      <div key={idx} className="flex items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <select 
                          value={av.day || ''}
                          onChange={(e) => updateAvailability(idx, 'day', e.target.value)}
                          className="bg-white border focus:border-indigo-500 border-slate-200 rounded-xl px-2 py-1.5 text-xs font-bold outline-none flex-1"
                        >
                          {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <div className="flex items-center gap-1">
                          <input 
                            type="time" 
                            value={av.start || ''}
                            onChange={(e) => updateAvailability(idx, 'start', e.target.value)}
                            className="bg-white border focus:border-indigo-500 border-slate-200 rounded-xl px-2 py-1.5 text-xs font-bold outline-none"
                          />
                          <span className="text-slate-300 font-bold text-[10px]">às</span>
                          <input 
                            type="time" 
                            value={av.end || ''}
                            onChange={(e) => updateAvailability(idx, 'end', e.target.value)}
                            className="bg-white border focus:border-indigo-500 border-slate-200 rounded-xl px-2 py-1.5 text-xs font-bold outline-none"
                          />
                        </div>
                        <button 
                          onClick={() => removeAvailability(idx)}
                          className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )})}
                    {(!availability || availability.filter(a => a.type !== 'unavailable').length === 0) && (
                      <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <Calendar className="mx-auto text-slate-300 mb-1" size={20} />
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Nenhuma disponibilidade informada</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-black text-rose-800 uppercase tracking-widest flex items-center gap-1">
                        <Calendar size={12} className="text-rose-600" />
                        Datas Indisponíveis (Exceções)
                      </h3>
                      <p className="text-[10px] text-slate-500 font-medium">Datas em que a equipe não pode jogar</p>
                    </div>
                    <button 
                      onClick={addUnavailableDate}
                      className="text-[10px] font-black text-rose-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                    >
                      <Plus size={10} />
                      Adicionar Data
                    </button>
                  </div>

                  <div className="space-y-2">
                    {availability?.map((av, idx) => {
                      if (av.type !== 'unavailable') return null;
                      return (
                      <div key={idx} className="flex items-center gap-2 bg-rose-50 p-3 rounded-2xl border border-rose-100 group">
                        <input 
                          type="date" 
                          value={av.date || ''}
                          onChange={(e) => updateAvailability(idx, 'date', e.target.value)}
                          className="bg-white border border-rose-200 focus:border-rose-500 rounded-xl px-2 py-1.5 text-xs font-bold outline-none flex-1"
                        />
                        <button 
                          onClick={() => removeAvailability(idx)}
                          className="p-1.5 text-rose-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )})}
                    {(!availability || availability.filter(a => a.type === 'unavailable').length === 0) && (
                      <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <p className="text-[10px] text-slate-400 font-bold">Nenhuma data adicionada</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {step === "athletes" && (
          <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-500">
              <Users size={18} />
              <span className="text-sm font-bold">{selectedAthleteIds.length} Atletas</span>
            </div>
            <div className="flex gap-3">
               <button 
                onClick={() => setStep("category")}
                className="px-6 py-3 rounded-2xl font-bold text-slate-600 hover:text-slate-800 transition-colors"
                disabled={loading}
              >
                Voltar
              </button>
              <button 
                onClick={handleSave}
                className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
                disabled={loading}
              >
                {loading ? "Salvando..." : "Salvar Inscrição"}
                <Check size={18} />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
