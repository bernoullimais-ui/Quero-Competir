import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getSupabaseAdmin } from './backend/lib/supabase.ts';

async function run() {
  const supabase = getSupabaseAdmin();
  const { data: testSubs, error: subsError } = await supabase
    .from('athlete_subscriptions')
    .select(`
      *,
      institutions:institution_id(name),
      tournaments:tournament_id(name, owner_id),
      categories:category_id(name)
    `)
    .ilike('athlete_name', '%Torcida%');

  console.log("\nathlete_subscriptions for Torcida:");
  if (subsError) {
    console.log("Error querying athlete_subscriptions:", subsError.message);
  } else if (testSubs && testSubs.length > 0) {
    const s = testSubs[0];
    console.log({
      id: s.id,
      athlete_name: s.athlete_name,
      parent_name: s.parent_name,
      parent_phone: s.parent_phone,
      created_by: s.created_by,
      additional_data: s.additional_data
    });
  }
}

run();
