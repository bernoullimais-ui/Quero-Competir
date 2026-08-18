import React, { useState, useCallback, useRef } from "react";
import { Printer, RefreshCw, Settings2 } from "lucide-react";
import SwimmingBalizamento from "./SwimmingBalizamento";

export default function AllSwimmingBalizamento({ categories, athleteSubs, tournamentId, tournament, institutions = [] }: any) {
  const [globalLanesCount, setGlobalLanesCount] = useState<number>(tournament?.rules_config?.swimming_lanes_count || 6);
  const [recalcTrigger, setRecalcTrigger] = useState<number>(0);
  const allHeatsRef = useRef<Record<string, any[]>>({});

  const handleLanesChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = Number(e.target.value);
    setGlobalLanesCount(val);
    try {
      await fetch(`/api/tournaments/${tournamentId}/swimming-lanes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lanesCount: val })
      });
    } catch(err) {
      console.error(err);
    }
  };

  const handleRecalculateAll = () => {
    if (window.confirm("Atenção: Isso irá limpar todos os ajustes manuais feitos em todas as provas e recalcular o balizamento pelo Tempo (Seed Time). Deseja continuar?")) {
      setRecalcTrigger(prev => prev + 1);
    }
  };

  const handleHeatsGenerated = useCallback((categoryId: string, heats: any[]) => {
    allHeatsRef.current[categoryId] = heats;
  }, []);

  const handlePrintAll = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    let htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Súmula Geral de Balizamento</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #1e293b; }
            h1 { font-size: 20px; margin-bottom: 4px; }
            h2 { font-size: 14px; color: #64748b; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 30px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
            th { background-color: #f1f5f9; font-weight: bold; text-transform: uppercase; }
            .lane-num { font-weight: bold; text-align: center; width: 50px; background-color: #f8fafc; }
            .heat-header { background-color: #1e293b; color: white; padding: 8px 12px; font-weight: bold; border-radius: 4px; margin-top: 20px; }
            .page-break { page-break-after: always; }
          </style>
        </head>
        <body>
          <h1 style="text-align:center; margin-bottom: 30px;">SÚMULA GERAL DE BALIZAMENTO - TODAS AS PROVAS</h1>
    `;

    categories.forEach((cat: any, index: number) => {
      const heats = allHeatsRef.current[cat.id] || [];
      if (heats.length === 0) return;

      htmlContent += `
        <div style="margin-top: 40px; border-top: 3px solid #cbd5e1; padding-top: 20px;">
          <h1>Prova/Categoria: ${cat.name} (${cat.gender || ""} ${cat.age_group || ""})</h1>
          <h2>Raias: ${globalLanesCount}</h2>
        </div>
      `;

      heats.forEach((h: any) => {
        htmlContent += `
          <div class="heat-header">SÉRIE ${h.heatNumber} de ${heats.length}</div>
          <table>
            <thead>
              <tr>
                <th style="width: 50px; text-align: center;">Raia</th>
                <th>Atleta</th>
                <th>Clube / Entidade</th>
                <th style="width: 120px;">Tempo Inscrição</th>
                <th style="width: 120px;">Tempo Final</th>
                <th style="width: 80px;">Classif.</th>
              </tr>
            </thead>
            <tbody>
              ${h.lanes.map((l: any) => `
                <tr>
                  <td class="lane-num">${l.laneNumber}</td>
                  <td><strong>${l.athleteName || "—"}</strong></td>
                  <td>${l.institutionName || "—"}</td>
                  <td>${l.seedTime || "--:--.--"}</td>
                  <td>___:___.___</td>
                  <td></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      });
    });

    htmlContent += `
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-900 to-indigo-800 p-6 rounded-3xl text-white shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Settings2 size={24} className="text-indigo-300" />
            Configuração Global de Balizamento
          </h2>
          <p className="text-indigo-200 text-sm mt-1">
            As configurações abaixo afetam <strong>todas as {categories.length} provas</strong> listadas.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-white/10">
          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-indigo-100 whitespace-nowrap">Qtd. Raias:</label>
            <select
              value={globalLanesCount}
              onChange={handleLanesChange}
              className="bg-indigo-900 border border-white/20 text-white rounded-xl px-4 py-2 font-bold focus:outline-none focus:ring-2 focus:ring-white/50"
            >
              {[2, 3, 4, 5, 6, 7, 8].map(n => (
                <option key={n} value={n} className="text-slate-800 bg-white">{n} Raias</option>
              ))}
            </select>
          </div>
          
          <div className="w-px h-8 bg-white/20 hidden sm:block"></div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRecalculateAll}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold rounded-xl transition-colors shadow-sm whitespace-nowrap"
            >
              <RefreshCw size={16} /> Recalcular Tudo
            </button>
            
            <button
              onClick={handlePrintAll}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white font-bold rounded-xl transition-colors shadow-sm whitespace-nowrap"
            >
              <Printer size={16} /> Súmula Geral
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-12">
        {categories.map((cat: any) => (
          <div key={cat.id} className="relative">
            <div className="absolute -left-4 top-0 bottom-0 w-1 bg-indigo-200 rounded-r-lg"></div>
            <SwimmingBalizamento
              category={cat}
              athleteSubs={athleteSubs}
              tournamentId={tournamentId}
              institutions={institutions}
              globalLanesCount={globalLanesCount}
              triggerRecalculate={recalcTrigger}
              onHeatsGenerated={handleHeatsGenerated}
            />
          </div>
        ))}
        {categories.length === 0 && (
          <div className="text-center py-10 text-slate-500 font-medium">Nenhuma prova encontrada para exibição global.</div>
        )}
      </div>
    </div>
  );
}
