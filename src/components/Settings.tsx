import React, { useState, useEffect } from 'react';
import { Building2, Palette, Link as LinkIcon, Globe, Image as ImageIcon, Save, Phone, Mail, FileText } from 'lucide-react';
import { useToast } from './ui/Toast.tsx';

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'geral' | 'visual' | 'redes' | 'avancado'>('geral');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { success, error: toastError } = useToast();
  const [formData, setFormData] = useState({
    name: 'Minha Liga Esportiva',
    cnpj: '',
    description: '',
    email: '',
    phone: '',
    logo_url: '',
    primary_color: '#4F46E5',
    secondary_color: '#0F172A',
    font_family: 'inter',
    website: '',
    instagram: '',
    youtube: '',
    subdomain: 'minhaliga',
    auto_approve_registrations: false,
    show_incomplete_brackets: true,
    requires_membership_fee: false,
    membership_fee_amount: 0,
  });

  useEffect(() => {
    const headers: any = {};
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
    fetch('/api/tournaments/organization', { headers })
      .then(res => res.json())
      .then(data => {
        if (data) {
          setFormData(prev => ({
            ...prev,
            ...data
          }));
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const headers: any = {
        'Content-Type': 'application/json'
      };
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
      const res = await fetch('/api/tournaments/organization', {
        method: 'PUT',
        headers,
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        success('Configurações salvas com sucesso!');
      } else {
        const err = await res.json();
        toastError('Erro ao salvar: ' + err.error);
      }
    } catch (err: any) {
      toastError('Erro: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Carregando configurações...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configurações da Organização</h1>
          <p className="text-gray-500 mt-1">Gerencie a identidade visual e dados do seu portal de torneios</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
        >
          <Save size={20} />
          {saving ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row">
        {/* Settings Menu */}
        <div className="w-full md:w-64 bg-gray-50 border-b md:border-b-0 md:border-r border-gray-200">
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab('geral')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'geral' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Building2 size={18} />
              Informações Gerais
            </button>
            <button
              onClick={() => setActiveTab('visual')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'visual' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Palette size={18} />
              Identidade Visual
            </button>
            <button
              onClick={() => setActiveTab('redes')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'redes' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <LinkIcon size={18} />
              Links & Redes Sociais
            </button>
            <button
              onClick={() => setActiveTab('avancado')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                activeTab === 'avancado' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Globe size={18} />
              Avançado & Domínio
            </button>
          </nav>
        </div>

        {/* Settings Content */}
        <div className="flex-1 p-6 md:p-8">
          {activeTab === 'geral' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-100 pb-4">Dados da Organização</h2>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Organização</label>
                    <input type="text" name="name" value={formData.name || ''} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">CNPJ (Opcional)</label>
                    <input type="text" name="cnpj" value={formData.cnpj || ''} onChange={handleChange} placeholder="00.000.000/0000-00" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Curta</label>
                  <textarea rows={3} name="description" value={formData.description || ''} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Uma breve descrição sobre a organização que aparecerá nas páginas dos torneios..."></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email de Contato</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-2.5 text-gray-400" size={18} />
                      <input type="email" name="email" value={formData.email || ''} onChange={handleChange} placeholder="contato@exemplo.com" className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 text-gray-400" size={18} />
                      <input type="tel" name="phone" value={formData.phone || ''} onChange={handleChange} placeholder="(00) 00000-0000" className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'visual' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-100 pb-4">Identidade Visual</h2>
              
              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Logotipo Principal (URL)</label>
                  <input type="text" name="logo_url" value={formData.logo_url || ''} onChange={handleChange} placeholder="https://exemplo.com/minha-logo.png" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                  <p className="mt-2 text-sm text-gray-500">Insira um link de imagem direta para o logotipo oficial da organização.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Cor Primária</label>
                    <div className="flex items-center gap-4">
                      <input type="color" name="primary_color" value={formData.primary_color || '#4F46E5'} onChange={handleChange} className="h-12 w-20 p-1 border border-gray-300 rounded cursor-pointer" />
                      <input type="text" name="primary_color" value={formData.primary_color || '#4F46E5'} onChange={handleChange} className="w-28 px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">Cor Secundária</label>
                    <div className="flex items-center gap-4">
                      <input type="color" name="secondary_color" value={formData.secondary_color || '#0F172A'} onChange={handleChange} className="h-12 w-20 p-1 border border-gray-300 rounded cursor-pointer" />
                      <input type="text" name="secondary_color" value={formData.secondary_color || '#0F172A'} onChange={handleChange} className="w-28 px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Estilo de Fonte Principal</label>
                  <select name="font_family" value={formData.font_family || 'inter'} onChange={handleChange} className="w-full md:w-1/2 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                    <option value="inter">Inter (Moderna & Limpa)</option>
                    <option value="roboto">Roboto (Clássica)</option>
                    <option value="space">Space Grotesk (Arrojada & Esportiva)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'redes' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-100 pb-4">Redes Sociais & Links</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Website Oficial</label>
                  <div className="flex shadow-sm rounded-lg">
                    <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">https://</span>
                    <input type="text" name="website" value={formData.website || ''} onChange={handleChange} placeholder="www.seusite.com.br" className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-none rounded-r-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instagram Profile</label>
                  <div className="flex shadow-sm rounded-lg">
                    <span className="inline-flex items-center px-4 rounded-l-lg border border-r-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">@</span>
                    <input type="text" name="instagram" value={formData.instagram || ''} onChange={handleChange} placeholder="seuperfil" className="flex-1 min-w-0 px-4 py-2 border border-gray-300 rounded-none rounded-r-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">YouTube Channel URL</label>
                  <input type="text" name="youtube" value={formData.youtube || ''} onChange={handleChange} placeholder="https://youtube.com/c/SeuCanal" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                  <p className="mt-1 text-xs text-gray-500">Útil caso você transmita partidas ao vivo.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'avancado' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 border-b border-gray-100 pb-4">Configurações Avançadas</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subdomínio Público</label>
                  <div className="flex shadow-sm rounded-lg">
                    <input type="text" name="subdomain" value={formData.subdomain || 'minhaliga'} onChange={handleChange} className="flex-1 min-w-0 text-right px-4 py-2 border border-gray-300 rounded-none rounded-l-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                    <span className="inline-flex items-center px-4 rounded-r-lg border border-l-0 border-gray-300 bg-gray-50 text-gray-500 sm:text-sm">.querocompetir.com.br</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Este será o link público onde atletas e fãs poderão ver seus torneios.</p>
                </div>

                <div className="border-t border-gray-100 pt-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Padrões do Sistema</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                        <span className="text-sm font-medium text-gray-700">Aprovar inscrições automaticamente</span>
                        <input type="checkbox" name="auto_approve_registrations" checked={formData.auto_approve_registrations} onChange={handleChange} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                      </label>
                    </div>
                    <div>
                      <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                        <span className="text-sm font-medium text-gray-700">Exibir chaves incompletas ao público</span>
                        <input type="checkbox" name="show_incomplete_brackets" checked={formData.show_incomplete_brackets} onChange={handleChange} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-6 animate-in fade-in duration-300">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Filiação & Anuidade Esportiva</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50 cursor-pointer">
                        <span className="text-sm font-medium text-gray-700">Cobrar taxa de anuidade/filiação</span>
                        <input type="checkbox" name="requires_membership_fee" checked={formData.requires_membership_fee || false} onChange={handleChange} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded" />
                      </label>
                    </div>
                    {formData.requires_membership_fee && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Valor da Taxa de Anuidade (R$)</label>
                        <input type="number" name="membership_fee_amount" min="0" step="0.01" value={formData.membership_fee_amount || 0} onChange={handleChange} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-semibold" />
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
