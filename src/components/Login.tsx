import React, { useState } from "react";
import { ArrowRight, Check, AlertCircle, Eye, EyeOff, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LoginProps {
  onLoginSuccess: (user: any) => void;
  isModal?: boolean;
  onClose?: () => void;
}

export default function Login({ onLoginSuccess, isModal = false, onClose }: LoginProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  
  // Input fields
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  
  // Status states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    const endpoint = isSignUp ? "/api/auth/register" : "/api/auth/login";
    const payload = isSignUp
      ? { email, password, name, role: "guardian" }
      : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMessage(isSignUp ? "Cadastro realizado com sucesso!" : "Login efetuado com sucesso!");
        setTimeout(() => {
          onLoginSuccess(data);
          if (onClose) onClose();
        }, 600);
      } else {
        setError(data.error || "Erro ao realizar operação.");
      }
    } catch (err: any) {
      setError("Erro ao conectar com o servidor: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <div className="relative w-full max-w-[440px]" id="login-container">
      {/* Brand Banner */}
      <div className="flex flex-col items-center mb-6 text-center">
        <img src="/logo.png" alt="Eu Quero Competir" className="h-14 w-auto object-contain mb-1" />
      </div>

      {/* Auth Box */}
      <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-7 shadow-2xl relative overflow-hidden" id="login-card">
        
        {/* Modal Close Button */}
        {isModal && onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition cursor-pointer"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        )}

        {/* Title */}
        <div className="mb-6 text-center">
          <h2 className="text-xl font-extrabold text-white">
            {isSignUp ? "Criar Conta de Responsável" : "Acesse sua Conta"}
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            {isSignUp
              ? "Cadastre-se para gerenciar inscrições de atletas"
              : "Digite suas credenciais de acesso para entrar no sistema"}
          </p>
        </div>

        {/* Feedback banners */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-4 p-3.5 rounded-xl bg-red-950/50 border border-red-900/50 text-red-400 text-xs flex items-start gap-2 font-semibold leading-relaxed"
              id="login-error-banner"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}

          {successMessage && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-4 p-3.5 rounded-xl bg-emerald-950/50 border border-emerald-900/50 text-emerald-400 text-xs flex items-start gap-2 font-semibold leading-relaxed"
              id="login-success-banner"
            >
              <Check size={16} className="shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sign-in / Sign-up Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Name field (for Sign-up only) */}
          {isSignUp && (
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Nome Completo
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João da Silva"
                className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-sm text-white font-medium outline-none transition duration-150"
              />
            </div>
          )}

          {/* Email field */}
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Endereço de E-mail
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nome@dominio.com"
              className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-sm text-white font-medium outline-none transition duration-150"
            />
          </div>

          {/* Password field */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Senha secreta
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-500 hover:text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1 cursor-pointer"
              >
                {showPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>{showPassword ? "Ocultar" : "Mostrar"}</span>
              </button>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl px-4 py-3 text-sm text-white font-medium outline-none transition duration-150 font-mono"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 text-sm disabled:opacity-50 cursor-pointer"
          >
            <span>{loading ? "Processando..." : isSignUp ? "Registrar e Entrar" : "Entrar no Sistema"}</span>
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Toggle between Sign Up and Sign In */}
        <div className="mt-5 text-center border-t border-slate-800/80 pt-4">
          {isSignUp ? (
            <button
              type="button"
              onClick={() => {
                setIsSignUp(false);
                setError(null);
                setSuccessMessage(null);
              }}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:underline transition duration-150 cursor-pointer"
            >
              Já possui uma conta? Entrar no sistema
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsSignUp(true);
                setError(null);
                setSuccessMessage(null);
              }}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:underline transition duration-150 cursor-pointer"
            >
              Novo por aqui? Cadastre-se como responsável por atletas
            </button>
          )}
        </div>

      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2 }}
          className="w-full flex justify-center"
        >
          {formContent}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Decorative colored glow orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-900/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/20 rounded-full blur-[120px] pointer-events-none" />
      {formContent}
    </div>
  );
}
