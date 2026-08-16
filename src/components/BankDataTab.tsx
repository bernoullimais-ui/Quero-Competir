import React, { useState, useEffect } from "react";
import {
  CreditCard,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Percent,
  Save,
  HelpCircle,
  ExternalLink,
  UserCheck,
  Lock
} from "lucide-react";
import { useToast } from "./ui/Toast.tsx";

const BRAZILIAN_BANKS = [
  { code: "001", name: "Banco do Brasil S.A." },
  { code: "237", name: "Banco Bradesco S.A." },
  { code: "341", name: "Itaú Unibanco S.A." },
  { code: "104", name: "Caixa Econômica Federal" },
  { code: "033", name: "Banco Santander (Brasil) S.A." },
  { code: "260", name: "Nu Pagamentos S.A. (Nubank)" },
  { code: "077", name: "Banco Inter S.A." },
  { code: "336", name: "Banco C6 S.A." },
  { code: "290", name: "PagBank (PagSeguro)" },
  { code: "208", name: "Banco BTG Pactual S.A." },
  { code: "212", name: "Banco Original S.A." },
  { code: "655", name: "Banco Votorantim S.A. (BV)" },
  { code: "422", name: "Banco Safra S.A." },
  { code: "748", name: "Banco Cooperativo Sicredi S.A." },
  { code: "756", name: "Banco Sicoob (SICOOB)" }
];

interface BankDataTabProps {
  organizationId: string;
}

function getAuthToken(): string {
  const directToken = localStorage.getItem("token");
  if (directToken) return directToken;

  const savedUser = localStorage.getItem("currentUser");
  if (savedUser) {
    try {
      const u = JSON.parse(savedUser);
      if (u && u.token) return u.token;
    } catch (_) {}
  }
  return "";
}

export const BankDataTab: React.FC<BankDataTabProps> = ({ organizationId }) => {
  const { success, error } = useToast();

  const savedUser = localStorage.getItem("currentUser");
  const user = savedUser ? JSON.parse(savedUser) : null;
  const isSuperAdmin = user?.role === "super_admin";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingFee, setUpdatingFee] = useState(false);

  const [pagarmeRecipientId, setPagarmeRecipientId] = useState<string | null>(null);
  const [recipientStatus, setRecipientStatus] = useState<string>("not_configured");
  const [platformFeePercent, setPlatformFeePercent] = useState<number>(10);
  const [adminFeeInput, setAdminFeeInput] = useState<number>(10);

  // Bank Form State
  const [holderName, setHolderName] = useState("");
  const [holderDocument, setHolderDocument] = useState("");
  const [holderType, setHolderType] = useState<"individual" | "corporation">("individual");
  const [bankCode, setBankCode] = useState("341");
  const [bankBranch, setBankBranch] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountDigit, setBankAccountDigit] = useState("");
  const [bankAccountType, setBankAccountType] = useState<"checking" | "savings">("checking");
  const [holderEmail, setHolderEmail] = useState("");
  const [holderPhone, setHolderPhone] = useState("");

  const fetchRecipientStatus = async () => {
    const targetId = organizationId || "org-1";
    setLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/payments/organizations/${targetId}/recipient-status`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        console.warn("Erro ao buscar status do recebedor:", res.statusText);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data && !data.error) {
        setPagarmeRecipientId(data.pagarmeRecipientId || null);
        setRecipientStatus(data.pagarmeRecipientStatus || "not_configured");
        setPlatformFeePercent(data.platformFeePercent !== undefined ? data.platformFeePercent : 10);
        setAdminFeeInput(data.platformFeePercent !== undefined ? data.platformFeePercent : 10);

        if (data.bankData) {
          setHolderName(data.bankData.holderName || "");
          setHolderDocument(data.bankData.holderDocument || "");
          setHolderType(data.bankData.holderType || "individual");
          setBankCode(data.bankData.bankCode || "341");
          setBankBranch(data.bankData.bankBranch || "");
          
          const accFull = data.bankData.bankAccount || "";
          if (accFull.includes("-")) {
            const parts = accFull.split("-");
            setBankAccount(parts[0]);
            setBankAccountDigit(parts[1]);
          } else {
            setBankAccount(accFull);
            setBankAccountDigit("");
          }

          setBankAccountType(data.bankData.bankAccountType || "checking");
          setHolderEmail(data.bankData.holderEmail || "");
          setHolderPhone(data.bankData.holderPhone || "");
        }
      }
    } catch (err: any) {
      console.error("Error fetching recipient status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipientStatus();
  }, [organizationId]);

  const handleSubmitRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holderName || !holderDocument || !bankBranch || !bankAccount) {
      error("Por favor, preencha todos os campos bancários obrigatórios.");
      return;
    }

    setSaving(true);
    try {
      const token = getAuthToken();
      const targetId = organizationId || "org-1";
      const res = await fetch(`/api/payments/organizations/${targetId}/create-recipient`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          holderName,
          holderDocument,
          holderType,
          bankCode,
          bankBranch,
          bankAccount,
          bankAccountDigit,
          bankAccountType,
          holderEmail,
          holderPhone
        })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Falha ao registrar conta bancária no gateway");
      }

      setPagarmeRecipientId(data.pagarmeRecipientId);
      setRecipientStatus(data.pagarmeRecipientStatus || "active");
      success("Dados bancários salvos e conta de recebimento configurada no Pagar.me! 🚀");
      fetchRecipientStatus();
    } catch (err: any) {
      error("Erro ao salvar dados bancários: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePlatformFee = async () => {
    setUpdatingFee(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/payments/admin/organizations/${organizationId}/fee`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ platformFeePercent: adminFeeInput })
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Erro ao atualizar percentual");
      }

      setPlatformFeePercent(data.platformFeePercent);
      success(`Percentual da plataforma atualizado para ${data.platformFeePercent}% com sucesso!`);
    } catch (err: any) {
      error(err.message);
    } finally {
      setUpdatingFee(false);
    }
  };

  const organizerPercent = 100 - platformFeePercent;

  if (loading) {
    return (
      <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-slate-500 font-medium text-sm">Carregando configurações de recebimento...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ── Status do Recebedor (KYC Banner) ───────────────────────── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0 border border-indigo-100 shadow-xs">
              <CreditCard size={28} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Split & Recebimentos Pagar.me</h3>
              <p className="text-slate-500 text-xs mt-0.5">
                Configure sua conta bancária para receber repasses automáticos das inscrições vendidas.
              </p>
            </div>
          </div>

          {/* Status Badge */}
          {recipientStatus === "active" && (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-xs shadow-xs">
              <CheckCircle2 size={16} /> Conta Ativa e Verificada
            </span>
          )}

          {(recipientStatus === "registration" || recipientStatus === "waiting_for_doc") && (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 font-bold text-xs shadow-xs">
              <Clock size={16} /> Em Análise / KYC Pagar.me
            </span>
          )}

          {recipientStatus === "not_configured" && (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 font-bold text-xs shadow-xs">
              <AlertTriangle size={16} /> Não Configurado
            </span>
          )}

          {(recipientStatus === "suspended" || recipientStatus === "refused") && (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-700 border border-red-200 font-bold text-xs shadow-xs">
              <AlertTriangle size={16} /> Conta Suspensa / Pendente
            </span>
          )}
        </div>

        {/* Resumo de Split de Comissão */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sua Participação</span>
              <h4 className="text-2xl font-black text-emerald-600 mt-1">{organizerPercent}%</h4>
              <p className="text-slate-500 text-xs mt-0.5">Repasse direto na sua conta cadastrada</p>
            </div>
            <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center">
              <ShieldCheck size={20} />
            </div>
          </div>

          <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Taxa de Serviço Quero Competir</span>
              <h4 className="text-2xl font-black text-indigo-600 mt-1">{platformFeePercent}%</h4>
              <p className="text-slate-500 text-xs mt-0.5">Retido automaticamente por split</p>
            </div>
            <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center">
              <Percent size={20} />
            </div>
          </div>
        </div>

        {pagarmeRecipientId && (
          <div className="p-4 bg-slate-100/70 rounded-xl text-xs text-slate-600 flex items-center justify-between font-mono">
            <span>ID do Recebedor Pagar.me: <strong className="text-slate-800">{pagarmeRecipientId}</strong></span>
            <span className="text-slate-400 font-sans">Split Ativo</span>
          </div>
        )}
      </div>

      {/* ── Painel Admin (Apenas Super Admin) ────────────────────────── */}
      {isSuperAdmin && (
        <div className="bg-indigo-950 text-white rounded-3xl p-6 sm:p-8 border border-indigo-900 shadow-xl space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-800 text-indigo-300 rounded-xl flex items-center justify-center font-bold">
              👑
            </div>
            <div>
              <h3 className="text-md font-bold text-white">Painel do Administrador Plataforma</h3>
              <p className="text-indigo-300 text-xs">Configure o percentual de comissão retido nesta organização especificamente.</p>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-indigo-900/50 p-4 rounded-2xl border border-indigo-800/80">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-indigo-200 mb-1">
                Percentual da Plataforma (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={adminFeeInput}
                onChange={(e) => setAdminFeeInput(Number(e.target.value))}
                className="w-full bg-indigo-900 text-white font-bold px-4 py-2.5 rounded-xl border border-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-400 text-sm"
              />
            </div>

            <button
              type="button"
              disabled={updatingFee}
              onClick={handleUpdatePlatformFee}
              className="mt-5 px-6 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {updatingFee ? "Salvando..." : <><Save size={16} /> Salvar Taxa</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Formulário de Dados Bancários ────────────────────────────── */}
      <form onSubmit={handleSubmitRecipient} className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
          <Building2 className="text-indigo-600" size={24} />
          <div>
            <h4 className="text-md font-bold text-slate-800">Dados da Conta Bancária para Repasse</h4>
            <p className="text-slate-500 text-xs">Informe a conta bancária para onde os valores das inscrições devem ser transferidos pelo Pagar.me.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome do Titular da Conta *
            </label>
            <input
              type="text"
              required
              placeholder="Razão Social ou Nome Completo do Titular"
              value={holderName}
              onChange={(e) => setHolderName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-hidden font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              CPF ou CNPJ do Titular *
            </label>
            <input
              type="text"
              required
              placeholder="00.000.000/0000-00 ou 000.000.000-00"
              value={holderDocument}
              onChange={(e) => {
                setHolderDocument(e.target.value);
                const clean = e.target.value.replace(/\D/g, "");
                if (clean.length > 11) setHolderType("corporation");
                else setHolderType("individual");
              }}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-hidden font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tipo de Pessoa
            </label>
            <select
              value={holderType}
              onChange={(e) => setHolderType(e.target.value as any)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-hidden font-medium bg-white"
            >
              <option value="individual">Pessoa Física (CPF)</option>
              <option value="corporation">Pessoa Jurídica (CNPJ)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Banco *
            </label>
            <select
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-hidden font-medium bg-white"
            >
              {BRAZILIAN_BANKS.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.code} - {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Agência (Sem Dígito) *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: 0001"
              value={bankBranch}
              onChange={(e) => setBankBranch(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-hidden font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Número da Conta *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: 12345"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-hidden font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Dígito da Conta
            </label>
            <input
              type="text"
              placeholder="Ex: 6 ou 0"
              value={bankAccountDigit}
              onChange={(e) => setBankAccountDigit(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-hidden font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tipo da Conta
            </label>
            <select
              value={bankAccountType}
              onChange={(e) => setBankAccountType(e.target.value as any)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-hidden font-medium bg-white"
            >
              <option value="checking">Conta Corrente</option>
              <option value="savings">Conta Poupança</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              E-mail Financeiro
            </label>
            <input
              type="email"
              placeholder="financeiro@suaempresa.com.br"
              value={holderEmail}
              onChange={(e) => setHolderEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-hidden font-medium"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Lock size={14} className="text-indigo-600" /> Seus dados são transmitidos com criptografia para a API Pagar.me.
          </p>

          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all shadow-md shadow-indigo-200 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Registrando no Pagar.me...
              </>
            ) : (
              <>
                <Save size={16} /> Salvar e Registrar Recebedor
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
