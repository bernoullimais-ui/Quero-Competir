import fs from 'fs';

let content = fs.readFileSync('src/components/PublicSwimmingScoreboard.tsx', 'utf-8');

if (!content.includes('Calendar,')) {
  content = content.replace('Activity } from "lucide-react";', 'Activity, Calendar, MapPin } from "lucide-react";');
}

const targetStart = `      {/* Main Content */}
      <div className="flex-1 h-screen overflow-y-auto p-4 md:p-8 space-y-8 bg-gradient-to-br from-[#0A0A0A] to-[#121212]">`;

const replacement = `      {/* Main Content */}
      <div className="flex-1 h-screen flex flex-col bg-gradient-to-br from-[#0A0A0A] to-[#121212]">
        
        {/* Header Superior */}
        <div className="p-4 md:p-8 pb-0 shrink-0">
          <div className="bg-[#121212]/80 backdrop-blur border border-slate-800/80 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-xl">
            <div>
              <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-wider">{tournament?.name}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-xs md:text-sm text-slate-400 font-medium">
                <span className="flex items-center gap-1.5"><Calendar size={14} /> {tournament?.start_date ? new Date(tournament.start_date + "T12:00:00Z").toLocaleDateString('pt-BR') : 'Data a definir'}</span>
                <span className="flex items-center gap-1.5"><MapPin size={14} /> {tournament?.city ? \`\${tournament.city}\${tournament.state ? \` - \${tournament.state}\` : ''}\` : 'Local a definir'}</span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
               <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
               <span className="text-emerald-500 font-bold text-[10px] uppercase tracking-widest">Ao Vivo</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8">`;

if (content.includes(targetStart)) {
  content = content.replace(targetStart, replacement);
  fs.writeFileSync('src/components/PublicSwimmingScoreboard.tsx', content);
  console.log("Header added");
} else {
  console.log("Could not find target string");
}
