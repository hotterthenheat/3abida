/*
  Shared tone maps for directional/status color.
  Full class strings kept static so Tailwind JIT picks them up.
  Rule: a tone is never the only signal — always paired with a label or icon.
*/

/* THE ENGINE'S STANDOUT IS MAGENTA, RESTORED (Noah, 2026-08-29, ending
   the day's odyssey magenta → silver → baby blue → neon → back: "i
   reveried and skylit doesnt have those colors"). What the odyssey KEPT:

   - `crown` — a BLACK BOX with magenta words (the grammar Noah chose
               during the neon leg: "mainly black with the words being
               [the accent]... that would really bring it out" — never a
               filled card). The engine's #1 and nothing lesser: TOP PICK.
   - `supreme`  — the magenta tint at chip scale: supreme tags, NET, the whale.
   - `white` — bright neutral ink. Compass process states (ACTIVE/MOVING),
               kept by Noah's explicit word.
   - `holo`  — flat silver, TERMINAL HARDWARE only (counts, chrome,
               navigation); the animated foil is nav/brand. */
export type Tone = 'bull' | 'bear' | 'warn' | 'select' | 'white' | 'crown' | 'supreme' | 'holo' | 'neutral';

export const toneText: Record<Tone, string> = {
  bull: 'text-bull',
  bear: 'text-bear',
  warn: 'text-warn',
  select: 'text-select',
  white: 'text-textPrimary',
  crown: 'text-supreme',
  supreme: 'text-supreme',
  holo: 'holo-text',
  neutral: 'text-textPrimary',
};

export const toneDot: Record<Tone, string> = {
  bull: 'bg-bull',
  bear: 'bg-bear',
  warn: 'bg-warn',
  /* the live dot in the badge's own ink — lime in the glow, near-black on the highlighter */
  select: 'bg-current',
  white: 'bg-textPrimary',
  crown: 'bg-supreme',
  supreme: 'bg-supreme',
  holo: 'holo-bg',
  neutral: 'bg-textMuted',
};

export const toneBadge: Record<Tone, string> = {
  bull: 'bg-bull/10 text-bull border-bull/20',
  bear: 'bg-bear/10 text-bear border-bear/20',
  warn: 'bg-warn/10 text-warn border-warn/20',
  /* THE LIVE SIGNAL wears a component token (index.css .tone-live ← the
     --live-* tokens): a lime glow on the dark terminal, a lime HIGHLIGHTER on
     paper — neon can be a surface on white, never an ink (2026-09-12) */
  select: 'tone-live',
  /* Bright neutral — a rank BELOW the silvers: solid white ink, whisper tint.
     Compass process states wear this so the TOP PICK foil owns the shine. */
  white: 'bg-ink/[0.07] text-textPrimary border-ink/25',
  /* The crown. A BLACK BOX whose words are the supreme magenta — the darkest
     surface on the board carrying the engine's own ink, so the #1 is
     findable from across the room without shouting a filled card. TOP PICK
     only. */
  crown: 'bg-panel text-supreme border-supreme/40',
  /* Supreme at chip scale — the standout family's tint+ink+border grammar. */
  supreme: 'bg-supreme/10 text-supreme border-supreme/25',
  /* TINTED, not filled, and FLAT silver rather than the animated foil.
     A filled .holo-bg chip weighs exactly as much as the section subtabs
     (also .holo-bg) — same material at the same strength reads as the same
     rank, and a group's count is a child of the nav above it. So holo follows
     every other tone's badge grammar: tint + its own ink + faint border.
     #C7D3E8 is the house flat silver (the holo foil family's flat form).
     NB do NOT reach for .holo-text here: it sets background-clip:text, which
     clips the chip's SURFACE to the glyphs too, so the tint silently vanishes.
     Animated foil stays reserved for navigation and CTAs. */
  holo: 'bg-silver/[0.09] text-silver border-silver/25',
  neutral: 'bg-ink/[0.04] text-textSecondary border-borderSubtle',
};

export const toneBar: Record<Tone, string> = {
  // Neon needs its luminance — element-level lime never below /90
  bull: 'bg-bull/90',
  bear: 'bg-bear/80',
  warn: 'bg-warn/70',
  select: 'bg-select/70',
  white: 'bg-ink/70',
  crown: 'bg-supreme/90',
  supreme: 'bg-supreme/70',
  holo: 'holo-bar',
  neutral: 'bg-ink/20',
};
