import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  dismiss: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Icons & Colors
// ---------------------------------------------------------------------------
const TOAST_CONFIG: Record<ToastType, { icon: React.FC<any>; bg: string; border: string; text: string; iconColor: string }> = {
  success: {
    icon: CheckCircle2,
    bg: "bg-emerald-950/90",
    border: "border-emerald-700/50",
    text: "text-emerald-100",
    iconColor: "text-emerald-400",
  },
  error: {
    icon: XCircle,
    bg: "bg-red-950/90",
    border: "border-red-700/50",
    text: "text-red-100",
    iconColor: "text-red-400",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-amber-950/90",
    border: "border-amber-700/50",
    text: "text-amber-100",
    iconColor: "text-amber-400",
  },
  info: {
    icon: Info,
    bg: "bg-slate-800/90",
    border: "border-slate-600/50",
    text: "text-slate-100",
    iconColor: "text-indigo-400",
  },
};

// ---------------------------------------------------------------------------
// Individual Toast Item
// ---------------------------------------------------------------------------
function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const cfg = TOAST_CONFIG[toast.type];
  const Icon = cfg.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 350, damping: 30 }}
      className={`flex items-start gap-3 w-full max-w-sm px-4 py-3.5 rounded-2xl border backdrop-blur-xl shadow-2xl ${cfg.bg} ${cfg.border} ${cfg.text}`}
      role="alert"
    >
      <Icon size={20} className={`shrink-0 mt-0.5 ${cfg.iconColor}`} />
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-bold leading-tight mb-0.5">{toast.title}</p>
        )}
        <p className="text-sm leading-snug font-medium opacity-90">{toast.message}</p>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity mt-0.5"
        aria-label="Fechar notificação"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info", title?: string, duration = 4500) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => [...prev.slice(-4), { id, type, title, message, duration }]);
      const timer = setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  const success = useCallback((msg: string, title?: string) => toast(msg, "success", title), [toast]);
  const error = useCallback((msg: string, title?: string) => toast(msg, "error", title), [toast]);
  const warning = useCallback((msg: string, title?: string) => toast(msg, "warning", title), [toast]);
  const info = useCallback((msg: string, title?: string) => toast(msg, "info", title), [toast]);

  return (
    <ToastContext.Provider value={{ toasts, toast, success, error, warning, info, dismiss }}>
      {children}
      {/* Toast Container */}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
