import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { 
  Trophy, CheckCircle2, ShieldCheck, Clock, Download, Printer, 
  MapPin, Calendar, Heart, AlertCircle, Building2, User, Activity, Sparkles, ChevronLeft, Loader2
} from "lucide-react";

export default function PublicAthleteTicket() {
  const { subId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const ticketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!subId) return;
    setLoading(true);
    fetch(`/api/tournaments/public/athlete-subscription/${subId}`)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Credencial não encontrada");
        }
        return res.json();
      })
      .then((resData) => {
        setData(resData);
      })
      .catch((err: any) => {
        setError(err.message || "Erro ao carregar credencial digital");
      })
      .finally(() => setLoading(false));
  }, [subId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <Loader2 size={36} className="text-indigo-500 animate-spin mb-4" />
        <p className="text-sm font-semibold text-slate-300">Carregando credencial digital do atleta...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-3xl flex items-center justify-center text-rose-500 mb-4">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Credencial Não Encontrada</h2>
        <p className="text-sm text-slate-400 max-w-sm mb-6">{error || "Não foi possível localizar o passe esportivo deste atleta."}</p>
        <Link to="/" className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition">
          Voltar para Início
        </Link>
      </div>
    );
  }

  const { subscription, tournament, institution, categories = [], organization } = data;
  const isPaid = subscription?.paymentStatus === "paid";
  const isCheckedIn = !!subscription?.checkedInAt;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
    JSON.stringify({ ticketId: subId, athlete: subscription?.athleteName, tournament: tournament?.name })
  )}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center py-8 px-4 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header Actions */}
      <div className="w-full max-w-md flex items-center justify-between mb-6">
        <Link to={`/public/tournament/${tournament?.id}`} className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition">
          <ChevronLeft size={16} /> Voltar ao Torneio
        </Link>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold border border-slate-700 transition cursor-pointer"
          >
            <Printer size={13} /> Imprimir
          </button>
        </div>
      </div>

      {/* Main Ticket Card Container */}
      <div ref={ticketRef} className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden relative">
        {/* Banner Header */}
        <div className="h-32 bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-6 relative overflow-hidden flex flex-col justify-between">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
          <div className="flex items-center justify-between z-10">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
              PASSE ESPORTIVO OFICIAL
            </span>
            <div className="flex items-center gap-1">
              <Sparkles size={14} className="text-amber-300 animate-pulse" />
              <span className="text-[10px] font-black text-amber-300 tracking-wider">CREDENCIAL VIP</span>
            </div>
          </div>
          <div className="z-10">
            <h1 className="text-lg font-black text-white leading-tight truncate">{tournament?.name || "Torneio Esportivo"}</h1>
            <p className="text-[11px] font-semibold text-indigo-200 truncate mt-0.5">{organization?.name || "Liga Esportiva"}</p>
          </div>
        </div>

        {/* Athlete Info Body */}
        <div className="p-6 space-y-6">
          {/* Athlete Identity Header */}
          <div className="flex items-center gap-4">
            {subscription?.photoUrl ? (
              <img src={subscription.photoUrl} alt="" className="w-20 h-20 rounded-2xl object-cover border-2 border-indigo-500/40 shadow-lg shrink-0" />
            ) : (
              <div className="w-20 h-20 bg-indigo-950 border-2 border-indigo-500/30 rounded-2xl flex items-center justify-center text-indigo-400 font-extrabold text-2xl shrink-0">
                {subscription?.athleteName ? subscription.athleteName.charAt(0) : "A"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold text-white truncate leading-snug">{subscription?.athleteName}</h2>
              <p className="text-xs font-bold text-indigo-400 truncate mt-0.5">{institution?.name || "Atleta Independente"}</p>
              {(() => {
                const ageGroup = subscription?.additionalData?.age_group || categories[0]?.age_group;
                if (!ageGroup) return null;
                return (
                  <span className="inline-block mt-1 text-[10px] font-extrabold bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded-md uppercase">
                    Classe de Idade: {ageGroup}
                  </span>
                );
              })()}
            </div>
          </div>

          {/* Status Badges */}
          <div className="grid grid-cols-2 gap-2">
            <div className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
              isPaid ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-amber-500/10 border-amber-500/20 text-amber-400"
            }`}>
              <CheckCircle2 size={18} className="shrink-0" />
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider block opacity-75">Inscrição</span>
                <span className="text-xs font-black">{isPaid ? "CONFIRMADA" : "PENDENTE PAGO"}</span>
              </div>
            </div>

            <div className={`p-3 rounded-2xl border flex items-center gap-2.5 ${
              isCheckedIn ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" : "bg-slate-800/80 border-slate-700 text-slate-400"
            }`}>
              <ShieldCheck size={18} className="shrink-0" />
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider block opacity-75">Check-in Evento</span>
                <span className="text-xs font-black">{isCheckedIn ? "PRESENÇA OK" : "AGUARDANDO"}</span>
              </div>
            </div>
          </div>

          {/* Dynamic QR Code Section */}
          <div className="bg-slate-950 rounded-3xl p-5 border border-slate-800 flex flex-col items-center text-center space-y-3">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CÂMARA DE CHAMADA / ENTRADA</span>
            <div className="p-3 bg-white rounded-2xl border-4 border-indigo-500/30 shadow-inner">
              <img src={qrCodeUrl} alt="QR Code Credencial" className="w-40 h-40 object-contain" />
            </div>
            <p className="text-[11px] font-semibold text-slate-400 max-w-xs leading-relaxed">
              Apresente este QR Code na entrada da arena ou na câmara de chamada para registrar sua presença.
            </p>
            <span className="text-[9px] font-mono text-slate-500 bg-slate-900 px-2.5 py-1 rounded-lg">
              ID: {subId?.toUpperCase()}
            </span>
          </div>

          {/* Registered Categories / Provas */}
          {categories.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">PROVAS INSCRITAS</span>
              <div className="space-y-1.5">
                {categories.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-slate-800/60 border border-slate-800 rounded-xl">
                    <span className="text-xs font-bold text-white">{c.name}</span>
                    {c.age_group && <span className="text-[10px] font-semibold text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded-md">{c.age_group}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Ticket Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 text-center">
          <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">
            Quero Competir · Sistema Oficial de Gestão Esportiva
          </p>
        </div>
      </div>
    </div>
  );
}
