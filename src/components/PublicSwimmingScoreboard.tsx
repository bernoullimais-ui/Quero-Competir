import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Waves, Trophy, Clock, CheckCircle2, ChevronRight, Activity } from "lucide-react";

// --- Helpers ---
const parseSeedTimeToMs = (timeStr: string) => {
  if (!timeStr || timeStr === "--:--.--" || timeStr === "S/T") return 99999999;
  const parts = timeStr.replace(',', '.').split(':');
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return (mins * 60 + secs) * 1000;
  }
  return 99999999;
};

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

const generateHeats = (categoryAthletes: any[], lanesCount: number) => {
  if (!categoryAthletes || categoryAthletes.length === 0) return [];

  const laneOrder = getLaneOrder(lanesCount);
  const totalAthletes = categoryAthletes.length;
  const numHeats = Math.max(1, Math.ceil(totalAthletes / lanesCount));

  const fixedAthletes = categoryAthletes.filter(ath => {
    const add = ath.additionalData || ath.additional_data || {};
    return add.manual_heat && add.manual_lane;
  });
  const fixedAthletesIds = new Set(fixedAthletes.map(a => a.id));

  const floatingAthletes = categoryAthletes.filter(ath => !fixedAthletesIds.has(ath.id));
  const sortedFloating = [...floatingAthletes].sort((a, b) => {
    const timeA = parseSeedTimeToMs(a.additionalData?.seed_time || a.additional_data?.seed_time || "S/T");
    const timeB = parseSeedTimeToMs(b.additionalData?.seed_time || b.additional_data?.seed_time || "S/T");
    return timeB - timeA;
  });

  const baseCount = Math.floor(totalAthletes / numHeats);
  const remainder = totalAthletes % numHeats;
  const heatSizes: number[] = [];
  for (let h = 0; h < numHeats; h++) {
    heatSizes.push(baseCount + (h < remainder ? 1 : 0));
  }

  const newHeats: any[] = [];
  let floatingOffset = 0;

  for (let h = 0; h < numHeats; h++) {
    const heatNum = h + 1;
    const laneAssignments = Array.from({ length: lanesCount }, (_, i) => ({
      laneNumber: i + 1,
      athleteId: null,
      athleteName: null,
      institutionName: null,
      seedTime: null,
      resultTime: null
    }));

    const fixedInThisHeat = fixedAthletes.filter(ath => {
      const add = ath.additionalData || ath.additional_data || {};
      return add.manual_heat === heatNum;
    });

    fixedInThisHeat.forEach(ath => {
      const add = ath.additionalData || ath.additional_data || {};
      const lNum = add.manual_lane;
      const laneObj = laneAssignments.find(l => l.laneNumber === lNum);
      if (laneObj) {
        laneObj.athleteId = ath.id;
        laneObj.athleteName = ath.athleteName || ath.full_name || ath.athlete_name;
        laneObj.institutionName = ath.institution?.name || "Avulso";
        laneObj.seedTime = add.seed_time || "S/T";
        laneObj.resultTime = add.result_time || "";
      }
    });

    let numFloatingNeeded = heatSizes[h] - fixedInThisHeat.length;
    if (numFloatingNeeded < 0) numFloatingNeeded = 0;

    const floatingInThisHeat = sortedFloating.slice(floatingOffset, floatingOffset + numFloatingNeeded);
    floatingOffset += numFloatingNeeded;

    floatingInThisHeat.sort((a, b) => {
      const timeA = parseSeedTimeToMs(a.additionalData?.seed_time || a.additional_data?.seed_time || "S/T");
      const timeB = parseSeedTimeToMs(b.additionalData?.seed_time || b.additional_data?.seed_time || "S/T");
      return timeA - timeB;
    });

    let floatIndex = 0;
    for (const targetLaneNum of laneOrder) {
      if (floatIndex >= floatingInThisHeat.length) break;
      const laneObj = laneAssignments.find(l => l.laneNumber === targetLaneNum);
      if (laneObj && !laneObj.athleteId) {
        const ath = floatingInThisHeat[floatIndex];
        laneObj.athleteId = ath.id;
        laneObj.athleteName = ath.athleteName || ath.full_name || ath.athlete_name;
        laneObj.institutionName = ath.institution?.name || "Avulso";
        laneObj.seedTime = ath.additionalData?.seed_time || ath.additional_data?.seed_time || "S/T";
        laneObj.resultTime = ath.additionalData?.result_time || ath.additional_data?.result_time || "";
        floatIndex++;
      }
    }

    newHeats.push({
      heatNumber: heatNum,
      lanes: laneAssignments
    });
  }
  return newHeats;
};

// --- Main Component ---
export default function PublicSwimmingScoreboard() {
  const { id } = useParams();
  const [tournament, setTournament] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [athleteSubs, setAthleteSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [tRes, cRes, aRes] = await Promise.all([
        fetch(`/api/tournaments/${id}`),
        fetch(`/api/tournaments/${id}/categories`),
        fetch(`/api/tournaments/${id}/athlete-subscriptions`)
      ]);
      const [tData, cData, aData] = await Promise.all([tRes.json(), cRes.json(), aRes.json()]);
      
      setTournament(tData);
      
      // Filter swimming categories and sort
      const isSwimmingTournament = tData?.name?.toLowerCase().includes("natação") || tData?.name?.toLowerCase().includes("natacao");
      
      const swimCats = (cData || []).filter((c: any) => 
        isSwimmingTournament ||
        c.rules_config?.sport_type === "swimming" || 
        c.name?.toLowerCase().includes("natação") || 
        c.name?.toLowerCase().includes("natacao") ||
        c.name?.toLowerCase().includes("nado") ||
        c.name?.toLowerCase().includes("costa") ||
        c.name?.toLowerCase().includes("borboleta") ||
        c.name?.toLowerCase().includes("peito") ||
        c.name?.toLowerCase().includes("medley") ||
        c.name?.toLowerCase().includes("revezamento")
      ).sort((a: any, b: any) => {
        const orderA = a.rules_config?.display_order ?? a.display_order ?? 9999;
        const orderB = b.rules_config?.display_order ?? b.display_order ?? 9999;
        return orderA - orderB;
      });
      setCategories(swimCats);

      // Map institutions for athletes if available
      const validSubs = (aData || []).filter((s: any) => 
        s.validationStatus === "approved" || s.validation_status === "approved" || s.isCompleted || s.is_completed || !s.validationStatus
      );
      setAthleteSubs(validSubs);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white font-bold text-xl">Carregando Placar...</div>;
  }

  const lanesCount = tournament?.rules_config?.swimming_lanes_count || 6;

  // Process status for each category
  const categoriesWithStatus = categories.map(cat => {
    const athletes = athleteSubs.filter(s => s.categoryId === cat.id || s.category_id === cat.id);
    const total = athletes.length;
    const withTime = athletes.filter(a => a.additionalData?.result_time || a.additional_data?.result_time).length;
    
    let status = "pending";
    if (total > 0 && withTime === total) status = "finished";
    else if (total > 0 && withTime > 0) status = "progress";
    else if (total === 0) status = "empty";

    return { ...cat, status, athletesCount: total, withTimeCount: withTime, athletes };
  });

  // Find Current, Last and Next
  let eventToHighlight = [...categoriesWithStatus].reverse().find(c => c.withTimeCount > 0);
  let nextEvent = null;

  if (eventToHighlight) {
    if (eventToHighlight.status === 'finished') {
      // If the top highlighted event is finished, the next event is the first pending/progress one
      nextEvent = categoriesWithStatus.find(c => (c.status === 'pending' || c.status === 'progress') && c.athletesCount > 0);
    } else {
      // If the top highlighted event is in progress, the next event is the one strictly AFTER it
      const idx = categoriesWithStatus.findIndex(c => c.id === eventToHighlight.id);
      nextEvent = categoriesWithStatus.slice(idx + 1).find(c => c.athletesCount > 0);
    }
  } else {
    // No results at all yet
    eventToHighlight = null;
    nextEvent = categoriesWithStatus.find(c => c.athletesCount > 0);
  }

  // Define currentEvent explicitly for sidebar styling
  let currentEventIndex = categoriesWithStatus.findIndex(c => c.status === "progress");
  if (currentEventIndex === -1) {
    currentEventIndex = categoriesWithStatus.findIndex(c => c.status === "pending" && c.athletesCount > 0);
  }
  const currentEvent = currentEventIndex !== -1 ? categoriesWithStatus[currentEventIndex] : null;

  // Generate view data for main focus
  const highlightHeats = eventToHighlight ? generateHeats(eventToHighlight.athletes, lanesCount) : [];
  const nextHeats = nextEvent ? generateHeats(nextEvent.athletes, lanesCount) : [];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-slate-200 font-sans flex flex-col md:flex-row">
      {/* Sidebar - Ordem das Provas */}
      <div className="w-full md:w-80 bg-[#121212] border-r border-slate-800 flex flex-col h-screen overflow-y-auto hidden-scrollbar">
        <div className="p-6 sticky top-0 bg-[#121212]/90 backdrop-blur z-10 border-b border-slate-800">
          <h1 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <Activity className="text-emerald-500" />
            Placar Ao Vivo
          </h1>
          <p className="text-slate-500 text-sm mt-1 truncate">{tournament?.name}</p>
        </div>
        
        <div className="p-4 space-y-2">
          {categoriesWithStatus.map((cat, idx) => {
            if (cat.status === "empty") return null;
            const isCurrent = currentEvent?.id === cat.id;
            const isNext = nextEvent?.id === cat.id;
            
            return (
              <div 
                key={cat.id} 
                className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                  isCurrent ? 'bg-indigo-900/40 border-indigo-500/50' : 
                  cat.status === 'finished' ? 'bg-[#1A1A1A] border-slate-800' :
                  'bg-[#1A1A1A]/50 border-slate-800/50'
                }`}
              >
                <div>
                  <div className="text-[10px] font-bold tracking-wider text-slate-500 uppercase mb-1">Prova {idx + 1}</div>
                  <h3 className={`font-bold text-sm ${isCurrent ? 'text-indigo-300' : cat.status === 'finished' ? 'text-slate-400' : 'text-slate-300'}`}>
                    {cat.name} <span className="opacity-70 font-normal">({cat.gender})</span>
                  </h3>
                </div>
                <div>
                  {cat.status === "finished" && <CheckCircle2 className="text-emerald-600" size={18} />}
                  {isCurrent && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>}
                  {isNext && <ChevronRight className="text-slate-600" size={18} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 h-screen overflow-y-auto p-4 md:p-8 space-y-8 bg-gradient-to-br from-[#0A0A0A] to-[#121212]">
        
        {/* EVENTO EM DESTAQUE (Atual ou Último) */}
        {eventToHighlight ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-8 bg-indigo-500 rounded-full"></div>
              <div>
                <h2 className="text-2xl font-black text-white uppercase tracking-wide">
                  {eventToHighlight.status === 'finished' ? 'Resultados Finais' : 'Prova em Andamento'}
                </h2>
                <p className="text-indigo-400 font-medium">{eventToHighlight.name} • {eventToHighlight.gender} {eventToHighlight.age_group}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Ranking Geral em Tempo Real */}
              <div className="bg-[#1A1A1A] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                <div className="bg-[#222] p-4 border-b border-slate-800 flex justify-between items-center">
                  <h3 className="font-bold text-white flex items-center gap-2"><Trophy size={16} className="text-amber-500" /> Classificação Geral</h3>
                  <span className="text-xs text-slate-500 bg-[#111] px-2 py-1 rounded font-mono">
                    {eventToHighlight.withTimeCount} de {eventToHighlight.athletesCount} Tempos
                  </span>
                </div>
                <div className="flex-1 p-0 overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[#1A1A1A] text-slate-500 text-xs border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4 w-12 text-center">Pos</th>
                        <th className="py-3 px-4">Atleta</th>
                        <th className="py-3 px-4 text-right">Tempo Final</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {eventToHighlight.athletes
                        .filter((a: any) => a.additionalData?.result_time || a.additional_data?.result_time)
                        .sort((a: any, b: any) => parseSeedTimeToMs(a.additionalData?.result_time || a.additional_data?.result_time) - parseSeedTimeToMs(b.additionalData?.result_time || b.additional_data?.result_time))
                        .map((ath: any, index: number) => {
                          const time = ath.additionalData?.result_time || ath.additional_data?.result_time;
                          return (
                            <tr key={ath.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 px-4 text-center">
                                {index === 0 ? <span className="w-6 h-6 inline-flex items-center justify-center bg-amber-500/20 text-amber-500 rounded-full font-black text-xs">1</span> :
                                 index === 1 ? <span className="w-6 h-6 inline-flex items-center justify-center bg-slate-300/20 text-slate-300 rounded-full font-black text-xs">2</span> :
                                 index === 2 ? <span className="w-6 h-6 inline-flex items-center justify-center bg-orange-700/20 text-orange-500 rounded-full font-black text-xs">3</span> :
                                 <span className="text-slate-500 font-bold">{index + 1}</span>}
                              </td>
                              <td className="py-3 px-4 font-bold text-slate-200">{ath.athleteName || ath.full_name || ath.athlete_name}</td>
                              <td className="py-3 px-4 font-mono font-bold text-emerald-400 text-right">{time}</td>
                            </tr>
                          );
                        })}
                      {eventToHighlight.withTimeCount === 0 && (
                        <tr><td colSpan={3} className="py-8 text-center text-slate-600">Aguardando resultados...</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Baterias Parciais */}
              <div className="space-y-6">
                {highlightHeats.map((heat: any) => {
                  const hasResults = heat.lanes.some((l: any) => l.resultTime);
                  return (
                    <div key={heat.heatNumber} className={`border rounded-2xl overflow-hidden ${hasResults ? 'bg-[#1A1A1A] border-slate-800' : 'bg-[#1A1A1A]/50 border-slate-800/50'}`}>
                      <div className="bg-[#222] p-3 border-b border-slate-800 flex justify-between items-center">
                        <h4 className="font-bold text-slate-300 text-sm">Série {heat.heatNumber} de {highlightHeats.length}</h4>
                        {hasResults && <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded font-bold uppercase">Tempo Registrado</span>}
                      </div>
                      <table className="w-full text-left text-xs whitespace-nowrap">
                        <tbody className="divide-y divide-slate-800/30">
                          {heat.lanes.map((l: any) => (
                            <tr key={l.laneNumber} className={l.resultTime ? 'bg-emerald-900/10' : ''}>
                              <td className="py-2 px-3 w-8 text-center text-slate-600 font-black bg-black/20 border-r border-slate-800">{l.laneNumber}</td>
                              <td className="py-2 px-3 text-slate-300 font-medium truncate">{l.athleteName || <span className="text-slate-700">Vazia</span>}</td>
                              <td className="py-2 px-3 font-mono font-bold text-right text-emerald-400">{l.resultTime || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-20 text-center text-slate-600 font-medium">Nenhuma prova iniciada ainda.</div>
        )}

        {/* PRÓXIMA PROVA */}
        {nextEvent && (
          <div className="pt-8 border-t border-slate-800 space-y-6">
            <div className="flex items-center gap-3 opacity-80">
              <div className="w-1.5 h-6 bg-slate-600 rounded-full"></div>
              <div>
                <h2 className="text-xl font-black text-slate-400 uppercase tracking-wide">Próxima Prova</h2>
                <p className="text-slate-500 text-sm font-medium">{nextEvent.name} • {nextEvent.gender} {nextEvent.age_group}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {nextHeats.map((heat: any) => (
                <div key={heat.heatNumber} className="bg-[#151515] border border-slate-800/50 rounded-xl overflow-hidden opacity-80">
                  <div className="bg-[#1A1A1A] px-3 py-2 border-b border-slate-800/50">
                    <span className="font-bold text-slate-400 text-xs uppercase">Série {heat.heatNumber}</span>
                  </div>
                  <table className="w-full text-left text-xs">
                    <tbody className="divide-y divide-slate-800/30">
                      {heat.lanes.map((l: any) => (
                        <tr key={l.laneNumber}>
                          <td className="py-1.5 px-3 w-8 text-center text-slate-600 font-black bg-black/20 border-r border-slate-800">{l.laneNumber}</td>
                          <td className="py-1.5 px-3 text-slate-400 truncate">{l.athleteName || <span className="text-slate-700 italic">Livre</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
