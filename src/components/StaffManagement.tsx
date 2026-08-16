import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, Trash2, Shield, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useConfirm } from './ui/ConfirmDialog.tsx';
import { useToast } from './ui/Toast.tsx';

export default function StaffManagement() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStaff, setNewStaff] = useState({ name: '', role: 'referee' });
  const { confirm } = useConfirm();
  const { success, error: toastError } = useToast();

  // Check-in Scanner State
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState("");
  const [scanInput, setScanInput] = useState("");
  const [scanResult, setScanResult] = useState<{ status: "checked_in" | "already_checked_in" | "unpaid" | "error"; message: string; sub?: any } | null>(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [activeTab, setActiveTab] = useState<"checkin" | "staff">("checkin");

  const getHeaders = () => {
    const savedUser = localStorage.getItem("currentUser");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (savedUser) {
      const user = JSON.parse(savedUser);
      if (user && user.token) {
        headers["Authorization"] = `Bearer ${user.token}`;
      }
      headers["x-organizer-id"] = user.id;
    }
    return headers;
  };

  const fetchStaff = async () => {
    try {
      const res = await fetch('/api/tournaments/staff', {
        headers: getHeaders()
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown API error' }));
        throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      setStaff(data || []);
    } catch (err: any) {
      console.error("[StaffManagement] fetchStaff error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
    fetch("/api/tournaments", { headers: getHeaders() })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTournaments(data);
          const active = data.find((t: any) => t.status === "active") || data[0];
          if (active) setSelectedTournamentId(active.id);
        }
      })
      .catch(() => {});
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/tournaments/staff', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newStaff)
      });
      if (!res.ok) throw new Error('Falha ao adicionar membro');
      success('Membro da equipe adicionado!');
      setNewStaff({ name: '', role: 'referee' });
      setShowAddForm(false);
      fetchStaff();
    } catch (err: any) {
      toastError(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm({
      title: 'Remover Membro',
      message: 'Tem certeza que deseja remover este membro da equipe?',
      confirmText: 'Remover',
      type: 'danger'
    });

    if (!isConfirmed) return;

    try {
      const res = await fetch(`/api/tournaments/staff/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (!res.ok) throw new Error('Falha ao remover membro');
      success('Membro removido!');
      fetchStaff();
    } catch (err: any) {
      toastError(err.message);
    }
  };

  const playAudioFeedback = (type: "success" | "warning" | "error") => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === "success") {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === "warning") {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      } else {
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch { /* ignore audio error */ }
  };

  const handlePerformCheckIn = async (codeToUse?: string) => {
    const raw = (codeToUse || scanInput).trim();
    if (!raw || !selectedTournamentId) return;

    setCheckingIn(true);
    setScanResult(null);

    let subId = raw;
    try {
      if (raw.startsWith("{")) {
        const parsed = JSON.parse(raw);
        if (parsed.ticketId) subId = parsed.ticketId;
      }
    } catch { /* ignore JSON parse */ }

    try {
      const res = await fetch(`/api/tournaments/${selectedTournamentId}/check-in/${subId}`, {
        method: "POST",
        headers: getHeaders()
      });
      const data = await res.json();

      if (!res.ok) {
        playAudioFeedback("error");
        setScanResult({
          status: "unpaid",
          message: data.message || data.error || "Erro no check-in",
          sub: data.subscription
        });
      } else if (data.status === "already_checked_in") {
        playAudioFeedback("warning");
        setScanResult({
          status: "already_checked_in",
          message: data.message,
          sub: data.subscription
        });
      } else {
        playAudioFeedback("success");
        setScanResult({
          status: "checked_in",
          message: data.message,
          sub: data.subscription
        });
        setScanInput("");
      }
    } catch (err: any) {
      playAudioFeedback("error");
      setScanResult({
        status: "error",
        message: err.message || "Erro de conexão no check-in"
      });
    } finally {
      setCheckingIn(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Arbitragem & Check-in Presencial</h1>
          <p className="text-xs text-slate-500 font-medium">Gestão da equipe de campo e chamada de atletas por QR Code</p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("checkin")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === "checkin" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500"}`}
          >
            🎟️ Scanner Check-in
          </button>
          <button
            onClick={() => setActiveTab("staff")}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${activeTab === "staff" ? "bg-white text-indigo-600 shadow-xs" : "text-slate-500"}`}
          >
            🛡️ Equipe Staff
          </button>
        </div>
      </div>

      {activeTab === "checkin" && (
        <div className="space-y-6">
          {/* Seletor de Torneio e Entrada de Código */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Torneio Ativo</label>
                <select
                  value={selectedTournamentId}
                  onChange={e => setSelectedTournamentId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-500"
                >
                  <option value="">Selecione um torneio...</option>
                  {tournaments.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">Código do QR Code / Protocolo</label>
                <form onSubmit={e => { e.preventDefault(); handlePerformCheckIn(); }} className="flex gap-2">
                  <input
                    type="text"
                    value={scanInput}
                    onChange={e => setScanInput(e.target.value)}
                    placeholder="Cole ou escaneie o código do QR Code (ex: ID da credencial)..."
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-mono font-semibold text-slate-700 outline-none focus:border-indigo-500"
                  />
                  <button
                    type="submit"
                    disabled={!scanInput.trim() || checkingIn}
                    className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold disabled:opacity-50 transition shrink-0 cursor-pointer shadow-md shadow-indigo-600/20"
                  >
                    {checkingIn ? "Validando..." : "Confirmar Chamada"}
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Card de Resultado do Check-in */}
          {scanResult && (
            <div className={`p-6 rounded-3xl border shadow-lg animate-in fade-in duration-300 ${
              scanResult.status === "checked_in" ? "bg-emerald-50 border-emerald-300 text-emerald-950" :
              scanResult.status === "already_checked_in" ? "bg-amber-50 border-amber-300 text-amber-950" :
              "bg-rose-50 border-rose-300 text-rose-950"
            }`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 ${
                  scanResult.status === "checked_in" ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" :
                  scanResult.status === "already_checked_in" ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30" :
                  "bg-rose-500 text-white shadow-lg shadow-rose-500/30"
                }`}>
                  {scanResult.status === "checked_in" ? "✅" : scanResult.status === "already_checked_in" ? "⚠️" : "⛔"}
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <h3 className="text-base font-black">{scanResult.message}</h3>
                  {scanResult.sub && (
                    <div className="pt-2 mt-2 border-t border-black/10 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="block text-[10px] uppercase font-bold opacity-60">Atleta</span>
                        <span className="font-extrabold">{scanResult.sub.athleteName}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold opacity-60">Status Pagamento</span>
                        <span className="font-bold uppercase">{scanResult.sub.paymentStatus === "paid" ? "✅ Pago" : "⏳ Pendente"}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold opacity-60">Protocolo</span>
                        <span className="font-mono font-bold">{scanResult.sub.id?.slice(0, 8).toUpperCase()}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "staff" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">Quadros da Arbitragem</h2>
            <button 
              onClick={() => setShowAddForm(true)}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-sm cursor-pointer"
            >
              <Plus size={16} /> Novo Membro
            </button>
          </div>

          <AnimatePresence>
            {showAddForm && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm"
              >
                <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Nome Completo</label>
                    <input 
                      type="text"
                      required
                      value={newStaff.name}
                      onChange={e => setNewStaff({...newStaff, name: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 ring-indigo-500/20 transition-all"
                      placeholder="Ex: João Silva"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Função</label>
                    <select 
                      value={newStaff.role}
                      onChange={e => setNewStaff({...newStaff, role: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 ring-indigo-500/20 transition-all"
                    >
                      <option value="referee">Árbitro</option>
                      <option value="table_official">Mesário</option>
                    </select>
                  </div>
                  <div className="flex items-end gap-2">
                    <button type="submit" className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-black uppercase tracking-widest text-xs">Salvar</button>
                    <button type="button" onClick={() => setShowAddForm(false)} className="bg-slate-100 text-slate-400 p-3 rounded-xl">Cancelar</button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {staff.map((member) => (
                <div key={member.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between hover:border-indigo-100 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${member.role === 'referee' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                      {member.role === 'referee' ? <Shield size={20} /> : <UserCheck size={20} />}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">{member.name}</h3>
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-50">
                        {member.role === 'referee' ? 'Árbitro' : 'Mesário'}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDelete(member.id)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              {staff.length === 0 && (
                <div className="col-span-full py-12 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                   <Users className="mx-auto text-slate-300 mb-4" size={48} />
                   <p className="text-slate-400 font-medium">Nenhum membro cadastrado ainda.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
