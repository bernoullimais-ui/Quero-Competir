import fs from 'fs';

let content = fs.readFileSync('src/components/SwimmingBalizamento.tsx', 'utf-8');

const target = `                          {/* Athlete Name */}
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {lane.athleteName ? (
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{lane.athleteName}</span>
                                {(() => {
                                  const sub = athleteSubs.find(s => s.id === lane.athleteId);
                                  if (sub?.checkedInAt) {
                                    return (
                                      <span title="Check-in Presencial Realizado" className="text-indigo-600 flex-shrink-0">
                                        <CheckCircle2 size={14} className="stroke-[3px]" />
                                      </span>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            ) : (
                              <span className="text-slate-300 italic font-normal text-xs">Vazia</span>
                            )}
                          </td>`;

const replacement = `                          {/* Athlete Name */}
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {lane.athleteName ? (
                              <div className="flex items-center gap-2">
                                {editingManualAthId === lane.athleteId ? (
                                  <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
                                    <input type="number" placeholder="Bat" title="Nova Bateria" className="w-16 px-2 py-1 rounded border text-xs" value={manualHeatInput} onChange={e => setManualHeatInput(e.target.value)} />
                                    <input type="number" placeholder="Raia" title="Nova Raia" className="w-16 px-2 py-1 rounded border text-xs" value={manualLaneInput} onChange={e => setManualLaneInput(e.target.value)} />
                                    <button onClick={() => handleSaveManualLane(lane.athleteId!)} className="text-emerald-600 hover:text-emerald-700 bg-white p-1 rounded shadow-sm" title="Salvar Posição Fixa">Salvar</button>
                                    <button onClick={() => setEditingManualAthId(null)} className="text-slate-400 hover:text-slate-600 bg-white p-1 rounded shadow-sm" title="Cancelar">X</button>
                                    {lane.isManual && <button onClick={() => handleClearManualLane(lane.athleteId!)} className="text-rose-500 hover:text-rose-600 text-[10px] font-bold underline ml-2">Remover Fixo</button>}
                                  </div>
                                ) : (
                                  <>
                                    <span className="text-sm">{lane.athleteName}</span>
                                    {lane.isManual && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-black border border-amber-200 shadow-sm" title="Este atleta foi fixado manualmente nesta bateria/raia.">FIXO</span>}
                                    {(() => {
                                      const sub = athleteSubs.find(s => s.id === lane.athleteId);
                                      if (sub?.checkedInAt) {
                                        return (
                                          <span title="Check-in Presencial Realizado" className="text-indigo-600 flex-shrink-0">
                                            <CheckCircle2 size={14} className="stroke-[3px]" />
                                          </span>
                                        );
                                      }
                                      return null;
                                    })()}
                                    {!readOnly && (
                                      <button onClick={() => {
                                        setEditingManualAthId(lane.athleteId!);
                                        setManualHeatInput(heat.heatNumber.toString());
                                        setManualLaneInput(lane.laneNumber.toString());
                                      }} className="text-slate-300 hover:text-indigo-500 transition-colors ml-2" title="Ajustar Bateria/Raia manualmente">
                                        <Settings2 size={14} />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300 italic font-normal text-xs">Vazia</span>
                            )}
                          </td>`;

if (content.includes('                              <div className="flex items-center gap-2">\n                                <span className="text-sm">{lane.athleteName}</span>')) {
  content = content.replace(target, replacement);
  fs.writeFileSync('src/components/SwimmingBalizamento.tsx', content);
  console.log("Athlete UI replaced successfully");
} else {
  console.log("Target not found exactly");
}
