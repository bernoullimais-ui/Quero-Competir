import fs from 'fs';

let content = fs.readFileSync('src/components/TournamentDashboard.tsx', 'utf-8');
content = content.replace(
  '                      tournamentId={id!}',
  '                      tournamentId={id!}\n                      tournament={tournament}'
);
fs.writeFileSync('src/components/TournamentDashboard.tsx', content);

let allContent = fs.readFileSync('src/components/AllSwimmingBalizamento.tsx', 'utf-8');
allContent = allContent.replace(
  'export default function AllSwimmingBalizamento({ categories, athleteSubs, tournamentId, institutions = [] }: any) {',
  'export default function AllSwimmingBalizamento({ categories, athleteSubs, tournamentId, tournament, institutions = [] }: any) {'
);

const initCountStr = 'const [globalLanesCount, setGlobalLanesCount] = useState<number>(tournament?.rules_config?.swimming_lanes_count || 6);';
allContent = allContent.replace('const [globalLanesCount, setGlobalLanesCount] = useState<number>(6);', initCountStr);

const handleLanesChangeNew = `
  const handleLanesChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = Number(e.target.value);
    setGlobalLanesCount(val);
    try {
      await fetch(\`/api/tournaments/\${tournamentId}/swimming-lanes\`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lanesCount: val })
      });
    } catch(err) {
      console.error(err);
    }
  };
`;
allContent = allContent.replace(
  /const handleLanesChange = \(e: React.ChangeEvent<HTMLSelectElement>\) => {[\s\S]*?};/,
  handleLanesChangeNew.trim()
);

fs.writeFileSync('src/components/AllSwimmingBalizamento.tsx', allContent);
