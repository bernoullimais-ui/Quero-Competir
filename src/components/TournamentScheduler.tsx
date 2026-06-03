import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, Shield, UserCheck, Save, CheckCircle, Clock, Filter, Printer, AlertTriangle, LayoutGrid, List } from 'lucide-react';
import { motion } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TournamentSchedulerProps {
  tournamentId: string;
  mode: "schedule" | "refereeing";
}

export default function TournamentScheduler({ tournamentId, mode }: TournamentSchedulerProps) {
  const [matches, setMatches] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [venues, setVenues] = useState<any[]>([]);
  const [teamAthleteMap, setTeamAthleteMap] = useState<{ [teamId: string]: string[] }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updates, setUpdates] = useState<{ [matchId: string]: any }>({});
  const [message, setMessage] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [viewType, setViewType] = useState<"list" | "board">("board");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [draggedMatchId, setDraggedMatchId] = useState<string | null>(null);

  // States para o Gerador Inteligente de Tabelas
  const [isAutoSchedulerOpen, setIsAutoSchedulerOpen] = useState(false);
  const [autoScheduleParams, setAutoScheduleParams] = useState({
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    matchDuration: 60,
    dailyStartTime: '08:00',
    dailyEndTime: '20:00',
    maxGamesPerDay: 2,
    onlyUnscheduled: true,
    selectedVenues: [] as string[]
  });
  const [scheduling, setScheduling] = useState(false);

  const getDayString = (date: Date) => {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return days[date.getDay()];
  };

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

  const formatDateTimeLocal = (scheduledTime: string | null) => {
    if (!scheduledTime) return "";
    const localDate = parseLocalTime(scheduledTime);
    if (!localDate) return "";
    const yyyy = localDate.getFullYear();
    const mm = String(localDate.getMonth() + 1).padStart(2, '0');
    const dd = String(localDate.getDate()).padStart(2, '0');
    const hh = String(localDate.getHours()).padStart(2, '0');
    const min = String(localDate.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  const isTimeInRange = (timeHour: number, timeMin: number, start: string, end: string, durationMin = 0) => {
    if (!start || !end || !start.includes(':') || !end.includes(':')) return false;
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const timeVal = timeHour * 60 + timeMin;
    const startVal = startH * 60 + startM;
    const endVal = endH * 60 + endM;
    // Início >= abertura E fim (início + duração) <= fechamento
    return timeVal >= startVal && (timeVal + durationMin) <= endVal;
  };

  // Duração efetiva das partidas — persiste no localStorage para sobreviver a reloads
  const effectiveMatchDuration = React.useMemo(() => {
    const stored = localStorage.getItem('lastMatchDuration');
    return stored ? parseInt(stored, 10) : autoScheduleParams.matchDuration;
  }, [autoScheduleParams.matchDuration]);

  const getMatchConflicts = (matchId: string) => {
    const conflicts: string[] = [];
    
    // Calcula o estado atual de todas as partidas (considerando atualizações não salvas)
    const computedMatches = matches.map(m => ({
      ...m,
      ...(updates[m.id] || {})
    }));

    const match = computedMatches.find(m => m.id === matchId);
    if (!match || !match.scheduled_time) return conflicts;

    const matchDate = parseLocalTime(match.scheduled_time);
    if (!matchDate) return conflicts;

    const dayStr = getDayString(matchDate);
    const mHour = matchDate.getHours();
    const mMin = matchDate.getMinutes();

    // 1. Validar disponibilidade da Sede
    if (match.venue_id) {
      const venue = venues.find(v => v.id === match.venue_id);
      if (venue && venue.availability && venue.availability.length > 0) {
        const isUnavailableDate = venue.availability.some((av: any) => av.type === 'unavailable' && av.date === match.scheduled_time.split('T')[0]);
        if (isUnavailableDate) {
          conflicts.push(`Sede bloqueada nesta data.`);
        } else {
          const regularAvails = venue.availability.filter((a:any) => a.type !== 'unavailable' && a.day && a.start && a.end);
          if (regularAvails.length > 0) {
             const hasAvailability = regularAvails.some((av: any) => 
               av.day === dayStr && isTimeInRange(mHour, mMin, av.start, av.end, effectiveMatchDuration)
             );
             if (!hasAvailability) conflicts.push(`Sede indisponível neste horário (${dayStr}).`);
          }
        }
      }
    }

    // 2. Validar disponibilidade do Time 1
    if (match.team1?.availability && match.team1.availability.length > 0) {
      const isUnavailableDate = match.team1.availability.some((av: any) => av.type === 'unavailable' && av.date === match.scheduled_time.split('T')[0]);
      if (isUnavailableDate) {
        conflicts.push(`Mandante (${match.team1.institution?.name}) bloqueado nesta data.`);
      } else {
        const regularAvails = match.team1.availability.filter((a:any) => a.type !== 'unavailable' && a.day && a.start && a.end);
        if (regularAvails.length > 0) {
           const hasAvailability = regularAvails.some((av: any) => 
             av.day === dayStr && isTimeInRange(mHour, mMin, av.start, av.end, effectiveMatchDuration)
           );
           if (!hasAvailability) conflicts.push(`Mandante (${match.team1.institution?.name}) indisponível neste horário (${dayStr}).`);
        }
      }
    }

    // 3. Validar disponibilidade do Time 2
    if (match.team2?.availability && match.team2.availability.length > 0) {
      const isUnavailableDate = match.team2.availability.some((av: any) => av.type === 'unavailable' && av.date === match.scheduled_time.split('T')[0]);
      if (isUnavailableDate) {
        conflicts.push(`Visitante (${match.team2.institution?.name}) bloqueado nesta data.`);
      } else {
        const regularAvails = match.team2.availability.filter((a:any) => a.type !== 'unavailable' && a.day && a.start && a.end);
        if (regularAvails.length > 0) {
           const hasAvailability = regularAvails.some((av: any) => 
             av.day === dayStr && isTimeInRange(mHour, mMin, av.start, av.end, effectiveMatchDuration)
           );
           if (!hasAvailability) conflicts.push(`Visitante (${match.team2.institution?.name}) indisponível neste horário (${dayStr}).`);
        }
      }
    }

    // 4. Validar conflitos de Quadra (mesmo local e horário)
    // Assumimos que uma partida pode durar 1 hora para o block de tempo
    if (match.venue_id && match.court) {
      const matchTime = matchDate.getTime();
      const overlapping = computedMatches.find(other => {
        if (other.id === match.id || !other.scheduled_time || other.venue_id !== match.venue_id || other.court !== match.court) return false;
        const otherDate = parseLocalTime(other.scheduled_time);
        if (!otherDate) return false;
        const otherTime = otherDate.getTime();
        return Math.abs(matchTime - otherTime) < (effectiveMatchDuration * 60000);
      });
      if (overlapping) {
        conflicts.push(`Conflito de quadra com o Jogo ${(overlapping.match_index !== undefined ? overlapping.match_index + 1 : 1)} (${overlapping.category?.name}).`);
      }
    }

    // 5. Validar conflitos de Atletas (Jogadores inscritos em mais de um esporte / categoria jogando simultaneamente)
    if (match.team1_id && match.team2_id) {
      const matchTime = matchDate.getTime();
      const currentAthletes = new Set([
        ...(teamAthleteMap[match.team1_id] || []),
        ...(teamAthleteMap[match.team2_id] || [])
      ]);

      const overlappingMatch = computedMatches.find(other => {
        if (other.id === match.id || !other.scheduled_time || !other.team1_id || !other.team2_id) return false;
        const otherDate = parseLocalTime(other.scheduled_time);
        if (!otherDate) return false;
        const otherTime = otherDate.getTime();
        if (Math.abs(matchTime - otherTime) < (effectiveMatchDuration * 60000)) {
          const otherAthletes = [
            ...(teamAthleteMap[other.team1_id] || []),
            ...(teamAthleteMap[other.team2_id] || [])
          ];
          return otherAthletes.some(aid => currentAthletes.has(aid));
        }
        return false;
      });

      if (overlappingMatch) {
        conflicts.push(`Conflito de Atleta: Atletas em comum jogando ao mesmo tempo no Jogo ${(overlappingMatch.match_index !== undefined ? overlappingMatch.match_index + 1 : 1)} (${overlappingMatch.category?.name || "Outra Categoria"}).`);
      }
    }

    return conflicts;
  };

  const getHeaders = (extraHeaders: Record<string, string> = {}) => {
    const savedUser = localStorage.getItem("currentUser");
    const headers: Record<string, string> = { ...extraHeaders };
    if (savedUser) {
      const user = JSON.parse(savedUser);
      if (user && user.token) {
        headers["Authorization"] = `Bearer ${user.token}`;
      }
      headers["x-organizer-id"] = user.id;
    }
    return headers;
  };

  const fetchData = async () => {
    try {
      const h = getHeaders();
      const [mRes, sRes, cRes, vRes, tmRes] = await Promise.all([
        fetch(`/api/tournaments/${tournamentId}/matches`, { headers: h }),
        fetch('/api/tournaments/staff', { headers: h }),
        fetch(`/api/tournaments/${tournamentId}/categories`, { headers: h }),
        fetch('/api/tournaments/venues/all', { headers: h }),
        fetch(`/api/tournaments/${tournamentId}/team-members-all`, { headers: h })
      ]);

      if (!mRes.ok || !sRes.ok || !cRes.ok || !vRes.ok) {
        throw new Error('Erro ao buscar dados para escala');
      }

      const mData = await mRes.json();
      const sData = await sRes.json();
      const cData = await cRes.json();
      const vData = await vRes.json();
      const tmData = tmRes.ok ? await tmRes.json() : {};

      setMatches(mData || []);
      setStaff(sData || []);
      setCategories(cData || []);
      setVenues(vData || []);
      setTeamAthleteMap(tmData || {});
    } catch (err: any) {
      console.error("[TournamentScheduler] fetchData error:", err);
      setMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [tournamentId]);

  const handleChange = (matchId: string, field: string, value: any) => {
    setUpdates(prev => ({
      ...prev,
      [matchId]: {
        ...(prev[matchId] || {}),
        [field]: value
      }
    }));
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, [field]: value } : m));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setMessage('');
    try {
      const updateArray = Object.keys(updates).map(id => ({
        id,
        ...updates[id]
      }));

      const res = await fetch('/api/tournaments/matches/bulk-update', {
        method: 'PATCH',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ updates: updateArray }),
      });

      if (res.ok) {
        setMessage('Escala atualizada com sucesso!');
        setUpdates({});
        fetchData();
      }
    } catch (err) {
      console.error(err);
      setMessage('Erro ao salvar escala.');
    } finally {
      setSaving(false);
    }
  };

  const handleAutoSchedule = async () => {
    setScheduling(true);
    try {
      // Persiste a duração para uso no detector de conflitos visual
      localStorage.setItem('lastMatchDuration', String(autoScheduleParams.matchDuration));
      const res = await fetch(`/api/tournaments/${tournamentId}/auto-schedule`, {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(autoScheduleParams),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage(data.message);
        setIsAutoSchedulerOpen(false);
        fetchData();
      } else {
        setMessage(data.error || 'Erro ao gerar escala automática.');
      }
    } catch (err: any) {
      console.error(err);
      setMessage('Erro de conexão ao gerar escala automática.');
    } finally {
      setScheduling(false);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const tableColumn = ["Data/Hora", "Modalidade", "Jogo", "Local", "Árbitro 1", "Árbitro 2", "Mesário"];
    const tableRows: any[] = [];

    const sortedMatchesForPDF = [...filteredMatches].sort((a, b) => {
      if (a.scheduled_time && b.scheduled_time) {
        return a.scheduled_time.localeCompare(b.scheduled_time);
      }
      if (a.scheduled_time) return -1;
      if (b.scheduled_time) return 1;
      return 0;
    });

    sortedMatchesForPDF.forEach(match => {
      const localDate = match.scheduled_time ? parseLocalTime(match.scheduled_time) : null;
      const scheduledTime = localDate
        ? localDate.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) 
        : 'A definir';
        
      const venueName = venues.find(v => v.id === match.venue_id)?.name || match.venue?.name || '';
      const courtInfo = match.court ? ` - ${match.court}` : '';
      
      const matchData = [
        scheduledTime,
        match.category?.name ? `${match.category.name} ${match.category.gender || match.category.age_group ? `(${[match.category.gender, match.category.age_group].filter(Boolean).join(" ")})` : ""}` : '-',
        `${match.team1?.institution?.name || 'TBD'} x ${match.team2?.institution?.name || 'TBD'}`,
        `${venueName}${courtInfo}`.trim() || 'A definir',
        staff.find(s => s.id === (updates[match.id]?.referee1_id || match.referee1_id))?.name || '-',
        staff.find(s => s.id === (updates[match.id]?.referee2_id || match.referee2_id))?.name || '-',
        staff.find(s => s.id === (updates[match.id]?.table_official_id || match.table_official_id))?.name || '-',
      ];
      tableRows.push(matchData);
    });

    doc.setFontSize(18);
    doc.text("Cronograma de Jogos", 14, 22);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 28);
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] }
    });

    doc.save(`cronograma-jogos.pdf`);
  };

  const referees = staff.filter(s => s.role === 'referee');
  const officials = staff.filter(s => s.role === 'table_official');
  const modalities = [...new Set(categories.map(c => c.name))];

  const filteredMatches = matches.filter(m => {
    if (!filterCategoryId) return true;
    if (filterCategoryId.startsWith("MODALITY_")) {
      const modality = filterCategoryId.replace("MODALITY_", "");
      return m.category?.name === modality;
    }
    return m.tournament_category_id === filterCategoryId;
  }).sort((a, b) => {
    if (a.scheduled_time && b.scheduled_time) {
      return a.scheduled_time.localeCompare(b.scheduled_time);
    }
    if (a.scheduled_time) return -1;
    if (b.scheduled_time) return 1;
    
    // Se ambos não têm data, ordenar por índice do jogo
    if (a.match_index !== undefined && b.match_index !== undefined) {
      return a.match_index - b.match_index;
    }
    return 0;
  });

  const handleDragStart = (e: React.DragEvent, matchId: string) => {
    e.dataTransfer.setData('matchId', matchId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedMatchId(matchId);
    // Needed for Firefox
    e.dataTransfer.setData('text/plain', matchId);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedMatchId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetVenueId: string | null, targetDateStr: string | null) => {
    e.preventDefault();
    const matchId = e.dataTransfer.getData('matchId');
    if (!matchId) return;

    if (targetVenueId === null) {
      handleChange(matchId, 'venue_id', null);
      handleChange(matchId, 'scheduled_time', null);
    } else {
      let newTime = "";
      const match = matches.find(m => m.id === matchId);
      const currentScheduled = match?.scheduled_time || "";
      
      if (!currentScheduled.startsWith(targetDateStr || "")) {
        const venueMatches = filteredMatches.filter(m => m.venue_id === targetVenueId && m.scheduled_time?.startsWith(targetDateStr || ""));
        venueMatches.sort((a,b) => (a.scheduled_time || "").localeCompare(b.scheduled_time || ""));
        
        if (venueMatches.length > 0) {
          const lastMatch = venueMatches[venueMatches.length - 1];
          if (lastMatch.scheduled_time) {
            const time = parseLocalTime(lastMatch.scheduled_time);
            if (time) {
              time.setHours(time.getHours() + 1);
              const hh = String(time.getHours()).padStart(2, '0');
              const mm = String(time.getMinutes()).padStart(2, '0');
              newTime = `${targetDateStr}T${hh}:${mm}`;
            } else {
              newTime = `${targetDateStr}T08:00`;
            }
          } else {
            newTime = `${targetDateStr}T08:00`;
          }
        } else {
          newTime = `${targetDateStr}T08:00`;
        }
      } else {
        newTime = currentScheduled;
      }

      handleChange(matchId, 'venue_id', targetVenueId);
      handleChange(matchId, 'scheduled_time', newTime);
    }
    setDraggedMatchId(null);
  };

  if (loading) return <div className="p-8 text-center animate-pulse">Carregando escala...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">
            {mode === "schedule" ? "Escala de Partidas" : "Arbitragem"}
          </h2>
          <p className="text-sm text-slate-500">
            {mode === "schedule" 
              ? "Defina locais e horários para as partidas." 
              : "Defina a equipe de arbitragem e mesários para os jogos."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {mode === "schedule" && (
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
              <button 
                onClick={() => setViewType("board")}
                className={`py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewType === "board" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <LayoutGrid size={14} />
                Calendário
              </button>
              <button 
                onClick={() => setViewType("list")}
                className={`py-2 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewType === "list" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                <List size={14} />
                Lista
              </button>
            </div>
          )}
          <div className="relative group">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select 
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              className="pl-9 pr-8 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none hover:border-indigo-500 transition-all appearance-none"
            >
              <option value="">Todas as Modalidades</option>
              {modalities.map(modality => (
                <optgroup key={`mod_${modality}`} label={modality}>
                  <option value={`MODALITY_${modality}`}>{modality} - Todas as categorias</option>
                  {categories.filter(c => c.name === modality).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name} {cat.gender || cat.age_group ? `(${[cat.gender, cat.age_group].filter(Boolean).join(" ")})` : ""}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          {mode === "schedule" && (
            <button 
              onClick={() => setIsAutoSchedulerOpen(true)}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg shadow-indigo-600/15 cursor-pointer"
            >
              <Calendar size={14} className="animate-pulse" />
              Gerador Inteligente
            </button>
          )}
          <button 
            onClick={generatePDF}
            className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs transition-all hover:bg-slate-50 shadow-sm"
          >
            <Printer size={16} />
            PDF
          </button>
          <button 
            onClick={handleSaveAll}
            disabled={Object.keys(updates).length === 0 || saving}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${
              Object.keys(updates).length > 0 
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20" 
                : "bg-slate-100 text-slate-400 grayscale cursor-not-allowed"
            }`}
          >
            {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
            Salvar Alterações
          </button>
        </div>
      </div>

      {message && (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 flex items-center gap-2"
        >
          <CheckCircle size={18} />
          <span className="text-sm font-bold">{message}</span>
        </motion.div>
      )}

      {mode === "schedule" && viewType === "board" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700">Data Base:</h3>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-500 transition-all"
              />
            </div>
            <p className="text-xs text-slate-400 font-medium ml-4 border-l pl-4 border-slate-200">
              Arraste os jogos para os locais desejados. O horário será ajustado automaticamente para a data selecionada.
            </p>
          </div>
          
          <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar items-start h-[calc(100vh-250px)]">
            {/* Unscheduled Column */}
            <div 
              className="min-w-[280px] w-[280px] bg-slate-100/50 rounded-3xl border border-slate-200/60 p-4 h-full overflow-y-auto custom-scrollbar flex flex-col"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, null, null)}
            >
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-black text-slate-700 uppercase tracking-widest text-[11px]">A Agendar</h4>
                <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                  {filteredMatches.filter(m => !m.scheduled_time || !m.venue_id).length}
                </span>
              </div>
              <div className="space-y-3 flex-1">
                {filteredMatches.filter(m => !m.scheduled_time || !m.venue_id).map(match => (
                  <div
                    key={match.id}
                    draggable={match.status !== 'finished'}
                    onDragStart={(e) => match.status !== 'finished' && handleDragStart(e, match.id)}
                    onDragEnd={handleDragEnd}
                    className={`bg-white p-3 rounded-2xl border ${draggedMatchId === match.id ? 'opacity-50' : ''} shadow-sm ${match.status === 'finished' ? 'opacity-80 grayscale-[0.2]' : 'cursor-grab active:cursor-grabbing hover:border-indigo-300'} transition-all`}
                  >
                    <div className="text-[10px] font-black text-indigo-600 mb-1">{match.tournament?.name}</div>
                    <div className="text-xs font-bold text-slate-800 mb-2">
                       {match.category ? `${match.category.name} (${[match.category.gender, match.category.age_group].filter(Boolean).join(" ")})` : 'Categoria Mista'} • Jogo {match.match_index !== undefined ? match.match_index + 1 : 1}
                    </div>
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <div className="flex-1 truncate">{match.team1?.institution?.name || 'TBD'}</div>
                      <div className="flex flex-col items-center justify-center">
                        {match.status === 'finished' ? (
                          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">{match.score1 ?? 0} x {match.score2 ?? 0}</span>
                        ) : (
                          <span className="text-slate-300 font-black">x</span>
                        )}
                      </div>
                      <div className="flex-1 truncate text-right">{match.team2?.institution?.name || 'TBD'}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Venue Columns */}
            {venues.map(venue => {
              const venueMatches = filteredMatches.filter(m => m.venue_id === venue.id && m.scheduled_time?.startsWith(selectedDate));
              venueMatches.sort((a,b) => (a.scheduled_time || "").localeCompare(b.scheduled_time || ""));

              return (
                <div 
                  key={venue.id}
                  className="min-w-[280px] w-[280px] bg-slate-50 rounded-3xl border border-slate-200 p-4 h-full overflow-y-auto custom-scrollbar flex flex-col"
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, venue.id, selectedDate)}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-black text-slate-800 uppercase tracking-widest text-[11px] truncate flex-1" title={venue.name}>{venue.name}</h4>
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-lg text-[10px] font-bold ml-2">
                      {venueMatches.length}
                    </span>
                  </div>
                  <div className="space-y-3 flex-1">
                    {venueMatches.map(match => {
                      const conflicts = getMatchConflicts(match.id);
                      return (
                      <div
                        key={match.id}
                        draggable={match.status !== 'finished'}
                        onDragStart={(e) => match.status !== 'finished' && handleDragStart(e, match.id)}
                        onDragEnd={handleDragEnd}
                        className={`bg-white p-3 rounded-2xl border ${conflicts.length > 0 ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200'} ${draggedMatchId === match.id ? 'opacity-50' : ''} shadow-sm ${match.status === 'finished' ? 'opacity-80 grayscale-[0.2] border-emerald-200' : 'cursor-grab active:cursor-grabbing hover:border-indigo-300'} transition-all`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <input 
                            type="time"
                            value={match.scheduled_time ? match.scheduled_time.slice(11, 16) : ""}
                            onChange={(e) => handleChange(match.id, 'scheduled_time', `${selectedDate}T${e.target.value}`)}
                            disabled={match.status === 'finished'}
                            className={`bg-slate-100 border-none rounded-lg px-2 py-1 text-xs font-black text-slate-700 w-[95px] outline-none ${match.status === 'finished' ? 'opacity-70 cursor-not-allowed' : ''}`}
                          />
                          <input 
                             type="text"
                             value={match.court || ""}
                             placeholder="Quadra"
                             onChange={(e) => handleChange(match.id, 'court', e.target.value)}
                             disabled={match.status === 'finished'}
                             className={`bg-slate-100 border-none rounded-lg px-2 py-1 text-[10px] font-bold text-slate-600 w-[75px] outline-none text-center placeholder:text-slate-400 ${match.status === 'finished' ? 'opacity-70 cursor-not-allowed' : ''}`}
                          />
                        </div>
                        <div className="text-[10px] font-bold text-slate-500 mb-2 truncate">
                           {match.category ? `${match.category.name} (${[match.category.gender, match.category.age_group].filter(Boolean).join(" ")})` : 'Mista'} • Jogo {match.match_index !== undefined ? match.match_index + 1 : 1}
                        </div>
                        <div className="flex items-center gap-2 text-sm font-black text-slate-800">
                          <div className="flex-1 truncate" title={match.team1?.institution?.name || 'TBD'}>{match.team1?.institution?.name || 'TBD'}</div>
                          <div className="flex flex-col items-center justify-center">
                            {match.status === 'finished' ? (
                              <span className="text-[11px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shadow-sm">{match.score1 ?? 0} x {match.score2 ?? 0}</span>
                            ) : (
                              <span className="text-slate-300 font-black">x</span>
                            )}
                          </div>
                          <div className="flex-1 truncate text-right" title={match.team2?.institution?.name || 'TBD'}>{match.team2?.institution?.name || 'TBD'}</div>
                        </div>
                         {conflicts.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {conflicts.map((c: any, i: number) => (
                              <div key={i} className="flex items-center gap-1 text-[9px] font-bold text-rose-600 bg-rose-100/50 px-2 py-1 rounded-md">
                                <AlertTriangle size={8} /> {c}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )})}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
      <div className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Jogo</th>
                {mode === "schedule" && (
                  <>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data/Hora</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Local / Sede</th>
                  </>
                )}
                {mode === "refereeing" && (
                  <>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data / Local (Leitura)</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Árbitro 1</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Árbitro 2</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Mesário</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredMatches.map(match => {
                const conflicts = getMatchConflicts(match.id);
                return (
                <tr key={match.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-[10px] font-black text-indigo-500 mb-1">
                      {match.category?.name} {match.category?.gender || match.category?.age_group ? `(${[match.category?.gender, match.category?.age_group].filter(Boolean).join(" ")})` : ""} • JOGO {match.match_index !== undefined ? match.match_index + 1 : 1}
                    </div>
                    <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
                      {match.team1?.institution?.logo_url && (
                        <img src={match.team1.institution.logo_url} alt="Logo" className="w-4 h-4 object-contain" onError={(e: any) => e.target.style.display = 'none'} />
                      )}
                      <span>{match.team1?.institution?.name}</span>
                      {match.status === 'finished' ? (
                        <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded mx-1">{match.score1 ?? 0} x {match.score2 ?? 0}</span>
                      ) : (
                        <span className="text-slate-400 mx-1">x</span>
                      )}
                      <span>{match.team2?.institution?.name}</span>
                      {match.team2?.institution?.logo_url && (
                        <img src={match.team2.institution.logo_url} alt="Logo" className="w-4 h-4 object-contain" onError={(e: any) => e.target.style.display = 'none'} />
                      )}
                    </div>
                    {conflicts.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {conflicts.map((c, i) => (
                          <div key={i} className="flex items-start gap-1 text-[10px] text-rose-500 font-bold leading-tight">
                            <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                            <span>{c}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </td>
                  {mode === "schedule" && (
                    <>
                      <td className="px-6 py-4">
                        <div className="relative group">
                          <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input 
                            type="datetime-local"
                            defaultValue={formatDateTimeLocal(match.scheduled_time)}
                            onChange={(e) => handleChange(match.id, 'scheduled_time', e.target.value)}
                            disabled={match.status === 'finished'}
                            className={`pl-9 pr-3 py-2 bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg text-xs font-medium outline-none transition-all w-48 ${match.status === 'finished' ? 'opacity-60 cursor-not-allowed' : ''}`}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="relative group">
                            <MapPin size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <select 
                              defaultValue={match.venue_id || ""}
                              onChange={(e) => handleChange(match.id, 'venue_id', e.target.value || null)}
                              disabled={match.status === 'finished'}
                              className={`pl-8 pr-3 py-2 bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg text-xs font-medium outline-none transition-all w-full appearance-none ${match.status === 'finished' ? 'opacity-60 cursor-not-allowed' : ''}`}
                            >
                              <option value="">Selecione a Sede...</option>
                              {venues.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                            </select>
                          </div>
                          <input 
                            type="text"
                            defaultValue={match.court || ""}
                            placeholder="Quadra/Mesa"
                            onChange={(e) => handleChange(match.id, 'court', e.target.value)}
                            disabled={match.status === 'finished'}
                            className={`w-full px-3 py-1.5 bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg text-[10px] font-medium outline-none transition-all ${match.status === 'finished' ? 'opacity-60 cursor-not-allowed' : ''}`}
                          />
                        </div>
                      </td>
                    </>
                  )}
                  {mode === "refereeing" && (
                    <>
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-slate-600">
                          {match.scheduled_time ? (parseLocalTime(match.scheduled_time)?.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) || '') : 'Data a definir'}
                        </div>
                        <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
                          <MapPin size={10} /> {match.venue?.name || venues.find((v:any) => v.id === match.venue_id)?.name || 'Local a definir'} {match.court ? `- ${match.court}` : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <select 
                            defaultValue={match.referee1_id || ""}
                            onChange={(e) => handleChange(match.id, 'referee1_id', e.target.value || null)}
                            className="w-full p-2 bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg text-xs outline-none"
                         >
                            <option value="">Selecione...</option>
                            {referees.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                         </select>
                      </td>
                      <td className="px-6 py-4">
                         <select 
                            defaultValue={match.referee2_id || ""}
                            onChange={(e) => handleChange(match.id, 'referee2_id', e.target.value || null)}
                            className="w-full p-2 bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg text-xs outline-none"
                         >
                            <option value="">Selecione...</option>
                            {referees.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                         </select>
                      </td>
                      <td className="px-6 py-4">
                         <select 
                            defaultValue={match.table_official_id || ""}
                            onChange={(e) => handleChange(match.id, 'table_official_id', e.target.value || null)}
                            className="w-full p-2 bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg text-xs outline-none"
                         >
                            <option value="">Selecione...</option>
                            {officials.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                         </select>
                      </td>
                    </>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
          {filteredMatches.length === 0 && (
            <div className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest text-xs">
              Nenhuma partida encontrada para este filtro.
            </div>
          )}
        </div>
      </div>
      )}

      {/* MODAL DO GERADOR INTELIGENTE */}
      {isAutoSchedulerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] border border-slate-100 shadow-2xl p-6 md:p-8 space-y-6 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter">
                  Gerador Automático de Escala
                </h3>
                <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest mt-0.5">
                  PREVENÇÃO INTELIGENTE DE CONFLITOS
                </p>
              </div>
              <button 
                onClick={() => setIsAutoSchedulerOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-semibold text-xs bg-slate-50 p-2 h-8 w-8 rounded-full flex items-center justify-center transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Data de Início</label>
                  <input 
                    type="date" 
                    value={autoScheduleParams.startDate}
                    onChange={(e) => setAutoScheduleParams(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Data de Fim</label>
                  <input 
                    type="date" 
                    value={autoScheduleParams.endDate}
                    onChange={(e) => setAutoScheduleParams(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Duração Média (Mins)</label>
                  <input 
                    type="number" 
                    value={autoScheduleParams.matchDuration}
                    onChange={(e) => setAutoScheduleParams(prev => ({ ...prev, matchDuration: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1" title="Máximo de jogos de uma mesma equipe num mesmo dia">Máx. Jogos/Dia/Equipe</label>
                  <input 
                    type="number" 
                    min="1"
                    max="5"
                    value={autoScheduleParams.maxGamesPerDay}
                    onChange={(e) => setAutoScheduleParams(prev => ({ ...prev, maxGamesPerDay: Number(e.target.value) }))}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Início do Turno</label>
                  <input 
                    type="time" 
                    value={autoScheduleParams.dailyStartTime}
                    onChange={(e) => setAutoScheduleParams(prev => ({ ...prev, dailyStartTime: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Fim do Turno</label>
                  <input 
                    type="time" 
                    value={autoScheduleParams.dailyEndTime}
                    onChange={(e) => setAutoScheduleParams(prev => ({ ...prev, dailyEndTime: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200/80 rounded-xl px-4 py-2.5 text-xs font-semibold outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Modo de Distribuição</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/60 cursor-pointer">
                    <input 
                      type="radio" 
                      name="onlyUnscheduled" 
                      checked={autoScheduleParams.onlyUnscheduled}
                      onChange={() => setAutoScheduleParams(prev => ({ ...prev, onlyUnscheduled: true }))}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">Manter já agendados e alocar restantes</span>
                      <span className="text-[9px] text-slate-400 font-semibold block leading-snug">Preserva partidas com local e hora que você já acertou manualmente.</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/60 cursor-pointer">
                    <input 
                      type="radio" 
                      name="onlyUnscheduled" 
                      checked={!autoScheduleParams.onlyUnscheduled}
                      onChange={() => setAutoScheduleParams(prev => ({ ...prev, onlyUnscheduled: false }))}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">Apagar e recalcular toda a escala de jogos</span>
                      <span className="text-[9px] text-slate-400 font-semibold block leading-snug">Zera todos os horários e distribui o campeonato inteiro de forma otimizada.</span>
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1.5">Sedes Disponíveis</label>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 space-y-2 max-h-24 overflow-y-auto custom-scrollbar">
                  {venues.map(v => {
                    const isChecked = autoScheduleParams.selectedVenues.includes(v.id);
                    return (
                      <label key={v.id} className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => {
                            const selected = isChecked
                              ? autoScheduleParams.selectedVenues.filter(id => id !== v.id)
                              : [...autoScheduleParams.selectedVenues, v.id];
                            setAutoScheduleParams(prev => ({ ...prev, selectedVenues: selected }));
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{v.name}</span>
                      </label>
                    );
                  })}
                  {venues.length === 0 && (
                    <div className="text-[9px] text-slate-400 font-bold p-1">Nenhuma sede cadastrada no sistema.</div>
                  )}
                </div>
                <p className="text-[9px] text-slate-400 font-semibold mt-1">Esvazie para distribuir os confrontos entre todos os locais disponíveis.</p>
              </div>

              <div className="bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-100/60 flex items-start gap-2.5">
                <Shield size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                <div className="text-[9px] text-indigo-700 font-medium leading-relaxed">
                  <strong>Tecnologia Anticonflito:</strong> O gerador verifica automaticamente a disponibilidade de quadras em cada sede, impede a sobreposição de horários na mesma quadra e <strong>garante que atletas inscritos em mais de um time ou categoria nunca joguem simultaneamente</strong>.
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setIsAutoSchedulerOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl py-3 text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button 
                onClick={handleAutoSchedule}
                disabled={scheduling}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white rounded-xl py-3 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-2 cursor-pointer"
              >
                {scheduling ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                Começar Agendamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
