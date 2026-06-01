import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Trophy, Shield, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../lib/supabaseClient.ts';

export default function PublicScoreboard() {
  const { matchId } = useParams();
  const [match, setMatch] = useState<any>(null);
  const [time, setTime] = useState(0);
  const [loading, setLoading] = useState(true);

  const [events, setEvents] = useState<any[]>([]);

  // Judo Osaekomi State
  const [osaekomiTime, setOsaekomiTime] = useState(0);
  const [osaekomiActive, setOsaekomiActive] = useState(false);
  const [osaekomiTeamId, setOsaekomiTeamId] = useState<string | null>(null);

  useEffect(() => {
    const judoState = match?.sets_detail?.[0];
    if (judoState && judoState.osaekomi_team_id && judoState.osaekomi_start_time) {
      const start = new Date(judoState.osaekomi_start_time).getTime();
      const now = new Date().getTime();
      const diff = Math.floor((now - start) / 1000);
      setOsaekomiTime((judoState.osaekomi_base_seconds || 0) + diff);
      setOsaekomiActive(true);
      setOsaekomiTeamId(judoState.osaekomi_team_id);
    } else {
      setOsaekomiTime(judoState?.osaekomi_base_seconds || 0);
      setOsaekomiActive(false);
      setOsaekomiTeamId(null);
    }
  }, [match?.sets_detail]);

  // Local tick for Osaekomi
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (osaekomiActive) {
      interval = setInterval(() => {
        setOsaekomiTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [osaekomiActive]);

  const getSportType = (categoryName: string) => {
    const name = categoryName?.toLowerCase() || '';
    if (name.includes('basquete') || name.includes('basketball')) return 'basketball';
    if (name.includes('vôlei') || name.includes('voleibol') || name.includes('volleyball')) return 'volleyball';
    if (name.includes('handebol') || name.includes('handball')) return 'handball';
    if (name.includes('baleado') || name.includes('queimada') || name.includes('dodgeball')) return 'dodgeball';
    if (name.includes('futsal')) return 'futsal';
    if (name.includes('judô') || name.includes('judo')) return 'judo';
    if (name.includes('karatê') || name.includes('karate')) return 'karate';
    return 'football';
  };

  const getTeamDisplayName = (matchObj: any, teamNum: 1 | 2) => {
    if (!matchObj) return teamNum === 1 ? "Mandante" : "Visitante";
    const roster = teamNum === 1 ? matchObj.roster1 : matchObj.roster2;
    const institutionName = teamNum === 1 ? matchObj.team1?.institution?.name : matchObj.team2?.institution?.name;
    if (roster && roster.athlete_name) {
      return roster.athlete_name + (institutionName ? ` (${institutionName})` : '');
    }
    return institutionName || (teamNum === 1 ? "Mandante" : "Visitante");
  };

  const fetchEvents = async () => {
    try {
      const res = await fetch(`/api/tournaments/matches/${matchId}/events`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error("Error fetching events:", err);
    }
  };

  const getAccumulatedFouls = (teamId: string) => {
    const currentPeriod = match?.period || '1º Tempo';
    return events.filter(e => 
      e.team_id === teamId && 
      e.event_type === 'foul' && 
      (e.period === currentPeriod || (!e.period && currentPeriod === '1º Tempo'))
    ).length;
  };

  const sportType = getSportType(match?.category?.name);

  const judoState = sportType === 'judo' ? (match?.sets_detail?.[0] || {
    team1_ippon: 0, team1_wazaari: 0, team1_yuko: 0, team1_shido: 0,
    team2_ippon: 0, team2_wazaari: 0, team2_yuko: 0, team2_shido: 0,
    osaekomi_team_id: null, osaekomi_start_time: null, osaekomi_base_seconds: 0,
    golden_score: false
  }) : null;

  const karateState = sportType === 'karate' ? (match?.sets_detail?.[0] || {
    team1_senshu: false, team2_senshu: false,
    team1_warnings: 0, team2_warnings: 0
  }) : null;

  const sets = match?.sets_detail || [];
  
  const isSetBased = sportType === 'volleyball' || sportType === 'dodgeball';
  const isMatchFinished = match?.status === 'finished';
  
  let currentSetScore1 = match?.score1 ?? 0;
  let currentSetScore2 = match?.score2 ?? 0;
  let setsWon1 = 0;
  let setsWon2 = 0;
  let completedSets: any[] = [];
  
  if (isSetBased) {
    setsWon1 = match?.score1 ?? 0;
    setsWon2 = match?.score2 ?? 0;
    
    if (isMatchFinished) {
      currentSetScore1 = setsWon1;
      currentSetScore2 = setsWon2;
      completedSets = sets;
    } else {
      if (sets.length > 0) {
        const activeSet = sets[sets.length - 1];
        if (sportType === 'dodgeball') {
          currentSetScore1 = Math.max(0, 10 - (activeSet.team2 ?? 0));
          currentSetScore2 = Math.max(0, 10 - (activeSet.team1 ?? 0));
        } else {
          currentSetScore1 = activeSet.team1 ?? 0;
          currentSetScore2 = activeSet.team2 ?? 0;
        }
        completedSets = sets.slice(0, sets.length - 1);
      } else {
        currentSetScore1 = sportType === 'dodgeball' ? 10 : 0;
        currentSetScore2 = sportType === 'dodgeball' ? 10 : 0;
        completedSets = [];
      }
    }
  }

  const fetchScore = async () => {
    try {
      const res = await fetch(`/api/tournaments/match/${matchId}`);
      const data = await res.json();
      if (res.ok) {
        setMatch(data);
        // Recalcular tempo base
        if (data.is_timer_running && data.timer_last_started_at) {
          const start = new Date(data.timer_last_started_at).getTime();
          const now = new Date().getTime();
          const diff = Math.floor((now - start) / 1000);
          setTime((data.timer_base_seconds || 0) + diff);
        } else {
          setTime(data.timer_base_seconds || 0);
        }
      }
    } catch (err) {
      console.error("Error fetching score:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScore();
    fetchEvents();
    const interval = setInterval(() => {
      fetchScore();
      fetchEvents();
    }, 10000); // reduced polling fallback
    return () => clearInterval(interval);
  }, [matchId]);

  useEffect(() => {
    // Realtime subscription
    if (!matchId) return;
    
    const channel = supabase
      .channel(`match_${matchId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${matchId}` },
        (payload) => {
          setMatch((prev: any) => {
            const updatedMatch = { ...prev, ...payload.new };
            
            if (updatedMatch.is_timer_running && updatedMatch.timer_last_started_at) {
              const start = new Date(updatedMatch.timer_last_started_at).getTime();
              const now = new Date().getTime();
              const diff = Math.floor((now - start) / 1000);
              setTime((updatedMatch.timer_base_seconds || 0) + diff);
            } else {
              setTime(updatedMatch.timer_base_seconds || 0);
            }
            return updatedMatch;
          });
        }
      )
      .subscribe();

    const eventsChannel = supabase
      .channel(`match_events_${matchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'match_events', filter: `match_id=eq.${matchId}` },
        () => {
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(eventsChannel);
    };
  }, [matchId]);

  // Timer local para suavidade
  useEffect(() => {
    let timerInterval: NodeJS.Timeout;
    if (match?.is_timer_running) {
      timerInterval = setInterval(() => {
        setTime(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  }, [match?.is_timer_running]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="animate-pulse text-indigo-400 font-black tracking-widest uppercase">Carregando Placar...</div>
    </div>
  );

  if (!match) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
      Partida não encontrada.
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 lg:p-12 overflow-hidden select-none">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 mb-12 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-6">
          <Trophy size={16} className="text-amber-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300">
            {[match.tournament?.name, match.category?.name, match.category?.gender, match.category?.age_group].filter(Boolean).join(" • ")}
          </span>
        </div>
        <h1 className="text-2xl lg:text-3xl font-black uppercase tracking-tighter text-slate-400">
          {match.group_label ? `Grupo ${match.group_label}` : "Fase Final"} - Rodada {match.round || "1"}
        </h1>
        {(() => {
          const displayPeriod = match.period === '1º Tempo' && (sportType === 'volleyball' || sportType === 'dodgeball')
            ? '1º Set'
            : match.period === '1º Tempo' && sportType === 'basketball'
              ? '1º Quarto'
              : match.period;
          return displayPeriod ? (
            <div className="mt-4 inline-block px-4 py-1.5 bg-indigo-500/20 border border-indigo-500/30 rounded-lg">
              <span className="text-indigo-400 text-sm font-black uppercase tracking-[0.2em]">
                {displayPeriod}
              </span>
            </div>
          ) : null;
        })()}
      </div>

      {/* Main Scoreboard */}
      {sportType === 'judo' && judoState ? (
        <div className="relative z-10 w-full max-w-[95vw] 2xl:max-w-[1600px] flex flex-col items-center gap-12">
          
          {/* Main Judo Competitor Display */}
          <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-8 lg:gap-16 text-center">
            {/* Team 1 (Ao) */}
            <div className="flex flex-col items-center min-w-0">
              <span className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-xs font-black tracking-widest uppercase mb-4 shadow-lg shadow-blue-500/20">
                AO (AZUL)
              </span>
              <div className="w-32 h-32 lg:w-44 lg:h-44 rounded-[2rem] bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-blue-500/10" />
                {match.team1?.institution?.logo_url ? (
                  <img src={match.team1.institution.logo_url} alt="Mandante" className="w-full h-full object-contain p-4 relative z-10" onError={(e: any) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }} />
                ) : null}
                <Shield size={64} className="text-white/20 lg:size-20 relative z-10" style={{ display: match.team1?.institution?.logo_url ? 'none' : 'block' }} />
              </div>
              <h2 className="text-3xl lg:text-5xl font-black uppercase tracking-tight text-white mb-2 leading-tight drop-shadow-2xl px-4 w-full break-words">
                {getTeamDisplayName(match, 1)}
              </h2>
            </div>
            
            <div className="text-3xl font-black text-white/10 px-4 hidden lg:block">VS</div>
            
            {/* Team 2 (Shiro) */}
            <div className="flex flex-col items-center min-w-0">
              <span className="px-4 py-1.5 bg-white text-slate-900 border border-slate-350 rounded-full text-xs font-black tracking-widest uppercase mb-4 shadow-lg shadow-white/10">
                SHIRO (BRANCO)
              </span>
              <div className="w-32 h-32 lg:w-44 lg:h-44 rounded-[2rem] bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-slate-100/10" />
                {match.team2?.institution?.logo_url ? (
                  <img src={match.team2.institution.logo_url} alt="Visitante" className="w-full h-full object-contain p-4 relative z-10" onError={(e: any) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }} />
                ) : null}
                <Shield size={64} className="text-white/20 lg:size-20 relative z-10" style={{ display: match.team2?.institution?.logo_url ? 'none' : 'block' }} />
              </div>
              <h2 className="text-3xl lg:text-5xl font-black uppercase tracking-tight text-white mb-2 leading-tight drop-shadow-2xl px-4 w-full break-words">
                {getTeamDisplayName(match, 2)}
              </h2>
            </div>
          </div>

          {/* Table representation for Judo points */}
          <div className="w-full max-w-4xl bg-white/5 backdrop-blur-2xl rounded-[2.5rem] border border-white/10 p-6 lg:p-8 shadow-2xl flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-6 text-center">
              
              {/* Team 1 (Ao) Scores */}
              <div className="grid grid-cols-4 gap-2 lg:gap-3">
                <div className="flex flex-col bg-amber-500/10 border border-amber-500/20 rounded-2xl py-4">
                  <span className="text-[10px] font-black text-amber-400 mb-1">IPPON</span>
                  <span className="text-3xl lg:text-5xl font-black text-white">{judoState.team1_ippon || 0}</span>
                </div>
                <div className="flex flex-col bg-indigo-500/10 border border-indigo-500/20 rounded-2xl py-4">
                  <span className="text-[10px] font-black text-indigo-400 mb-1">WAZA-ARI</span>
                  <span className="text-3xl lg:text-5xl font-black text-white">{judoState.team1_wazaari || 0}</span>
                </div>
                <div className="flex flex-col bg-yellow-500/10 border border-yellow-500/20 rounded-2xl py-4">
                  <span className="text-[10px] font-black text-yellow-450 mb-1">YUKO</span>
                  <span className="text-3xl lg:text-5xl font-black text-white">{judoState.team1_yuko || 0}</span>
                </div>
                <div className="flex flex-col bg-red-500/10 border border-red-500/20 rounded-2xl py-4 justify-center items-center">
                  <span className="text-[10px] font-black text-red-400 mb-2">SHIDO</span>
                  <div className="flex gap-1 justify-center items-center">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span 
                        key={i} 
                        className={`w-3.5 h-6 rounded-sm border ${
                          (judoState.team1_shido || 0) > i
                            ? "bg-amber-450 border-amber-500 shadow-sm"
                            : "bg-white/5 border-white/10"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Central Separator / Active Osaekomi Timer */}
              <div className="flex flex-col items-center px-4 w-full lg:w-48 my-4 lg:my-0">
                {osaekomiActive ? (
                  <div className="flex flex-col items-center bg-blue-600/20 border border-blue-500/30 px-6 py-4 rounded-2xl animate-pulse w-full">
                    <span className="text-[8px] font-black text-blue-400 tracking-widest uppercase">OSAEKOMI</span>
                    <span className="text-4xl font-mono font-black text-white mt-1 tabular-nums">{osaekomiTime}s</span>
                    <span className="text-[8px] text-slate-400 font-bold uppercase mt-1">
                      {osaekomiTeamId === match.team1_id ? "AO" : "SHIRO"}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Clock size={20} className="text-slate-500 mb-1" />
                    <span className="text-[9px] font-black text-slate-500 tracking-wider">TEMPO REGULAR</span>
                    <span className="font-mono text-3xl font-black text-white mt-1">{formatTime(time)}</span>
                  </div>
                )}
              </div>

              {/* Team 2 (Shiro) Scores */}
              <div className="grid grid-cols-4 gap-2 lg:gap-3">
                <div className="flex flex-col bg-red-500/10 border border-red-500/20 rounded-2xl py-4 justify-center items-center">
                  <span className="text-[10px] font-black text-red-400 mb-2">SHIDO</span>
                  <div className="flex gap-1 justify-center items-center">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span 
                        key={i} 
                        className={`w-3.5 h-6 rounded-sm border ${
                          (judoState.team2_shido || 0) > i
                            ? "bg-amber-450 border-amber-500 shadow-sm"
                            : "bg-white/5 border-white/10"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col bg-yellow-500/10 border border-yellow-500/20 rounded-2xl py-4">
                  <span className="text-[10px] font-black text-yellow-450 mb-1">YUKO</span>
                  <span className="text-3xl lg:text-5xl font-black text-white">{judoState.team2_yuko || 0}</span>
                </div>
                <div className="flex flex-col bg-indigo-500/10 border border-indigo-500/20 rounded-2xl py-4">
                  <span className="text-[10px] font-black text-indigo-400 mb-1">WAZA-ARI</span>
                  <span className="text-3xl lg:text-5xl font-black text-white">{judoState.team2_wazaari || 0}</span>
                </div>
                <div className="flex flex-col bg-amber-500/10 border border-amber-500/20 rounded-2xl py-4">
                  <span className="text-[10px] font-black text-amber-400 mb-1">IPPON</span>
                  <span className="text-3xl lg:text-5xl font-black text-white">{judoState.team2_ippon || 0}</span>
                </div>
              </div>
              
            </div>
          </div>
          
          <div className={`px-8 py-3 rounded-full border text-sm font-black uppercase tracking-widest transition-all ${
            match.is_timer_running 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 animate-pulse" 
              : "bg-white/5 border-white/10 text-slate-500 whitespace-nowrap"
          }`}>
            {match.is_timer_running ? "• COMBATE EM ANDAMENTO" : "COMBATE PAUSADO"}
          </div>
        </div>
      ) : sportType === 'karate' && karateState ? (
        <div className="relative z-10 w-full max-w-[95vw] 2xl:max-w-[1600px] grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-8 lg:gap-16">
          
          {/* Team 1 (Aka) */}
          <div className="flex flex-col items-center text-center min-w-0">
            <span className="px-4 py-1.5 bg-red-650 text-white rounded-full text-xs font-black tracking-widest uppercase mb-4 shadow-lg shadow-red-500/20">
              AKA (VERMELHO)
            </span>
            <div className="w-32 h-32 lg:w-44 lg:h-44 rounded-[2rem] bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-2xl overflow-hidden relative">
              <div className="absolute inset-0 bg-red-500/5" />
              {match.team1?.institution?.logo_url ? (
                <img src={match.team1.institution.logo_url} alt="Mandante" className="w-full h-full object-contain p-4 relative z-10" onError={(e: any) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }} />
              ) : null}
              <Shield size={64} className="text-white/20 lg:size-20 relative z-10" style={{ display: match.team1?.institution?.logo_url ? 'none' : 'block' }} />
            </div>
            <h2 className="text-3xl lg:text-5xl font-black uppercase tracking-tight text-white mb-2 leading-tight drop-shadow-2xl px-4 w-full break-words">
              {getTeamDisplayName(match, 1)}
            </h2>
            {karateState.team1_senshu && (
              <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-slate-950 rounded-full text-[10px] font-black tracking-widest uppercase shadow">
                ● SENSHU (VANTAGEM)
              </span>
            )}
            {karateState.team1_warnings > 0 && (
              <div className="flex gap-1.5 mt-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <span 
                    key={i} 
                    className={`w-3.5 h-6 rounded-sm border ${
                      (karateState.team1_warnings || 0) > i
                        ? "bg-orange-50 border-orange-650 shadow-sm animate-pulse"
                        : "bg-white/5 border-white/10"
                    }`}
                    title={`Aviso ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Scores & Time Center */}
          <div className="flex flex-col items-center gap-8">
            <div className="flex flex-col items-center bg-white/5 border border-white/10 px-8 py-4 rounded-3xl backdrop-blur-xl shadow-2xl">
              <div className="flex items-center gap-2 text-indigo-400 mb-1">
                <Clock size={20} />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">TEMPO DE LUTA</span>
              </div>
              <div className="font-mono text-5xl lg:text-6xl font-black tabular-nums tracking-wider text-white">
                {formatTime(time)}
              </div>
            </div>

            <div className="flex items-center gap-6 lg:gap-12 bg-white/5 backdrop-blur-2xl rounded-[4rem] px-8 lg:px-16 py-12 lg:py-16 border border-white/10 shadow-[0_0_100px_-20px_rgba(79,70,229,0.4)]">
              <span className="text-8xl lg:text-[180px] font-black leading-none tracking-tighter block w-[120px] lg:w-[240px] text-center">{match.score1 ?? 0}</span>
              <span className="text-4xl lg:text-7xl font-black text-white/10">X</span>
              <span className="text-8xl lg:text-[180px] font-black leading-none tracking-tighter block w-[120px] lg:w-[240px] text-center">{match.score2 ?? 0}</span>
            </div>
            
            <div className={`px-8 py-3 rounded-full border text-sm font-black uppercase tracking-widest transition-all ${
              match.is_timer_running 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 animate-pulse" 
                : "bg-white/5 border-white/10 text-slate-500 whitespace-nowrap"
            }`}>
              {match.is_timer_running ? "• COMBATE EM ANDAMENTO" : "COMBATE PAUSADO"}
            </div>
          </div>

          {/* Team 2 (Ao) */}
          <div className="flex flex-col items-center text-center min-w-0">
            <span className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-xs font-black tracking-widest uppercase mb-4 shadow-lg shadow-blue-500/20">
              AO (AZUL)
            </span>
            <div className="w-32 h-32 lg:w-44 lg:h-44 rounded-[2rem] bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center mb-6 shadow-2xl overflow-hidden relative">
              <div className="absolute inset-0 bg-blue-500/5" />
              {match.team2?.institution?.logo_url ? (
                <img src={match.team2.institution.logo_url} alt="Visitante" className="w-full h-full object-contain p-4 relative z-10" onError={(e: any) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }} />
              ) : null}
              <Shield size={64} className="text-white/20 lg:size-20 relative z-10" style={{ display: match.team2?.institution?.logo_url ? 'none' : 'block' }} />
            </div>
            <h2 className="text-3xl lg:text-5xl font-black uppercase tracking-tight text-white mb-2 leading-tight drop-shadow-2xl px-4 w-full break-words">
              {getTeamDisplayName(match, 2)}
            </h2>
            {karateState.team2_senshu && (
              <span className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500 text-slate-950 rounded-full text-[10px] font-black tracking-widest uppercase shadow">
                ● SENSHU (VANTAGEM)
              </span>
            )}
            {karateState.team2_warnings > 0 && (
              <div className="flex gap-1.5 mt-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <span 
                    key={i} 
                    className={`w-3.5 h-6 rounded-sm border ${
                      (karateState.team2_warnings || 0) > i
                        ? "bg-orange-50 border-orange-650 shadow-sm animate-pulse"
                        : "bg-white/5 border-white/10"
                    }`}
                    title={`Aviso ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      ) : (
        <div className="relative z-10 w-full max-w-[95vw] 2xl:max-w-[1800px] grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-8 lg:gap-16 xl:gap-24 2xl:gap-32">
          
          {/* Team 1 */}
          <motion.div 
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col items-center text-center min-w-0"
          >
            <div className="w-32 h-32 lg:w-48 lg:h-48 rounded-[2rem] bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center mb-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              {match.team1?.institution?.logo_url ? (
                <img src={match.team1.institution.logo_url} alt="Mandante" className="w-full h-full object-contain p-4 relative z-10" onError={(e: any) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }} />
              ) : null}
              <Shield size={64} className="text-white/20 lg:size-24 relative z-10" style={{ display: match.team1?.institution?.logo_url ? 'none' : 'block' }} />
            </div>
            <div className="h-24 lg:h-40 flex flex-col items-center justify-start w-full">
              <h2 className="text-4xl lg:text-6xl font-black uppercase tracking-tight text-white mb-2 leading-tight drop-shadow-2xl break-words text-balance px-4 w-full">
                {getTeamDisplayName(match, 1)}
              </h2>
              {sportType === 'futsal' && (
                <div className="mt-2 px-4 py-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-2xl text-xs font-black uppercase tracking-widest animate-pulse">
                  Faltas: {getAccumulatedFouls(match.team1_id)}
                </div>
              )}
            </div>
          </motion.div>

          {/* Score Display */}
          <div className="flex flex-col items-center gap-8">
            {/* Timer Display */}
            {sportType !== 'volleyball' && (
              <div className="flex flex-col items-center bg-white/5 border border-white/10 px-8 py-4 rounded-3xl backdrop-blur-xl shadow-2xl">
                <div className="flex items-center gap-2 text-indigo-400 mb-1">
                  <Clock size={20} />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">TEMPO DE JOGO</span>
                </div>
                <div className="font-mono text-5xl lg:text-6xl font-black tabular-nums tracking-wider text-white">
                  {formatTime(time)}
                </div>
              </div>
            )}

            {isSetBased && !isMatchFinished && (
              <div className="px-6 py-2 bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-md">
                Sets: {setsWon1} - {setsWon2}
              </div>
            )}

            <div className="flex items-center gap-6 lg:gap-12 bg-white/5 backdrop-blur-2xl rounded-[4rem] px-8 lg:px-16 py-12 lg:py-16 border border-white/10 shadow-[0_0_100px_-20px_rgba(79,70,229,0.4)]">
              <div className="relative w-[120px] lg:w-[240px] flex justify-center h-[120px] lg:h-[220px]">
                <AnimatePresence mode="wait">
                  <motion.span 
                    key={currentSetScore1}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="text-8xl lg:text-[220px] font-black leading-none tracking-tighter block absolute inset-0 flex items-center justify-center"
                  >
                    {currentSetScore1}
                  </motion.span>
                </AnimatePresence>
              </div>

              <span className="text-4xl lg:text-7xl font-black text-white/10">X</span>

              <div className="relative w-[120px] lg:w-[240px] flex justify-center h-[120px] lg:h-[220px]">
                <AnimatePresence mode="wait">
                  <motion.span 
                    key={currentSetScore2}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="text-8xl lg:text-[220px] font-black leading-none tracking-tighter block absolute inset-0 flex items-center justify-center"
                  >
                    {currentSetScore2}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>
            
            {isSetBased && completedSets.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center text-xs font-extrabold uppercase tracking-wider text-slate-400 bg-white/5 px-6 py-3 rounded-2xl border border-white/10">
                <span>Parciais:</span>
                {completedSets.map((s, idx) => (
                  <span key={idx} className="bg-white/10 px-2.5 py-1 rounded text-white flex items-center gap-1">
                    {s.team1}x{s.team2}
                    {s.win_type === 'time_limit' && <span className="text-[9px] text-amber-400 font-black">(T)</span>}
                  </span>
                ))}
              </div>
            )}

            <div className={`px-8 py-3 rounded-full border text-sm font-black uppercase tracking-widest transition-all ${
              match.is_timer_running 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 animate-pulse" 
                : "bg-white/5 border-white/10 text-slate-500 whitespace-nowrap"
            }`}>
              {match.is_timer_running ? "• JOGO EM ANDAMENTO" : "PARTIDA PAUSADA"}
            </div>
          </div>

          {/* Team 2 */}
          <motion.div 
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col items-center text-center min-w-0"
          >
            <div className="w-32 h-32 lg:w-48 lg:h-48 rounded-[2rem] bg-gradient-to-br from-white/10 to-white/5 border border-white/10 flex items-center justify-center mb-8 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              {match.team2?.institution?.logo_url ? (
                <img src={match.team2.institution.logo_url} alt="Visitante" className="w-full h-full object-contain p-4 relative z-10" onError={(e: any) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }} />
              ) : null}
              <Shield size={64} className="text-white/20 lg:size-24 relative z-10" style={{ display: match.team2?.institution?.logo_url ? 'none' : 'block' }} />
            </div>
            <div className="h-24 lg:h-40 flex flex-col items-center justify-start w-full">
              <h2 className="text-4xl lg:text-6xl font-black uppercase tracking-tight text-white mb-2 leading-tight drop-shadow-2xl break-words text-balance px-4 w-full">
                {getTeamDisplayName(match, 2)}
              </h2>
              {sportType === 'futsal' && (
                <div className="mt-2 px-4 py-1.5 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-2xl text-xs font-black uppercase tracking-widest animate-pulse">
                  Faltas: {getAccumulatedFouls(match.team2_id)}
                </div>
              )}
            </div>
          </motion.div>

        </div>
      )}

      {/* Footer Branding */}
      <div className="mt-24 relative z-10 flex items-center gap-2 opacity-30 grayscale hover:opacity-100 transition-opacity cursor-default">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
          <Shield size={16} className="text-white" />
        </div>
        <span className="font-black text-sm tracking-tighter">Quero Competir</span>
      </div>
    </div>
  );
}
