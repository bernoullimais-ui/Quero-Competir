const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://fjpfmjilsyyhamikvyof.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqcGZtamlsc3l5aGFtaWt2eW9mIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODk1MTI4NSwiZXhwIjoyMDk0NTI3Mjg1fQ.uZ-UowoMI28h0HP7DsTGl5ZuxO4vBBBl_MwU7_7Ez70';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  console.log("Looking between:", twentyFourHoursAgo, "and", twoHoursAgo);

  const { data, error } = await supabase
    .from("athlete_subscriptions")
    .select("id, athlete_name, created_at, payment_status, whatsapp_cart_recovery_sent")
    .neq("payment_status", "paid")
    .eq("whatsapp_cart_recovery_sent", false)
    .gte("created_at", twentyFourHoursAgo)
    .lte("created_at", twoHoursAgo);

  if (error) console.error("Error:", error);
  if (data) {
     console.log("Found:", data.length, "subscriptions");
     console.log(data);
  }
}
check();
