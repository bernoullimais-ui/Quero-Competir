import React, { createContext, useContext, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { AlertTriangle, HelpCircle } from "lucide-react";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions | null;
  }>({
    isOpen: false,
    options: null,
  });

  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    setState({ isOpen: true, options });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const handleClose = useCallback((value: boolean) => {
    setState({ isOpen: false, options: null });
    if (resolver.current) {
      resolver.current(value);
      resolver.current = null;
    }
  }, []);

  const options = state.options;
  const isDanger = options?.variant === "danger" || options?.variant === "warning";

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <AnimatePresence>
        {state.isOpen && options && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => handleClose(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.3 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 overflow-hidden font-sans"
            >
              <div className="flex gap-4 items-start">
                <div className={`shrink-0 p-3 rounded-2xl ${
                  isDanger ? "bg-red-50 text-red-500" : "bg-indigo-50 text-indigo-600"
                }`}>
                  {isDanger ? <AlertTriangle size={24} /> : <HelpCircle size={24} />}
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 mb-1 leading-snug">
                    {options.title || "Confirmar ação"}
                  </h3>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed">
                    {options.message}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => handleClose(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition duration-150 cursor-pointer text-sm"
                >
                  {options.cancelText || "Cancelar"}
                </button>
                <button
                  type="button"
                  onClick={() => handleClose(true)}
                  className={`px-5 py-2.5 rounded-xl font-bold text-white transition duration-150 cursor-pointer text-sm shadow-lg ${
                    isDanger 
                      ? "bg-red-600 hover:bg-red-700 shadow-red-100" 
                      : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100"
                  }`}
                >
                  {options.confirmText || "Confirmar"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ConfirmContext.Provider>
  );
}
