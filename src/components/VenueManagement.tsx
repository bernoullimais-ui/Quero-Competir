import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, Clock, Calendar, Save, X, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useConfirm } from './ui/ConfirmDialog.tsx';
import { useToast } from './ui/Toast.tsx';

interface Venue {
  id: string;
  name: string;
  address: string;
  availability: { day: string; start: string; end: string }[];
}

const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export default function VenueManagement() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Partial<Venue> | null>(null);
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

  const fetchVenues = async () => {
    try {
      const res = await fetch('/api/tournaments/venues/all', {
        headers: getHeaders()
      });
      const data = await res.json();
      setVenues(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVenues();
  }, []);

  const handleSave = async () => {
    if (!editingVenue?.name) return;
    try {
      const res = await fetch('/api/tournaments/venues', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(editingVenue),
      });
      if (res.ok) {
        success("Sede salva com sucesso!");
        fetchVenues();
        setShowModal(false);
        setEditingVenue(null);
      } else {
        toastError("Erro ao salvar sede.");
      }
    } catch (err) {
      console.error(err);
      toastError("Erro ao conectar com o servidor.");
    }
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = await confirm({
      title: "Excluir Sede",
      message: "Deseja realmente excluir esta sede?",
      variant: "danger"
    });
    if (!isConfirmed) return;
    try {
      const res = await fetch(`/api/tournaments/venues/${id}`, { 
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        success("Sede excluída com sucesso!");
        fetchVenues();
      } else {
        toastError("Erro ao excluir sede.");
      }
    } catch (err) {
      console.error(err);
      toastError("Erro de conexão ao excluir sede.");
    }
  };

  const addAvailability = () => {
    const current = editingVenue?.availability || [];
    setEditingVenue({
      ...editingVenue,
      availability: [...current, { day: 'Segunda', start: '08:00', end: '22:00' }]
    });
  };

  const addUnavailableDate = () => {
    const current = editingVenue?.availability || [];
    setEditingVenue({
      ...editingVenue,
      availability: [...current, { type: 'unavailable', date: '' }]
    });
  };

  const removeAvailability = (index: number) => {
    const current = [...(editingVenue?.availability || [])];
    current.splice(index, 1);
    setEditingVenue({ ...editingVenue, availability: current });
  };

  const updateAvailability = (index: number, field: string, value: string) => {
    const current = [...(editingVenue?.availability || [])];
    current[index] = { ...current[index], [field]: value };
    setEditingVenue({ ...editingVenue, availability: current });
  };

  return (
    <div className="p-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-slate-800 uppercase tracking-tighter">Sedes e Locais</h1>
          <p className="text-slate-500 font-medium">Gerencie os locais das partidas e suas disponibilidades.</p>
        </div>
        <button 
          onClick={() => {
            setEditingVenue({ name: '', address: '', availability: [] });
            setShowModal(true);
          }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg shadow-indigo-600/20"
        >
          <Plus size={16} />
          Nova Sede
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <div key={i} className="h-48 bg-slate-100 rounded-[2rem] animate-pulse" />)}
        </div>
      ) : venues.length === 0 ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem] p-20 text-center">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-slate-200/50">
            <MapPin className="text-slate-300" size={40} />
          </div>
          <h3 className="text-xl font-bold text-slate-400 mb-2">Nenhuma sede cadastrada</h3>
          <p className="text-slate-400 text-sm max-w-xs mx-auto mb-8">Comece cadastrando os clubes, ginásios ou arenas onde os jogos acontecerão.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {venues.map(venue => (
            <motion.div 
              key={venue.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all group relative"
            >
              <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => {
                    setEditingVenue(venue);
                    setShowModal(true);
                  }}
                  className="p-2 text-slate-300 hover:text-indigo-500 transition-colors"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={() => handleDelete(venue.id)}
                  className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4 text-indigo-600">
                <MapPin size={24} />
              </div>

              <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-1">{venue.name}</h3>
              <p className="text-sm text-slate-500 mb-6 flex items-center gap-1">
                <MapPin size={12} />
                {venue.address || 'Endereço não informado'}
              </p>

              <div className="space-y-2">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Clock size={10} />
                  Disponibilidade
                </h4>
                <div className="flex flex-wrap gap-1">
                  {venue.availability?.length > 0 ? venue.availability.map((av, idx) => (
                    <span key={idx} className="px-2 py-1 bg-slate-50 text-slate-600 text-[10px] font-bold rounded-lg border border-slate-100">
                      {av.day}: {av.start}-{av.end}
                    </span>
                  )) : (
                    <span className="text-[10px] text-slate-400 italic">Nenhum horário definido</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">CADASTRAR SEDE</h2>
                  <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-all">
                    <X size={24} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Nome do Local</label>
                    <input 
                      type="text" 
                      value={editingVenue?.name || ''}
                      onChange={(e) => setEditingVenue({ ...editingVenue, name: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-[1.5rem] outline-none transition-all font-bold text-slate-700"
                      placeholder="Ex: Ginásio Municipal"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Endereço/Cidade</label>
                    <input 
                      type="text" 
                      value={editingVenue?.address || ''}
                      onChange={(e) => setEditingVenue({ ...editingVenue, address: e.target.value })}
                      className="w-full px-6 py-4 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-[1.5rem] outline-none transition-all font-bold text-slate-700"
                      placeholder="Ex: Rua das Flores, 123"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horários de Funcionamento</h3>
                    <button 
                      onClick={addAvailability}
                      className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                    >
                      <Plus size={10} />
                      Adicionar Período
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {editingVenue?.availability?.map((av, idx) => {
                      if (av.type === 'unavailable') return null;
                      return (
                      <div key={idx} className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 group">
                        <select 
                          value={av.day || ''}
                          onChange={(e) => updateAvailability(idx, 'day', e.target.value)}
                          className="bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none flex-1"
                        >
                          {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <div className="flex items-center gap-2">
                          <input 
                            type="time" 
                            value={av.start || ''}
                            onChange={(e) => updateAvailability(idx, 'start', e.target.value)}
                            className="bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                          />
                          <span className="text-slate-300 font-bold">às</span>
                          <input 
                            type="time" 
                            value={av.end || ''}
                            onChange={(e) => updateAvailability(idx, 'end', e.target.value)}
                            className="bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none"
                          />
                        </div>
                        <button 
                          onClick={() => removeAvailability(idx)}
                          className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )})}
                    {(!editingVenue?.availability || editingVenue.availability.filter(a => a.type !== 'unavailable').length === 0) && (
                      <div className="text-center py-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <p className="text-xs text-slate-400 font-bold">Nenhum horário selecionado</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Datas Indisponíveis (Exceções)</h3>
                    <button 
                      onClick={addUnavailableDate}
                      className="text-[10px] font-black text-rose-600 uppercase tracking-widest hover:underline flex items-center gap-1"
                    >
                      <Plus size={10} />
                      Adicionar Data
                    </button>
                  </div>

                  <div className="space-y-3">
                    {editingVenue?.availability?.map((av, idx) => {
                      if (av.type !== 'unavailable') return null;
                      return (
                      <div key={idx} className="flex items-center gap-3 bg-rose-50 p-4 rounded-2xl border border-rose-100 group">
                        <input 
                          type="date" 
                          value={av.date || ''}
                          onChange={(e) => updateAvailability(idx, 'date', e.target.value)}
                          className="bg-white border-2 border-rose-200 rounded-xl px-3 py-2 text-xs font-bold outline-none flex-1"
                        />
                        <button 
                          onClick={() => removeAvailability(idx)}
                          className="p-2 text-rose-300 hover:text-rose-500 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    )})}
                    {(!editingVenue?.availability || editingVenue.availability.filter(a => a.type === 'unavailable').length === 0) && (
                       <div className="text-center py-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                        <p className="text-xs text-slate-400 font-bold">Nenhuma data de exceção adicionada</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-[1.5rem] font-black uppercase tracking-widest text-xs transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSave}
                    className="flex-1 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2"
                  >
                    <Save size={16} />
                    Salvar Sede
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
