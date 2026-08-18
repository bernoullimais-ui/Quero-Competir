const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://fjpfmjilsyyhamikvyof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqcGZtamlsc3l5aGFtaWt2eW9mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk1MTI4NSwiZXhwIjoyMDk0NTI3Mjg1fQ.uZ-UowoMI28h0HP7DsTGl5ZuxO4vBBBl_MwU7_7Ez70';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data } = await supabase.from('organizations').select('id, name, logo').limit(1);
  console.log("Organizations:", data);
}
run();
