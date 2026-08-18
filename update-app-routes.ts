import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

if (!content.includes('PublicSwimmingScoreboard')) {
  const importStr = 'import PublicCategoryDraw from "./components/PublicCategoryDraw.tsx";\nimport PublicSwimmingScoreboard from "./components/PublicSwimmingScoreboard.tsx";';
  content = content.replace('import PublicCategoryDraw from "./components/PublicCategoryDraw.tsx";', importStr);
  
  const routeStr = '<Route path="/public/tournament/:id/categories/:categoryId/draw" element={<PublicCategoryDraw />} />\n              <Route path="/public/tournament/:id/placar-natacao" element={<PublicSwimmingScoreboard />} />';
  content = content.replace('<Route path="/public/tournament/:id/categories/:categoryId/draw" element={<PublicCategoryDraw />} />', routeStr);

  fs.writeFileSync('src/App.tsx', content);
  console.log("App.tsx updated");
}
