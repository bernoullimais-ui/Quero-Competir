import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trash2 } from "lucide-react";

interface EventLogProps {
  events: any[];
  recentOnly?: boolean;
  team1Id: string;
  team1Name: string;
  team2Name: string;
  onDeleteEvent: (eventId: string) => void;
  sportType?: string;
}

const getEventName = (type: string, sportType?: string) => {
  if (sportType === 'judo') {
    if (type === 'judo_yuko') return "YUKO";
    if (type === 'judo_wazaari') return "WAZA-ARI";
    if (type === 'judo_ippon') return "IPPON";
    if (type === 'judo_shido') return "SHIDO";
    if (type === 'judo_hansokumake') return "HANSOKU-MAKE";
  }
  if (sportType === 'karate') {
    if (type === 'goal_1') return "YUKO (1 PT)";
    if (type === 'goal_2') return "WAZA-ARI (2 PTS)";
    if (type === 'goal_3') return "IPPON (3 PTS)";
    if (type === 'karate_warning') return "FALTA (AVISO)";
  }
  if (type === "goal") return "GOL/PONTO";
  if (type === "goal_1") return "LANCE LIVRE (1PT)";
  if (type === "goal_2") return "CESTA (2PTS)";
  if (type === "goal_3") return "CESTA (3PTS)";
  if (type === "yellow_card") return "CARTÃO AMARELO";
  if (type === "red_card") return "CARTÃO VERMELHO";
  if (type === "foul") return "FALTA";
  if (type === "technical_foul") return "FALTA TÉCNICA";
  if (type === "2min") return "2 MINUTOS";
  if (type === "timeout") return "PEDIDO DE TEMPO";
  if (type === "baleado_point") return "BALEADO";
  if (type === "revive") return "SALVO";
  return type.toUpperCase();
};

export default function EventLog({
  events,
  recentOnly = false,
  team1Id,
  team1Name,
  team2Name,
  onDeleteEvent,
  sportType
}: EventLogProps) {
  const displayEvents = recentOnly
    ? [...events].reverse().slice(0, 4)
    : [...events].reverse();

  if (events.length === 0) {
    return recentOnly ? (
      <div className="text-center py-6 border border-slate-800 border-dashed rounded-xl text-slate-500 text-xs">
        Nenhuma ação registrada ainda.
      </div>
    ) : (
      <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2 italic text-sm">
        Nenhum evento registrado
      </div>
    );
  }

  if (recentOnly) {
    return (
      <div className="space-y-2 max-h-[180px] overflow-y-auto">
        {displayEvents.map((evt, idx) => {
          const isEvtTeam1 = evt.team_id === team1Id;
          const flagColor = isEvtTeam1 ? "bg-indigo-500" : "bg-violet-500";

          return (
            <div
              key={evt.id || idx}
              className="bg-slate-900 border border-slate-800/60 rounded-xl p-3 flex items-center justify-between text-xs transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-6 rounded-full ${flagColor}`} />
                <div>
                  <div className="flex items-center gap-1 text-[9px] text-slate-400 font-mono">
                    <span>{evt.event_time}</span>
                    <span>•</span>
                    <span className="font-bold">{isEvtTeam1 ? "Mandante" : "Visitante"}</span>
                    {evt.is_offline && (
                      <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded text-[7px] font-black tracking-widest uppercase">
                        Offline
                      </span>
                    )}
                  </div>
                  <div className="font-extrabold text-white mt-0.5 text-[12px] flex items-center gap-1">
                    <span>{getEventName(evt.event_type, sportType)}</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    {evt.athlete?.full_name || evt.athlete?.name || "Lançamento Coletivo"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onDeleteEvent(evt.id)}
                className="p-2 text-slate-500 hover:text-red-400 rounded-lg active:scale-95 transition-all cursor-pointer"
                title="Estornar Evento"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <AnimatePresence initial={false}>
      {displayEvents.map((event) => (
        <motion.div
          key={event.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className={`flex items-center gap-4 p-3 rounded-2xl border ${
            event.event_type === "judo_ippon" || (event.event_type === "goal_3" && sportType === "karate")
              ? "bg-amber-50 border-amber-200 text-amber-950 font-black shadow-sm"
              : event.event_type === "judo_wazaari" || (event.event_type === "goal_2" && sportType === "karate")
              ? "bg-indigo-50 border-indigo-200 text-indigo-950 font-bold"
              : event.event_type === "judo_yuko" || (event.event_type === "goal_1" && sportType === "karate")
              ? "bg-emerald-50 border-emerald-250 text-emerald-950"
              : event.event_type === "judo_shido" || event.event_type === "karate_warning"
              ? "bg-yellow-55/75 border-yellow-250 text-yellow-950"
              : event.event_type === "judo_hansokumake"
              ? "bg-red-50 border-red-200 text-red-950"
              : event.event_type?.startsWith("goal")
              ? "bg-emerald-50 border-emerald-100"
              : event.event_type === "yellow_card"
              ? "bg-amber-50 border-amber-100"
              : event.event_type === "red_card"
              ? "bg-red-50 border-red-100"
              : event.event_type === "baleado_point"
              ? "bg-orange-50 border-orange-100"
              : event.event_type === "revive"
              ? "bg-sky-50 border-sky-100"
              : "bg-slate-50 border-slate-100"
          }`}
        >
          <div className="font-mono text-xs font-bold text-slate-400">{event.event_time}</div>
          <div className="flex-1">
            <div className="text-xs font-bold text-slate-800">{event.athlete?.full_name || "TIME"}</div>
            <div className="text-[9px] uppercase font-black text-slate-400 tracking-widest">
              {getEventName(event.event_type, sportType)} • {event.team_id === team1Id ? team1Name : team2Name}
            </div>
          </div>
          <button
            onClick={() => onDeleteEvent(event.id)}
            className="p-2 text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
            title="Estornar Evento"
          >
            <Trash2 size={16} />
          </button>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
