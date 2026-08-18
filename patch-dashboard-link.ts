import fs from 'fs';

let content = fs.readFileSync('src/components/TournamentDashboard.tsx', 'utf-8');

// Add imports if missing
if (!content.includes('Activity,')) {
  content = content.replace('} from "lucide-react";', '  Activity,\n  ExternalLink,\n} from "lucide-react";');
}

const oldCardStart = '{/* Card de Configuração de Divulgação Pública das Chaves/Balizamento */}';
const targetIndex = content.indexOf(oldCardStart);

if (targetIndex > -1 && !content.includes('Card Placar Natação')) {
  // We need to wrap the existing card in a grid and add the new card
  const replacement = `
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Card de Configuração de Divulgação Pública das Chaves/Balizamento */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-3">
                  <div className={\`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 \${
                    showBracketsPubliclyState ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                  }\`}>
                    {showBracketsPubliclyState ? <Eye size={20} /> : <EyeOff size={20} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2 flex-wrap">
                      Divulgação na Página do Evento
                      <span className={\`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border \${
                        showBracketsPubliclyState
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      }\`}>
                        {showBracketsPubliclyState ? "Exibição Pública Ativa" : "Omitido do Público"}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {showBracketsPubliclyState
                        ? "Público e participantes veem balizamento na página do evento."
                        : "Apenas a organização vê o balizamento."}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isSavingVisibility}
                  onClick={async () => {
                    const nextVal = !showBracketsPubliclyState;
                    setShowBracketsPubliclyState(nextVal);
                    setIsSavingVisibility(true);
                    try {
                      const res = await fetch(\`/api/tournaments/\${id}/brackets-visibility\`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ showBracketsPublicly: nextVal }),
                      });
                      if (!res.ok) throw new Error("Erro ao salvar visibilidade");
                      const data = await res.json();
                      if (data && data.showBracketsPublicly !== undefined) {
                        setShowBracketsPubliclyState(!!data.showBracketsPublicly);
                      }
                      success(nextVal ? "Divulgação pública liberada na página do evento!" : "Divulgação omitida da página do evento.");
                      refreshSubSettings();
                    } catch (err: any) {
                      error("Erro ao alterar divulgação: " + err.message);
                      setShowBracketsPubliclyState(!nextVal);
                    } finally {
                      setIsSavingVisibility(false);
                    }
                  }}
                  className={\`px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shrink-0 shadow-xs \${
                    showBracketsPubliclyState
                      ? "bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
                      : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200"
                  }\`}
                >
                  {showBracketsPubliclyState ? (
                    <>
                      <EyeOff size={16} /> Omitir Divulgação
                    </>
                  ) : (
                    <>
                      <Eye size={16} /> Liberar Divulgação 🔓
                    </>
                  )}
                </button>
              </div>

              {/* Card Placar Natação (Se aplicável) */}
              {categories.some((c: any) => c.rules_config?.sport_type === "swimming" || c.name?.toLowerCase().includes("natação") || c.name?.toLowerCase().includes("natacao")) && (
                <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-300">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-indigo-500/20 text-indigo-400">
                      <Activity size={20} />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-white flex items-center gap-2 flex-wrap">
                        Placar Público de Natação
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full border bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                          Live
                        </span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Painel em tempo real para exibir em TVs ou telões durante o evento.
                      </p>
                    </div>
                  </div>
                  <a
                    href={\`/public/tournament/\${id}/placar-natacao\`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shrink-0 shadow-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    Abrir Placar <ExternalLink size={16} />
                  </a>
                </div>
              )}
            </div>
`;

  const regex = /\{\/\* Card de Configuração de Divulgação Pública das Chaves\/Balizamento \*\/\}[\s\S]*?<\/div>\s*<\/div>\s*<div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">/;
  
  if (regex.test(content)) {
     content = content.replace(regex, replacement + '\n            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">');
     fs.writeFileSync('src/components/TournamentDashboard.tsx', content);
     console.log("Dashboard patched successfully!");
  } else {
     console.log("Could not match the regex for the card.");
  }
} else {
  console.log("Card Placar Natação already exists or anchor not found.");
}
