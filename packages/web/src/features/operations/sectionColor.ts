export type SectionPalette = { header: string; border: string };

// A wide set of distinct color families (grey intentionally omitted so tag groups
// stand out from neutral chrome). Ordered so nearby entries are different hues.
// Full literal class strings (incl. dark: variants) so Tailwind keeps them.
const PALETTE: SectionPalette[] = [
  { header: "bg-sky-100 text-sky-900 hover:bg-sky-200 dark:bg-sky-900/40 dark:text-sky-100 dark:hover:bg-sky-900/60", border: "border-sky-300 dark:border-sky-700/60" },
  { header: "bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:hover:bg-emerald-900/60", border: "border-emerald-300 dark:border-emerald-700/60" },
  { header: "bg-violet-100 text-violet-900 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-100 dark:hover:bg-violet-900/60", border: "border-violet-300 dark:border-violet-700/60" },
  { header: "bg-rose-100 text-rose-900 hover:bg-rose-200 dark:bg-rose-900/40 dark:text-rose-100 dark:hover:bg-rose-900/60", border: "border-rose-300 dark:border-rose-700/60" },
  { header: "bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60", border: "border-amber-300 dark:border-amber-700/60" },
  { header: "bg-teal-100 text-teal-900 hover:bg-teal-200 dark:bg-teal-900/40 dark:text-teal-100 dark:hover:bg-teal-900/60", border: "border-teal-300 dark:border-teal-700/60" },
  { header: "bg-indigo-100 text-indigo-900 hover:bg-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-100 dark:hover:bg-indigo-900/60", border: "border-indigo-300 dark:border-indigo-700/60" },
  { header: "bg-orange-100 text-orange-900 hover:bg-orange-200 dark:bg-orange-900/40 dark:text-orange-100 dark:hover:bg-orange-900/60", border: "border-orange-300 dark:border-orange-700/60" },
  { header: "bg-cyan-100 text-cyan-900 hover:bg-cyan-200 dark:bg-cyan-900/40 dark:text-cyan-100 dark:hover:bg-cyan-900/60", border: "border-cyan-300 dark:border-cyan-700/60" },
  { header: "bg-fuchsia-100 text-fuchsia-900 hover:bg-fuchsia-200 dark:bg-fuchsia-900/40 dark:text-fuchsia-100 dark:hover:bg-fuchsia-900/60", border: "border-fuchsia-300 dark:border-fuchsia-700/60" },
  { header: "bg-lime-100 text-lime-900 hover:bg-lime-200 dark:bg-lime-900/40 dark:text-lime-100 dark:hover:bg-lime-900/60", border: "border-lime-300 dark:border-lime-700/60" },
  { header: "bg-blue-100 text-blue-900 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-100 dark:hover:bg-blue-900/60", border: "border-blue-300 dark:border-blue-700/60" },
  { header: "bg-red-100 text-red-900 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-100 dark:hover:bg-red-900/60", border: "border-red-300 dark:border-red-700/60" },
  { header: "bg-purple-100 text-purple-900 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-100 dark:hover:bg-purple-900/60", border: "border-purple-300 dark:border-purple-700/60" },
  { header: "bg-green-100 text-green-900 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-100 dark:hover:bg-green-900/60", border: "border-green-300 dark:border-green-700/60" },
  { header: "bg-pink-100 text-pink-900 hover:bg-pink-200 dark:bg-pink-900/40 dark:text-pink-100 dark:hover:bg-pink-900/60", border: "border-pink-300 dark:border-pink-700/60" },
  { header: "bg-yellow-100 text-yellow-900 hover:bg-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-100 dark:hover:bg-yellow-900/60", border: "border-yellow-300 dark:border-yellow-700/60" },
  // Second tier: -50 backgrounds add more variety without repeating a hue+shade.
  { header: "bg-sky-50 text-sky-800 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-950/60", border: "border-sky-200 dark:border-sky-800/60" },
  { header: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950/60", border: "border-emerald-200 dark:border-emerald-800/60" },
  { header: "bg-violet-50 text-violet-800 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-200 dark:hover:bg-violet-950/60", border: "border-violet-200 dark:border-violet-800/60" },
  { header: "bg-orange-50 text-orange-800 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-200 dark:hover:bg-orange-950/60", border: "border-orange-200 dark:border-orange-800/60" },
  { header: "bg-teal-50 text-teal-800 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-200 dark:hover:bg-teal-950/60", border: "border-teal-200 dark:border-teal-800/60" },
  { header: "bg-fuchsia-50 text-fuchsia-800 hover:bg-fuchsia-100 dark:bg-fuchsia-950/40 dark:text-fuchsia-200 dark:hover:bg-fuchsia-950/60", border: "border-fuchsia-200 dark:border-fuchsia-800/60" },
  { header: "bg-rose-50 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:hover:bg-rose-950/60", border: "border-rose-200 dark:border-rose-800/60" },
];

export const SECTION_PALETTE_SIZE = PALETTE.length;

function hashIndex(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (Math.imul(h, 31) + name.charCodeAt(i)) >>> 0;
  return h % PALETTE.length;
}

/** Deterministically map a single section name to a palette entry. */
export function sectionColor(name: string): SectionPalette {
  return PALETTE[hashIndex(name)];
}

/** Colors for an ordered list of section names: each name keeps its stable hash color,
 * but when a name would land on the same color as its predecessor, it's nudged to the
 * next palette slot so no two adjacent sections ever share a color. */
export function sectionColors(names: string[]): SectionPalette[] {
  const out: SectionPalette[] = [];
  let prev = -1;
  for (const name of names) {
    let idx = hashIndex(name);
    if (idx === prev) idx = (idx + 1) % PALETTE.length;
    out.push(PALETTE[idx]);
    prev = idx;
  }
  return out;
}
