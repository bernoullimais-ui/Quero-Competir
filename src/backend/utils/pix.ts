/**
 * Helper para geração de QR Code e Copia e Cola Pix no padrão EMV BR Code (BCB).
 */
export function generatePixEMV(
  pixKey: string,
  amount: number,
  merchantName = "QUEROCOMPETIR",
  merchantCity = "SALVADOR",
  txid = "***"
): string {
  const cleanKey = pixKey.trim();

  // Subtag 00: GUI (br.gov.bcb.pix)
  const gui = "0014br.gov.bcb.pix";
  // Subtag 01: Chave Pix
  const keyTag = "01" + String(cleanKey.length).padStart(2, "0") + cleanKey;
  const merchantAccountInfo = gui + keyTag;
  const field26 = "26" + String(merchantAccountInfo.length).padStart(2, "0") + merchantAccountInfo;

  const field52 = "52040000"; // Merchant Category Code
  const field53 = "5303986";  // BRL

  const amountStr = amount.toFixed(2);
  const field54 = "54" + String(amountStr.length).padStart(2, "0") + amountStr;

  const field58 = "5802BR";

  // Sanitize Merchant Name (max 25 chars, alphanumeric)
  const cleanName = merchantName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .slice(0, 25)
    .trim() || "QUEROCOMPETIR";
  const field59 = "59" + String(cleanName.length).padStart(2, "0") + cleanName;

  // Sanitize Merchant City (max 15 chars, alphanumeric)
  const cleanCity = merchantCity
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .slice(0, 15)
    .trim() || "SALVADOR";
  const field60 = "60" + String(cleanCity.length).padStart(2, "0") + cleanCity;

  // Additional Data (TxID)
  const cleanTxid = txid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 25) || "***";
  const txidSubtag = "05" + String(cleanTxid.length).padStart(2, "0") + cleanTxid;
  const field62 = "62" + String(txidSubtag.length).padStart(2, "0") + txidSubtag;

  const payloadWithoutCRC = "000201" + field26 + field52 + field53 + field54 + field58 + field59 + field60 + field62 + "6304";

  // Polinômio CRC16-CCITT (0x1021, valor inicial 0xFFFF)
  let crc = 0xffff;
  for (let i = 0; i < payloadWithoutCRC.length; i++) {
    crc ^= payloadWithoutCRC.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xffff;
    }
  }

  const crcHex = crc.toString(16).toUpperCase().padStart(4, "0");
  return payloadWithoutCRC + crcHex;
}
