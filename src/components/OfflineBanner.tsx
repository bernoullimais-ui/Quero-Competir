import React from "react";
import { WifiOff, RefreshCw } from "lucide-react";

interface OfflineBannerProps {
  offlineQueueLength: number;
  syncing: boolean;
  onSync: () => void;
}

export default function OfflineBanner({
  offlineQueueLength,
  syncing,
  onSync
}: OfflineBannerProps) {
  if (offlineQueueLength === 0) return null;

  return (
    <div className="bg-amber-500/15 border-b border-amber-500/35 px-4 py-3 flex items-center justify-between text-xs font-bold text-amber-300 animate-pulse">
      <span className="flex items-center gap-1.5 leading-tight">
        <WifiOff size={16} />
        {offlineQueueLength} evento(s) aguardando envio
      </span>
      <button
        onClick={onSync}
        disabled={syncing}
        className="px-3 py-1.5 bg-amber-500 text-amber-950 hover:bg-amber-400 disabled:opacity-50 transition rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
      >
        {syncing ? <RefreshCw size={10} className="animate-spin" /> : <RefreshCw size={10} />}
        Sincronizar
      </button>
    </div>
  );
}
