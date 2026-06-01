import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Timer, Trophy, Calendar, MapPin } from "lucide-react";

interface Props {
  tournamentId: string;
  categoryId: string;
  groupCount: number;
  disputeSystem: string;
  selectedSubdivision?: string;
}

export default function TournamentBracket({ tournamentId, categoryId, selectedSubdivision }: Props) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tournaments/${tournamentId}/categories/${categoryId}/matches`)
      .then(r => r.json())
      .then(data => {
        setMatches(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [tournamentId, categoryId]);

  const formatMatchDateTime = (dateTimeStr: string | null | undefined) => {
    if (!dateTimeStr) return { date: "A definir", time: "A definir" };
    try {
      const regexMatch = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (!regexMatch) return { date: "A definir", time: "A definir" };
      const [_, year, month, day, hour, minute] = regexMatch;
      const date = `${day}/${month}/${year}`;
      const time = `${hour}:${minute}`;
      return { date, time };
    } catch (e) {
      return { date: "A definir", time: "A definir" };
    }
  };

  const getTeamName = (match: any, isTeam1: boolean) => {
    if (isTeam1) {
      return match.roster1?.athlete_name 
        ? `${match.roster1.athlete_name} (${match.roster1.institution_name})` 
        : (match.team1?.institution?.name || "Aguardando...");
    } else {
      return match.roster2?.athlete_name 
        ? `${match.roster2.athlete_name} (${match.roster2.institution_name})` 
        : (match.team2?.institution?.name || "Aguardando...");
    }
  };

  const getTeamLogo = (match: any, isTeam1: boolean) => {
    if (isTeam1) {
      return match.team1?.institution?.logo_url || "";
    } else {
      return match.team2?.institution?.logo_url || "";
    }
  };

  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    return selectedSubdivision
      ? matches.filter(m => m.group_label === selectedSubdivision || m.group_label?.startsWith(`${selectedSubdivision} - `))
      : matches;
  }, [matches, selectedSubdivision]);

  // Obter lista única de equipes para filtro
  const uniqueTeams = useMemo(() => {
    const teamsMap = new Map<string, string>();
    filteredMatches.forEach(m => {
      const name1 = getTeamName(m, true);
      if (name1 && name1 !== "Aguardando...") {
        teamsMap.set(name1, name1);
      }
      const name2 = getTeamName(m, false);
      if (name2 && name2 !== "Aguardando...") {
        teamsMap.set(name2, name2);
      }
    });
    return Array.from(teamsMap.keys()).sort();
  }, [filteredMatches]);

  const sortedMatches = useMemo(() => {
    return [...filteredMatches].sort((a, b) => {
      if (a.scheduled_time && b.scheduled_time) {
        return a.scheduled_time.localeCompare(b.scheduled_time);
      }
      if (a.scheduled_time) return -1;
      if (b.scheduled_time) return 1;
      if (a.round !== b.round) return a.round - b.round;
      return a.match_index - b.match_index;
    });
  }, [filteredMatches]);

  const finalFilteredMatches = useMemo(() => {
    return sortedMatches.filter(match => {
      if (!selectedTeamFilter) return true;
      const t1 = getTeamName(match, true);
      const t2 = getTeamName(match, false);
      return t1 === selectedTeamFilter || t2 === selectedTeamFilter;
    });
  }, [sortedMatches, selectedTeamFilter]);

  if (loading) {
    return <div className="text-center py-8 text-slate-400 text-sm font-medium">Carregando jogos...</div>;
  }

  if (matches.length === 0) {
    return <div className="text-center py-8 text-slate-400 text-sm font-medium">Os jogos desta categoria ainda não foram gerados.</div>;
  }

  if (filteredMatches.length === 0) {
    return <div className="text-center py-8 text-slate-400 text-sm font-medium">Nenhum jogo gerado para a subdivisão selecionada.</div>;
  }

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-300">
      {/* Barra de Filtro de Equipe */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
        <h3 className="text-sm font-black text-slate-450 uppercase tracking-widest">
          Lista de Jogos
        </h3>
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Escolher Equipe:</span>
          <select
            value={selectedTeamFilter}
            onChange={(e) => setSelectedTeamFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-500 font-semibold text-slate-650 bg-white min-w-[200px]"
          >
            <option value="">Todas as Equipes</option>
            {uniqueTeams.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
        </div>
      </div>

      {finalFilteredMatches.length === 0 ? (
        <div className="text-center py-12 text-slate-450 font-medium">Nenhum jogo agendado para a equipe selecionada.</div>
      ) : (
        <div className="space-y-4">
          {finalFilteredMatches.map(match => {
            const { date, time } = formatMatchDateTime(match.scheduled_time);
            const venueName = match.venue?.name || "A definir";
            const courtName = match.court ? ` - ${match.court}` : "";
            
            const t1Name = getTeamName(match, true);
            const t2Name = getTeamName(match, false);
            
            const t1Logo = getTeamLogo(match, true);
            const t2Logo = getTeamLogo(match, false);
            
            const isT1Winner = match.winner_id === match.team1_id && match.team1_id;
            const isT2Winner = match.winner_id === match.team2_id && match.team2_id;

            return (
              <div 
                key={match.id}
                className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                {/* Info do Jogo (Data, Hora, Local) */}
                <div className="space-y-1.5 md:w-1/4">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-slate-100 text-[10px] font-black text-slate-500 rounded-full uppercase tracking-wider">
                      {match.group_label ? `Grupo ${match.group_label}` : `Rodada ${match.round}`}
                    </span>
                    {match.is_timer_running && (
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-full animate-pulse border border-emerald-100">
                        <Timer size={10} /> Ao vivo
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-slate-500 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Calendar size={13} className="text-slate-400" />
                      {date} às {time}
                    </span>
                    <span className="flex items-center gap-1.5 truncate" title={venueName + courtName}>
                      <MapPin size={13} className="text-slate-400" />
                      {venueName}{courtName}
                    </span>
                  </div>
                </div>

                {/* Confronto e Placar */}
                <div className="flex items-center justify-center gap-4 flex-1">
                  {/* Time 1 */}
                  <div className="flex items-center gap-3 justify-end text-right flex-1 min-w-0">
                    <span className={`font-bold text-sm text-slate-800 truncate ${isT1Winner ? "text-indigo-650 font-black" : ""}`} title={t1Name}>
                      {t1Name}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/60 overflow-hidden flex items-center justify-center shrink-0">
                      {t1Logo ? (
                        <img src={t1Logo} alt={t1Name} className="w-full h-full object-contain p-0.5" onError={(e: any) => e.target.style.display = 'none'} />
                      ) : (
                        <Trophy size={16} className="text-slate-400" />
                      )}
                    </div>
                  </div>

                  {/* Placar */}
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-black text-base px-2.5 py-1 bg-slate-50 border border-slate-150 rounded-xl w-10 text-center ${isT1Winner ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}`}>
                      {match.score1 ?? "-"}
                    </span>
                    <span className="text-[10px] font-black text-slate-350 uppercase">x</span>
                    <span className={`font-mono font-black text-base px-2.5 py-1 bg-slate-50 border border-slate-150 rounded-xl w-10 text-center ${isT2Winner ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}`}>
                      {match.score2 ?? "-"}
                    </span>
                  </div>

                  {/* Time 2 */}
                  <div className="flex items-center gap-3 justify-start text-left flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200/60 overflow-hidden flex items-center justify-center shrink-0">
                      {t2Logo ? (
                        <img src={t2Logo} alt={t2Name} className="w-full h-full object-contain p-0.5" onError={(e: any) => e.target.style.display = 'none'} />
                      ) : (
                        <Trophy size={16} className="text-slate-400" />
                      )}
                    </div>
                    <span className={`font-bold text-sm text-slate-800 truncate ${isT2Winner ? "text-indigo-650 font-black" : ""}`} title={t2Name}>
                      {t2Name}
                    </span>
                  </div>
                </div>

                {/* Status e Ação */}
                <div className="md:w-1/5 flex justify-end items-center">
                  {match.status === "finished" ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-[10px] font-bold text-emerald-700 border border-emerald-200 rounded-full">
                        Finalizado
                      </span>
                      <Link to={`/public/match/${match.id}`} className="text-[10px] font-bold text-indigo-650 uppercase tracking-wider hover:text-indigo-800 transition-colors">
                        Súmula do Jogo
                      </Link>
                    </div>
                  ) : (
                    <span className="px-2.5 py-0.5 bg-slate-50 text-[10px] font-bold text-slate-400 border border-slate-100 rounded-full">
                      Agendado
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
