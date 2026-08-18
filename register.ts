const phone = "5571991414913";
const formattedTo = (function formatPhoneBR(phone) {
  let clean = (phone || "").replace(/\D/g, "");
  if (clean.length >= 10 && !clean.startsWith("55")) clean = "55" + clean;
  return clean;
})(phone);

console.log("Formatted:", formattedTo, "Length:", formattedTo.length);
