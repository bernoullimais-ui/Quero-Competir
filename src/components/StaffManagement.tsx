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
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/tournaments/staff', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(newStaff),
      });
      if (res.ok) {
        setNewStaff({ name: '', role: 'referee' });
        setShowAddForm(false);
        success("Membro de staff cadastrado!");
        fetchStaff();
      } else {
        toastError("Erro ao cadastrar membro.");
      }
    } catch (err) {
      console.error(err);
      toastError("Erro ao conectar com o servidor.");
    }
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm({
      title: "Excluir Membro",
      message: "Deseja realmente excluir este membro do staff?",
      variant: "danger"
    });
    if (!isConfirmed) return;
    try {
      const res = await fetch(`/api/tournaments/staff/${id}`, { 
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        success("Membro excluído com sucesso!");
        fetchStaff();
      } else {
        toastError("Erro ao excluir membro.");
      }
    } catch (err) {
      console.error(err);
      toastError("Erro de conexão ao excluir membro.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 lg:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Arbitragem e Staff</h1>
          <p className="text-slate-500">Gerencie o cadastro de árbitros e mesários para escala das partidas.</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-600/20"
        >
          <Plus size={16} />
          Novo Membro
        </button>
      </div>

      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-8 bg-white p-6 rounded-3xl border border-slate-100 shadow-xl"
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
  );
}
