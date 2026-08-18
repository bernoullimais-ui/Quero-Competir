const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://fjpfmjilsyyhamikvyof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqcGZtamlsc3l5aGFtaWt2eW9mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk1MTI4NSwiZXhwIjoyMDk0NTI3Mjg1fQ.uZ-UowoMI28h0HP7DsTGl5ZuxO4vBBBl_MwU7_7Ez70';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
  const ids = [
    'f5e8f22f-b925-41e9-947c-966ee81b9fee',
    'c24784f3-bc1b-4ab3-963c-79481b6cede5',
    'e1c1f129-bb12-452e-a08b-9c1bd3fa5018',
    'fa265806-5e9a-46c9-b871-b8468512d348'
  ];

  for (const id of ids) {
    await supabase.from('athlete_subscriptions').update({ whatsapp_cart_recovery_sent: false }).eq('id', id);
    console.log("Reverted", id);
  }
}
fix();
