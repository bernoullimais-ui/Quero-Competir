import fs from 'fs';

let content = fs.readFileSync('src/components/PublicSwimmingScoreboard.tsx', 'utf-8');

const target = `          <h1 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <Activity className="text-emerald-500" />
            Placar Ao Vivo
          </h1>
          <p className="text-slate-500 text-sm mt-1 truncate">{tournament?.name}</p>
        </div>`;

const replacement = `          <h1 className="text-xl font-black text-white uppercase tracking-widest flex items-center gap-2">
            <Activity className="text-emerald-500" />
            Placar Ao Vivo
          </h1>
          <p className="text-slate-500 text-xs mt-1">Torneio Oficial</p>
        </div>`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('src/components/PublicSwimmingScoreboard.tsx', content);
  console.log("Sidebar patched");
} else {
  console.log("Sidebar target not found");
}
