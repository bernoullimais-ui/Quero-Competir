import React, { useState, useEffect } from "react";
import { 
  MapPin, Clock, Calendar, ShieldCheck, Users, Download, 
  Plus, Trash2, Save, X, RefreshCw, ChevronDown, ChevronUp, FileText 
} from "lucide-react";
import { useToast } from "./ui/Toast.tsx";
import { useConfirm } from "./ui/ConfirmDialog.tsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface VenuePortalProps {
  currentUser: any;
  onLogout: () => void;
}

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export default function VenuePortal({ currentUser, onLogout }: VenuePortalProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const { confirm } = useConfirm();
  
  const venueId = currentUser.referenceId || "venue-1";

  const [activeTab, setActiveTab] = useState<"control" | "availability">("control");
  const [venueInfo, setVenueInfo] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [expandedMatches, setExpandedMatches] = useState<Record<string, boolean>>({});

  // Availability editing state
  const [editingVenue, setEditingVenue] = useState<any>({
    name: "",
    address: "",
    availability: []
  });

  const getHeaders = () => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (currentUser && currentUser.token) {
      headers["Authorization"] = `Bearer ${currentUser.token}`;
    }
    return headers;
  };

  const fetchVenueData = async () => {
    setLoading(true);
    try {
      // 1. Fetch info de base
      const infoRes = await fetch(`/api/tournaments/venues/${venueId}`, {
        headers: getHeaders()
      });
      if (infoRes.ok) {
        const info = await infoRes.json();
        setVenueInfo(info);
        setEditingVenue({
          name: info.name || "",
          address: info.address || "",
          availability: Array.isArray(info.availability) ? info.availability : []
        });
      }

      // 2. Fetch partidas e visitantes
      const matchesRes = await fetch(`/api/tournaments/venues/${venueId}/matches-with-visitors`, {
        headers: getHeaders()
      });
      if (matchesRes.ok) {
        const mData = await matchesRes.json();
        setMatches(mData || []);
      }
    } catch (err) {
      console.error("Erro ao carregar dados do portal de sede:", err);
      toastError("Erro ao carregar dados da sede.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVenueData();
  }, [venueId]);

  const toggleMatchExpand = (matchId: string) => {
    setExpandedMatches(prev => ({
      ...prev,
      [matchId]: !prev[matchId]
    }));
  };

  // Availability functions
  const addAvailability = () => {
    const current = editingVenue.availability || [];
    setEditingVenue({
      ...editingVenue,
      availability: [...current, { day: 'Segunda', start: '08:00', end: '22:00' }]
    });
  };

  const addUnavailableDate = () => {
    const current = editingVenue.availability || [];
    setEditingVenue({
      ...editingVenue,
      availability: [...current, { type: 'unavailable', date: '' }]
    });
  };

  const removeAvailability = (index: number) => {
    const current = [...(editingVenue.availability || [])];
    current.splice(index, 1);
    setEditingVenue({ ...editingVenue, availability: current });
  };

  const updateAvailability = (index: number, field: string, value: string) => {
    const current = [...(editingVenue.availability || [])];
    current[index] = { ...current[index], [field]: value };
    setEditingVenue({ ...editingVenue, availability: current });
  };

  const handleSaveAvailability = async () => {
    setSavingAvailability(true);
    try {
      const res = await fetch(`/api/tournaments/venues/${venueId}`, {
        method: "PUT",
        headers: getHeaders(),
        body: JSON.stringify(editingVenue)
      });
      if (res.ok) {
        const updated = await res.json();
        setVenueInfo(updated);
        toastSuccess("Configurações de disponibilidade salvas com sucesso!");
      } else {
        toastError("Erro ao salvar disponibilidade.");
      }
    } catch (err) {
      console.error(err);
      toastError("Erro de conexão ao salvar.");
    } finally {
      setSavingAvailability(false);
    }
  };

  // PDF Generation using jsPDF and jsPDF-AutoTable
  const exportMatchVisitorsPDF = (match: any) => {
    try {
      const doc = new jsPDF();
      
      // Header Styling
      doc.setFillColor(30, 41, 59); // dark slate (#1e293b)
      doc.rect(0, 0, 210, 40, "F");
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("QUERO COMPETIR • PORTARIA", 15, 18);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Lista de Controle de Acesso • Sede: ${venueInfo?.name || "Arena"}`, 15, 25);
      doc.text(`Data de Geração: ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")}`, 15, 31);
      
      // Match Details Panel
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("INFORMAÇÕES DA PARTIDA", 15, 52);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Torneio: ${match.tournamentName}`, 15, 60);
      doc.text(`Categoria: ${match.categoryName}`, 15, 66);
      doc.text(`Confronto: ${match.team1Name} vs ${match.team2Name}`, 15, 72);
      
      const timeStr = match.scheduledTime 
        ? new Date(match.scheduledTime).toLocaleString("pt-BR") 
        : "A Definir";
      doc.text(`Horário: ${timeStr}`, 120, 60);
      doc.text(`Quadra/Local: ${match.court || "Principal"}`, 120, 66);
      doc.text(`Fase/Rodada: ${match.phase || `Rodada ${match.round}`}`, 120, 72);
      
      // Dividers
      doc.setDrawColor(226, 232, 240);
      doc.line(15, 80, 195, 80);
      
      // Gather all visitors
      const tableData: any[] = [];
      (match.athletes || []).forEach((athlete: any) => {
        (athlete.visitors || []).forEach((visitor: any) => {
          tableData.push([
            visitor.name,
            visitor.document,
            athlete.athleteName,
            athlete.teamName,
            visitor.isInherited ? "Repetido (Jogo Anterior)" : "Confirmado",
            "" // Signature column for paper control
          ]);
        });
      });
      
      if (tableData.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(11);
        doc.text("Nenhum visitante cadastrado para esta partida.", 15, 95);
      } else {
        autoTable(doc, {
          startY: 85,
          head: [['Nome do Visitante', 'Documento (RG/CPF)', 'Acompanhando Atleta', 'Equipe/Clube', 'Origem', 'Assinatura']],
          body: tableData,
          theme: 'striped',
          headStyles: {
            fillColor: [79, 70, 229], // Indigo 600
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 9
          },
          bodyStyles: {
            fontSize: 8.5
          },
          columnStyles: {
            5: { cellWidth: 40 } // signature column
          },
          margin: { left: 15, right: 15 }
        });
      }
      
      // Save PDF
      doc.save(`visitantes_jogo_${match.matchId.substring(0,8)}.pdf`);
      toastSuccess("PDF gerado e baixado com sucesso!");
    } catch (err) {
      console.error(err);
      toastError("Erro ao exportar PDF.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* Sede Portal Header */}
      <header className="bg-white py-5 px-8 flex items-center justify-between border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <MapPin size={22} />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-800 uppercase">
              {venueInfo?.name || "Portal da Sede"}
            </h1>
            <p className="text-xs text-slate-500 font-semibold flex items-center gap-1">
              <MapPin size={12} className="text-slate-400" />
              {venueInfo?.address || "Endereço não cadastrado"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={fetchVenueData}
            className="p-2 text-slate-500 hover:text-indigo-600 rounded-xl hover:bg-slate-100 transition shrink-0"
            title="Atualizar dados"
          >
            <RefreshCw size={18} />
          </button>
          
          <button
            onClick={onLogout}
            className="text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 px-4 rounded-xl transition duration-150 border border-slate-200 cursor-pointer"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-8 max-w-7xl w-full mx-auto space-y-8">
        
        {/* Navigation Tabs */}
        <div className="flex gap-2 p-1 bg-slate-200/60 rounded-2xl w-fit border border-slate-250">
          <button
            onClick={() => setActiveTab("control")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === "control"
                ? "bg-white text-indigo-700 shadow-md"
                : "text-slate-650 hover:text-slate-800 hover:bg-white/40"
            }`}
          >
            <ShieldCheck size={16} />
            Controle de Portaria
          </button>
          
          <button
            onClick={() => setActiveTab("availability")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === "availability"
                ? "bg-white text-indigo-700 shadow-md"
                : "text-slate-650 hover:text-slate-800 hover:bg-white/40"
            }`}
          >
            <Clock size={16} />
            Minha Disponibilidade
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
            <p className="text-slate-500 font-bold text-sm">Carregando dados da sede...</p>
          </div>
        ) : activeTab === "control" ? (
          /* ========================================= */
          /* PORTARIA & VISITORS VIEW                  */
          /* ========================================= */
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">Jogos Agendados & Acesso</h2>
                <p className="text-sm text-slate-500 font-medium">Veja a escala de partidas no seu espaço e exporte as listas para controle de entrada.</p>
              </div>
            </div>

            {matches.length === 0 ? (
              <div className="bg-white rounded-[2rem] p-16 text-center border border-slate-200 shadow-sm space-y-4 max-w-md mx-auto">
                <div className="w-16 h-16 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto border border-slate-100">
                  <Calendar size={28} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-700">Nenhum jogo agendado</h4>
                  <p className="text-xs text-slate-450 mt-1 font-medium leading-relaxed">
                    Atualmente não há nenhuma partida agendada ou configurada para ocorrer nesta sede nas rodadas ativas.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {matches.map((match) => {
                  const isExpanded = !!expandedMatches[match.matchId];
                  
                  // Total visitors count
                  let visitorsCount = 0;
                  (match.athletes || []).forEach((a: any) => {
                    visitorsCount += (a.visitors || []).length;
                  });

                  const matchTime = match.scheduledTime 
                    ? new Date(match.scheduledTime).toLocaleString("pt-BR") 
                    : "Horário a Definir";

                  return (
                    <div 
                      key={match.matchId} 
                      className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden transition-all duration-200"
                    >
                      {/* Match row header */}
                      <div 
                        onClick={() => toggleMatchExpand(match.matchId)}
                        className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 select-none"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-650 rounded-lg text-[10px] font-extrabold uppercase">
                              {match.tournamentName}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-extrabold uppercase">
                              {match.categoryName}
                            </span>
                            <span className="px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-700 rounded-lg text-[10px] font-extrabold">
                              Quadra: {match.court}
                            </span>
                          </div>
                          
                          <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                            <span>{match.team1Name}</span>
                            <span className="text-slate-400 text-sm font-medium">x</span>
                            <span>{match.team2Name}</span>
                          </h3>

                          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar size={13} />
                              {matchTime}
                            </span>
                            <span>•</span>
                            <span>{match.phase || `Rodada ${match.round}`}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end md:self-auto">
                          <span className="px-4 py-2 bg-indigo-50/50 text-indigo-700 font-extrabold text-xs rounded-xl border border-indigo-100 flex items-center gap-1.5 shrink-0">
                            <Users size={14} />
                            <span>{visitorsCount} Visitantes</span>
                          </span>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              exportMatchVisitorsPDF(match);
                            }}
                            className="p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition flex items-center gap-1 cursor-pointer shrink-0"
                            title="Exportar PDF para Portaria"
                          >
                            <Download size={14} />
                            <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">PDF</span>
                          </button>

                          <div className="text-slate-400 p-1">
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded visitors list table */}
                      {isExpanded && (
                        <div className="border-t border-slate-100 p-6 bg-slate-50/30">
                          {visitorsCount === 0 ? (
                            <div className="py-8 text-center text-slate-405 font-bold text-xs">
                              Nenhum visitante/torcedor cadastrado para este jogo.
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-xs">
                              <table className="w-full text-left border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase text-slate-450 tracking-wider">
                                    <th className="p-4 pl-6">Nome do Visitante</th>
                                    <th className="p-4">Documento (RG/CPF)</th>
                                    <th className="p-4">Acompanha Atleta</th>
                                    <th className="p-4">Equipe/Escola</th>
                                    <th className="p-4 pr-6 text-center">Origem</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 text-xs font-semibold text-slate-700">
                                  {(match.athletes || []).flatMap((athlete: any) => 
                                    (athlete.visitors || []).map((visitor: any, vIdx: number) => (
                                      <tr key={`${athlete.athleteId}-${vIdx}`} className="hover:bg-slate-50/40">
                                        <td className="p-4 pl-6 font-bold text-slate-800">{visitor.name}</td>
                                        <td className="p-4 text-slate-500 font-mono">{visitor.document}</td>
                                        <td className="p-4 text-slate-650">{athlete.athleteName}</td>
                                        <td className="p-4 text-slate-650">{athlete.teamName}</td>
                                        <td className="p-4 pr-6 text-center">
                                          {visitor.isInherited ? (
                                            <span className="px-2.5 py-1 bg-amber-50 border border-amber-100 text-amber-700 rounded-full text-[9px] font-bold">
                                              Jogo Anterior
                                            </span>
                                          ) : (
                                            <span className="px-2.5 py-1 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-full text-[9px] font-bold">
                                              Confirmado
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ========================================= */
          /* AVAILABILITY CALENDAR MANAGEMENT          */
          /* ========================================= */
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Clock size={20} className="text-indigo-600" />
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Minha Grade de Disponibilidade</h3>
                    <p className="text-xs text-slate-500 font-medium">Gerencie a escala padrão da semana e insira datas em que o local estará ocupado ou indisponível.</p>
                  </div>
                </div>
                
                <button
                  onClick={handleSaveAvailability}
                  disabled={savingAvailability}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer disabled:opacity-50"
                >
                  <Save size={14} />
                  <span>{savingAvailability ? "Salvando..." : "Salvar Grade"}</span>
                </button>
              </div>

              {/* Editable Name & Address details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nome da Sede/Local</label>
                  <input
                    type="text"
                    value={editingVenue.name}
                    onChange={(e) => setEditingVenue({ ...editingVenue, name: e.target.value })}
                    className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none transition"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Endereço Completo</label>
                  <input
                    type="text"
                    value={editingVenue.address}
                    onChange={(e) => setEditingVenue({ ...editingVenue, address: e.target.value })}
                    className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 outline-none transition"
                  />
                </div>
              </div>

              {/* Weekly Availability Planner */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-850 flex items-center gap-1">
                    <Calendar size={16} className="text-indigo-600" />
                    <span>Disponibilidade Semanal de Jogos</span>
                  </h4>
                  <button
                    type="button"
                    onClick={addAvailability}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100/60 py-1.5 px-3 rounded-lg border border-indigo-100/50 flex items-center gap-1 transition"
                  >
                    <Plus size={13} />
                    Adicionar Horário
                  </button>
                </div>

                <div className="space-y-3">
                  {editingVenue.availability?.map((av: any, idx: number) => {
                    if (av.type === 'unavailable') return null;
                    return (
                      <div key={idx} className="flex flex-wrap items-center gap-3 p-3 bg-slate-50/50 rounded-2xl border border-slate-100 animate-in fade-in duration-200">
                        <div className="w-full sm:w-40">
                          <select
                            value={av.day}
                            onChange={(e) => updateAvailability(idx, 'day', e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                          >
                            {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-bold">Das</span>
                          <input
                            type="text"
                            value={av.start}
                            placeholder="08:00"
                            onChange={(e) => updateAvailability(idx, 'start', e.target.value)}
                            className="w-20 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 text-center outline-none"
                          />
                          <span className="text-xs text-slate-400 font-bold">às</span>
                          <input
                            type="text"
                            value={av.end}
                            placeholder="22:00"
                            onChange={(e) => updateAvailability(idx, 'end', e.target.value)}
                            className="w-20 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 text-center outline-none"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => removeAvailability(idx)}
                          className="ml-auto p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition"
                          title="Remover horário"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}

                  {(!editingVenue.availability || editingVenue.availability.filter((a: any) => a.type !== 'unavailable').length === 0) && (
                    <p className="text-xs text-slate-400 italic py-2">Nenhum horário semanal cadastrado. Clique em "Adicionar Horário" acima.</p>
                  )}
                </div>
              </div>

              {/* Exception/Unavailable Dates Planner */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-850 flex items-center gap-1">
                    <X size={16} className="text-rose-500" />
                    <span>Datas e Dias Indisponíveis (Bloqueados)</span>
                  </h4>
                  <button
                    type="button"
                    onClick={addUnavailableDate}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 hover:bg-rose-100/60 py-1.5 px-3 rounded-lg border border-rose-100/50 flex items-center gap-1 transition"
                  >
                    <Plus size={13} />
                    Adicionar Data Indisponível
                  </button>
                </div>

                <div className="space-y-3">
                  {editingVenue.availability?.map((av: any, idx: number) => {
                    if (av.type !== 'unavailable') return null;
                    return (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-rose-50/20 rounded-2xl border border-rose-100/40 animate-in fade-in duration-200">
                        <div className="w-full sm:w-48">
                          <input
                            type="date"
                            value={av.date}
                            onChange={(e) => updateAvailability(idx, 'date', e.target.value)}
                            className="w-full bg-white border border-slate-205 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                          />
                        </div>
                        
                        <span className="text-xs text-rose-600 font-bold hidden sm:inline">
                          🚫 Local indisponível para receber jogos nesta data.
                        </span>

                        <button
                          type="button"
                          onClick={() => removeAvailability(idx)}
                          className="ml-auto p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-55 rounded-lg transition"
                          title="Remover indisponibilidade"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}

                  {(!editingVenue.availability || editingVenue.availability.filter((a: any) => a.type === 'unavailable').length === 0) && (
                    <p className="text-xs text-slate-400 italic py-2">Nenhuma data de exceção cadastrada. Clique em "Adicionar Data Indisponível" acima.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

      </main>

    </div>
  );
}
