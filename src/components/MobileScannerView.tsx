import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Scanner } from "@yudiel/react-qr-scanner";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, CheckCircle2, XCircle, AlertTriangle, ScanLine, Search, Loader2 } from "lucide-react";
import { useToast } from "./ui/Toast.tsx";

export default function MobileScannerView() {
  const { id: tournamentId } = useParams();
  const navigate = useNavigate();
  const { error: toastError } = useToast();
  
  const [manualInput, setManualInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Status of the last scan
  const [scanResult, setScanResult] = useState<{
    status: "success" | "error" | "warning";
    message: string;
    athleteName?: string;
  } | null>(null);

  // Audio Context for beep sound
  const playBeep = (type: "success" | "error") => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === "success") {
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // high beep
        oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.1);
      } else {
        oscillator.type = "sawtooth";
        oscillator.frequency.setValueAtTime(300, audioCtx.currentTime); // low buzz
        oscillator.frequency.exponentialRampToValueAtTime(150, audioCtx.currentTime + 0.3);
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
      }
    } catch (e) {
      console.log("Audio API not supported");
    }
  };

  const processCheckIn = async (rawString: string) => {
    if (isProcessing || !rawString.trim()) return;
    
    // Extract ID if the QR code is a full URL (e.g. https://domain.com/public/credencial/uuid)
    let subId = rawString.trim();
    if (subId.includes("/")) {
      subId = subId.split("/").pop() || subId;
    }

    setIsProcessing(true);
    setScanResult(null);

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/check-in/${subId}`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        playBeep("error");
        setScanResult({
          status: "error",
          message: data.error || data.message || "Erro desconhecido ao processar credencial.",
        });
      } else {
        if (data.status === "already_checked_in") {
          playBeep("error");
          setScanResult({
            status: "warning",
            message: data.message,
            athleteName: data.athlete?.name
          });
        } else if (data.status === "checked_in") {
          playBeep("success");
          setScanResult({
            status: "success",
            message: "Check-in realizado com sucesso!",
            athleteName: data.athlete?.name
          });
        } else {
          playBeep("error");
          setScanResult({
            status: "error",
            message: data.message || "Credencial inválida ou recusada.",
          });
        }
      }
    } catch (err: any) {
      playBeep("error");
      setScanResult({
        status: "error",
        message: "Falha de conexão com o servidor. Tente novamente.",
      });
    } finally {
      setIsProcessing(false);
      
      // Auto-clear success message after 3 seconds to be ready for next scan
      setTimeout(() => {
        setScanResult(prev => prev?.status === "success" ? null : prev);
      }, 3500);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processCheckIn(manualInput);
    setManualInput("");
  };

  return (
    <div className="min-h-[100dvh] bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-slate-950 p-4 flex items-center justify-between border-b border-slate-800 shrink-0">
        <button 
          onClick={() => navigate(`/torneios/${tournamentId}`)}
          className="text-slate-400 hover:text-white p-2 rounded-full hover:bg-slate-800 transition"
        >
          <ChevronLeft size={24} />
        </button>
        <div className="flex items-center gap-2">
          <ScanLine className="text-emerald-400" size={20} />
          <h1 className="font-bold text-sm uppercase tracking-widest text-slate-200">Staff Scanner</h1>
        </div>
        <div className="w-10"></div> {/* Spacer for centering */}
      </header>

      {/* Main Scanner Area */}
      <main className="flex-1 flex flex-col relative">
        {/* Camera Feed */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
          {!isProcessing ? (
            <Scanner
              onScan={(result) => {
                if (result && result.length > 0) {
                  processCheckIn(result[0].rawValue);
                }
              }}
              options={{ delayBetweenScanAttempts: 1500 }}
              components={{
                audio: false,
                finder: true,
              }}
              styles={{
                video: { objectFit: "cover", width: "100%", height: "100%" }
              }}
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-10">
              <Loader2 className="animate-spin text-indigo-500 mb-4" size={48} />
              <p className="text-indigo-200 font-bold animate-pulse">Validando credencial...</p>
            </div>
          )}

          {/* Scanner Overlay UI */}
          <div className="absolute inset-0 pointer-events-none z-0 border-[40px] border-black/40 transition-all" />
        </div>

        {/* Status Overlay */}
        {scanResult && (
          <div className={`absolute top-4 left-4 right-4 p-4 rounded-2xl shadow-2xl backdrop-blur-md z-20 flex flex-col items-center text-center animate-in slide-in-from-top-4 ${
            scanResult.status === "success" ? "bg-emerald-500/90 text-white" :
            scanResult.status === "warning" ? "bg-amber-500/90 text-white" :
            "bg-rose-500/90 text-white"
          }`}>
            <button onClick={() => setScanResult(null)} className="absolute top-2 right-2 p-1 opacity-60 hover:opacity-100">
              <XCircle size={20} />
            </button>
            
            {scanResult.status === "success" && <CheckCircle2 size={48} className="mb-2 opacity-90" />}
            {scanResult.status === "warning" && <AlertTriangle size={48} className="mb-2 opacity-90" />}
            {scanResult.status === "error" && <XCircle size={48} className="mb-2 opacity-90" />}
            
            <h2 className="font-black text-lg leading-tight">{scanResult.message}</h2>
            {scanResult.athleteName && (
              <p className="text-sm font-medium mt-1 opacity-90">{scanResult.athleteName}</p>
            )}
          </div>
        )}

        {/* Bottom Manual Entry */}
        <div className="bg-slate-900 p-6 border-t border-slate-800 shrink-0 pb-safe">
          <p className="text-xs text-slate-400 font-bold mb-3 uppercase tracking-wider text-center">Ou digite o código</p>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search size={18} className="text-slate-500" />
              </div>
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="ID ou Protocolo"
                className="w-full bg-slate-800 border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono text-sm"
              />
            </div>
            <button 
              type="submit"
              disabled={isProcessing || !manualInput.trim()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              OK
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
