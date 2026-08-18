import fs from 'fs';

let content = fs.readFileSync('src/components/SwimmingBalizamento.tsx', 'utf-8');

if (!content.includes('isManual?: boolean;')) {
  content = content.replace('rank?: number;', 'rank?: number;\n  isManual?: boolean;');
}

const uiStateReplacement = `
  const [lanesCount, setLanesCount] = useState<number>(globalLanesCount || 6);
  const [editingManualAthId, setEditingManualAthId] = useState<string | null>(null);
  const [manualHeatInput, setManualHeatInput] = useState<string>("");
  const [manualLaneInput, setManualLaneInput] = useState<string>("");
`;

content = content.replace('const [lanesCount, setLanesCount] = useState<number>(6);', uiStateReplacement);

const dbFuncs = `
  const handleSaveManualLane = async (athleteId: string) => {
    if (!manualHeatInput || !manualLaneInput) return;
    const h = parseInt(manualHeatInput);
    const l = parseInt(manualLaneInput);
    if (isNaN(h) || isNaN(l) || h < 1 || l < 1 || l > lanesCount) {
      toastError("Valores de série e raia inválidos.");
      return;
    }
    const ath = categoryAthletes.find(a => a.id === athleteId);
    if (!ath) return;

    // Verificar se já existe alguém fixo nesta posição
    const conflict = categoryAthletes.find(a => {
      const add = a.additionalData || a.additional_data || {};
      return add.manual_heat === h && add.manual_lane === l && a.id !== athleteId;
    });

    if (conflict) {
      toastError("Já existe um atleta fixado nesta série e raia.");
      return;
    }

    try {
      const { data, error } = await supabase
        .from('athlete_subscriptions')
        .update({
          additional_data: {
            ...(ath.additionalData || ath.additional_data || {}),
            manual_heat: h,
            manual_lane: l
          }
        })
        .eq('id', athleteId);

      if (error) throw error;
      
      // Update local state so it recalculates instantly
      ath.additionalData = { ...(ath.additionalData || ath.additional_data || {}), manual_heat: h, manual_lane: l };
      
      setEditingManualAthId(null);
      generateBalizamento();
      success("Posição atualizada com sucesso!");
    } catch (e: any) {
      toastError("Erro ao salvar posição manual: " + e.message);
    }
  };

  const handleClearManualLane = async (athleteId: string) => {
    const ath = categoryAthletes.find(a => a.id === athleteId);
    if (!ath) return;

    try {
      const newAdd = { ...(ath.additionalData || ath.additional_data || {}) };
      delete newAdd.manual_heat;
      delete newAdd.manual_lane;

      const { error } = await supabase
        .from('athlete_subscriptions')
        .update({ additional_data: newAdd })
        .eq('id', athleteId);

      if (error) throw error;
      
      ath.additionalData = newAdd;
      ath.additional_data = newAdd;

      setEditingManualAthId(null);
      generateBalizamento();
      success("Posição livre restaurada!");
    } catch (e: any) {
      toastError("Erro ao limpar posição manual: " + e.message);
    }
  };
`;

content = content.replace('// Persistir tempo obtido', dbFuncs + '\n  // Persistir tempo obtido');

const effectSync = `
  useEffect(() => {
    if (globalLanesCount && globalLanesCount !== lanesCount) {
      setLanesCount(globalLanesCount);
    }
  }, [globalLanesCount]);

  useEffect(() => {
    if (triggerRecalculate > 0) {
      // Wipe manual overrides
      const wipeOverrides = async () => {
        try {
          const promises = categoryAthletes.map(async ath => {
            const add = ath.additionalData || ath.additional_data || {};
            if (add.manual_heat || add.manual_lane) {
              const newAdd = { ...add };
              delete newAdd.manual_heat;
              delete newAdd.manual_lane;
              ath.additionalData = newAdd;
              ath.additional_data = newAdd;
              return supabase.from('athlete_subscriptions').update({ additional_data: newAdd }).eq('id', ath.id);
            }
          });
          await Promise.all(promises);
          generateBalizamento();
        } catch (e) {}
      };
      wipeOverrides();
    }
  }, [triggerRecalculate]);
`;

content = content.replace('  useEffect(() => {\n    generateBalizamento();', effectSync + '\n  useEffect(() => {\n    generateBalizamento();');

fs.writeFileSync('src/components/SwimmingBalizamento.tsx', content);
