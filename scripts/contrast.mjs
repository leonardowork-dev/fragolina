// Calcola i rapporti di contrasto WCAG delle coppie testo/sfondo del design system.
const L = (h) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const C = { ink: "#22121F", paper: "#FFF4F6", strawberry: "#FF2D55", strawberryDeep: "#C4143A", leaf: "#2FBF71", leafDeep: "#16703F", sky: "#8FD3FF", butter: "#FFD84D", blush: "#FFC2CF", white: "#FFFFFF", inkSoft: "#5E4A5A" };
const pairs = [["ink","paper"],["ink","blush"],["ink","butter"],["ink","sky"],["ink","leaf"],["ink","strawberry"],["paper","strawberry"],["white","strawberry"],["paper","strawberryDeep"],["paper","ink"],["inkSoft","paper"],["inkSoft","blush"],["strawberryDeep","paper"],["leafDeep","paper"],["strawberry","paper"],["strawberry","ink"],["butter","ink"],["blush","ink"]];
if (process.argv[1].endsWith("contrast.mjs")) for (const [a,b] of pairs) console.log(`${a} su ${b}`.padEnd(28), C[a], C[b], ratio(C[a],C[b]).toFixed(2));
