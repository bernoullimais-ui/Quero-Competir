import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Check, Save } from "lucide-react";
import { useToast } from "./ui/Toast.tsx";

interface EditAthleteSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  athleteGroup: any; // The grouped object containing all subIds and categoryIds
  categories: any[];
  refreshData: () => void;
}

export default function EditAthleteSubscriptionModal({
  isOpen,
  onClose,
  tournamentId,
  athleteGroup,
  categories,
  refreshData
}: EditAthleteSubscriptionModalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && athleteGroup) {
      setSelectedCategoryIds(athleteGroup.categoryIds || []);
    }
  }, [isOpen, athleteGroup]);

  if (!isOpen || !athleteGroup) return null;

  const handleToggleCategory = (catId: string) => {
    setSelectedCategoryIds(prev => 
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const handleSave = async () => {
    if (selectedCategoryIds.length === 0) {
      toastError("O atleta deve estar inscrito em ao menos uma prova.");
      return;
    }

    setLoading(true);
    try {
      const referenceSubId = athleteGroup.subIds[0];
      const res = await fetch(`/api/tournaments/${tournamentId}/athlete-subscriptions/bulk-edit`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referenceSubId,
          targetCategoryIds: selectedCategoryIds
        })
      });

      if (res.ok) {
        toastSuccess("Inscrições do atleta atualizadas com sucesso!");
        refreshData();
        onClose();
      } else {
        const data = await res.json();
        toastError(data.error || "Erro ao atualizar inscrições.");
      }
    } catch (err: any) {
      toastError("Erro de comunicação com o servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Editar Inscrição do Atleta</h2>
              <p className="text-sm text-slate-500 font-medium mt-1">
                Atleta: <strong className="text-indigo-600">{athleteGroup.athleteName}</strong>
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1">
            <h3 className="text-sm font-bold text-slate-700 mb-4">Selecione as provas desejadas:</h3>
            
            <div className="space-y-3">
              {categories.map(cat => {
                const isSelected = selectedCategoryIds.includes(cat.id);
                return (
                  <div 
                    key={cat.id}
                    onClick={() => handleToggleCategory(cat.id)}
                    className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                      isSelected ? "border-indigo-500 bg-indigo-50/50" : "border-slate-100 hover:border-indigo-200"
                    }`}
                  >
                    <div>
                      <h4 className="font-bold text-slate-800">{cat.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {cat.gender} • {cat.age_group} 
                        {cat.birth_year_min && ` (Nascidos entre ${cat.birth_year_min} e ${cat.birth_year_max})`}
                      </p>
                    </div>
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                      isSelected ? "bg-indigo-600 text-white" : "bg-slate-100 text-transparent"
                    }`}>
                      <Check size={14} strokeWidth={4} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={loading || selectedCategoryIds.length === 0}
              className="px-5 py-2.5 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-md shadow-indigo-200 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                "Salvando..."
              ) : (
                <>
                  <Save size={18} />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
