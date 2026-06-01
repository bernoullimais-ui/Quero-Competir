import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "motion/react";
import { 
  ShieldCheck, 
  UploadCloud, 
  Check, 
  User, 
  Phone, 
  Heart, 
  AlertCircle, 
  FileText, 
  Image, 
  CreditCard, 
  QrCode, 
  Copy, 
  Clock, 
  Activity, 
  Trash2, 
  X,
  FileCheck2,
  Trophy,
  Mail,
  Lock
} from "lucide-react";
import { useToast } from "./ui/Toast.tsx";

export default function PublicAthleteRegistration() {
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const { subId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null); // { subscription, tournament, institution, category, settings }
  
  // Form States
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [parentPassword, setParentPassword] = useState("");
  const [bloodType, setBloodType] = useState("O+");
  const [allergies, setAllergies] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [graduation, setGraduation] = useState("");
  const [weightClass, setWeightClass] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [documentFile, setDocumentFile] = useState<string | null>(null);
  const [documentFileName, setDocumentFileName] = useState("");
  const [photoFile, setPhotoFile] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState("");
  const [authorizedImageUse, setAuthorizedImageUse] = useState(false);
  const [liabilityWaiver, setLiabilityWaiver] = useState(false);

  // Custom customizable registration configs
  const [customFields, setCustomFields] = useState<Record<string, string>>({});
  const [customUploads, setCustomUploads] = useState<Record<string, { fileName: string; fileData: string }>>({});
  const [acceptedTerms, setAcceptedTerms] = useState<Record<string, boolean>>({});
  
  // Payment States
  const [paymentMethod, setPaymentMethod] = useState<"pix" | "card">("pix");
  const [copiedPix, setCopiedPix] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string; qrCodeUrl: string } | null>(null);
  const [pagarmePublicKey, setPagarmePublicKey] = useState("");
  const [simulatedCard, setSimulatedCard] = useState({
    number: "",
    name: "",
    expiry: "",
    cvv: ""
  });
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  
  // Steps
  const [currentStep, setCurrentStep] = useState<"form" | "upload" | "terms" | "payment" | "success">("form");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getRegConfig = () => {
    return data?.settings?.registrationConfig || {
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
  };

  const getActiveStages = () => {
    const regConfig = getRegConfig();
    const stages: Array<{ id: "form" | "upload" | "terms" | "payment" | "success"; label: string }> = [
      { id: "form", label: "Dados" }
    ];
    
    if (regConfig.uploads.some((u: any) => u.enabled)) {
      stages.push({ id: "upload", label: "Documentos" });
    }
    
    if (regConfig.terms.some((t: any) => t.enabled)) {
      stages.push({ id: "terms", label: "Termos" });
    }
    
    const needsIndividualPayment = data?.settings?.feeType === "by_team_and_athlete_parent";
    const needsMembershipPayment = data?.settings?.requireMembership && data?.membershipStatus === "pending";
    if ((needsIndividualPayment || needsMembershipPayment) && !paymentConfirmed) {
      stages.push({ id: "payment", label: "Pagamento" });
    }
    
    return stages;
  };

  useEffect(() => {
    if (!subId) return;
    fetch(`/api/tournaments/public/athlete-subscription/${subId}`)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Inscrição não encontrada");
        }
        return res.json();
      })
      .then((resData) => {
        setData(resData);
        if (resData.pagarmePublicKey) {
          setPagarmePublicKey(resData.pagarmePublicKey);
        }
        if (resData.subscription) {
          setParentName(resData.subscription.parentName || "");
          setParentPhone(resData.subscription.parentPhone || "");
          if (resData.subscription.additionalData) {
            setParentEmail(resData.subscription.additionalData.parentEmail || "");
            setBloodType(resData.subscription.additionalData.bloodType || "O+");
            setAllergies(resData.subscription.additionalData.allergies || "");
            setEmergencyContact(resData.subscription.additionalData.emergencyContact || "");
            setAgeGroup(resData.subscription.additionalData.age_group || "");
            setGraduation(resData.subscription.additionalData.graduation || "");
            setWeightClass(resData.subscription.additionalData.weight_class || "");

            // Initialize custom fields & uploads from saved subscription
            if (resData.subscription.additionalData.customFields) {
              setCustomFields(resData.subscription.additionalData.customFields);
            }
            if (resData.subscription.additionalData.customUploads) {
              setCustomUploads(resData.subscription.additionalData.customUploads);
            }
          }
          if (resData.subscription.documentUrl) {
            setDocumentFile(resData.subscription.documentUrl);
            setDocumentFileName("documento_salvo.png");
          }
          if (resData.subscription.photoUrl) {
            setPhotoFile(resData.subscription.photoUrl);
            setPhotoFileName("foto_salva.png");
          }
          
          // Set initial acceptedTerms
          const initialTerms: Record<string, boolean> = {
            imageUse: !!resData.subscription.authorizedImageUse,
            liability: !!resData.subscription.liabilityWaiver
          };
          const regConfig = resData.settings?.registrationConfig || { terms: [] };
          regConfig.terms.forEach((t: any) => {
            if (t.custom) {
              initialTerms[t.id] = !!resData.subscription.additionalData?.customTerms?.[t.id];
            }
          });
          setAcceptedTerms(initialTerms);
        }
        if (resData.subscription && resData.subscription.isCompleted) {
          setCurrentStep("success");
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message);
        setLoading(false);
      });
  }, [subId]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      readAndSetFile(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      readAndSetFile(e.target.files[0]);
    }
  };

  const handlePhotoFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPhotoFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        setPhotoFile(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const readAndSetFile = (file: File) => {
    setDocumentFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setDocumentFile(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const copyPixKey = () => {
    navigator.clipboard.writeText("00020101021126580014br.gov.bcb.pix0136e4f3a9e6-7b9c-4f11-8fc2-1f3ef4d4f61f520400005303986540510.005802BR5915ARENASUBSCRIBED6009SAO PAULO62070503***6304CA30");
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2000);
  };



  const handleCustomFileInput = (e: React.ChangeEvent<HTMLInputElement>, id: string) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setCustomUploads(prev => ({
          ...prev,
          [id]: { fileName: file.name, fileData: reader.result as string }
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const regConfig = getRegConfig();
    
    // Validate standard fields
    for (const field of regConfig.fields) {
      if (!field.enabled) continue;
      
      const isReq = field.required || (["parentName", "parentPhone"].includes(field.id) && isMinor());
      
      if (field.id === "parentName" && isReq && !parentName.trim()) {
        toastWarning("Por favor, preencha o Nome do Responsável.");
        return;
      }
      if (field.id === "parentPhone" && isReq && !parentPhone.trim()) {
        toastWarning("Por favor, preencha o Telefone do Responsável.");
        return;
      }
      if (field.id === "bloodType" && isReq && !bloodType.trim()) {
        toastWarning("Por favor, selecione o Tipo Sanguíneo.");
        return;
      }
      if (field.id === "allergies" && isReq && !allergies.trim()) {
        toastWarning("Por favor, preencha o campo de Alergias.");
        return;
      }
      if (field.id === "emergencyContact" && isReq && !emergencyContact.trim()) {
        toastWarning("Por favor, preencha o Contato de Emergência.");
        return;
      }
      
      // Custom field validation
      if (field.custom) {
        const val = customFields[field.id] || "";
        if (field.required && !val.trim()) {
          toastWarning(`Por favor, preencha o campo "${field.label}".`);
          return;
        }
      }
    }

    // Validation passed, navigate to next step
    if (regConfig.uploads.some((u: any) => u.enabled)) {
      setCurrentStep("upload");
    } else if (regConfig.terms.some((t: any) => t.enabled)) {
      setCurrentStep("terms");
    } else if ((data?.settings?.feeType === "by_team_and_athlete_parent" || (data?.settings?.requireMembership && data?.membershipStatus === "pending")) && !paymentConfirmed) {
      setCurrentStep("payment");
    } else {
      executeCompleteSubscription();
    }
  };

  const handleUploadSubmit = () => {
    const regConfig = getRegConfig();
    
    // Validate standard uploads
    const docConfig = regConfig.uploads.find((u: any) => u.id === "document");
    if (docConfig && docConfig.enabled && docConfig.required && !documentFile) {
      toastWarning("Por favor, anexe o Documento de Identidade.");
      return;
    }

    const photoConfig = regConfig.uploads.find((u: any) => u.id === "photo");
    if (photoConfig && photoConfig.enabled && photoConfig.required && !photoFile) {
      toastWarning("Por favor, anexe a Foto de Rosto.");
      return;
    }

    // Validate custom uploads
    for (const up of regConfig.uploads) {
      if (up.custom && up.enabled && up.required) {
        const uploaded = customUploads[up.id];
        if (!uploaded || !uploaded.fileData) {
          toastWarning(`Por favor, anexe o arquivo para "${up.label}".`);
          return;
        }
      }
    }

    // Navigation
    if (regConfig.terms.some((t: any) => t.enabled)) {
      setCurrentStep("terms");
    } else if ((data?.settings?.feeType === "by_team_and_athlete_parent" || (data?.settings?.requireMembership && data?.membershipStatus === "pending")) && !paymentConfirmed) {
      setCurrentStep("payment");
    } else {
      executeCompleteSubscription();
    }
  };

  const handleTermsSubmit = () => {
    const regConfig = getRegConfig();
    
    // Validate all enabled and required terms are checked
    for (const term of regConfig.terms) {
      if (term.enabled && term.required) {
        if (!acceptedTerms[term.id]) {
          toastWarning(`Você precisa aceitar o termo "${term.title}" para prosseguir.`);
          return;
        }
      }
    }
    
    const needsIndividualPayment = data?.settings?.feeType === "by_team_and_athlete_parent";
    const needsMembershipPayment = data?.settings?.requireMembership && data?.membershipStatus === "pending";

    if ((needsIndividualPayment || needsMembershipPayment) && !paymentConfirmed) {
      setCurrentStep("payment");
    } else {
      executeCompleteSubscription();
    }
  };

  const handlePay = async (forceSimulate = false) => {
    if (!subId || !data) return;

    setIsSubmitting(true);
    try {
      let bodyData: any = { 
        method: paymentMethod,
        parentName,
        parentPhone
      };

      if (forceSimulate) {
        bodyData.simulateSuccess = true;
      }

      // Se for cartão, fazemos a tokenização real (ou mock)
      if (paymentMethod === "card" && !forceSimulate) {
        if (!simulatedCard.number || !simulatedCard.name || !simulatedCard.expiry || !simulatedCard.cvv) {
          throw new Error("Preencha todos os campos do cartão.");
        }
        
        let cardToken = "mock_card_token_" + Math.random().toString(36).substring(2, 10);

        if (pagarmePublicKey) {
          try {
            const expMonth = Number(simulatedCard.expiry.split("/")[0]);
            const expYear = Number("20" + simulatedCard.expiry.split("/")[1]);
            
            const tokenRes = await fetch(`https://api.pagar.me/core/v5/tokens?appId=${pagarmePublicKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "card",
                card: {
                  number: simulatedCard.number.replace(/\s/g, ""),
                  holder_name: simulatedCard.name,
                  exp_month: expMonth,
                  exp_year: expYear,
                  cvv: simulatedCard.cvv
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

      const res = await fetch(`/api/tournaments/public/athlete-subscription/${subId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData)
      });
      const resData = await res.json();

      if (res.ok && resData.success) {
        if (resData.paid) {
          setPaymentConfirmed(true);
          await executeCompleteSubscription();
        } else if (paymentMethod === "pix") {
          setPixData({ qrCode: resData.qrCode, qrCodeUrl: resData.qrCodeUrl });
        }
      } else {
        throw new Error(resData.error || "Erro ao processar o pagamento.");
      }
    } catch (err: any) {
      console.error(err);
      toastError(err.message || "Erro ao efetuar o pagamento.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const executeCompleteSubscription = async () => {
    setIsSubmitting(true);
    try {
      const regConfig = getRegConfig();
      const customTermsChecked: Record<string, boolean> = {};
      regConfig.terms.forEach((t: any) => {
        if (t.custom) {
          customTermsChecked[t.id] = !!acceptedTerms[t.id];
        }
      });

      const response = await fetch(`/api/tournaments/public/athlete-subscription/${subId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentName: regConfig.fields.find((f: any) => f.id === "parentName")?.enabled ? parentName : null,
          parentPhone: regConfig.fields.find((f: any) => f.id === "parentPhone")?.enabled ? parentPhone : null,
          parentEmail,
          parentPassword,
          additionalData: {
            parentEmail,
            bloodType: regConfig.fields.find((f: any) => f.id === "bloodType")?.enabled ? bloodType : null,
            allergies: regConfig.fields.find((f: any) => f.id === "allergies")?.enabled ? allergies : null,
            emergencyContact: regConfig.fields.find((f: any) => f.id === "emergencyContact")?.enabled ? emergencyContact : null,
            customFields,
            customUploads,
            customTerms: customTermsChecked,
            ...(data?.category?.rules_config?.sport_type === "combat" ? {
              age_group: ageGroup,
              graduation: graduation,
              weight_class: weightClass
            } : {})
          },
          documentUrl: regConfig.uploads.find((u: any) => u.id === "document")?.enabled ? documentFile : null,
          photoUrl: regConfig.uploads.find((u: any) => u.id === "photo")?.enabled ? photoFile : null,
          authorizedImageUse: regConfig.terms.find((t: any) => t.id === "imageUse")?.enabled ? !!acceptedTerms["imageUse"] : false,
          liabilityWaiver: regConfig.terms.find((t: any) => t.id === "liability")?.enabled ? !!acceptedTerms["liability"] : false,
          paymentStatus: (data?.settings?.feeType === "by_team_and_athlete_parent" || paymentConfirmed) ? "paid" : "paid"
        })
      });

      if (!response.ok) {
        throw new Error("Erro ao salvar inscrição.");
      }

      const completedSub = await response.json();
      if (completedSub) {
        setData((prev: any) => ({
          ...prev,
          subscription: completedSub
        }));
      }

      setCurrentStep("success");
    } catch (err: any) {
      toastError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-indigo-600 animate-spin" />
        <p className="mt-4 text-slate-500 font-bold tracking-tight text-sm">Carregando portal de inscrição...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 max-w-md w-full rounded-3xl border border-slate-100 shadow-xl text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <X size={32} />
          </div>
          <h2 className="text-xl font-bold text-slate-800">Inscrição Inacessível</h2>
          <p className="text-slate-500 text-sm mt-2 mb-6">
            O link de inscrição que você utilizou pode estar inválido, expirado ou o prazo foi encerrado pelo organizador.
          </p>
          <p className="text-red-500 text-xs font-bold bg-red-50 py-2.5 px-4 rounded-xl border border-red-100 mb-6">
            {error || "Inscrição não localizada no servidor."}
          </p>
          <div className="text-slate-400 text-xs uppercase font-bold tracking-widest">
            Quero Competir • Processamento Seguro
          </div>
        </div>
      </div>
    );
  }

  const { subscription, tournament, institution, category, settings, organization } = data;
  const isMinor = () => {
    if (!subscription.birthDate) return true;
    const birthYear = new Date(subscription.birthDate).getFullYear();
    const currentYear = new Date().getFullYear();
    return (currentYear - birthYear) < 18;
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-16 flex justify-center px-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-indigo-50/70 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-2xl w-full mt-8 md:mt-16 z-10">
        
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-indigo-50 border border-indigo-100/50 rounded-full text-indigo-600 text-xs font-bold uppercase tracking-widest mb-4">
            <ShieldCheck size={14} /> Portal de Inscrição Individual
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{tournament?.name}</h1>
          <p className="text-slate-500 mt-1.5 text-sm font-semibold">
            Equipe: <span className="text-indigo-600">{institution?.name}</span> • Categoria: {category?.name || "Mista"}
            {organization?.name && (
              <> • Organizador: <span className="text-indigo-600">{organization.name}</span></>
            )}
          </p>
        </div>

        {/* Info Strip (Deadline and Registration Type) */}
        {currentStep !== "success" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-white px-5 py-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
              <Clock className="text-slate-400 flex-shrink-0" size={18} />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Fim das Inscrições</p>
                <p className="text-sm font-bold text-slate-700">
                  {settings.deadline ? new Date(settings.deadline).toLocaleDateString("pt-BR") : "Não informado"}
                </p>
              </div>
            </div>
            <div className="bg-white px-5 py-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
              <CreditCard className="text-slate-400 flex-shrink-0" size={18} />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Taxa de Inscrição</p>
                <p className="text-sm font-semibold text-slate-700">
                  {settings.feeType === "free" && <span className="text-emerald-600 font-bold">Gratuita</span>}
                  {settings.feeType === "by_team" && <span className="text-indigo-600 font-semibold">Inclusa (Paga pela Instituição)</span>}
                  {settings.feeType === "by_team_and_athlete_institution" && <span className="text-indigo-600 font-semibold">Paga pela Instituição</span>}
                  {settings.feeType === "by_team_and_athlete_parent" && (
                    <span className="text-amber-600 font-bold">Paga pelo Responsável (R$ {settings.athleteFee.toFixed(2)})</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Steps Indicators */}
        {currentStep !== "success" && (() => {
          const activeStages = getActiveStages();
          const stagesIds = activeStages.map(s => s.id);
          
          return (
            <div className="flex items-center justify-between px-2 mb-6">
              {activeStages.map((stepItem, idx) => {
                const currentIdx = stagesIds.indexOf(currentStep);
                const itemIdx = stagesIds.indexOf(stepItem.id);
                const isActive = stepItem.id === currentStep;
                const isDone = itemIdx < currentIdx;

                return (
                  <div key={stepItem.id} className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black transition-all ${
                      isActive ? "bg-indigo-600 text-white font-bold" : 
                      isDone ? "bg-emerald-100 text-emerald-600 border border-emerald-200" : 
                      "bg-white text-slate-400 border border-slate-200"
                    }`}>
                      {isDone ? <Check size={14} /> : idx + 1}
                    </div>
                    <span className={`text-xs font-bold hidden sm:inline ${isActive ? "text-indigo-600" : "text-slate-400"}`}>
                      {stepItem.label}
                    </span>
                    {idx < activeStages.length - 1 && (
                      <div className="w-4 h-[1px] bg-slate-200" />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* Card Body */}
        <div className="bg-white border border-slate-100 shadow-xl rounded-3xl p-6 md:p-8">
          
          {/* STEP 1: FORM INPUT */}
          {currentStep === "form" && (
            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div className="border-b border-indigo-50 pb-4 mb-6">
                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <User size={18} className="text-indigo-600" /> Confirmar Atleta Inscrito
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Confirme as informações enviadas pela sua instituição e preencha os dados restantes.
                </p>
              </div>

              {/* Prefilled Locked Data */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="col-span-1 md:col-span-1">
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Atleta</span>
                  <span className="text-sm font-bold text-slate-700">{subscription.athleteName}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Documento</span>
                  <span className="text-sm font-bold text-slate-700">{subscription.document}</span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Data de Nasc.</span>
                  <span className="text-sm font-bold text-slate-700">
                    {new Date(subscription.birthDate).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>

              {/* Parent and Additional Info Required */}
              <div className="space-y-6">
                {category?.rules_config?.sport_type === "combat" && (
                  <div className="space-y-4 pt-2 animate-in fade-in duration-200">
                    <h3 className="text-sm font-black uppercase text-slate-400 tracking-wider">Subdivisão para Disputa Individual</h3>
                    <p className="text-xs text-slate-500 font-medium -mt-2">
                      Esta é uma modalidade de luta ({category.name}). Confirme as categorias e faixas do atleta para o chaveamento.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-700 flex items-center gap-1">
                          Idade / Classe <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={ageGroup}
                          onChange={e => setAgeGroup(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 text-sm font-medium bg-white"
                        >
                          <option value="">Selecione...</option>
                          {category.rules_config.ages?.map((age: string) => (
                            <option key={age} value={age}>{age}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-700 flex items-center gap-1">
                          Graduação / Faixa <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={graduation}
                          onChange={e => setGraduation(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 text-sm font-medium bg-white"
                        >
                          <option value="">Selecione...</option>
                          {category.rules_config.graduations?.map((grad: string) => (
                            <option key={grad} value={grad}>{grad}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold mb-2 text-slate-700 flex items-center gap-1">
                          Faixa de Peso <span className="text-red-500">*</span>
                        </label>
                        <select
                          required
                          value={weightClass}
                          onChange={e => setWeightClass(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 text-sm font-medium bg-white"
                        >
                          <option value="">Selecione...</option>
                          {category.rules_config.weights?.map((w: string) => (
                            <option key={w} value={w}>{w}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {(() => {
                  const regConfig = getRegConfig();
                  const enabledFields = regConfig.fields.filter(f => f.enabled);

                  if (enabledFields.length === 0) return null;

                  return (
                    <div className="space-y-4 pt-2">
                      <h3 className="text-sm font-black uppercase text-slate-400 tracking-wider">Dados Complementares do Atleta</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {enabledFields.map(field => {
                          if (field.id === "parentName") {
                            return (
                              <div key={field.id} className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-semibold mb-2 text-slate-700 flex items-center gap-1">
                                  {field.label} {(field.required || isMinor()) && <span className="text-red-500">*</span>}
                                </label>
                                <div className="relative">
                                  <input 
                                    type="text"
                                    required={field.required || isMinor()}
                                    placeholder="Ex: Nome do Pai ou Mãe"
                                    value={parentName}
                                    onChange={e => setParentName(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 text-sm font-medium transition-colors"
                                  />
                                  <User size={18} className="text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                </div>
                              </div>
                            );
                          }
                          if (field.id === "parentPhone") {
                            return (
                              <div key={field.id} className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-semibold mb-2 text-slate-700 flex items-center gap-1">
                                  {field.label} {(field.required || isMinor()) && <span className="text-red-500">*</span>}
                                </label>
                                <div className="relative">
                                  <input 
                                    type="tel"
                                    required={field.required || isMinor()}
                                    placeholder="(DD) 99999-9999"
                                    value={parentPhone}
                                    onChange={e => setParentPhone(e.target.value)}
                                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 text-sm font-medium transition-colors bg-white"
                                  />
                                  <Phone size={18} className="text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                </div>
                              </div>
                            );
                          }
                          if (field.id === "bloodType") {
                            return (
                              <div key={field.id} className="col-span-1">
                                <label className="block text-sm font-semibold mb-2 text-slate-700 flex items-center gap-1">
                                  {field.label} {field.required && <span className="text-red-500">*</span>} <Heart size={14} className="text-red-500" />
                                </label>
                                <select
                                  value={bloodType}
                                  required={field.required}
                                  onChange={e => setBloodType(e.target.value)}
                                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 text-sm font-medium bg-white"
                                >
                                  {field.required ? <option value="">Selecione...</option> : null}
                                  {["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map(v => (
                                    <option key={v} value={v}>{v}</option>
                                  ))}
                                </select>
                              </div>
                            );
                          }
                          if (field.id === "allergies") {
                            return (
                              <div key={field.id} className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-semibold mb-2 text-slate-700">
                                  {field.label} {field.required && <span className="text-red-500">*</span>}
                                </label>
                                <input 
                                  type="text"
                                  required={field.required}
                                  placeholder="Ex: Nenhuma alergia a medicamentos"
                                  value={allergies}
                                  onChange={e => setAllergies(e.target.value)}
                                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 text-sm font-medium transition-colors"
                                />
                              </div>
                            );
                          }
                          if (field.id === "emergencyContact") {
                            return (
                              <div key={field.id} className="col-span-1 md:col-span-2">
                                <label className="block text-sm font-semibold mb-2 text-slate-700">
                                  {field.label} {field.required && <span className="text-red-500">*</span>}
                                </label>
                                <input 
                                  type="text"
                                  required={field.required}
                                  placeholder="Ex: Tio João - (11) 98888-8888"
                                  value={emergencyContact}
                                  onChange={e => setEmergencyContact(e.target.value)}
                                  className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 text-sm font-medium transition-colors"
                                />
                              </div>
                            );
                          }
                          // Custom fields
                          return (
                            <div key={field.id} className="col-span-1 md:col-span-2">
                              <label className="block text-sm font-semibold mb-2 text-slate-700 flex items-center gap-1">
                                {field.label} {field.required && <span className="text-red-500">*</span>}
                              </label>
                              <input 
                                type="text"
                                required={field.required}
                                placeholder={`Preencha ${field.label}`}
                                value={customFields[field.id] || ""}
                                onChange={e => setCustomFields({ ...customFields, [field.id]: e.target.value })}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 text-sm font-medium transition-colors"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Account Creation Section - ALWAYS VISIBLE */}
                <div className="space-y-4 pt-6 border-t border-slate-100 animate-in fade-in duration-200">
                  <div className="col-span-full">
                    <h4 className="text-xs font-bold text-indigo-650 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck size={16} className="text-indigo-600" /> Criação de Conta para Acessos Futuros
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 font-medium">
                      Crie seus dados de acesso ao portal para gerenciar visitantes e acompanhar a tabela de jogos.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-slate-700 flex items-center gap-1">
                        E-mail de Acesso <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input 
                          type="email"
                          required
                          placeholder="seu-email@dominio.com"
                          value={parentEmail}
                          onChange={e => setParentEmail(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 text-sm font-medium transition-colors bg-white"
                        />
                        <Mail size={18} className="text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-slate-700 flex items-center gap-1">
                        Senha de Acesso <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input 
                          type="password"
                          required
                          minLength={6}
                          placeholder="Mínimo 6 caracteres"
                          value={parentPassword}
                          onChange={e => setParentPassword(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 text-sm font-medium transition-colors bg-white"
                        />
                        <Lock size={18} className="text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 flex justify-end">
                <button 
                  type="submit" 
                  className="bg-indigo-600 text-white min-h-[44px] px-8 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center gap-1"
                >
                  Prosseguir para Documentação
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: UPLOAD DOCUMENT */}
          {currentStep === "upload" && (() => {
            const regConfig = getRegConfig();
            const docConfig = regConfig.uploads.find((u: any) => u.id === "document");
            const photoConfig = regConfig.uploads.find((u: any) => u.id === "photo");
            const customUploadsList = regConfig.uploads.filter((u: any) => u.custom && u.enabled);

            return (
              <div className="space-y-8">
                <div className="border-b border-indigo-50 pb-4 mb-6">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <UploadCloud size={18} className="text-indigo-600" /> Documentação e Foto do Atleta
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Para concluir o cadastro, informe os arquivos e documentos solicitados pelo organizador do torneio.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* ID Document Box */}
                  {docConfig?.enabled && (
                    <div className="space-y-4">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {docConfig.label} {docConfig.required && <span className="text-red-500">*</span>}
                      </label>
                      
                      <div 
                        className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all min-h-[220px] flex flex-col justify-center items-center ${
                          dragActive ? "border-indigo-500 bg-indigo-50/50" : "border-slate-200 hover:border-indigo-400 bg-slate-50/50"
                        }`}
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => document.getElementById("doc-file-input")?.click()}
                      >
                        <input 
                          type="file" 
                          id="doc-file-input"
                          accept="image/*,application/pdf"
                          className="hidden" 
                          onChange={handleFileInput}
                        />
                        
                        {documentFile ? (
                          <div className="space-y-4">
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
                              {documentFileName.toLowerCase().endsWith(".pdf") ? <FileText size={32} /> : <Image size={32} />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-700 truncate max-w-[200px] mx-auto">{documentFileName}</p>
                              <p className="text-xs text-slate-400">Documento carregado</p>
                            </div>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDocumentFile(null);
                                setDocumentFileName("");
                              }}
                              className="text-xs text-red-500 font-bold hover:underline py-1.5 px-3 bg-red-50 rounded-lg hover:bg-red-100 transition duration-150 inline-flex items-center gap-1"
                            >
                              <Trash2 size={12} /> Remover
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto">
                              <UploadCloud size={24} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-700">Anexe o documento ou clique</p>
                              <p className="text-[10px] text-slate-400 mt-1">Imagens (JPEG, PNG) ou PDF</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Athlete Face Photo Box */}
                  {photoConfig?.enabled && (
                    <div className="space-y-4">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {photoConfig.label} {photoConfig.required && <span className="text-red-500">*</span>}
                      </label>
                      
                      <div 
                        className="border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all min-h-[220px] flex flex-col justify-center items-center border-slate-200 hover:border-indigo-400 bg-slate-50/50"
                        onClick={() => document.getElementById("photo-file-input")?.click()}
                      >
                        <input 
                          type="file" 
                          id="photo-file-input"
                          accept="image/*"
                          className="hidden" 
                          onChange={handlePhotoFileInput}
                        />
                        
                        {photoFile ? (
                          <div className="space-y-4">
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full overflow-hidden flex items-center justify-center mx-auto border-2 border-emerald-300">
                              <img src={photoFile} alt="Foto de rosto" className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-700 truncate max-w-[200px] mx-auto">{photoFileName}</p>
                              <p className="text-xs text-slate-400">Foto de rosto carregada</p>
                            </div>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPhotoFile(null);
                                setPhotoFileName("");
                              }}
                              className="text-xs text-red-500 font-bold hover:underline py-1.5 px-3 bg-red-50 rounded-lg hover:bg-red-100 transition duration-150 inline-flex items-center gap-1"
                            >
                              <Trash2 size={12} /> Remover
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto">
                              <User size={24} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-700">Anexe a foto do aluno ou clique</p>
                              <p className="text-[10px] text-slate-400 mt-1">Imagens (JPEG, PNG)</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Custom Upload Boxes */}
                  {customUploadsList.map(upload => (
                    <div key={upload.id} className="space-y-4 animate-in fade-in duration-200">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                        {upload.label} {upload.required && <span className="text-red-500">*</span>}
                      </label>
                      
                      <div 
                        className="border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all min-h-[220px] flex flex-col justify-center items-center border-slate-200 hover:border-indigo-400 bg-slate-50/50"
                        onClick={() => document.getElementById(`custom-file-input-${upload.id}`)?.click()}
                      >
                        <input 
                          type="file" 
                          id={`custom-file-input-${upload.id}`}
                          accept="image/*,application/pdf"
                          className="hidden" 
                          onChange={(e) => handleCustomFileInput(e, upload.id)}
                        />
                        
                        {customUploads[upload.id]?.fileData ? (
                          <div className="space-y-4">
                            <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
                              {customUploads[upload.id].fileName.toLowerCase().endsWith(".pdf") ? <FileText size={32} /> : <Image size={32} />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-700 truncate max-w-[200px] mx-auto">{customUploads[upload.id].fileName}</p>
                              <p className="text-xs text-slate-400">Arquivo carregado</p>
                            </div>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCustomUploads(prev => ({
                                  ...prev,
                                  [upload.id]: { fileName: "", fileData: "" }
                                }));
                              }}
                              className="text-xs text-red-500 font-bold hover:underline py-1.5 px-3 bg-red-50 rounded-lg hover:bg-red-100 transition duration-150 inline-flex items-center gap-1"
                            >
                              <Trash2 size={12} /> Remover
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-2xl flex items-center justify-center mx-auto">
                              <UploadCloud size={24} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-700">Anexe o arquivo ou clique</p>
                              <p className="text-[10px] text-slate-400 mt-1">Imagens (JPEG, PNG) ou PDF</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Guidance Tip */}
                {photoConfig?.enabled && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex gap-3 text-slate-600 text-xs shadow-sm">
                    <div className="text-indigo-500 font-bold shrink-0">💡 Dica:</div>
                    <p>
                      A foto do aluno é utilizada nas fichas de arbitragem e carteirinhas de identificação oficiais do torneio. Garanta que o rosto esteja bem visível, sem boné ou óculos escuros, e com fundo neutro.
                    </p>
                  </div>
                )}

                <div className="pt-6 border-t border-slate-100 flex justify-between">
                  <button 
                    type="button"
                    onClick={() => setCurrentStep("form")}
                    className="text-slate-500 font-bold hover:bg-slate-50 px-6 rounded-xl transition-colors min-h-[44px]"
                  >
                    Voltar
                  </button>
                  <button 
                    type="button"
                    onClick={handleUploadSubmit}
                    disabled={(() => {
                      if (docConfig?.enabled && docConfig?.required && !documentFile) return true;
                      if (photoConfig?.enabled && photoConfig?.required && !photoFile) return true;
                      for (const up of regConfig.uploads) {
                        if (up.custom && up.enabled && up.required) {
                          const file = customUploads[up.id];
                          if (!file || !file.fileData) return true;
                        }
                      }
                      return false;
                    })()}
                    className="bg-indigo-600 text-white min-h-[44px] px-8 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-200 cursor-pointer"
                  >
                    Prosseguir para Termos
                  </button>
                </div>
              </div>
            );
          })()}

          {/* STEP 3: TERMS & CONFIRMATIONS */}
          {currentStep === "terms" && (() => {
            const regConfig = getRegConfig();
            const activeTerms = regConfig.terms.filter((t: any) => t.enabled);

            return (
              <div className="space-y-6">
                <div className="border-b border-indigo-50 pb-4 mb-6">
                  <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <FileText size={18} className="text-indigo-600" /> Termos de Autorização e Declarações
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Por favor, revise atentamente as autorizações de conformidade e uso de imagem.
                  </p>
                </div>

                <div className="space-y-4">
                  {activeTerms.map((term: any) => {
                    const isChecked = !!acceptedTerms[term.id];

                    return (
                      <div key={term.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl animate-in fade-in duration-200">
                        <h4 className="font-bold text-xs text-slate-600 uppercase tracking-wider mb-2">{term.title}</h4>
                        <div className="text-xs text-slate-500 leading-relaxed max-h-24 overflow-y-auto pr-2 space-y-1">
                          <p>{term.content.replace(/{tournament}/g, tournament?.name || "")}</p>
                        </div>
                        <label className="flex items-start gap-3 mt-3 cursor-pointer select-none">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => setAcceptedTerms({ ...acceptedTerms, [term.id]: e.target.checked })}
                            className="mt-1 flex-shrink-0"
                          />
                          <span className="text-xs font-bold text-slate-600">Aceito e assino digitalmente este termo</span>
                        </label>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-6 border-t border-slate-100 flex justify-between">
                  <button 
                    type="button"
                    onClick={() => {
                      if (regConfig.uploads.some((u: any) => u.enabled)) {
                        setCurrentStep("upload");
                      } else {
                        setCurrentStep("form");
                      }
                    }}
                    className="text-slate-500 font-bold hover:bg-slate-50 px-6 rounded-xl transition-colors min-h-[44px]"
                  >
                    Voltar
                  </button>
                  <button 
                    type="button"
                    onClick={handleTermsSubmit}
                    disabled={activeTerms.some((t: any) => t.required && !acceptedTerms[t.id])}
                    className="bg-indigo-600 text-white min-h-[44px] px-8 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-200 cursor-pointer"
                  >
                    {(settings.feeType === "by_team_and_athlete_parent" || (settings.requireMembership && data?.membershipStatus === "pending")) ? "Prosseguir para Pagamento" : "Finalizar Inscrição"}
                  </button>
                </div>
              </div>
            );
          })()}

          {/* STEP 4: RECURRING PAYMENT IF APPLICABLE */}
          {currentStep === "payment" && (
            <div className="space-y-6">
              {(() => {
                const athleteFee = settings.feeType === "by_team_and_athlete_parent" ? (settings.athleteFee || 0) : 0;
                const membershipFee = (settings.requireMembership && data?.membershipStatus === "pending") 
                  ? (data?.organization?.membership_fee_amount || 50) 
                  : 0;
                const totalAmount = athleteFee + membershipFee;

                return (
                  <>
                    <div className="border-b border-indigo-50 pb-4 mb-4">
                      <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <CreditCard size={18} className="text-indigo-600" /> 
                        {membershipFee > 0 && athleteFee > 0 ? "Taxas de Inscrição e Filiação" : 
                         membershipFee > 0 ? "Taxa de Filiação / Anuidade" : "Taxa de Inscrição Individual"}
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-1">
                        {membershipFee > 0 && athleteFee > 0 
                          ? "O pagamento inclui a anuidade de filiação do atleta na liga e a taxa de inscrição do torneio."
                          : membershipFee > 0 
                            ? "Apenas atletas filiados e ativos na liga podem participar dos torneios esportivos promovidos." 
                            : "O organizador configurou a taxa de atleta para pagamento direto pelos responsáveis."}
                      </p>
                    </div>

                    {/* Pricing Display */}
                    <div className="bg-indigo-50/50 rounded-2xl p-5 border border-indigo-100 mb-6 space-y-4">
                      {athleteFee > 0 && (
                        <div className="flex justify-between items-center text-sm font-semibold text-slate-600">
                          <span>Taxa de Inscrição no Torneio:</span>
                          <span className="text-indigo-950 font-bold">R$ {athleteFee.toFixed(2)}</span>
                        </div>
                      )}
                      {membershipFee > 0 && (
                        <div className="flex justify-between items-center text-sm font-semibold text-slate-600">
                          <span>Anuidade/Filiação na Liga ({data?.organization?.name || "Liga"}):</span>
                          <span className="text-indigo-950 font-bold">R$ {membershipFee.toFixed(2)}</span>
                        </div>
                      )}
                      {(athleteFee > 0 && membershipFee > 0) && <div className="border-t border-indigo-100/50 pt-2" />}
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold text-indigo-600 uppercase tracking-wide">Total a Pagar</span>
                          <p className="text-3xl font-extrabold text-indigo-950 mt-1">R$ {totalAmount.toFixed(2)}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block">Beneficiário</span>
                          <span className="text-xs font-bold text-slate-600">Quero Competir Ltda</span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Payment Select */}
              <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200/50 gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("pix")}
                  className={`flex-1 min-h-[40px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === "pix" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <QrCode size={14} /> Pix Copia e Cola
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  className={`flex-1 min-h-[40px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === "card" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <CreditCard size={14} /> Cartão de Crédito
                </button>
              </div>

              {paymentMethod === "pix" ? (
                <div className="space-y-4 text-center">
                  {pixData ? (
                    <div className="space-y-6 flex flex-col items-center py-2 animate-in fade-in duration-300">
                      {/* Interactive animated QR Code Container */}
                      <div className="relative p-4 bg-white rounded-3xl border-2 border-slate-100 shadow-inner group">
                        {/* Scanner Laser effect */}
                        <div className="absolute left-0 right-0 h-0.5 bg-emerald-500 top-1/2 animate-bounce pointer-events-none shadow-[0_0_10px_#10b981]" />
                        <img src={pixData.qrCodeUrl} alt="QR Code Pix" className="w-36 h-36 object-contain shrink-0" />
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
                            onClick={() => {
                              navigator.clipboard.writeText(pixData.qrCode);
                              setCopiedPix(true);
                              setTimeout(() => setCopiedPix(false), 2000);
                            }}
                            className={`px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shrink-0 cursor-pointer ${copiedPix ? "bg-emerald-600 text-white" : "bg-slate-900 text-white hover:bg-slate-800"}`}
                          >
                            {copiedPix ? <Check size={14} /> : <Copy size={14} />}
                            {copiedPix ? "Copiado!" : "Copiar"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-150 max-w-sm mx-auto space-y-2">
                      <QrCode size={40} className="text-slate-400 mx-auto animate-pulse" />
                      <h4 className="font-bold text-slate-700 text-sm">Chave Pix Pendente</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">Clique no botão abaixo para gerar a chave Pix e o QR Code oficial de cobrança junto ao gateway.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Número do Cartão</label>
                      <input 
                        type="text" 
                        placeholder="4444 4444 4444 4444"
                        value={simulatedCard.number}
                        onChange={e => setSimulatedCard({...simulatedCard, number: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Titular (como no Cartão)</label>
                      <input 
                        type="text" 
                        placeholder="Nome do Dono do Cartão"
                        value={simulatedCard.name}
                        onChange={e => setSimulatedCard({...simulatedCard, name: e.target.value})}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold focus:border-indigo-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Expiração</label>
                        <input 
                          type="text" 
                          placeholder="MM/AA"
                          value={simulatedCard.expiry}
                          onChange={e => setSimulatedCard({...simulatedCard, expiry: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-center focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">CVV</label>
                        <input 
                          type="password" 
                          placeholder="123"
                          value={simulatedCard.cvv}
                          onChange={e => setSimulatedCard({...simulatedCard, cvv: e.target.value})}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none text-sm font-semibold text-center focus:border-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-6 border-t border-slate-100 flex justify-between">
                <button 
                  type="button"
                  onClick={() => setCurrentStep("terms")}
                  className="text-slate-500 font-bold hover:bg-slate-50 px-6 rounded-xl transition-colors min-h-[44px]"
                >
                  Voltar
                </button>
                {paymentMethod === "pix" && pixData ? (
                  <button 
                    type="button"
                    onClick={() => handlePay(true)}
                    disabled={isSubmitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white min-h-[44px] px-8 rounded-xl font-bold disabled:opacity-50 transition-colors shadow-lg shadow-emerald-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting ? "Processando..." : "Confirmar Recebimento (Simulado)"}
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={() => handlePay()}
                    disabled={isSubmitting}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white min-h-[44px] px-8 rounded-xl font-bold disabled:opacity-50 transition-colors shadow-lg shadow-indigo-200 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSubmitting ? "Processando..." : (
                      paymentMethod === "pix" ? "Gerar Chave e QR Code Pix" : "Confirmar Pagamento com Cartão"
                    )}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 5: SUCCESS STATE */}
          {currentStep === "success" && (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-emerald-100">
                <FileCheck2 size={36} />
              </div>
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">Inscrição Concluída com Sucesso!</h2>
              <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto">
                As informações obrigatórias foram submetidas eletronicamente. O organizador possui até 24h pós fim das inscrições para validar a documentação.
              </p>

              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 text-left mt-8 max-w-md mx-auto space-y-3">
                <div className="flex justify-between border-b border-slate-200 pb-2.5">
                  <span className="text-xs text-slate-400 font-bold uppercase">Atleta</span>
                  <span className="text-xs font-bold text-slate-700">{subscription.athleteName}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2.5">
                  <span className="text-xs text-slate-400 font-bold uppercase">Modalidade</span>
                  <span className="text-xs font-bold text-slate-700">{category?.name || "Mista"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-200 pb-2.5">
                  <span className="text-xs text-slate-400 font-bold uppercase">Representante</span>
                  <span className="text-xs font-bold text-slate-700">{institution?.name}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-xs text-slate-400 font-bold uppercase">Status Inicial</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-black border ${
                    subscription.validationStatus === "approved"
                      ? "bg-emerald-50 text-emerald-600 border-emerald-200/50"
                      : subscription.validationStatus === "rejected"
                      ? "bg-red-50 text-red-650 border-red-200/50"
                      : "bg-amber-50 text-amber-600 border-amber-200/50"
                  }`}>
                    {subscription.validationStatus === "approved"
                      ? "Aprovado"
                      : subscription.validationStatus === "rejected"
                      ? "Recusado"
                      : "Aguardando Validação"}
                  </span>
                </div>
                {subscription.validationStatus === "rejected" && subscription.validationFeedback && (
                  <div className="p-3 bg-red-50/50 border border-red-100 rounded-xl text-red-700 text-xs mt-2.5 font-medium">
                    <strong className="block mb-1 text-[10px] uppercase tracking-wider font-extrabold text-red-800">Motivo da Recusa:</strong>
                    {subscription.validationFeedback}
                  </div>
                )}
              </div>

              <div className="mt-8">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">Agradecemos sua colaboração de atleta!</p>
                <div className="text-sm font-semibold text-slate-400">
                  Você já pode fechar esta aba com segurança.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
