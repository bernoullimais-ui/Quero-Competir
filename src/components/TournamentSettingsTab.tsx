import React, { useState, useEffect } from "react";
import { 
  Settings, Save, Plus, Trash2, Shield, Calendar, Users, 
  HelpCircle, ToggleLeft, ToggleRight, CheckSquare, Square, FileText, Upload, GripVertical
} from "lucide-react";
import { useToast } from "./ui/Toast.tsx";
import { useConfirm } from "./ui/ConfirmDialog.tsx";

interface TournamentSettingsTabProps {
  tournamentId: string;
}

interface FieldConfig {
  id: string;
  label: string;
  enabled: boolean;
  required: boolean;
  custom: boolean;
}

interface UploadConfig {
  id: string;
  label: string;
  enabled: boolean;
  required: boolean;
  custom: boolean;
}

interface TermConfig {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  required: boolean;
  custom?: boolean;
}

interface RegistrationConfig {
  fields: FieldConfig[];
  uploads: UploadConfig[];
  terms: TermConfig[];
}

interface SubSettings {
  deadline: string;
  feeType: 'free' | 'by_team' | 'by_team_and_athlete_institution' | 'by_team_and_athlete_parent';
  teamFee: number;
  athleteFee: number;
  status: 'open' | 'closed';
  requireMembership?: boolean;
  registrationConfig: RegistrationConfig;
  maxVisitorsPerAthlete?: number;
}

function getDefaultRegistrationConfig(): RegistrationConfig {
  return {
    fields: [
      { id: "parentName", label: "Nome do Responsável", enabled: true, required: true, custom: false },
      { id: "parentPhone", label: "Telefone do Responsável", enabled: true, required: true, custom: false },
      { id: "bloodType", label: "Tipo Sanguíneo", enabled: true, required: false, custom: false },
      { id: "allergies", label: "Alergias / Restrições", enabled: true, required: false, custom: false },
      { id: "emergencyContact", label: "Contato de Emergência", enabled: true, required: true, custom: false }
    ],
    uploads: [
      { id: "document", label: "Documento de Identidade (RG/CPF)", enabled: true, required: true, custom: false },
      { id: "photo", label: "Foto de Rosto (3x4)", enabled: true, required: true, custom: false }
    ],
    terms: [
      { 
        id: "imageUse", 
        title: "1. Concessão de Direito de Uso de Imagem", 
        content: "Autorizo expressamente o organizador do torneio a capturar e utilizar imagens, vídeos e transmissões de áudio nas quais o atleta participante figure, com finalidade puramente de divulgação esportiva, cobertura oficial das partidas, publicações em mídias impressas, redes sociais e portal oficial da competição, sem que isso gere qualquer direito a retribuição financeira.", 
        enabled: true, 
        required: true 
      },
      { 
        id: "liability", 
        title: "2. Termo de Aptidão Física e Responsabilidade", 
        content: "Declaro estar inteiramente ciente das regras oficiais do torneio. Sob as penas da lei, declaro que o atleta encontra-se plenamente apto e saudável para a participação em esportes competitivos, gozando de perfeita saúde física e mental. Isento de qualquer responsabilidade civil ou criminal os realizadores, a instituição escolar representativa e os patrocinadores por acidentes, imprevistos ou perdas decorrentes do andamento regular dos jogos.", 
        enabled: true, 
        required: true 
      }
    ]
  };
}

export default function TournamentSettingsTab({ tournamentId }: TournamentSettingsTabProps) {
  const { success: toastSuccess, error: toastError } = useToast();
  const { confirm } = useConfirm();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<SubSettings>({
    deadline: "",
    feeType: "free",
    teamFee: 0,
    athleteFee: 0,
    status: "open",
    requireMembership: false,
    registrationConfig: getDefaultRegistrationConfig(),
    maxVisitorsPerAthlete: 0
  });

  // States for new custom items
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldRequired, setNewFieldRequired] = useState(false);

  const [newUploadName, setNewUploadName] = useState("");
  const [newUploadRequired, setNewUploadRequired] = useState(false);

  const [newTermTitle, setNewTermTitle] = useState("");
  const [newTermContent, setNewTermContent] = useState("");
  const [newTermRequired, setNewTermRequired] = useState(true);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/tournaments/${tournamentId}/subscription-settings`);
      const data = await res.json();
      if (data && !data.error) {
        const hasConfig = data.registrationConfig && 
                          (data.registrationConfig.fields?.length > 0 || 
                           data.registrationConfig.uploads?.length > 0 || 
                           data.registrationConfig.terms?.length > 0);
        setSettings({
          deadline: data.deadline || "",
          feeType: data.feeType || "free",
          teamFee: Number(data.teamFee) || 0,
          athleteFee: Number(data.athleteFee) || 0,
          status: data.status || "open",
          requireMembership: !!data.requireMembership,
          registrationConfig: hasConfig ? data.registrationConfig : getDefaultRegistrationConfig(),
          maxVisitorsPerAthlete: Number(data.maxVisitorsPerAthlete) || 0
        });
      }
    } catch (err) {
      console.error("Erro ao carregar configurações", err);
      toastError("Erro ao carregar configurações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tournamentId) {
      fetchSettings();
    }
  }, [tournamentId]);

  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      const res = await fetch(`/api/tournaments/${tournamentId}/subscription-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        toastSuccess("Configurações salvas com sucesso!");
        fetchSettings();
      } else {
        const err = await res.json();
        toastError(err.error || "Erro ao salvar configurações.");
      }
    } catch (err) {
      console.error("Erro ao salvar configurações", err);
      toastError("Erro de conexão ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  // Fields manipulation
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    const updatedFields = [...settings.registrationConfig.fields];
    const draggedItem = updatedFields[draggedIndex];
    
    updatedFields.splice(draggedIndex, 1);
    updatedFields.splice(index, 0, draggedItem);
    
    setDraggedIndex(index);
    setSettings({
      ...settings,
      registrationConfig: {
        ...settings.registrationConfig,
        fields: updatedFields
      }
    });
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const toggleFieldEnabled = (index: number) => {
    const updatedFields = [...settings.registrationConfig.fields];
    updatedFields[index].enabled = !updatedFields[index].enabled;
    setSettings({
      ...settings,
      registrationConfig: { ...settings.registrationConfig, fields: updatedFields }
    });
  };

  const toggleFieldRequired = (index: number) => {
    const updatedFields = [...settings.registrationConfig.fields];
    updatedFields[index].required = !updatedFields[index].required;
    setSettings({
      ...settings,
      registrationConfig: { ...settings.registrationConfig, fields: updatedFields }
    });
  };

  const addCustomField = () => {
    if (!newFieldName.trim()) return;
    const newField: FieldConfig = {
      id: `custom_field_${Date.now()}`,
      label: newFieldName.trim(),
      enabled: true,
      required: newFieldRequired,
      custom: true
    };
    setSettings({
      ...settings,
      registrationConfig: {
        ...settings.registrationConfig,
        fields: [...settings.registrationConfig.fields, newField]
      }
    });
    setNewFieldName("");
    setNewFieldRequired(false);
  };

  const removeField = async (id: string) => {
    const isConfirmed = await confirm({
      title: "Excluir Campo",
      message: "Tem certeza que deseja excluir este campo personalizado? Dados preenchidos por atletas nesta ficha poderão não ser mais visíveis.",
      variant: "danger",
      confirmText: "Excluir",
      cancelText: "Cancelar"
    });
    if (!isConfirmed) return;

    const filtered = settings.registrationConfig.fields.filter(f => f.id !== id);
    setSettings({
      ...settings,
      registrationConfig: { ...settings.registrationConfig, fields: filtered }
    });
  };

  // Uploads manipulation
  const toggleUploadEnabled = (index: number) => {
    const updatedUploads = [...settings.registrationConfig.uploads];
    updatedUploads[index].enabled = !updatedUploads[index].enabled;
    setSettings({
      ...settings,
      registrationConfig: { ...settings.registrationConfig, uploads: updatedUploads }
    });
  };

  const toggleUploadRequired = (index: number) => {
    const updatedUploads = [...settings.registrationConfig.uploads];
    updatedUploads[index].required = !updatedUploads[index].required;
    setSettings({
      ...settings,
      registrationConfig: { ...settings.registrationConfig, uploads: updatedUploads }
    });
  };

  const addCustomUpload = () => {
    if (!newUploadName.trim()) return;
    const newUpload: UploadConfig = {
      id: `custom_upload_${Date.now()}`,
      label: newUploadName.trim(),
      enabled: true,
      required: newUploadRequired,
      custom: true
    };
    setSettings({
      ...settings,
      registrationConfig: {
        ...settings.registrationConfig,
        uploads: [...settings.registrationConfig.uploads, newUpload]
      }
    });
    setNewUploadName("");
    setNewUploadRequired(false);
  };

  const removeUpload = async (id: string) => {
    const isConfirmed = await confirm({
      title: "Excluir Anexo",
      message: "Tem certeza que deseja excluir este anexo personalizado?",
      variant: "danger",
      confirmText: "Excluir",
      cancelText: "Cancelar"
    });
    if (!isConfirmed) return;

    const filtered = settings.registrationConfig.uploads.filter(u => u.id !== id);
    setSettings({
      ...settings,
      registrationConfig: { ...settings.registrationConfig, uploads: filtered }
    });
  };

  // Terms manipulation
  const toggleTermEnabled = (index: number) => {
    const updatedTerms = [...settings.registrationConfig.terms];
    updatedTerms[index].enabled = !updatedTerms[index].enabled;
    setSettings({
      ...settings,
      registrationConfig: { ...settings.registrationConfig, terms: updatedTerms }
    });
  };

  const updateTermText = (index: number, key: 'title' | 'content', value: string) => {
    const updatedTerms = [...settings.registrationConfig.terms];
    updatedTerms[index][key] = value;
    setSettings({
      ...settings,
      registrationConfig: { ...settings.registrationConfig, terms: updatedTerms }
    });
  };

  const addCustomTerm = () => {
    if (!newTermTitle.trim() || !newTermContent.trim()) return;
    const newTerm: TermConfig = {
      id: `custom_term_${Date.now()}`,
      title: newTermTitle.trim(),
      content: newTermContent.trim(),
      enabled: true,
      required: newTermRequired,
      custom: true
    };
    setSettings({
      ...settings,
      registrationConfig: {
        ...settings.registrationConfig,
        terms: [...settings.registrationConfig.terms, newTerm]
      }
    });
    setNewTermTitle("");
    setNewTermContent("");
    setNewTermRequired(true);
  };

  const removeTerm = async (id: string) => {
    const isConfirmed = await confirm({
      title: "Excluir Termo",
      message: "Tem certeza que deseja excluir este termo personalizado?",
      variant: "danger",
      confirmText: "Excluir",
      cancelText: "Cancelar"
    });
    if (!isConfirmed) return;

    const filtered = settings.registrationConfig.terms.filter(t => t.id !== id);
    setSettings({
      ...settings,
      registrationConfig: { ...settings.registrationConfig, terms: filtered }
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-10 h-10 border-4 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-slate-500 font-bold text-sm">Carregando configurações...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* SEÇÃO 1: PARÂMETROS GERAIS E TAXAS */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Settings size={20} className="text-indigo-600" />
          <div>
            <h3 className="text-lg font-bold text-slate-800">Parâmetros das Inscrições & Taxas</h3>
            <p className="text-xs text-slate-500 font-medium">Configure prazos, status e as tarifas obrigatórias para a entidade ou responsáveis.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Prazo Limite de Inscrição</label>
            <input 
              type="date"
              value={settings.deadline}
              onChange={e => setSettings({...settings, deadline: e.target.value})}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Modelo de Cobrança / Taxa</label>
            <select
              value={settings.feeType}
              onChange={e => setSettings({...settings, feeType: e.target.value as any})}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 bg-white"
            >
              <option value="free">Gratuita</option>
              <option value="by_team">Paga por Equipe</option>
              <option value="by_team_and_athlete_institution">Paga por Equipe + Atletas (Pela Instituição)</option>
              <option value="by_team_and_athlete_parent">Paga por Equipe (Instituição) + Atletas (Pelos Responsáveis)</option>
            </select>
          </div>

          {settings.feeType !== "free" && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Taxa por Equipe (R$)</label>
              <input 
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={settings.teamFee || ""}
                onChange={e => setSettings({...settings, teamFee: Number(e.target.value)})}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 bg-white"
              />
            </div>
          )}

          {settings.feeType.includes("athlete") && (
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Taxa por Atleta (R$)</label>
              <input 
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={settings.athleteFee || ""}
                onChange={e => setSettings({...settings, athleteFee: Number(e.target.value)})}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 bg-white"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Status do Recrutamento</label>
            <select
              value={settings.status}
              onChange={e => setSettings({...settings, status: e.target.value as any})}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 bg-white"
            >
              <option value="open">Inscrições Abertas</option>
              <option value="closed">Inscrições Encerradas / Suspensas</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Máx. Visitantes por Atleta</label>
            <input 
              type="number"
              min="0"
              placeholder="Sem limite (0)"
              value={settings.maxVisitorsPerAthlete || ""}
              onChange={e => setSettings({...settings, maxVisitorsPerAthlete: Number(e.target.value)})}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 bg-white"
            />
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <h4 className="text-sm font-bold text-slate-800">Filiação / Anuidade Obrigatória</h4>
            <p className="text-xs text-slate-500 font-medium">
              Se ativado, apenas atletas com anuidade ativa para o ano vigente do torneio serão aceitos no evento.
            </p>
          </div>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => setSettings(prev => ({ ...prev, requireMembership: !prev.requireMembership }))}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                settings.requireMembership ? 'bg-indigo-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  settings.requireMembership ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="ml-3 text-xs font-bold text-slate-700">
              {settings.requireMembership ? "Exigir Filiação Ativa" : "Não Exigir Filiação"}
            </span>
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: DADOS COLETADOS (FICHA DE INSCRIÇÃO) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Users size={20} className="text-indigo-600" />
          <div>
            <h3 className="text-lg font-bold text-slate-800">Campos da Ficha de Inscrição</h3>
            <p className="text-xs text-slate-500 font-medium">Selecione quais dados coletar na ficha individual de cada atleta e crie campos adicionais se necessário.</p>
          </div>
        </div>

        {/* Campos padrão e customizados */}
        <div className="space-y-4">
          <div className="grid grid-cols-12 text-xs font-bold text-slate-400 uppercase tracking-wider px-4 pb-2 border-b border-slate-50">
            <div className="col-span-1"></div>
            <div className="col-span-5 md:col-span-7">Nome do Campo</div>
            <div className="col-span-3 md:col-span-2 text-center">Habilitado (Utilizar)</div>
            <div className="col-span-3 md:col-span-2 text-center">Obrigatório</div>
          </div>

          {settings.registrationConfig.fields.map((field, idx) => (
            <div 
              key={field.id} 
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className={`grid grid-cols-12 items-center px-4 py-3 rounded-2xl border transition-all ${
                draggedIndex === idx
                  ? "opacity-50 border-indigo-400 bg-indigo-50/30 scale-[0.99] shadow-inner"
                  : field.enabled ? 'bg-slate-50/30 border-slate-100' : 'bg-slate-100/10 border-slate-100/50 opacity-60'
              }`}
            >
              <div className="col-span-1 flex items-center justify-center text-slate-400 cursor-grab active:cursor-grabbing hover:text-indigo-600 transition-colors">
                <GripVertical size={18} />
              </div>

              <div className="col-span-5 md:col-span-7 flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">{field.label}</span>
                {field.custom && (
                  <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full text-[10px] font-bold">
                    Personalizado
                  </span>
                )}
              </div>
              
              <div className="col-span-3 md:col-span-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => toggleFieldEnabled(idx)}
                  className="text-slate-400 hover:text-indigo-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
                  title={field.enabled ? "Desativar campo" : "Ativar campo"}
                >
                  {field.enabled ? (
                    <CheckSquare size={22} className="text-indigo-600" />
                  ) : (
                    <Square size={22} className="text-slate-400" />
                  )}
                </button>
              </div>

              <div className="col-span-3 md:col-span-2 flex justify-center items-center gap-4">
                <button
                  type="button"
                  onClick={() => field.enabled && toggleFieldRequired(idx)}
                  disabled={!field.enabled}
                  className={`transition ${!field.enabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  {field.required ? (
                    <CheckSquare size={20} className="text-indigo-600" />
                  ) : (
                    <Square size={20} className="text-slate-400 hover:text-indigo-600" />
                  )}
                </button>

                {field.custom && (
                  <button
                    type="button"
                    onClick={() => removeField(field.id)}
                    className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded-lg transition"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Novo campo personalizado */}
        <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-3">
          <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Adicionar Novo Campo Personalizado</h4>
          <div className="flex flex-col md:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Etiqueta/Nome do Campo (ex: "Nome da Mãe", "Matrícula Escolar")</label>
              <input
                type="text"
                value={newFieldName}
                onChange={e => setNewFieldName(e.target.value)}
                placeholder="Ex: Tamanho da Camiseta"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-xs font-semibold text-slate-700 bg-white"
              />
            </div>
            <div className="flex items-center gap-2 py-2">
              <button
                type="button"
                onClick={() => setNewFieldRequired(!newFieldRequired)}
                className="flex items-center gap-1.5"
              >
                {newFieldRequired ? (
                  <CheckSquare size={18} className="text-indigo-600" />
                ) : (
                  <Square size={18} className="text-slate-400" />
                )}
                <span className="text-xs font-bold text-slate-600">Obrigatório</span>
              </button>
            </div>
            <button
              type="button"
              onClick={addCustomField}
              className="bg-indigo-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition flex items-center gap-1 cursor-pointer w-full md:w-auto justify-center"
            >
              <Plus size={16} /> Adicionar
            </button>
          </div>
        </div>
      </div>

      {/* SEÇÃO 3: UPLOADS OBRIGATÓRIOS/OPCIONAIS */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Upload size={20} className="text-indigo-600" />
          <div>
            <h3 className="text-lg font-bold text-slate-800">Arquivos e Documentos Solicitados</h3>
            <p className="text-xs text-slate-500 font-medium">Configure quais arquivos de imagem ou documento (PDF/Fotos) os atletas devem anexar durante a inscrição.</p>
          </div>
        </div>

        {/* Uploads padrão e customizados */}
        <div className="space-y-4">
          <div className="grid grid-cols-12 text-xs font-bold text-slate-400 uppercase tracking-wider px-4 pb-2 border-b border-slate-50">
            <div className="col-span-6 md:col-span-8">Tipo do Arquivo</div>
            <div className="col-span-3 md:col-span-2 text-center">Habilitado (Utilizar)</div>
            <div className="col-span-3 md:col-span-2 text-center">Obrigatório</div>
          </div>

          {settings.registrationConfig.uploads.map((upload, idx) => (
            <div 
              key={upload.id} 
              className={`grid grid-cols-12 items-center px-4 py-3 rounded-2xl border transition-all ${
                upload.enabled ? 'bg-slate-50/30 border-slate-100' : 'bg-slate-100/10 border-slate-100/50 opacity-60'
              }`}
            >
              <div className="col-span-6 md:col-span-8 flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">{upload.label}</span>
                {upload.custom && (
                  <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full text-[10px] font-bold">
                    Personalizado
                  </span>
                )}
              </div>
              
              <div className="col-span-3 md:col-span-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => toggleUploadEnabled(idx)}
                  className="text-slate-400 hover:text-indigo-600 transition-colors p-1.5 rounded-lg hover:bg-slate-100"
                  title={upload.enabled ? "Desativar upload" : "Ativar upload"}
                >
                  {upload.enabled ? (
                    <CheckSquare size={22} className="text-indigo-600" />
                  ) : (
                    <Square size={22} className="text-slate-400" />
                  )}
                </button>
              </div>

              <div className="col-span-3 md:col-span-2 flex justify-center items-center gap-4">
                <button
                  type="button"
                  onClick={() => upload.enabled && toggleUploadRequired(idx)}
                  disabled={!upload.enabled}
                  className={`transition ${!upload.enabled ? 'opacity-30 cursor-not-allowed' : ''}`}
                >
                  {upload.required ? (
                    <CheckSquare size={20} className="text-indigo-600" />
                  ) : (
                    <Square size={20} className="text-slate-400 hover:text-indigo-600" />
                  )}
                </button>

                {upload.custom && (
                  <button
                    type="button"
                    onClick={() => removeUpload(upload.id)}
                    className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded-lg transition"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Novo upload personalizado */}
        <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-3">
          <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Adicionar Solicitação de Upload Personalizada</h4>
          <div className="flex flex-col md:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Título do Documento (ex: "Atestado Médico de Aptidão Física", "Autorização Escolar")</label>
              <input
                type="text"
                value={newUploadName}
                onChange={e => setNewUploadName(e.target.value)}
                placeholder="Ex: Atestado de Matrícula"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-xs font-semibold text-slate-700 bg-white"
              />
            </div>
            <div className="flex items-center gap-2 py-2">
              <button
                type="button"
                onClick={() => setNewUploadRequired(!newUploadRequired)}
                className="flex items-center gap-1.5"
              >
                {newUploadRequired ? (
                  <CheckSquare size={18} className="text-indigo-600" />
                ) : (
                  <Square size={18} className="text-slate-400" />
                )}
                <span className="text-xs font-bold text-slate-600">Obrigatório</span>
              </button>
            </div>
            <button
              type="button"
              onClick={addCustomUpload}
              className="bg-indigo-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition flex items-center gap-1 cursor-pointer w-full md:w-auto justify-center"
            >
              <Plus size={16} /> Adicionar
            </button>
          </div>
        </div>
      </div>

      {/* SEÇÃO 4: TERMOS E DECLARAÇÕES */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Shield size={20} className="text-indigo-600" />
          <div>
            <h3 className="text-lg font-bold text-slate-800">Termos, Declarações e Consentimento</h3>
            <p className="text-xs text-slate-500 font-medium">Edite o regulamento ou declare termos personalizados de isenção de responsabilidade que necessitem de aceitação obrigatória.</p>
          </div>
        </div>

        {/* Lista de termos */}
        <div className="space-y-6">
          {settings.registrationConfig.terms.map((term, idx) => (
            <div 
              key={term.id} 
              className={`p-5 rounded-2xl border transition-all ${
                term.enabled ? 'bg-slate-50/20 border-slate-200' : 'bg-slate-100/10 border-slate-100/50 opacity-60'
              } space-y-3`}
            >
              <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">
                    {term.custom ? `Termo Customizado: ${term.title}` : term.title}
                  </span>
                  {!term.custom && (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold border border-slate-200">
                      Padrão do Sistema
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => toggleTermEnabled(idx)}
                    className="flex items-center gap-1.5 text-xs font-bold text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    {term.enabled ? (
                      <CheckSquare size={20} className="text-indigo-600" />
                    ) : (
                      <Square size={20} className="text-slate-400" />
                    )}
                    <span>{term.enabled ? "Utilizar Termo" : "Não Utilizar"}</span>
                  </button>

                  {term.custom && (
                    <button
                      type="button"
                      onClick={() => removeTerm(term.id)}
                      className="text-rose-500 hover:text-rose-700 p-1 hover:bg-rose-50 rounded-lg transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {term.enabled && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Título do Termo / Declaração</label>
                    <input
                      type="text"
                      value={term.title}
                      onChange={e => updateTermText(idx, 'title', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-xs font-semibold text-slate-700 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">Texto do Termo / Conteúdo Legal</label>
                    <textarea
                      rows={4}
                      value={term.content}
                      onChange={e => updateTermText(idx, 'content', e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-xs font-semibold text-slate-600 bg-white"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Novo termo personalizado */}
        <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-3">
          <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wide">Criar Novo Termo ou Regulamento Especial</h4>
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-500 mb-1">Título do Termo</label>
                <input
                  type="text"
                  value={newTermTitle}
                  onChange={e => setNewTermTitle(e.target.value)}
                  placeholder="Ex: 3. Aceite das Regras Gerais do Campeonato"
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-xs font-semibold text-slate-700 bg-white"
                />
              </div>
              <div className="flex items-center md:justify-end gap-2 py-3">
                <button
                  type="button"
                  onClick={() => setNewTermRequired(!newTermRequired)}
                  className="flex items-center gap-1.5"
                >
                  {newTermRequired ? (
                    <CheckSquare size={18} className="text-indigo-600" />
                  ) : (
                    <Square size={18} className="text-slate-400" />
                  )}
                  <span className="text-xs font-bold text-slate-600">Aceite Obrigatório</span>
                </button>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">Conteúdo Legal</label>
              <textarea
                rows={3}
                value={newTermContent}
                onChange={e => setNewTermContent(e.target.value)}
                placeholder="Insira as cláusulas do regulamento ou consentimento de responsabilidade..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none text-xs font-semibold text-slate-600 bg-white"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={addCustomTerm}
                className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl hover:bg-indigo-700 transition flex items-center gap-1 cursor-pointer"
              >
                <Plus size={16} /> Adicionar Termo
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* AÇÃO PERSISTENTE DE SALVAR */}
      <div className="bg-slate-50 border border-slate-100 p-4 rounded-3xl flex items-center justify-between gap-4 sticky bottom-4 shadow-md">
        <div className="text-xs text-slate-500 font-semibold">
          Certifique-se de salvar para persistir todas as modificações no servidor.
        </div>
        <button
          onClick={handleSaveSettings}
          disabled={saving}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white min-h-[44px] px-6 text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <Save size={16} />
          {saving ? "Salvando..." : "Salvar Todas as Configurações"}
        </button>
      </div>

    </div>
  );
}
