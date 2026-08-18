import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  User, Calendar, FileText, Building2, Trophy, Heart, Upload,
  Shield, CheckCircle2, AlertCircle, ChevronRight,
  ChevronLeft, Eye, EyeOff, Lock, Mail, Loader2, Check, Info, UserCheck,
  Ticket, Tag, X
} from "lucide-react";
import { useToast } from "./ui/Toast.tsx";

// ── Helpers ───────────────────────────────────────────────────────────────────
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

function formatDate(iso: string) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function calcAge(birthDate: string) {
  if (!birthDate) return null;
  const today = new Date();
  const b = new Date(birthDate);
  let age = today.getFullYear() - b.getFullYear();
  const m = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

function formatSeedTimeInput(val: string): string {
  if (!val) return "";
  const digits = val.replace(/\D/g, "");
  if (digits.length === 0) return "";

  const capped = digits.slice(0, 6);
  if (capped.length <= 2) {
    return capped;
  } else if (capped.length <= 4) {
    const sec = capped.slice(0, capped.length - 2);
    const ms = capped.slice(capped.length - 2);
    return `${sec}.${ms}`;
  } else {
    const min = capped.slice(0, capped.length - 4);
    const sec = capped.slice(capped.length - 4, capped.length - 2);
    const ms = capped.slice(capped.length - 2);
    return `${min}:${sec}.${ms}`;
  }
}

function finalizeSeedTimeOnBlur(val: string): string {
  if (!val) return "";
  const digits = val.replace(/\D/g, "");
  if (digits.length === 0) return "";

  const capped = digits.slice(0, 6);
  if (capped.length <= 2) {
    return `${capped}.00`;
  } else if (capped.length <= 4) {
    const sec = capped.slice(0, capped.length - 2).padStart(2, "0");
    const ms = capped.slice(capped.length - 2);
    return `00:${sec}.${ms}`;
  } else {
    const min = capped.slice(0, capped.length - 4).padStart(2, "0");
    const sec = capped.slice(capped.length - 4, capped.length - 2);
    const ms = capped.slice(capped.length - 2);
    return `${min}:${sec}.${ms}`;
  }
}

// ── Step indicator ────────────────────────────────────────────────────────────
const steps = [
  { id: "athlete",     label: "Atleta",      icon: User },
  { id: "institution", label: "Clube",        icon: Building2 },
  { id: "category",   label: "Provas",       icon: Trophy },
  { id: "guardian",   label: "Responsável",  icon: Heart },
  { id: "docs",       label: "Documentos",   icon: Upload },
  { id: "terms",      label: "Termos",       icon: Shield },
];

type Step = "athlete" | "institution" | "category" | "guardian" | "docs" | "terms" | "submitting" | "success";

export default function PublicSelfRegistration() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const { } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState<any>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("athlete");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 1 — Athlete
  const [athleteName, setAthleteName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthDateInput, setBirthDateInput] = useState("");
  const [docNum, setDocNum] = useState("");
  const [gender, setGender] = useState("Masculino");
  const [bloodType, setBloodType] = useState("O+");
  const [allergies, setAllergies] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  // Step 2 — Institution
  const [institutionId, setInstitutionId] = useState<string | null | undefined>(undefined);

  // Step 3 — Categories (multi-select)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [seedTimes, setSeedTimes] = useState<Record<string, string>>({});

  // Step 4 — Guardian
  const [isSelfGuardian, setIsSelfGuardian] = useState(false);
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPassword, setParentPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);

  // Step 5 — Docs
  const [photoFile, setPhotoFile] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [docFile, setDocFile] = useState<string | null>(null);
  const [docFileName, setDocFileName] = useState("");

  // Step 6 — Terms
  const [acceptedTerms, setAcceptedTerms] = useState<Record<string, boolean>>({});

  // Result
  const [resultSubIds, setResultSubIds] = useState<string[]>([]);
  const [guardianToken, setGuardianToken] = useState<string | null>(null);
  const [athleteFee, setAthleteFee] = useState(0);

  // Coupon
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  useEffect(() => {
    if (!tournamentId) return;
    fetch(`/api/tournaments/${tournamentId}/public-settings`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setPageError(data.error);
        else setPageData(data);
      })
      .catch(() => setPageError("Não foi possível carregar os dados do torneio."))
      .finally(() => setLoading(false));
  }, [tournamentId]);

  // Auto-fill guardian when "self" is toggled
  useEffect(() => {
    if (isSelfGuardian) {
      setParentName(athleteName);
    }
  }, [isSelfGuardian, athleteName]);

  // Derived
  const age = calcAge(birthDate);
  const isAdult = age !== null && age >= 18;

  const eligibleCategories = (pageData?.categories ?? []).filter((cat: any) => {
    if (!birthDate) return false;
    const birthYear = new Date(birthDate).getFullYear();
    if (cat.birth_year_min && birthYear < cat.birth_year_min) return false;
    if (cat.birth_year_max && birthYear > cat.birth_year_max) return false;
    if (cat.gender && cat.gender !== "Misto" && cat.gender !== gender) return false;
    return true;
  });

  // Clear selected categories if they are no longer eligible (e.g. user changed birthDate or gender)
  useEffect(() => {
    setSelectedCategoryIds(prev => {
      if (prev.length === 0) return prev;
      const validIds = new Set(eligibleCategories.map((c: any) => c.id));
      const newSelected = prev.filter(id => validIds.has(id));
      return newSelected.length !== prev.length ? newSelected : prev;
    });
  }, [birthDate, gender, pageData?.categories]);

  const settings = pageData?.settings;
  const tournament = pageData?.tournament;
  const selectedCategories = (pageData?.categories ?? []).filter((c: any) => selectedCategoryIds.includes(c.id));
  const selectedInstitution = pageData?.institutions?.find((i: any) => i.id === institutionId);

  const maxEvents: number = settings?.maxEventsPerParticipant ?? 1;
  const uploadsConfig: any[] = settings?.registrationConfig?.uploads || [];
  const hasEnabledUploads = uploadsConfig.length === 0
    ? true
    : uploadsConfig.some((u: any) => u.enabled !== false);

  const isPhotoEnabled = uploadsConfig.length === 0
    ? true
    : uploadsConfig.some((u: any) => (u.id === "photo" || u.label?.toLowerCase().includes("foto")) && u.enabled !== false);

  const isDocEnabled = uploadsConfig.length === 0
    ? true
    : uploadsConfig.some((u: any) => (u.id === "document" || u.label?.toLowerCase().includes("documento") || u.label?.toLowerCase().includes("rg")) && u.enabled !== false);

  const activeSteps = [
    { id: "athlete",     label: "Atleta",      icon: User },
    { id: "institution", label: "Clube",        icon: Building2 },
    { id: "category",   label: "Provas",       icon: Trophy },
    { id: "guardian",   label: "Responsável",  icon: Heart },
    ...(hasEnabledUploads ? [{ id: "docs", label: "Documentos", icon: Upload }] : []),
    { id: "terms",      label: "Termos",       icon: Shield },
  ];

  const feePricingModel = settings?.feePricingModel || "per_event";
  const unitAthleteFee = settings?.athleteFee || 0;
  const totalAthleteFee = feePricingModel === "fixed_package"
    ? unitAthleteFee
    : unitAthleteFee * selectedCategoryIds.length;

  const stepIndex = activeSteps.findIndex(s => s.id === step);

  function toggleCategory(catId: string) {
    setSelectedCategoryIds(prev => {
      if (prev.includes(catId)) return prev.filter(id => id !== catId);
      if (maxEvents > 0 && prev.length >= maxEvents) return prev;
      return [...prev, catId];
    });
  }

  const handleNext = () => {
    const order = activeSteps.map(s => s.id as Step);
    const idx = order.indexOf(step as Step);
    if (idx >= 0 && idx < order.length - 1) setStep(order[idx + 1]);
  };

  const handleBack = () => {
    const order = activeSteps.map(s => s.id as Step);
    const idx = order.indexOf(step as Step);
    if (idx > 0) setStep(order[idx - 1]);
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim() || selectedCategoryIds.length === 0) return;
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/validate-coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode, categoryIds: selectedCategoryIds })
      });
      const data = await res.json();
      if (data.valid && data.coupon) {
        setAppliedCoupon({
          ...data.coupon,
          discount_type: data.coupon.discountType || data.coupon.discount_type,
          discount_value: data.coupon.discountValue || data.coupon.discount_value,
        });
      } else {
        setCouponError(data.message || data.error || "Cupom inválido");
      }
    } catch (err) {
      setCouponError("Erro ao validar cupom.");
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);
  };

  const handleSubmit = async () => {
    setStep("submitting");
    setSubmitError(null);
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/self-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athleteName, birthDate, document: docNum, gender,
          categoryIds: selectedCategoryIds,
          institutionId,
          parentName: isSelfGuardian ? athleteName : parentName,
          parentPhone,
          parentEmail,
          parentPassword,
          photoFile, documentFile: docFile,
          authorizedImageUse: true,
          liabilityWaiver: true,
          acceptedTerms,
          isSelfGuardian,
          couponCode: appliedCoupon?.code || undefined,
          additionalData: { bloodType, allergies, emergencyContact, seedTimes },
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data.error || "Não foi possível concluir a inscrição no momento. Tente novamente em instantes.");
        setStep("terms");
        return;
      }
      setResultSubIds(data.subIds || (data.subId ? [data.subId] : []));
      setGuardianToken(data.guardianToken);
      setAthleteFee(data.totalFee ?? data.athleteFee ?? 0);

      if (data.guardianToken) {
        const stored = {
          role: "guardian",
          email: parentEmail,
          name: isSelfGuardian ? athleteName : parentName,
          token: data.guardianToken
        };
        localStorage.setItem("currentUser", JSON.stringify(stored));
      }
      setStep("success");
    } catch (err: any) {
      setSubmitError(err.message);
      setStep("terms");
    }
  };

  // ── Loading / Error ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (pageError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center flex-col gap-4 p-8 text-center">
        <AlertCircle size={48} className="text-rose-400" />
        <h2 className="text-2xl font-bold text-slate-700">Inscrições indisponíveis</h2>
        <p className="text-slate-500 max-w-sm">{pageError}</p>
        <Link to="/" className="text-indigo-600 font-bold hover:underline text-sm">← Voltar</Link>
      </div>
    );
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={44} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-black text-slate-800 mb-2">
            {totalAthleteFee > 0 ? "Confirmação de Pré-Inscrição!" : "Inscrição Concluída!"}
          </h2>
          <p className="text-slate-500 text-sm mb-1">
            <strong className="text-slate-700">{athleteName}</strong> foi {totalAthleteFee > 0 ? "pré-inscrito(a)" : "inscrito(a)"} em {selectedCategoryIds.length} prova{selectedCategoryIds.length > 1 ? "s" : ""}.
          </p>
          {resultSubIds.length > 0 && (
            <p className="text-slate-400 text-xs mb-4">
              Protocolo: <span className="font-mono font-bold text-slate-600">{resultSubIds[0]?.slice(0, 8).toUpperCase()}</span>
            </p>
          )}
          {totalAthleteFee > 0 ? (
            <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-left mb-4">
              <p className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1.5">
                <span>⏳</span> Pré-Inscrição Registrada
              </p>
              <p className="text-xs text-amber-900/80 font-medium leading-relaxed">
                A confirmação do pagamento é necessária para a efetivação e garantia da sua inscrição no torneio.
              </p>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 text-left mb-4">
              <p className="text-xs font-bold text-emerald-700 mb-1">✅ Inscrição Confirmada</p>
              <p className="text-xs text-slate-500 leading-relaxed">Sua inscrição foi confirmada com sucesso no sistema.</p>
            </div>
          )}
          {totalAthleteFee > 0 && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-left mb-6">
              <p className="text-xs font-bold text-indigo-700 mb-1">
                💳 Taxa Total: R$ {(() => {
                  const discount = appliedCoupon?.discount_type === "percent"
                    ? totalAthleteFee * (appliedCoupon.discount_value / 100)
                    : Number(appliedCoupon?.discount_value || 0);
                  return Math.max(0, totalAthleteFee - discount).toFixed(2);
                })()}
              </p>
              <p className="text-xs text-slate-500">
                {feePricingModel === "fixed_package"
                  ? `Pacote único (R$ ${unitAthleteFee.toFixed(2)}) para até ${maxEvents} prova(s)`
                  : `${selectedCategoryIds.length} prova(s) × R$ ${unitAthleteFee.toFixed(2)}`}
                {appliedCoupon && ` (- Desconto aplicado)`}
              </p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {totalAthleteFee > 0 && resultSubIds.length > 0 && (
              <button
                onClick={() => navigate(`/public/register-athlete/${resultSubIds[0]}`)}
                className="w-full bg-emerald-600 text-white px-6 py-4 rounded-2xl font-black text-sm hover:bg-emerald-700 transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
              >
                💳 Pagar Inscrição Agora (PIX / Cartão)
              </button>
            )}
            {guardianToken && (
              <button onClick={() => navigate("/")} className="w-full border border-slate-200 text-slate-700 px-6 py-3 rounded-xl font-bold hover:bg-slate-50 transition text-sm">
                Acompanhar minhas inscrições
              </button>
            )}
            <Link to={`/public/torneio/${tournamentId}`} className="w-full text-slate-400 font-semibold hover:text-slate-600 py-2 transition text-xs block">
              Ver o torneio
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  if (step === "submitting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center flex-col gap-4">
        <Loader2 size={40} className="text-indigo-600 animate-spin" />
        <p className="text-slate-600 font-bold">Finalizando sua inscrição...</p>
      </div>
    );
  }

  // ── Wizard ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          {tournament?.logoUrl
            ? <img src={tournament.logoUrl} className="w-10 h-10 rounded-xl object-cover" alt="" />
            : <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center"><Trophy size={20} className="text-indigo-600" /></div>
          }
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-slate-800 text-sm truncate">{tournament?.name}</h1>
            <p className="text-xs text-slate-400 font-medium">Inscrição Individual</p>
          </div>
          <Link to={`/public/torneio/${tournamentId}`} className="text-slate-400 hover:text-slate-600 p-1 text-lg font-bold">✕</Link>
        </div>
      </div>

      {/* Progress */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center gap-1 mb-8">
          {activeSteps.map((s, i) => {
            const done = stepIndex > i;
            const current = stepIndex === i;
            return (
              <React.Fragment key={s.id}>
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${done ? "bg-emerald-500 text-white" : current ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                    {done ? <Check size={13} /> : <s.icon size={13} />}
                  </div>
                  <span className={`text-[10px] font-bold hidden sm:block ${current ? "text-indigo-600" : done ? "text-emerald-600" : "text-slate-400"}`}>{s.label}</span>
                </div>
                {i < activeSteps.length - 1 && <div className={`flex-1 h-0.5 rounded-full transition-all ${done ? "bg-emerald-400" : "bg-slate-100"}`} />}
              </React.Fragment>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.18 }}>

            {/* ── STEP 1: Athlete ────────────────────────────────────────── */}
            {step === "athlete" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Dados do Atleta</h2>
                  <p className="text-slate-500 text-sm mt-1">Informe os dados pessoais do participante.</p>
                </div>
                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nome Completo *</label>
                    <input type="text" placeholder="Nome do atleta" value={athleteName} onChange={e => setAthleteName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 focus:border-indigo-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Data de Nascimento *</label>
                      <input type="tel" placeholder="DD/MM/AAAA" value={birthDateInput} onChange={e => {
                        const val = e.target.value.replace(/\D/g, "");
                        let formatted = val;
                        if (val.length > 2) formatted = val.substring(0, 2) + "/" + val.substring(2);
                        if (val.length > 4) formatted = val.substring(0, 2) + "/" + val.substring(2, 4) + "/" + val.substring(4, 8);
                        setBirthDateInput(formatted);
                        if (formatted.length === 10) {
                          const [d, m, y] = formatted.split("/");
                          setBirthDate(`${y}-${m}-${d}`);
                        } else {
                          setBirthDate("");
                        }
                      }}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 focus:border-indigo-400" />
                      {age !== null && (
                        <p className={`text-xs font-semibold mt-1 ${isAdult ? "text-emerald-600" : "text-indigo-600"}`}>
                          {age} anos {isAdult ? "· Maior de idade" : "· Menor de idade"}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Gênero *</label>
                      <select value={gender} onChange={e => setGender(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 bg-white">
                        <option>Masculino</option>
                        <option>Feminino</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">CPF / Documento *</label>
                    <input type="text" placeholder="000.000.000-00" value={docNum} onChange={e => setDocNum(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 focus:border-indigo-400" />
                  </div>
                  {/* Informações Médicas (somente solicitadas se habilitadas nas configurações pelo organizador) */}
                  {(() => {
                    const fields = settings?.registrationConfig?.fields || [];
                    const isBloodTypeEnabled = fields.some((f: any) => f.id === "bloodType" && f.enabled);
                    const isEmergencyEnabled = fields.some((f: any) => f.id === "emergencyContact" && f.enabled);
                    const isAllergiesEnabled = fields.some((f: any) => f.id === "allergies" && f.enabled);

                    if (!isBloodTypeEnabled && !isEmergencyEnabled && !isAllergiesEnabled) return null;

                    return (
                      <>
                        <hr className="border-slate-100" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Informações Médicas</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {isBloodTypeEnabled && (
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tipo Sanguíneo</label>
                              <select value={bloodType} onChange={e => setBloodType(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 bg-white">
                                {BLOOD_TYPES.map(bt => <option key={bt}>{bt}</option>)}
                              </select>
                            </div>
                          )}
                          {isEmergencyEnabled && (
                            <div>
                              <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Contato de Emergência</label>
                              <input type="tel" placeholder="(41) 99999-9999" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 focus:border-indigo-400" />
                            </div>
                          )}
                        </div>
                        {isAllergiesEnabled && (
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Alergias / Restrições</label>
                            <input type="text" placeholder="Ex: Amendoim, Látex" value={allergies} onChange={e => setAllergies(e.target.value)}
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 focus:border-indigo-400" />
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
                <button onClick={handleNext} disabled={!athleteName || !birthDate || !docNum}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-sm hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  Próximo <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* ── STEP 2: Institution ───────────────────────────────────── */}
            {step === "institution" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Clube / Escola</h2>
                  <p className="text-slate-500 text-sm mt-1">Selecione a instituição que o atleta representa.</p>
                </div>
                <div className="space-y-2">
                  {pageData?.institutions?.map((inst: any) => (
                    <button key={inst.id ?? "independent"} type="button" onClick={() => setInstitutionId(inst.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                        institutionId === inst.id ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/10" : "border-slate-200 bg-white hover:border-indigo-200"
                      }`}>
                      {inst.logo_url
                        ? <img src={inst.logo_url} className="w-10 h-10 rounded-xl object-cover shrink-0" alt="" />
                        : <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"><Building2 size={18} className="text-slate-400" /></div>
                      }
                      <span className="font-bold text-slate-700 text-sm flex-1">{inst.name}</span>
                      {institutionId === inst.id && <Check size={16} className="text-indigo-600" />}
                    </button>
                  ))}
                  {(pageData?.institutions?.length ?? 0) === 0 && (
                    <p className="p-6 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">Nenhuma instituição disponível.</p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={handleBack} className="px-5 py-3 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50"><ChevronLeft size={16} /></button>
                  <button onClick={handleNext} disabled={institutionId === undefined}
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    Próximo <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Category ──────────────────────────────────────── */}
            {step === "category" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Provas</h2>
                  <p className="text-slate-500 text-sm mt-1">
                    {eligibleCategories.length === 0
                      ? "Nenhuma prova disponível para o perfil do atleta."
                      : maxEvents === 1
                        ? "Selecione a prova que o atleta disputará."
                        : `Selecione até ${maxEvents} prova${maxEvents > 1 ? "s" : ""} (${selectedCategoryIds.length}/${maxEvents} selecionada${selectedCategoryIds.length !== 1 ? "s" : ""}).`
                    }
                  </p>
                </div>

                {eligibleCategories.length === 0 ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                    <AlertCircle size={32} className="text-amber-500 mx-auto mb-2" />
                    <p className="text-sm font-bold text-amber-700">Nenhuma prova compatível com {age} anos e gênero {gender}.</p>
                    <p className="text-xs text-amber-600 mt-1">Verifique os dados do atleta na etapa anterior.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {eligibleCategories.map((cat: any) => {
                      const selected = selectedCategoryIds.includes(cat.id);
                      const limitReached = maxEvents > 0 && selectedCategoryIds.length >= maxEvents && !selected;
                      return (
                        <button key={cat.id} type="button" onClick={() => !limitReached && toggleCategory(cat.id)} disabled={limitReached}
                          className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                            selected
                              ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/10"
                              : limitReached
                                ? "opacity-40 cursor-not-allowed border-slate-100 bg-slate-50"
                                : "border-slate-200 bg-white hover:border-indigo-200"
                          }`}>
                          <div className={`flex-shrink-0 w-5 h-5 rounded-${maxEvents === 1 ? "full" : "md"} border-2 flex items-center justify-center transition-all ${
                            selected ? "bg-indigo-600 border-indigo-600" : "border-slate-300"
                          }`}>
                            {selected && <Check size={12} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-700 text-sm truncate">{cat.name}</p>
                            <p className="text-xs text-slate-400 font-medium">
                              {cat.gender} · {cat.age_group}
                              {(cat.birth_year_min || cat.birth_year_max) && ` · Nasc. ${cat.birth_year_min || ""}–${cat.birth_year_max || ""}`}
                            </p>

                            {selected && (
                              <div className="mt-3 pt-3 border-t border-indigo-200/60 flex flex-col sm:flex-row items-start sm:items-center gap-2" onClick={e => e.stopPropagation()}>
                                <label className="text-xs font-bold text-indigo-900 whitespace-nowrap flex items-center gap-1">
                                  ⏱️ Tempo de Inscrição / Balizamento:
                                </label>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="Ex: 3250 (32.50s)"
                                  value={seedTimes[cat.id] || ""}
                                  onChange={(e) => {
                                    const formatted = formatSeedTimeInput(e.target.value);
                                    setSeedTimes(prev => ({ ...prev, [cat.id]: formatted }));
                                  }}
                                  onBlur={() => {
                                    const currentVal = seedTimes[cat.id] || "";
                                    const finalized = finalizeSeedTimeOnBlur(currentVal);
                                    if (finalized !== currentVal) {
                                      setSeedTimes(prev => ({ ...prev, [cat.id]: finalized }));
                                    }
                                  }}
                                  className="px-3 py-1.5 border border-indigo-300 rounded-xl text-xs font-mono font-bold text-indigo-950 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44 shadow-xs placeholder:text-indigo-300"
                                />
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={handleBack} className="px-5 py-3 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50"><ChevronLeft size={16} /></button>
                  <button onClick={handleNext} disabled={selectedCategoryIds.length === 0}
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    Próximo <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 4: Guardian ──────────────────────────────────────── */}
            {step === "guardian" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Responsável Legal</h2>
                  <p className="text-slate-500 text-sm mt-1">Dados do responsável pelo atleta.</p>
                </div>

                {/* "I am the athlete" toggle for adults */}
                {isAdult && (
                  <button type="button" onClick={() => setIsSelfGuardian(!isSelfGuardian)}
                    className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                      isSelfGuardian ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-400/10" : "border-slate-200 bg-white hover:border-emerald-200"
                    }`}>
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                      isSelfGuardian ? "bg-emerald-500 border-emerald-500" : "border-slate-300"
                    }`}>
                      {isSelfGuardian && <Check size={12} className="text-white" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <UserCheck size={18} className={isSelfGuardian ? "text-emerald-600" : "text-slate-400"} />
                      <div>
                        <p className="text-sm font-bold text-slate-700">Sou o próprio atleta</p>
                        <p className="text-xs text-slate-500">O atleta é maior de idade e assina por conta própria ({age} anos)</p>
                      </div>
                    </div>
                  </button>
                )}

                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
                  {!isSelfGuardian && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nome do Responsável *</label>
                      <input type="text" placeholder="Nome completo" value={parentName} onChange={e => setParentName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 focus:border-indigo-400" />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Telefone de Contato *</label>
                    <input type="tel" placeholder="(41) 99999-9999" value={parentPhone} onChange={e => setParentPhone(e.target.value.replace(/\D/g, "").substring(0, 11))}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 focus:border-indigo-400" />
                  </div>

                  <hr className="border-slate-100" />
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                      {isSelfGuardian ? "Criar acesso ao Portal" : "Acesso ao Portal (para acompanhar inscrições)"}
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">E-mail *</label>
                        <div className="relative">
                          <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input type="email" placeholder="email@exemplo.com" value={parentEmail} onChange={e => setParentEmail(e.target.value)}
                            className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 focus:border-indigo-400" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Senha *</label>
                        <div className="relative">
                          <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input type={showPwd ? "text" : "password"} placeholder="Mínimo 6 caracteres" value={parentPassword} onChange={e => setParentPassword(e.target.value)}
                            className="w-full pl-9 pr-10 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 focus:border-indigo-400" />
                          <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                            {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1">Conta para acompanhar suas inscrições no portal.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={handleBack} className="px-5 py-3 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50"><ChevronLeft size={16} /></button>
                  <button onClick={handleNext}
                    disabled={(!isSelfGuardian && !parentName) || !parentPhone || !parentEmail || !parentPassword}
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    Próximo <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 5: Documents ─────────────────────────────────────── */}
            {step === "docs" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Documentos</h2>
                  <p className="text-slate-500 text-sm mt-1">Faça o envio dos documentos do atleta.</p>
                </div>
                <div className="space-y-4">
                  {isPhotoEnabled && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-3">Foto de Rosto (3×4)</label>
                      {photoFile ? (
                        <div className="flex items-center gap-3">
                          <img src={photoFile} alt="Foto" className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-700 truncate">{photoName}</p>
                            <button onClick={() => { setPhotoFile(null); setPhotoName(""); }} className="text-xs text-rose-500 font-semibold hover:underline mt-0.5">Remover</button>
                          </div>
                          <Check size={18} className="text-emerald-500 shrink-0" />
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition">
                          <Upload size={24} className="text-slate-400" />
                          <span className="text-xs font-bold text-slate-500">Clique para selecionar</span>
                          <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setPhotoFile(await fileToBase64(f)); setPhotoName(f.name); } }} />
                        </label>
                      )}
                    </div>
                  )}
                  {isDocEnabled && (
                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-3">RG / CNH / Certidão de Nascimento</label>
                      {docFile ? (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"><FileText size={18} className="text-slate-500" /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-700 truncate">{docFileName}</p>
                            <button onClick={() => { setDocFile(null); setDocFileName(""); }} className="text-xs text-rose-500 font-semibold hover:underline mt-0.5">Remover</button>
                          </div>
                          <Check size={18} className="text-emerald-500 shrink-0" />
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-2 p-6 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition">
                          <Upload size={24} className="text-slate-400" />
                          <span className="text-xs font-bold text-slate-500">Clique para selecionar</span>
                          <input type="file" accept="image/*,application/pdf" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setDocFile(await fileToBase64(f)); setDocFileName(f.name); } }} />
                        </label>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button onClick={handleBack} className="px-5 py-3 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50"><ChevronLeft size={16} /></button>
                  <button onClick={handleNext} className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition flex items-center justify-center gap-2">
                    Próximo <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 6: Terms ─────────────────────────────────────────── */}
            {step === "terms" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Termos e Confirmação</h2>
                  <p className="text-slate-500 text-sm mt-1">Revise e aceite os termos para concluir.</p>
                </div>

                {/* Summary */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-2">
                  <p className="font-black text-indigo-700 text-xs uppercase tracking-wider mb-2">Resumo da Inscrição</p>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <span className="text-slate-500 font-semibold">Atleta</span>
                    <span className="font-bold text-slate-700">{athleteName}</span>
                    <span className="text-slate-500 font-semibold">Nascimento</span>
                    <span className="font-bold text-slate-700">{formatDate(birthDate)} ({age} anos)</span>
                    <span className="text-slate-500 font-semibold">Gênero</span>
                    <span className="font-bold text-slate-700">{gender}</span>
                    <span className="text-slate-500 font-semibold">Clube</span>
                    <span className="font-bold text-slate-700">{selectedInstitution?.name || "Independente"}</span>
                    <span className="text-slate-500 font-semibold">Prova{selectedCategoryIds.length > 1 ? "s" : ""}</span>
                    <span className="font-bold text-slate-700">{selectedCategories.map((c: any) => c.name).join(", ")}</span>
                    <span className="text-slate-500 font-semibold">Taxa</span>
                    <span className="font-bold text-slate-700">
                      {totalAthleteFee > 0
                        ? feePricingModel === "fixed_package"
                          ? `R$ ${totalAthleteFee.toFixed(2)} (Pacote fixo)`
                          : `R$ ${totalAthleteFee.toFixed(2)} (${selectedCategoryIds.length}× R$ ${unitAthleteFee.toFixed(2)})`
                        : "Gratuita"}
                    </span>
                    <span className="text-slate-500 font-semibold">Responsável</span>
                    <span className="font-bold text-slate-700">{isSelfGuardian ? athleteName + " (próprio atleta)" : parentName}</span>
                  </div>
                </div>

                {/* Coupon Input */}
                {totalAthleteFee > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Cupom de Desconto</label>
                    {appliedCoupon ? (
                      <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Ticket size={18} className="text-emerald-600" />
                          <div>
                            <p className="text-sm font-bold text-emerald-800">{appliedCoupon.code}</p>
                            <p className="text-xs text-emerald-600">
                              Desconto de {appliedCoupon.discount_type === "percent" ? `${appliedCoupon.discount_value}%` : `R$ ${Number(appliedCoupon.discount_value).toFixed(2)}`}
                            </p>
                          </div>
                        </div>
                        <button onClick={handleRemoveCoupon} className="p-1.5 hover:bg-emerald-100 rounded-lg text-emerald-600 transition-colors">
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={couponCode}
                          onChange={e => setCouponCode(e.target.value.toUpperCase())}
                          placeholder="Código do cupom"
                          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:border-indigo-500 outline-none transition-colors uppercase"
                        />
                        <button
                          onClick={handleApplyCoupon}
                          disabled={!couponCode.trim() || validatingCoupon}
                          className="px-6 py-3 bg-slate-800 text-white font-bold text-sm rounded-xl hover:bg-slate-900 transition-colors disabled:opacity-50"
                        >
                          {validatingCoupon ? "Aplicando..." : "Aplicar"}
                        </button>
                      </div>
                    )}
                    {couponError && <p className="text-rose-500 text-xs font-semibold mt-2">{couponError}</p>}
                    
                    {/* Final Fee calculation display if coupon applied */}
                    {appliedCoupon && (
                      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-600">Total com desconto:</span>
                        <span className="text-lg font-black text-emerald-600">
                          {(() => {
                            const discount = appliedCoupon.discount_type === "percent" 
                              ? totalAthleteFee * (appliedCoupon.discount_value / 100)
                              : Number(appliedCoupon.discount_value);
                            const finalFee = Math.max(0, totalAthleteFee - discount);
                            return finalFee > 0 ? `R$ ${finalFee.toFixed(2)}` : "Gratuito";
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Termos dinâmicos configurados no Torneio */}
                {(() => {
                  const termsList: any[] = settings?.registrationConfig?.terms || [
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
                  ];

                  const activeTerms = termsList.filter((t: any) => t.enabled !== false);
                  const isAllRequiredAccepted = activeTerms.every((t: any) => !t.required || acceptedTerms[t.id]);

                  return (
                    <>
                      <div className="space-y-3">
                        {activeTerms.map((term: any) => {
                          const isChecked = !!acceptedTerms[term.id];
                          const termTitle = term.title || term.name || "Termo de Aceite";
                          const rawContent = term.content || term.text || "";
                          const termContent = rawContent.replace(/{tournament}/g, tournament?.name || "");

                          return (
                            <button
                              key={term.id}
                              type="button"
                              onClick={() => setAcceptedTerms(prev => ({ ...prev, [term.id]: !prev[term.id] }))}
                              className={`w-full flex gap-3 p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                                isChecked ? "border-emerald-300 bg-emerald-50/80 ring-2 ring-emerald-500/10" : "border-slate-200 bg-white hover:border-slate-300"
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 border-2 transition-all ${
                                isChecked ? "bg-emerald-500 border-emerald-500" : "border-slate-300"
                              }`}>
                                {isChecked && <Check size={12} className="text-white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-black text-slate-800 mb-1">{termTitle}</p>
                                <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-line">{termContent}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {submitError && (
                        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex gap-2 text-rose-700 text-sm font-semibold">
                          <AlertCircle size={18} className="shrink-0 mt-0.5" />
                          {submitError}
                        </div>
                      )}

                      <div className="flex gap-3">
                        <button onClick={handleBack} className="px-5 py-3 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50"><ChevronLeft size={16} /></button>
                        <button onClick={handleSubmit} disabled={!isAllRequiredAccepted}
                          className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer">
                          <CheckCircle2 size={16} /> Confirmar Inscrição
                        </button>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
      <div className="h-16" />
    </div>
  );
}
