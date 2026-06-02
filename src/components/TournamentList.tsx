import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, Plus, Calendar, MapPin } from "lucide-react";

export default function TournamentList() {
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers: any = {};
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
      const user = JSON.parse(savedUser);
      if (user && user.token) {
        headers["Authorization"] = `Bearer ${user.token}`;
      }
      if (user && user.id) {
        headers["x-organizer-id"] = user.id;
      }
    }
    fetch("/api/tournaments", { headers })
      .then(res => res.json())
      .then(data => {
        setTournaments(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Torneios</h1>
          <p className="text-slate-500 text-sm">Acompanhe e gerencie todas as competições</p>
        </div>
        <Link 
          to="/torneios/new" 
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-indigo-100 hover:bg-indigo-700 flex items-center gap-2 whitespace-nowrap"
        >
          <Plus size={20} />
          Novo Torneio
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          Array(3).fill(0).map((_, i) => (
            <div key={i} className="bg-white p-8 rounded-2xl border border-slate-100 animate-pulse h-32" />
          ))
        ) : tournaments.length > 0 ? (
          tournaments.map(tournament => (
            <div key={tournament.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center overflow-hidden border border-slate-100/50">
                  {tournament.logo_url ? (
                    <img 
                      src={tournament.logo_url} 
                      alt={tournament.name} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <Trophy size={32} />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-xl">{tournament.name}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center gap-1 text-slate-400 text-sm">
                      <Calendar size={14} />
                      <span>{new Date(tournament.start_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400 text-sm">
                      <MapPin size={14} />
                      <span>Online/Local</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    tournament.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {tournament.status === 'active' ? 'Em Andamento' : 'Configuração'}
                  </span>
                </div>
                <Link to={`/torneios/${tournament.id}`} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors">
                  Gerenciar
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="py-20 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
            <Trophy className="mx-auto mb-4 text-slate-300" size={48} />
            <h3 className="text-lg font-bold text-slate-600">Nenhum torneio agendado</h3>
            <p className="text-slate-500 text-sm mb-6 max-w-sm mx-auto">Você ainda não criou nenhuma competição. Comece agora mesmo!</p>
            <Link to="/torneios/new" className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold inline-block">Criar meu primeiro torneio</Link>
          </div>
        )}
      </div>
    </div>
  );
}
