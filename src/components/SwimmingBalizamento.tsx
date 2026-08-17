import React, { useState, useEffect } from "react";
import { Waves, Printer, Save, RefreshCw, Trophy, Users, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "./ui/Toast.tsx";

interface SwimmingBalizamentoProps {
  category: any;
  athleteSubs: any[];
  tournamentId: string;
  institutions?: any[];
  readOnly?: boolean;
  hideResults?: boolean;
}

interface LaneAssignment {
  laneNumber: number;
  athleteId?: string;
  athleteName?: string;
  institutionName?: string;
  seedTime?: string;
  resultTime?: string;
  rank?: number;
}

interface Heat {
  heatNumber: number;
  lanes: LaneAssignment[];
}

export default function SwimmingBalizamento({ category, athleteSubs, tournamentId, institutions = [], readOnly = false, hideResults = false }: SwimmingBalizamentoProps) {
  const [lanesCount, setLanesCount] = useState<number>(6);
  const [heats, setHeats] = useState<Heat[]>([]);
  const [editingResults, setEditingResults] = useState<Record<string, string>>({});
  const [isSavingResults, setIsSavingResults] = useState(false);
  const { success, error: toastError } = useToast();

  // Filter approved athletes for this category
  const categoryAthletes = athleteSubs.filter(
    (sub: any) => (sub.categoryId === category.id || sub.category_id === category.id) &&
      (sub.validationStatus === "approved" || sub.validation_status === "approved" || sub.isCompleted || sub.is_completed || !sub.validationStatus)
  );

  // Helper to get lane seeding order (FINA / CBDA standard with central lanes)
  const getLaneOrder = (numLanes: number): number[] => {
    switch (numLanes) {
      case 8: return [4, 5, 3, 6, 2, 7, 1, 8];
      case 7: return [4, 5, 3, 6, 2, 7, 1];
      case 6: return [3, 4, 2, 5, 1, 6];
      case 5: return [3, 4, 2, 5, 1];
      case 4: return [2, 3, 1, 4];
      case 3: return [2, 3, 1];
      case 2: return [1, 2];
      default: return Array.from({ length: numLanes }, (_, i) => i + 1);
    }
  };

  const getAthleteSeedTime = (ath: any): string => {
    const add = ath.additionalData || ath.additional_data || {};
    if (add.seedTimes && add.seedTimes[category.id]) {
      return add.seedTimes[category.id];
    }
    if (add.seed_time) return add.seed_time;
    if (add.seedTime) return add.seedTime;
    return "--:--.--";
  };

  const parseSeedTimeToMs = (timeStr?: string): number => {
    if (!timeStr || timeStr === "--:--.--" || timeStr === "00:00.00") return 99999999;
    const cleaned = timeStr.replace(/[^\d:.]/g, "");
    if (!cleaned) return 99999999;

    let mins = 0;
    let secs = 0;
    let ms = 0;

    if (cleaned.includes(":")) {
      const parts = cleaned.split(":");
      mins = Number(parts[0]) || 0;
      const secParts = (parts[1] || "").split(".");
      secs = Number(secParts[0]) || 0;
      ms = Number((secParts[1] || "0").padEnd(2, "0").slice(0, 2)) * 10;
    } else if (cleaned.includes(".")) {
      const parts = cleaned.split(".");
      secs = Number(parts[0]) || 0;
      ms = Number((parts[1] || "0").padEnd(2, "0").slice(0, 2)) * 10;
    } else {
      secs = Number(cleaned) || 0;
    }

    return (mins * 60 * 1000) + (secs * 1000) + ms;
  };

  const getAthleteInstitutionName = (ath: any): string => {
    const instId = ath.institutionId || ath.institution_id;
    if (instId && Array.isArray(institutions) && institutions.length > 0) {
      const found = institutions.find((i: any) => i.id === instId);
      if (found?.name) return found.name;
    }
    if (ath.institutionName) return ath.institutionName;
    if (ath.institution_name) return ath.institution_name;
    if (ath.institution?.name) return ath.institution.name;
    
    const add = ath.additionalData || ath.additional_data || {};
    if (add.institution_name) return add.institution_name;
    if (add.club_name) return add.club_name;
    if (add.team_name) return add.team_name;
    if (add.representative_name) return add.representative_name;

    return "Avulso";
  };

  // Generate Heats (Balizamento Equitativo FINA/CBDA)
  const generateBalizamento = () => {
    if (categoryAthletes.length === 0) {
      setHeats([]);
      return;
    }

    const laneOrder = getLaneOrder(lanesCount);
    const totalAthletes = categoryAthletes.length;
    const numHeats = Math.max(1, Math.ceil(totalAthletes / lanesCount));

    // Distribuir atletas equitativamente pelas séries (ex: 14 atletas em 6 raias -> 5, 5, 4)
    const baseCount = Math.floor(totalAthletes / numHeats);
    const remainder = totalAthletes % numHeats;
    const heatSizes: number[] = [];
    for (let h = 0; h < numHeats; h++) {
      heatSizes.push(baseCount + (h < remainder ? 1 : 0));
    }

    // Ordenar atletas do mais LENTO/sem tempo (primeiras séries) ao mais RÁPIDO (última série)
    const sortedAthletes = [...categoryAthletes].sort((a, b) => {
      const timeA = parseSeedTimeToMs(getAthleteSeedTime(a));
      const timeB = parseSeedTimeToMs(getAthleteSeedTime(b));
      return timeB - timeA; // Descending order of timeMs (slowest first, fastest last)
    });

    const newHeats: Heat[] = [];
    let offset = 0;

    for (let h = 0; h < numHeats; h++) {
      const count = heatSizes[h];
      const heatAthletesRaw = sortedAthletes.slice(offset, offset + count);
      offset += count;

      // Dentro de cada série, ordenar do mais RÁPIDO ao mais LENTO para colocar os melhores tempos nas raias centrais
      const heatAthletes = [...heatAthletesRaw].sort((a, b) => {
        const timeA = parseSeedTimeToMs(getAthleteSeedTime(a));
        const timeB = parseSeedTimeToMs(getAthleteSeedTime(b));
        return timeA - timeB; // Ascending order of timeMs (fastest first)
      });

      // Inicializar raias 1..lanesCount
      const laneAssignments: LaneAssignment[] = Array.from({ length: lanesCount }, (_, i) => ({
        laneNumber: i + 1,
      }));

      // Distribuir atletas nas raias segundo a ordem de raias centrais (FINA / CBDA)
      heatAthletes.forEach((ath, index) => {
        const targetLaneNum = laneOrder[index] || (index + 1);
        const laneObj = laneAssignments.find(l => l.laneNumber === targetLaneNum);
        if (laneObj) {
          laneObj.athleteId = ath.id;
          laneObj.athleteName = ath.athleteName || ath.full_name || ath.athlete_name;
          laneObj.institutionName = getAthleteInstitutionName(ath);
          laneObj.seedTime = getAthleteSeedTime(ath);
          laneObj.resultTime = editingResults[ath.id] || ath.additionalData?.result_time || ath.additional_data?.result_time || "";
        }
      });

      newHeats.push({
        heatNumber: h + 1,
        lanes: laneAssignments,
      });
    }

    setHeats(newHeats);
  };

  useEffect(() => {
    // Carregar tempos obtidos já salvos no banco
    const savedTimes: Record<string, string> = {};
    categoryAthletes.forEach((ath: any) => {
      const resTime = ath.additionalData?.result_time || ath.additional_data?.result_time;
      if (resTime) {
        savedTimes[ath.id] = resTime;
      }
    });
    if (Object.keys(savedTimes).length > 0) {
      setEditingResults(prev => ({ ...savedTimes, ...prev }));
    }
  }, [category.id, categoryAthletes.length]);

  useEffect(() => {
    generateBalizamento();
  }, [category.id, lanesCount, categoryAthletes.length, JSON.stringify(editingResults), JSON.stringify(institutions)]);

  // Mascara automática para digitação de tempo de natação (6 dígitos numéricos)
  const formatSwimmingTimeInput = (val: string): string => {
    if (!val) return "";
    const digits = val.replace(/\D/g, "");
    if (digits.length === 0) return "";

    const capped = digits.slice(0, 6);
    if (capped.length <= 2) {
      return capped;
    } else if (capped.length <= 4) {
      const sec = capped.slice(0, capped.length - 2);
      const ms = capped.slice(capped.length - 2);
      return `${sec}.${ms}`;
    } else {
      const min = capped.slice(0, capped.length - 4);
      const sec = capped.slice(capped.length - 4, capped.length - 2);
      const ms = capped.slice(capped.length - 2);
      return `${min}:${sec}.${ms}`;
    }
  };

  const finalizeSwimmingTimeOnBlur = (val: string): string => {
    if (!val) return "";
    const digits = val.replace(/\D/g, "");
    if (digits.length === 0) return "";

    const padded = digits.padStart(6, "0").slice(0, 6);
    const min = padded.slice(0, 2);
    const sec = padded.slice(2, 4);
    const ms = padded.slice(4, 6);
    return `${min}:${sec}.${ms}`;
  };

  // Handle time result input (soluciona o erro de handleResultChange)
  const handleResultChange = (athleteId: string, value: string) => {
    const formatted = formatSwimmingTimeInput(value);
    setEditingResults(prev => ({
      ...prev,
      [athleteId]: formatted
    }));
  };

  // Persistir tempo obtido de um único atleta no Supabase/backend
  const handleSaveSingleAthleteResult = async (athleteId: string, resultTime: string) => {
    if (!athleteId || resultTime === undefined) return;
    const ath = categoryAthletes.find((s: any) => s.id === athleteId);
    if (!ath) return;

    const currentAdd = ath.additionalData || ath.additional_data || {};
    const updatedAdditionalData = {
      ...currentAdd,
      result_time: resultTime.trim()
    };

    try {
      await fetch(`/api/tournaments/athlete-subscriptions/${athleteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ additionalData: updatedAdditionalData }),
      });
    } catch (e) {
      console.error("Auto-save error:", e);
    }
  };

  // Persistir tempos obtidos no Supabase / backend em lote
  const handleSaveResults = async () => {
    const entries = Object.entries(editingResults);
    if (entries.length === 0) {
      toastError("Nenhum resultado informado para salvar.");
      return;
    }

    setIsSavingResults(true);
    try {
      for (const [athleteId, resultTime] of entries) {
        const ath = categoryAthletes.find((s: any) => s.id === athleteId);
        if (ath && resultTime !== undefined) {
          const currentAdd = ath.additionalData || ath.additional_data || {};
          const updatedAdditionalData = {
            ...currentAdd,
            result_time: resultTime.trim()
          };

          await fetch(`/api/tournaments/athlete-subscriptions/${athleteId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ additionalData: updatedAdditionalData }),
          });
        }
      }
      success("Resultados da prova salvos com sucesso!");
    } catch (err: any) {
      toastError("Erro ao salvar resultados: " + err.message);
    } finally {
      setIsSavingResults(false);
    }
  };

  // Calculate overall proof rankings across ALL heats (Final Direta)
  const getOverallRankings = () => {
    const list: {
      athleteId: string;
      athleteName: string;
      institutionName: string;
      seedTime: string;
      resultTime: string;
      heatNumber: number;
      laneNumber: number;
    }[] = [];

    heats.forEach((h) => {
      h.lanes.forEach((l) => {
        if (l.athleteId) {
          const time = editingResults[l.athleteId] || l.resultTime;
          if (time && time.trim() !== "" && time !== "--:--.--") {
            list.push({
              athleteId: l.athleteId,
              athleteName: l.athleteName || "",
              institutionName: l.institutionName || "Avulso",
              seedTime: l.seedTime || "--:--.--",
              resultTime: time.trim(),
              heatNumber: h.heatNumber,
              laneNumber: l.laneNumber,
            });
          }
        }
      });
    });

    // Sort by resultTime ascending (fastest time first)
    list.sort((a, b) => a.resultTime.localeCompare(b.resultTime));
    return list;
  };

  // Calculate rank badge across ALL heats of the proof
  const getRankBadge = (athleteId: string) => {
    const overall = getOverallRankings();
    const idx = overall.findIndex((item) => item.athleteId === athleteId);
    if (idx === -1) return null;
    if (idx === 0) return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400 text-indigo-950 font-black text-[11px] border border-amber-300 whitespace-nowrap shadow-2xs">1º 🥇 Geral</span>;
    if (idx === 1) return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-900 font-black text-[11px] border border-slate-300 whitespace-nowrap shadow-2xs">2º 🥈 Geral</span>;
    if (idx === 2) return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-700 text-amber-100 font-black text-[11px] border border-amber-600 whitespace-nowrap shadow-2xs">3º 🥉 Geral</span>;
    return <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[11px] whitespace-nowrap">{idx + 1}º Geral</span>;
  };

  // Print Heat Sheet (Súmula)
  const handlePrintSumula = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Súmula de Balizamento - ${category.name}</title>

          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            h2 { font-size: 14px; color: #64748b; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 30px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
            th { background-color: #f1f5f9; font-weight: bold; uppercase; }
            .lane-num { font-weight: bold; text-align: center; width: 50px; background-color: #f8fafc; }
            .heat-header { background-color: #1e293b; color: white; padding: 8px 12px; font-weight: bold; border-radius: 4px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>SÚMULA DE BALIZAMENTO - NATAÇÃO</h1>
          <h2>Prova/Categoria: ${category.name} (${category.gender || ""} ${category.age_group || ""}) • Raias: ${lanesCount}</h2>

          ${heats.map(h => `
            <div class="heat-header">SÉRIE ${h.heatNumber} de ${heats.length}</div>
            <table>
              <thead>
                <tr>
                  <th style="width: 50px; text-align: center;">Raia</th>
                  <th>Atleta</th>
                  <th>Clube / Entidade</th>
                  <th style="width: 120px;">Tempo Inscrição</th>
                  ${!hideResults ? `<th style="width: 120px;">Tempo Final</th>` : ""}
                  ${!hideResults ? `<th style="width: 80px;">Classif.</th>` : ""}
                </tr>
              </thead>
              <tbody>
                ${h.lanes.map(l => `
                  <tr>
                    <td class="lane-num">${l.laneNumber}</td>
                    <td><strong>${l.athleteName || "—"}</strong></td>
                    <td>${l.institutionName || "—"}</td>
                    <td>${l.seedTime || "--:--.--"}</td>
                    ${!hideResults ? `<td>${(l.athleteId && editingResults[l.athleteId]) || "___:___.___"}</td>` : ""}
                    ${!hideResults ? `<td></td>` : ""}
                  </tr>
                `).join("")}
              </tbody>
            </table>
          `).join("")}
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="space-y-6">
      {/* Control Header & Lane Selection */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider">
              <Waves size={16} /> Balizamento Automático de Natação
            </div>
            <h3 className="text-xl font-black text-slate-800">
              {category.name} <span className="text-slate-400 font-normal">({category.gender} {category.age_group})</span>
            </h3>
            <p className="text-xs text-slate-500">
              {readOnly ? "Visualização oficial do balizamento de raias e séries." : "Configure o número de raias da piscina para distribuir os atletas automaticamente em Séries (Baterias)."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handlePrintSumula}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-2 border border-slate-200 cursor-pointer shadow-xs"
            >
              <Printer size={16} /> Imprimir Súmula
            </button>
            {!readOnly && (
              <>
                <button
                  onClick={handleSaveResults}
                  disabled={isSavingResults}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Save size={16} /> {isSavingResults ? "Salvando..." : "Salvar Resultados 💾"}
                </button>
                <button
                  onClick={() => {
                    generateBalizamento();
                    success("Balizamento atualizado!");
                  }}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 shadow-sm cursor-pointer"
                >
                  <RefreshCw size={16} /> Recalcular Balizamento
                </button>
              </>
            )}
          </div>
        </div>

        {/* Number of Lanes Selector (2 to 8) - Oculto em modo público readOnly */}
        {!readOnly && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-150">
            <div className="space-y-0.5">
              <span className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                Quantidade de Raias da Piscina
              </span>
              <span className="text-xs text-slate-500">
                Selecione o número de raias disponíveis (2 a 8)
              </span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[2, 3, 4, 5, 6, 7, 8].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setLanesCount(num)}
                  className={`w-10 h-10 rounded-xl font-black text-sm transition-all border cursor-pointer flex items-center justify-center ${
                    lanesCount === num
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100 scale-105"
                      : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Summary Statistics Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-bold">
          <div className="p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center gap-3">
            <Users size={18} className="text-indigo-600 shrink-0" />
            <div>
              <span className="text-slate-400 font-medium block text-[10px] uppercase">Atletas Inscritos</span>
              <span className="text-indigo-950 text-sm font-black">{categoryAthletes.length} Atletas</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-sky-50/50 border border-sky-100 flex items-center gap-3">
            <Waves size={18} className="text-sky-600 shrink-0" />
            <div>
              <span className="text-slate-400 font-medium block text-[10px] uppercase">Raias por Disputa</span>
              <span className="text-sky-950 text-sm font-black">{lanesCount} Raias</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-100 flex items-center gap-3">
            <Trophy size={18} className="text-emerald-600 shrink-0" />
            <div>
              <span className="text-slate-400 font-medium block text-[10px] uppercase">Total de Séries</span>
              <span className="text-emerald-950 text-sm font-black">{heats.length} {heats.length === 1 ? "Série" : "Séries"}</span>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-100 flex items-center gap-3">
            <Clock size={18} className="text-amber-600 shrink-0" />
            <div>
              <span className="text-slate-400 font-medium block text-[10px] uppercase">Ordem de Balizamento</span>
              <span className="text-amber-950 text-xs font-bold truncate">Regra FINA/CBDA</span>
            </div>
          </div>
        </div>
      </div>

      {/* Display Heats / Séries */}
      {(() => {
        const overallRankings = getOverallRankings();

        return (
          <div className="space-y-6">
            {/* Overall Race Classification Table (when results exist and not hidden) */}
            {overallRankings.length > 0 && !hideResults && (
              <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-900 space-y-4 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-800/60 pb-4">
                  <div>
                    <div className="flex items-center gap-2 text-amber-400 font-black text-xs uppercase tracking-widest mb-1">
                      <Trophy size={16} /> Resultado Geral da Prova • Final Direta
                    </div>
                    <h4 className="text-xl font-bold text-white">{category.name}</h4>
                    <p className="text-xs text-slate-300">Classificação final oficial por tempo combinando todas as séries.</p>
                  </div>
                  <div className="px-3.5 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold w-fit">
                    {overallRankings.length} {overallRankings.length === 1 ? "Atleta com resultado" : "Atletas com resultados"}
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-indigo-200 border-b border-indigo-800/50 uppercase font-black tracking-wider text-[10px]">
                        <th className="py-2.5 px-3 w-16 text-center">Posição</th>
                        <th className="py-2.5 px-3">Atleta</th>
                        <th className="py-2.5 px-3">Clube / Entidade</th>
                        <th className="py-2.5 px-3 w-28 text-center">Tempo Final</th>
                        <th className="py-2.5 px-3 w-36 text-center">Origem</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-indigo-900/40">
                      {overallRankings.map((res, i) => (
                        <tr key={res.athleteId} className={i < 3 ? "bg-white/5 font-bold" : "text-slate-300"}>
                          <td className="py-2.5 px-3 text-center">
                            {i === 0 && <span className="inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-indigo-950 font-black text-xs shadow-sm whitespace-nowrap border border-amber-300">1º 🥇</span>}
                            {i === 1 && <span className="inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-slate-200 to-slate-300 text-slate-900 font-black text-xs shadow-sm whitespace-nowrap border border-slate-300">2º 🥈</span>}
                            {i === 2 && <span className="inline-flex items-center justify-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-amber-700 to-amber-800 text-amber-100 font-black text-xs shadow-sm whitespace-nowrap border border-amber-600">3º 🥉</span>}
                            {i > 2 && <span className="font-bold text-slate-400 whitespace-nowrap">{i + 1}º</span>}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-white">{res.athleteName}</td>
                          <td className="py-2.5 px-3 text-slate-300">{res.institutionName}</td>
                          <td className="py-2.5 px-3 text-center font-mono font-black text-amber-300 text-sm">{res.resultTime}</td>
                          <td className="py-2.5 px-3 text-center text-slate-400 text-[11px]">Série {res.heatNumber}, Raia {res.laneNumber}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Display Heats / Séries */}
      {categoryAthletes.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-3xl border-2 border-dashed border-slate-200 space-y-3">
          <Users size={40} className="mx-auto text-slate-300" />
          <h4 className="text-base font-bold text-slate-700">Nenhum atleta confirmado nesta prova</h4>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Assim que os atletas forem inscritos e aprovados nesta categoria, o balizamento de raias será gerado automaticamente.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {heats.map((heat) => (
            <div key={heat.heatNumber} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Heat Header */}
              <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-500 flex items-center justify-center font-black text-white text-xs">
                    #{heat.heatNumber}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Série {heat.heatNumber} de {heats.length}</h4>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Balizamento Oficial • {heat.lanes.filter(l => l.athleteId).length} Atletas em disputa
                    </span>
                  </div>
                </div>

                <span className="text-xs text-slate-400 font-mono">
                  {lanesCount} Raias
                </span>
              </div>

              {/* Lanes Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4 w-16 text-center">Raia</th>
                      <th className="py-3 px-4">Atleta</th>
                      <th className="py-3 px-4">Clube / Entidade</th>
                      <th className="py-3 px-4 w-32 text-center">Tempo Inscrição</th>
                      {!hideResults && <th className="py-3 px-4 w-36">Tempo Final (Obtido)</th>}
                      {!hideResults && <th className="py-3 px-4 w-28 text-center">Classificação</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {heat.lanes.map((lane) => {
                      const isOccupied = !!lane.athleteId;
                      return (
                        <tr
                          key={lane.laneNumber}
                          className={`transition-colors ${
                            isOccupied ? "hover:bg-indigo-50/20" : "bg-slate-50/40 text-slate-300"
                          }`}
                        >
                          {/* Lane Number Badge */}
                          <td className="py-3 px-4 text-center font-black">
                            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs ${
                              lane.laneNumber === 3 || lane.laneNumber === 4
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "bg-slate-100 text-slate-700"
                            }`}>
                              {lane.laneNumber}
                            </span>
                          </td>

                          {/* Athlete Name */}
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {lane.athleteName ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{lane.athleteName}</span>
                                {(() => {
                                  const sub = athleteSubs.find(s => s.id === lane.athleteId);
                                  if (sub?.checkedInAt) {
                                    return (
                                      <span title="Check-in Presencial Realizado" className="text-indigo-600 flex-shrink-0">
                                        <CheckCircle2 size={14} className="stroke-[3px]" />
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            ) : (
                              <span className="text-slate-300 italic font-normal text-xs">Vazia</span>
                            )}
                          </td>

                          {/* Institution */}
                          <td className="py-3 px-4 text-slate-600 font-medium">
                            {lane.institutionName || "—"}
                          </td>

                          {/* Seed Time */}
                          <td className="py-3 px-4 font-mono text-slate-500 font-medium text-center">
                            {lane.seedTime || "--:--.--"}
                          </td>

                          {/* Result Time Input / Text */}
                          {!hideResults && (
                            <td className="py-3 px-4">
                              {isOccupied ? (
                                readOnly ? (
                                  <span className="font-mono font-bold text-slate-700 text-xs">
                                    {editingResults[lane.athleteId!] || lane.resultTime || "--:--.--"}
                                  </span>
                                ) : (
                                  <input
                                    type="text"
                                    inputMode="numeric"
                                    placeholder="Ex: 3250 ou 010530"
                                    value={editingResults[lane.athleteId!] || ""}
                                    onChange={(e) => handleResultChange(lane.athleteId!, e.target.value)}
                                    onBlur={() => {
                                      const currentVal = editingResults[lane.athleteId!] || "";
                                      const finalized = finalizeSwimmingTimeOnBlur(currentVal);
                                      if (finalized !== currentVal) {
                                        handleResultChange(lane.athleteId!, finalized);
                                      }
                                      handleSaveSingleAthleteResult(lane.athleteId!, finalized);
                                    }}
                                    maxLength={8}
                                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs placeholder:text-slate-300"
                                  />
                                )
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          )}

                          {/* Rank Badge */}
                          {!hideResults && (
                            <td className="py-3 px-4 text-center">
                              {isOccupied && lane.athleteId && getRankBadge(lane.athleteId)}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
