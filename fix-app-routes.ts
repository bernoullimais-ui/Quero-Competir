import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf-8');

if (!content.includes('import PublicSwimmingScoreboard')) {
  content = content.replace('import PublicTournamentView from "./components/PublicTournamentView.tsx";', 'import PublicTournamentView from "./components/PublicTournamentView.tsx";\nimport PublicSwimmingScoreboard from "./components/PublicSwimmingScoreboard.tsx";');
}

if (!content.includes('path="/public/tournament/:id/placar-natacao"')) {
  const target = `              <Route path="/public/torneio/:id" element={
                <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold">Erro ao carregar o torneio.</div>}>
                  <PublicTournamentView />
                </ErrorBoundary>
              } />`;
              
  const replacement = `              <Route path="/public/torneio/:id" element={
                <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold">Erro ao carregar o torneio.</div>}>
                  <PublicTournamentView />
                </ErrorBoundary>
              } />

              <Route path="/public/tournament/:id/placar-natacao" element={
                <ErrorBoundary fallback={<div className="p-8 text-center text-red-500 font-bold">Erro ao carregar placar público de natação.</div>}>
                  <PublicSwimmingScoreboard />
                </ErrorBoundary>
              } />`;
              
  content = content.replace(target, replacement);
  fs.writeFileSync('src/App.tsx', content);
  console.log("App.tsx fixed");
}
