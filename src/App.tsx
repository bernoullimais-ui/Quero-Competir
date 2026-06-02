/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from "react-router-dom";
import { LayoutDashboard, Trophy, Building2, Users, Settings, Activity, Shield, MapPin, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { applyBrandColors } from "./utils/theme";

// Auth Components
import Login from "./components/Login.tsx";
import SuperAdminDashboard from "./components/SuperAdminDashboard.tsx";
import GuardianDashboard from "./components/GuardianDashboard.tsx";
import { ToastProvider } from "./components/ui/Toast.tsx";
import { ConfirmProvider } from "./components/ui/ConfirmDialog.tsx";

// Other Components
import NewInstitution from "./components/NewInstitution.tsx";
import InstitutionList from "./components/InstitutionList.tsx";
import NewTournament from "./components/NewTournament.tsx";
import TournamentList from "./components/TournamentList.tsx";
import TournamentDashboard from "./components/TournamentDashboard.tsx";
import AthleteFilter from "./components/AthleteFilter.tsx";
import PublicScoreboard from "./components/PublicScoreboard.tsx";
import LiveVenueScoreboard from "./components/LiveVenueScoreboard.tsx";
import StaffManagement from "./components/StaffManagement.tsx";
import VenueManagement from "./components/VenueManagement.tsx";
import PublicTournamentView from "./components/PublicTournamentView.tsx";
import InstitutionPortal from "./components/InstitutionPortal.tsx";
import VenuePortal from "./components/VenuePortal.tsx";
import PublicAthleteRegistration from "./components/PublicAthleteRegistration.tsx";
import SettingsPage from "./components/Settings";
import PublicInvitationPage from "./components/PublicInvitationPage.tsx";
import DrawCeremony from "./components/DrawCeremony.tsx";
import PublicPaymentPage from "./components/PublicPaymentPage.tsx";

const queryClient = new QueryClient();

const SidebarItem = ({ icon: Icon, label, href, active }: any) => (
  <Link to={href}>
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-600"
    }`}>
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </div>
  </Link>
);

const Layout = ({ children, onLogout }: { children: React.ReactNode; onLogout: () => void }) => {
  const location = useLocation();
  const [org, setOrg] = React.useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
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
    fetch("/api/tournaments/organization", { headers })
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) {
          setOrg(data);
          applyBrandColors(data);
        }
      })
      .catch(console.error);
  }, []);
  
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-white p-6 hidden lg:block">
        <div className="mb-10 flex items-center gap-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <Activity size={24} />
          </div>
          <span className="text-xl font-bold tracking-tight">Quero Competir</span>
        </div>
        
        <nav className="space-y-2">
          <SidebarItem icon={LayoutDashboard} label="Dashboard" href="/" active={location.pathname === "/"} />
          <SidebarItem icon={Building2} label="Instituições" href="/instituicoes" active={location.pathname.startsWith("/instituicoes")} />
          <SidebarItem icon={Trophy} label="Torneios" href="/torneios" active={location.pathname.startsWith("/torneios")} />
          <SidebarItem icon={Users} label="Atletas" href="/atletas" active={location.pathname === "/atletas"} />
          <SidebarItem icon={Shield} label="Arbitragem" href="/staff" active={location.pathname === "/staff"} />
          <SidebarItem icon={MapPin} label="Sedes" href="/sedes" active={location.pathname === "/sedes"} />
          <div className="pt-10 border-t border-slate-100 mt-6 space-y-2">
            <SidebarItem icon={Settings} label="Configurações" href="/configuracoes" active={location.pathname === "/configuracoes"} />
          </div>
        </nav>
      </aside>

      {/* Mobile Drawer Navigation */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0 bg-slate-950/40 backdrop-blur-xs"
            />
            
            {/* Sidebar drawer content */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="absolute top-0 left-0 bottom-0 w-72 bg-white p-6 shadow-2xl flex flex-col border-r border-slate-100"
            >
              <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                    <Activity size={24} />
                  </div>
                  <span className="text-xl font-bold tracking-tight">Quero Competir</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl cursor-pointer"
                  aria-label="Fechar menu"
                >
                  <X size={20} />
                </button>
              </div>

              <nav className="space-y-2 flex-1">
                <SidebarItem icon={LayoutDashboard} label="Dashboard" href="/" active={location.pathname === "/"} />
                <SidebarItem icon={Building2} label="Instituições" href="/instituicoes" active={location.pathname.startsWith("/instituicoes")} />
                <SidebarItem icon={Trophy} label="Torneios" href="/torneios" active={location.pathname.startsWith("/torneios")} />
                <SidebarItem icon={Users} label="Atletas" href="/atletas" active={location.pathname === "/atletas"} />
                <SidebarItem icon={Shield} label="Arbitragem" href="/staff" active={location.pathname === "/staff"} />
                <SidebarItem icon={MapPin} label="Sedes" href="/sedes" active={location.pathname === "/sedes"} />
                <div className="pt-8 border-t border-slate-100 mt-6 space-y-2">
                  <SidebarItem icon={Settings} label="Configurações" href="/configuracoes" active={location.pathname === "/configuracoes"} />
                </div>
              </nav>

              <div className="mt-auto pt-6 border-t border-slate-100">
                <div className="flex items-center gap-3 px-4 py-2">
                  {org?.logo_url ? (
                    <img src={org.logo_url} alt="Logo" className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-205 flex items-center justify-center text-xs font-bold text-slate-500">ORG</div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{org?.name || "Organizador ABC"}</p>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest">Painel Organizador</p>
                  </div>
                </div>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-4 lg:px-8 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 text-slate-600 hover:bg-slate-50 rounded-xl lg:hidden cursor-pointer"
              aria-label="Abrir menu"
            >
              <Menu size={22} />
            </button>
            <h1 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
              {location.pathname === "/" ? "Visão Geral" : location.pathname.substring(1).split("/")[0]}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 mr-2">
              {org?.logo_url ? (
                <img src={org.logo_url} alt="Logo" className="w-8 h-8 rounded-full border border-slate-200 object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-205 flex items-center justify-center text-xs font-bold text-slate-500">ORG</div>
              )}
              <span className="text-sm font-medium hidden sm:inline">{org?.name || "Organizador ABC"}</span>
            </div>
            <button
              onClick={onLogout}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2 px-4 rounded-xl border border-slate-200 transition duration-150 cursor-pointer"
            >
              Sair
            </button>
          </div>
        </header>
        
        <div className="p-4 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

const Home = () => {
  const [tournaments, setTournaments] = React.useState<any[]>([]);
  const [membersCount, setMembersCount] = React.useState<number>(0);
  const [institutionsCount, setInstitutionsCount] = React.useState<number>(0);

  React.useEffect(() => {
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
    fetch("/api/tournaments", { headers })
      .then(res => res.json())
      .then(data => {
        setTournaments(data.filter((t: any) => t.status === "active"));
      })
      .catch(console.error);

    fetch("/api/members", { headers })
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) setMembersCount(data.length);
      })
      .catch(console.error);

    fetch("/api/institutions", { headers })
      .then(res => res.json())
      .then(data => {
        if (data && !data.error) setInstitutionsCount(data.length);
      })
      .catch(console.error);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: "Atletas Inscritos", value: membersCount.toString(), trend: "", color: "indigo" },
          { label: "Torneios Ativos", value: tournaments.length.toString(), trend: "", color: "emerald" },
          { label: "Instituições Ativas", value: institutionsCount.toString(), trend: "", color: "amber" }
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition duration-200">
            <p className="text-sm text-slate-500 font-medium">{stat.label}</p>
            <div className="mt-2 flex items-baseline justify-between">
              <h3 className="text-3xl font-extrabold text-slate-800">{stat.value}</h3>
              {stat.trend && (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  {stat.trend}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
        <h2 className="text-lg font-bold mb-4 text-slate-800">Ações Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center mb-8">
          <Link to="/torneios/new" className="p-6 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all group">
            <Trophy className="mx-auto mb-2 text-slate-400 group-hover:text-indigo-600" />
            <span className="text-sm font-semibold text-slate-600 group-hover:text-indigo-600">Criar Torneio</span>
          </Link>
          <Link to="/instituicoes/new" className="p-6 rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition-all group">
            <Building2 className="mx-auto mb-2 text-slate-400 group-hover:text-indigo-600" />
            <span className="text-sm font-semibold text-slate-600 group-hover:text-indigo-600">Novo Clube/Escola</span>
          </Link>
        </div>

        {tournaments.length > 0 && (
          <>
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Acesso Rápido - Torneios Ativos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
              {tournaments.map(t => (
                <Link key={t.id} to={`/torneios/${t.id}`} className="p-6 rounded-2xl border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 transition-all group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-2 h-full bg-emerald-400"></div>
                  <Trophy className="mx-auto mb-2 text-emerald-500 group-hover:text-emerald-600" size={24} />
                  <span className="block text-sm font-bold text-slate-800">{t.name}</span>
                  <span className="text-xs text-slate-500 font-medium">Acessar painel</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const ProtectedInstitutionPortal = ({ currentUser, onLogout }: { currentUser: any; onLogout: () => void }) => {
  const location = useLocation();
  const pathId = location.pathname.split("/").pop();

  if (currentUser.role !== "institution") {
    return <Navigate to="/" replace />;
  }

  if (currentUser.referenceId !== pathId) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <Shield size={48} className="text-red-500 mb-4 animate-bounce" />
        <h2 className="text-xl font-bold">Acesso não autorizado</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-sm leading-relaxed">
          Sua conta de instituição ({currentUser.name}) não está autorizada a visualizar outros portais.
        </p>
        <button
          onClick={onLogout}
          className="mt-6 py-2 px-5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
        >
          Fazer Login com Outra Conta
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold">Erro ao carregar o portal.</div>}>
      <InstitutionPortal />
    </ErrorBoundary>
  );
};

const ProtectedVenuePortal = ({ currentUser, onLogout }: { currentUser: any; onLogout: () => void }) => {
  const location = useLocation();
  const pathId = location.pathname.split("/").pop();

  if (currentUser.role !== "venue") {
    return <Navigate to="/" replace />;
  }

  if (currentUser.referenceId !== pathId) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-6 text-center">
        <Shield size={48} className="text-red-500 mb-4 animate-bounce" />
        <h2 className="text-xl font-bold">Acesso não autorizado</h2>
        <p className="text-sm text-slate-400 mt-2 max-w-sm leading-relaxed">
          Sua conta de sede ({currentUser.name}) não está autorizada a visualizar outros portais.
        </p>
        <button
          onClick={onLogout}
          className="mt-6 py-2 px-5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition cursor-pointer"
        >
          Fazer Login com Outra Conta
        </button>
      </div>
    );
  }

  return (
    <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold">Erro ao carregar o portal da sede.</div>}>
      <VenuePortal currentUser={currentUser} onLogout={onLogout} />
    </ErrorBoundary>
  );
};

const TitleUpdater = ({ currentUser }: { currentUser: any }) => {
  const location = useLocation();

  React.useEffect(() => {
    const path = location.pathname;
    
    if (path.startsWith("/public/match/")) {
      document.title = "Quero Competir - Placar";
    } else if (path.startsWith("/public/tournament/")) {
      document.title = "Quero Competir - Torneio";
    } else if (path.startsWith("/public/register-athlete/")) {
      document.title = "Quero Competir - Inscrição";
    } else if (path.startsWith("/invite/")) {
      document.title = "Quero Competir - Convite";
    } else if (!currentUser) {
      document.title = "Quero Competir - Login";
    } else {
      switch (currentUser.role) {
        case "super_admin":
          document.title = `Quero Competir - (${currentUser.name || "Admin"})`;
          break;
        case "guardian":
          document.title = `Quero Competir - (${currentUser.name || "Responsável"})`;
          break;
        case "institution":
          document.title = `Quero Competir - (${currentUser.name || "Instituição"})`;
          break;
        case "organizer":
          document.title = `Quero Competir - (${currentUser.name || "Organizador"})`;
          break;
        default:
          document.title = currentUser.name ? `Quero Competir - (${currentUser.name})` : "Quero Competir";
      }
    }
  }, [location, currentUser]);

  return null;
};

export default function App() {
  const [currentUser, setCurrentUser] = React.useState<any>(() => {
    const saved = localStorage.getItem("currentUser");
    return saved ? JSON.parse(saved) : null;
  });

  const handleLoginSuccess = (user: any) => {
    localStorage.setItem("currentUser", JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem("currentUser");
    setCurrentUser(null);
    window.location.href = "/";
  };

  return (
    <ToastProvider>
      <ConfirmProvider>
        <QueryClientProvider client={queryClient}>
          <Router>
            <TitleUpdater currentUser={currentUser} />
            <Routes>
              {/* Public views accessible without logging in */}
              <Route path="/public/match/:matchId" element={
                <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold">Erro ao carregar o placar.</div>}>
                  <PublicScoreboard />
                </ErrorBoundary>
              } />
              <Route path="/public/tournament/:tournamentId/venue/:venueId/live" element={
                <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold">Erro ao carregar o placar de sede.</div>}>
                  <LiveVenueScoreboard />
                </ErrorBoundary>
              } />
              
              <Route path="/public/tournament/:id" element={
                <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold">Erro ao carregar o torneio.</div>}>
                  <PublicTournamentView />
                </ErrorBoundary>
              } />

              <Route path="/public/tournament/:id/categories/:categoryId/draw" element={
                <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold">Erro ao carregar a cerimônia de sorteio.</div>}>
                  <DrawCeremony />
                </ErrorBoundary>
              } />

              <Route path="/public/register-athlete/:subId" element={
                <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold">Erro ao carregar inscrição individual.</div>}>
                  <PublicAthleteRegistration />
                </ErrorBoundary>
              } />

              <Route path="/pay/institution/:id" element={
                <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold">Erro ao carregar link de pagamento.</div>}>
                  <PublicPaymentPage />
                </ErrorBoundary>
              } />

              <Route path="/invite/:id" element={
                <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold">Erro ao carregar convite.</div>}>
                  <PublicInvitationPage onLoginSuccess={handleLoginSuccess} />
                </ErrorBoundary>
              } />

              {/* Secure Routing Hierarchy */}
              <Route path="/*" element={
                !currentUser ? (
                  <Login onLoginSuccess={handleLoginSuccess} />
                ) : currentUser.role === "super_admin" ? (
                  <ErrorBoundary fallback={<div className="p-8 text-center text-red-500">Erro no painel do administrador.</div>}>
                    <SuperAdminDashboard currentUser={currentUser} onLogout={handleLogout} />
                  </ErrorBoundary>
                ) : currentUser.role === "guardian" ? (
                  <ErrorBoundary fallback={<div className="p-8 text-center text-red-500">Erro no painel do responsável.</div>}>
                    <GuardianDashboard currentUser={currentUser} onLogout={handleLogout} />
                  </ErrorBoundary>
                ) : currentUser.role === "institution" ? (
                  /* Enforce correct institution routing */
                  <Navigate to={`/portal/institution/${currentUser.referenceId}`} replace />
                ) : currentUser.role === "venue" ? (
                  /* Enforce correct venue routing */
                  <Navigate to={`/portal/venue/${currentUser.referenceId}`} replace />
                ) : (
                  /* Organizer accesses all general panel routes */
                  <Layout onLogout={handleLogout}>
                    <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 bg-white rounded-2xl shadow-sm border border-red-100">Erro inesperado no painel. Tente recarregar a página.</div>}>
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/instituicoes" element={<InstitutionList />} />
                        <Route path="/instituicoes/new" element={<NewInstitution />} />
                        <Route path="/instituicoes/:id/edit" element={<NewInstitution />} />
                        <Route path="/torneios" element={<TournamentList />} />
                        <Route path="/torneios/new" element={<NewTournament />} />
                        <Route path="/torneios/:id" element={<TournamentDashboard />} />
                        <Route path="/atletas" element={<AthleteFilter />} />
                        <Route path="/staff" element={<StaffManagement />} />
                        <Route path="/sedes" element={<VenueManagement />} />
                        <Route path="/configuracoes" element={<SettingsPage />} />
                        <Route path="/portal/institution/:id" element={<InstitutionPortal />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                      </Routes>
                    </ErrorBoundary>
                  </Layout>
                )
              } />

              {/* Enforce protected access over Institution Portal directly */}
              <Route path="/portal/institution/:id" element={
                !currentUser ? (
                  <Login onLoginSuccess={handleLoginSuccess} />
                ) : (
                  <ProtectedInstitutionPortal currentUser={currentUser} onLogout={handleLogout} />
                )
              } />

              {/* Enforce protected access over Venue Portal directly */}
              <Route path="/portal/venue/:id" element={
                !currentUser ? (
                  <Login onLoginSuccess={handleLoginSuccess} />
                ) : (
                  <ProtectedVenuePortal currentUser={currentUser} onLogout={handleLogout} />
                )
              } />
            </Routes>
          </Router>
        </QueryClientProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
