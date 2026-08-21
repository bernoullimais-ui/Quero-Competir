require('dotenv').config({ path: '.env.local' });
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const tid = 'fbbdeb69-042c-467c-9007-61f24adf07f5';

  const { data: categories, error: cErr } = await supabase.from('tournament_categories').select('*').eq('tournament_id', tid).ilike('age_group', '%-30 anos%');

  if (categories && categories.length > 0) {
    for (const cat of categories) {
        console.log("Corrigindo categoria:", cat.name);
        await supabase.from('tournament_categories').update({
          birth_year_min: 1997,
          birth_year_max: 2006,
          description: cat.description ? cat.description.replace('1996', '1997').replace('2026', '2006') : null
        }).eq('id', cat.id);
    }
    console.log("Correção concluída!");
  }
}
run();
