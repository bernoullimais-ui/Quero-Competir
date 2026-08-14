import React, { useState } from "react";
import { motion } from "motion/react";
import { Plus, ListChecks, X, Edit2, Trash2, Waves, CheckSquare, Square, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { getSportIcon, getSportBgClass } from "./TournamentDashboard.tsx";
import { useToast } from "./ui/Toast.tsx";

interface CategoriesTabProps {
  categories: any[];
  refreshCategories: () => void;
  tournamentId: string;
}

// ── Natação: provas pré-configuradas ─────────────────────────────────────────
const SWIM_EVENTS = [
  { id: "50m_borbo_fem",   label: "50M BORBO FEM",        gender: "Feminino" },
  { id: "50m_borbo_masc",  label: "50M BORBO MASC",       gender: "Masculino" },
  { id: "50m_livre_fem",   label: "50M LIVRE FEM",        gender: "Feminino" },
  { id: "50m_livre_masc",  label: "50M LIVRE MASC",       gender: "Masculino" },
  { id: "50m_costa_fem",   label: "50M COSTA FEM",        gender: "Feminino" },
  { id: "50m_costa_masc",  label: "50M COSTA MASC",       gender: "Masculino" },
  { id: "50m_peito_fem",   label: "50M PEITO FEM",        gender: "Feminino" },
  { id: "50m_peito_masc",  label: "50M PEITO MASC",       gender: "Masculino" },
  { id: "100m_medley_fem", label: "100M MEDLEY FEM",      gender: "Feminino" },
  { id: "100m_medley_masc","label": "100M MEDLEY MASC",  gender: "Masculino" },
  { id: "rev_4x25_livre",  label: "REVEZAMENTO 4X25 LIVRE", gender: "Misto" },
];

// Faixas etárias para natação calculadas pelo ano de nascimento
function getSwimAgeClasses(currentYear: number) {
  return [
    {
      label: "Até 30 anos",
      description: `Nascidos em ${currentYear - 30} ou depois`,
      birth_year_min: currentYear - 30,
      birth_year_max: currentYear,
      age_group: "-30 anos",
    },
    {
      label: "Até 40 anos",
      description: `30-39 anos · Nascidos entre ${currentYear - 40} e ${currentYear - 31}`,
      birth_year_min: currentYear - 40,
      birth_year_max: currentYear - 31,
      age_group: "-40 anos",
    },
    {
      label: "Até 50 anos",
      description: `40-49 anos · Nascidos entre ${currentYear - 50} e ${currentYear - 41}`,
      birth_year_min: currentYear - 50,
      birth_year_max: currentYear - 41,
      age_group: "-50 anos",
    },
    {
      label: "Até 60 anos",
      description: `50-59 anos · Nascidos entre ${currentYear - 60} e ${currentYear - 51}`,
      birth_year_min: currentYear - 60,
      birth_year_max: currentYear - 51,
      age_group: "-60 anos",
    },
    {
      label: "Até 70 anos",
      description: `60-69 anos · Nascidos entre ${currentYear - 70} e ${currentYear - 61}`,
      birth_year_min: currentYear - 70,
      birth_year_max: currentYear - 61,
      age_group: "-70 anos",
    },
    {
      label: "Acima de 70 anos",
      description: `Nascidos em ${currentYear - 71} ou antes`,
      birth_year_min: null,
      birth_year_max: currentYear - 71,
      age_group: "+70 anos",
    },
  ];
}

export default function CategoriesTab({ categories, refreshCategories, tournamentId }: CategoriesTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<any | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const { success: toastSuccess, error: toastError } = useToast();

  const handleMoveCategory = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= categories.length) return;
    const newCategories = [...categories];
    const [moved] = newCategories.splice(fromIndex, 1);
    newCategories.splice(toIndex, 0, moved);

    const orderedIds = newCategories.map(c => c.id);
    setIsSavingOrder(true);

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/categories/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      });
      if (!res.ok) throw new Error("Erro ao reordenar provas");
      toastSuccess("Ordem das provas atualizada!");
      refreshCategories();
    } catch (err: any) {
      toastError(err.message || "Falha ao reordenar");
    } finally {
      setIsSavingOrder(false);
    }
  };

  // Natação: provas e faixas selecionadas para criação em lote
  const [selectedSwimEvents, setSelectedSwimEvents] = useState<string[]>([]);
  const [selectedSwimAgeClasses, setSelectedSwimAgeClasses] = useState<string[]>([]);
  const [swimMaxPerLane, setSwimMaxPerLane] = useState(30);

  const currentYear = new Date().getFullYear();
  const swimAgeClasses = getSwimAgeClasses(currentYear);

  const isNatacao = (name: string) =>
    name.toLowerCase().includes("nata") || name.toLowerCase().includes("swim");

  const getInitialRulesConfig = (sportName: string) => {
    const name = sportName.toLowerCase();
    if (name.includes("volei") || name.includes("vôlei") || name.includes("volleyball")) {
      return { sport_type: "volleyball", match_format: "best_of_3" };
    }
    if (name.includes("basquete") || name.includes("basketball")) {
      return { sport_type: "basketball", match_format: "single_match" };
    }
    if (name.includes("handebol") || name.includes("handball")) {
      return { sport_type: "handball", match_format: "single_match" };
    }
    if (name.includes("baleado") || name.includes("queimada") || name.includes("dodgeball")) {
      return { sport_type: "dodgeball", match_format: "best_of_3" };
    }
    if (
      name.includes("judo") || name.includes("judô") ||
      name.includes("karate") || name.includes("karatê") ||
      name.includes("taekwondo") || name.includes("jiu-jitsu") || name.includes("jiujitsu") ||
      name.includes("wrestling") || name.includes("luta") || name.includes("combat") ||
      name.includes("boxe") || name.includes("muay")
    ) {
      return {
        sport_type: "combat",
        ages: ["Sub-13", "Sub-15", "Adulto"],
        graduations: ["Iniciante", "Avançado"],
        weights: ["Leve", "Médio", "Pesado"],
        match_format: "single_match"
      };
    }
    if (isNatacao(name)) {
      return { sport_type: "swimming" };
    }
    return { sport_type: "football", match_format: "single_match" };
  };

  const [newCat, setNewCat] = useState<any>({
    name: "Futsal",
    gender: "Masculino",
    age_group: "Sub-15",
    birth_year_min: null,
    birth_year_max: null,
    max_teams: 16,
    rules_config: {
      sport_type: "football",
      match_format: "single_match"
    }
  });

  const handleSportChange = (sportName: string) => {
    const config = getInitialRulesConfig(sportName);
    setNewCat((prev: any) => ({
      ...prev,
      name: sportName,
      rules_config: config,
      // Reset swim selections when switching sports
      ...(config.sport_type !== "swimming" ? {} : {})
    }));
    if (config.sport_type === "swimming") {
      setSelectedSwimEvents([]);
      setSelectedSwimAgeClasses([]);
    }
  };

  const openAddModal = () => {
    setEditingCategory(null);
    setNewCat({
      name: "Futsal",
      gender: "Masculino",
      age_group: "Sub-15",
      birth_year_min: null,
      birth_year_max: null,
      max_teams: 16,
      rules_config: { sport_type: "football", match_format: "single_match" }
    });
    setSelectedSwimEvents([]);
    setSelectedSwimAgeClasses([]);
    setSwimMaxPerLane(30);
    setShowAddModal(true);
  };

  const openEditModal = (cat: any) => {
    setEditingCategory(cat);
    setNewCat({
      name: cat.name,
      gender: cat.gender,
      age_group: cat.age_group,
      birth_year_min: cat.birth_year_min ?? null,
      birth_year_max: cat.birth_year_max ?? null,
      max_teams: cat.max_teams || 16,
      rules_config: cat.rules_config || getInitialRulesConfig(cat.name)
    });
    setSelectedSwimEvents([]);
    setSelectedSwimAgeClasses([]);
    setSwimMaxPerLane(30);
    setShowAddModal(true);
  };

  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    try {
      const res = await fetch(`/api/tournaments/categories/${editingCategory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCat)
      });
      if (res.ok) {
        refreshCategories();
        setShowAddModal(false);
        setEditingCategory(null);
        toastSuccess("Categoria atualizada com sucesso!");
      } else {
        const err = await res.json();
        toastError(`Erro ao atualizar categoria: ${err.error || "Erro desconhecido"}`);
      }
    } catch (err) {
      toastError("Erro ao conectar com o servidor.");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingCategory) return;
    try {
      const res = await fetch(`/api/tournaments/categories/${deletingCategory.id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        refreshCategories();
        setDeletingCategory(null);
        toastSuccess("Categoria excluída com sucesso!");
      } else {
        const err = await res.json();
        toastError(`Erro ao excluir categoria: ${err.error || "Erro desconhecido"}`);
      }
    } catch (err) {
      toastError("Erro ao conectar com o servidor.");
    }
  };

  // Cria múltiplas categorias em lote (Natação)
  const handleAddSwimmingCategories = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSwimEvents.length === 0) {
      toastError("Selecione ao menos uma prova.");
      return;
    }
    if (selectedSwimAgeClasses.length === 0) {
      toastError("Selecione ao menos uma faixa etária.");
      return;
    }

    const events = SWIM_EVENTS.filter(ev => selectedSwimEvents.includes(ev.id));
    const ageClasses = swimAgeClasses.filter(ac => selectedSwimAgeClasses.includes(ac.label));

    const categoriesToCreate: any[] = [];
    for (const ageClass of ageClasses) {
      for (const event of events) {
        categoriesToCreate.push({
          name: `Natação - ${event.label}`,
          gender: event.gender === "Misto" ? "Misto" : event.gender,
          age_group: ageClass.age_group,
          birth_year_min: ageClass.birth_year_min,
          birth_year_max: ageClass.birth_year_max,
          max_teams: swimMaxPerLane,
          rules_config: {
            sport_type: "swimming",
            swim_event: event.id,
            swim_event_label: event.label,
          }
        });
      }
    }

    let successCount = 0;
    let errorCount = 0;
    for (const cat of categoriesToCreate) {
      try {
        const res = await fetch(`/api/tournaments/${tournamentId}/categories`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cat)
        });
        if (res.ok) successCount++;
        else errorCount++;
      } catch {
        errorCount++;
      }
    }

    refreshCategories();
    setShowAddModal(false);
    if (successCount > 0) toastSuccess(`${successCount} categorias de Natação adicionadas!`);
    if (errorCount > 0) toastError(`${errorCount} categorias não puderam ser criadas.`);
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCat)
      });
      if (res.ok) {
        refreshCategories();
        setShowAddModal(false);
        toastSuccess("Categoria adicionada com sucesso!");
      } else {
        const err = await res.json();
        const isMissingTable = err.error?.includes('schema cache') || err.error?.includes('relation');
        toastError(isMissingTable
          ? "Erro: A tabela 'tournament_categories' não foi encontrada. Verifique o log ou execute o script SQL de criação no Supabase."
          : `Erro: ${err.error || "Erro desconhecido"}`);
      }
    } catch (err) {
      toastError("Erro ao conectar com o servidor.");
    }
  };

  const isSwimming = isNatacao(newCat.name);

  const toggleSwimEvent = (id: string) => {
    setSelectedSwimEvents(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const toggleSwimAgeClass = (label: string) => {
    setSelectedSwimAgeClasses(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
    );
  };

  const selectAllEvents = () => setSelectedSwimEvents(SWIM_EVENTS.map(e => e.id));
  const clearAllEvents = () => setSelectedSwimEvents([]);
  const selectAllAgeClasses = () => setSelectedSwimAgeClasses(swimAgeClasses.map(a => a.label));
  const clearAllAgeClasses = () => setSelectedSwimAgeClasses([]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold">Categorias & Provas do Torneio</h3>
          <p className="text-slate-500 text-sm">Defina as modalidades e a sequência oficial de provas do evento.</p>
        </div>
        <div className="flex items-center gap-3">
          {categories.length > 1 && (
            <button
              onClick={() => setShowReorderModal(true)}
              className="bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 px-4 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2 text-sm cursor-pointer shadow-xs"
            >
              <ArrowUpDown size={16} />
              Reordenar Provas 🔢
            </button>
          )}
          <button
            onClick={openAddModal}
            className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-200 text-sm"
          >
            <Plus size={18} />
            Nova Categoria
          </button>
        </div>
      </div>

      {categories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat, i) => (
            <div key={cat.id || i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all relative group">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${getSportBgClass(cat.name)}`}>
                    {isNatacao(cat.name)
                      ? <Waves size={24} className="text-cyan-600" />
                      : getSportIcon(cat.name, 24)
                    }
                  </div>
                  <span className="text-xs font-black text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-xl uppercase">
                    Prova #{i + 1}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold text-slate-400 border border-slate-100 px-2 py-0.5 rounded-full uppercase mr-1">
                    {cat.gender}
                  </span>
                  {/* Up / Down Order Buttons */}
                  <button
                    disabled={i === 0 || isSavingOrder}
                    onClick={() => handleMoveCategory(i, i - 1)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mover Prova para Cima"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    disabled={i === categories.length - 1 || isSavingOrder}
                    onClick={() => handleMoveCategory(i, i + 1)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mover Prova para Baixo"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    onClick={() => openEditModal(cat)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Editar Modalidade"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => setDeletingCategory(cat)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Excluir Modalidade"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
              <h4 className="font-bold text-lg mb-1">{cat.name}</h4>
              <p className="text-sm text-slate-500 mb-1">{cat.age_group}</p>
              {(cat.birth_year_min || cat.birth_year_max) && (
                <p className="text-xs text-indigo-600 font-semibold mb-3 flex items-center gap-1">
                  <span>🎂</span>
                  <span>
                    Nascidos {cat.birth_year_min && cat.birth_year_max
                      ? `entre ${cat.birth_year_min} e ${cat.birth_year_max}`
                      : cat.birth_year_min
                        ? `a partir de ${cat.birth_year_min}`
                        : `até ${cat.birth_year_max}`
                    }
                  </span>
                </p>
              )}
              {cat.rules_config?.swim_event_label && (
                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-cyan-700 bg-cyan-50 border border-cyan-100 px-2 py-0.5 rounded-full mb-2">
                  🏊 {cat.rules_config.swim_event_label}
                </span>
              )}
              <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                <span>Atletas: {cat.registered_count || 0} / {cat.max_teams || 16}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 border-dashed text-center py-20">
          <ListChecks size={48} className="mx-auto text-slate-300 mb-4" />
          <h3 className="text-lg font-bold text-slate-600">Nenhuma modalidade configurada</h3>
          <p className="text-slate-500 mt-1 mb-8 max-w-xs mx-auto text-sm">
            Comece definindo as categorias que farão parte desta competição.
          </p>
          <button
            onClick={openAddModal}
            className="text-indigo-600 font-bold hover:underline"
          >
            Adicionar primeira agora
          </button>
        </div>
      )}

      {/* Modal de Categoria */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-lg relative max-h-[90vh] overflow-y-auto"
          >
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setEditingCategory(null);
              }}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
            <h3 className="text-2xl font-bold mb-4">
              {editingCategory ? "Editar Categoria" : "Nova Categoria"}
            </h3>

            {/* Sport selector */}
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                Selecione o Esporte / Modalidade Pré-Cadastrada
              </label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { name: "Futsal",               label: "Futsal" },
                  { name: "Futebol de Campo",      label: "Futebol" },
                  { name: "Voleibol",              label: "Voleibol" },
                  { name: "Basquetebol",           label: "Basquete" },
                  { name: "Handebol",              label: "Handebol" },
                  { name: "Baleado",               label: "Baleado" },
                  { name: "Judô",                  label: "Judô" },
                  { name: "Jiu-Jitsu",             label: "Jiu-Jitsu" },
                  { name: "Karatê",                label: "Karatê" },
                  { name: "Natação",               label: "Natação" },
                ].map((preset) => {
                  const isSelected = newCat.name === preset.name;
                  const isSwim = preset.name === "Natação";
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleSportChange(preset.name)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all text-center gap-1.5 cursor-pointer ${
                        isSelected
                          ? isSwim
                            ? "border-cyan-500 bg-cyan-50/60 ring-2 ring-cyan-500/15"
                            : "border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-600/10"
                          : "border-slate-100 bg-slate-50/50 hover:border-slate-200"
                      }`}
                    >
                      <div className="p-1.5 rounded-xl bg-white shadow-xs">
                        {isSwim
                          ? <Waves size={20} className={isSelected ? "text-cyan-500" : "text-slate-400"} />
                          : getSportIcon(preset.name, 20)
                        }
                      </div>
                      <span className={`text-[11px] font-bold tracking-tight leading-none ${isSelected && isSwim ? "text-cyan-700" : "text-slate-700"}`}>
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 mt-1">
                Ou digite o nome do esporte
              </label>
              <input
                type="text"
                placeholder="Nome da modalidade do esporte..."
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-sm font-medium"
                value={newCat.name}
                onChange={e => {
                  const val = e.target.value;
                  setNewCat((prev: any) => ({
                    ...prev,
                    name: val,
                    rules_config: getInitialRulesConfig(val)
                  }));
                }}
                required
              />
            </div>

            {/* ── NATAÇÃO: configuração especial ─────────────────────────────── */}
            {isSwimming && !editingCategory ? (
              <form onSubmit={handleAddSwimmingCategories} className="space-y-5">

                {/* Provas */}
                <div className="bg-cyan-50/70 border border-cyan-100 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-cyan-800 uppercase tracking-wider">
                      🏊 Provas a Disputar
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={selectAllEvents}
                        className="text-[10px] font-bold text-cyan-700 hover:text-cyan-900 underline">
                        Todas
                      </button>
                      <span className="text-cyan-300">|</span>
                      <button type="button" onClick={clearAllEvents}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600 underline">
                        Limpar
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {SWIM_EVENTS.map(ev => {
                      const checked = selectedSwimEvents.includes(ev.id);
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => toggleSwimEvent(ev.id)}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition-all ${
                            checked
                              ? "bg-cyan-600 border-cyan-600 text-white"
                              : "bg-white border-slate-200 text-slate-700 hover:border-cyan-300"
                          }`}
                        >
                          {checked
                            ? <CheckSquare size={15} className="shrink-0" />
                            : <Square size={15} className="shrink-0 text-slate-300" />
                          }
                          <span className="text-[12px] font-bold uppercase tracking-wide">{ev.label}</span>
                          <span className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            ev.gender === "Feminino" ? (checked ? "bg-white/20 text-white" : "bg-pink-50 text-pink-600")
                            : ev.gender === "Masculino" ? (checked ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600")
                            : (checked ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500")
                          }`}>
                            {ev.gender === "Masculino" ? "MASC" : ev.gender === "Feminino" ? "FEM" : "MISTO"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {selectedSwimEvents.length > 0 && (
                    <p className="text-[11px] text-cyan-700 font-semibold">
                      {selectedSwimEvents.length} prova{selectedSwimEvents.length > 1 ? "s" : ""} selecionada{selectedSwimEvents.length > 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                {/* Faixas etárias */}
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-indigo-800 uppercase tracking-wider">
                      🎂 Classes de Idade (por ano de nascimento)
                    </label>
                    <div className="flex gap-2">
                      <button type="button" onClick={selectAllAgeClasses}
                        className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 underline">
                        Todas
                      </button>
                      <span className="text-indigo-300">|</span>
                      <button type="button" onClick={clearAllAgeClasses}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600 underline">
                        Limpar
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {swimAgeClasses.map(ac => {
                      const checked = selectedSwimAgeClasses.includes(ac.label);
                      return (
                        <button
                          key={ac.label}
                          type="button"
                          onClick={() => toggleSwimAgeClass(ac.label)}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all ${
                            checked
                              ? "bg-indigo-600 border-indigo-600 text-white"
                              : "bg-white border-slate-200 text-slate-700 hover:border-indigo-300"
                          }`}
                        >
                          {checked
                            ? <CheckSquare size={15} className="shrink-0" />
                            : <Square size={15} className="shrink-0 text-slate-300" />
                          }
                          <div>
                            <p className="text-[12px] font-black uppercase tracking-wide">{ac.label}</p>
                            <p className={`text-[10px] font-medium ${checked ? "text-indigo-200" : "text-slate-400"}`}>
                              {ac.description}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {selectedSwimAgeClasses.length > 0 && (
                    <p className="text-[11px] text-indigo-700 font-semibold">
                      {selectedSwimAgeClasses.length} classe{selectedSwimAgeClasses.length > 1 ? "s" : ""} selecionada{selectedSwimAgeClasses.length > 1 ? "s" : ""}
                    </p>
                  )}
                </div>

                {/* Máx atletas por prova */}
                <div>
                  <label className="block text-sm font-semibold mb-2">Máx Atletas por Prova</label>
                  <input
                    type="number"
                    min={2}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-medium text-sm text-slate-700 bg-white"
                    value={swimMaxPerLane}
                    onChange={e => setSwimMaxPerLane(parseInt(e.target.value) || 30)}
                  />
                </div>

                {/* Preview */}
                {selectedSwimEvents.length > 0 && selectedSwimAgeClasses.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3">
                    <p className="text-[11px] font-black text-emerald-700 uppercase tracking-wider mb-1">
                      ✅ Prévia — {selectedSwimEvents.length * selectedSwimAgeClasses.length} categorias serão criadas
                    </p>
                    <p className="text-[10px] text-emerald-600 font-medium">
                      {selectedSwimEvents.length} prova{selectedSwimEvents.length > 1 ? "s" : ""} × {selectedSwimAgeClasses.length} faixa{selectedSwimAgeClasses.length > 1 ? "s" : ""} etária{selectedSwimAgeClasses.length > 1 ? "s" : ""}
                    </p>
                  </div>
                )}

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); setEditingCategory(null); }}
                    className="flex-1 px-6 py-3 rounded-xl font-bold border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-cyan-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-cyan-700 transition-colors"
                  >
                    Criar Categorias
                  </button>
                </div>
              </form>
            ) : (
              /* ── Outros esportes / edição ──────────────────────────────────── */
              <form onSubmit={editingCategory ? handleEditCategory : handleAddCategory} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Gênero</label>
                    <select
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-medium text-sm text-slate-700 bg-white"
                      value={newCat.gender}
                      onChange={e => setNewCat({...newCat, gender: e.target.value})}
                    >
                      <option>Masculino</option>
                      <option>Feminino</option>
                      <option>Misto</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Nível/Idade</label>
                    <input
                      type="text"
                      placeholder="Sub-15, Adulto..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-medium text-sm text-slate-700 bg-white"
                      value={newCat.age_group}
                      onChange={e => setNewCat({...newCat, age_group: e.target.value})}
                    />
                  </div>
                </div>

                {/* Faixa de nascimento */}
                <div className="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1">🎂 Faixa de Nascimento (opcional)</label>
                    <p className="text-[11px] text-slate-400 leading-relaxed">Atletas fora desta faixa não poderão ser inscritos nesta categoria.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Ano mínimo (mais velho)</label>
                      <input
                        type="number"
                        min={1950}
                        max={currentYear}
                        placeholder={`Ex: ${currentYear - 15}`}
                        className="w-full px-3 py-2.5 rounded-xl border border-indigo-200 outline-none font-medium text-sm text-slate-700 bg-white focus:border-indigo-400"
                        value={newCat.birth_year_min ?? ""}
                        onChange={e => setNewCat({...newCat, birth_year_min: e.target.value ? parseInt(e.target.value) : null})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Ano máximo (mais novo)</label>
                      <input
                        type="number"
                        min={1950}
                        max={currentYear}
                        placeholder={`Ex: ${currentYear - 12}`}
                        className="w-full px-3 py-2.5 rounded-xl border border-indigo-200 outline-none font-medium text-sm text-slate-700 bg-white focus:border-indigo-400"
                        value={newCat.birth_year_max ?? ""}
                        onChange={e => setNewCat({...newCat, birth_year_max: e.target.value ? parseInt(e.target.value) : null})}
                      />
                    </div>
                  </div>
                  {(newCat.birth_year_min || newCat.birth_year_max) && (
                    <p className="text-xs text-indigo-600 font-semibold">
                      ℹ️{" "}
                      {newCat.birth_year_min && newCat.birth_year_max
                        ? `Aceita nascidos entre ${newCat.birth_year_min} e ${newCat.birth_year_max} — terão entre ${currentYear - newCat.birth_year_max} e ${currentYear - newCat.birth_year_min} anos em ${currentYear}.`
                        : newCat.birth_year_min
                          ? `Aceita nascidos a partir de ${newCat.birth_year_min} (${currentYear - newCat.birth_year_min} anos ou mais velhos).`
                          : `Aceita nascidos até ${newCat.birth_year_max} (${currentYear - newCat.birth_year_max} anos ou mais novos).`
                      }
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">
                    {newCat.rules_config?.sport_type === "combat" ? "Máx Atletas" : "Máx Equipes"}
                  </label>
                  <input
                    type="number"
                    min={2}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-medium text-sm text-slate-700 bg-white"
                    value={newCat.max_teams || 16}
                    onChange={e => setNewCat({...newCat, max_teams: parseInt(e.target.value) || 16})}
                    required
                  />
                </div>

                {newCat.rules_config?.sport_type === "combat" && (
                  <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 space-y-4 text-left animate-in fade-in duration-300">
                    <h4 className="text-xs font-black text-indigo-650 uppercase tracking-widest">Configurações de Luta (Subdivisões)</h4>
                    <p className="text-[10px] text-slate-400 -mt-1 leading-relaxed">
                      Insira as opções separadas por vírgula para as chaves individuais.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Idades / Classes</label>
                        <input
                          type="text"
                          placeholder="Ex: Sub-13, Sub-15, Adulto"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none font-medium text-xs text-slate-700"
                          value={newCat.rules_config.ages?.join(", ") || ""}
                          onChange={e => {
                            const list = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                            setNewCat((prev: any) => ({ ...prev, rules_config: { ...prev.rules_config, ages: list } }));
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Graduações / Faixas</label>
                        <input
                          type="text"
                          placeholder="Ex: Iniciante, Avançado ou Branca, Azul, Preta"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none font-medium text-xs text-slate-700"
                          value={newCat.rules_config.graduations?.join(", ") || ""}
                          onChange={e => {
                            const list = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                            setNewCat((prev: any) => ({ ...prev, rules_config: { ...prev.rules_config, graduations: list } }));
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Categorias de Peso</label>
                        <input
                          type="text"
                          placeholder="Ex: Leve, Médio, Pesado ou -60kg, -66kg, +66kg"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white outline-none font-medium text-xs text-slate-700"
                          value={newCat.rules_config.weights?.join(", ") || ""}
                          onChange={e => {
                            const list = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                            setNewCat((prev: any) => ({ ...prev, rules_config: { ...prev.rules_config, weights: list } }));
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {(newCat.rules_config?.sport_type === "volleyball" || newCat.rules_config?.sport_type === "dodgeball") && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Formato da Partida (Sets)</label>
                    <select
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white outline-none font-medium text-sm text-slate-700"
                      value={newCat.rules_config?.match_format || "best_of_3"}
                      onChange={e => setNewCat({
                        ...newCat,
                        rules_config: { ...newCat.rules_config, match_format: e.target.value }
                      })}
                    >
                      <option value="single_match">Set Único</option>
                      <option value="best_of_3">Melhor de 3 Sets (Ganha quem vencer 2)</option>
                      <option value="best_of_5">Melhor de 5 Sets (Ganha quem vencer 3)</option>
                    </select>
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowAddModal(false); setEditingCategory(null); }}
                    className="flex-1 px-6 py-3 rounded-xl font-bold border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão */}
      {deletingCategory && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md relative text-center"
          >
            <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold mb-2">Excluir Categoria</h3>
            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
              Tem certeza que deseja excluir a categoria <strong className="text-slate-800">{deletingCategory.name} ({deletingCategory.gender} - {deletingCategory.age_group})</strong>?
              <br />
              <span className="text-rose-600 font-semibold text-xs mt-3 block bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                Aviso: Isso apagará permanentemente todas as partidas, inscrições de equipes e atletas vinculadas a esta categoria! Esta ação não pode ser desfeita.
              </span>
            </p>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setDeletingCategory(null)}
                className="flex-1 px-5 py-3 rounded-xl font-bold border border-slate-200 hover:bg-slate-50 transition-colors text-sm text-slate-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="flex-1 bg-rose-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-rose-700 transition-colors text-sm"
              >
                Confirmar Exclusão
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de Reordenar Sequência de Provas */}
      {showReorderModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-xl relative max-h-[85vh] flex flex-col"
          >
            <button
              type="button"
              onClick={() => setShowReorderModal(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>

            <div className="mb-5">
              <div className="flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-wider mb-1">
                <ArrowUpDown size={16} /> Programação & Sequência
              </div>
              <h3 className="text-2xl font-bold text-slate-800">Ordem Oficial das Provas</h3>
              <p className="text-slate-500 text-xs mt-1">
                Ajuste a ordem sequencial das provas. Essa ordem será refletida no balizamento geral e nas súmulas impressas.
              </p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {categories.map((cat, idx) => (
                <div
                  key={cat.id || idx}
                  className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                      #{idx + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">{cat.name}</h4>
                      <p className="text-xs text-slate-500 font-medium">{cat.gender} • {cat.age_group}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0 || isSavingOrder}
                      onClick={() => handleMoveCategory(idx, idx - 1)}
                      className="p-2 bg-white border border-slate-200 hover:border-indigo-400 text-slate-600 rounded-xl transition-all disabled:opacity-30 cursor-pointer shadow-2xs"
                      title="Mover para cima"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === categories.length - 1 || isSavingOrder}
                      onClick={() => handleMoveCategory(idx, idx + 1)}
                      className="p-2 bg-white border border-slate-200 hover:border-indigo-400 text-slate-600 rounded-xl transition-all disabled:opacity-30 cursor-pointer shadow-2xs"
                      title="Mover para baixo"
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-5 mt-4 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowReorderModal(false)}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-indigo-200 cursor-pointer"
              >
                Concluído
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
