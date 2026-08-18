import { sendPreRegistrationMessage } from "./src/backend/services/utalkService";

async function run() {
  try {
    console.log("Testing uTalk...");
    const res = await sendPreRegistrationMessage({
      phone: "5571991414913", 
      athleteName: "TESTE Script",
      tournamentName: "Torneio Natação Adulto FLUIR",
      tournamentId: "fbbdeb69-042c-467c-9007-61f24adf07f5",
      orgId: "470275a0-cc3c-49f1-b61e-0f19850a6a4e",
      categoryNames: ["25m Livre"],
      totalFee: 12,
      paymentLink: "https://querocompetir.com.br/public/register-athlete/1c2151f2-ead8-4e3b-a163-7a3a317f2f5c"
    });
    console.log("Result:", res);
  } catch(e) {
    console.error("Error:", e);
  }
}
run();
