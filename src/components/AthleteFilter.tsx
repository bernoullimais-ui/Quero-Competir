import React, { useState, useEffect } from "react";
import { Users, UserPlus, Search, ShieldCheck, Building2, Activity } from "lucide-react";
import AthleteStatsModal from "./AthleteStatsModal.tsx";
import { useToast } from "./ui/Toast.tsx";

export default function AthleteFilter() {
  const { success: toastSuccess, error: toastError } = useToast();
  const [members, setMembers] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [selectedInst, setSelectedInst] = useState("");
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  
  const [selectedAthleteStats, setSelectedAthleteStats] = useState<{id: string, name: string} | null>(null);
  
  const [newAthlete, setNewAthlete] = useState({
    full_name: "",
    document_number: "",
    birth_date: "",
    institution_id: ""
  });

  const getHeaders = (extraHeaders: any = {}) => {
    const headersObj: any = { ...extraHeaders };
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        if (user && user.token) {
          headersObj["Authorization"] = `Bearer ${user.token}`;
        }
        if (user && user.id) {
          headersObj["x-organizer-id"] = user.id;
        }
      } catch (e) {}
    }
    return headersObj;
  };

  // Carregar instituições para o seletor
  useEffect(() => {
    fetch("/api/institutions", {
      headers: getHeaders()
    })
      .then(res => res.json())
      .then(data => setInstitutions(Array.isArray(data) ? data : []));
  }, []);

  // Carregar atletas quando a instituição for selecionada
  useEffect(() => {
    if (selectedInst) {
      setLoading(true);
      fetch(`/api/members/institution/${selectedInst}`, {
        headers: getHeaders()
      })
        .then(res => res.json())
        .then(data => {
          setMembers(Array.isArray(data) ? data : []);
          setLoading(false);
        });
    } else {
      // Se não houver instituição selecionada, carregar todos
      fetch("/api/members", {
        headers: getHeaders()
      })
        .then(res => res.json())
        .then(data => {
          setMembers(Array.isArray(data) ? data : []);
        });
    }
  }, [selectedInst]);

  const handleAddAthlete = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: getHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(newAthlete)
      });
      const data = await res.json();
      if (res.ok) {
        setMembers([data, ...members]);
        setShowModal(false);
        setNewAthlete({ full_name: "", document_number: "", birth_date: "", institution_id: selectedInst });
        toastSuccess("Atleta salvo com sucesso!");
      } else {
        toastError(data.error || "Erro ao salvar atleta");
      }
    } catch (err) {
      toastError("Erro ao salvar atleta");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="text-emerald-500" />
            Filtro de Segurança
          </h1>
          <p className="text-slate-500 text-sm">Controle de atletas autorizados pelas instituições</p>
        </div>
        <button 
          onClick={() => {
            setNewAthlete({...newAthlete, institution_id: selectedInst});
            setShowModal(true);
          }}
          className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-100 hover:scale-[1.02] transition-transform"
        >
          <UserPlus size={18} />
          Pré-registrar Atleta
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filtros Laterais */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Filtrar Instituição</label>
            <select 
              className="w-full p-3 rounded-xl border border-slate-200 text-sm outline-none focus:border-indigo-500 transition-all font-medium"
              value={selectedInst}
              onChange={(e) => setSelectedInst(e.target.value)}
            >
              <option value="">Todas as Instituições</option>
              {institutions.map(inst => (
                <option key={inst.id} value={inst.id}>{inst.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Lista de Atletas */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-50 relative">
              <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Buscar por nome ou documento..."
                className="w-full pl-12 pr-4 py-2 bg-slate-50 rounded-lg text-sm outline-none border border-transparent focus:border-indigo-100"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    <th className="px-6 py-4">Atleta</th>
                    <th className="px-6 py-4">Documento</th>
                    <th className="px-6 py-4">Nascimento</th>
                    {!selectedInst && <th className="px-6 py-4">Instituição</th>}
                    <th className="px-6 py-4">Vínculo</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan={5} className="px-6 py-10 text-center animate-pulse">Carregando dados...</td></tr>
                  ) : members.length > 0 ? (
                    members.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                              {m.full_name.charAt(0)}
                            </div>
                            <span className="font-semibold text-sm">{m.full_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs font-mono text-slate-500">{m.document_number}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{new Date(m.birth_date).toLocaleDateString()}</td>
                        {!selectedInst && (
                          <td className="px-6 py-4 text-sm text-slate-600 font-medium italic">
                            {m.institutions?.name || "Sem vínculo"}
                          </td>
                        )}
                        <td className="px-6 py-4">
                          <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                            Autorizado
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => setSelectedAthleteStats({ id: m.id, name: m.full_name })}
                            className="p-2 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                            title="Ver Estatísticas"
                          >
                            <Activity size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center text-slate-400 italic">
                        Nenhum atleta pré-registrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Pré-registro */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in duration-200">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <UserPlus className="text-indigo-600" />
              Novo Atleta Autorizado
            </h2>
            <form onSubmit={handleAddAthlete} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Instituição</label>
                <select 
                  required
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500"
                  value={newAthlete.institution_id}
                  onChange={e => setNewAthlete({...newAthlete, institution_id: e.target.value})}
                >
                  <option value="">Selecione uma instituição...</option>
                  {institutions.map(inst => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Nome Completo</label>
                <input 
                  required
                  className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500"
                  value={newAthlete.full_name}
                  onChange={e => setNewAthlete({...newAthlete, full_name: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Documento (RG/CPF)</label>
                  <input 
                    required
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500"
                    placeholder="00.000.000-0"
                    value={newAthlete.document_number}
                    onChange={e => setNewAthlete({...newAthlete, document_number: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Data de Nasc.</label>
                  <input 
                    required
                    type="date"
                    className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500"
                    value={newAthlete.birth_date}
                    onChange={e => setNewAthlete({...newAthlete, birth_date: e.target.value})}
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-colors"
                >
                  Confirmar Autorização
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedAthleteStats && (
        <AthleteStatsModal 
          athleteId={selectedAthleteStats.id}
          athleteName={selectedAthleteStats.name}
          isOpen={true}
          onClose={() => setSelectedAthleteStats(null)}
        />
      )}
    </div>
  );
}
