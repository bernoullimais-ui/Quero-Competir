import fs from 'fs';

let content = fs.readFileSync('src/components/TournamentDashboard.tsx', 'utf-8');

if (!content.includes('Activity,')) {
  content = content.replace('} from "lucide-react";', '  Activity,\n  ExternalLink,\n} from "lucide-react";');
}

const targetStart = `{/* Card de Configuração de Divulgação Pública das Chaves/Balizamento */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-300">`;

const replacement = `<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Card de Configuração de Divulgação Pública das Chaves/Balizamento */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-300">`;

content = content.replace(targetStart, replacement);

const targetEnd = `                )}
              </button>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">`;

const replacementEnd = `                )}
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
                      Acompanhe as baterias e tempos.
                    </p>
                  </div>
                </div>
                <a
                  href={\`/public/tournament/\${id}/placar-natacao\`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 cursor-pointer shrink-0 shadow-xs bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap"
                >
                  Abrir Placar <ExternalLink size={16} />
                </a>
              </div>
            )}
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">`;

content = content.replace(targetEnd, replacementEnd);
fs.writeFileSync('src/components/TournamentDashboard.tsx', content);
