import React, { useState, useEffect } from "react";
import { User, Activity, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface Props {
  athleteId: string;
  athleteName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AthleteStatsModal({ athleteId, athleteName, isOpen, onClose }: Props) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && athleteId) {
      setLoading(true);
      fetch(`/api/members/${athleteId}/stats`)
        .then(res => res.json())
        .then(data => {
          setStats(data);
          setLoading(false);
        });
    }
  }, [isOpen, athleteId]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white w-full max-w-lg rounded-3xl p-0 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xl">
                {athleteName.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{athleteName}</h3>
                <p className="text-xs uppercase tracking-widest font-bold text-slate-400">Perfil do Atleta</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            ) : stats ? (
              <div className="space-y-6">
                
                {/* Resumo */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 text-center">
                    <span className="block text-3xl font-black text-indigo-600 leading-none">{stats.goals}</span>
                    <span className="text-[10px] uppercase font-bold text-indigo-400 tracking-widest mt-2 block">Gols</span>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 text-center">
                    <span className="block text-3xl font-black text-amber-500 leading-none">{stats.yellowCards}</span>
                    <span className="text-[10px] uppercase font-bold text-amber-600 tracking-widest mt-2 block">C. Amarelos</span>
                  </div>
                  <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-center">
                    <span className="block text-3xl font-black text-red-600 leading-none">{stats.redCards}</span>
                    <span className="text-[10px] uppercase font-bold text-red-400 tracking-widest mt-2 block">C. Vermelhos</span>
                  </div>
                </div>

                {/* Histórico de Eventos */}
                <div>
                  <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Activity size={16} className="text-slate-400" /> Histórico de Eventos
                  </h4>
                  
                  {stats.events.length > 0 ? (
                    <div className="space-y-3">
                      {stats.events.map((e: any) => {
                        const isGoal = e.event_type.startsWith('goal');
                        const isYellow = e.event_type === 'yellow_card';
                        const isRed = e.event_type === 'red_card';

                        return (
                          <div key={e.id} className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-100 rounded-xl">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              isGoal ? "bg-emerald-100 text-emerald-600" :
                              isYellow ? "bg-amber-100 text-amber-500" :
                              isRed ? "bg-red-100 text-red-500" : "bg-slate-200 text-slate-500"
                            }`}>
                              {isGoal ? "G" : isYellow ? "A" : isRed ? "V" : "•"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-700 truncate">
                                {e.match?.tournament?.name || "Torneio"} - {e.match?.category?.name || "Cat"}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {new Date(e.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <span className="text-[10px] font-black tracking-widest uppercase text-slate-400">
                              {e.period}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-slate-100 border-dashed">
                      <p className="text-slate-400 text-xs italic">Nenhum evento registrado em partidas.</p>
                    </div>
                  )}
                </div>

              </div>
            ) : null}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
