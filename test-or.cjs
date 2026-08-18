const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data, error } = await supabase.from('athlete_subscriptions').select('category_id').eq('tournament_id', 'some-id').or(`document.eq.,athlete_name.eq.Teste Fluxo`);
  console.log("Error:", error);
  console.log("Data:", data);
}
run();
