import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import {
  User, Calendar, FileText, Building2, Trophy, Heart, Upload,
  Shield, CreditCard, CheckCircle2, AlertCircle, ChevronRight,
  ChevronLeft, Waves, Eye, EyeOff, Lock, Mail, Phone, X, Loader2, Check
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

// ── Step indicator ────────────────────────────────────────────────────────────
const steps = [
  { id: "athlete",     label: "Atleta",      icon: User },
  { id: "institution", label: "Clube",        icon: Building2 },
  { id: "category",   label: "Prova",        icon: Trophy },
  { id: "guardian",   label: "Responsável",  icon: Heart },
  { id: "docs",       label: "Documentos",   icon: Upload },
  { id: "terms",      label: "Termos",       icon: Shield },
  { id: "success",    label: "Concluído",    icon: CheckCircle2 },
];

type Step = "athlete" | "institution" | "category" | "guardian" | "docs" | "terms" | "submitting" | "success";

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PublicSelfRegistration() {
  const { id: tournamentId } = useParams<{ id: string }>();
  const { error: toastError } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [pageData, setPageData] = useState<any>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  // Step state
  const [step, setStep] = useState<Step>("athlete");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 1 — Athlete
  const [athleteName, setAthleteName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [docNum, setDocNum] = useState("");
  const [gender, setGender] = useState("Masculino");

  // Step 2 — Institution
  const [institutionId, setInstitutionId] = useState<string | null>(null);

  // Step 3 — Category
  const [categoryId, setCategoryId] = useState("");

  // Step 4 — Guardian
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPassword, setParentPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [bloodType, setBloodType] = useState("O+");
  const [allergies, setAllergies] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");

  // Step 5 — Docs
  const [photoFile, setPhotoFile] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [docFile, setDocFile] = useState<string | null>(null);
  const [docFileName, setDocFileName] = useState("");

  // Step 6 — Terms
  const [acceptedImageUse, setAcceptedImageUse] = useState(false);
  const [acceptedLiability, setAcceptedLiability] = useState(false);

  // Result
  const [resultSubId, setResultSubId] = useState<string | null>(null);
  const [guardianToken, setGuardianToken] = useState<string | null>(null);
  const [athleteFee, setAthleteFee] = useState(0);

  // Load public settings
  useEffect(() => {
    if (!tournamentId) return;
    fetch(`/api/tournaments/${tournamentId}/public-settings`)
      .then(r => r.json())
      .then(data => {
        if (data.error) {
          setPageError(data.error);
        } else {
          setPageData(data);
        }
      })
      .catch(() => setPageError("Não foi possível carregar os dados do torneio."))
      .finally(() => setLoading(false));
  }, [tournamentId]);

  // Derived
  const eligibleCategories = pageData?.categories?.filter((cat: any) => {
    if (!birthDate) return true;
    const birthYear = new Date(birthDate).getFullYear();
    if (cat.birth_year_min && birthYear < cat.birth_year_min) return false;
    if (cat.birth_year_max && birthYear > cat.birth_year_max) return false;
    if (cat.gender !== "Misto" && cat.gender !== gender) return false;
    return true;
  }) ?? [];

  const allCategories = pageData?.categories ?? [];
  const selectedCategory = allCategories.find((c: any) => c.id === categoryId);
  const selectedInstitution = pageData?.institutions?.find((i: any) => i.id === institutionId);
  const settings = pageData?.settings;
  const tournament = pageData?.tournament;
  const org = pageData?.organization;

  const stepIndex = steps.findIndex(s => s.id === step);

  const handleNext = () => {
    const order: Step[] = ["athlete", "institution", "category", "guardian", "docs", "terms"];
    const idx = order.indexOf(step as Step);
    if (idx < order.length - 1) setStep(order[idx + 1]);
  };

  const handleBack = () => {
    const order: Step[] = ["athlete", "institution", "category", "guardian", "docs", "terms"];
    const idx = order.indexOf(step as Step);
    if (idx > 0) setStep(order[idx - 1]);
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
          categoryId, institutionId,
          parentName, parentPhone, parentEmail, parentPassword,
          photoFile, documentFile: docFile,
          authorizedImageUse: acceptedImageUse,
          liabilityWaiver: acceptedLiability,
          additionalData: { bloodType, allergies, emergencyContact },
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Erro ao realizar inscrição.");
        setStep("terms");
        return;
      }
      setResultSubId(data.subId);
      setGuardianToken(data.guardianToken);
      setAthleteFee(data.athleteFee || 0);

      // Auto-login guardian
      if (data.guardianToken) {
        const stored = { role: "guardian", email: parentEmail, name: parentName, token: data.guardianToken };
        localStorage.setItem("currentUser", JSON.stringify(stored));
      }

      setStep("success");
    } catch (err: any) {
      setSubmitError(err.message);
      setStep("terms");
    }
  };

  // ── Loading / Error states ──────────────────────────────────────────────────
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

  // ── Success screen ───────────────────────────────────────────────────────────
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
          <h2 className="text-2xl font-black text-slate-800 mb-2">Inscrição Realizada!</h2>
          <p className="text-slate-500 text-sm mb-1">
            <strong className="text-slate-700">{athleteName}</strong> foi inscrito(a) em <strong className="text-slate-700">{selectedCategory?.name}</strong>.
          </p>
          <p className="text-slate-400 text-xs mb-6">
            Protocolo: <span className="font-mono font-bold text-slate-600">{resultSubId?.slice(0, 8).toUpperCase()}</span>
          </p>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-left mb-6">
            <p className="text-xs font-bold text-amber-700 mb-1">⏳ Aguardando Validação</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              A organização do torneio irá revisar e validar sua inscrição. Você será notificado por e-mail quando for aprovada ou se houver alguma pendência.
            </p>
          </div>
          {athleteFee > 0 && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-left mb-6">
              <p className="text-xs font-bold text-indigo-700 mb-1">💳 Taxa de Inscrição: R$ {athleteFee.toFixed(2)}</p>
              <p className="text-xs text-slate-500">O pagamento será solicitado após a aprovação da inscrição.</p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            {guardianToken && (
              <button
                onClick={() => navigate("/")}
                className="w-full bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition text-sm"
              >
                Acompanhar minhas inscrições
              </button>
            )}
            <Link
              to={`/public/tournament/${tournamentId}`}
              className="w-full border border-slate-200 text-slate-600 px-6 py-3 rounded-xl font-bold hover:bg-slate-50 transition text-sm block"
            >
              Ver o torneio
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  // ── Submitting overlay ───────────────────────────────────────────────────────
  if (step === "submitting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center flex-col gap-4">
        <Loader2 size={40} className="text-indigo-600 animate-spin" />
        <p className="text-slate-600 font-bold">Finalizando sua inscrição...</p>
      </div>
    );
  }

  // ── Wizard layout ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          {tournament?.logoUrl
            ? <img src={tournament.logoUrl} className="w-10 h-10 rounded-xl object-cover" />
            : <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center"><Trophy size={20} className="text-indigo-600" /></div>
          }
          <div className="flex-1 min-w-0">
            <h1 className="font-black text-slate-800 text-sm truncate">{tournament?.name}</h1>
            <p className="text-xs text-slate-400 font-medium">Inscrição Individual</p>
          </div>
          <Link to={`/public/tournament/${tournamentId}`} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={20} />
          </Link>
        </div>
      </div>

      {/* Step progress */}
      <div className="max-w-2xl mx-auto px-4 pt-6">
        <div className="flex items-center gap-1 mb-8">
          {steps.filter(s => s.id !== "success").map((s, i) => {
            const done = stepIndex > i;
            const current = stepIndex === i;
            return (
              <React.Fragment key={s.id}>
                <div className={`flex items-center gap-1.5 ${current ? "" : ""}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center transition-all shrink-0 ${
                    done ? "bg-emerald-500 text-white" : current ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400"
                  }`}>
                    {done ? <Check size={13} /> : <s.icon size={13} />}
                  </div>
                  <span className={`text-[10px] font-bold hidden sm:block ${current ? "text-indigo-600" : done ? "text-emerald-600" : "text-slate-400"}`}>
                    {s.label}
                  </span>
                </div>
                {i < steps.filter(s => s.id !== "success").length - 1 && (
                  <div className={`flex-1 h-0.5 rounded-full transition-all ${done ? "bg-emerald-400" : "bg-slate-100"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.18 }}
          >
            {/* ── STEP 1: Athlete ─────────────────────────────────────────── */}
            {step === "athlete" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Dados do Atleta</h2>
                  <p className="text-slate-500 text-sm mt-1">Informe os dados pessoais do participante.</p>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nome Completo *</label>
                    <input
                      type="text"
                      placeholder="Nome do atleta"
                      value={athleteName}
                      onChange={e => setAthleteName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 focus:border-indigo-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Data de Nascimento *</label>
                      <input
                        type="date"
                        value={birthDate}
                        max={new Date().toISOString().split("T")[0]}
                        onChange={e => setBirthDate(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 focus:border-indigo-400"
                      />
                      {birthDate && (
                        <p className="text-xs text-indigo-600 font-semibold mt-1">{calcAge(birthDate)} anos</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Gênero *</label>
                      <select
                        value={gender}
                        onChange={e => setGender(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 bg-white"
                      >
                        <option>Masculino</option>
                        <option>Feminino</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">CPF / Documento *</label>
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      value={docNum}
                      onChange={e => setDocNum(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 focus:border-indigo-400"
                    />
                  </div>
                </div>

                <button
                  onClick={handleNext}
                  disabled={!athleteName || !birthDate || !docNum}
                  className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold text-sm hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  Próximo <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* ── STEP 2: Institution ─────────────────────────────────────── */}
            {step === "institution" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Clube / Escola</h2>
                  <p className="text-slate-500 text-sm mt-1">Selecione a instituição que o atleta representa.</p>
                </div>

                <div className="space-y-2">
                  {pageData?.institutions?.map((inst: any) => (
                    <button
                      key={inst.id ?? "independent"}
                      type="button"
                      onClick={() => setInstitutionId(inst.id)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                        institutionId === inst.id
                          ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/10"
                          : "border-slate-200 bg-white hover:border-indigo-200"
                      }`}
                    >
                      {inst.logo_url
                        ? <img src={inst.logo_url} className="w-10 h-10 rounded-xl object-cover shrink-0" />
                        : <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"><Building2 size={18} className="text-slate-400" /></div>
                      }
                      <span className="font-bold text-slate-700 text-sm">{inst.name}</span>
                      {institutionId === inst.id && <Check size={16} className="text-indigo-600 ml-auto" />}
                    </button>
                  ))}
                  {pageData?.institutions?.length === 0 && (
                    <div className="p-6 text-center text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
                      Nenhuma instituição disponível para este torneio.
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button onClick={handleBack} className="px-5 py-3 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50 transition">
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={institutionId === undefined}
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Próximo <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 3: Category ────────────────────────────────────────── */}
            {step === "category" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Prova / Categoria</h2>
                  <p className="text-slate-500 text-sm mt-1">
                    Selecione a prova que o atleta disputará.
                    {birthDate && <span className="text-indigo-600 font-semibold"> Categorias compatíveis com {calcAge(birthDate)} anos e gênero {gender} estão destacadas.</span>}
                  </p>
                </div>

                <div className="space-y-2">
                  {allCategories.map((cat: any) => {
                    const eligible = eligibleCategories.find((c: any) => c.id === cat.id);
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => eligible && setCategoryId(cat.id)}
                        disabled={!eligible}
                        title={!eligible ? "Fora dos critérios de idade ou gênero" : ""}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                          !eligible
                            ? "opacity-40 cursor-not-allowed border-slate-100 bg-slate-50"
                            : categoryId === cat.id
                              ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-500/10"
                              : "border-slate-200 bg-white hover:border-indigo-200"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          categoryId === cat.id ? "bg-indigo-100" : "bg-slate-100"
                        }`}>
                          <Trophy size={18} className={categoryId === cat.id ? "text-indigo-600" : "text-slate-400"} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-700 text-sm truncate">{cat.name}</p>
                          <p className="text-xs text-slate-400 font-medium">
                            {cat.gender} · {cat.age_group}
                            {(cat.birth_year_min || cat.birth_year_max) && ` · Nasc. ${cat.birth_year_min || ""}–${cat.birth_year_max || ""}`}
                          </p>
                        </div>
                        {categoryId === cat.id && <Check size={16} className="text-indigo-600 shrink-0" />}
                        {!eligible && <AlertCircle size={14} className="text-slate-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-3">
                  <button onClick={handleBack} className="px-5 py-3 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50 transition">
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!categoryId}
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Próximo <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 4: Guardian ─────────────────────────────────────────── */}
            {step === "guardian" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Responsável Legal</h2>
                  <p className="text-slate-500 text-sm mt-1">Preencha os dados do responsável pelo atleta.</p>
                </div>

                <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Nome do Responsável *</label>
                      <input type="text" placeholder="Nome completo" value={parentName} onChange={e => setParentName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 focus:border-indigo-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Telefone *</label>
                      <input type="tel" placeholder="(41) 99999-9999" value={parentPhone} onChange={e => setParentPhone(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 focus:border-indigo-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Tipo Sanguíneo</label>
                      <select value={bloodType} onChange={e => setBloodType(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 bg-white">
                        {BLOOD_TYPES.map(bt => <option key={bt}>{bt}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Alergias / Restrições</label>
                      <input type="text" placeholder="Ex: Amendoim, Látex" value={allergies} onChange={e => setAllergies(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 focus:border-indigo-400" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">Contato de Emergência *</label>
                      <input type="tel" placeholder="(41) 99999-9999" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-slate-700 focus:border-indigo-400" />
                    </div>
                  </div>

                  <hr className="border-slate-100" />
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Acesso ao Portal (para acompanhar inscrições)</p>

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
                    <p className="text-[11px] text-slate-400 mt-1">Será criada uma conta para acompanhar suas inscrições.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={handleBack} className="px-5 py-3 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50 transition">
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!parentName || !parentPhone || !parentEmail || !parentPassword || !emergencyContact}
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Próximo <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 5: Documents ────────────────────────────────────────── */}
            {step === "docs" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Documentos</h2>
                  <p className="text-slate-500 text-sm mt-1">Faça o envio dos documentos do atleta.</p>
                </div>

                <div className="space-y-4">
                  {/* Photo */}
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
                        <input type="file" accept="image/*" className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (f) { setPhotoFile(await fileToBase64(f)); setPhotoName(f.name); }
                          }} />
                      </label>
                    )}
                  </div>

                  {/* Document */}
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
                        <input type="file" accept="image/*,application/pdf" className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (f) { setDocFile(await fileToBase64(f)); setDocFileName(f.name); }
                          }} />
                      </label>
                    )}
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={handleBack} className="px-5 py-3 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50 transition">
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 transition flex items-center justify-center gap-2"
                  >
                    Próximo <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP 6: Terms ────────────────────────────────────────────── */}
            {step === "terms" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-black text-slate-800">Termos e Confirmação</h2>
                  <p className="text-slate-500 text-sm mt-1">Revise e aceite os termos para concluir a inscrição.</p>
                </div>

                {/* Summary */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 space-y-2 text-sm">
                  <p className="font-black text-indigo-700 text-xs uppercase tracking-wider mb-2">Resumo da Inscrição</p>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <span className="text-slate-500 font-semibold">Atleta</span>
                    <span className="font-bold text-slate-700">{athleteName}</span>
                    <span className="text-slate-500 font-semibold">Nascimento</span>
                    <span className="font-bold text-slate-700">{formatDate(birthDate)} ({calcAge(birthDate)} anos)</span>
                    <span className="text-slate-500 font-semibold">Gênero</span>
                    <span className="font-bold text-slate-700">{gender}</span>
                    <span className="text-slate-500 font-semibold">Clube</span>
                    <span className="font-bold text-slate-700">{selectedInstitution?.name || "Independente"}</span>
                    <span className="text-slate-500 font-semibold">Prova</span>
                    <span className="font-bold text-slate-700">{selectedCategory?.name}</span>
                    <span className="text-slate-500 font-semibold">Taxa</span>
                    <span className="font-bold text-slate-700">{settings?.athleteFee > 0 ? `R$ ${settings.athleteFee.toFixed(2)}` : "Gratuita"}</span>
                  </div>
                </div>

                {/* Terms checkboxes */}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setAcceptedImageUse(!acceptedImageUse)}
                    className={`w-full flex gap-3 p-4 rounded-2xl border text-left transition-all ${
                      acceptedImageUse ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 border-2 transition-all ${
                      acceptedImageUse ? "bg-emerald-500 border-emerald-500" : "border-slate-300"
                    }`}>
                      {acceptedImageUse && <Check size={12} className="text-white" />}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-700 mb-1">Concessão de Direito de Uso de Imagem</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">Autorizo expressamente o organizador do torneio a capturar e utilizar imagens, vídeos e transmissões de áudio nas quais o atleta participante figure, com finalidade puramente de divulgação esportiva.</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAcceptedLiability(!acceptedLiability)}
                    className={`w-full flex gap-3 p-4 rounded-2xl border text-left transition-all ${
                      acceptedLiability ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 border-2 transition-all ${
                      acceptedLiability ? "bg-emerald-500 border-emerald-500" : "border-slate-300"
                    }`}>
                      {acceptedLiability && <Check size={12} className="text-white" />}
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-700 mb-1">Termo de Aptidão Física e Responsabilidade</p>
                      <p className="text-[11px] text-slate-500 leading-relaxed">Declaro que o atleta encontra-se plenamente apto e saudável para a participação em esportes competitivos. Isento os realizadores e patrocinadores de responsabilidade por acidentes decorrentes dos jogos.</p>
                    </div>
                  </button>
                </div>

                {submitError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex gap-2 text-rose-700 text-sm font-semibold">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    {submitError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={handleBack} className="px-5 py-3 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50 transition">
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!acceptedImageUse || !acceptedLiability}
                    className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-emerald-700 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} /> Confirmar Inscrição
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Spacer */}
      <div className="h-16" />
    </div>
  );
}
