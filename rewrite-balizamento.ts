import fs from 'fs';

let content = fs.readFileSync('src/components/SwimmingBalizamento.tsx', 'utf-8');

const generateReplacement = `
  const generateBalizamento = () => {
    if (categoryAthletes.length === 0) {
      setHeats([]);
      if (onHeatsGenerated) onHeatsGenerated(category.id, []);
      return;
    }

    const laneOrder = getLaneOrder(lanesCount);
    const totalAthletes = categoryAthletes.length;
    const numHeats = Math.max(1, Math.ceil(totalAthletes / lanesCount));

    // 1. Identificar atletas com posições manuais fixas
    const fixedAthletes = categoryAthletes.filter(ath => {
      const add = ath.additionalData || ath.additional_data || {};
      return add.manual_heat && add.manual_lane;
    });

    const fixedAthletesIds = new Set(fixedAthletes.map(a => a.id));

    // 2. Separar os demais atletas (não fixos)
    const floatingAthletes = categoryAthletes.filter(ath => !fixedAthletesIds.has(ath.id));

    // 3. Ordenar atletas flutuantes pelo tempo
    const sortedFloating = [...floatingAthletes].sort((a, b) => {
      const timeA = parseSeedTimeToMs(getAthleteSeedTime(a));
      const timeB = parseSeedTimeToMs(getAthleteSeedTime(b));
      return timeB - timeA; // Descending (lento -> rápido)
    });

    // 4. Determinar tamanho de cada bateria (para os flutuantes)
    // Se fosse um cálculo ideal (equitativo)
    const baseCount = Math.floor(totalAthletes / numHeats);
    const remainder = totalAthletes % numHeats;
    const heatSizes: number[] = [];
    for (let h = 0; h < numHeats; h++) {
      heatSizes.push(baseCount + (h < remainder ? 1 : 0));
    }

    const newHeats: Heat[] = [];
    let floatingOffset = 0;

    for (let h = 0; h < numHeats; h++) {
      const heatNum = h + 1;
      
      // Inicializar raias 1..lanesCount
      const laneAssignments: LaneAssignment[] = Array.from({ length: lanesCount }, (_, i) => ({
        laneNumber: i + 1,
      }));

      // Inserir os fixos desta bateria
      const fixedInThisHeat = fixedAthletes.filter(ath => {
        const add = ath.additionalData || ath.additional_data || {};
        return add.manual_heat === heatNum;
      });

      fixedInThisHeat.forEach(ath => {
        const add = ath.additionalData || ath.additional_data || {};
        const lNum = add.manual_lane;
        const laneObj = laneAssignments.find(l => l.laneNumber === lNum);
        if (laneObj) {
          laneObj.athleteId = ath.id;
          laneObj.athleteName = ath.athleteName || ath.full_name || ath.athlete_name;
          laneObj.institutionName = getAthleteInstitutionName(ath);
          laneObj.seedTime = getAthleteSeedTime(ath);
          laneObj.resultTime = editingResults[ath.id] || ath.additionalData?.result_time || ath.additional_data?.result_time || "";
          laneObj.isManual = true;
        }
      });

      // Determinar quantas vagas flutuantes sobraram nesta bateria (respeitando o heatSizes[h] se possível)
      // Se heatSizes for 5, e já tem 1 fixo, sobram 4 vagas para flutuantes
      // Mas se o fixo já ocupou uma das raias, o flutuante só pode usar as livres.
      let numFloatingNeeded = heatSizes[h] - fixedInThisHeat.length;
      if (numFloatingNeeded < 0) numFloatingNeeded = 0;

      const floatingInThisHeat = sortedFloating.slice(floatingOffset, floatingOffset + numFloatingNeeded);
      floatingOffset += numFloatingNeeded;

      // Ordenar os flutuantes da bateria (rápido -> lento)
      floatingInThisHeat.sort((a, b) => {
        const timeA = parseSeedTimeToMs(getAthleteSeedTime(a));
        const timeB = parseSeedTimeToMs(getAthleteSeedTime(b));
        return timeA - timeB;
      });

      // Distribuir os flutuantes nas raias vazias de acordo com a prioridade FINA (laneOrder)
      let floatIndex = 0;
      for (const targetLaneNum of laneOrder) {
        if (floatIndex >= floatingInThisHeat.length) break;
        
        const laneObj = laneAssignments.find(l => l.laneNumber === targetLaneNum);
        if (laneObj && !laneObj.athleteId) {
          const ath = floatingInThisHeat[floatIndex];
          laneObj.athleteId = ath.id;
          laneObj.athleteName = ath.athleteName || ath.full_name || ath.athlete_name;
          laneObj.institutionName = getAthleteInstitutionName(ath);
          laneObj.seedTime = getAthleteSeedTime(ath);
          laneObj.resultTime = editingResults[ath.id] || ath.additionalData?.result_time || ath.additional_data?.result_time || "";
          floatIndex++;
        }
      }

      newHeats.push({
        heatNumber: heatNum,
        lanes: laneAssignments,
      });
    }

    setHeats(newHeats);
    if (onHeatsGenerated) {
      onHeatsGenerated(category.id, newHeats);
    }
  };
`;

const startIndex = content.indexOf('  const generateBalizamento = () => {');
const endIndex = content.indexOf('  useEffect(() => {', startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.slice(0, startIndex) + generateReplacement + "\n" + content.slice(endIndex);
  fs.writeFileSync('src/components/SwimmingBalizamento.tsx', content);
  console.log("generateBalizamento replaced successfully");
} else {
  console.log("Could not find boundaries");
}
