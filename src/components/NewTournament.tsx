import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy, Calendar, FileText, ArrowRight, Image } from "lucide-react";
import { useToast } from "./ui/Toast.tsx";

export default function NewTournament() {
  const { success: toastSuccess, error: toastError } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    start_date: "",
    end_date: "",
    logo_url: "",
    owner_id: "00000000-0000-0000-0000-000000000000" // Mock Admin ID for now
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const headers: any = { "Content-Type": "application/json" };
      const savedUser = localStorage.getItem("currentUser");
      if (savedUser) {
        const user = JSON.parse(savedUser);
        if (user && user.token) {
          headers["Authorization"] = `Bearer ${user.token}`;
        }
        if (user && user.id) {
          headers["x-organizer-id"] = user.id;
        }
      }
      const res = await fetch("/api/tournaments", {
        method: "POST",
        headers,
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar torneio");
      
      toastSuccess("Torneio criado com sucesso!");
      navigate("/tournaments");
    } catch (err: any) {
      toastError(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
          <Trophy size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Configurar Novo Torneio</h1>
          <p className="text-slate-500 text-sm">Defina as regras, datas e prazos da competição</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-8 rounded-2xl border border-slate-100 shadow-xl">
        <div className="md:col-span-2">
          <label className="block text-sm font-semibold mb-2">Nome do Evento</label>
          <div className="relative">
            <Trophy className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold" size={18} />
            <input 
              required
              type="text"
              placeholder="Ex: Copa Interescolar 2024"
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold mb-2">Descrição / Resumo</label>
          <div className="relative">
            <FileText className="absolute left-4 top-4 text-slate-400" size={18} />
            <textarea 
              rows={3}
              placeholder="Descreva o torneio e principais regras..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="block text-sm font-semibold mb-2">URL do Logotipo / Imagem do Evento (Opcional)</label>
          <div className="relative">
            <Image className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="url"
              placeholder="https://exemplo.com/logo-evento.png"
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-800"
              value={formData.logo_url}
              onChange={e => setFormData({...formData, logo_url: e.target.value})}
            />
          </div>
          {formData.logo_url && (
            <div className="mt-2 flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100 max-w-sm">
              <img 
                src={formData.logo_url} 
                alt="Logo preview" 
                className="w-10 h-10 object-contain rounded-lg border bg-white" 
                onError={(e: any) => e.target.style.display = 'none'} 
                onLoad={(e: any) => e.target.style.display = 'block'} 
              />
              <span className="text-xs text-slate-500">Visualização do Logotipo</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Data de Início</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              required
              type="date"
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-600"
              value={formData.start_date}
              onChange={e => setFormData({...formData, start_date: e.target.value})}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold mb-2">Data de Término</label>
          <div className="relative">
            <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              required
              type="date"
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all text-slate-600"
              value={formData.end_date}
              onChange={e => setFormData({...formData, end_date: e.target.value})}
            />
          </div>
        </div>

        <div className="md:col-span-2 pt-4">
          <button 
            disabled={loading}
            type="submit"
            className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {loading ? "Criando Competição..." : "Criar Torneio"}
            {!loading && <ArrowRight size={18} />}
          </button>
        </div>
      </form>
    </div>
  );
}
