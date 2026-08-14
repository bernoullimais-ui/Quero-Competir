/**
 * Converte um texto de nome em um slug amigável para URLs.
 * Ex: "Troféu FLUIR de Natação adulto" -> "trofeu-fluir-de-natacao-adulto"
 */
export function slugify(text: string): string {
  if (!text) return "";
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");
}
