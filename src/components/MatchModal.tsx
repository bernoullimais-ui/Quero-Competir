import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Timer } from "lucide-react";
import { useToast } from "./ui/Toast.tsx";

interface MatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMatch: any;
  tournamentId: string;
  onStartLiveMatch: (matchId: string) => void;
  onSave: () => void;
}

export default function MatchModal({
  isOpen,
  onClose,
  selectedMatch,
  tournamentId,
  onStartLiveMatch,
  onSave
}: MatchModalProps) {
  const { warning: toastWarning } = useToast();
  const [loading, setLoading] = useState(false);
  const [manualWinner, setManualWinner] = useState<string | null | undefined>(undefined);
  
  const [team1Members, setTeam1Members] = useState<any[]>([]);
  const [team2Members, setTeam2Members] = useState<any[]>([]);
  const [roster1, setRoster1] = useState<Record<string, { jerseyNumber?: string; isCaptain?: boolean }>>({});
  const [roster2, setRoster2] = useState<Record<string, { jerseyNumber?: string; isCaptain?: boolean }>>({});
  const [showRosterConfig, setShowRosterConfig] = useState<1 | 2 | null>(null);

  useEffect(() => {
    if (selectedMatch && isOpen) {
      setRoster1(selectedMatch.roster1 || {});
      setRoster2(selectedMatch.roster2 || {});
      setManualWinner(undefined);
      setShowRosterConfig(null);

      if (selectedMatch.team1_id) {
        fetch(`/api/tournaments/teams/${selectedMatch.team1_id}/athletes`)
          .then((r) => r.json())
          .then((data) => setTeam1Members(data));
      } else {
        setTeam1Members([]);
      }

      if (selectedMatch.team2_id) {
        fetch(`/api/tournaments/teams/${selectedMatch.team2_id}/athletes`)
          .then((r) => r.json())
          .then((data) => setTeam2Members(data));
      } else {
        setTeam2Members([]);
      }
    }
  }, [selectedMatch, isOpen]);

  if (!isOpen || !selectedMatch) return null;

  const handleStartLive = async () => {
    try {
      await fetch(`/api/tournaments/matches/${selectedMatch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roster1, roster2 })
      });
    } catch (e) {
      console.error(e);
    }
    onStartLiveMatch(selectedMatch.id);
    onClose();
  };

  const handleSaveResult = async () => {
    const s1 = parseInt((document.getElementById("score1_input") as HTMLInputElement).value) || 0;
    const s2 = parseInt((document.getElementById("score2_input") as HTMLInputElement).value) || 0;

    let wId = manualWinner;
    const isGroupMatch = !!selectedMatch.group_label;

    if (manualWinner === null && !isGroupMatch) {
      toastWarning("Jogos eliminatórios não podem terminar em empate. Selecione um vencedor.");
      return;
    }

    if (manualWinner === undefined || manualWinner === null) {
      if (s1 > s2) wId = selectedMatch.team1_id;
      else if (s2 > s1) wId = selectedMatch.team2_id;
      else if (isGroupMatch) wId = null; // Draw is allowed
    }

    if (wId === undefined && !isGroupMatch) {
      toastWarning("Por favor, selecione o vencedor manualmente em caso de empate.");
      return;
    }

    if (s1 === s2 && !isGroupMatch && !manualWinner) {
      toastWarning("Por favor, informe quem venceu nos pênaltis/critério de desempate.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/matches/${selectedMatch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score1: s1,
          score2: s2,
          winner_id: wId,
          status: "finished",
          roster1,
          roster2
        })
      });
      if (res.ok) {
        onSave();
        onClose();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
      >
        <div className="flex justify-between items-center mb-8">
          <h3 className="text-2xl font-bold">Lançar Jogo</h3>
          <button onClick={onClose} className="text-slate-400 p-2 hover:bg-slate-50 rounded-lg">
            <X size={24} />
          </button>
        </div>

        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-8 items-center text-center">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl mx-auto flex items-center justify-center font-bold text-xl border border-indigo-100 overflow-hidden">
                {selectedMatch.team1?.institution?.logo_url ? (
                  <img
                    src={selectedMatch.team1.institution.logo_url}
                    alt="Logo"
                    className="w-full h-full object-contain p-2 bg-white"
                    onError={(e: any) => {
                      e.target.style.display = "none";
                      e.target.nextElementSibling.style.display = "block";
                    }}
                  />
                ) : null}
                <span style={{ display: selectedMatch.team1?.institution?.logo_url ? "none" : "block" }}>
                  {selectedMatch.team1?.institution?.name?.charAt(0) || "?"}
                </span>
              </div>
              <p className="text-[10px] font-bold truncate px-2 text-slate-500 uppercase tracking-widest">
                {selectedMatch.roster1?.athlete_name ? `${selectedMatch.roster1.athlete_name} (${selectedMatch.roster1.institution_name})` : (selectedMatch.team1?.institution?.name || "A definir")}
              </p>
              <input
                type="number"
                className="w-20 text-center text-3xl font-black p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 mx-auto"
                defaultValue={selectedMatch.score1 ?? ""}
                id="score1_input"
              />
            </div>

            <div className="text-slate-350 font-black text-2xl italic">VS</div>

            <div className="space-y-4">
              <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl mx-auto flex items-center justify-center font-bold text-xl border border-amber-100 overflow-hidden">
                {selectedMatch.team2?.institution?.logo_url ? (
                  <img
                    src={selectedMatch.team2.institution.logo_url}
                    alt="Logo"
                    className="w-full h-full object-contain p-2 bg-white"
                    onError={(e: any) => {
                      e.target.style.display = "none";
                      e.target.nextElementSibling.style.display = "block";
                    }}
                  />
                ) : null}
                <span style={{ display: selectedMatch.team2?.institution?.logo_url ? "none" : "block" }}>
                  {selectedMatch.team2?.institution?.name?.charAt(0) || "?"}
                </span>
              </div>
              <p className="text-[10px] font-bold truncate px-2 text-slate-500 uppercase tracking-widest">
                {selectedMatch.roster2?.athlete_name ? `${selectedMatch.roster2.athlete_name} (${selectedMatch.roster2.institution_name})` : (selectedMatch.team2?.institution?.name || "A definir")}
              </p>
              <input
                type="number"
                className="w-20 text-center text-3xl font-black p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 mx-auto"
                defaultValue={selectedMatch.score2 ?? ""}
                id="score2_input"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => setShowRosterConfig(showRosterConfig === 1 ? null : 1)}
              className="flex-1 p-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
            >
              {showRosterConfig === 1 ? "Ocultar Elenco" : "Configurar Elenco A"}
            </button>
            <button
              onClick={() => setShowRosterConfig(showRosterConfig === 2 ? null : 2)}
              className="flex-1 p-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors"
            >
              {showRosterConfig === 2 ? "Ocultar Elenco" : "Configurar Elenco B"}
            </button>
          </div>

          <AnimatePresence>
            {showRosterConfig && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 max-h-64 overflow-y-auto custom-scrollbar">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    Elenco - {showRosterConfig === 1 ? selectedMatch.team1?.institution?.name : selectedMatch.team2?.institution?.name}
                  </h4>
                  <div className="space-y-2">
                    {(showRosterConfig === 1 ? team1Members : team2Members).map((athlete) => {
                      const currentRoster = showRosterConfig === 1 ? roster1 : roster2;
                      const setRoster = showRosterConfig === 1 ? setRoster1 : setRoster2;
                      const isCap = currentRoster[athlete.id]?.isCaptain ?? false;
                      const num = currentRoster[athlete.id]?.jerseyNumber ?? "";

                      return (
                        <div key={athlete.id} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-100">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate">{athlete.full_name || athlete.name}</p>
                          </div>
                          <input
                            type="number"
                            placeholder="Nº"
                            value={num}
                            onChange={(e) => {
                              setRoster((prev) => ({
                                ...prev,
                                [athlete.id]: { ...prev[athlete.id], jerseyNumber: e.target.value }
                              }));
                            }}
                            className="w-12 text-center text-xs font-bold p-1.5 bg-slate-50 rounded-lg outline-none focus:border-indigo-500 border border-slate-200"
                          />
                          <button
                            onClick={() => {
                              const newRoster = { ...currentRoster };
                              Object.keys(newRoster).forEach((k) => {
                                if (newRoster[k]) newRoster[k].isCaptain = false;
                              });
                              newRoster[athlete.id] = { ...newRoster[athlete.id], isCaptain: true };
                              setRoster(newRoster);
                            }}
                            className={`p-1.5 rounded-lg text-[10px] font-bold uppercase transition-colors ${
                              isCap
                                ? "bg-amber-100 text-amber-700 border border-amber-200"
                                : "bg-slate-50 text-slate-400 hover:bg-slate-200"
                            }`}
                          >
                            CAP
                          </button>
                        </div>
                      );
                    })}
                    {(showRosterConfig === 1 ? team1Members : team2Members).length === 0 && (
                      <p className="text-xs font-medium text-slate-400 text-center py-4">Nenhum atleta cadastrado.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="space-y-4 pt-4">
            <button
              onClick={handleStartLive}
              className="w-full p-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-indigo-200 hover:bg-slate-900 transition-all mb-4 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Timer size={18} />
              Iniciar Partida (Painel do Mesário)
            </button>

            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest text-center">
              Resultado / Vencedor
            </label>
            <div className={`grid ${selectedMatch.group_label ? "grid-cols-3" : "grid-cols-2"} gap-3`}>
              <button
                type="button"
                onClick={() => setManualWinner(selectedMatch.team1_id)}
                className={`p-3 rounded-xl text-[10px] font-bold border transition-all uppercase tracking-widest ${
                  manualWinner === selectedMatch.team1_id
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                Time A
              </button>
              {selectedMatch.group_label && (
                <button
                  type="button"
                  onClick={() => setManualWinner(null)}
                  className={`p-3 rounded-xl text-[10px] font-bold border transition-all uppercase tracking-widest ${
                    manualWinner === null ? "bg-slate-600 text-white border-slate-600" : "bg-white text-slate-600 border-slate-200"
                  }`}
                >
                  Empate
                </button>
              )}
              <button
                type="button"
                onClick={() => setManualWinner(selectedMatch.team2_id)}
                className={`p-3 rounded-xl text-[10px] font-bold border transition-all uppercase tracking-widest ${
                  manualWinner === selectedMatch.team2_id
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-600 border-slate-200"
                }`}
              >
                Time B
              </button>
            </div>
          </div>

          <div className="flex gap-4 pt-6">
            <button
              onClick={onClose}
              className="flex-1 py-4 font-bold text-slate-500 border border-slate-200 rounded-2xl hover:bg-slate-50 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveResult}
              className="flex-1 py-4 font-bold text-white bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 cursor-pointer"
              disabled={loading}
            >
              {loading ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
