export function humanizeLabel(str: string): string {
  if (!str) return str;
  const spaced = str
    .replace(/_+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
  const words = spaced.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return str;
  return words[0].charAt(0).toUpperCase() + words[0].slice(1) +
    (words.length > 1 ? " " + words.slice(1).join(" ") : "");
}
