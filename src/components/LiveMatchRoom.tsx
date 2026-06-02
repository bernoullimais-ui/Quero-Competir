import React, { useState, useEffect, useRef } from 'react';
import { 
  Timer, Play, Pause, RotateCcw, 
  Trophy, User, Clock, Trash2, 
  FileText, ArrowLeft, Shield, AlertTriangle, AlertCircle,
  ExternalLink, Wifi, WifiOff, Smartphone, RefreshCw, Sliders, Check, Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useToast } from './ui/Toast.tsx';
import { useConfirm } from './ui/ConfirmDialog.tsx';
import OfflineBanner from './OfflineBanner.tsx';
import EventLog from './EventLog.tsx';

interface LiveMatchRoomProps {
  matchId: string;
  onBack: () => void;
  onUpdatePlacar: () => void;
  onNextMatch?: (matchId: string) => void;
}

const LiveMatchRoom: React.FC<LiveMatchRoomProps> = ({ matchId, onBack, onUpdatePlacar, onNextMatch }) => {
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const { confirm } = useConfirm();
  const [match, setMatch] = useState<any>(null);
  const [team1Athletes, setTeam1Athletes] = useState<any[]>([]);
  const [team2Athletes, setTeam2Athletes] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [nextMatchId, setNextMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // New: Offline state management & Pocket Referee Mode (PWA helper)
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isMobileMode, setIsMobileMode] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [selectedMobileTeamId, setSelectedMobileTeamId] = useState<string>("");
  const [offlineQueue, setOfflineQueue] = useState<any[]>([]);
  
  // Timer State
  const [time, setTime] = useState(0); // em segundos
  const [isActive, setIsActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Judo Osaekomi State
  const [osaekomiTime, setOsaekomiTime] = useState(0);
  const [osaekomiActive, setOsaekomiActive] = useState(false);
  const [osaekomiTeamId, setOsaekomiTeamId] = useState<string | null>(null);

  // Refs to avoid stale closures in ticking timers
  const matchRef = useRef<any>(null);
  const osaekomiTeamIdRef = useRef<string | null>(null);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    matchRef.current = match;
  }, [match]);

  useEffect(() => {
    osaekomiTeamIdRef.current = osaekomiTeamId;
  }, [osaekomiTeamId]);

  useEffect(() => {
    timeRef.current = time;
  }, [time]);

  const getSportType = (categoryName: string) => {
    const name = categoryName?.toLowerCase() || '';
    if (name.includes('basquete') || name.includes('basketball')) return 'basketball';
    if (name.includes('vôlei') || name.includes('voleibol') || name.includes('volleyball')) return 'volleyball';
    if (name.includes('handebol') || name.includes('handball')) return 'handball';
    if (name.includes('baleado') || name.includes('queimada') || name.includes('dodgeball')) return 'dodgeball';
    if (name.includes('futsal')) return 'futsal';
    if (name.includes('judô') || name.includes('judo')) return 'judo';
    if (name.includes('karatê') || name.includes('karate')) return 'karate';
    return 'football'; // Futebol, Society default
  };

  const sportType = getSportType(match?.category?.name);

  // Sync timer with DB
  const syncTimer = async (newTime: number, running: boolean) => {
    try {
      await fetch(`/api/tournaments/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timer_base_seconds: newTime,
          is_timer_running: running,
          timer_last_started_at: running ? new Date().toISOString() : null
        })
      });
    } catch (err) {
      console.error("Failed to sync timer:", err);
    }
  };

  const loadOfflineQueue = () => {
    const queuedData = localStorage.getItem(`offline_events_${matchId}`);
    if (queuedData) {
      setOfflineQueue(JSON.parse(queuedData));
    } else {
      setOfflineQueue([]);
    }
  };

  const syncOfflineEvents = async () => {
    if (syncing) return;
    const existingQueueStr = localStorage.getItem(`offline_events_${matchId}`);
    if (!existingQueueStr) return;
    const queue = JSON.parse(existingQueueStr);
    if (queue.length === 0) return;

    setSyncing(true);
    setSyncError(null);
    
    let successCount = 0;
    const remainingQueue: any[] = [];

    for (const event of queue) {
      try {
        const res = await fetch(`/api/tournaments/matches/${matchId}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            team_id: event.team_id,
            athlete_id: event.athlete_id,
            event_type: event.event_type,
            event_time: event.event_time
          })
        });

        if (res.ok) {
          successCount++;
        } else {
          remainingQueue.push(event);
        }
      } catch (err) {
        remainingQueue.push(event);
      }
    }

    if (remainingQueue.length > 0) {
      localStorage.setItem(`offline_events_${matchId}`, JSON.stringify(remainingQueue));
      setOfflineQueue(remainingQueue);
      setSyncError(`Erro ao sincronizar ${remainingQueue.length} evento(s). Tente novamente.`);
    } else {
      localStorage.removeItem(`offline_events_${matchId}`);
      setOfflineQueue([]);
      // Reload everything from server now that we are synced!
      fetchInitialData();
    }
    setSyncing(false);
  };

  const fetchInitialData = async () => {
    // 1. Try Loading from Local Cache first for visual instantaneous offline-first
    const cachedMatch = localStorage.getItem(`cached_match_${matchId}`);
    const cachedT1 = localStorage.getItem(`cached_t1_athletes_${matchId}`);
    const cachedT2 = localStorage.getItem(`cached_t2_athletes_${matchId}`);
    const cachedEvents = localStorage.getItem(`cached_events_${matchId}`);

    if (cachedMatch) {
      const mData = JSON.parse(cachedMatch);
      const initialized = initializeSetsDetail(mData);
      setMatch(initialized);
      if (mData.team1_id) {
        setSelectedMobileTeamId(mData.team1_id);
      }
      if (mData.is_timer_running && mData.timer_last_started_at) {
        const start = new Date(mData.timer_last_started_at).getTime();
        const now = new Date().getTime();
        const diff = Math.floor((now - start) / 1000);
        setTime((mData.timer_base_seconds || 0) + diff);
        setIsActive(true);
      } else {
        setTime(mData.timer_base_seconds || 0);
        setIsActive(false);
      }
      // Initialize Osaekomi
      const sport = getSportType(initialized.category?.name);
      const judoState = initialized.sets_detail?.[0];
      if (sport === 'judo' && judoState) {
        if (judoState.osaekomi_team_id && judoState.osaekomi_start_time) {
          const start = new Date(judoState.osaekomi_start_time).getTime();
          const now = new Date().getTime();
          const diff = Math.floor((now - start) / 1000);
          setOsaekomiTime((judoState.osaekomi_base_seconds || 0) + diff);
          setOsaekomiActive(true);
          setOsaekomiTeamId(judoState.osaekomi_team_id);
        } else {
          setOsaekomiTime(judoState.osaekomi_base_seconds || 0);
          setOsaekomiActive(false);
          setOsaekomiTeamId(null);
        }
      }
      setLoading(false); // Enable loaded state early if cache is present!
    }
    if (cachedT1) setTeam1Athletes(JSON.parse(cachedT1));
    if (cachedT2) setTeam2Athletes(JSON.parse(cachedT2));
    if (cachedEvents) setEvents(JSON.parse(cachedEvents));

    // 2. Fetch live data from Server
    try {
      const mRes = await fetch(`/api/tournaments/match/${matchId}`);
      if (!mRes.ok) throw new Error("Offline or server error");
      const mData = await mRes.json();
      const initialized = initializeSetsDetail(mData);
      setMatch(initialized);
      localStorage.setItem(`cached_match_${matchId}`, JSON.stringify(mData));
      if (mData.team1_id && !selectedMobileTeamId) {
        setSelectedMobileTeamId(mData.team1_id);
      }

      // Initialize timer from Live DB only if not already active to avoid rewinding
      if (!isActive) {
        if (mData.is_timer_running && mData.timer_last_started_at) {
          const start = new Date(mData.timer_last_started_at).getTime();
          const now = new Date().getTime();
          const diff = Math.floor((now - start) / 1000);
          setTime((mData.timer_base_seconds || 0) + diff);
          setIsActive(true);
        } else {
          setTime(mData.timer_base_seconds || 0);
          setIsActive(false);
        }
      }

      // Initialize Osaekomi
      const sport = getSportType(initialized.category?.name);
      const judoState = initialized.sets_detail?.[0];
      if (sport === 'judo' && judoState) {
        if (judoState.osaekomi_team_id && judoState.osaekomi_start_time) {
          const start = new Date(judoState.osaekomi_start_time).getTime();
          const now = new Date().getTime();
          const diff = Math.floor((now - start) / 1000);
          setOsaekomiTime((judoState.osaekomi_base_seconds || 0) + diff);
          setOsaekomiActive(true);
          setOsaekomiTeamId(judoState.osaekomi_team_id);
        } else {
          setOsaekomiTime(judoState.osaekomi_base_seconds || 0);
          setOsaekomiActive(false);
          setOsaekomiTeamId(null);
        }
      }

      // Fetch Events
      const eRes = await fetch(`/api/tournaments/matches/${matchId}/events`);
      if (eRes.ok) {
        const eData = await eRes.json();
        const finalEvents = Array.isArray(eData) ? eData : [];
        
        // Append offline events if any exist to show correct combined timeline
        const localQueueStr = localStorage.getItem(`offline_events_${matchId}`);
        const localQueue = localQueueStr ? JSON.parse(localQueueStr) : [];
        const mergedEvents = [...finalEvents, ...localQueue];

        setEvents(mergedEvents);
        localStorage.setItem(`cached_events_${matchId}`, JSON.stringify(finalEvents));
      }

      // Fetch Athletes
      if (mData.team1_id) {
        const t1Res = await fetch(`/api/tournaments/teams/${mData.team1_id}/athletes`);
        if (t1Res.ok) {
          const t1Data = await t1Res.json();
          setTeam1Athletes(Array.isArray(t1Data) ? t1Data : []);
          localStorage.setItem(`cached_t1_athletes_${matchId}`, JSON.stringify(t1Data));
        }
      }
      if (mData.team2_id) {
        const t2Res = await fetch(`/api/tournaments/teams/${mData.team2_id}/athletes`);
        if (t2Res.ok) {
          const t2Data = await t2Res.json();
          setTeam2Athletes(Array.isArray(t2Data) ? t2Data : []);
          localStorage.setItem(`cached_t2_athletes_${matchId}`, JSON.stringify(t2Data));
        }
      }
    } catch (err) {
      console.warn("Dispositivo conectado em modo offline ou rede lenta. Usando dados armazenados em cache local.", err);
      setIsOnline(false);
    } finally {
      // 3. Busca próximo jogo (não bloqueia UI)
      if (navigator.onLine) {
        try {
          const nRes = await fetch(`/api/tournaments/matches/${matchId}/next`);
          if (nRes.ok) {
            const nData = await nRes.json();
            if (nData && nData.id) setNextMatchId(nData.id);
            else setNextMatchId(null);
          }
        } catch (e) {}
      }
      setLoading(false);
    }
  };

  // Event Selection State
  const [showPlayerSelect, setShowPlayerSelect] = useState<{ teamId: string, eventType: string, targetTeamId?: string } | null>(null);
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [gameReport, setGameReport] = useState("");
  const [mvpAthleteId, setMvpAthleteId] = useState<string>("");

  const [showEndSetModal, setShowEndSetModal] = useState(false);
  const [endSetWinnerId, setEndSetWinnerId] = useState("");
  const [endSetWinType, setEndSetWinType] = useState("elimination");

  useEffect(() => {
    fetchInitialData();
    loadOfflineQueue();

    // Listen to network changes
    const goOnline = () => {
      setIsOnline(true);
      syncOfflineEvents();
    };
    const goOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);

    // Automatic toggle into Mobile mode on smaller screens
    if (window.innerWidth < 768) {
      setIsMobileMode(true);
    }

    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, [matchId]);

  const updatePeriod = async (newPeriod: string) => {
    setMatch((prev: any) => ({ ...prev, period: newPeriod }));
    try {
      await fetch(`/api/tournaments/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: newPeriod })
      });
    } catch (err) {
      console.warn("Não foi possível sincronizar alteração de período online. Salvo localmente.", err);
    }
  };

  const finishMatch = async () => {
    try {
      const s1 = match.score1 || 0;
      const s2 = match.score2 || 0;
      let wId = null;
      if (s1 > s2) wId = match.team1_id;
      else if (s2 > s1) wId = match.team2_id;

      await fetch(`/api/tournaments/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: 'finished',
          report: gameReport,
          is_timer_running: false,
          period: 'Fim',
          mvp_athlete_id: mvpAthleteId || null,
          winner_id: wId
        })
      });
      setIsActive(false);
      setShowFinishModal(false);
      fetchInitialData(); // Refresh match and status
      onUpdatePlacar();
    } catch (err) {
      console.error("Failed to finish match:", err);
      // Let referees force mark it as finished offline
      setMatch((prev: any) => ({ ...prev, status: 'finished', report: gameReport, period: 'Fim' }));
      setIsActive(false);
      setShowFinishModal(false);
      onUpdatePlacar();
    }
  };

  useEffect(() => {
    if (isActive) {
      timerRef.current = setInterval(() => {
        setTime(prev => prev + 1);
      }, 1000);
    } else if (!isActive && timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  // Osaekomi Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (osaekomiActive && sportType === 'judo' && match?.status !== 'finished') {
      interval = setInterval(() => {
        setOsaekomiTime(prev => {
          const nextTime = prev + 1;
          handleOsaekomiThresholds(nextTime);
          return nextTime;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [osaekomiActive, sportType, match?.status, osaekomiTeamId]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTimer = () => {
    const nextState = !isActive;
    setIsActive(nextState);
    syncTimer(time, nextState);
  };

  const resetTimer = () => {
    setIsActive(false);
    setTime(0);
    syncTimer(0, false);
  };

  const handleEndFirstHalf = async () => {
    setIsActive(false);
    await syncTimer(time, false);
    await updatePeriod('2º Tempo');
    setTime(0);
    await syncTimer(0, false);
  };

  const handleEndBasketballPeriod = async () => {
    setIsActive(false);
    await syncTimer(time, false);

    const current = match?.period || '1º Quarto';
    let nextPeriod = 'Fim';
    if (current === '1º Quarto') nextPeriod = '2º Quarto';
    else if (current === '2º Quarto') nextPeriod = 'Intervalo';
    else if (current === 'Intervalo') nextPeriod = '3º Quarto';
    else if (current === '3º Quarto') nextPeriod = '4º Quarto';
    else if (current === '4º Quarto') nextPeriod = 'Fim';
    else if (current === 'Prorrogação') nextPeriod = 'Fim';

    await updatePeriod(nextPeriod);
    setTime(0);
    await syncTimer(0, false);
  };

  const getEndPeriodButtonLabel = () => {
    const current = match?.period || '1º Quarto';
    if (current === 'Intervalo') return 'Iniciar 3º Quarto';
    return `Encerrar ${current}`;
  };

  const initializeSetsDetail = (matchObj: any) => {
    if (!matchObj) return matchObj;
    const sport = getSportType(matchObj.category?.name);
    if (sport === 'judo') {
      if (!matchObj.sets_detail || matchObj.sets_detail.length === 0 || !matchObj.sets_detail[0] || matchObj.sets_detail[0].team1_ippon === undefined) {
        matchObj.sets_detail = [{
          team1_ippon: 0,
          team1_wazaari: 0,
          team1_yuko: 0,
          team1_shido: 0,
          team2_ippon: 0,
          team2_wazaari: 0,
          team2_yuko: 0,
          team2_shido: 0,
          osaekomi_team_id: null,
          osaekomi_start_time: null,
          osaekomi_base_seconds: 0,
          golden_score: false
        }];
      }
      if (matchObj.period === '1º Tempo' || !matchObj.period) {
        matchObj.period = 'Tempo Regular';
      }
    } else if (sport === 'karate') {
      if (!matchObj.sets_detail || matchObj.sets_detail.length === 0 || !matchObj.sets_detail[0] || matchObj.sets_detail[0].team1_senshu === undefined) {
        matchObj.sets_detail = [{
          team1_senshu: false,
          team2_senshu: false,
          team1_warnings: 0,
          team2_warnings: 0
        }];
      }
      if (matchObj.period === '1º Tempo' || !matchObj.period) {
        matchObj.period = 'Tempo Regular';
      }
    } else if ((sport === 'volleyball' || sport === 'dodgeball') && (!matchObj.sets_detail || matchObj.sets_detail.length === 0)) {
      matchObj.sets_detail = [{ team1: 0, team2: 0 }];
    }
    if (matchObj.period === '1º Tempo') {
      if (sport === 'volleyball' || sport === 'dodgeball') {
        matchObj.period = '1º Set';
      } else if (sport === 'basketball') {
        matchObj.period = '1º Quarto';
      }
    }
    return matchObj;
  };

  const incrementSetPoints = async (teamId: string, increment: number) => {
    if (!match) return;
    const isTeam1 = match.team1_id === teamId;
    
    const updatedSets = [...(match.sets_detail || [])];
    if (updatedSets.length === 0) {
      updatedSets.push({ team1: isTeam1 ? increment : 0, team2: !isTeam1 ? increment : 0 });
    } else {
      const activeIdx = updatedSets.length - 1;
      const set = { ...updatedSets[activeIdx] };
      set.team1 = Math.max(0, (set.team1 || 0) + (isTeam1 ? increment : 0));
      set.team2 = Math.max(0, (set.team2 || 0) + (!isTeam1 ? increment : 0));
      updatedSets[activeIdx] = set;
    }

    setMatch((prev: any) => {
      const nextMatch = { ...prev, sets_detail: updatedSets };
      localStorage.setItem(`cached_match_${matchId}`, JSON.stringify(nextMatch));
      return nextMatch;
    });

    if (navigator.onLine) {
      try {
        await fetch(`/api/tournaments/matches/${matchId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sets_detail: updatedSets })
        });
      } catch (err) {
        console.error("Erro ao sincronizar parciais do set:", err);
      }
    }
  };

  const handleOpenEndSetModal = () => {
    if (!match) return;
    const sets = match.sets_detail || [];
    const activeSet = sets[sets.length - 1] || { team1: 0, team2: 0 };
    
    const suggestedWinner = activeSet.team1 > activeSet.team2 
      ? match.team1_id 
      : activeSet.team2 > activeSet.team1 
        ? match.team2_id 
        : "";

    setEndSetWinnerId(suggestedWinner);
    
    if (sportType === 'dodgeball') {
      const isElimination = activeSet.team1 === 10 || activeSet.team2 === 10;
      setEndSetWinType(isElimination ? "elimination" : "time_limit");
    } else {
      setEndSetWinType("elimination");
    }
    
    setShowEndSetModal(true);
  };

  const confirmEndSet = async () => {
    if (!match) return;
    const isT1Winner = endSetWinnerId === match.team1_id;
    
    const nextScore1 = (match.score1 || 0) + (isT1Winner ? 1 : 0);
    const nextScore2 = (match.score2 || 0) + (isT1Winner ? 0 : 1);
    
    const updatedSets = [...(match.sets_detail || [])];
    const activeIdx = updatedSets.length - 1;
    if (activeIdx >= 0) {
      updatedSets[activeIdx].win_type = sportType === 'dodgeball' ? endSetWinType : null;
    }
    
    // Suporte para Melhor de 3 sets ou 5 sets
    const rulesFormat = match.category?.rules_config?.match_format || 'best_of_3';
    const setsNeededToWin = rulesFormat === 'best_of_5' ? 3 : rulesFormat === 'best_of_3' ? 2 : 1;
    const isFinished = nextScore1 >= setsNeededToWin || nextScore2 >= setsNeededToWin;
    
    if (!isFinished) {
      updatedSets.push({ team1: 0, team2: 0 });
    }
    
    const nextPeriod = isFinished ? 'Fim' : `${updatedSets.length}º Set`;
    const nextStatus = isFinished ? 'finished' : 'ongoing';

    setMatch((prev: any) => ({
      ...prev,
      score1: nextScore1,
      score2: nextScore2,
      sets_detail: updatedSets,
      period: nextPeriod,
      status: nextStatus
    }));

    try {
      const eventTime = formatTime(time);
      await fetch(`/api/tournaments/matches/${matchId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: endSetWinnerId,
          event_type: 'set_finished',
          event_time: eventTime
        })
      });
    } catch (err) {
      console.warn("Falha ao salvar evento de set_finished:", err);
    }

    try {
      const patchPayload: any = {
        score1: nextScore1,
        score2: nextScore2,
        sets_detail: updatedSets,
        period: nextPeriod,
        status: nextStatus
      };
      if (isFinished) {
        patchPayload.winner_id = nextScore1 > nextScore2 ? match.team1_id : match.team2_id;
        patchPayload.is_timer_running = false;
      }
      
      const res = await fetch(`/api/tournaments/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload)
      });
      
      if (res.ok) {
        toastSuccess("Set finalizado com sucesso!");
        fetchInitialData();
        onUpdatePlacar();
      }
    } catch (err) {
      console.error("Falha ao sincronizar fechamento do set:", err);
    }
    
    setShowEndSetModal(false);
  };

  const handleAddEvent = async (athleteId: string | null) => {
    if (!showPlayerSelect) return;
    
    const athleteObj = [...team1Athletes, ...team2Athletes].find(a => a.id === athleteId);
    const athleteName = athleteObj ? (athleteObj.full_name || athleteObj.name) : "Fato Coletivo/Sem identificação";
    const currentEventTime = formatTime(time);
    const currentPeriod = match?.period || '1º Tempo';
    
    const eventPayload = {
      team_id: showPlayerSelect.teamId,
      athlete_id: athleteId,
      event_type: showPlayerSelect.eventType,
      event_time: currentEventTime,
      period: currentPeriod
    };

    // If device is offline, or there is already an offline queue (ensuring sequential processing order)
    if (!navigator.onLine || offlineQueue.length > 0) {
      const tempId = `temp-${Date.now()}`;
      const mockEvent = {
        id: tempId,
        match_id: matchId,
        team_id: showPlayerSelect.teamId,
        athlete_id: athleteId,
        event_type: showPlayerSelect.eventType,
        event_time: currentEventTime,
        period: currentPeriod,
        athlete: athleteId ? { id: athleteId, full_name: athleteName } : null,
        is_offline: true
      };

      const existingQueueStr = localStorage.getItem(`offline_events_${matchId}`);
      const queue = existingQueueStr ? JSON.parse(existingQueueStr) : [];
      queue.push(mockEvent);
      localStorage.setItem(`offline_events_${matchId}`, JSON.stringify(queue));
      setOfflineQueue(queue);

      // Instantly inject into visual list
      setEvents(prev => [...prev, mockEvent]);

      // Adjust the score locally (responsiveness)
      if (showPlayerSelect.eventType.startsWith('goal') || showPlayerSelect.eventType === 'goal') {
        const parts = showPlayerSelect.eventType.split('_');
        const points = parts.length > 1 ? parseInt(parts[1], 10) : 1;
        setMatch((prev: any) => {
          if (!prev) return prev;
          const isTeam1 = prev.team1_id === showPlayerSelect.teamId;
          const nextScore1 = isTeam1 ? (prev.score1 || 0) + points : prev.score1;
          const nextScore2 = !isTeam1 ? (prev.score2 || 0) + points : prev.score2;
          if (sportType === 'karate' && Math.abs(nextScore1 - nextScore2) >= 8) {
            setTimeout(() => {
              handleKarateGapWin(isTeam1 ? prev.team1_id : prev.team2_id);
            }, 100);
          }
          return {
            ...prev,
            score1: nextScore1,
            score2: nextScore2
          };
        });
        onUpdatePlacar();
      }

      if (showPlayerSelect.eventType === 'point' || showPlayerSelect.eventType === 'baleado_point') {
        incrementSetPoints(showPlayerSelect.teamId, 1);
      } else if (showPlayerSelect.eventType === 'revive') {
        const oppTeamId = showPlayerSelect.teamId === match.team1_id ? match.team2_id : match.team1_id;
        incrementSetPoints(oppTeamId, -1);
      }

      setShowPlayerSelect(null);
      return;
    }

    // Standard online pipeline
    try {
      const res = await fetch(`/api/tournaments/matches/${matchId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventPayload)
      });

      if (res.ok) {
        const newEvent = await res.json();
        
        try {
          const eRes = await fetch(`/api/tournaments/matches/${matchId}/events`);
          const eData = await eRes.json();
          if (Array.isArray(eData)) {
            setEvents(eData);
            localStorage.setItem(`cached_events_${matchId}`, JSON.stringify(eData));
          } else {
            setEvents(prev => [...prev, newEvent]);
          }
        } catch {
          setEvents(prev => [...prev, newEvent]);
        }
        
        if (showPlayerSelect.eventType.startsWith('goal') || showPlayerSelect.eventType === 'goal') {
          const parts = showPlayerSelect.eventType.split('_');
          const points = parts.length > 1 ? parseInt(parts[1], 10) : 1;

          setMatch((prev: any) => {
            if (!prev) return prev;
            const isTeam1 = prev.team1_id === showPlayerSelect.teamId;
            const nextScore1 = isTeam1 ? (prev.score1 || 0) + points : prev.score1;
            const nextScore2 = !isTeam1 ? (prev.score2 || 0) + points : prev.score2;
            if (sportType === 'karate' && Math.abs(nextScore1 - nextScore2) >= 8) {
              setTimeout(() => {
                handleKarateGapWin(isTeam1 ? prev.team1_id : prev.team2_id);
              }, 100);
            }
            return {
              ...prev,
              score1: nextScore1,
              score2: nextScore2
            };
          });
          onUpdatePlacar();
        }

        if (showPlayerSelect.eventType === 'point' || showPlayerSelect.eventType === 'baleado_point') {
          incrementSetPoints(showPlayerSelect.teamId, 1);
        } else if (showPlayerSelect.eventType === 'revive') {
          const oppTeamId = showPlayerSelect.teamId === match.team1_id ? match.team2_id : match.team1_id;
          incrementSetPoints(oppTeamId, -1);
        }
        
        setShowPlayerSelect(null);
      } else {
        throw new Error("Falha no servidor ao registrar evento - salvando offline");
      }
    } catch (err: any) {
      console.warn("Falha no servidor ou timeout. Alocando evento em ambiente offline.", err);
      // Fallback transition
      const tempId = `temp-${Date.now()}`;
      const mockEvent = {
        id: tempId,
        match_id: matchId,
        team_id: showPlayerSelect.teamId,
        athlete_id: athleteId,
        event_type: showPlayerSelect.eventType,
        event_time: currentEventTime,
        athlete: athleteId ? { id: athleteId, full_name: athleteName } : null,
        is_offline: true
      };

      const existingQueueStr = localStorage.getItem(`offline_events_${matchId}`);
      const queue = existingQueueStr ? JSON.parse(existingQueueStr) : [];
      queue.push(mockEvent);
      localStorage.setItem(`offline_events_${matchId}`, JSON.stringify(queue));
      setOfflineQueue(queue);
      setEvents(prev => [...prev, mockEvent]);

      if (showPlayerSelect.eventType.startsWith('goal') || showPlayerSelect.eventType === 'goal') {
        const parts = showPlayerSelect.eventType.split('_');
        const points = parts.length > 1 ? parseInt(parts[1], 10) : 1;
        setMatch((prev: any) => {
          if (!prev) return prev;
          const isTeam1 = prev.team1_id === showPlayerSelect.teamId;
          const nextScore1 = isTeam1 ? (prev.score1 || 0) + points : prev.score1;
          const nextScore2 = !isTeam1 ? (prev.score2 || 0) + points : prev.score2;
          if (sportType === 'karate' && Math.abs(nextScore1 - nextScore2) >= 8) {
            setTimeout(() => {
              handleKarateGapWin(isTeam1 ? prev.team1_id : prev.team2_id);
            }, 100);
          }
          return {
            ...prev,
            score1: nextScore1,
            score2: nextScore2
          };
        });
        onUpdatePlacar();
      }

      if (showPlayerSelect.eventType === 'point' || showPlayerSelect.eventType === 'baleado_point') {
        incrementSetPoints(showPlayerSelect.teamId, 1);
      } else if (showPlayerSelect.eventType === 'revive') {
        const oppTeamId = showPlayerSelect.teamId === match.team1_id ? match.team2_id : match.team1_id;
        incrementSetPoints(oppTeamId, -1);
      }

      setShowPlayerSelect(null);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!eventId) {
      console.error("No event ID provided for deletion");
      return;
    }
    
    const isConfirmed = await confirm({
      title: "Estornar Evento",
      message: "Deseja realmente estornar este evento?",
      variant: "warning",
      confirmText: "Estornar",
      cancelText: "Cancelar"
    });
    if (!isConfirmed) return;
    
    if (eventId.startsWith('temp-')) {
      const existingQueueStr = localStorage.getItem(`offline_events_${matchId}`);
      if (existingQueueStr) {
        let queue = JSON.parse(existingQueueStr);
        const eventToDelete = queue.find((e: any) => e.id === eventId);
        queue = queue.filter((e: any) => e.id !== eventId);
        localStorage.setItem(`offline_events_${matchId}`, JSON.stringify(queue));
        setOfflineQueue(queue);

        // Adjust score locally
        if (eventToDelete && (eventToDelete.event_type?.startsWith('goal') || eventToDelete.event_type === 'goal')) {
          const parts = eventToDelete.event_type.split('_');
          const points = parts.length > 1 ? parseInt(parts[1], 10) : 1;
          setMatch((prev: any) => {
            if (!prev) return prev;
            const isTeam1 = prev.team1_id === eventToDelete.team_id;
            return {
              ...prev,
              score1: isTeam1 ? Math.max(0, (prev.score1 || 0) - points) : prev.score1,
              score2: !isTeam1 ? Math.max(0, (prev.score2 || 0) - points) : prev.score2
            };
          });
          onUpdatePlacar();
        }

        if (eventToDelete && (eventToDelete.event_type === 'point' || eventToDelete.event_type === 'baleado_point')) {
          incrementSetPoints(eventToDelete.team_id, -1);
        } else if (eventToDelete && eventToDelete.event_type === 'revive') {
          const oppTeamId = eventToDelete.team_id === match.team1_id ? match.team2_id : match.team1_id;
          incrementSetPoints(oppTeamId, 1);
        }
      }
      setEvents(prev => prev.filter(e => e.id !== eventId));
      return;
    }

    try {
      const res = await fetch(`/api/tournaments/matches/${matchId}/events/${eventId}`, { 
        method: "DELETE" 
      });
      
      if (res.ok) {
        setEvents(prev => prev.filter(e => e.id !== eventId));
        const mRes = await fetch(`/api/tournaments/match/${matchId}`);
        if (mRes.ok) {
          const updatedMatch = await mRes.json();
          setMatch(initializeSetsDetail(updatedMatch));
          localStorage.setItem(`cached_match_${matchId}`, JSON.stringify(updatedMatch));
        }
        onUpdatePlacar();
      } else {
        const errorData = await res.json().catch(() => ({}));
        toastError(`Erro ao excluir evento: ${errorData.error || 'Erro no servidor'}`);
      }
    } catch (err) {
      console.error("Error in handleDeleteEvent:", err);
      toastError("Erro ao conectar com o servidor para excluir evento.");
    }
  };

  const exportSumula = () => {
    const doc = new jsPDF() as any;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 10;
    
    // Helper to draw a box with text
    const drawSectionHeader = (text: string, x: number, y: number, width: number) => {
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setFillColor(245, 245, 245);
      doc.rect(x, y, width, 5, 'F');
      doc.rect(x, y, width, 5);
      doc.text(text, x + 2, y + 3.5);
    };

    // 1. TOP HEADER TABLE
    autoTable(doc, {
      startY: margin,
      head: [
        [{ content: `Competição: ${match.tournament?.name || ""}`, styles: { halign: 'left' } }, { content: `Jogo Nº: ${match.match_index || ""}`, styles: { halign: 'right' } }]
      ],
      body: [
        [
          { content: `Categoria: ${match.category?.name || "N/A"}` }, 
          { content: `Fase: ${match.group_label || "---"}   Rodada: ${match.round || "---"}` }
        ],
        [
          { 
            content: `${match.team1?.institution?.name || "A"}   ${match.score1}  x  ${match.score2}   ${match.team2?.institution?.name || "B"}`,
            styles: { halign: 'center', fontSize: 12, fontStyle: 'bold' },
            colSpan: 2
          }
        ],
        [
          { content: `Local: ${[match.venue?.name, match.court].filter(Boolean).join(' - ') || "__________________________"}` },
          { content: `Data: ${match.scheduled_time ? match.scheduled_time.split('T')[0].split('-').reverse().join('/') : new Date().toLocaleDateString('pt-BR')}` }
        ],
        [
          { content: `Árbitros: ${match.referee1?.name || "__________"} / ${match.referee2?.name || "__________"}   Mesário: ${match.table_official?.name || "__________"}`, colSpan: 2 }
        ]
      ],
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 1, textColor: [0, 0, 0], lineColor: [0, 0, 0] },
      headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 100 } }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 5;

    // Period times table
    autoTable(doc, {
      startY: currentY,
      margin: { left: 140 },
      head: [['', 'Início', 'Fim']],
      body: [
        ['Período 1', '', ''],
        ['Período 2', '', ''],
        ['Período Extra', '', '']
      ],
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 1 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] }
    });

    currentY = (doc as any).lastAutoTable.finalY + 5;

    // FUNCTION TO DRAW TEAM BLOCK
    const drawTeamBlock = (teamData: any, athletes: any[], isHome: boolean, startY: number) => {
      const teamName = teamData?.institution?.name || (isHome ? "Mandante" : "Visitante");
      
      // Team Header
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(teamName.toUpperCase(), margin, startY);
      
      // Players Table
      const playerRows = Array.from({ length: 15 }).map((_, i) => {
        const a = athletes[i];
        return [i + 1, a ? (a.full_name || a.name) : '', '', i < events.filter(e => e.team_id === teamData?.id && e.event_type === 'yellow_card').length ? '|' : '', ''];
      });

      autoTable(doc, {
        startY: startY + 2,
        margin: { left: margin, right: 80 },
        head: [['', 'Jogadores', 'Nº', 'Ama', 'Ver']],
        body: playerRows,
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 0.8 },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0] },
        columnStyles: { 0: { cellWidth: 8 }, 2: { cellWidth: 10 }, 3: { cellWidth: 10 }, 4: { cellWidth: 10 } }
      });

      const tableBottom = (doc as any).lastAutoTable.finalY;

      // Sidebar info (Cards, Timeouts, Goals)
      const sidebarX = 135;
      
      // Accumulated Fouls
      drawSectionHeader("Faltas acumuladas", sidebarX, startY + 2, 60);
      autoTable(doc, {
        startY: startY + 7,
        margin: { left: sidebarX },
        body: [
          ['Período 1', '', '', '', '', ''],
          ['Período 2', '', '', '', '', '']
        ],
        theme: 'grid',
        styles: { fontSize: 6, cellPadding: 1 },
        columnStyles: { 0: { cellWidth: 20 } }
      });

      // Timeouts
      drawSectionHeader("Pedidos de tempo", sidebarX, (doc as any).lastAutoTable.finalY + 2, 60);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 7,
        margin: { left: sidebarX },
        head: [['Período 1', 'Período 2']],
        body: [['  :  ', '  :  ']],
        theme: 'grid',
        styles: { fontSize: 6, cellPadding: 1, halign: 'center' }
      });

      // GOLS grid
      drawSectionHeader("GOLS/PONTOS", sidebarX, (doc as any).lastAutoTable.finalY + 2, 60);
      const teamGoals = events.filter(e => e.team_id === teamData?.id && e.event_type?.startsWith('goal'));
      const goalCols = 7;
      const goalRowsCount = 4;
      const goalsBody = [];
      for (let r = 0; r < goalRowsCount; r++) {
        const row = [];
        for (let c = 0; c < goalCols; c++) {
          const goalIdx = r * goalCols + c;
          const goal = teamGoals[goalIdx];
          
          let goalContent = '';
          if (goal) {
            if (goal.event_type === 'goal_2') goalContent = `(2pts) ${goal.event_time}`;
            else if (goal.event_type === 'goal_3') goalContent = `(3pts) ${goal.event_time}`;
            else goalContent = goal.event_time;
          }
          
          row.push({
            content: `${goalIdx + 1}\n${goalContent}`,
            styles: { fontSize: 5, minCellHeight: 10 }
          });
        }
        goalsBody.push(row);
      }

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 7,
        margin: { left: sidebarX },
        body: goalsBody,
        theme: 'grid',
        styles: { cellPadding: 0.5, halign: 'center' }
      });

      // Substitutions
      drawSectionHeader("Substituições", sidebarX, (doc as any).lastAutoTable.finalY + 2, 60);
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 7,
        margin: { left: sidebarX },
        head: [['', '1', '2', '3', '4', '5', '6', '7', '8', '9']],
        body: [
          ['Entrou', '', '', '', '', '', '', '', '', ''],
          ['Saiu', '', '', '', '', '', '', '', '', '']
        ],
        theme: 'grid',
        styles: { fontSize: 5, cellPadding: 1 },
        columnStyles: { 0: { cellWidth: 15 } }
      });

      // Footer of team block
      doc.setFontSize(8);
      doc.text(`Técnico: _____________________________________________`, margin, tableBottom + 5);
      doc.text(`Capitão: _____________________________________________`, sidebarX, (doc as any).lastAutoTable.finalY + 5);

      return Math.max(tableBottom + 15, (doc as any).lastAutoTable.finalY + 15);
    };

    // Draw blocks
    currentY = drawTeamBlock(match.team1, team1Athletes, true, currentY);
    
    // If not enough space, add page
    if (currentY > 180) {
      doc.addPage();
      currentY = margin;
    }
    
    currentY = drawTeamBlock(match.team2, team2Athletes, false, currentY);

    // GAME REPORT SECTION
    if (currentY > 200) {
      doc.addPage();
      currentY = margin;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("RELATÓRIO DA PARTIDA / OBSERVAÇÕES", margin, currentY + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const reportText = match.report || "Nenhuma observação registrada.";
    const splitReport = doc.splitTextToSize(reportText, pageWidth - (margin * 2));
    doc.text(splitReport, margin, currentY + 15);

    doc.save(`sumula_${match.team1?.institution?.name || 'Home'}_vs_${match.team2?.institution?.name || 'Away'}.pdf`);
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

  const updateJudoScore = async (teamId: string, type: 'yuko' | 'wazaari' | 'ippon' | 'shido' | 'hansokumake', increment: number) => {
    if (!match) return;
    const isTeam1 = match.team1_id === teamId;
    const currentDetail = match.sets_detail?.[0] || {
      team1_ippon: 0, team1_wazaari: 0, team1_yuko: 0, team1_shido: 0,
      team2_ippon: 0, team2_wazaari: 0, team2_yuko: 0, team2_shido: 0,
      osaekomi_team_id: null, osaekomi_start_time: null, osaekomi_base_seconds: 0,
      golden_score: false
    };

    const nextDetail = { ...currentDetail };
    const prefix = isTeam1 ? 'team1_' : 'team2_';
    const oppPrefix = isTeam1 ? 'team2_' : 'team1_';

    if (type === 'hansokumake') {
      nextDetail[prefix + 'shido'] = 3;
      nextDetail[oppPrefix + 'ippon'] = 1;
    } else {
      nextDetail[prefix + type] = Math.max(0, (nextDetail[prefix + type] || 0) + increment);
    }

    // Apply cumulative rules
    let matchFinished = false;
    let winnerId = null;
    let finishReason = "";

    // 1st Waza-ari awasete ippon
    if (nextDetail[prefix + 'wazaari'] >= 2) {
      nextDetail[prefix + 'ippon'] = 1;
      matchFinished = true;
      winnerId = teamId;
      finishReason = "Waza-ari-awasete-ippon";
    }

    // 3rd Shido = Hansoku-make
    if (nextDetail[prefix + 'shido'] >= 3) {
      nextDetail[oppPrefix + 'ippon'] = 1;
      matchFinished = true;
      winnerId = isTeam1 ? match.team2_id : match.team1_id;
      finishReason = "Desclassificação (Hansoku-make)";
    }

    // Direct Ippon
    if (nextDetail[prefix + 'ippon'] >= 1) {
      matchFinished = true;
      winnerId = teamId;
      finishReason = "Ippon";
    }

    // Check for Golden Score point finish
    const isGoldenScore = match.period === 'Golden Score' || nextDetail.golden_score;
    if (isGoldenScore && type !== 'shido' && increment > 0 && !matchFinished) {
      matchFinished = true;
      winnerId = teamId;
      finishReason = `Ponto de Ouro (${type.toUpperCase()})`;
    }

    // Update match state
    const updatedSets = [nextDetail];
    const eventTime = formatTime(timeRef.current);
    
    // Create event payload
    let eventType = `judo_${type}`;
    if (type === 'hansokumake') eventType = 'judo_hansokumake';

    // Register event in DB
    try {
      await fetch(`/api/tournaments/matches/${matchId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_id: teamId,
          event_type: eventType,
          event_time: eventTime,
          period: match.period || 'Tempo Regular'
        })
      });
    } catch (err) {
      console.error("Failed to log judo event:", err);
    }

    // Update scores of matches table to represent who won if match finished
    const patchPayload: any = {
      sets_detail: updatedSets
    };

    if (matchFinished) {
      patchPayload.status = 'finished';
      patchPayload.winner_id = winnerId;
      patchPayload.is_timer_running = false;
      patchPayload.period = 'Fim';
      patchPayload.report = (match.report || "") + `\nPartida encerrada por ${finishReason}.`;
      setIsActive(false);
      // Stop Osaekomi
      nextDetail.osaekomi_team_id = null;
      nextDetail.osaekomi_start_time = null;
      nextDetail.osaekomi_base_seconds = 0;
      setOsaekomiActive(false);
      setOsaekomiTeamId(null);
      setOsaekomiTime(0);
    }

    setMatch((prev: any) => ({
      ...prev,
      ...patchPayload,
      sets_detail: updatedSets
    }));

    try {
      await fetch(`/api/tournaments/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload)
      });
      fetchInitialData();
      onUpdatePlacar();
    } catch (err) {
      console.error("Failed to sync judo match state:", err);
    }
  };

  const handleOsaekomiThresholds = async (seconds: number) => {
    const currentMatch = matchRef.current;
    const currentOsaekomiTeamId = osaekomiTeamIdRef.current;
    if (!currentOsaekomiTeamId || !currentMatch) return;
    const isTeam1 = currentMatch.team1_id === currentOsaekomiTeamId;
    const prefix = isTeam1 ? 'team1_' : 'team2_';

    if (seconds === 5) {
      toastSuccess("Osaekomi: Yuko!");
      await updateJudoScore(currentOsaekomiTeamId, 'yuko', 1);
    } else if (seconds === 10) {
      toastSuccess("Osaekomi: Waza-ari!");
      
      const currentDetail = currentMatch.sets_detail?.[0] || {};
      const nextDetail = { ...currentDetail };
      nextDetail[prefix + 'yuko'] = Math.max(0, (nextDetail[prefix + 'yuko'] || 0) - 1);
      nextDetail[prefix + 'wazaari'] = (nextDetail[prefix + 'wazaari'] || 0) + 1;
      
      let matchFinished = false;
      let winnerId = null;
      let finishReason = "";
      if (nextDetail[prefix + 'wazaari'] >= 2) {
        nextDetail[prefix + 'ippon'] = 1;
        matchFinished = true;
        winnerId = currentOsaekomiTeamId;
        finishReason = "Waza-ari-awasete-ippon";
      }

      const eventTime = formatTime(timeRef.current);
      try {
        await fetch(`/api/tournaments/matches/${matchId}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            team_id: currentOsaekomiTeamId,
            event_type: 'judo_wazaari',
            event_time: eventTime,
            period: currentMatch.period || 'Tempo Regular'
          })
        });
      } catch (err) {
        console.error("Failed to log osaekomi wazaari:", err);
      }

      const updatedSets = [nextDetail];
      const patchPayload: any = { sets_detail: updatedSets };

      if (matchFinished) {
        patchPayload.status = 'finished';
        patchPayload.winner_id = winnerId;
        patchPayload.is_timer_running = false;
        patchPayload.period = 'Fim';
        patchPayload.report = (currentMatch.report || "") + `\nPartida encerrada por ${finishReason} via Osaekomi.`;
        setIsActive(false);
        setOsaekomiActive(false);
        setOsaekomiTeamId(null);
        setOsaekomiTime(0);
        nextDetail.osaekomi_team_id = null;
        nextDetail.osaekomi_start_time = null;
        nextDetail.osaekomi_base_seconds = 0;
      }

      setMatch((prev: any) => ({
        ...prev,
        ...patchPayload,
        sets_detail: updatedSets
      }));

      try {
        await fetch(`/api/tournaments/matches/${matchId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchPayload)
        });
        fetchInitialData();
        onUpdatePlacar();
      } catch (err) {
        console.error("Failed to sync osaekomi wazaari state:", err);
      }

    } else if (seconds === 20) {
      toastSuccess("Osaekomi: Ippon!");
      setOsaekomiActive(false);
      setOsaekomiTeamId(null);
      setOsaekomiTime(0);
      await updateJudoScore(currentOsaekomiTeamId, 'ippon', 1);
    }
  };

  const toggleOsaekomi = async (teamId: string | null) => {
    if (!match) return;
    
    const currentDetail = match.sets_detail?.[0] || {
      team1_ippon: 0, team1_wazaari: 0, team1_yuko: 0, team1_shido: 0,
      team2_ippon: 0, team2_wazaari: 0, team2_yuko: 0, team2_shido: 0,
      osaekomi_team_id: null, osaekomi_start_time: null, osaekomi_base_seconds: 0,
      golden_score: false
    };

    const nextDetail = { ...currentDetail };

    if (osaekomiActive || currentDetail.osaekomi_team_id) {
      // Stopping (Toketa)
      nextDetail.osaekomi_team_id = null;
      nextDetail.osaekomi_start_time = null;
      nextDetail.osaekomi_base_seconds = 0;
      
      setOsaekomiActive(false);
      setOsaekomiTeamId(null);
      setOsaekomiTime(0);
      toastWarning("Osaekomi interrompido (Toketa)!");
    } else if (teamId) {
      // Starting
      nextDetail.osaekomi_team_id = teamId;
      nextDetail.osaekomi_start_time = new Date().toISOString();
      nextDetail.osaekomi_base_seconds = 0;
      
      setOsaekomiActive(true);
      setOsaekomiTeamId(teamId);
      setOsaekomiTime(0);
      toastSuccess(`Osaekomi iniciado para ${teamId === match.team1_id ? 'Azul' : 'Branco'}!`);
    }

    const updatedSets = [nextDetail];
    setMatch((prev: any) => ({ ...prev, sets_detail: updatedSets }));

    try {
      await fetch(`/api/tournaments/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sets_detail: updatedSets })
      });
      onUpdatePlacar();
    } catch (err) {
      console.error("Failed to sync osaekomi toggle:", err);
    }
  };

  const updateKarateState = async (teamId: string, action: 'toggle_senshu' | 'increment_warning' | 'decrement_warning') => {
    if (!match) return;
    const isTeam1 = match.team1_id === teamId;
    const currentDetail = match.sets_detail?.[0] || {
      team1_senshu: false, team2_senshu: false,
      team1_warnings: 0, team2_warnings: 0
    };

    const nextDetail = { ...currentDetail };
    const prefix = isTeam1 ? 'team1_' : 'team2_';
    const oppPrefix = isTeam1 ? 'team2_' : 'team1_';

    if (action === 'toggle_senshu') {
      const currentSenshu = nextDetail[prefix + 'senshu'];
      nextDetail[prefix + 'senshu'] = !currentSenshu;
      if (!currentSenshu) {
        nextDetail[oppPrefix + 'senshu'] = false;
      }
    } else if (action === 'increment_warning') {
      nextDetail[prefix + 'warnings'] = Math.min(4, (nextDetail[prefix + 'warnings'] || 0) + 1);
      
      try {
        await fetch(`/api/tournaments/matches/${matchId}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            team_id: teamId,
            event_type: 'karate_warning',
            event_time: formatTime(timeRef.current),
            period: match.period || 'Tempo Regular'
          })
        });
      } catch (err) {
        console.error("Failed to log karate warning:", err);
      }

      if (nextDetail[prefix + 'warnings'] === 4) {
        toastWarning("Hansoku (4º Aviso) atingido! Desclassificação.");
        setIsActive(false);
        try {
          await fetch(`/api/tournaments/matches/${matchId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: 'finished',
              winner_id: isTeam1 ? match.team2_id : match.team1_id,
              is_timer_running: false,
              period: 'Fim',
              sets_detail: [nextDetail],
              report: (match.report || "") + `\nPartida encerrada por Hansoku (4º aviso de penalidade).`
            })
          });
          fetchInitialData();
          onUpdatePlacar();
          return;
        } catch (err) {
          console.error("Failed to disqualify in karate:", err);
        }
      }
    } else if (action === 'decrement_warning') {
      nextDetail[prefix + 'warnings'] = Math.max(0, (nextDetail[prefix + 'warnings'] || 0) - 1);
    }

    const updatedSets = [nextDetail];
    setMatch((prev: any) => ({ ...prev, sets_detail: updatedSets }));

    try {
      await fetch(`/api/tournaments/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sets_detail: updatedSets })
      });
      onUpdatePlacar();
    } catch (err) {
      console.error("Failed to sync karate state:", err);
    }
  };

  const handleKarateGapWin = async (winnerId: string) => {
    toastSuccess("Diferença de 8 pontos atingida! Fim da luta.");
    setIsActive(false);
    
    try {
      await fetch(`/api/tournaments/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'finished',
          winner_id: winnerId,
          is_timer_running: false,
          period: 'Fim',
          report: (matchRef.current?.report || "") + `\nPartida encerrada por superioridade de pontos (diferença de 8 pontos).`
        })
      });
      fetchInitialData();
      onUpdatePlacar();
    } catch (err) {
      console.error("Failed to finish karate match:", err);
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

  const getEventName = (type: string) => {
    if (sportType === 'judo') {
      if (type === 'judo_yuko') return "YUKO";
      if (type === 'judo_wazaari') return "WAZA-ARI";
      if (type === 'judo_ippon') return "IPPON";
      if (type === 'judo_shido') return "SHIDO";
      if (type === 'judo_hansokumake') return "HANSOKU-MAKE";
    }
    if (sportType === 'karate') {
      if (type === 'goal_1') return "YUKO";
      if (type === 'goal_2') return "WAZA-ARI";
      if (type === 'goal_3') return "IPPON";
      if (type === 'karate_warning') return "PENALIDADE (AVISO)";
    }
    if (type === 'goal') return "GOL/PONTO";
    if (type === 'goal_1') return "LANCE LIVRE (1PT)";
    if (type === 'goal_2') return "CESTA (2PTS)";
    if (type === 'goal_3') return "CESTA (3PTS)";
    if (type === 'yellow_card') return "CARTÃO AMARELO";
    if (type === 'red_card') return "CARTÃO VERMELHO";
    if (type === 'foul') return "FALTA";
    if (type === 'technical_foul') return "FALTA TÉCNICA";
    if (type === '2min') return "2 MINUTOS";
    if (type === 'timeout') return "PEDIDO DE TEMPO";
    if (type === 'point') return "PONTO";
    if (type === 'baleado_point') return "BALEADO";
    if (type === 'revive') return "SALVO";
    if (type === 'set_finished') return "FIM DE SET";
    return type.toUpperCase();
  };

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
  const isSetBased = sportType === 'volleyball' || sportType === 'dodgeball';
  const displayScore1 = sportType === 'dodgeball' && match?.status !== 'finished'
    ? Math.max(0, 10 - (match?.sets_detail?.[match?.sets_detail?.length - 1]?.team2 ?? 0))
    : isSetBased && match?.status !== 'finished'
      ? (match?.sets_detail?.[match?.sets_detail?.length - 1]?.team1 ?? 0)
      : (match?.score1 ?? 0);
  const displayScore2 = sportType === 'dodgeball' && match?.status !== 'finished'
    ? Math.max(0, 10 - (match?.sets_detail?.[match?.sets_detail?.length - 1]?.team1 ?? 0))
    : isSetBased && match?.status !== 'finished'
      ? (match?.sets_detail?.[match?.sets_detail?.length - 1]?.team2 ?? 0)
      : (match?.score2 ?? 0);

  const renderControls = (teamId: string, teamName: string) => {
    return (
      <div className="space-y-4">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-2 flex justify-between">
          {teamName}
        </h3>
        <div className="grid grid-cols-1 gap-3">
          
          {sportType === 'judo' && (
            <>
              {/* Judo Grid controls */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => updateJudoScore(teamId, 'yuko', 1)} className="flex flex-col items-center justify-center py-4 bg-yellow-550 text-slate-950 rounded-2xl shadow-sm hover:translate-y-[-2px] transition-all font-black">
                  <span className="text-xl leading-none mb-1">+1 Yuko</span>
                  <span className="text-[8px] uppercase tracking-widest font-bold">Vantagem Menor</span>
                </button>
                <button onClick={() => updateJudoScore(teamId, 'yuko', -1)} className="flex flex-col items-center justify-center py-2 bg-yellow-600/25 text-yellow-500 border border-yellow-500/20 rounded-xl hover:bg-yellow-600/30 transition-all font-bold text-[10px]">
                  <span>Estornar Yuko</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => updateJudoScore(teamId, 'wazaari', 1)} className="flex flex-col items-center justify-center py-4 bg-indigo-650 text-white rounded-2xl shadow-sm hover:translate-y-[-2px] transition-all font-black">
                  <span className="text-xl leading-none mb-1">+1 Waza-ari</span>
                  <span className="text-[8px] uppercase tracking-widest font-bold">Meio Ponto</span>
                </button>
                <button onClick={() => updateJudoScore(teamId, 'wazaari', -1)} className="flex flex-col items-center justify-center py-2 bg-indigo-600/25 text-indigo-300 border border-indigo-500/20 rounded-xl hover:bg-indigo-650/30 transition-all font-bold text-[10px]">
                  <span>Estornar Waza-ari</span>
                </button>
              </div>

              <button onClick={() => updateJudoScore(teamId, 'ippon', 1)} className="w-full flex flex-col items-center justify-center py-5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 rounded-2xl shadow-md hover:translate-y-[-2px] transition-all font-black">
                <span className="text-2xl leading-none mb-1">IPPON</span>
                <span className="text-[9px] uppercase tracking-wider">Vitória Imediata (Ponto Completo)</span>
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => updateJudoScore(teamId, 'shido', 1)} className="flex flex-col items-center justify-center py-4 bg-amber-650/20 text-amber-400 border border-amber-500/35 rounded-2xl shadow-sm hover:bg-amber-600/30 transition-all font-black">
                  <span className="text-lg leading-none mb-1">+1 Shido</span>
                  <span className="text-[8px] uppercase tracking-widest font-bold">Penalidade</span>
                </button>
                <button onClick={() => updateJudoScore(teamId, 'shido', -1)} className="flex flex-col items-center justify-center py-4 bg-slate-800 text-slate-300 border border-slate-700/60 rounded-2xl hover:bg-slate-750 transition-all font-bold text-[10px]">
                  <span>Estornar Shido</span>
                </button>
              </div>

              <button onClick={() => updateJudoScore(teamId, 'hansokumake', 1)} className="w-full flex items-center justify-center gap-2 py-3 bg-red-650/25 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-600 hover:text-white transition-all font-black uppercase text-[10px] tracking-widest">
                <AlertCircle size={14} />
                <span>Hansoku-make (DQ Direta)</span>
              </button>

              <div className="mt-4 pt-4 border-t border-slate-200/50">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-2">Controle de Imobilização</span>
                {osaekomiActive && osaekomiTeamId === teamId ? (
                  <button 
                    onClick={() => toggleOsaekomi(null)} 
                    className="w-full py-4 bg-red-650 text-white rounded-2xl shadow-md hover:bg-red-700 transition-all font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                  >
                    <span>TOKETA (ESCAPOU)</span>
                  </button>
                ) : (
                  <button 
                    onClick={() => toggleOsaekomi(teamId)} 
                    disabled={osaekomiActive}
                    className={`w-full py-4 rounded-2xl shadow-sm transition-all font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 border ${
                      osaekomiActive 
                        ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 border-blue-500 text-white"
                    }`}
                  >
                    <span>Iniciar Osaekomi</span>
                  </button>
                )}
              </div>
            </>
          )}

          {sportType === 'karate' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'goal_1' })} className="flex flex-col items-center justify-center py-4 bg-emerald-500 text-white rounded-2xl shadow-sm hover:translate-y-[-2px] transition-all font-black">
                  <span className="font-black text-xl leading-none mb-1">+1</span>
                  <span className="text-[8px] uppercase tracking-widest font-bold">Yuko</span>
                </button>
                <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'goal_2' })} className="flex flex-col items-center justify-center py-4 bg-indigo-650 text-white rounded-2xl shadow-sm hover:translate-y-[-2px] transition-all font-black">
                  <span className="font-black text-xl leading-none mb-1">+2</span>
                  <span className="text-[8px] uppercase tracking-widest font-bold">Waza-ari</span>
                </button>
                <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'goal_3' })} className="flex flex-col items-center justify-center py-4 bg-amber-500 text-slate-950 rounded-2xl shadow-sm hover:translate-y-[-2px] transition-all font-black">
                  <span className="font-black text-xl leading-none mb-1">+3</span>
                  <span className="text-[8px] uppercase tracking-widest font-bold">Ippon</span>
                </button>
              </div>

              <button 
                onClick={() => updateKarateState(teamId, 'toggle_senshu')} 
                className={`w-full py-4 rounded-2xl shadow-sm transition-all font-black text-xs uppercase tracking-widest border flex items-center justify-center gap-2 ${
                  (teamId === match.team1_id ? karateState?.team1_senshu : karateState?.team2_senshu)
                    ? "bg-amber-500 border-amber-400 text-slate-950"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750"
                }`}
              >
                <Target size={16} />
                <span>Vantagem Senshu</span>
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => updateKarateState(teamId, 'increment_warning')} className="flex flex-col items-center justify-center py-4 bg-orange-600/20 text-orange-400 border border-orange-500/30 rounded-2xl shadow-sm hover:bg-orange-600/30 transition-all font-black">
                  <span className="text-lg leading-none mb-1">+1 Falta</span>
                  <span className="text-[8px] uppercase tracking-widest font-bold">Aviso / Pen.</span>
                </button>
                <button onClick={() => updateKarateState(teamId, 'decrement_warning')} className="flex flex-col items-center justify-center py-4 bg-slate-850 text-slate-400 border border-slate-700/60 rounded-2xl hover:bg-slate-750 transition-all font-bold text-[10px]">
                  <span>Estornar Falta</span>
                </button>
              </div>
            </>
          )}

          {sportType === 'basketball' && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'goal_1' })} className="flex flex-col items-center justify-center py-4 bg-emerald-500 text-white rounded-2xl shadow-sm hover:translate-y-[-2px] transition-all">
                  <span className="font-black text-xl leading-none mb-1">+1</span>
                  <span className="text-[8px] uppercase tracking-widest font-bold">L. Livre</span>
                </button>
                <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'goal_2' })} className="flex flex-col items-center justify-center py-4 bg-emerald-500 text-white rounded-2xl shadow-sm hover:translate-y-[-2px] transition-all">
                  <span className="font-black text-xl leading-none mb-1">+2</span>
                  <span className="text-[8px] uppercase tracking-widest font-bold">Cesta</span>
                </button>
                <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'goal_3' })} className="flex flex-col items-center justify-center py-4 bg-emerald-500 text-white rounded-2xl shadow-sm hover:translate-y-[-2px] transition-all">
                  <span className="font-black text-xl leading-none mb-1">+3</span>
                  <span className="text-[8px] uppercase tracking-widest font-bold">3 Pts</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'foul' })} className="flex flex-col items-center justify-center p-4 bg-orange-500 text-white rounded-2xl shadow-sm">
                  <AlertTriangle size={20} className="mb-2" />
                  <span className="font-black text-[9px] uppercase tracking-widest text-center">Falta Pessoal</span>
                </button>
                <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'technical_foul' })} className="flex flex-col items-center justify-center p-4 bg-red-600 text-white rounded-2xl shadow-sm">
                  <span className="font-black text-[20px] uppercase leading-none mb-2">T</span>
                  <span className="font-black text-[9px] uppercase tracking-widest text-center">Falta Técnica</span>
                </button>
              </div>
              <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'timeout' })} className="flex flex-col items-center justify-center p-4 bg-slate-200 text-slate-700 rounded-2xl shadow-sm hover:bg-slate-300">
                  <Timer size={20} className="mb-2" />
                  <span className="font-black text-[10px] uppercase tracking-widest">Pedido de Tempo</span>
              </button>
            </>
          )}

          {sportType === 'volleyball' && (
            <>
              <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'point' })} className="flex items-center justify-between p-4 bg-emerald-500 text-white rounded-2xl shadow-sm hover:translate-y-[-2px] transition-all cursor-pointer">
                <span className="font-black text-sm uppercase tracking-widest">PONTO</span>
                <Trophy size={24} />
              </button>
              <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'timeout' })} className="flex flex-col items-center justify-center p-4 bg-slate-200 text-slate-700 rounded-2xl shadow-sm hover:bg-slate-300">
                  <Timer size={20} className="mb-2" />
                  <span className="font-black text-[10px] uppercase tracking-widest">Pedido de Tempo</span>
              </button>
            </>
          )}

          {sportType === 'dodgeball' && (
            <>
              <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'baleado_point', targetTeamId: teamId === match.team1_id ? match.team2_id : match.team1_id })} className="flex items-center justify-between p-4 bg-orange-600 text-white rounded-2xl shadow-sm hover:translate-y-[-2px] transition-all cursor-pointer">
                <span className="font-black text-sm uppercase tracking-widest">BALEAR OPONENTE</span>
                <Target size={24} />
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'yellow_card' })} className="flex flex-col items-center gap-2 p-4 bg-amber-400 text-white rounded-2xl shadow-sm cursor-pointer">
                  <div className="w-4 h-6 border-2 border-white/20 bg-amber-200 rounded-sm" />
                  <span className="font-black text-[10px] uppercase tracking-widest text-center">Amarelo</span>
                </button>
                <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'red_card' })} className="flex flex-col items-center gap-2 p-4 bg-red-500 text-white rounded-2xl shadow-sm cursor-pointer">
                  <div className="w-4 h-6 border-2 border-white/20 bg-red-200 rounded-sm" />
                  <span className="font-black text-[10px] uppercase tracking-widest text-center">Vermelho</span>
                </button>
              </div>
            </>
          )}

          {sportType === 'handball' && (
            <>
              <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'goal' })} className="flex items-center justify-between p-4 bg-emerald-500 text-white rounded-2xl shadow-sm hover:translate-y-[-2px] transition-all">
                <span className="font-black text-sm uppercase tracking-widest">GOL</span>
                <Trophy size={24} />
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'yellow_card' })} className="flex flex-col items-center gap-2 p-4 bg-amber-400 text-white rounded-2xl shadow-sm">
                  <div className="w-4 h-6 border-2 border-white/20 bg-amber-200 rounded-sm" />
                  <span className="font-black text-[9px] uppercase tracking-widest text-center">Amarelo</span>
                </button>
                <button onClick={() => setShowPlayerSelect({ teamId, eventType: '2min' })} className="flex flex-col items-center gap-2 p-4 bg-orange-500 text-white rounded-2xl shadow-sm">
                  <Timer size={24} />
                  <span className="font-black text-[9px] uppercase tracking-widest text-center">Exclusão 2M</span>
                </button>
              </div>
              <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'red_card' })} className="flex flex-col items-center gap-2 p-4 bg-red-500 text-white rounded-2xl shadow-sm">
                <div className="w-4 h-6 border-2 border-white/20 bg-red-200 rounded-sm" />
                <span className="font-black text-[10px] uppercase tracking-widest text-center">Desqualificação</span>
              </button>
              <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'timeout' })} className="flex flex-col items-center justify-center p-4 bg-slate-200 text-slate-700 rounded-2xl shadow-sm hover:bg-slate-300">
                  <Timer size={20} className="mb-2" />
                  <span className="font-black text-[10px] uppercase tracking-widest">Pedido de Tempo</span>
              </button>
            </>
          )}

          {(sportType === 'football' || sportType === 'futsal') && (
            <>
              <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'goal' })} className="flex items-center justify-between p-4 bg-emerald-500 text-white rounded-2xl shadow-sm hover:translate-y-[-2px] transition-all cursor-pointer">
                <span className="font-black text-sm uppercase tracking-widest">GOL</span>
                <Trophy size={24} />
              </button>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'yellow_card' })} className="flex flex-col items-center gap-2 p-4 bg-amber-400 text-white rounded-2xl shadow-sm cursor-pointer">
                  <div className="w-4 h-6 border-2 border-white/20 bg-amber-200 rounded-sm" />
                  <span className="font-black text-[10px] uppercase tracking-widest text-center">Amarelo</span>
                </button>
                <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'red_card' })} className="flex flex-col items-center gap-2 p-4 bg-red-500 text-white rounded-2xl shadow-sm cursor-pointer">
                  <div className="w-4 h-6 border-2 border-white/20 bg-red-200 rounded-sm" />
                  <span className="font-black text-[10px] uppercase tracking-widest text-center">Vermelho</span>
                </button>
              </div>
              <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'foul' })} className="flex items-center justify-between p-4 bg-slate-200 text-slate-700 rounded-2xl shadow-sm hover:bg-slate-300 transition-all cursor-pointer">
                <span className="font-black text-sm uppercase tracking-widest">FALTA</span>
                <AlertCircle size={24} />
              </button>
              {sportType === 'futsal' && (
                <button onClick={() => setShowPlayerSelect({ teamId, eventType: 'timeout' })} className="flex flex-col items-center justify-center p-4 bg-slate-200 text-slate-700 rounded-2xl shadow-sm hover:bg-slate-300 cursor-pointer">
                  <Timer size={20} className="mb-2" />
                  <span className="font-black text-[10px] uppercase tracking-widest">Pedido de Tempo</span>
                </button>
              )}
            </>
          )}

        </div>
      </div>
    );
  };

  if (loading || !match) return (
    <div className="flex items-center justify-center p-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  if (isMobileMode) {
    const activeTeamAthletes = selectedMobileTeamId === match.team1_id ? team1Athletes : team2Athletes;
    const activeTeamName = selectedMobileTeamId === match.team1_id 
      ? (match.team1?.institution?.name || "Time Mandante") 
      : (match.team2?.institution?.name || "Time Visitante");

    // Order recent events reverse for court-side glance (newest first)
    const recentEvents = [...events].reverse().slice(0, 4);

    return (
      <div className="min-h-[100dvh] bg-slate-950 text-slate-100 flex flex-col font-sans select-none overflow-x-hidden pb-8">
        {/* Top Header */}
        <div className="bg-slate-900 border-b border-slate-800 p-4 sticky top-0 z-20 flex items-center justify-between">
          <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-200">
            <ArrowLeft size={20} />
          </button>
          
          <div className="flex flex-col items-center">
            <span className="font-extrabold text-[11px] tracking-[0.2em] text-indigo-400 uppercase">Súmula de Bolso</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                {isOnline ? '● Conectado' : '● Modo Offline'}
              </span>
            </div>
          </div>

          <button 
            onClick={() => setIsMobileMode(false)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-500/30 transition-all shadow-sm"
          >
            <Sliders size={12} />
            <span>Painel</span>
          </button>
        </div>

        <OfflineBanner
          offlineQueueLength={offlineQueue.length}
          syncing={syncing}
          onSync={syncOfflineEvents}
        />

        {/* Pocket Scoreboard Section */}
        <div className="p-4 bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-900">
          <div className="grid grid-cols-3 items-center gap-2 mb-4">
            {/* Team 1 Panel */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-1 border border-slate-700/50 shadow-inner overflow-hidden">
                {match.team1?.institution?.logo_url ? (
                  <img src={match.team1.institution.logo_url} alt="Logo" className="w-full h-full object-contain p-1.5 bg-white" onError={(e: any) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }} />
                ) : null}
                <Shield className="text-slate-500" size={24} style={{ display: match.team1?.institution?.logo_url ? 'none' : 'block' }} />
              </div>
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider text-center line-clamp-1 w-full truncate">
                {getTeamDisplayName(match, 1)}
              </span>
              {sportType === 'judo' ? (
                <div className="flex flex-col items-center mt-1">
                  <div className="flex gap-1 text-[10px] font-black text-slate-350">
                    <span className="text-amber-400">I:{judoState?.team1_ippon || 0}</span>
                    <span>W:{judoState?.team1_wazaari || 0}</span>
                    <span className="text-yellow-500">Y:{judoState?.team1_yuko || 0}</span>
                  </div>
                  <span className="text-[8px] font-extrabold text-red-400 mt-0.5">S:{judoState?.team1_shido || 0}</span>
                </div>
              ) : (
                <span className="text-4xl font-black text-white mt-1">{displayScore1}</span>
              )}
              {sportType === 'karate' && karateState && (
                <div className="flex flex-col items-center gap-1 mt-1">
                  {karateState.team1_senshu && (
                    <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 rounded text-[7px] font-black tracking-widest uppercase">
                      ● S
                    </span>
                  )}
                  {karateState.team1_warnings > 0 && (
                    <div className="flex gap-0.5">
                      {Array.from({ length: karateState.team1_warnings }).map((_, i) => (
                        <span key={i} className="w-1.5 h-3 bg-orange-500 rounded-sm border border-orange-655" />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {isSetBased && match.status !== 'finished' && (
                <span className="text-[9px] font-bold text-indigo-400 mt-1 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                  Sets: {match.score1}
                </span>
              )}
              {sportType === 'futsal' && (
                <span className="text-[9px] font-bold text-orange-400 mt-1 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
                  Faltas: {getAccumulatedFouls(match.team1_id)}
                </span>
              )}
            </div>

            {/* Match Chrono Central Controller */}
            <div className="flex flex-col items-center bg-slate-900/55 p-3 rounded-2xl border border-slate-800 shadow-xl">
              <div className="flex items-center mb-1">
                <select 
                  value={match.period || (sportType === 'volleyball' ? '1º Set' : sportType === 'basketball' ? '1º Quarto' : 'Tempo Regular')}
                  onChange={(e) => {
                    const nextPeriod = e.target.value;
                    updatePeriod(nextPeriod);
                    if (sportType === 'judo') {
                      const currentDetail = match.sets_detail?.[0] || {};
                      const nextDetail = {
                        ...currentDetail,
                        golden_score: nextPeriod === 'Golden Score',
                        ...(nextPeriod === 'Golden Score' ? {
                          osaekomi_team_id: null,
                          osaekomi_start_time: null,
                          osaekomi_base_seconds: 0
                        } : {})
                      };
                      setMatch((prev: any) => ({ ...prev, sets_detail: [nextDetail] }));
                      if (nextPeriod === 'Golden Score') {
                        setTime(0);
                        syncTimer(0, isActive);
                        setOsaekomiActive(false);
                        setOsaekomiTeamId(null);
                        setOsaekomiTime(0);
                      }
                      fetch(`/api/tournaments/matches/${matchId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sets_detail: [nextDetail] })
                      }).catch(console.error);
                    }
                  }}
                  className="bg-slate-800 text-slate-100 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg border border-slate-700 outline-none"
                  disabled={match.status === 'finished'}
                >
                  {sportType === 'volleyball' ? (
                    <>
                      <option value="1º Set">1º Set</option>
                      <option value="2º Set">2º Set</option>
                      <option value="3º Set">3º Set</option>
                      <option value="4º Set">4º Set</option>
                      <option value="5º Set">5º Set</option>
                      <option value="Fim">Fim</option>
                    </>
                  ) : sportType === 'basketball' ? (
                    <>
                      <option value="1º Quarto">1º Quarto</option>
                      <option value="2º Quarto">2º Quarto</option>
                      <option value="Intervalo">Intervalo</option>
                      <option value="3º Quarto">3º Quarto</option>
                      <option value="4º Quarto">4º Quarto</option>
                      <option value="Prorrogação">Prorrogação</option>
                      <option value="Fim">Fim</option>
                    </>
                  ) : sportType === 'judo' ? (
                    <>
                      <option value="Tempo Regular">Tempo Regular</option>
                      <option value="Golden Score">Golden Score</option>
                      <option value="Fim">Fim</option>
                    </>
                  ) : sportType === 'karate' ? (
                    <>
                      <option value="Tempo Regular">Tempo Regular</option>
                      <option value="Prorrogação">Prorrogação</option>
                      <option value="Fim">Fim</option>
                    </>
                  ) : (
                    <>
                      <option value="1º Tempo">1º Tempo</option>
                      <option value="Intervalo">Intervalo</option>
                      <option value="2º Tempo">2º Tempo</option>
                      <option value="Prorrogação">Prorrogação</option>
                      <option value="Pênaltis">Pênaltis</option>
                      <option value="Fim">Fim</option>
                    </>
                  )}
                </select>
              </div>

              {sportType !== 'volleyball' && (
                <>
                  <span className="font-mono text-2xl font-black text-rose-500 tracking-wider my-1">{formatTime(time)}</span>

                  <div className="flex gap-2">
                    <button 
                      onClick={toggleTimer}
                      className={`p-2 rounded-full text-white transition-all shadow-md active:scale-95 ${
                        isActive ? "bg-red-500 shadow-red-500/20" : "bg-emerald-500 shadow-emerald-500/20"
                      }`}
                      title={isActive ? "Pausar" : "Iniciar"}
                    >
                      {isActive ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                    </button>
                    <button 
                      onClick={resetTimer}
                      className="p-2 bg-slate-800 hover:bg-slate-700 rounded-full border border-slate-700 active:scale-95 transition-colors"
                      title="Reseta Cronômetro"
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                </>
              )}

              {sportType === 'judo' && osaekomiActive && (
                <div className="flex flex-col items-center bg-blue-650/40 border border-blue-500/30 p-1.5 rounded-lg animate-pulse mt-2 w-full text-center">
                  <span className="text-[7px] font-black text-blue-300 uppercase tracking-widest leading-none">OSAEKOMI</span>
                  <span className="text-base font-mono font-black text-white mt-0.5">{osaekomiTime}s</span>
                </div>
              )}
            </div>

            {/* Team 2 Panel */}
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center mb-1 border border-slate-700/50 shadow-inner overflow-hidden">
                {match.team2?.institution?.logo_url ? (
                  <img src={match.team2.institution.logo_url} alt="Logo" className="w-full h-full object-contain p-1.5 bg-white" onError={(e: any) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }} />
                ) : null}
                <Shield className="text-slate-500" size={24} style={{ display: match.team2?.institution?.logo_url ? 'none' : 'block' }} />
              </div>
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider text-center line-clamp-1 w-full truncate">
                {getTeamDisplayName(match, 2)}
              </span>
              {sportType === 'judo' ? (
                <div className="flex flex-col items-center mt-1">
                  <div className="flex gap-1 text-[10px] font-black text-slate-350">
                    <span className="text-amber-400">I:{judoState?.team2_ippon || 0}</span>
                    <span>W:{judoState?.team2_wazaari || 0}</span>
                    <span className="text-yellow-500">Y:{judoState?.team2_yuko || 0}</span>
                  </div>
                  <span className="text-[8px] font-extrabold text-red-400 mt-0.5">S:{judoState?.team2_shido || 0}</span>
                </div>
              ) : (
                <span className="text-4xl font-black text-white mt-1">{displayScore2}</span>
              )}
              {sportType === 'karate' && karateState && (
                <div className="flex flex-col items-center gap-1 mt-1">
                  {karateState.team2_senshu && (
                    <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 rounded text-[7px] font-black tracking-widest uppercase">
                      ● S
                    </span>
                  )}
                  {karateState.team2_warnings > 0 && (
                    <div className="flex gap-0.5">
                      {Array.from({ length: karateState.team2_warnings }).map((_, i) => (
                        <span key={i} className="w-1.5 h-3 bg-orange-500 rounded-sm border border-orange-655" />
                      ))}
                    </div>
                  )}
                </div>
              )}
              {isSetBased && match.status !== 'finished' && (
                <span className="text-[9px] font-bold text-indigo-400 mt-1 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                  Sets: {match.score2}
                </span>
              )}
              {sportType === 'futsal' && (
                <span className="text-[9px] font-bold text-orange-400 mt-1 bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20">
                  Faltas: {getAccumulatedFouls(match.team2_id)}
                </span>
              )}
            </div>
          </div>

          {match.status !== 'finished' && (
            <div className="w-full space-y-2">
              {isSetBased && (
                <button 
                  onClick={handleOpenEndSetModal}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  Fechar / Fim do Set
                </button>
              )}
              {sportType === 'futsal' && match.period === '1º Tempo' && (
                <button 
                  onClick={handleEndFirstHalf}
                  className="w-full py-2 bg-orange-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  Encerrar 1º Tempo
                </button>
              )}
              {sportType === 'basketball' && match.period !== 'Fim' && (
                <button 
                  onClick={handleEndBasketballPeriod}
                  className="w-full py-2 bg-orange-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {getEndPeriodButtonLabel()}
                </button>
              )}
              <button 
                onClick={() => setShowFinishModal(true)}
                className="w-full py-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-xl font-black uppercase tracking-widest text-[10px] border border-red-500/30 shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Trophy size={12} />
                Finalizar Jogo
              </button>
            </div>
          )}
          
          {match.status === 'finished' && onNextMatch && (
            <div className="w-full mt-4">
              {nextMatchId ? (
                <button 
                  onClick={() => onNextMatch(nextMatchId)}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  Ir para o Próximo Jogo
                  <Play size={16} fill="currentColor" />
                </button>
              ) : (
                <div className="w-full py-3 bg-slate-800 text-slate-400 rounded-xl font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-2 border border-slate-700">
                  <span className="truncate">Nenhum próximo jogo nesta sede</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Giant Segmented Team Selector Tab */}
        <div className="p-3 bg-slate-900 border-b border-slate-800 grid grid-cols-2 gap-2">
          <button 
            onClick={() => setSelectedMobileTeamId(match.team1_id)}
            className={`py-3 px-4 rounded-xl font-black uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 border ${
              selectedMobileTeamId === match.team1_id
                ? "bg-indigo-600 text-white shadow-lg border-indigo-500"
                : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700/50"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" style={{ display: selectedMobileTeamId === match.team1_id ? 'block' : 'none' }} />
            <span className="truncate">{match.team1?.institution?.short_name || match.team1?.institution?.name || "Mandante"}</span>
          </button>
          <button 
            onClick={() => setSelectedMobileTeamId(match.team2_id)}
            className={`py-3 px-4 rounded-xl font-black uppercase tracking-wider text-xs transition-all flex items-center justify-center gap-2 border ${
              selectedMobileTeamId === match.team2_id
                ? "bg-violet-600 text-white shadow-lg border-violet-500"
                : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700/50"
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" style={{ display: selectedMobileTeamId === match.team2_id ? 'block' : 'none' }} />
            <span className="truncate">{match.team2?.institution?.short_name || match.team2?.institution?.name || "Visitante"}</span>
          </button>
        </div>

        {/* Quick Actions Tactile Panel */}
        <div className="flex-1 p-4 space-y-4 max-w-md mx-auto w-full">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 border-l-2 border-indigo-500">
            Ações Rápidas: {activeTeamName}
          </h4>

          <div className="grid grid-cols-1 gap-3">
            {/* Judo Controls in mobile view */}
            {sportType === 'judo' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => updateJudoScore(selectedMobileTeamId, 'yuko', 1)}
                    className="py-5 bg-yellow-500 text-slate-950 rounded-2xl active:scale-95 shadow font-black flex flex-col justify-center items-center h-20"
                  >
                    <span className="text-lg leading-none mb-1">+1 Yuko</span>
                    <span className="text-[7px] uppercase tracking-wider">Menor</span>
                  </button>
                  <button 
                    onClick={() => updateJudoScore(selectedMobileTeamId, 'wazaari', 1)}
                    className="py-5 bg-indigo-600 text-white rounded-2xl active:scale-95 shadow font-black flex flex-col justify-center items-center h-20"
                  >
                    <span className="text-lg leading-none mb-1">+1 Waza-ari</span>
                    <span className="text-[7px] uppercase tracking-wider">Meio Ponto</span>
                  </button>
                </div>

                <button 
                  onClick={() => updateJudoScore(selectedMobileTeamId, 'ippon', 1)}
                  className="py-5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 rounded-2xl active:scale-95 shadow-lg font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  IPPON 🥋
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => updateJudoScore(selectedMobileTeamId, 'shido', 1)}
                    className="py-4 bg-amber-600/20 text-amber-300 border border-amber-500/30 rounded-2xl active:scale-95 flex items-center justify-center gap-1.5 font-black uppercase text-xs"
                  >
                    +1 Shido
                  </button>
                  <button 
                    onClick={() => updateJudoScore(selectedMobileTeamId, 'shido', -1)}
                    className="py-4 bg-slate-800 text-slate-400 border border-slate-700/60 rounded-2xl active:scale-95 flex items-center justify-center gap-1.5 font-bold uppercase text-xs"
                  >
                    Voltar Shido
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800">
                  {osaekomiActive && osaekomiTeamId === selectedMobileTeamId ? (
                    <button 
                      onClick={() => toggleOsaekomi(null)}
                      className="w-full py-5 bg-red-650 text-white rounded-2xl active:scale-95 shadow-lg font-black uppercase text-sm tracking-wider flex items-center justify-center gap-2"
                    >
                      TOKETA (ESCAPOU)
                    </button>
                  ) : (
                    <button 
                      onClick={() => toggleOsaekomi(selectedMobileTeamId)}
                      disabled={osaekomiActive}
                      className={`w-full py-5 rounded-2xl active:scale-95 shadow font-black uppercase text-sm tracking-wider flex items-center justify-center gap-2 border ${
                        osaekomiActive
                          ? "bg-slate-900 border-slate-800 text-slate-650 cursor-not-allowed"
                          : "bg-blue-600 border-blue-500 text-white"
                      }`}
                    >
                      Iniciar Osaekomi
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Karate Controls in mobile view */}
            {sportType === 'karate' && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: 'goal_1' })}
                    className="py-5 bg-emerald-500 text-white rounded-2xl active:scale-95 shadow h-20 flex flex-col justify-center items-center font-black"
                  >
                    <span className="text-xl leading-none mb-1">+1</span>
                    <span className="text-[9px] uppercase tracking-wider text-center">Yuko</span>
                  </button>
                  <button 
                    onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: 'goal_2' })}
                    className="py-5 bg-indigo-650 text-white rounded-2xl active:scale-95 shadow h-20 flex flex-col justify-center items-center font-black"
                  >
                    <span className="text-xl leading-none mb-1">+2</span>
                    <span className="text-[9px] uppercase tracking-wider text-center">Waza-ari</span>
                  </button>
                  <button 
                    onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: 'goal_3' })}
                    className="py-5 bg-amber-500 text-slate-950 rounded-2xl active:scale-95 shadow h-20 flex flex-col justify-center items-center font-black"
                  >
                    <span className="text-xl leading-none mb-1">+3</span>
                    <span className="text-[9px] uppercase tracking-wider text-center">Ippon</span>
                  </button>
                </div>

                <button 
                  onClick={() => updateKarateState(selectedMobileTeamId, 'toggle_senshu')}
                  className={`w-full py-5 rounded-2xl active:scale-95 shadow font-black text-xs uppercase tracking-widest border flex items-center justify-center gap-2 ${
                    (selectedMobileTeamId === match.team1_id ? karateState?.team1_senshu : karateState?.team2_senshu)
                      ? "bg-amber-500 border-amber-400 text-slate-950"
                      : "bg-slate-800 border-slate-700 text-slate-400"
                  }`}
                >
                  <Target size={16} />
                  <span>Vantagem Senshu</span>
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => updateKarateState(selectedMobileTeamId, 'increment_warning')}
                    className="py-4 bg-orange-600/20 text-orange-300 border border-orange-500/30 rounded-2xl active:scale-95 flex items-center justify-center gap-1.5 font-black uppercase text-xs"
                  >
                    +1 Falta (Aviso)
                  </button>
                  <button 
                    onClick={() => updateKarateState(selectedMobileTeamId, 'decrement_warning')}
                    className="py-4 bg-slate-800 text-slate-400 border border-slate-700/60 rounded-2xl active:scale-95 flex items-center justify-center gap-1.5 font-bold uppercase text-xs"
                  >
                    Voltar Falta
                  </button>
                </div>
              </>
            )}

            {sportType === 'basketball' && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: 'goal_1' })}
                    className="py-5 bg-emerald-500 text-white rounded-2xl active:scale-95 shadow-lg hover:bg-emerald-400 h-24 flex flex-col justify-center items-center font-black"
                  >
                    <span className="text-2xl leading-none font-black mb-1">+1</span>
                    <span className="text-[9px] uppercase tracking-wider text-center">L. Livre</span>
                  </button>
                  <button 
                    onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: 'goal_2' })}
                    className="py-5 bg-teal-500 text-white rounded-2xl active:scale-95 shadow-lg hover:bg-teal-400 h-24 flex flex-col justify-center items-center font-black"
                  >
                    <span className="text-2xl leading-none font-black mb-1">+2</span>
                    <span className="text-[9px] uppercase tracking-wider text-center">2 Pontos</span>
                  </button>
                  <button 
                    onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: 'goal_3' })}
                    className="py-5 bg-sky-500 text-white rounded-2xl active:scale-95 shadow-lg hover:bg-sky-400 h-24 flex flex-col justify-center items-center font-black"
                  >
                    <span className="text-2xl leading-none font-black mb-1">+3</span>
                    <span className="text-[9px] uppercase tracking-wider text-center">3 Pontos</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: 'foul' })}
                    className="py-4 bg-slate-800 text-slate-200 border border-slate-700/60 rounded-2xl active:scale-95 hover:bg-slate-800/80 flex items-center justify-center gap-2 font-black uppercase text-xs tracking-wider font-sans"
                  >
                    <AlertTriangle size={16} className="text-amber-400" />
                    Falta Comum
                  </button>
                  <button 
                    onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: 'foul_technical' })}
                    className="py-4 bg-orange-600/20 text-orange-300 border border-orange-500/30 rounded-2xl active:scale-95 hover:bg-orange-600/30 flex items-center justify-center gap-2 font-black uppercase text-xs tracking-wider"
                  >
                    <AlertCircle size={16} />
                    Falta Técnica
                  </button>
                </div>
              </>
            )}

            {/* Volleyball Controls */}
            {sportType === 'volleyball' && (
              <div className="grid grid-cols-1 gap-3">
                <button 
                  onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: 'goal_1' })}
                  className="py-6 bg-emerald-500 text-white rounded-2xl active:scale-95 shadow-lg hover:bg-emerald-400 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <Trophy size={18} />
                  PONTO DO TIME (+1) 🏐
                </button>
              </div>
            )}

            {/* Dodgeball (Baleado) Controls */}
            {sportType === 'dodgeball' && (
              <>
                <button 
                  onClick={() => setShowPlayerSelect({ 
                    teamId: selectedMobileTeamId, 
                    eventType: 'baleado_point',
                    targetTeamId: selectedMobileTeamId === match.team1_id ? match.team2_id : match.team1_id
                  })}
                  className="py-6 bg-orange-600 text-white rounded-2xl active:scale-95 shadow-lg hover:bg-orange-500 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 mb-1 cursor-pointer"
                >
                  <Target size={18} />
                  BALEAR OPONENTE
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: 'yellow_card' })}
                    className="py-4 bg-amber-400 text-white font-extrabold rounded-2xl active:scale-95 text-[10px] uppercase tracking-wider flex flex-col items-center justify-center gap-1.5 shadow cursor-pointer"
                  >
                    <div className="w-4 h-6 border-2 border-white/20 bg-amber-200 rounded-sm" />
                    Amarelo
                  </button>
                  <button 
                    onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: 'red_card' })}
                    className="py-4 bg-red-500 text-white font-extrabold rounded-2xl active:scale-95 text-[10px] uppercase tracking-wider flex flex-col items-center justify-center gap-1.5 shadow cursor-pointer"
                  >
                    <div className="w-4 h-6 border-2 border-white/20 bg-red-200 rounded-sm" />
                    Vermelho
                  </button>
                </div>
              </>
            )}

            {/* Handball Controls */}
            {sportType === 'handball' && (
              <>
                <button 
                  onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: 'goal' })}
                  className="py-6 bg-emerald-500 text-white rounded-2xl active:scale-95 shadow-lg hover:bg-emerald-400 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 mb-1"
                >
                  <span className="text-xl">🤾</span>
                  GOL
                </button>
                <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: 'yellow_card' })}
                    className="py-4 bg-yellow-500 text-slate-900 font-extrabold rounded-2xl active:scale-95 text-[10px] uppercase tracking-wider flex flex-col items-center justify-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <div className="w-5 h-7 bg-yellow-400 rounded border border-yellow-500 shadow-sm" />
                    Amarelo
                  </button>
                  <button 
                    onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: '2min' })}
                    className="py-4 bg-orange-600 text-white font-extrabold rounded-2xl active:scale-95 text-[10px] uppercase tracking-wider flex flex-col items-center justify-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <Timer size={16} />
                    Exclusão 2'
                  </button>
                  <button 
                    onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: 'red_card' })}
                    className="py-4 bg-red-600 text-white font-extrabold rounded-2xl active:scale-95 text-[10px] uppercase tracking-wider flex flex-col items-center justify-center gap-1.5 shadow-md cursor-pointer"
                  >
                    <div className="w-5 h-7 bg-red-400 rounded border border-red-500 shadow-sm" />
                    Vermelho
                  </button>
                </div>
              </>
            )}

            {/* Football / Futsal / Default sport controls */}
            {(sportType === 'football' || sportType === 'futsal' || !['basketball', 'volleyball', 'handball', 'dodgeball', 'futsal'].includes(sportType)) && (
              <>
                <button 
                  onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: 'goal' })}
                  className="py-6 bg-emerald-500 text-white rounded-2xl active:scale-95 shadow-lg hover:bg-emerald-400 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 mb-1 cursor-pointer"
                >
                  GOL ⚽
                </button>
                <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: 'yellow_card' })}
                    className="py-4 bg-yellow-550 text-amber-950 font-extrabold rounded-2xl active:scale-95 text-[10px] uppercase tracking-wider flex flex-col items-center justify-center gap-1.5 shadow border border-yellow-500/30 cursor-pointer"
                  >
                    <div className="w-4 h-6 bg-yellow-400 rounded shadow-sm" />
                    Amarelo
                  </button>
                  <button 
                    onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: 'red_card' })}
                    className="py-4 bg-red-600 text-white font-extrabold rounded-2xl active:scale-95 text-[10px] uppercase tracking-wider flex flex-col items-center justify-center gap-1.5 shadow border border-red-500/20 cursor-pointer"
                  >
                    <div className="w-4 h-6 bg-red-500 rounded shadow-sm" />
                    Vermelho
                  </button>
                  <button 
                    onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: 'foul' })}
                    className="py-4 bg-slate-800 text-slate-200 border border-slate-700/70 font-extrabold rounded-2xl active:scale-95 text-[10px] uppercase tracking-wider flex flex-col items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <AlertCircle size={16} className="text-indigo-400" />
                    Falta
                  </button>
                </div>
                {sportType === 'futsal' && (
                  <button 
                    onClick={() => setShowPlayerSelect({ teamId: selectedMobileTeamId, eventType: 'timeout' })}
                    className="mt-3 w-full py-4 bg-slate-800 text-slate-200 border border-slate-700/70 font-extrabold rounded-2xl active:scale-95 text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Timer size={16} />
                    Pedido de Tempo
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Recent Events List Drawer Section */}
        <div className="p-4 mt-auto border-t border-slate-900 bg-slate-950 max-w-md mx-auto w-full">
          <div className="flex justify-between items-center mb-3">
            <h5 className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              LANÇAMENTOS RECENTES ({events.length})
            </h5>
            <span className="text-[9px] font-bold text-slate-500">Toque no lixo para estornar</span>
          </div>

          <EventLog
            events={events}
            recentOnly={true}
            team1Id={match.team1_id}
            team1Name={match.team1?.institution?.name || "MANDANTE"}
            team2Name={match.team2?.institution?.name || "VISITANTE"}
            onDeleteEvent={handleDeleteEvent}
            sportType={sportType}
          />
        </div>

        {/* Compact Fullscreen Select Athlete Overlay Modal */}
        <AnimatePresence>
          {showPlayerSelect && (() => {
            const displayTeamId = showPlayerSelect.targetTeamId || showPlayerSelect.teamId;
            const modalTeamAthletes = displayTeamId === match.team1_id ? team1Athletes : team2Athletes;
            const modalTeamName = displayTeamId === match.team1_id 
              ? (match.team1?.institution?.name || "Time Mandante") 
              : (match.team2?.institution?.name || "Time Visitante");
            
            return (
              <motion.div 
                initial={{ opacity: 0, y: "10%" }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: "15%" }}
                className="fixed inset-0 bg-slate-950/95 z-50 overflow-y-auto px-4 py-6 flex flex-col justify-start"
              >
                <div className="max-w-md mx-auto w-full flex flex-col h-full">
                  {/* Overlay Header */}
                  <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-800">
                    <div>
                      <h3 className="font-black text-emerald-400 text-xs uppercase tracking-widest leading-none mb-1">
                        {showPlayerSelect.eventType === 'baleado_point' ? "Quem foi baleado?" : getEventName(showPlayerSelect.eventType)}
                      </h3>
                      <p className="text-xs text-slate-400 truncate max-w-[250px]">
                        Registrar para: <span className="font-bold text-slate-300">{modalTeamName}</span>
                      </p>
                    </div>
                    <button 
                      onClick={() => setShowPlayerSelect(null)}
                      className="py-1 px-3 bg-slate-800 text-slate-300 font-extrabold text-[10px] uppercase tracking-widest border border-slate-700 rounded-xl"
                    >
                      Fechar
                    </button>
                  </div>

                  {/* Main Action Call (Standard collective option) */}
                  <button 
                    onClick={() => handleAddEvent(null)}
                    className="mb-4 w-full p-4 bg-slate-900 hover:bg-slate-850 active:bg-slate-800 rounded-2xl border border-slate-700/60 font-black text-slate-200 text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow"
                  >
                    <User size={14} className="text-indigo-400" />
                    Geral / Sem identificação individual
                  </button>

                  {/* Custom list description */}
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2 block px-1">
                    Selecione o Atleta ({modalTeamAthletes.length} cadastrados):
                  </span>

                  {modalTeamAthletes.length === 0 ? (
                    <div className="text-center py-12 border border-dashed border-slate-800 bg-slate-900/20 rounded-2xl text-slate-500 text-xs">
                      Nenhum atleta cadastrado nesta equipe.
                      <button 
                        onClick={() => handleAddEvent(null)}
                        className="mt-3 block mx-auto py-2 px-4 bg-indigo-600/30 text-indigo-400 rounded-xl text-[10px] font-black uppercase tracking-wider border border-indigo-500/20"
                      >
                        Registrar para o Coletivo
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 overflow-y-auto pr-1 flex-1 pb-10">
                      {modalTeamAthletes.map(athlete => (
                        <button 
                          key={athlete.id}
                          onClick={() => handleAddEvent(athlete.id)}
                          className="p-3 bg-slate-900 active:bg-slate-800 rounded-xl border border-slate-800/80 hover:border-slate-700 flex items-center gap-3 text-left transition-all active:scale-[0.98]"
                        >
                          <div className="w-8 h-8 rounded-full bg-indigo-950 border border-indigo-700/45 flex items-center justify-center text-xs text-indigo-300 font-black font-mono shrink-0">
                            {athlete.shirt_number || "—"}
                          </div>
                          <div className="truncate shrink">
                            <span className="text-slate-200 text-xs font-black truncate block">
                              {athlete.full_name || athlete.name}
                            </span>
                            <span className="text-[9px] text-slate-500 font-medium block">
                              Nº {athlete.shirt_number || "Não definido"}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Mobile-First Header */}
      <div className="bg-white border-b border-slate-100 p-4 sticky top-0 z-10 flex items-center justify-between">
        <button onClick={onBack} className="p-2 -ml-2 text-slate-400 hover:text-slate-600">
          <ArrowLeft size={24} />
        </button>
        <h2 className="font-black text-slate-800 text-sm uppercase tracking-widest">Painel do Mesário</h2>
        <div className="flex items-center gap-2">
          {/* Connection status dot */}
          <div className="flex items-center gap-1.5 mr-2 hidden md:flex">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-[9px] font-bold text-slate-400 capitalize">
              {isOnline ? 'conectado' : 'offline'}
            </span>
          </div>

          <button 
            onClick={() => setIsMobileMode(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 border border-indigo-100 hover:bg-indigo-100/60 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm"
            title="Entrar no Modo Árbitro Simples"
          >
            <Smartphone size={14} />
            <span>Modo Árbitro ⚡</span>
          </button>

          <button 
            onClick={() => {
              if (match?.tournament_id && match?.venue_id) {
                window.open(`/public/tournament/${match.tournament_id}/venue/${match.venue_id}/live`, '_blank');
              } else {
                window.open(`/public/match/${matchId}`, '_blank');
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
            title="Abrir Placar Público da Sede"
          >
            <ExternalLink size={14} />
            <span className="hidden sm:inline">Placar Público</span>
          </button>
          <button onClick={exportSumula} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Exportar Súmula PDF">
            <FileText size={24} />
          </button>
        </div>
      </div>

      {/* Scoreboard Section */}
      <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex flex-col items-center flex-1">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-2 overflow-hidden">
              {match.team1?.institution?.logo_url ? (
                <img src={match.team1.institution.logo_url} alt="Logo" className="w-full h-full object-contain p-2 bg-white" onError={(e: any) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }} />
              ) : null}
              <Shield className="text-white/40" size={32} style={{ display: match.team1?.institution?.logo_url ? 'none' : 'block' }} />
            </div>
            <div className="flex flex-col items-center">
              {sportType === 'judo' && (
                <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-[8px] font-black uppercase tracking-wider mb-1">
                  Ao (Azul)
                </span>
              )}
              {sportType === 'karate' && (
                <span className="px-2 py-0.5 bg-red-650 text-white rounded text-[8px] font-black uppercase tracking-wider mb-1">
                  Aka (Vermelho)
                </span>
              )}
              <span className="text-[10px] uppercase font-black text-white/50 tracking-widest text-center h-8 leading-tight">
                {getTeamDisplayName(match, 1)}
              </span>
            </div>
            
            {sportType === 'judo' ? (
              <div className="grid grid-cols-4 gap-2 text-center mt-2 bg-black/20 p-2 rounded-xl border border-white/5">
                <div className="flex flex-col w-12">
                  <span className="text-[8px] font-black text-amber-400">I</span>
                  <span className="text-xl font-black text-white">{judoState?.team1_ippon || 0}</span>
                </div>
                <div className="flex flex-col w-12">
                  <span className="text-[8px] font-black text-indigo-400">W</span>
                  <span className="text-xl font-black text-white">{judoState?.team1_wazaari || 0}</span>
                </div>
                <div className="flex flex-col w-12">
                  <span className="text-[8px] font-black text-yellow-500">Y</span>
                  <span className="text-xl font-black text-white">{judoState?.team1_yuko || 0}</span>
                </div>
                <div className="flex flex-col w-12">
                  <span className="text-[8px] font-black text-red-400">S</span>
                  <span className="text-xl font-black text-white">{judoState?.team1_shido || 0}</span>
                </div>
              </div>
            ) : (
              <span className="text-6xl font-black">{displayScore1}</span>
            )}

            {sportType === 'karate' && karateState && (
              <div className="flex flex-col items-center mt-2 gap-1.5">
                {karateState.team1_senshu && (
                  <span className="px-2.5 py-0.5 bg-amber-500 text-slate-950 rounded-full text-[8px] font-black tracking-widest uppercase shadow">
                    ● SENSHU
                  </span>
                )}
                {karateState.team1_warnings > 0 && (
                  <div className="flex gap-1">
                    {Array.from({ length: karateState.team1_warnings }).map((_, i) => (
                      <span key={i} className="w-2 h-3.5 bg-orange-500 rounded-sm border border-orange-655" />
                    ))}
                  </div>
                )}
              </div>
            )}

            {isSetBased && match.status !== 'finished' && (
              <span className="text-xs font-bold text-indigo-400 mt-2 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                Sets: {match.score1}
              </span>
            )}
            {sportType === 'futsal' && (
              <span className="text-xs font-bold text-orange-400 mt-2 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20">
                Faltas: {getAccumulatedFouls(match.team1_id)}
              </span>
            )}
          </div>
          
          <div className="flex flex-col items-center gap-4">
            <span className="text-2xl font-black text-white/20">X</span>
            
            {/* Period Indicator */}
            <div className="flex flex-col items-center">
              <select 
                value={match.period || (sportType === 'volleyball' ? '1º Set' : sportType === 'basketball' ? '1º Quarto' : 'Tempo Regular')}
                onChange={(e) => {
                  const nextPeriod = e.target.value;
                  updatePeriod(nextPeriod);
                  if (sportType === 'judo') {
                    // Update sets_detail to mark golden_score
                    const currentDetail = match.sets_detail?.[0] || {};
                    const nextDetail = {
                      ...currentDetail,
                      golden_score: nextPeriod === 'Golden Score',
                      ...(nextPeriod === 'Golden Score' ? {
                        // Reset osaekomi
                        osaekomi_team_id: null,
                        osaekomi_start_time: null,
                        osaekomi_base_seconds: 0
                      } : {})
                    };
                    setMatch((prev: any) => ({ ...prev, sets_detail: [nextDetail] }));
                    if (nextPeriod === 'Golden Score') {
                      setTime(0);
                      syncTimer(0, isActive);
                      setOsaekomiActive(false);
                      setOsaekomiTeamId(null);
                      setOsaekomiTime(0);
                    }
                    fetch(`/api/tournaments/matches/${matchId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ sets_detail: [nextDetail] })
                    }).catch(console.error);
                  }
                }}
                className="bg-white/10 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-white/20 outline-none hover:bg-white/20 transition-colors"
                disabled={match.status === 'finished'}
              >
                {sportType === 'volleyball' ? (
                  <>
                    <option value="1º Set" className="bg-slate-900">1º Set</option>
                    <option value="2º Set" className="bg-slate-900">2º Set</option>
                    <option value="3º Set" className="bg-slate-900">3º Set</option>
                    <option value="4º Set" className="bg-slate-900">4º Set</option>
                    <option value="5º Set" className="bg-slate-900">5º Set</option>
                    <option value="Fim" className="bg-slate-900">Fim</option>
                  </>
                ) : sportType === 'basketball' ? (
                  <>
                    <option value="1º Quarto" className="bg-slate-900">1º Quarto</option>
                    <option value="2º Quarto" className="bg-slate-900">2º Quarto</option>
                    <option value="Intervalo" className="bg-slate-900">Intervalo</option>
                    <option value="3º Quarto" className="bg-slate-900">3º Quarto</option>
                    <option value="4º Quarto" className="bg-slate-900">4º Quarto</option>
                    <option value="Prorrogação" className="bg-slate-900">Prorrogação</option>
                    <option value="Fim" className="bg-slate-900">Fim</option>
                  </>
                ) : sportType === 'judo' ? (
                  <>
                    <option value="Tempo Regular" className="bg-slate-900">Tempo Regular</option>
                    <option value="Golden Score" className="bg-slate-900">Golden Score</option>
                    <option value="Fim" className="bg-slate-900">Fim</option>
                  </>
                ) : sportType === 'karate' ? (
                  <>
                    <option value="Tempo Regular" className="bg-slate-900">Tempo Regular</option>
                    <option value="Prorrogação" className="bg-slate-900">Prorrogação</option>
                    <option value="Fim" className="bg-slate-900">Fim</option>
                  </>
                ) : (
                  <>
                    <option value="1º Tempo" className="bg-slate-900">1º Tempo</option>
                    <option value="Intervalo" className="bg-slate-900">Intervalo</option>
                    <option value="2º Tempo" className="bg-slate-900">2º Tempo</option>
                    <option value="Prorrogação" className="bg-slate-900">Prorrogação</option>
                    <option value="Pênaltis" className="bg-slate-900">Pênaltis</option>
                    <option value="Fim" className="bg-slate-900">Fim</option>
                  </>
                )}
              </select>
            </div>

            <div className="flex flex-col items-center bg-white/10 px-4 py-2 rounded-xl">
              <Timer size={16} className="text-indigo-400 mb-1" />
              <span className="font-mono text-xl font-bold">{formatTime(time)}</span>
            </div>

            {sportType === 'judo' && osaekomiActive && (
              <div className="flex flex-col items-center bg-blue-650/40 border border-blue-500/30 px-6 py-3 rounded-2xl animate-pulse mt-2 w-44">
                <span className="text-[8px] font-black text-blue-300 tracking-widest uppercase">OSAEKOMI</span>
                <span className="text-2xl font-mono font-black text-white mt-0.5">{osaekomiTime}s</span>
                <span className="text-[8px] text-slate-350 font-bold uppercase mt-0.5">
                  {osaekomiTeamId === match.team1_id ? "AO (AZUL)" : "SHIRO (BRANCO)"}
                </span>
                <button 
                  onClick={() => toggleOsaekomi(null)}
                  className="mt-2 py-1 px-3 bg-red-650 hover:bg-red-700 text-white rounded-lg text-[8px] font-bold uppercase tracking-wider"
                >
                  Toketa
                </button>
              </div>
            )}
          </div>

          <div className="flex flex-col items-center flex-1">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-2 overflow-hidden">
              {match.team2?.institution?.logo_url ? (
                <img src={match.team2.institution.logo_url} alt="Logo" className="w-full h-full object-contain p-2 bg-white" onError={(e: any) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }} />
              ) : null}
              <Shield className="text-white/40" size={32} style={{ display: match.team2?.institution?.logo_url ? 'none' : 'block' }} />
            </div>
            <div className="flex flex-col items-center">
              {sportType === 'judo' && (
                <span className="px-2 py-0.5 bg-white text-slate-900 border border-slate-300 rounded text-[8px] font-black uppercase tracking-wider mb-1">
                  Shiro (Branco)
                </span>
              )}
              {sportType === 'karate' && (
                <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-[8px] font-black uppercase tracking-wider mb-1">
                  Ao (Azul)
                </span>
              )}
              <span className="text-[10px] uppercase font-black text-white/50 tracking-widest text-center h-8 leading-tight">
                {getTeamDisplayName(match, 2)}
              </span>
            </div>
            
            {sportType === 'judo' ? (
              <div className="grid grid-cols-4 gap-2 text-center mt-2 bg-black/20 p-2 rounded-xl border border-white/5">
                <div className="flex flex-col w-12">
                  <span className="text-[8px] font-black text-red-400">S</span>
                  <span className="text-xl font-black text-white">{judoState?.team2_shido || 0}</span>
                </div>
                <div className="flex flex-col w-12">
                  <span className="text-[8px] font-black text-yellow-500">Y</span>
                  <span className="text-xl font-black text-white">{judoState?.team2_yuko || 0}</span>
                </div>
                <div className="flex flex-col w-12">
                  <span className="text-[8px] font-black text-indigo-400">W</span>
                  <span className="text-xl font-black text-white">{judoState?.team2_wazaari || 0}</span>
                </div>
                <div className="flex flex-col w-12">
                  <span className="text-[8px] font-black text-amber-400">I</span>
                  <span className="text-xl font-black text-white">{judoState?.team2_ippon || 0}</span>
                </div>
              </div>
            ) : (
              <span className="text-6xl font-black">{displayScore2}</span>
            )}

            {sportType === 'karate' && karateState && (
              <div className="flex flex-col items-center mt-2 gap-1.5">
                {karateState.team2_senshu && (
                  <span className="px-2.5 py-0.5 bg-amber-500 text-slate-950 rounded-full text-[8px] font-black tracking-widest uppercase shadow">
                    ● SENSHU
                  </span>
                )}
                {karateState.team2_warnings > 0 && (
                  <div className="flex gap-1">
                    {Array.from({ length: karateState.team2_warnings }).map((_, i) => (
                      <span key={i} className="w-2 h-3.5 bg-orange-500 rounded-sm border border-orange-655" />
                    ))}
                  </div>
                )}
              </div>
            )}

            {isSetBased && match.status !== 'finished' && (
              <span className="text-xs font-bold text-indigo-400 mt-2 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
                Sets: {match.score2}
              </span>
            )}
            {sportType === 'futsal' && (
              <span className="text-xs font-bold text-orange-400 mt-2 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20">
                Faltas: {getAccumulatedFouls(match.team2_id)}
              </span>
            )}
          </div>
        </div>

        {/* Timer Controls */}
        <div className="flex justify-center gap-4">
          {sportType !== 'volleyball' && (
            <>
              <button 
                onClick={toggleTimer}
                className={`flex items-center gap-2 px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${
                  isActive ? "bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/20" : "bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                }`}
              >
                {isActive ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                {isActive ? "Pausar" : "Iniciar"}
              </button>
              <button 
                onClick={resetTimer}
                className="flex items-center gap-2 px-4 py-3 bg-white/10 hover:bg-white/20 rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
              >
                <RotateCcw size={16} />
              </button>
            </>
          )}

          {match.status !== 'finished' && (
            <div className="flex gap-2">
              {isSetBased && (
                <button 
                  onClick={handleOpenEndSetModal}
                  className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 rounded-2xl font-black uppercase tracking-widest text-xs transition-all cursor-pointer"
                >
                  Fechar Set
                </button>
              )}
              {sportType === 'futsal' && match.period === '1º Tempo' && (
                <button 
                  onClick={handleEndFirstHalf}
                  className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-600/20 rounded-2xl font-black uppercase tracking-widest text-xs transition-all cursor-pointer"
                >
                  Encerrar 1º Tempo
                </button>
              )}
              {sportType === 'basketball' && match.period !== 'Fim' && (
                <button 
                  onClick={handleEndBasketballPeriod}
                  className="flex items-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-600/20 rounded-2xl font-black uppercase tracking-widest text-xs transition-all cursor-pointer"
                >
                  {getEndPeriodButtonLabel()}
                </button>
              )}
              <button 
                onClick={() => setShowFinishModal(true)}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 rounded-2xl font-black uppercase tracking-widest text-xs transition-all cursor-pointer"
              >
                Finalizar Jogo
              </button>
            </div>
          )}

          {match.status === 'finished' && onNextMatch && (
            <div className="flex gap-2 mt-4">
              {nextMatchId ? (
                <button 
                  onClick={() => onNextMatch(nextMatchId)}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 rounded-2xl font-black uppercase tracking-widest text-xs transition-all cursor-pointer"
                >
                  Ir para o Próximo Jogo
                  <Play size={16} fill="currentColor" />
                </button>
              ) : (
                <div className="flex items-center gap-2 px-6 py-3 bg-slate-800 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] border border-slate-700">
                  <span className="truncate">Nenhum próximo jogo nesta sede</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Areas */}
      <div className="flex-1 p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Team 1 Controls */}
        {renderControls(match.team1_id, match.team1?.institution?.name || "MANDANTE")}

        {/* Middle Column: Match History */}
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[500px] lg:h-auto">
          <div className="bg-slate-50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-widest">Timeline do Jogo</h4>
            <Clock size={16} className="text-slate-400" />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <EventLog
              events={events}
              recentOnly={false}
              team1Id={match.team1_id}
              team1Name={match.team1?.institution?.name || "MANDANTE"}
              team2Name={match.team2?.institution?.name || "VISITANTE"}
              onDeleteEvent={handleDeleteEvent}
              sportType={sportType}
            />
          </div>
        </div>

        {/* Right Column: Team 2 Controls */}
        {renderControls(match.team2_id, match.team2?.institution?.name || "VISITANTE")}
      </div>

      {/* Player Selection Modal */}
      <AnimatePresence>
        {showPlayerSelect && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-white w-full max-w-md rounded-t-[2.5rem] md:rounded-[2.5rem] overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">
                    {showPlayerSelect.eventType === 'goal' ? "Quem marcou o gol?" : 
                     showPlayerSelect.eventType === 'foul' ? "Quem cometeu a falta?" : 
                     showPlayerSelect.eventType === 'baleado_point' ? "Quem foi baleado?" : "Para qual jogador?"}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                    {(showPlayerSelect.targetTeamId || showPlayerSelect.teamId) === match.team1_id ? match.team1?.institution?.name : match.team2?.institution?.name}
                  </p>
                </div>
                <button onClick={() => setShowPlayerSelect(null)} className="p-2 text-slate-300 hover:text-slate-600">
                  <ArrowLeft size={24} className="rotate-90 md:rotate-0" />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-4 grid grid-cols-1 gap-2">
                {/* Debug info - hidden in production but useful for now */}
                {process.env.NODE_ENV !== "production" && (
                  <div className="text-[8px] text-slate-300 mb-2 truncate">
                    ID: {showPlayerSelect.targetTeamId || showPlayerSelect.teamId} | Count: {((showPlayerSelect.targetTeamId || showPlayerSelect.teamId) === match.team1_id ? team1Athletes : team2Athletes).length}
                  </div>
                )}


                
                {(((showPlayerSelect.targetTeamId || showPlayerSelect.teamId) === match.team1_id ? team1Athletes : team2Athletes) || []).length === 0 && (
                  <div className="p-8 text-center text-slate-400 italic text-sm">
                    Nenhum jogador encontrado para este time. <br/>
                    Verifique as inscrições da categoria.
                  </div>
                )}

                {((showPlayerSelect.targetTeamId || showPlayerSelect.teamId) === match.team1_id ? team1Athletes : team2Athletes).map((athlete) => {
                  const displayTeamId = showPlayerSelect.targetTeamId || showPlayerSelect.teamId;
                  const rosterInfo = (displayTeamId === match.team1_id ? match?.roster1 : match?.roster2) || {};
                  const playerMeta = rosterInfo[athlete.id] || {};
                  
                  return (
                  <button 
                    key={athlete.id}
                    onClick={() => handleAddEvent(athlete.id)}
                    className="flex items-center gap-4 p-4 hover:bg-indigo-50 rounded-2xl border border-transparent hover:border-indigo-100 transition-all text-left"
                  >
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-800 font-black text-lg relative">
                      {playerMeta.jerseyNumber || <User size={20} className="text-slate-400" />}
                      {playerMeta.isCaptain && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center text-[8px] font-black text-amber-900 border border-white">C</div>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-slate-700">{athlete.full_name || athlete.name}</div>
                      <div className="text-[10px] text-slate-400">DOC: {athlete.document_number || "---"}</div>
                    </div>
                  </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Finish Match Modal */}
      <AnimatePresence>
        {showFinishModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">Finalizar Partida</h3>
                <p className="text-slate-500 text-sm">O resultado final será consolidado e o cronômetro será parado. Você pode adicionar um relatório ou observações abaixo.</p>
              </div>
              
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Trophy size={14} className="text-yellow-500" />
                    Jogador Destaque da Partida (Opcional)
                  </label>
                  <select
                    value={mvpAthleteId}
                    onChange={(e) => setMvpAthleteId(e.target.value)}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="">Selecione o jogador destaque...</option>
                    {team1Athletes.length > 0 && (
                      <optgroup label={match?.team1?.institution?.name || "Time Mandante"}>
                        {team1Athletes.map(a => (
                          <option key={a.id} value={a.id}>{a.full_name || a.name}</option>
                        ))}
                      </optgroup>
                    )}
                    {team2Athletes.length > 0 && (
                      <optgroup label={match?.team2?.institution?.name || "Time Visitante"}>
                        {team2Athletes.map(a => (
                          <option key={a.id} value={a.id}>{a.full_name || a.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Relatório da Partida (Opcional)</label>
                  <textarea 
                    value={gameReport}
                    onChange={(e) => setGameReport(e.target.value)}
                    placeholder="Digite observações sobre o jogo, interrupções, expulsões ou conduta das equipes..."
                    className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 text-sm outline-none focus:border-indigo-500 transition-colors resize-none"
                  />
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowFinishModal(false)}
                    className="flex-1 py-4 px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={finishMatch}
                    className="flex-3 py-4 px-6 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-red-600/20 transition-all flex items-center justify-center gap-2"
                  >
                    Confirmar e Encerrar
                    <Trophy size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* End Set Modal */}
      <AnimatePresence>
        {showEndSetModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-slate-100">
                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">Finalizar Set</h3>
                <p className="text-slate-500 text-sm">Confirme o resultado do set atual e declare o vencedor.</p>
              </div>
              
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Vencedor do Set</label>
                  <select
                    value={endSetWinnerId}
                    onChange={(e) => setEndSetWinnerId(e.target.value)}
                    className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
                  >
                    <option value="">Selecione o vencedor...</option>
                    <option value={match?.team1_id}>{match?.team1?.institution?.name || "Time Mandante"}</option>
                    <option value={match?.team2_id}>{match?.team2?.institution?.name || "Time Visitante"}</option>
                  </select>
                </div>

                {sportType === 'dodgeball' && (
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tipo de Vitória (Baleado)</label>
                    <select
                      value={endSetWinType}
                      onChange={(e) => setEndSetWinType(e.target.value)}
                      className="w-full h-12 px-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-sm font-bold outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="elimination">Eliminação Completa (10 baleados - 3 pts)</option>
                      <option value="time_limit">Tempo Limite Expirado / Morte Súbita (2 pts)</option>
                    </select>
                  </div>
                )}

                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowEndSetModal(false)}
                    className="flex-1 py-4 px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={confirmEndSet}
                    disabled={!endSetWinnerId}
                    className="flex-3 py-4 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Confirmar e Fechar Set
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LiveMatchRoom;
