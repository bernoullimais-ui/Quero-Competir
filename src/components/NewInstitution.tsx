import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Building2, ArrowRight, CheckCircle2 } from "lucide-react";
import { useToast } from "./ui/Toast.tsx";

export default function NewInstitution() {
  const { error: toastError } = useToast();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    document_number: "",
    email: "",
    responsible_name: "",
    responsible_phone: "",
    logo_url: ""
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

  useEffect(() => {
    if (isEditing) {
      fetch(`/api/institutions/${id}`, {
        headers: getHeaders()
      })
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setFormData({
              name: data.name || "",
              document_number: data.document_number || data.tax_id || data.cnpj || "",
              email: data.email || "",
              responsible_name: data.responsible_name || "",
              responsible_phone: data.responsible_phone || "",
              logo_url: data.logo_url || ""
            });
          }
        });
    }
  }, [id, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const url = isEditing ? `/api/institutions/${id}` : "/api/institutions";
      const method = isEditing ? "PUT" : "POST";
      
      const res = await fetch(url, {
        method,
        headers: getHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(formData)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao salvar");
      
      setSuccess(true);
      setTimeout(() => navigate("/instituicoes"), 2000);
    } catch (err: any) {
      toastError(`Erro ao cadastrar instituição: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-4">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} />
        </div>
        <h2 className="text-2xl font-bold">{isEditing ? "Instituição Atualizada!" : "Instituição Cadastrada!"}</h2>
        <p className="text-slate-500 text-sm italic">Redirecionando para a listagem...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
          <Building2 size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{isEditing ? "Editar Instituição" : "Cadastrar Instituição"}</h1>
          <p className="text-slate-500 text-sm">Escolas, Clubes ou Associações Esportivas</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl border border-slate-100 shadow-xl space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-2">Nome da Instituição</label>
            <input 
              required
              type="text"
              placeholder="Ex: Clube Atlético Vila Nova"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
          </div>
          
          <div className="md:col-span-2">
            <label className="block text-sm font-semibold mb-2">URL do Logo / Escudo (Opcional)</label>
            <div className="flex items-center gap-4">
              <input 
                type="url"
                placeholder="https://exemplo.com/logo.png"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                value={formData.logo_url}
                onChange={e => setFormData({...formData, logo_url: e.target.value})}
              />
              {formData.logo_url && (
                <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                  <img src={formData.logo_url} alt="Logo preview" className="w-10 h-10 object-contain" onError={(e: any) => e.target.style.display = 'none'} onLoad={(e: any) => e.target.style.display = 'block'} />
                </div>
              )}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-semibold mb-2">Documento (CNPJ)</label>
            <input 
              required
              type="text"
              placeholder="00.000.000/0000-00"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              value={formData.document_number}
              onChange={e => setFormData({...formData, document_number: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">E-mail Institucional</label>
            <input 
              required
              type="email"
              placeholder="contato@clube.com"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div className="md:col-span-2 border-t border-slate-100 pt-6 mt-2">
            <h3 className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-4">Dados do Responsável</h3>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Nome do Responsável</label>
            <input 
              required
              type="text"
              placeholder="Ex: João Silva"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              value={formData.responsible_name}
              onChange={e => setFormData({...formData, responsible_name: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Telefone</label>
            <input 
              required
              type="text"
              placeholder="(00) 00000-0000"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
              value={formData.responsible_phone}
              onChange={e => setFormData({...formData, responsible_phone: e.target.value})}
            />
          </div>
        </div>

        <button 
          disabled={loading}
          type="submit"
          className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
        >
          {loading ? "Salvando..." : isEditing ? "Salvar Alterações" : "Finalizar Cadastro"}
          {!loading && <ArrowRight size={18} />}
        </button>
      </form>
    </div>
  );
}
