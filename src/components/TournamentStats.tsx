import React, { useEffect, useState } from "react";
import { Users, Shield, ArrowUp, ArrowDown, Activity, Award } from "lucide-react";
import { motion } from "motion/react";

interface Props {
  tournamentId: string;
}

export default function TournamentStats({ tournamentId }: Props) {
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>("");
  const [stats, setStats] = useState<any>({
    topScorers: [],
    bestOffenses: [],
    bestDefenses: [],
    cards: []
  });
  const [loading, setLoading] = useState(false);

  const parseLocalTime = (scheduledTime: string) => {
    const regexMatch = scheduledTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (!regexMatch) return null;
    const [_, year, month, day, hour, minute] = regexMatch;
    return new Date(
      parseInt(year, 10),
      parseInt(month, 10) - 1,
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10)
    );
  };

  useEffect(() => {
    fetch(`/api/tournaments/${tournamentId}/categories`)
      .then(res => res.json())
      .then(data => {
        setCategories(data);
        if (data.length > 0) {
          setSelectedCat(data[0].id);
        }
      });
  }, [tournamentId]);

  useEffect(() => {
    if (!selectedCat) return;
    setLoading(true);
    fetch(`/api/tournaments/${tournamentId}/categories/${selectedCat}/stats`)
      .then(r => r.json())
      .then(data => {
        setStats(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [tournamentId, selectedCat]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">Estatísticas</h2>
          <p className="text-slate-500 font-medium">Artilharia, defesas e dados da categoria</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setSelectedCat(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${
                selectedCat === cat.id 
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" 
                : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200"
              }`}
            >
              {cat.name} {cat.gender || cat.age_group ? `(${[cat.gender, cat.age_group].filter(Boolean).join(" ")})` : ""}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Col 1: Artilharia e MVPs */}
          <div className="lg:col-span-1 space-y-6">
            {/* Top Scorers */}
            <div className="border border-slate-200 rounded-3xl bg-white shadow-sm overflow-hidden flex flex-col h-fit">
              <div className="p-6 border-b border-slate-100 bg-emerald-50">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600">
                    <Award size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-emerald-900 text-lg">Artilharia</h3>
                    <p className="text-emerald-700 text-xs">Maiores goleadores</p>
                  </div>
                </div>
              </div>
              <div className="p-0">
                {stats.topScorers?.length > 0 ? stats.topScorers.slice(0, 5).map((player: any, idx: number) => (
                  <div key={player.id} className="flex items-center gap-4 p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                      idx === 0 ? "bg-amber-100 text-amber-700" :
                      idx === 1 ? "bg-slate-200 text-slate-700" :
                      idx === 2 ? "bg-orange-100 text-orange-800" :
                      "bg-slate-50 text-slate-400"
                    }`}>
                      {idx + 1}º
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 text-sm truncate">{player.name}</p>
                      <p className="text-xs text-slate-500 truncate">{player.teamName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-lg text-indigo-600">{player.goals}</p>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Gols</p>
                    </div>
                  </div>
                )) : (
                  <div className="p-8 text-center text-slate-400 italic text-sm">Nenhum evento registrado.</div>
                )}
              </div>
            </div>

            {/* MVPs */}
            <div className="border border-slate-200 rounded-3xl bg-white shadow-sm overflow-hidden flex flex-col h-fit">
              <div className="p-6 border-b border-slate-100 bg-amber-50">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-100 p-2 rounded-xl text-amber-600">
                    <Activity size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-amber-900 text-lg">Melhores Jogadores</h3>
                    <p className="text-amber-700 text-xs">Indicações da arbitragem (MVP)</p>
                  </div>
                </div>
              </div>
              <div className="p-0">
                {stats.topMvps?.length > 0 ? stats.topMvps.map((player: any, idx: number) => (
                  <div key={player.id} className="flex items-center gap-4 p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                      idx === 0 ? "bg-amber-100 text-amber-700" :
                      "bg-slate-50 text-slate-400"
                    }`}>
                      {idx + 1}º
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-800 text-sm truncate">{player.name}</p>
                      {player.teamName && (
                        <p className="text-xs text-slate-500 truncate">{player.teamName}</p>
                      )}
                      <p className="text-[10px] text-slate-400 font-semibold mt-0.5">{player.count === 1 ? "1 Indicação" : `${player.count} Indicações`}</p>
                    </div>
                    <div className="text-right">
                      <Award className="text-amber-500" size={20} />
                    </div>
                  </div>
                )) : (
                  <div className="p-8 text-center text-slate-400 italic text-sm">Nenhum MVP registrado.</div>
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            
            {/* Melhor Ataque */}
            <div className="border border-slate-200 rounded-3xl bg-white shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                <div className="bg-indigo-50 p-2 rounded-xl text-indigo-600">
                  <ArrowUp size={20} />
                </div>
                <h3 className="font-bold text-slate-800">Melhores Ataques</h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats.bestOffenses?.length > 0 ? stats.bestOffenses.slice(0, 4).map((team: any, i: number) => (
                  <div key={team.id} className="flex flex-col bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <span className="text-xs font-bold text-slate-400 mb-1">{i + 1}º Lugar</span>
                    <span className="font-bold text-slate-800 text-sm truncate">{team.name}</span>
                    <div className="mt-4 flex items-end justify-between">
                      <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">Gols Pró</span>
                      <span className="font-black text-2xl text-indigo-600 leading-none">{team.goalsFor}</span>
                    </div>
                  </div>
                )) : (
                  <div className="text-slate-400 italic text-sm">Dados insuficientes.</div>
                )}
              </div>
            </div>

            {/* Melhor Defesa */}
            <div className="border border-slate-200 rounded-3xl bg-white shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                <div className="bg-red-50 p-2 rounded-xl text-red-600">
                  <Shield size={20} />
                </div>
                <h3 className="font-bold text-slate-800">Melhores Defesas</h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {stats.bestDefenses?.length > 0 ? stats.bestDefenses.slice(0, 4).map((team: any, i: number) => (
                  <div key={team.id} className="flex flex-col bg-slate-50 rounded-2xl p-4 border border-slate-100">
                    <span className="text-xs font-bold text-slate-400 mb-1">{i + 1}º Lugar</span>
                    <span className="font-bold text-slate-800 text-sm truncate">{team.name}</span>
                    <div className="mt-4 flex items-end justify-between">
                      <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">Gols Sofridos</span>
                      <span className="font-black text-2xl text-red-600 leading-none">{team.goalsAgainst}</span>
                    </div>
                  </div>
                )) : (
                  <div className="text-slate-400 italic text-sm">Dados insuficientes.</div>
                )}
              </div>
            </div>

            {/* Controle de Cartões */}
            <div className="border border-slate-200 rounded-3xl bg-white shadow-sm overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-50 p-2 rounded-xl text-amber-600 flex items-center gap-0.5">
                    <div className="w-3 h-4 bg-amber-400 rounded-sm shadow-xs" />
                    <div className="w-3 h-4 bg-red-500 rounded-sm shadow-xs -ml-1.5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">Cartões Amarelos e Vermelhos</h3>
                    <p className="text-slate-500 text-xs">Histórico de atletas advertidos e suspensos</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
                  <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-100">
                    <span className="w-2 h-3 bg-amber-400 rounded-xs" />
                    A: {stats.cards?.filter((c: any) => c.cardType === 'yellow').length || 0}
                  </span>
                  <span className="flex items-center gap-1.5 bg-red-50 text-red-700 px-2.5 py-1 rounded-lg border border-red-100">
                    <span className="w-2 h-3 bg-red-500 rounded-xs" />
                    V: {stats.cards?.filter((c: any) => c.cardType === 'red').length || 0}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Jogador</th>
                      <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cartão</th>
                      <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Rodada</th>
                      <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data do Jogo</th>
                      <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Times</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700">
                    {stats.cards?.length > 0 ? (
                      stats.cards.map((card: any) => {
                        const localDate = card.gameDate ? parseLocalTime(card.gameDate) : null;
                        const dateFormatted = localDate
                          ? localDate.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
                          : "A definir";
                        return (
                          <tr key={card.id} className="hover:bg-slate-50/40 transition-colors">
                            <td className="px-6 py-4">
                              <span className="font-bold text-slate-800 text-sm block">{card.playerName}</span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex justify-center">
                                <span className={`inline-block w-3.5 h-4.5 rounded ${card.cardType === 'yellow' ? 'bg-amber-400 shadow-xs' : 'bg-red-500 shadow-xs'}`} title={card.cardType === 'yellow' ? "Amarelo" : "Vermelho"} />
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                {card.round !== null ? `${card.round}ª Rodada` : '-'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs text-slate-600 font-medium">{dateFormatted}</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs text-slate-500 font-medium block truncate max-w-[200px]" title={card.teams}>
                                {card.teams}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium italic text-sm">
                          Nenhum cartão registrado nesta categoria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
