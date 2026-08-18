import fs from 'fs';
let content = fs.readFileSync('src/components/SwimmingBalizamento.tsx', 'utf-8');

// 1. Update Props Interface
content = content.replace('interface SwimmingBalizamentoProps {', 
`interface SwimmingBalizamentoProps {
  globalLanesCount?: number;
  triggerRecalculate?: number;
  onHeatsGenerated?: (categoryId: string, heats: Heat[]) => void;`);

content = content.replace(
  'export default function SwimmingBalizamento({ category, athleteSubs, tournamentId, institutions = [], readOnly = false, hideResults = false }: SwimmingBalizamentoProps) {',
  'export default function SwimmingBalizamento({ category, athleteSubs, tournamentId, institutions = [], readOnly = false, hideResults = false, globalLanesCount, triggerRecalculate, onHeatsGenerated }: SwimmingBalizamentoProps) {'
);

fs.writeFileSync('src/components/SwimmingBalizamento.tsx', content);
