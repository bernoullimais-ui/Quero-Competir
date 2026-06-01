import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  CreditCard, QrCode, FileText, CheckCircle2, AlertCircle, 
  Calendar, DollarSign, Building2, Trophy, Copy, Check, ArrowRight, Loader2
} from "lucide-react";

export default function PublicPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"pix" | "boleto" | "card">("pix");
  const [submitting, setSubmitting] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Pagar.me dynamic results
  const [pixData, setPixData] = useState<{ qrCode: string; qrCodeUrl: string } | null>(null);
  const [boletoData, setBoletoData] = useState<{ barcode: string; pdfUrl: string } | null>(null);

  // Copy states
  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedBoleto, setCopiedBoleto] = useState(false);

  // Card Form State
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardFocused, setCardFocused] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/institutions/payments/public/${id}?t=${Date.now()}`)
      .then(res => {
        if (!res.ok) throw new Error("Link de pagamento expirado ou inexistente.");
        return res.json();
      })
      .then(data => {
        setPayment(data);
        if (data.allowedMethods && data.allowedMethods.length > 0) {
          setActiveTab(data.allowedMethods[0]);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setError(err.message || "Não foi possível carregar os detalhes de pagamento.");
        setLoading(false);
      });
  }, [id]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !payment) return;

    setSubmitting(true);
    setPayError(null);

    try {
      let bodyData: any = { method: activeTab };

      // Se já temos a chave Pix gerada e clicamos novamente, simulamos a confirmação
      if (activeTab === "pix" && pixData) {
        bodyData.simulateSuccess = true;
      }
      // Se já temos o boleto gerado e clicamos novamente, simulamos a confirmação
      else if (activeTab === "boleto" && boletoData) {
        bodyData.simulateSuccess = true;
      }
      // Se for cartão, fazemos a tokenização real (ou mock)
      else if (activeTab === "card") {
        if (!cardNumber || !cardHolder || !cardExpiry || !cardCvv) {
          throw new Error("Preencha todos os campos do cartão.");
        }
        
        let cardToken = "mock_card_token_" + Math.random().toString(36).substring(2, 10);

        if (payment.pagarmePublicKey) {
          try {
            const expMonth = Number(cardExpiry.split("/")[0]);
            const expYear = Number("20" + cardExpiry.split("/")[1]);
            
            const tokenRes = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${payment.pagarmePublicKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "card",
                card: {
                  number: cardNumber.replace(/\s/g, ""),
                  holder_name: cardHolder,
                  exp_month: expMonth,
                  exp_year: expYear,
                  cvv: cardCvv
                }
              })
            });
            
            const tokenData = await tokenRes.json();
            if (!tokenRes.ok) {
              throw new Error(tokenData.message || "Erro ao gerar token do cartão.");
            }
            cardToken = tokenData.id;
          } catch (tokenErr: any) {
            throw new Error(tokenErr.message || "Dados do cartão inválidos ou recusados pelo gateway.");
          }
        }
        
        bodyData.cardToken = cardToken;
      }

      const res = await fetch(`/api/institutions/payments/public/${id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (data.paid) {
          setSuccess(true);
        } else if (activeTab === "pix") {
          setPixData({ qrCode: data.qrCode, qrCodeUrl: data.qrCodeUrl });
        } else if (activeTab === "boleto") {
          setBoletoData({ barcode: data.barcode, pdfUrl: data.pdfUrl });
        }
      } else {
        setPayError(data.error || "Ocorreu um erro ao processar o pagamento.");
      }
    } catch (err: any) {
      console.error(err);
      setPayError(err.message || "Erro de conexão com o servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
  };

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isExpired = () => {
    if (!payment?.deadline) return false;
    const now = new Date();
    const limit = new Date(payment.deadline + "T23:59:59");
    return now > limit;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <Loader2 size={44} className="text-indigo-600 animate-spin mb-4" />
        <p className="text-slate-500 text-sm font-semibold">Carregando checkout seguro...</p>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Checkout Indisponível</h2>
        <p className="text-slate-500 text-sm mt-1 max-w-sm">{error || "Link de pagamento inválido ou expirado."}</p>
        <button
          onClick={() => navigate("/")}
          className="mt-6 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-100"
        >
          Ir para Início
        </button>
      </div>
    );
  }

  const expired = isExpired();
  const alreadyPaid = payment.status === "paid";

  if (success || alreadyPaid) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        {/* Simple DOM Confetti Animation Elements */}
        {success && Array(20).fill(0).map((_, idx) => (
          <div 
            key={idx}
            className="absolute rounded-full pointer-events-none animate-ping"
            style={{
              width: Math.random() * 12 + 6 + "px",
              height: Math.random() * 12 + 6 + "px",
              backgroundColor: ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6"][idx % 5],
              left: Math.random() * 100 + "%",
              top: Math.random() * 100 + "%",
              animationDuration: Math.random() * 3 + 1 + "s",
              opacity: 0.7
            }}
          />
        ))}

        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-100 shadow-xl space-y-6">
          <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-2 mx-auto shadow-inner">
            <CheckCircle2 size={48} className="animate-bounce" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800">Pagamento Confirmado!</h2>
            <p className="text-slate-500 text-sm mt-2">
              A taxa da instituição <strong>{payment.institutionName}</strong> para o torneio <strong>{payment.tournamentName}</strong> foi liquidada com sucesso.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left text-xs space-y-2.5">
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Instituição:</span>
              <span className="text-slate-700 font-bold">{payment.institutionName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Torneio:</span>
              <span className="text-slate-700 font-bold">{payment.tournamentName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">Valor Pago:</span>
              <span className="text-slate-800 font-extrabold">{formatCurrency(payment.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-semibold">ID do Link:</span>
              <span className="text-slate-600 font-mono font-bold">{payment.id}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400">Este comprovante foi integrado ao painel do organizador automaticamente.</p>

          <button
            onClick={() => navigate("/")}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-50 transition-all text-sm"
          >
            Voltar para Início
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
        
        {/* Info Column */}
        <div className="md:col-span-5 flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white border border-slate-200 rounded-full">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
              <span className="text-xs font-bold font-sans text-slate-600">Checkout Seguro de Entidade</span>
            </div>

            <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight leading-tight">
              Taxa de Adesão
            </h1>

            {/* Ticket Card Details */}
            <div className="p-6 bg-gradient-to-br from-indigo-700 to-indigo-900 text-white shadow-xl shadow-indigo-100/50 rounded-3xl space-y-4 border border-indigo-600 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-300">Torneio Alvo</p>
                    <h3 className="font-extrabold text-white text-lg leading-snug flex items-center gap-1.5">
                      <Trophy size={16} className="text-amber-400" />
                      {payment.tournamentName}
                    </h3>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-300">Clube / Instituição</p>
                  <h4 className="font-bold text-white text-md flex items-center gap-1.5">
                    <Building2 size={16} className="text-indigo-200" />
                    {payment.institutionName}
                  </h4>
                </div>
              </div>

              <div className="pt-4 border-t border-indigo-600/50 flex justify-between items-end">
                <div className="space-y-0.5">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-indigo-300">Total a Pagar</p>
                  <p className="text-3xl font-black text-white leading-none">{formatCurrency(payment.amount)}</p>
                </div>
              </div>
            </div>

            {payment.teams && payment.teams.length > 0 && (
              <div className="bg-white p-5 rounded-3xl border border-slate-200/60 space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Equipes / Categorias Inclusas</span>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                  {payment.teams.map((teamName: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 font-semibold bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                      <span className="truncate">{teamName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white p-4 rounded-2xl border border-slate-200/60 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${expired ? "bg-rose-50 text-rose-500" : "bg-indigo-50 text-indigo-600"}`}>
                <Calendar size={20} />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Vencimento Limite</span>
                <span className={`text-xs font-bold block ${expired ? "text-rose-600" : "text-slate-700"}`}>
                  {new Date(payment.deadline + "T23:59:59").toLocaleDateString()} {expired && "(Expirado)"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-slate-400 text-[10px] font-medium leading-relaxed">
            <p>● Ao concluir o pagamento, a inscrição institucional será confirmada de forma automática no torneio.</p>
            <p>● Este checkout é criptografado e seguro. Nenhuma informação de cobrança real é faturada.</p>
          </div>
        </div>

        {/* Action Panel Column */}
        <div className="md:col-span-7 bg-white p-6 md:p-8 rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-100/50 flex flex-col justify-between space-y-6">
          {expired ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-8">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center">
                <AlertCircle size={32} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-lg">Este Link de Pagamento Expirou</h3>
                <p className="text-slate-500 text-xs mt-2 max-w-xs mx-auto">
                  A data limite ({new Date(payment.deadline + "T23:59:59").toLocaleDateString()}) para pagamento deste link já passou. Entre em contato com a organização do torneio para gerar uma nova cobrança.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Payment Methods tabs selector */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Selecione o Método de Pagamento</h3>
                  <p className="text-xs text-slate-400 mt-0.5">Escolha abaixo o formato ideal para efetuar a taxa.</p>
                </div>

                <div className="grid grid-cols-3 p-1.5 bg-slate-50 rounded-2xl border border-slate-150 gap-1">
                  {payment.allowedMethods.includes("pix") && (
                    <button
                      onClick={() => { setActiveTab("pix"); setPayError(null); }}
                      className={`py-3 text-xs font-bold rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                        activeTab === "pix" 
                          ? "bg-white text-emerald-600 shadow-sm border border-emerald-100" 
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <QrCode size={18} />
                      Pix
                    </button>
                  )}
                  {payment.allowedMethods.includes("boleto") && (
                    <button
                      onClick={() => { setActiveTab("boleto"); setPayError(null); }}
                      className={`py-3 text-xs font-bold rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                        activeTab === "boleto" 
                          ? "bg-white text-blue-600 shadow-sm border border-blue-100" 
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <FileText size={18} />
                      Boleto
                    </button>
                  )}
                  {payment.allowedMethods.includes("card") && (
                    <button
                      onClick={() => { setActiveTab("card"); setPayError(null); }}
                      className={`py-3 text-xs font-bold rounded-xl transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
                        activeTab === "card" 
                          ? "bg-white text-indigo-600 shadow-sm border border-indigo-100" 
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <CreditCard size={18} />
                      Cartão
                    </button>
                  )}
                </div>

                {payError && (
                  <div className="p-3.5 bg-rose-50 text-rose-600 text-xs font-semibold rounded-xl border border-rose-100 animate-pulse">
                    {payError}
                  </div>
                )}

                {/* Tabs views */}
                <div>
                  {activeTab === "pix" && (
                    <div className="space-y-6 flex flex-col items-center py-4 animate-in fade-in duration-300">
                      {pixData ? (
                        <>
                          {/* Interactive animated QR Code Container */}
                          <div className="relative p-4 bg-white rounded-3xl border-2 border-slate-100 shadow-inner group">
                            {/* Scanner Laser effect */}
                            <div className="absolute left-0 right-0 h-0.5 bg-emerald-500 top-1/2 animate-bounce pointer-events-none shadow-[0_0_10px_#10b981]" />
                            <img src={pixData.qrCodeUrl} alt="QR Code Pix" className="w-40 h-40 object-contain shrink-0" />
                          </div>

                          <div className="w-full space-y-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Chave Pix Copia e Cola</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                readOnly
                                value={pixData.qrCode}
                                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 outline-none text-xs font-mono text-slate-500 bg-slate-50/50 truncate"
                              />
                              <button
                                type="button"
                                onClick={() => copyToClipboard(pixData.qrCode, setCopiedPix)}
                                className={`px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer ${copiedPix ? "bg-emerald-600 text-white" : "bg-slate-900 text-white hover:bg-slate-800"}`}
                              >
                                {copiedPix ? <Check size={14} /> : <Copy size={14} />}
                                {copiedPix ? "Copiado!" : "Copiar"}
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-150 max-w-sm space-y-2">
                          <QrCode size={40} className="text-slate-400 mx-auto animate-pulse" />
                          <h4 className="font-bold text-slate-700 text-sm">Chave Pix Pendente</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">Clique no botão abaixo para gerar a chave Pix e o QR Code oficial de cobrança junto ao gateway.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "boleto" && (
                    <div className="space-y-6 flex flex-col items-center py-4 animate-in fade-in duration-300">
                      {boletoData ? (
                        <>
                          {/* Barcode Graphic/PDF Container */}
                          <div className="w-full max-w-sm p-6 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center gap-4">
                            <a 
                              href={boletoData.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center gap-2 cursor-pointer shadow-blue-100"
                            >
                              <FileText size={14} /> Abrir PDF do Boleto
                            </a>
                            <p className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-widest">Boleto Registrado via Pagar.me</p>
                          </div>

                          <div className="w-full space-y-2">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider text-center">Código de Barras (Linha Digitável)</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                readOnly
                                value={boletoData.barcode}
                                className="flex-1 px-4 py-3 rounded-xl border border-slate-200 outline-none text-xs font-mono text-slate-500 bg-slate-50/50 truncate"
                              />
                              <button
                                type="button"
                                onClick={() => copyToClipboard(boletoData.barcode, setCopiedBoleto)}
                                className={`px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer ${copiedBoleto ? "bg-emerald-600 text-white" : "bg-slate-900 text-white hover:bg-slate-800"}`}
                              >
                                {copiedBoleto ? <Check size={14} /> : <Copy size={14} />}
                                {copiedBoleto ? "Copiado!" : "Copiar"}
                              </button>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-150 max-w-sm space-y-2">
                          <FileText size={40} className="text-slate-400 mx-auto animate-pulse" />
                          <h4 className="font-bold text-slate-700 text-sm">Boleto Pendente</h4>
                          <p className="text-xs text-slate-400 leading-relaxed">Clique no botão abaixo para gerar a linha digitável e o documento do boleto bancário no gateway.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === "card" && (
                    <div className="space-y-6 flex flex-col items-center py-2 animate-in fade-in duration-300">
                      {/* Premium Graphical Credit Card Container */}
                      <div className="w-full max-w-sm aspect-[1.586/1] bg-gradient-to-br from-slate-850 to-slate-950 text-white p-6 rounded-2xl relative shadow-xl overflow-hidden border border-slate-800 group hover:shadow-2xl transition duration-300">
                        {/* Abstract Background Orbs */}
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/15 duration-300" />
                        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/15 duration-300" />

                        {cardFocused ? (
                          /* Card Back View (CVV focused) */
                          <div className="h-full flex flex-col justify-between py-2">
                            <div className="w-full h-10 bg-slate-800 -mx-6 mt-2" />
                            <div className="flex justify-end items-center gap-3">
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">CVC / CVV</span>
                              <div className="w-16 bg-white text-slate-900 px-3 py-1.5 rounded-lg text-right font-mono font-bold text-sm shadow-inner">
                                {cardCvv || "•••"}
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-[8px] font-mono text-slate-500">
                              <span>SIMULATOR ACCESS ONLY</span>
                              <span className="font-extrabold text-white text-[10px]">VISA</span>
                            </div>
                          </div>
                        ) : (
                          /* Card Front View */
                          <div className="h-full flex flex-col justify-between">
                            <div className="flex justify-between items-start">
                              <div className="w-10 h-7 bg-amber-250/20 rounded-md border border-amber-350/30 flex items-center justify-center overflow-hidden">
                                <div className="grid grid-cols-3 gap-0.5 w-6 h-4 opacity-40">
                                  <div className="bg-amber-300" /><div className="bg-amber-300" /><div className="bg-amber-300" />
                                  <div className="bg-amber-300" /><div className="bg-amber-300" /><div className="bg-amber-300" />
                                </div>
                              </div>
                              <span className="font-extrabold italic text-indigo-300 text-sm tracking-widest">VISA</span>
                            </div>

                            <div className="space-y-4">
                              <p className="text-lg font-mono tracking-widest text-slate-100 truncate">
                                {cardNumber || "•••• •••• •••• ••••"}
                              </p>

                              <div className="flex justify-between items-end">
                                <div className="space-y-0.5 max-w-[70%]">
                                  <span className="text-[7px] text-slate-400 uppercase tracking-widest block">Titular</span>
                                  <p className="text-xs font-bold tracking-wide truncate uppercase text-slate-200">
                                    {cardHolder || "NOME DO TITULAR"}
                                  </p>
                                </div>

                                <div className="space-y-0.5">
                                  <span className="text-[7px] text-slate-400 uppercase tracking-widest block">Validade</span>
                                  <p className="text-xs font-bold font-mono tracking-wide text-slate-200">
                                    {cardExpiry || "MM/AA"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Card Inputs Form */}
                      <div className="w-full grid grid-cols-2 gap-3 text-left">
                        <div className="col-span-full space-y-1">
                          <label className="text-xs font-bold text-slate-500">Número do Cartão</label>
                          <input
                            type="text"
                            required={activeTab === "card"}
                            value={cardNumber}
                            onFocus={() => setCardFocused(false)}
                            onChange={(e) => {
                              // Auto format card number
                              const val = e.target.value.replace(/\D/g, "");
                              const formatted = val.match(/.{1,4}/g)?.join(" ") || "";
                              setCardNumber(formatted.substring(0, 19));
                            }}
                            placeholder="4000 1234 5678 9010"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-xs transition-all font-semibold"
                          />
                        </div>

                        <div className="col-span-full space-y-1">
                          <label className="text-xs font-bold text-slate-500">Nome impresso no Cartão</label>
                          <input
                            type="text"
                            required={activeTab === "card"}
                            value={cardHolder}
                            onFocus={() => setCardFocused(false)}
                            onChange={(e) => setCardHolder(e.target.value.toUpperCase().substring(0, 26))}
                            placeholder="EX: JOÃO G SILVA"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-xs transition-all font-semibold"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">Validade</label>
                          <input
                            type="text"
                            required={activeTab === "card"}
                            value={cardExpiry}
                            onFocus={() => setCardFocused(false)}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              let formatted = val;
                              if (val.length > 2) {
                                formatted = val.substring(0, 2) + "/" + val.substring(2, 4);
                              }
                              setCardExpiry(formatted.substring(0, 5));
                            }}
                            placeholder="MM/AA"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-xs transition-all font-semibold text-center"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500">CVC / CVV</label>
                          <input
                            type="text"
                            required={activeTab === "card"}
                            value={cardCvv}
                            onFocus={() => setCardFocused(true)}
                            onBlur={() => setCardFocused(false)}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              setCardCvv(val.substring(0, 4));
                            }}
                            placeholder="123"
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-xs transition-all font-semibold text-center"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Payment button */}
              <form onSubmit={handlePay} className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-50 transition-all text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Processando Pagamento Seguro...
                    </>
                  ) : (
                    <>
                      <span>
                        {activeTab === "pix"
                          ? pixData
                            ? "Confirmar Recebimento (Simulado)"
                            : "Gerar Chave e QR Code Pix"
                          : activeTab === "boleto"
                          ? boletoData
                            ? "Confirmar Compensação (Simulado)"
                            : "Gerar Linha Digitável e Boleto"
                          : "Confirmar Pagamento"}
                      </span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
