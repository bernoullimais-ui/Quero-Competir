import React, { useState, useEffect } from "react";
import { Plus, Trash2, Copy, Check, Ticket, DollarSign, Percent, CheckCircle2, AlertCircle, X, Search, Edit2 } from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "fixed";
  discount_value: number;
  max_uses: number | null;
  uses_count: number;
  valid_until: string | null;
  category_ids: string[] | null;
  is_active: boolean;
  created_at: string;
}

interface CouponsTabProps {
  tournamentId: string;
  athleteSubs: any[];
  registrations: any[];
  categories: any[];
}

export function CouponsTab({ tournamentId, athleteSubs, registrations, categories }: CouponsTabProps) {
  const token = React.useMemo(() => {
    try {
      const savedUser = localStorage.getItem("currentUser");
      if (savedUser) return JSON.parse(savedUser).token;
    } catch {}
    return null;
  }, []);

  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<"list" | "history">("list");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState<string>("");
  const [maxUses, setMaxUses] = useState<string>("");
  const [validUntil, setValidUntil] = useState<string>("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchCoupons();
  }, [tournamentId]);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/coupons`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setCoupons(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const isEdit = !!editingCouponId;
      const url = isEdit 
        ? `/api/tournaments/${tournamentId}/coupons/${editingCouponId}` 
        : `/api/tournaments/${tournamentId}/coupons`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          code,
          description,
          discountType,
          discountValue: Number(discountValue),
          maxUses: maxUses ? Number(maxUses) : null,
          validUntil: validUntil ? new Date(validUntil).toISOString() : null,
          categoryIds: selectedCategories
        })
      });
      const data = await res.json();
      if (data.success) {
        if (isEdit) {
          setCoupons(coupons.map(c => c.id === editingCouponId ? data.data : c));
        } else {
          setCoupons([data.data, ...coupons]);
        }
        closeModal();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const closeModal = () => {
    setShowCreateModal(false);
    setEditingCouponId(null);
    setCode("");
    setDescription("");
    setDiscountType("percent");
    setDiscountValue("");
    setMaxUses("");
    setValidUntil("");
    setSelectedCategories([]);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCouponId(coupon.id);
    setCode(coupon.code);
    setDescription(coupon.description || "");
    setDiscountType(coupon.discount_type);
    setDiscountValue(coupon.discount_value.toString());
    setMaxUses(coupon.max_uses ? coupon.max_uses.toString() : "");
    setValidUntil(coupon.valid_until ? new Date(coupon.valid_until).toISOString().slice(0, 16) : "");
    setSelectedCategories(coupon.category_ids || []);
    setShowCreateModal(true);
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/coupons/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ is_active: !currentStatus })
      });
      const data = await res.json();
      if (data.success) {
        setCoupons(coupons.map(c => c.id === id ? { ...c, is_active: !currentStatus } : c));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cupom? Esta ação não pode ser desfeita.")) return;
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/coupons/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setCoupons(coupons.filter(c => c.id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // KPIs
  const activeCouponsCount = coupons.filter(c => c.is_active && (!c.valid_until || new Date(c.valid_until) > new Date()) && (!c.max_uses || c.uses_count < c.max_uses)).length;
  
  // Calculate total discounts given from athleteSubs and registrations
  const totalDiscountAthletes = athleteSubs.reduce((acc, sub) => acc + (Number(sub.discountAmount) || 0), 0);
  const totalDiscountTeams = registrations.reduce((acc, reg) => acc + (Number(reg.discountAmount || reg.discount_amount) || 0), 0);
  const totalDiscountsGiven = totalDiscountAthletes + totalDiscountTeams;

  const totalUses = coupons.reduce((acc, c) => acc + c.uses_count, 0);

  // Compile history
  const historyItems: any[] = [];
  athleteSubs.forEach(sub => {
    if (sub.couponCode) {
      historyItems.push({
        id: sub.id,
        type: "athlete",
        name: sub.athleteName,
        code: sub.couponCode,
        discount: Number(sub.discountAmount) || 0,
        date: sub.createdAt || new Date().toISOString(),
        status: sub.paymentStatus
      });
    }
  });
  registrations.forEach(reg => {
    const code = reg.coupon_code || reg.couponCode;
    if (code) {
      historyItems.push({
        id: reg.id,
        type: "team",
        name: reg.institution?.name || "Instituição",
        code: code,
        discount: Number(reg.discount_amount || reg.discountAmount) || 0,
        date: reg.created_at || new Date().toISOString(),
        status: reg.status
      });
    }
  });
  historyItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (loading) {
    return <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Ticket size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Cupons Ativos</span>
            <span className="text-2xl font-black text-slate-800">{activeCouponsCount}</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Usado</span>
            <span className="text-2xl font-black text-slate-800">{totalUses}</span>
            <span className="text-[10px] text-slate-400 block mt-1">vezes aplicados</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <DollarSign size={24} />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Descontos Concedidos</span>
            <span className="text-2xl font-black text-amber-600">{formatCurrency(totalDiscountsGiven)}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        {/* Header Tabs */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveSubTab("list")}
              className={`py-5 text-sm font-bold border-b-2 transition-colors ${
                activeSubTab === "list" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              📋 Gerenciar Cupons
            </button>
            <button
              onClick={() => setActiveSubTab("history")}
              className={`py-5 text-sm font-bold border-b-2 transition-colors ${
                activeSubTab === "history" ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              📊 Histórico de Uso
            </button>
          </div>
          {activeSubTab === "list" && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors"
            >
              <Plus size={16} /> Novo Cupom
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="p-0">
          {activeSubTab === "list" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold text-slate-600">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 text-[10px] uppercase tracking-wider">
                    <th className="py-4 px-6 font-bold">Código</th>
                    <th className="py-4 px-6 font-bold">Desconto</th>
                    <th className="py-4 px-6 font-bold">Uso</th>
                    <th className="py-4 px-6 font-bold">Validade</th>
                    <th className="py-4 px-6 font-bold">Restrições</th>
                    <th className="py-4 px-6 text-center font-bold">Status</th>
                    <th className="py-4 px-6 text-right font-bold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {coupons.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Ticket size={32} className="mx-auto mb-3 text-slate-300" />
                        <p className="font-bold text-sm">Nenhum cupom criado</p>
                        <p className="text-xs mt-1">Crie seu primeiro cupom para oferecer descontos.</p>
                      </td>
                    </tr>
                  ) : (
                    coupons.map((coupon) => {
                      const isExpired = coupon.valid_until && new Date(coupon.valid_until) < new Date();
                      const isExhausted = coupon.max_uses !== null && coupon.uses_count >= coupon.max_uses;
                      
                      let statusBadge = null;
                      if (!coupon.is_active) {
                        statusBadge = <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold">Inativo</span>;
                      } else if (isExpired) {
                        statusBadge = <span className="px-2.5 py-1 bg-red-50 text-red-600 rounded-lg text-[10px] font-bold">Expirado</span>;
                      } else if (isExhausted) {
                        statusBadge = <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-bold">Esgotado</span>;
                      } else {
                        statusBadge = <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-bold">Ativo</span>;
                      }

                      return (
                        <tr key={coupon.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-2">
                              <span className="font-black text-sm text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                {coupon.code}
                              </span>
                              <button 
                                onClick={() => copyToClipboard(coupon.code, coupon.id)}
                                className="text-slate-400 hover:text-indigo-600 transition-colors"
                                title="Copiar código"
                              >
                                {copiedId === coupon.id ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                              </button>
                            </div>
                            {coupon.description && <div className="text-[10px] text-slate-400 mt-1">{coupon.description}</div>}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-1.5 font-bold text-slate-700">
                              {coupon.discount_type === "percent" ? (
                                <><Percent size={14} className="text-indigo-500" /> {coupon.discount_value}% OFF</>
                              ) : (
                                <><DollarSign size={14} className="text-emerald-500" /> {formatCurrency(Number(coupon.discount_value))}</>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-700">{coupon.uses_count} {coupon.max_uses ? `/ ${coupon.max_uses}` : "usos"}</span>
                              {!coupon.max_uses && <span className="text-[10px] text-slate-400">Ilimitado</span>}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            {coupon.valid_until ? (
                              <span className={isExpired ? "text-red-500 font-bold" : "text-slate-600"}>
                                {new Date(coupon.valid_until).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px] uppercase">Sem validade</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            {coupon.category_ids && coupon.category_ids.length > 0 ? (
                              <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md font-bold">
                                {coupon.category_ids.length} categoria(s)
                              </span>
                            ) : (
                              <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-1 rounded-md font-bold">Todas</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-center">
                            {statusBadge}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleToggleStatus(coupon.id, coupon.is_active)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors ${
                                  coupon.is_active ? "bg-slate-100 hover:bg-slate-200 text-slate-600" : "bg-indigo-50 hover:bg-indigo-100 text-indigo-600"
                                }`}
                              >
                                {coupon.is_active ? "Desativar" : "Ativar"}
                              </button>
                              <button
                                onClick={() => openEditModal(coupon)}
                                className="p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors"
                                title="Editar Cupom"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(coupon.id)}
                                className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
                                title="Excluir Cupom"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeSubTab === "history" && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-semibold text-slate-600">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-400 text-[10px] uppercase tracking-wider">
                    <th className="py-4 px-6 font-bold">Data</th>
                    <th className="py-4 px-6 font-bold">Inscrição</th>
                    <th className="py-4 px-6 font-bold">Cupom Utilizado</th>
                    <th className="py-4 px-6 font-bold text-right">Desconto Concedido</th>
                    <th className="py-4 px-6 font-bold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {historyItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <Search size={32} className="mx-auto mb-3 text-slate-300" />
                        <p className="font-bold text-sm">Nenhum uso registrado</p>
                        <p className="text-xs mt-1">Os cupons utilizados aparecerão aqui.</p>
                      </td>
                    </tr>
                  ) : (
                    historyItems.map((item, idx) => (
                      <tr key={`${item.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6 text-slate-500">
                          {new Date(item.date).toLocaleDateString()} às {new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-800">{item.name}</div>
                          <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-0.5">
                            {item.type === "athlete" ? "Atleta Individual" : "Equipe / Instituição"}
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-black text-xs text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                            {item.code}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right font-bold text-emerald-600">
                          - {formatCurrency(item.discount)}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {item.status === "paid" || item.status === "confirmed" ? (
                            <span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded-md text-[10px] font-bold">Pago</span>
                          ) : (
                            <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-md text-[10px] font-bold">Pendente</span>
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
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 shrink-0">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <Ticket className="text-indigo-600" /> {editingCouponId ? "Editar Cupom" : "Criar Novo Cupom"}
              </h3>
              <button
                onClick={closeModal}
                className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <form id="couponForm" onSubmit={handleSaveCoupon} className="space-y-5">
                <div className="grid grid-cols-2 gap-5">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Código do Cupom *</label>
                    <input
                      type="text"
                      required
                      value={code}
                      onChange={e => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
                      placeholder="Ex: BLACKFRIDAY20"
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all uppercase"
                    />
                  </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Tipo de Desconto *</label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setDiscountType("percent")}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${discountType === "percent" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      Percentual (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType("fixed")}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${discountType === "fixed" ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      Valor Fixo (R$)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Valor *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-slate-400 font-bold text-sm">
                      {discountType === "percent" ? "%" : "R$"}
                    </span>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step={discountType === "percent" ? "1" : "0.01"}
                      value={discountValue}
                      onChange={e => setDiscountValue(e.target.value)}
                      placeholder={discountType === "percent" ? "20" : "50.00"}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Limite de Usos</label>
                  <input
                    type="number"
                    min="1"
                    value={maxUses}
                    onChange={e => setMaxUses(e.target.value)}
                    placeholder="Ilimitado"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Validade</label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={e => setValidUntil(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Restringir por Categorias</label>
                  <select
                    multiple
                    value={selectedCategories}
                    onChange={e => {
                      const options = Array.from(e.target.selectedOptions, option => option.value);
                      setSelectedCategories(options);
                    }}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 focus:border-indigo-500 outline-none h-28"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1.5">Mantenha sem seleção para aplicar a todas as categorias. Segure CTRL/CMD para selecionar múltiplas.</p>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Descrição (Opcional)</label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Ex: Parceria escola XYZ"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 disabled:opacity-70 flex items-center justify-center"
                >
                  {submitting ? "Salvando..." : editingCouponId ? "Salvar Alterações" : "Criar Cupom"}
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
