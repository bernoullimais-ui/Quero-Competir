import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { 
  Trophy, 
  Settings, 
  Users, 
  ListChecks, 
  LayoutGrid, 
  ChevronLeft,
  Calendar,
  MapPin,
  Plus,
  Activity,
  Trash2,
  X,
  BarChart3,
  Timer,
  ExternalLink,
  Copy,
  CheckCircle2, Shield, AlertCircle,
  Eye, Download, FileText,
  Dribbble, Swords, Waves, Footprints, Crown, Target, Zap,
  Sparkles, Share2,
  Play, SkipForward, RefreshCw,
  DollarSign, CreditCard, QrCode, ArrowRight, Loader2
} from "lucide-react";
import { supabase } from "../lib/supabaseClient.ts";

export const getSportIcon = (sportName: string, size = 24) => {
  const name = (sportName || "").toLowerCase();
  if (name.includes("futsal") || name.includes("futebol") || name.includes("soccer") || name.includes("campo")) {
    return <Footprints className="text-emerald-500" size={size} />;
  }
  if (name.includes("basquete") || name.includes("basketball")) {
    return <Dribbble className="text-orange-500" size={size} />;
  }
  if (name.includes("volei") || name.includes("vôlei") || name.includes("volleyball")) {
    return <Waves className="text-blue-500" size={size} />;
  }
  if (name.includes("handebol") || name.includes("handball")) {
    return <Activity className="text-indigo-500" size={size} />;
  }
  if (name.includes("judo") || name.includes("judô") || name.includes("karate") || name.includes("karatê") || name.includes("luta") || name.includes("marcial") || name.includes("combate")) {
    return <Swords className="text-rose-500" size={size} />;
  }
  if (name.includes("natacao") || name.includes("natação") || name.includes("piscina")) {
    return <Waves className="text-sky-500" size={size} />;
  }
  if (name.includes("tenis") || name.includes("tênis") || name.includes("ping") || name.includes("beach")) {
    return <Target className="text-lime-500" size={size} />;
  }
  if (name.includes("atletismo") || name.includes("corrida") || name.includes("run") || name.includes("velocidade")) {
    return <Zap className="text-amber-500" size={size} />;
  }
  if (name.includes("xadrez") || name.includes("chess")) {
    return <Crown className="text-yellow-600" size={size} />;
  }
  if (name.includes("baleado") || name.includes("queimada") || name.includes("dodgeball")) {
    return <Target className="text-orange-600" size={size} />;
  }
  return <Trophy className="text-indigo-600" size={size} />;
};

export const getSportBgClass = (sportName: string) => {
  const name = (sportName || "").toLowerCase();
  if (name.includes("futsal") || name.includes("futebol") || name.includes("soccer") || name.includes("campo")) {
    return "bg-emerald-50 border border-emerald-100/50";
  }
  if (name.includes("basquete") || name.includes("basketball")) {
    return "bg-orange-50 border border-orange-100/50";
  }
  if (name.includes("volei") || name.includes("vôlei") || name.includes("volleyball")) {
    return "bg-blue-50 border border-blue-100/50";
  }
  if (name.includes("handebol") || name.includes("handball")) {
    return "bg-indigo-50 border border-indigo-100/50";
  }
  if (name.includes("judo") || name.includes("judô") || name.includes("karate") || name.includes("karatê") || name.includes("luta") || name.includes("marcial") || name.includes("combate")) {
    return "bg-rose-50 border border-rose-100/50";
  }
  if (name.includes("natacao") || name.includes("natação") || name.includes("piscina")) {
    return "bg-sky-50 border border-sky-100/50";
  }
  if (name.includes("tenis") || name.includes("tênis") || name.includes("ping") || name.includes("beach")) {
    return "bg-lime-50 border border-lime-100/50";
  }
  if (name.includes("atletismo") || name.includes("corrida") || name.includes("run") || name.includes("velocidade")) {
    return "bg-amber-50 border border-amber-100/50";
  }
  if (name.includes("xadrez") || name.includes("chess")) {
    return "bg-yellow-50 border border-yellow-101";
  }
  if (name.includes("baleado") || name.includes("queimada") || name.includes("dodgeball")) {
    return "bg-orange-50 border border-orange-100/50";
  }
  return "bg-indigo-50 border border-indigo-100/50";
};
import { useQuery } from '@tanstack/react-query';
import { ErrorBoundary } from "react-error-boundary";
import AthleteEnrollmentModal from "./AthleteEnrollmentModal.tsx";
import LiveMatchRoom from "./LiveMatchRoom.tsx";
import TournamentScheduler from "./TournamentScheduler.tsx";
import TournamentStats from "./TournamentStats.tsx";
import TournamentClassification from "./TournamentClassification.tsx";
import TournamentCommunity from "./TournamentCommunity.tsx";
import { TrendingUp, MessageSquare } from "lucide-react";
import { useToast } from "./ui/Toast.tsx";
import { useConfirm } from "./ui/ConfirmDialog.tsx";
import CategoriesTab from "./CategoriesTab.tsx";
import SubscriptionsTab from "./SubscriptionsTab.tsx";
import TournamentSettingsTab from "./TournamentSettingsTab.tsx";
import MatchModal from "./MatchModal.tsx";

// Description comment parser for saving customizable image gallery and banner without schema changes
interface ParsedDesc {
  description: string;
  photos: string[];
  bannerUrl: string;
}

function parseDescription(raw?: string): ParsedDesc {
  if (!raw) return { description: "", photos: [], bannerUrl: "" };
  let description = raw;
  let photos: string[] = [];
  let bannerUrl = "";

  const photosRegex = /<!--OFFICIAL_PHOTOS:(.*?)-->/;
  const photosMatch = description.match(photosRegex);
  if (photosMatch) {
    description = description.replace(photosRegex, "").trim();
    photos = photosMatch[1].split(",").map(u => u.trim()).filter(Boolean);
  }

  const bannerRegex = /<!--BANNER_URL:(.*?)-->/;
  const bannerMatch = description.match(bannerRegex);
  if (bannerMatch) {
    description = description.replace(bannerRegex, "").trim();
    bannerUrl = bannerMatch[1].trim();
  }

  return { description, photos, bannerUrl };
}

function buildDescription(cleanDesc: string, photos: string[], bannerUrl: string): string {
  let result = cleanDesc.trim();
  const filtered = photos.map(p => p.trim()).filter(Boolean);
  if (filtered.length > 0) {
    result += `\n\n<!--OFFICIAL_PHOTOS:${filtered.join(",")}-->`;
  }
  if (bannerUrl.trim()) {
    result += `\n\n<!--BANNER_URL:${bannerUrl.trim()}-->`;
  }
  return result;
}

const formatCurrency = (val: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
};

type Tab = "geral" | "modalidades" | "inscricoes" | "financeiro" | "configuracoes" | "tabela" | "escala" | "arbitragem" | "estatisticas" | "classificacao" | "comunidade";

const parseLocalTime = (scheduledTime: string) => {
  const regexMatch = scheduledTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!regexMatch) return null;
  const [_, year, month, day, hour, minute] = regexMatch;
  return new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10)
  );
};

export default function TournamentDashboard() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError, warning: toastWarning, info: toastInfo } = useToast();
  const { confirm } = useConfirm();
  const { data: tournament, isLoading: tLoading, refetch: refetchTournament } = useQuery({
    queryKey: ['tournament', id],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${id}`);
      return res.json();
    }
  });

  const { data: categories = [], isLoading: cLoading, refetch: refreshCategories } = useQuery({
    queryKey: ['tournament_categories', id],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${id}/categories`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  const { data: registrations = [], isLoading: rLoading, refetch: refreshSummary } = useQuery({
    queryKey: ['tournament_registrations', id],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${id}/registrations/summary`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  const { data: athleteSubs = [], refetch: refreshAthleteSubs } = useQuery({
    queryKey: ['athlete_subscriptions', id],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${id}/athlete-subscriptions`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  const { data: subSettings, refetch: refreshSubSettings } = useQuery({
    queryKey: ['subscription_settings', id],
    queryFn: async () => {
      const res = await fetch(`/api/tournaments/${id}/subscription-settings`);
      const data = await res.json();
      return data && !data.error ? data : null;
    }
  });

  const { data: paymentLinks = [], refetch: refreshPaymentLinks } = useQuery({
    queryKey: ['institution_payments', id],
    queryFn: async () => {
      const savedUser = localStorage.getItem("currentUser");
      let h: any = {};
      if (savedUser) {
        try {
          const u = JSON.parse(savedUser);
          if (u && u.token) h["Authorization"] = `Bearer ${u.token}`;
        } catch(e){}
      }
      const res = await fetch(`/api/institutions/payments/tournament/${id}`, { headers: h });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  const { data: institutions = [] } = useQuery({
    queryKey: ['institutions'],
    queryFn: async () => {
      const savedUser = localStorage.getItem("currentUser");
      let h: any = {};
      if (savedUser) {
        try {
          const u = JSON.parse(savedUser);
          if (u && u.token) h["Authorization"] = `Bearer ${u.token}`;
          if (u && u.id) h["x-organizer-id"] = u.id;
        } catch(e){}
      }
      const res = await fetch(`/api/institutions`, { headers: h });
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });

  const loading = tLoading || cLoading || rLoading;
  const [activeTab, setActiveTab] = useState<Tab>("geral");
  const [selectedInstFilter, setSelectedInstFilter] = useState<string>("");
  const [showPayLinkModal, setShowPayLinkModal] = useState(false);
  const [selectedRegForLink, setSelectedRegForLink] = useState<any>(null);
  const [payLinkDeadline, setPayLinkDeadline] = useState("");
  const [payLinkMethods, setPayLinkMethods] = useState({ pix: true, boleto: true, card: true });
  const [generatingLink, setGeneratingLink] = useState(false);
  const [isEditingTournament, setIsEditingTournament] = useState(false);
  const [editForm, setEditForm] = useState({ 
    name: "", 
    description: "", 
    start_date: "", 
    end_date: "", 
    logo_url: "",
    banner_url: "",
    photos: [] as string[]
  });
  const [savingTournament, setSavingTournament] = useState(false);

  useEffect(() => {
    if (tournament) {
      const parsed = parseDescription(tournament.description || "");
      // Always pre-populate 5 empty photo fields
      const initialPhotos = [...parsed.photos, "", "", "", "", ""].slice(0, 5);
      setEditForm({
        name: tournament.name || "",
        description: parsed.description || "",
        start_date: tournament.start_date ? tournament.start_date.split("T")[0] : "",
        end_date: tournament.end_date ? tournament.end_date.split("T")[0] : "",
        logo_url: tournament.logo_url || "",
        banner_url: parsed.bannerUrl || "",
        photos: initialPhotos
      });
    }
  }, [tournament]);

  const handlePhotoChange = (index: number, val: string) => {
    const updated = [...editForm.photos];
    updated[index] = val;
    setEditForm({ ...editForm, photos: updated });
  };

  const handleSaveTournamentDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTournament(true);
    try {
      const finalDesc = buildDescription(editForm.description, editForm.photos, editForm.banner_url);
      const res = await fetch(`/api/tournaments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name,
          description: finalDesc,
          start_date: editForm.start_date,
          end_date: editForm.end_date,
          logo_url: editForm.logo_url
        })
      });
      if (res.ok) {
        setIsEditingTournament(false);
        refetchTournament();
      } else {
        const err = await res.json();
        toastError(err.error || "Erro ao atualizar dados do torneio.");
      }
    } catch (err: any) {
      console.error(err);
      toastError("Erro de conexão ao salvar dados do torneio.");
    } finally {
      setSavingTournament(false);
    }
  };

  const [copiedLink, setCopiedLink] = useState(false);

  const [selectedCatForBracket, setSelectedCatForBracket] = useState<any>(null);
  const [bracketMatches, setBracketMatches] = useState<any[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [manualWinner, setManualWinner] = useState<string | null | undefined>(undefined);
  const [disputeSystem, setDisputeSystem] = useState<"single" | "groups" | "group_vs_group">("single");
  const [groupCount, setGroupCount] = useState(1);
  const [seeds, setSeeds] = useState<string[]>([]);
  const [teamsInCategory, setTeamsInCategory] = useState<any[]>([]);
  const [liveMatchId, setLiveMatchId] = useState<string | null>(null);
  const [selectedSubdivision, setSelectedSubdivision] = useState<string>("");

  const [publicState, setPublicState] = useState<{
    status: 'idle' | 'drawing' | 'revealing' | 'placing' | 'completed';
    currentStepIndex: number;
    drawnCount: number;
    totalCount: number;
    autoPlay: boolean;
  } | null>(null);
  const [publicConnected, setPublicConnected] = useState(false);
  
  const connectionTimeoutRef = useRef<any>(null);
  const drawChannelRef = useRef<any>(null);

  // Ref for publicState to access the latest state in the realtime event handler
  const publicStateRef = useRef<any>(null);
  useEffect(() => {
    publicStateRef.current = publicState;
  }, [publicState]);

  useEffect(() => {
    if (connectionTimeoutRef.current) {
      clearTimeout(connectionTimeoutRef.current);
    }
    setPublicConnected(false);
    setPublicState(null);

    if (!selectedCatForBracket?.id) {
      drawChannelRef.current = null;
      return;
    }

    const channelId = `draw_ceremony_${selectedCatForBracket.id}`;
    const channel = supabase.channel(channelId);
    drawChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'public_state' }, ({ payload }) => {
        setPublicConnected(true);
        setPublicState(payload);

        if (connectionTimeoutRef.current) {
          clearTimeout(connectionTimeoutRef.current);
        }
        connectionTimeoutRef.current = setTimeout(() => {
          setPublicConnected(false);
        }, 4500);
      })
      .on('broadcast', { event: 'request_state' }, () => {
        // Reply with our latest known public state if we have one
        if (publicStateRef.current) {
          channel.send({
            type: 'broadcast',
            event: 'public_state',
            payload: publicStateRef.current
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      drawChannelRef.current = null;
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
      }
    };
  }, [selectedCatForBracket?.id]);

  const sendOrganizerAction = (action: 'start' | 'next' | 'skip' | 'reset' | 'toggle_autoplay') => {
    if (drawChannelRef.current) {
      drawChannelRef.current.send({
        type: 'broadcast',
        event: 'organizer_action',
        payload: { action }
      });
    }
  };

  const getSubdivisions = (cat: any) => {
    if (!cat || cat.rules_config?.sport_type !== "combat") return [];
    const ages = cat.rules_config?.ages || [];
    const graduations = cat.rules_config?.graduations || [];
    const weights = cat.rules_config?.weights || [];

    const list: string[] = [];
    if (ages.length === 0 && graduations.length === 0 && weights.length === 0) {
      return ["Geral"];
    }

    const activeAges = ages.length > 0 ? ages : [""];
    const activeGrads = graduations.length > 0 ? graduations : [""];
    const activeWeights = weights.length > 0 ? weights : [""];

    for (const age of activeAges) {
      for (const grad of activeGrads) {
        for (const wt of activeWeights) {
          const parts = [age, grad, wt].filter(Boolean);
          list.push(parts.join(" - "));
        }
      }
    }
    return list;
  };

  const getSubdivisionCounts = (catId: string) => {
    const counts: Record<string, number> = {};
    const categoryApprovedSubs = athleteSubs.filter(
      (sub: any) => sub.categoryId === catId && sub.validationStatus === "approved"
    );
    
    categoryApprovedSubs.forEach((sub: any) => {
      const age = sub.additionalData?.age_group || "";
      const grad = sub.additionalData?.graduation || "";
      const wt = sub.additionalData?.weight_class || "";
      const label = `${age} - ${grad} - ${wt}`;
      counts[label] = (counts[label] || 0) + 1;
    });
    
    return counts;
  };

  const [activePhaseIndex, setActivePhaseIndex] = useState(1);
  const [usePhases, setUsePhases] = useState(false);
  const [configuredPhases, setConfiguredPhases] = useState<any[]>([
    { name: "1ª Fase - Eliminatórias", system: "single", groupCount: 1, seeds: [] },
    { name: "2ª Fase - Grupos", system: "groups", groupCount: 2, seeds: [] }
  ]);
  const [selectedTeamsForPhase, setSelectedTeamsForPhase] = useState<string[]>([]);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  const [team1Members, setTeam1Members] = useState<any[]>([]);
  const [team2Members, setTeam2Members] = useState<any[]>([]);
  const [roster1, setRoster1] = useState<Record<string, { jerseyNumber?: string, isCaptain?: boolean }>>({});
  const [roster2, setRoster2] = useState<Record<string, { jerseyNumber?: string, isCaptain?: boolean }>>({});
  const [showRosterConfig, setShowRosterConfig] = useState<1 | 2 | null>(null);

  useEffect(() => {
    if (selectedMatch && showMatchModal) {
      setRoster1(selectedMatch.roster1 || {});
      setRoster2(selectedMatch.roster2 || {});
      if(selectedMatch.team1_id) {
        fetch(`/api/tournaments/teams/${selectedMatch.team1_id}/athletes`)
          .then(r => r.json())
          .then(data => setTeam1Members(data));
      } else {
        setTeam1Members([]);
      }
      if(selectedMatch.team2_id) {
        fetch(`/api/tournaments/teams/${selectedMatch.team2_id}/athletes`)
          .then(r => r.json())
          .then(data => setTeam2Members(data));
      } else {
        setTeam2Members([]);
      }
    }
  }, [selectedMatch, showMatchModal]);

  const fetchTeamsInCategory = async () => {
    if (!selectedCatForBracket) return;
    try {
      const res = await fetch(`/api/tournaments/${id}/categories/${selectedCatForBracket.id}/teams`);
      const data = await res.json();
      setTeamsInCategory(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (selectedCatForBracket) {
      fetchTeamsInCategory();
      setSeeds([]);
      setActivePhaseIndex(1); // Reset phase index when switching categories

      const categoryPhases = selectedCatForBracket.rules_config?.phases;
      if (Array.isArray(categoryPhases) && categoryPhases.length > 0) {
        setConfiguredPhases(categoryPhases.map((p: any) => ({
          name: p.name || "",
          system: p.system || "single",
          groupCount: p.groupCount || 1,
          seeds: p.seeds || []
        })));
        setUsePhases(categoryPhases.length > 1);
      } else {
        setConfiguredPhases([
          { name: "1ª Fase - Eliminatórias", system: "single", groupCount: 1, seeds: [] },
          { name: "2ª Fase - Grupos", system: "groups", groupCount: 2, seeds: [] }
        ]);
        setUsePhases(false);
      }
    }
  }, [selectedCatForBracket]);

  useEffect(() => {
    if (selectedCatForBracket && selectedCatForBracket.rules_config?.sport_type === "combat") {
      const subsList = getSubdivisions(selectedCatForBracket);
      const categoryApprovedSubs = athleteSubs.filter(
        (sub: any) => sub.categoryId === selectedCatForBracket.id && sub.validationStatus === "approved"
      );
      
      const subWithAthletes = subsList.find((subName: string) => 
        categoryApprovedSubs.some((sub: any) => {
          const age = sub.additionalData?.age_group || "";
          const grad = sub.additionalData?.graduation || "";
          const wt = sub.additionalData?.weight_class || "";
          const label = `${age} - ${grad} - ${wt}`;
          return label === subName;
        })
      );
      
      setSelectedSubdivision(subWithAthletes || subsList[0] || "");
    } else {
      setSelectedSubdivision("");
    }
  }, [selectedCatForBracket, athleteSubs]);



  const fetchMatches = async () => {
    if (!selectedCatForBracket) return;
    setLoadingMatches(true);
    try {
      const res = await fetch(`/api/tournaments/${id}/categories/${selectedCatForBracket.id}/matches`);
      const data = await res.json();
      setBracketMatches(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    if (activeTab === "tabela" && selectedCatForBracket) {
      fetchMatches();
    }
  }, [selectedCatForBracket, activeTab]);

  const toggleStatus = async () => {
    if (!tournament) return;
    const newStatus = tournament.status === 'active' ? 'draft' : 'active';
    try {
      const res = await fetch(`/api/tournaments/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        refetchTournament();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const generateBracket = async () => {
    if (!selectedCatForBracket) return;
    setLoadingMatches(true);
    try {
      if (usePhases) {
        const updatedRules = { 
          ...selectedCatForBracket.rules_config, 
          phases: configuredPhases 
        };
        const patchRes = await fetch(`/api/tournaments/categories/${selectedCatForBracket.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rules_config: updatedRules })
        });
        if (!patchRes.ok) {
          throw new Error("Erro ao salvar configuração de fases.");
        }
        
        selectedCatForBracket.rules_config = updatedRules;
      }

      const payload: any = usePhases ? {
        system: configuredPhases[0].system,
        groupCount: configuredPhases[0].groupCount,
        seeds: configuredPhases[0].seeds || [],
        phase_index: 1,
        phase_name: configuredPhases[0].name,
        ...(selectedCatForBracket?.rules_config?.sport_type === "combat" && selectedSubdivision ? { group_label: selectedSubdivision } : {})
      } : {
        system: disputeSystem,
        groupCount,
        seeds,
        phase_index: 1,
        phase_name: "Fase Única",
        ...(selectedCatForBracket?.rules_config?.sport_type === "combat" && selectedSubdivision ? { group_label: selectedSubdivision } : {})
      };

      const res = await fetch(`/api/tournaments/${id}/categories/${selectedCatForBracket.id}/matches/generate`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setActivePhaseIndex(1);
        fetchMatches();
      } else {
        const err = await res.json();
        toastError(err.error || "Erro ao gerar chaveamento.");
      }
    } catch (err: any) {
      console.error(err);
      toastError(err.message || "Erro de conexão.");
    } finally {
      setLoadingMatches(false);
    }
  };

  const executeReset = async (phaseIndex?: number) => {
    if (!selectedCatForBracket) return;
    setLoadingMatches(true);
    try {
      const isCombat = selectedCatForBracket?.rules_config?.sport_type === "combat";
      const params = new URLSearchParams();
      if (phaseIndex !== undefined) {
        params.append("phase_index", phaseIndex.toString());
      }
      if (isCombat && selectedSubdivision) {
        params.append("group_label", selectedSubdivision);
      }
        
      const url = `/api/tournaments/${id}/categories/${selectedCatForBracket.id}/matches?${params.toString()}`;
      const res = await fetch(url, { 
        method: "DELETE"
      });
      if (res.ok) {
        if (phaseIndex === undefined && !(isCombat && selectedSubdivision)) {
          // Reset rules_config.phases on the server as well
          const updatedRules = { 
            ...selectedCatForBracket.rules_config, 
            phases: null 
          };
          const patchRes = await fetch(`/api/tournaments/categories/${selectedCatForBracket.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rules_config: updatedRules })
          });
          if (patchRes.ok) {
            selectedCatForBracket.rules_config = updatedRules;
            // Reset local states
            setUsePhases(false);
            setConfiguredPhases([
              { name: "1ª Fase - Eliminatórias", system: "single", groupCount: 1, seeds: [] },
              { name: "2ª Fase - Grupos", system: "groups", groupCount: 2, seeds: [] }
            ]);
            setSeeds([]);
            setDisputeSystem("single");
            setGroupCount(1);
            setActivePhaseIndex(1);
          }
        }
        toastSuccess("Chaveamento resetado com sucesso!");
        fetchMatches();
      } else {
        toastError("Erro ao resetar chaveamento.");
      }
    } catch (err) {
      console.error(err);
      toastError("Erro ao resetar chaveamento.");
    } finally {
      setLoadingMatches(false);
    }
  };

  const resetBracket = async () => {
    if (!selectedCatForBracket) return;
    
    const isCombat = selectedCatForBracket?.rules_config?.sport_type === "combat";
    
    if (selectedCatForBracket?.rules_config?.phases && selectedCatForBracket.rules_config.phases.length > 1) {
      setResetModalOpen(true);
      return;
    }
    
    const message = isCombat && selectedSubdivision
      ? `Tem certeza que deseja resetar o chaveamento da subdivisão "${selectedSubdivision}"? Esta ação não pode ser desfeita.`
      : "Tem certeza que deseja resetar todo o chaveamento? Esta ação não pode ser desfeita.";
      
    const isConfirmed = await confirm({
      title: "Resetar Chaveamento",
      message,
      variant: "danger",
      confirmText: "Resetar",
      cancelText: "Cancelar"
    });
    if (isConfirmed) {
      executeReset(undefined);
    }
  };

  const getSuggestedTeamsForNextPhase = () => {
    const isCombat = selectedCatForBracket?.rules_config?.sport_type === "combat";
    const prevPhaseMatches = bracketMatches.filter(m => {
      const isPrevPhase = (m.phase_index || 1) === activePhaseIndex - 1;
      if (!isPrevPhase) return false;
      if (isCombat && selectedSubdivision) {
        return m.group_label === selectedSubdivision || m.group_label?.startsWith(`${selectedSubdivision} - `);
      }
      return true;
    });
    if (prevPhaseMatches.length === 0) return [];
    
    const groups: Record<string, any[]> = {};
    prevPhaseMatches.forEach(m => {
      if (m.group_label) {
        if (!groups[m.group_label]) groups[m.group_label] = [];
        groups[m.group_label].push(m);
      }
    });
    
    const suggestedIds: string[] = [];
    Object.entries(groups).forEach(([label, groupMatches]) => {
      const displayLabel = isCombat && selectedSubdivision && label.startsWith(`${selectedSubdivision} - `)
        ? label.substring(selectedSubdivision.length + 3)
        : label;

      const delimiterRegex = /\s+[xX]\s+/;
      if (delimiterRegex.test(displayLabel)) {
        const parts = displayLabel.split(delimiterRegex);
        const leftName = parts[0].trim();
        const rightName = parts[1].trim();

        const leftTeamIds = isCombat
          ? new Set(groupMatches.map(m => m.roster1?.athlete_id).filter(Boolean))
          : new Set(groupMatches.map(m => m.team1_id).filter(Boolean));

        const rightTeamIds = isCombat
          ? new Set(groupMatches.map(m => m.roster2?.athlete_id).filter(Boolean))
          : new Set(groupMatches.map(m => m.team2_id).filter(Boolean));

        const standings = calculateStandings(groupMatches);
        
        // Pick top 2 of Group A (left) and top 2 of Group B (right)
        standings.filter(t => leftTeamIds.has(t.id)).slice(0, 2).forEach(t => suggestedIds.push(t.id));
        standings.filter(t => rightTeamIds.has(t.id)).slice(0, 2).forEach(t => suggestedIds.push(t.id));
      } else {
        const standings = calculateStandings(groupMatches);
        standings.slice(0, 2).forEach(t => suggestedIds.push(t.id));
      }
    });
    
    return suggestedIds;
  };

  const getPrevPhaseStandingsMap = () => {
    const isCombat = selectedCatForBracket?.rules_config?.sport_type === "combat";
    const prevPhaseMatches = bracketMatches.filter(m => {
      const isPrevPhase = (m.phase_index || 1) === activePhaseIndex - 1;
      if (!isPrevPhase) return false;
      if (isCombat && selectedSubdivision) {
        return m.group_label === selectedSubdivision || m.group_label?.startsWith(`${selectedSubdivision} - `);
      }
      return true;
    });
    const standingsMap: Record<string, string> = {};
    
    const groups: Record<string, any[]> = {};
    prevPhaseMatches.forEach(m => {
      if (m.group_label) {
        if (!groups[m.group_label]) groups[m.group_label] = [];
        groups[m.group_label].push(m);
      }
    });
    
    if (Object.keys(groups).length > 0) {
      Object.entries(groups).forEach(([label, groupMatches]) => {
        const displayLabel = isCombat && selectedSubdivision && label.startsWith(`${selectedSubdivision} - `)
          ? label.substring(selectedSubdivision.length + 3)
          : label;

        const delimiterRegex = /\s+[xX]\s+/;
        if (delimiterRegex.test(displayLabel)) {
          const parts = displayLabel.split(delimiterRegex);
          const leftName = parts[0].trim();
          const rightName = parts[1].trim();

          const leftTeamIds = isCombat
            ? new Set(groupMatches.map(m => m.roster1?.athlete_id).filter(Boolean))
            : new Set(groupMatches.map(m => m.team1_id).filter(Boolean));

          const rightTeamIds = isCombat
            ? new Set(groupMatches.map(m => m.roster2?.athlete_id).filter(Boolean))
            : new Set(groupMatches.map(m => m.team2_id).filter(Boolean));

          const standings = calculateStandings(groupMatches);
          
          // Left Group
          const leftStandings = standings.filter(t => leftTeamIds.has(t.id));
          leftStandings.forEach((t, idx) => {
            standingsMap[t.id] = `${idx + 1}º Lugar (Grupo ${leftName})`;
          });

          // Right Group
          const rightStandings = standings.filter(t => rightTeamIds.has(t.id));
          rightStandings.forEach((t, idx) => {
            standingsMap[t.id] = `${idx + 1}º Lugar (Grupo ${rightName})`;
          });
        } else {
          const standings = calculateStandings(groupMatches);
          standings.forEach((t, idx) => {
            standingsMap[t.id] = `${idx + 1}º Lugar (Grupo ${displayLabel})`;
          });
        }
      });
    }
    return standingsMap;
  };

  useEffect(() => {
    if (activePhaseIndex > 1 && selectedCatForBracket?.rules_config?.phases) {
      const suggested = getSuggestedTeamsForNextPhase();
      setSelectedTeamsForPhase(suggested);
    } else {
      setSelectedTeamsForPhase([]);
    }
  }, [activePhaseIndex, selectedCatForBracket, bracketMatches]);

  const generateSubsequentPhase = async () => {
    if (!selectedCatForBracket || !selectedCatForBracket.rules_config?.phases) return;
    const currentPhase = selectedCatForBracket.rules_config.phases[activePhaseIndex - 1];
    if (!currentPhase) return;
    
    if (selectedTeamsForPhase.length < 2) {
      toastError("Selecione pelo menos 2 competidores para gerar a fase.");
      return;
    }
    
    setLoadingMatches(true);
    try {
      const res = await fetch(`/api/tournaments/${id}/categories/${selectedCatForBracket.id}/matches/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: currentPhase.system,
          groupCount: currentPhase.groupCount || 1,
          seeds: currentPhase.seeds || [],
          phase_index: activePhaseIndex,
          phase_name: currentPhase.name,
          team_ids: selectedTeamsForPhase,
          ...(selectedCatForBracket?.rules_config?.sport_type === "combat" && selectedSubdivision ? { group_label: selectedSubdivision } : {})
        })
      });
      if (res.ok) {
        toastSuccess(`Partidas da fase "${currentPhase.name}" geradas com sucesso!`);
        fetchMatches();
      } else {
        const err = await res.json();
        toastError(err.error || "Erro ao gerar fase.");
      }
    } catch (err) {
      console.error(err);
      toastError("Erro ao conectar com o servidor.");
    } finally {
      setLoadingMatches(false);
    }
  };



  const calculateStandings = (matches: any[]) => {
    const teamsMap: Record<string, any> = {};
    const isCombat = selectedCatForBracket?.rules_config?.sport_type === "combat";

    matches.forEach(match => {
      const c1Id = isCombat ? match.roster1?.athlete_id : match.team1_id;
      const c2Id = isCombat ? match.roster2?.athlete_id : match.team2_id;

      if (!c1Id || !c2Id) return;

      [c1Id, c2Id].forEach(id => {
        if (!teamsMap[id]) {
          const isC1 = id === c1Id;
          const name = isCombat 
            ? (isC1 ? `${match.roster1?.athlete_name} (${match.roster1?.institution_name})` : `${match.roster2?.athlete_name} (${match.roster2?.institution_name})`)
            : (isC1 ? match.team1?.institution?.name : match.team2?.institution?.name) || "Sem Nome";

          teamsMap[id] = {
            id,
            name,
            points: 0,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            sg: 0
          };
        }
      });

      if (match.status === "finished") {
        const t1 = teamsMap[c1Id];
        const t2 = teamsMap[c2Id];

        t1.played++;
        t2.played++;
        t1.goalsFor += match.score1 || 0;
        t1.goalsAgainst += match.score2 || 0;
        t2.goalsFor += match.score2 || 0;
        t2.goalsAgainst += match.score1 || 0;

        if (match.score1 > match.score2) {
          t1.points += 3;
          t1.wins++;
          t2.losses++;
        } else if (match.score2 > match.score1) {
          t2.points += 3;
          t2.wins++;
          t1.losses++;
        } else {
          t1.points += 1;
          t2.points += 1;
          t1.draws++;
          t2.draws++;
        }
        
        t1.sg = t1.goalsFor - t1.goalsAgainst;
        t2.sg = t2.goalsFor - t2.goalsAgainst;
      }
    });

    return Object.values(teamsMap).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.sg !== a.sg) return b.sg - a.sg;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.goalsFor - a.goalsFor;
    });
  };

  const ParticipationTable = ({ 
    matches, 
    title = "Classificação Provisória",
    filterTeamIds
  }: { 
    matches: any[], 
    title?: string,
    filterTeamIds?: string[]
  }) => {
    let standings = calculateStandings(matches);
    if (filterTeamIds) {
      standings = standings.filter(t => filterTeamIds.includes(t.id));
    }
    if (standings.length === 0) return null;

    return (
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden mb-8">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-100">
          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <ListChecks size={16} className="text-indigo-600" />
            {title}
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4 w-12 text-center">Pos</th>
                <th className="px-6 py-4 min-w-[200px]">Equipe</th>
                <th className="px-4 py-4 text-center">P</th>
                <th className="px-4 py-4 text-center">J</th>
                <th className="px-4 py-4 text-center">V</th>
                <th className="px-4 py-4 text-center">E</th>
                <th className="px-4 py-4 text-center">D</th>
                <th className="px-4 py-4 text-center">GP</th>
                <th className="px-4 py-4 text-center">GC</th>
                <th className="px-4 py-4 text-center">SG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {standings.map((team, idx) => (
                <tr key={team.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-center">
                    <span className={`w-6 h-6 inline-flex items-center justify-center rounded-md text-[10px] font-black ${
                      idx === 0 ? "bg-amber-100 text-amber-700" : 
                      idx === 1 ? "bg-slate-200 text-slate-700" :
                      idx === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-50 text-slate-400"
                    }`}>
                      {idx + 1}º
                    </span>
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-700">{team.name}</td>
                  <td className="px-4 py-4 text-center font-black text-indigo-600 bg-indigo-50/30">{team.points}</td>
                  <td className="px-4 py-4 text-center font-medium">{team.played}</td>
                  <td className="px-4 py-4 text-center text-emerald-600">{team.wins}</td>
                  <td className="px-4 py-4 text-center text-slate-400">{team.draws}</td>
                  <td className="px-4 py-4 text-center text-red-400">{team.losses}</td>
                  <td className="px-4 py-4 text-center font-medium text-slate-500">{team.goalsFor}</td>
                  <td className="px-4 py-4 text-center font-medium text-slate-500">{team.goalsAgainst}</td>
                  <td className={`px-4 py-4 text-center font-bold ${team.sg > 0 ? "text-emerald-600" : team.sg < 0 ? "text-red-600" : "text-slate-400"}`}>
                    {team.sg > 0 ? `+${team.sg}` : team.sg}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (liveMatchId) return (
    <LiveMatchRoom 
      matchId={liveMatchId} 
      onBack={() => setLiveMatchId(null)} 
      onUpdatePlacar={() => {
        fetchMatches();
      }}
      onNextMatch={(nextId) => {
        const nextMatchObj = bracketMatches.find((m: any) => m.id === nextId);
        setLiveMatchId(null);
        if (nextMatchObj) {
          setSelectedMatch(nextMatchObj);
          setShowMatchModal(true);
        } else {
          setLiveMatchId(nextId);
        }
      }}
    />
  );

  const handleToggleRegStatus = async (regId: string, currentStatus: string) => {
    const newStatus = currentStatus === "confirmed" ? "pending" : "confirmed";
    try {
      const res = await fetch(`/api/tournaments/${id}/registrations/${regId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        toastSuccess("Status de pagamento da instituição atualizado!");
        refreshSummary();
      } else {
        toastError("Erro ao atualizar status de pagamento.");
      }
    } catch (err) {
      toastError("Erro ao conectar com o servidor.");
    }
  };

  const handleToggleAthletePayment = async (subId: string, currentStatus: string) => {
    const newStatus = currentStatus === "paid" ? "pending" : "paid";
    try {
      const res = await fetch(`/api/tournaments/${id}/athlete-subscriptions/${subId}/payment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: newStatus })
      });
      if (res.ok) {
        toastSuccess("Status de pagamento do atleta atualizado!");
        refreshAthleteSubs();
      } else {
        toastError("Erro ao atualizar status de pagamento.");
      }
    } catch (err) {
      toastError("Erro ao conectar com o servidor.");
    }
  };

  const handleGeneratePaymentLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegForLink) return;

    // Sempre permite todos os métodos para escolha do pagador
    const allowedMethods = ["pix", "boleto", "card"];

    if (!payLinkDeadline) {
      toastWarning("Defina uma data limite para o pagamento.");
      return;
    }

    setGeneratingLink(true);

    try {
      const savedUser = localStorage.getItem("currentUser");
      const headers: any = { "Content-Type": "application/json" };
      if (savedUser) {
        try {
          const u = JSON.parse(savedUser);
          if (u && u.token) headers["Authorization"] = `Bearer ${u.token}`;
        } catch(e){}
      }

      const dueAmount = (subSettings?.teamFee || 0) * (selectedRegForLink.modalityCount || 0);

      const res = await fetch("/api/institutions/payments/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          tournamentId: id,
          institutionId: selectedRegForLink.institution_id,
          amount: dueAmount,
          deadline: payLinkDeadline,
          allowedMethods
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toastSuccess("Link de pagamento gerado com sucesso!");
        refreshPaymentLinks();
        setShowPayLinkModal(false);
      } else {
        toastError(data.error || "Erro ao gerar link de pagamento.");
      }
    } catch (err) {
      toastError("Erro ao comunicar com o servidor.");
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyPaymentLink = (payId: string) => {
    const link = `${window.location.origin}/pay/institution/${payId}`;
    navigator.clipboard.writeText(link);
    toastSuccess("Link de pagamento copiado para a área de transferência!");
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
    </div>
  );

  if (!tournament) return (
    <div className="text-center py-20">
      <h2 className="text-2xl font-bold text-slate-800">Torneio não encontrado</h2>
      <button onClick={() => navigate("/torneios")} className="mt-4 text-indigo-600 font-semibold">
        Voltar para a lista
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-slate-200">
        <div className="space-y-4">
          <button 
            onClick={() => navigate("/torneios")}
            className="flex items-center gap-1 text-slate-500 hover:text-indigo-600 transition-colors text-sm font-medium"
          >
            <ChevronLeft size={16} />
            Voltar para Torneios
          </button>
          
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center shadow-inner overflow-hidden border border-slate-100">
              {tournament.logo_url ? (
                <img 
                  src={tournament.logo_url} 
                  alt={tournament.name} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Trophy size={32} />
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{tournament.name}</h1>
              <div className="flex items-center gap-4 mt-1 text-slate-500 text-sm">
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  {new Date(tournament.start_date).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={14} />
                  Online/Local
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-end gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/public/tournament/${id}`);
                setCopiedLink(true);
                setTimeout(() => setCopiedLink(false), 2000);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-sm font-bold transition-colors"
              title="Copiar link público do torneio"
            >
              {copiedLink ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
              <span className="hidden sm:inline">{copiedLink ? "Copiado!" : "Link Público"}</span>
            </button>
            <a 
              href={`/public/tournament/${id}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full transition-colors"
              title="Abrir página pública"
            >
              <ExternalLink size={16} />
            </a>
          </div>
          <button 
            onClick={toggleStatus}
            title="Clique para alterar o status"
            className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
              tournament.status === 'active' 
                ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100 hover:border-emerald-200' 
                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200 hover:border-slate-300'
            }`}
          >
            {tournament.status === 'active' ? 'Torneio Ativo' : 'Em Planejamento'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100/50 rounded-2xl w-fit">
        {[
          { id: "geral", label: "Painel Geral", icon: LayoutGrid },
          { id: "configuracoes", label: "Configurações", icon: Settings },
          { id: "modalidades", label: "Modalidades", icon: ListChecks },
          { id: "inscricoes", label: "Inscrições", icon: Users },
          { id: "financeiro", label: "Financeiro", icon: DollarSign },
          { id: "tabela", label: "Tabela / Bracket", icon: Trophy },
          { id: "escala", label: "Escala de Partidas", icon: Calendar },
          { id: "classificacao", label: "Classificação", icon: TrendingUp },
          { id: "estatisticas", label: "Estatísticas", icon: BarChart3 },
          { id: "arbitragem", label: "Arbitragem", icon: Shield },
          { id: "comunidade", label: "Comunidade & Mural", icon: MessageSquare }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab.id 
              ? "bg-white text-indigo-600 shadow-sm border border-slate-200" 
              : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-8">
        {activeTab === "geral" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Event Details and Direct Editor Card */}
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                    <Trophy size={20} className="text-amber-500" />
                    Informações do Torneio
                  </h3>
                  {!isEditingTournament && (
                    <button
                      onClick={() => setIsEditingTournament(true)}
                      className="px-4 py-2 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition cursor-pointer"
                    >
                      Editar Detalhes
                    </button>
                  )}
                </div>

                {isEditingTournament ? (
                  <form onSubmit={handleSaveTournamentDetails} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Nome do Torneio
                        </label>
                        <input
                          type="text"
                          required
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-900 font-medium"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                          URL do Logotipo / Imagem do Evento
                        </label>
                        <input
                          type="url"
                          placeholder="https://exemplo.com/logo-do-torneio.png"
                          value={editForm.logo_url}
                          onChange={(e) => setEditForm({ ...editForm, logo_url: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-900 font-medium"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                          URL da Imagem de Fundo (Banner do Evento)
                        </label>
                        <input
                          type="url"
                          placeholder="https://exemplo.com/banner-esportivo-fundo.jpg"
                          value={editForm.banner_url || ""}
                          onChange={(e) => setEditForm({ ...editForm, banner_url: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-900 font-medium"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 mt-2">
                      {editForm.logo_url && (
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100 max-w-sm">
                          <img 
                            src={editForm.logo_url} 
                            alt="Logo preview" 
                            className="w-10 h-10 object-contain rounded-lg border bg-white" 
                            onError={(e: any) => e.target.style.display = 'none'} 
                          />
                          <span className="text-xs text-slate-500 font-semibold">Logotipo</span>
                        </div>
                      )}

                      {editForm.banner_url && (
                        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100 max-w-sm">
                          <img 
                            src={editForm.banner_url} 
                            alt="Banner preview" 
                            className="w-16 h-10 object-cover rounded-lg border bg-white" 
                            onError={(e: any) => e.target.style.display = 'none'} 
                          />
                          <span className="text-xs text-slate-500 font-semibold">Fundo (Banner)</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-505 uppercase tracking-wider mb-1">
                        Descrição / Regulamento
                      </label>
                      <textarea
                        rows={3}
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        placeholder="Descreva as principais regras, regulamentos e informações do evento..."
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-900 text-sm leading-relaxed"
                      />
                    </div>

                    {/* Galeria de Fotos oficial do Evento */}
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/60 space-y-3.5">
                      <div>
                        <span className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                          🖼️ Imagens Oficiais do Evento (Mínimo recomendado: 5)
                        </span>
                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                          Insira as URLs das 5 imagens oficiais para o carrossel. Deixe em branco para usar as fotos esportivas padrão.
                        </p>
                      </div>

                      <div className="space-y-2.5">
                        {editForm.photos.map((photo, index) => (
                          <div key={index} className="flex gap-3 items-center">
                            <span className="text-[11px] font-black text-slate-400 w-16 shrink-0 uppercase tracking-widest">Foto #{index + 1}:</span>
                            <div className="flex-1">
                              <input
                                type="url"
                                placeholder={`https://images.unsplash.com/photo-... ou link da foto ${index + 1}`}
                                value={photo}
                                onChange={(e) => handlePhotoChange(index, e.target.value)}
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-800 text-xs font-semibold"
                              />
                            </div>
                            {photo ? (
                              <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-250 bg-white shrink-0 shadow-ultra-sm">
                                <img
                                  src={photo}
                                  alt={`preview-${index}`}
                                  className="w-full h-full object-cover"
                                  onError={(e: any) => e.target.style.display = 'none'}
                                />
                              </div>
                            ) : (
                              <div className="w-9 h-9 rounded-lg border-2 border-dashed border-slate-200 bg-slate-100 flex items-center justify-center text-[10px] text-slate-350 font-black shrink-0">
                                PV
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Data de Início
                        </label>
                        <input
                          type="date"
                          required
                          value={editForm.start_date}
                          onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-900 font-medium"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Data de Fim
                        </label>
                        <input
                          type="date"
                          required
                          value={editForm.end_date}
                          onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white text-slate-900 font-medium"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingTournament(false);
                          if (tournament) {
                            setEditForm({
                              name: tournament.name || "",
                              description: tournament.description || "",
                              start_date: tournament.start_date ? tournament.start_date.split("T")[0] : "",
                              end_date: tournament.end_date ? tournament.end_date.split("T")[0] : "",
                              logo_url: tournament.logo_url || ""
                            });
                          }
                        }}
                        className="px-4 py-2.5 rounded-xl text-slate-500 hover:bg-slate-50 font-semibold text-sm transition cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={savingTournament}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition shadow-sm disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                      >
                        {savingTournament ? "Salvando..." : "Salvar Alterações"}
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                      {tournament.logo_url && (
                        <div className="w-16 h-16 rounded-2xl border border-slate-200 bg-slate-50 p-1 shrink-0 flex items-center justify-center">
                          <img src={tournament.logo_url} alt="Logo" className="max-w-full max-h-full object-contain rounded-xl" />
                        </div>
                      )}
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Nome do Evento</span>
                        <p className="text-slate-800 font-bold text-lg">{tournament.name}</p>
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Descrição / Regulamento</span>
                      {tournament.description ? (
                        <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap bg-slate-50/50 p-4 rounded-2xl border border-slate-105">{parseDescription(tournament.description).description}</p>
                      ) : (
                        <p className="text-slate-400 text-sm italic">Nenhuma descrição ou regulamento detalhado foi informado para este torneio.</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="bg-slate-50/30 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                        <Calendar size={18} className="text-indigo-500" />
                        <div>
                          <span className="text-xs font-bold text-slate-400 block uppercase">Data de Início</span>
                          <span className="text-sm font-semibold text-slate-700">
                            {tournament.start_date ? new Date(tournament.start_date).toLocaleDateString() : "-"}
                          </span>
                        </div>
                      </div>

                      <div className="bg-slate-50/30 p-4 rounded-2xl border border-slate-100 flex items-center gap-3">
                        <Calendar size={18} className="text-violet-500" />
                        <div>
                          <span className="text-xs font-bold text-slate-400 block uppercase">Data de Fim</span>
                          <span className="text-sm font-semibold text-slate-700">
                            {tournament.end_date ? new Date(tournament.end_date).toLocaleDateString() : "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>


            </div>
            
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm h-fit">
              <h3 className="text-lg font-bold mb-4">Resumo</h3>
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Modalidades</span>
                  <span className="font-bold text-slate-900">{categories.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Instituições Inscritas</span>
                  <span className="font-bold text-slate-900">{registrations.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-medium">Atletas Totais</span>
                  <span className="font-bold text-slate-900">
                    {registrations.reduce((sum, r) => sum + (r.athleteCount || 0), 0)}
                  </span>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Este resumo será atualizado à medida que você configurar o torneio.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "modalidades" && (
          <CategoriesTab categories={categories} refreshCategories={refreshCategories} tournamentId={id!} />
        )}

        {activeTab === "inscricoes" && (
          <SubscriptionsTab 
            tournamentId={id!} 
            registrations={registrations} 
            refreshSummary={refreshSummary} 
            categories={categories} 
            institutions={institutions} 
            refreshAthleteSubs={refreshAthleteSubs}
          />
        )}

        {activeTab === "financeiro" && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header & Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Controle Financeiro</h3>
                <p className="text-slate-500 text-sm">Gerencie o pagamento das taxas de inscrição de equipes e atletas.</p>
              </div>
              
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Filtrar por Entidade:</span>
                <select
                  value={selectedInstFilter}
                  onChange={e => setSelectedInstFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 outline-none text-xs font-semibold bg-slate-50 text-slate-700 min-w-[200px] focus:border-indigo-500"
                >
                  <option value="">Todas as Instituições</option>
                  {[...registrations]
                    .sort((a: any, b: any) => (a.institution?.name || "").localeCompare(b.institution?.name || ""))
                    .map((reg: any) => (
                      <option key={reg.institution?.id} value={reg.institution?.id}>
                        {reg.institution?.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* KPI Cards */}
            {(() => {
              const fType = subSettings?.feeType || "free";
              const tFee = Number(subSettings?.teamFee) || 0;
              const aFee = Number(subSettings?.athleteFee) || 0;

              // Team calculations
              const tPrevisto = registrations.reduce((sum, r) => sum + (tFee * (r.modalityCount || 0)), 0);
              const tPago = registrations.reduce((sum, r) => r.status === "confirmed" ? sum + (tFee * (r.modalityCount || 0)) : sum, 0);
              const tPendente = tPrevisto - tPago;

              // Athlete calculations
              const hasAFee = fType.includes("athlete");
              const compSubs = athleteSubs.filter((s: any) => s.isCompleted);
              const aPrevisto = hasAFee ? compSubs.length * aFee : 0;
              const aPago = hasAFee ? compSubs.filter((s: any) => s.paymentStatus === "paid").length * aFee : 0;
              const aPendente = aPrevisto - aPago;

              const totalPrev = tPrevisto + aPrevisto;
              const totalPg = tPago + aPago;
              const totalPend = totalPrev - totalPg;



              const filteredRegistrations = [...(selectedInstFilter 
                ? registrations.filter((r: any) => r.institution_id === selectedInstFilter)
                : registrations)]
                .sort((a: any, b: any) => (a.institution?.name || "").localeCompare(b.institution?.name || ""));

              const filteredAthleteSubs = [...(selectedInstFilter
                ? athleteSubs.filter((s: any) => s.institutionId === selectedInstFilter)
                : athleteSubs)]
                .sort((a: any, b: any) => (a.athleteName || "").localeCompare(b.athleteName || ""));

              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Previsto */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                        <DollarSign size={24} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Previsto</span>
                        <span className="text-2xl font-black text-slate-800">{formatCurrency(totalPrev)}</span>
                        <span className="text-[10px] text-slate-400 block mt-1">
                          Times: {formatCurrency(tPrevisto)} | Atletas: {formatCurrency(aPrevisto)}
                        </span>
                      </div>
                    </div>

                    {/* Pago */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                        <CheckCircle2 size={24} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Pago</span>
                        <span className="text-2xl font-black text-emerald-650">{formatCurrency(totalPg)}</span>
                        <span className="text-[10px] text-slate-400 block mt-1">
                          Times: {formatCurrency(tPago)} | Atletas: {formatCurrency(aPago)}
                        </span>
                      </div>
                    </div>

                    {/* Pendente */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                        <AlertCircle size={24} />
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Total Pendente</span>
                        <span className="text-2xl font-black text-amber-600">{formatCurrency(totalPend)}</span>
                        <span className="text-[10px] text-slate-400 block mt-1">
                          Times: {formatCurrency(tPendente)} | Atletas: {formatCurrency(aPendente)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {fType === "free" && (
                    <div className="bg-slate-50 border border-slate-200/60 p-4 rounded-2xl text-slate-600 text-xs font-bold flex items-center gap-2">
                      <AlertCircle size={16} className="text-slate-400" />
                      Este torneio está configurado como Gratuito em Configurações. As taxas de inscrição para equipes e atletas estão zeradas.
                    </div>
                  )}

                  {/* Tables Grid */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {/* Tabela de Entidades */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                      <div>
                        <h4 className="font-bold text-slate-800 text-md">Taxas por Entidade (Equipes)</h4>
                        <p className="text-slate-400 text-xs mt-0.5">Pagamento das taxas de equipe da instituição.</p>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-semibold text-slate-600 border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase tracking-wider">
                              <th className="pb-3 font-bold">Instituição</th>
                              <th className="pb-3 text-center font-bold">Qtd. Equipes</th>
                              <th className="pb-3 text-right font-bold">Total Devido</th>
                              <th className="pb-3 text-center font-bold">Status</th>
                              <th className="pb-3 text-center font-bold">Link de Pagamento</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRegistrations.length === 0 ? (
                              <tr>
                                <td colSpan={5} className="py-8 text-center text-slate-400 italic">
                                  Nenhuma instituição inscrita.
                                </td>
                              </tr>
                            ) : (
                              filteredRegistrations.map((reg: any) => {
                                const due = tFee * (reg.modalityCount || 0);
                                const isPaid = reg.status === "confirmed";
                                const pLink = paymentLinks.find(
                                  (p: any) => p.institutionId === reg.institution_id && p.status === "pending"
                                );

                                return (
                                  <tr key={reg.id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 duration-100">
                                    <td className="py-3.5 flex items-center gap-2">
                                      {reg.institution?.logo_url && (
                                        <img src={reg.institution.logo_url} alt="Logo" className="w-6 h-6 object-contain rounded-md" />
                                      )}
                                      <span className="text-slate-800 font-bold">{reg.institution?.name}</span>
                                    </td>
                                    <td className="py-3.5 text-center text-slate-700">{reg.modalityCount || 0}</td>
                                    <td className="py-3.5 text-right font-bold text-slate-800">{formatCurrency(due)}</td>
                                    <td className="py-3.5 text-center">
                                      <select
                                        value={reg.status || "pending"}
                                        onChange={e => handleToggleRegStatus(reg.id, reg.status)}
                                        className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase outline-none cursor-pointer transition ${
                                          isPaid 
                                            ? "bg-emerald-50 border-emerald-250 text-emerald-600" 
                                            : "bg-amber-50 border-amber-250 text-amber-600"
                                        }`}
                                      >
                                        <option value="confirmed">Pago</option>
                                        <option value="pending">Pendente</option>
                                      </select>
                                    </td>
                                    <td className="py-3.5 text-center">
                                      {isPaid ? (
                                        <span className="text-[10px] font-bold text-slate-400">—</span>
                                      ) : pLink ? (
                                        <div className="flex flex-col items-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => handleCopyPaymentLink(pLink.id)}
                                            className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-105 text-indigo-600 border border-indigo-100 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                          >
                                            <Copy size={12} /> Copiar Link
                                          </button>
                                          <span className="text-[9px] text-slate-400 font-semibold">
                                            Vence: {new Date(pLink.deadline + "T00:00:00").toLocaleDateString()}
                                          </span>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={due === 0}
                                          onClick={() => {
                                            setSelectedRegForLink(reg);
                                            const defaultDate = new Date();
                                            defaultDate.setDate(defaultDate.getDate() + 7);
                                            setPayLinkDeadline(defaultDate.toISOString().split("T")[0]);
                                            setPayLinkMethods({ pix: true, boleto: true, card: true });
                                            setShowPayLinkModal(true);
                                          }}
                                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer mx-auto ${
                                            due === 0 
                                              ? "bg-slate-50 border border-slate-200 text-slate-400 cursor-not-allowed"
                                              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm border border-indigo-500"
                                          }`}
                                        >
                                          <CreditCard size={12} /> Gerar Link
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Tabela de Atletas */}
                    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                      <div>
                        <h4 className="font-bold text-slate-800 text-md">Taxas por Atleta (Inscrições Individuais)</h4>
                        <p className="text-slate-400 text-xs mt-0.5">Pagamento das taxas de inscrição dos atletas individuais.</p>
                      </div>

                      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <table className="w-full text-left text-xs font-semibold text-slate-600 border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 text-slate-400 text-[10px] uppercase tracking-wider sticky top-0 bg-white z-10">
                              <th className="pb-3 font-bold">Atleta</th>
                              <th className="pb-3 font-bold">Entidade / Categoria</th>
                              <th className="pb-3 text-right font-bold">Taxa</th>
                              <th className="pb-3 text-center font-bold">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const completedFiltered = filteredAthleteSubs.filter((s: any) => s.isCompleted);
                              if (completedFiltered.length === 0) {
                                return (
                                  <tr>
                                    <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                                      Nenhum atleta com inscrição concluída.
                                    </td>
                                  </tr>
                                );
                              }

                              return completedFiltered.map((sub: any) => {
                                const inst = institutions.find((i: any) => i.id === sub.institutionId);
                                const cat = categories.find((c: any) => c.id === sub.categoryId);
                                const isPaid = sub.paymentStatus === "paid";
                                const actualFee = hasAFee ? aFee : 0;

                                return (
                                  <tr key={sub.id} className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50 duration-100">
                                    <td className="py-3.5 font-bold text-slate-800">
                                      {sub.athleteName}
                                    </td>
                                    <td className="py-3.5 text-slate-500 font-medium">
                                      <div className="max-w-[180px] truncate">{inst?.name || "Desconhecida"}</div>
                                      <div className="text-[10px] text-slate-400 uppercase font-bold mt-0.5">{cat?.name || "Sem Categoria"}</div>
                                    </td>
                                    <td className="py-3.5 text-right font-bold text-slate-800">
                                      {formatCurrency(actualFee)}
                                    </td>
                                    <td className="py-3.5 text-center">
                                      <select
                                        disabled={!hasAFee}
                                        value={sub.paymentStatus || "pending"}
                                        onChange={e => handleToggleAthletePayment(sub.id, sub.paymentStatus)}
                                        className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-black uppercase outline-none transition ${
                                          !hasAFee 
                                            ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed" 
                                            : isPaid 
                                              ? "bg-emerald-50 border-emerald-250 text-emerald-600 cursor-pointer" 
                                              : "bg-red-50 border-red-200 text-red-650 cursor-pointer"
                                        }`}
                                      >
                                        <option value="paid">Pago</option>
                                        <option value="pending">Pendente</option>
                                      </select>
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {activeTab === "configuracoes" && (
          <TournamentSettingsTab tournamentId={id!} />
        )}

        {activeTab === "tabela" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div>
                <h3 className="text-xl font-bold">Chaveamento do Torneio</h3>
                <p className="text-slate-500 text-sm">Visualize e gerencie os jogos das categorias.</p>
              </div>
              
              <div className="flex gap-4 overflow-x-auto pb-2">
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCatForBracket(cat)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                      selectedCatForBracket?.id === cat.id 
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-100" 
                        : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                    }`}
                  >
                    {cat.name} ({cat.gender} {cat.age_group})
                  </button>
                ))}
              </div>

              {selectedCatForBracket && bracketMatches.length > 0 && (
                <div className="flex gap-2">
                  <Link
                    to={`/public/tournament/${id}/categories/${selectedCatForBracket.id}/draw`}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-100 rounded-xl text-xs font-bold transition-colors"
                  >
                    <Sparkles size={14} />
                    Ver Sorteio Animado 🎬
                  </Link>
                  <button
                    onClick={resetBracket}
                    disabled={loadingMatches}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={14} />
                    Resetar Chaveamento
                  </button>
                </div>
              )}
            </div>

            {selectedCatForBracket && (
              <div className="space-y-6">
                {selectedCatForBracket.rules_config?.sport_type === "combat" && (
                  <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-300">
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Subdivisão de Combate</h4>
                      <p className="text-xs text-slate-500">Selecione a classe, faixa e peso para gerenciar a disputa.</p>
                    </div>
                    <div className="w-full sm:w-72">
                      <select
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-semibold text-sm text-slate-700 bg-white shadow-sm focus:border-indigo-500 text-slate-700 bg-white"
                        value={selectedSubdivision}
                        onChange={e => setSelectedSubdivision(e.target.value)}
                      >
                        {getSubdivisions(selectedCatForBracket).map(sub => {
                          const count = getSubdivisionCounts(selectedCatForBracket.id)[sub] || 0;
                          return (
                            <option key={sub} value={sub}>
                              {sub} ({count} {count === 1 ? "atleta" : "atletas"})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                )}

                {(() => {
                  const isCombat = selectedCatForBracket?.rules_config?.sport_type === "combat";
                  const categoryApprovedSubs = athleteSubs.filter(
                    (sub: any) => sub.categoryId === selectedCatForBracket?.id && sub.validationStatus === "approved"
                  );
                  const subdivisionAthletes = categoryApprovedSubs.filter((sub: any) => {
                    const age = sub.additionalData?.age_group || "";
                    const grad = sub.additionalData?.graduation || "";
                    const wt = sub.additionalData?.weight_class || "";
                    const label = `${age} - ${grad} - ${wt}`;
                    return label === selectedSubdivision;
                  });

                  const activeMatches = bracketMatches.filter(m => {
                    const phaseMatch = (m.phase_index || 1) === activePhaseIndex;
                    if (!phaseMatch) return false;
                    if (isCombat && selectedSubdivision) {
                      return m.group_label === selectedSubdivision || m.group_label?.startsWith(`${selectedSubdivision} - `);
                    }
                    return true;
                  });
                  
                  const categoryPhases = selectedCatForBracket?.rules_config?.phases || [];
                  const isSubsequentPhase = activePhaseIndex > 1 && categoryPhases.length >= activePhaseIndex;
                  const currentPhaseConfig = categoryPhases[activePhaseIndex - 1];
                  
                  return (
                    <div className="space-y-8">
                  {/* Seletor de Fases (se configurado com múltiplas fases) */}
                  {categoryPhases.length > 1 && (
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3 overflow-x-auto">
                      {categoryPhases.map((phase: any, idx: number) => {
                        const phaseNum = idx + 1;
                        const isGenerated = bracketMatches.some(m => m.phase_index === phaseNum);
                        const isActive = activePhaseIndex === phaseNum;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setActivePhaseIndex(phaseNum)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all border shrink-0 flex items-center gap-1.5 cursor-pointer ${
                              isActive
                                ? "bg-indigo-50 text-indigo-700 border-indigo-250 shadow-sm"
                                : "bg-white text-slate-500 border-slate-100 hover:border-slate-200 hover:text-slate-700"
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full ${isGenerated ? "bg-emerald-500" : "bg-slate-300"}`} />
                            {phase.name || `${phaseNum}ª Fase`}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {activeMatches.length === 0 ? (
                    isSubsequentPhase ? (
                      /* Gerador de Fase Subsequente */
                      <div className="bg-white p-12 text-center rounded-3xl border-2 border-dashed border-slate-200 max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
                        <Plus size={48} className="mx-auto text-slate-300 mb-4" />
                        <div>
                          <h3 className="text-xl font-bold text-slate-800">Gerar {currentPhaseConfig?.name || `${activePhaseIndex}ª Fase`}</h3>
                          <p className="text-slate-500 text-xs mt-1">
                            Sistema: <strong className="text-slate-700">{currentPhaseConfig?.system === "single" ? "Eliminatória Simples" : currentPhaseConfig?.system === "groups" ? "Grupos / Round Robin" : "Grupos contra Grupos"}</strong>
                            {currentPhaseConfig?.system !== "single" && ` (${currentPhaseConfig?.groupCount || 1} grupos)`}
                          </p>
                        </div>
                        
                        <div className="space-y-4 mb-8 text-left">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">
                              {isCombat ? "Selecionar Atletas Classificados" : "Selecionar Equipes Classificadas"}
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const list = isCombat ? subdivisionAthletes : teamsInCategory;
                                if (selectedTeamsForPhase.length === list.length) {
                                  setSelectedTeamsForPhase([]);
                                } else {
                                  setSelectedTeamsForPhase(list.map(t => t.id));
                                }
                              }}
                              className="text-[10px] font-bold text-indigo-600 hover:underline cursor-pointer"
                            >
                              {selectedTeamsForPhase.length === (isCombat ? subdivisionAthletes.length : teamsInCategory.length) ? "Desmarcar Todos" : "Selecionar Todos"}
                            </button>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto p-1 border border-slate-100 rounded-2xl bg-slate-50/20">
                            {(isCombat ? subdivisionAthletes : teamsInCategory).map(item => {
                              const itemId = item.id;
                              const displayName = isCombat 
                                ? `${item.athleteName} (${item.institutionName || "Avulso"})` 
                                : item.institution?.name;
                              const isChecked = selectedTeamsForPhase.includes(itemId);
                              const standingLabel = getPrevPhaseStandingsMap()[itemId];
                              return (
                                <button
                                  type="button"
                                  key={itemId}
                                  onClick={() => {
                                    if (isChecked) {
                                      setSelectedTeamsForPhase(selectedTeamsForPhase.filter(id => id !== itemId));
                                    } else {
                                      setSelectedTeamsForPhase([...selectedTeamsForPhase, itemId]);
                                    }
                                  }}
                                  className={`p-3.5 rounded-xl text-left border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                                    isChecked ? "bg-indigo-50/50 border-indigo-250 shadow-sm" : "bg-white border-slate-100 hover:border-slate-200"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {}}
                                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 shrink-0 pointer-events-none"
                                    />
                                    <span className={`text-xs font-bold truncate ${isChecked ? "text-indigo-900" : "text-slate-700"}`}>
                                      {displayName}
                                    </span>
                                  </div>
                                  {standingLabel && (
                                    <span className="text-[9px] font-black bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                                      {standingLabel}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <button 
                          onClick={generateSubsequentPhase}
                          disabled={loadingMatches}
                          className="w-full bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-100 disabled:opacity-50 transition-all transform active:scale-95 cursor-pointer"
                        >
                          {loadingMatches ? (
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                              Iniciando Geração...
                            </div>
                          ) : `Gerar Confrontos da Fase "${currentPhaseConfig?.name || activePhaseIndex}"`}
                        </button>
                      </div>
                    ) : (
                      /* Gerador Inicial */
                      <div className="bg-white p-12 text-center rounded-3xl border-2 border-dashed border-slate-200 max-w-2xl mx-auto">
                        <Plus size={48} className="mx-auto text-slate-300 mb-4" />
                        <h3 className="text-xl font-bold text-slate-800 mb-1">Gerar Tabela de Jogos</h3>
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-100 rounded-full text-xs text-slate-600 font-semibold mb-6">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {isCombat ? (
                            <>Atletas Inscritos (nesta subdivisão): <strong className="text-slate-900">{subdivisionAthletes.length}</strong></>
                          ) : (
                            <>Equipes Inscritas: <strong className="text-slate-900">{teamsInCategory.length}</strong></>
                          )}
                        </div>
                        
                        {/* Toggle entre Fase Única e Múltiplas Fases */}
                        <div className="flex gap-4 mb-6 p-1.5 bg-slate-100/70 rounded-2xl border border-slate-200/50">
                          <button
                            type="button"
                            onClick={() => setUsePhases(false)}
                            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                              !usePhases ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            Fase Única
                          </button>
                          <button
                            type="button"
                            onClick={() => setUsePhases(true)}
                            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                              usePhases ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            Múltiplas Fases
                          </button>
                        </div>

                        {!usePhases ? (
                          /* Fluxo Original de Fase Única */
                          <>
                            <p className="text-slate-500 text-sm mb-6">Escolha o sistema de disputa:</p>
                            <div className="grid grid-cols-3 gap-4 mb-8 text-left">
                              <button 
                                onClick={() => setDisputeSystem("single")}
                                className={`p-6 rounded-2xl border-2 transition-all cursor-pointer ${disputeSystem === "single" ? "border-indigo-600 bg-indigo-50/50 shadow-md" : "border-slate-100 hover:border-slate-200"}`}
                              >
                                <div className={`w-10 h-10 rounded-xl mb-3 flex items-center justify-center ${disputeSystem === "single" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                                  <Trophy size={20} />
                                </div>
                                <h4 className="font-bold text-sm mb-1">Eliminatória Simples</h4>
                                <p className="text-[10px] text-slate-400 font-medium">Quem perde sai. Árvore clássica de torneio.</p>
                              </button>

                              <button 
                                onClick={() => setDisputeSystem("groups")}
                                className={`p-6 rounded-2xl border-2 transition-all cursor-pointer ${disputeSystem === "groups" ? "border-indigo-600 bg-indigo-50/50 shadow-md" : "border-slate-100 hover:border-slate-200"}`}
                              >
                                <div className={`w-10 h-10 rounded-xl mb-3 flex items-center justify-center ${disputeSystem === "groups" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                                  <Users size={20} />
                                </div>
                                <h4 className="font-bold text-sm mb-1">Grupos / Round Robin</h4>
                                <p className="text-[10px] text-slate-400 font-medium">Todos jogam contra todos dentro do grupo.</p>
                              </button>

                              <button 
                                onClick={() => setDisputeSystem("group_vs_group")}
                                className={`p-6 rounded-2xl border-2 transition-all cursor-pointer ${disputeSystem === "group_vs_group" ? "border-indigo-600 bg-indigo-50/50 shadow-md" : "border-slate-100 hover:border-slate-200"}`}
                              >
                                <div className={`w-10 h-10 rounded-xl mb-3 flex items-center justify-center ${disputeSystem === "group_vs_group" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>
                                  <LayoutGrid size={20} />
                                </div>
                                <h4 className="font-bold text-sm mb-1">Grupos contra Grupos</h4>
                                <p className="text-[10px] text-slate-400 font-medium">Times do Grupo A jogam contra os do Grupo B.</p>
                              </button>
                            </div>

                            {(disputeSystem === "groups" || disputeSystem === "group_vs_group") && (
                              <div className="mb-8 text-left animate-in fade-in slide-in-from-top-4 duration-300 space-y-8">
                                <div>
                                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Quantidade de Grupos</label>
                                  <div className="flex gap-2">
                                    {[1, 2, 4, 8].map(n => (
                                      <button
                                        type="button"
                                        key={n}
                                        onClick={() => setGroupCount(n)}
                                        className={`flex-1 py-3 rounded-xl font-bold text-sm border transition-all cursor-pointer ${groupCount === n ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"}`}
                                      >
                                        {n} {n === 1 ? "Grupo" : "Grupos"}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div>
                                  <div className="flex items-center justify-between mb-3">
                                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Cabeças de Chave (Opcional)</label>
                                    <span className="text-[10px] text-slate-400 font-bold">{seeds.length} selecionados</span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 mb-3 italic">Estes times serão distribuídos em grupos diferentes.</p>
                                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                                    {(isCombat ? subdivisionAthletes : teamsInCategory).map(item => {
                                      const itemId = item.id;
                                      const displayName = isCombat 
                                        ? `${item.athleteName} (${item.institutionName || "Avulso"})` 
                                        : item.institution?.name;
                                      const isSeeded = seeds.includes(itemId);
                                      return (
                                        <button
                                          type="button"
                                          key={itemId}
                                          onClick={() => {
                                            if (isSeeded) setSeeds(seeds.filter(s => s !== itemId));
                                            else if (seeds.length < groupCount) setSeeds([...seeds, itemId]);
                                            else toastWarning(`Você já selecionou o limite de cabeças de chave para ${groupCount} grupos.`);
                                          }}
                                          className={`p-3 rounded-xl text-left border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                            isSeeded ? "bg-amber-50 border-amber-200 shadow-sm" : "bg-white border-slate-100 hover:border-slate-200"
                                          }`}
                                        >
                                          <span className={`text-[10px] font-bold truncate ${isSeeded ? "text-amber-700" : "text-slate-600"}`}>
                                            {displayName}
                                          </span>
                                          {isSeeded && <div className="w-2 h-2 bg-amber-400 rounded-full shrink-0 shadow-sm" />}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        ) : (
                          /* Fluxo de Configuração de Múltiplas Fases */
                          <div className="space-y-6 mb-8 text-left animate-in fade-in duration-300">
                            <p className="text-slate-500 text-sm mb-2">Configure a sequência de fases que compõem esta categoria:</p>
                            <div className="space-y-4">
                              {configuredPhases.map((phase, idx) => (
                                <div key={idx} className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 relative space-y-4">
                                  <div className="flex justify-between items-center">
                                    <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-widest">
                                      {idx + 1}ª Fase
                                    </h4>
                                    {configuredPhases.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => setConfiguredPhases(configuredPhases.filter((_, i) => i !== idx))}
                                        className="text-[10px] font-bold text-rose-500 hover:text-rose-700 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100 hover:bg-rose-100 transition-colors cursor-pointer"
                                      >
                                        Remover
                                      </button>
                                    )}
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Nome da Fase</label>
                                      <input
                                        type="text"
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-indigo-500"
                                        placeholder={`Ex: ${idx === 0 ? "Torneio Início" : idx === 1 ? "Fase de Grupos" : "Playoffs"}`}
                                        value={phase.name}
                                        onChange={e => {
                                          const updated = [...configuredPhases];
                                          updated[idx].name = e.target.value;
                                          setConfiguredPhases(updated);
                                        }}
                                        required
                                      />
                                    </div>
                                    
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Sistema de Disputa</label>
                                      <select
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:border-indigo-500 text-slate-700 bg-white"
                                        value={phase.system}
                                        onChange={e => {
                                          const updated = [...configuredPhases];
                                          updated[idx].system = e.target.value;
                                          setConfiguredPhases(updated);
                                        }}
                                      >
                                        <option value="single">Eliminatória Simples</option>
                                        <option value="groups">Grupos / Round Robin</option>
                                        <option value="group_vs_group">Grupos contra Grupos</option>
                                      </select>
                                    </div>
                                  </div>
                                  
                                  {(phase.system === "groups" || phase.system === "group_vs_group") && (
                                    <div className="animate-in fade-in duration-300">
                                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">Quantidade de Grupos</label>
                                      <div className="flex gap-2">
                                        {[1, 2, 4, 8].map(n => (
                                          <button
                                            type="button"
                                            key={n}
                                            onClick={() => {
                                              const updated = [...configuredPhases];
                                              updated[idx].groupCount = n;
                                              if (updated[idx].seeds && updated[idx].seeds.length > n) {
                                                updated[idx].seeds = updated[idx].seeds.slice(0, n);
                                              }
                                              setConfiguredPhases(updated);
                                            }}
                                            className={`flex-1 py-2 rounded-xl font-bold text-xs border transition-all cursor-pointer ${phase.groupCount === n ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"}`}
                                          >
                                            {n} {n === 1 ? "Grupo" : "Grupos"}
                                          </button>
                                        ))}
                                      </div>

                                      {/* Cabeças de Chave para esta fase */}
                                      <div className="mt-4 animate-in fade-in duration-300">
                                        <div className="flex items-center justify-between mb-2">
                                          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            Cabeças de Chave (Opcional)
                                          </label>
                                          <span className="text-[9px] text-slate-400 font-bold">
                                            {(phase.seeds || []).length} selecionados
                                          </span>
                                        </div>
                                        <p className="text-[9px] text-slate-400 mb-2 italic">
                                          Estes times serão distribuídos em grupos diferentes.
                                        </p>
                                        <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-1 bg-white border border-slate-100 rounded-xl">
                                          {(isCombat ? subdivisionAthletes : teamsInCategory).map(item => {
                                            const itemId = item.id;
                                            const displayName = isCombat 
                                              ? `${item.athleteName} (${item.institutionName || "Avulso"})` 
                                              : item.institution?.name;
                                            const phaseSeeds = phase.seeds || [];
                                            const isSeeded = phaseSeeds.includes(itemId);
                                            return (
                                              <button
                                                type="button"
                                                key={itemId}
                                                onClick={() => {
                                                  const updated = [...configuredPhases];
                                                  const currentSeeds = updated[idx].seeds || [];
                                                  if (isSeeded) {
                                                    updated[idx].seeds = currentSeeds.filter((s: string) => s !== itemId);
                                                  } else if (currentSeeds.length < (phase.groupCount || 1)) {
                                                    updated[idx].seeds = [...currentSeeds, itemId];
                                                  } else {
                                                    toastWarning(`Você já selecionou o limite de cabeças de chave para ${phase.groupCount || 1} grupos nesta fase.`);
                                                    return;
                                                  }
                                                  setConfiguredPhases(updated);
                                                }}
                                                className={`p-2 rounded-lg text-left border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                                  isSeeded ? "bg-amber-50 border-amber-200 shadow-sm" : "bg-white border-slate-100 hover:border-slate-200"
                                                }`}
                                              >
                                                <span className={`text-[9px] font-bold truncate ${isSeeded ? "text-amber-700" : "text-slate-600"}`}>
                                                  {displayName}
                                                </span>
                                                {isSeeded && <div className="w-1.5 h-1.5 bg-amber-400 rounded-full shrink-0 shadow-sm" />}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => setConfiguredPhases([...configuredPhases, { name: `${configuredPhases.length + 1}ª Fase`, system: "single", groupCount: 1, seeds: [] }])}
                              className="w-full py-3.5 border-2 border-dashed border-slate-200 hover:border-indigo-500 text-slate-500 hover:text-indigo-600 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 bg-white hover:bg-indigo-50/5 cursor-pointer"
                            >
                              <Plus size={14} />
                              Adicionar Fase
                            </button>
                          </div>
                        )}

                        <button 
                          onClick={generateBracket}
                          disabled={loadingMatches}
                          className="w-full bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-100 disabled:opacity-50 transition-all transform active:scale-95 cursor-pointer"
                        >
                          {loadingMatches ? (
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                              Iniciando Geração...
                            </div>
                          ) : "Confirmar e Gerar Chaveamento"}
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="space-y-6">
                      <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-3xl space-y-6 animate-in fade-in duration-300">
                        {/* Header row */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                              <Sparkles size={20} />
                            </div>
                            <div>
                              <p className="text-xs font-black text-indigo-950 uppercase tracking-wider">Painel de Controle do Sorteio Animado</p>
                              <p className="text-xs text-indigo-750">Controle a animação oficial e veja as atualizações na tela pública em tempo real.</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Link
                              to={`/public/tournament/${id}/categories/${selectedCatForBracket.id}/draw`}
                              target="_blank"
                              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/15 cursor-pointer text-center"
                            >
                              Assistir Sorteio 🎬
                            </Link>
                            <button
                              type="button"
                              onClick={() => {
                                const shareUrl = `${window.location.origin}/public/tournament/${id}/categories/${selectedCatForBracket.id}/draw`;
                                navigator.clipboard.writeText(shareUrl);
                                toastSuccess("Link do sorteio copiado para a área de transferência!");
                              }}
                              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                              <Share2 size={13} />
                              Copiar Link
                            </button>
                          </div>
                        </div>

                        <div className="border-t border-indigo-100/50 my-2" />

                        {/* Realtime Status Banner */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/60 backdrop-blur-xs p-4 rounded-2xl border border-indigo-100/30">
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-3 w-3">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${publicConnected ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                              <span className={`relative inline-flex rounded-full h-3 w-3 ${publicConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                            </span>
                            <span className="text-xs font-black text-indigo-900 uppercase tracking-wide">
                              {publicConnected ? "📡 Tela Pública Conectada" : "📡 Aguardando Conexão da Tela Pública"}
                            </span>
                          </div>
                          
                          {publicConnected && publicState && (
                            <div className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                              Status: {" "}
                              <span className="text-indigo-600">
                                {publicState.status === 'idle' && (publicState.drawnCount === 0 ? "Pronto" : publicState.drawnCount === publicState.totalCount ? "Concluído" : "Aguardando")}
                                {publicState.status === 'drawing' && "Misturando urna... 🔮"}
                                {publicState.status === 'revealing' && "Sorteando... ✨"}
                                {publicState.status === 'placing' && "Inserindo competidor... 📌"}
                                {publicState.status === 'completed' && "Finalizado! 🎉"}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* If public screen is not connected, show help message */}
                        {!publicConnected && (
                          <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-2xl text-xs text-amber-800 flex items-start gap-2.5">
                            <AlertCircle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                            <div>
                              <p className="font-bold">Nenhuma tela pública ativa foi detectada para esta categoria.</p>
                              <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                                Para que você possa controlar o sorteio, abra a tela pública em uma nova janela (ou aba) clicando no botão <strong>"Assistir Sorteio 🎬"</strong> acima. Uma vez aberta, o painel se conectará automaticamente e habilitará os botões de controle abaixo.
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Progress Bar & Buttons */}
                        <div className={`space-y-4 ${!publicConnected ? 'opacity-40 pointer-events-none' : ''}`}>
                          {publicState && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                                <span>Progresso do Sorteio</span>
                                <span>{publicState.drawnCount} de {publicState.totalCount} Sorteados</span>
                              </div>
                              <div className="w-full bg-indigo-150 h-3 rounded-full overflow-hidden border border-indigo-200/50">
                                <div 
                                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${(publicState.drawnCount / Math.max(publicState.totalCount, 1)) * 100}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Buttons panel */}
                          <div className="flex flex-wrap items-center gap-2 pt-2">
                            <button
                              type="button"
                              disabled={!publicConnected || !publicState || publicState.status !== 'idle' || publicState.drawnCount === publicState.totalCount}
                              onClick={() => sendOrganizerAction('next')}
                              className="flex-1 min-w-[150px] flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <Play size={14} />
                              {publicState && publicState.drawnCount === 0 ? "Iniciar Sorteio Ao Vivo" : "Sortear Próxima Bola"}
                            </button>

                            <button
                              type="button"
                              disabled={!publicConnected || !publicState || publicState.status === 'completed'}
                              onClick={() => sendOrganizerAction('toggle_autoplay')}
                              className={`flex-1 min-w-[150px] flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all border disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
                                publicState?.autoPlay 
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600" 
                                  : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                              }`}
                            >
                              <Timer size={14} />
                              {publicState?.autoPlay ? "Pausar Automático" : "Modo Automático (Auto)"}
                            </button>

                            <button
                              type="button"
                              disabled={!publicConnected || !publicState || publicState.status === 'completed'}
                              onClick={() => sendOrganizerAction('skip')}
                              className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <SkipForward size={14} />
                              Pular Tudo (Instante)
                            </button>

                            <button
                              type="button"
                              disabled={!publicConnected || !publicState || publicState.drawnCount === 0}
                              onClick={() => sendOrganizerAction('reset')}
                              className="flex-1 min-w-[120px] flex items-center justify-center gap-2 px-4 py-3 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <RefreshCw size={14} />
                              Reiniciar Sorteio
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto pb-8">
                      <div className="flex gap-8 min-w-max p-4 flex-col">
                        {/* Renderização do Chaveamento (Bracket) */}
                        {activeMatches.every(m => m.next_match_id === null && m.round === 1) ? (
                          /* Renderização para Grupos (Lista por grupo) */
                          <div className="w-full space-y-12 animate-in fade-in duration-300">
                            {(() => {
                              const grouped = activeMatches.reduce((acc: Record<string, any[]>, m) => {
                                const label = m.group_label || "Geral";
                                if (!acc[label]) acc[label] = [];
                                acc[label].push(m);
                                return acc;
                              }, {});

                              const list: Array<{ label: string; displayName: string; filterTeamIds?: string[]; groupMatches: any[] }> = [];

                              Object.entries(grouped)
                                .sort(([a], [b]) => a.localeCompare(b))
                                .forEach(([label, groupMatches]: [string, any[]]) => {
                                  const delimiterRegex = /\s+[xX]\s+/;
                                  if (delimiterRegex.test(label)) {
                                    const parts = label.split(delimiterRegex);
                                    const leftName = parts[0].trim();
                                    const rightName = parts[1].trim();

                                    const leftTeamIds = Array.from(new Set(groupMatches.map(m => m.team1_id).filter(Boolean))) as string[];
                                    const rightTeamIds = Array.from(new Set(groupMatches.map(m => m.team2_id).filter(Boolean))) as string[];

                                    list.push({
                                      label: label + "_" + leftName,
                                      displayName: leftName,
                                      filterTeamIds: leftTeamIds,
                                      groupMatches
                                    });

                                    list.push({
                                      label: label + "_" + rightName,
                                      displayName: rightName,
                                      filterTeamIds: rightTeamIds,
                                      groupMatches
                                    });
                                  } else {
                                    list.push({
                                      label,
                                      displayName: label,
                                      groupMatches
                                    });
                                  }
                                });

                              return list.map(({ label, displayName, filterTeamIds, groupMatches }) => (
                                <div key={label} className="space-y-6">
                                  <div className="flex items-center gap-4">
                                    <div className="h-px flex-1 bg-slate-100"></div>
                                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.3em]">
                                      GRUPO {displayName}
                                    </h3>
                                    <div className="h-px flex-1 bg-slate-100"></div>
                                  </div>
                                  
                                  <ParticipationTable 
                                    matches={groupMatches} 
                                    title={`Classificação - Grupo ${displayName}`} 
                                    filterTeamIds={filterTeamIds} 
                                  />
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {groupMatches.map(match => (
                                      <div 
                                        key={match.id}
                                        className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-indigo-400"
                                        onClick={() => {
                                          setSelectedMatch(match);
                                          setShowMatchModal(true);
                                        }}
                                      >
                                        <div className="flex flex-col mb-3 pb-2 border-b border-slate-50">
                                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                             <MapPin size={10} className="shrink-0" />
                                             <span className="truncate">{match.venue?.name || "Local a definir"}{match.court ? ` - ${match.court}` : ''}</span>
                                          </div>
                                          <div className="text-[9px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                                             <Calendar size={10} className="shrink-0" />
                                             <span>{match.scheduled_time ? parseLocalTime(match.scheduled_time)?.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : "Data a definir"}</span>
                                          </div>
                                        </div>
                                        <div className="space-y-3">
                                          <div className={`flex justify-between items-center p-2 rounded-lg ${match.winner_id === match.team1_id && match.team1_id ? "bg-emerald-50 text-emerald-900" : ""}`}>
                                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                              {match.team1?.institution?.logo_url && (
                                                <img src={match.team1.institution.logo_url} alt="Logo" className="w-4 h-4 object-contain" onError={(e: any) => e.target.style.display = 'none'} />
                                              )}
                                              <span className="text-[10px] font-bold truncate max-w-[180px]" title={match.roster1?.athlete_name ? `${match.roster1.athlete_name} (${match.roster1.institution_name})` : (match.team1?.institution?.name || "Aguardando...")}>
                                                {match.roster1?.athlete_name 
                                                  ? `${match.roster1.athlete_name} (${match.roster1.institution_name})` 
                                                  : (match.team1?.institution?.name || "Aguardando...")}
                                              </span>
                                            </div>
                                            <span className="font-mono font-bold text-xs shrink-0">{match.score1}</span>
                                          </div>
                                          <div className="border-t border-slate-50"></div>
                                          <div className={`flex justify-between items-center p-2 rounded-lg ${match.winner_id === match.team2_id && match.team2_id ? "bg-emerald-50 text-emerald-900" : ""}`}>
                                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                              {match.team2?.institution?.logo_url && (
                                                <img src={match.team2.institution.logo_url} alt="Logo" className="w-4 h-4 object-contain" onError={(e: any) => e.target.style.display = 'none'} />
                                              )}
                                              <span className="text-[10px] font-bold truncate max-w-[180px]" title={match.roster2?.athlete_name ? `${match.roster2.athlete_name} (${match.roster2.institution_name})` : (match.team2?.institution?.name || "Aguardando...")}>
                                                {match.roster2?.athlete_name 
                                                  ? `${match.roster2.athlete_name} (${match.roster2.institution_name})` 
                                                  : (match.team2?.institution?.name || "Aguardando...")}
                                              </span>
                                            </div>
                                            <span className="font-mono font-bold text-xs shrink-0">{match.score2}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ));
                            })()}
                          </div>
                        ) : (
                          <div className="flex gap-8 min-w-max p-4 animate-in fade-in duration-300">
                            {Array.from({ length: Math.max(...activeMatches.map(m => m.round), 1) }).map((_, rIdx) => {
                              const roundNum = rIdx + 1;
                              const roundMatches = activeMatches.filter(m => m.round === roundNum);
                              
                              return (
                                <div key={roundNum} className="space-y-6 w-64">
                                  <h4 className="text-center text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">
                                    {roundNum === 1 ? "Eliminatórias" : roundNum === 2 ? "Semi-Final" : roundNum === 3 ? "Final" : `Rodada ${roundNum}`}
                                  </h4>
                                  <div className="flex flex-col justify-around h-full gap-8">
                                    {roundMatches.map(match => (
                                      <div 
                                        key={match.id}
                                        className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-indigo-400"
                                        onClick={() => {
                                          setSelectedMatch(match);
                                          setShowMatchModal(true);
                                        }}
                                      >
                                        <div className="flex flex-col mb-3 pb-2 border-b border-slate-50">
                                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                             <MapPin size={10} className="shrink-0" />
                                             <span className="truncate">{match.venue?.name || "Local a definir"}{match.court ? ` - ${match.court}` : ''}</span>
                                          </div>
                                          <div className="text-[9px] font-bold text-slate-400 flex items-center gap-1 mt-0.5">
                                             <Calendar size={10} className="shrink-0" />
                                             <span>{match.scheduled_time ? parseLocalTime(match.scheduled_time)?.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : "Data a definir"}</span>
                                          </div>
                                        </div>
                                        <div className="space-y-3">
                                          <div className={`flex justify-between items-center p-2 rounded-lg ${match.winner_id === match.team1_id && match.team1_id ? "bg-emerald-50 text-emerald-900" : ""}`}>
                                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                              {match.team1?.institution?.logo_url && (
                                                <img src={match.team1.institution.logo_url} alt="Logo" className="w-4 h-4 object-contain" onError={(e: any) => e.target.style.display = 'none'} />
                                              )}
                                              <span className="text-[10px] font-bold truncate max-w-[180px]" title={match.roster1?.athlete_name ? `${match.roster1.athlete_name} (${match.roster1.institution_name})` : (match.team1?.institution?.name || "Aguardando...")}>
                                                {match.roster1?.athlete_name 
                                                  ? `${match.roster1.athlete_name} (${match.roster1.institution_name})` 
                                                  : (match.team1?.institution?.name || "Aguardando...")}
                                              </span>
                                            </div>
                                            <span className="font-mono font-bold text-xs shrink-0">{match.score1}</span>
                                          </div>
                                          <div className="border-t border-slate-50"></div>
                                          <div className={`flex justify-between items-center p-2 rounded-lg ${match.winner_id === match.team2_id && match.team2_id ? "bg-emerald-50 text-emerald-900" : ""}`}>
                                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                              {match.team2?.institution?.logo_url && (
                                                <img src={match.team2.institution.logo_url} alt="Logo" className="w-4 h-4 object-contain" onError={(e: any) => e.target.style.display = 'none'} />
                                              )}
                                              <span className="text-[10px] font-bold truncate max-w-[180px]" title={match.roster2?.athlete_name ? `${match.roster2.athlete_name} (${match.roster2.institution_name})` : (match.team2?.institution?.name || "Aguardando...")}>
                                                {match.roster2?.athlete_name 
                                                  ? `${match.roster2.athlete_name} (${match.roster2.institution_name})` 
                                                  : (match.team2?.institution?.name || "Aguardando...")}
                                              </span>
                                            </div>
                                            <span className="font-mono font-bold text-xs shrink-0">{match.score2}</span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                </div>
              );
            })()}
                  </div>
                )}

            <MatchModal
              isOpen={showMatchModal}
              onClose={() => setShowMatchModal(false)}
              selectedMatch={selectedMatch}
              tournamentId={id!}
              onStartLiveMatch={(matchId) => setLiveMatchId(matchId)}
              onSave={() => fetchMatches()}
            />

            {/* Modal de Confirmação de Reset para Múltiplas Fases */}
            {resetModalOpen && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md relative text-center"
                >
                  <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trash2 size={32} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Resetar Chaveamento</h3>
                  <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                    Esta categoria possui múltiplas fases configuradas. Como você deseja redefinir a tabela de jogos?
                  </p>
                  <div className="space-y-3">
                    <button 
                      type="button" 
                      onClick={() => {
                        setResetModalOpen(false);
                        executeReset(activePhaseIndex);
                      }}
                      className="w-full bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 px-5 py-3.5 rounded-xl font-bold transition-colors text-sm cursor-pointer"
                    >
                      Resetar Apenas a Fase Ativa ({selectedCatForBracket?.rules_config?.phases?.[activePhaseIndex - 1]?.name || `${activePhaseIndex}ª Fase`})
                    </button>
                    <button 
                      type="button" 
                      onClick={async () => {
                        const isConfirmed = await confirm({
                          title: "Resetar Chaveamento Completo",
                          message: "Tem certeza que deseja apagar absolutamente TODAS as partidas de todas as fases desta categoria? Isso limpará toda a progressão do torneio!",
                          variant: "danger",
                          confirmText: "Sim, Resetar Tudo",
                          cancelText: "Cancelar"
                        });
                        if (isConfirmed) {
                          setResetModalOpen(false);
                          executeReset(undefined);
                        }
                      }}
                      className="w-full bg-red-600 text-white hover:bg-red-700 px-5 py-3.5 rounded-xl font-bold transition-colors text-sm cursor-pointer shadow-lg shadow-red-100"
                    >
                      Resetar Todo o Chaveamento (Todas as Fases)
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setResetModalOpen(false)}
                      className="w-full px-5 py-3 rounded-xl font-bold border border-slate-200 hover:bg-slate-50 transition-colors text-sm text-slate-700 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </div>
        )}

        {activeTab === "escala" && (
          <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold bg-white rounded-2xl shadow-sm border border-red-100">Erro ao processar a escala deste torneio.</div>}>
            <TournamentScheduler tournamentId={id!} mode="schedule" />
          </ErrorBoundary>
        )}

        {activeTab === "arbitragem" && (
          <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold bg-white rounded-2xl shadow-sm border border-red-100">Erro ao carregar a arbitragem deste torneio.</div>}>
            <TournamentScheduler tournamentId={id!} mode="refereeing" />
          </ErrorBoundary>
        )}

        {activeTab === "estatisticas" && (
          <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold bg-white rounded-2xl shadow-sm border border-red-100">Erro ao processar as estatísticas deste torneio.</div>}>
            <TournamentStats tournamentId={id!} />
          </ErrorBoundary>
        )}

        {activeTab === "classificacao" && (
          <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold bg-white rounded-2xl shadow-sm border border-red-100">Erro ao processar a classificação deste torneio.</div>}>
            <TournamentClassification tournamentId={id!} />
          </ErrorBoundary>
        )}

        {activeTab === "comunidade" && (
          <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold bg-white rounded-2xl shadow-sm border border-red-100">Erro ao carregar a comunidade deste torneio.</div>}>
            <TournamentCommunity tournamentId={id!} isOrganizer={true} />
          </ErrorBoundary>
        )}

        {/* Modal Gerar Link de Pagamento */}
        {showPayLinkModal && selectedRegForLink && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-md relative"
            >
              <button 
                onClick={() => setShowPayLinkModal(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={20} />
              </button>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Gerar Link de Pagamento</h3>
                    <p className="text-slate-400 text-xs font-semibold">{selectedRegForLink.institution?.name}</p>
                  </div>
                </div>

                <form onSubmit={handleGeneratePaymentLink} className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-400">Total de Equipes:</span>
                      <span className="text-slate-700">{selectedRegForLink.modalityCount || 0}</span>
                    </div>
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-400">Taxa por Equipe:</span>
                      <span className="text-slate-700">{formatCurrency(subSettings?.teamFee || 0)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold pt-2 border-t border-slate-200">
                      <span className="text-slate-500">Valor Total Devido:</span>
                      <span className="text-indigo-600 text-sm">
                        {formatCurrency((subSettings?.teamFee || 0) * (selectedRegForLink.modalityCount || 0))}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500">Data Limite de Vencimento</label>
                    <input
                      type="date"
                      required
                      value={payLinkDeadline}
                      onChange={e => setPayLinkDeadline(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-xs font-semibold text-slate-700 bg-white"
                    />
                  </div>



                  <button
                    type="submit"
                    disabled={generatingLink}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-100 transition flex items-center justify-center gap-2 text-sm cursor-pointer disabled:opacity-50 mt-4"
                  >
                    {generatingLink ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Gerando Link...
                      </>
                    ) : (
                      <>
                        <span>Gerar Link de Cobrança</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

const StepCard = ({ title, desc, completed, onClick }: any) => (
  <div 
    onClick={onClick}
    className="group p-5 rounded-2xl border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all cursor-pointer flex items-center justify-between"
  >
    <div className="flex items-center gap-4">
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
        completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200 group-hover:border-indigo-400"
      }`}>
        {completed && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
      </div>
      <div>
        <h4 className="font-bold text-slate-800 group-hover:text-indigo-700">{title}</h4>
        <p className="text-sm text-slate-500">{desc}</p>
      </div>
    </div>
    <ChevronLeft className="rotate-180 text-slate-300 group-hover:text-indigo-400 transition-colors" />
  </div>
);
