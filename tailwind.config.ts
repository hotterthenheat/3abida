import type { Config } from 'tailwindcss';

/* EVERY COLOUR IS A TOKEN (2026-09-12): the values live in src/theme/tokens.css
   as RGB channels under `:root` (dark) and `[data-theme='light']`; this config
   only names them. `<alpha-value>` keeps every modifier working (`bg-panel/70`,
   `border-borderSubtle/60`). A theme change touches tokens.css, never this
   file — Tailwind's config is not hot, tokens are. */
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces
        canvas: token('canvas'),
        panel: token('panel'),
        panelHover: token('panel-hover'),
        inset: token('inset'),
        inputBg: token('input-bg'),
        // The chip's ground (#0c0c0c on dark) and the card's (#121212) — the two
        // shades the pages used to write by hand
        chip: token('chip'),
        card: token('card'),

        // Borders
        borderSubtle: token('border-subtle'),
        borderMuted: token('border-muted'),
        borderFocus: token('border-focus'),

        // Text — tiers must clear WCAG on the dark canvas (muted was 2.06:1, illegible)
        textPrimary: token('text-primary'),
        textSecondary: token('text-secondary'),
        // Lifted #6b6b6b → #7d7d7d (2026-07-25): at the 9-10px label sizes this
        // token actually lives at, 6b6b6b was ~3.98:1 on canvas — below AA, and
        // Noah was squinting. 7d7d7d reads ~5.2:1 and stays clearly quieter
        // than textSecondary, so labels still whisper; they just stop mumbling.
        textMuted: token('text-muted'),

        // THE INK a wash is made of — white on dark, near-black on light. Every
        // `bg-white/[0.06]` hover wash became `bg-ink/[0.06]` (2026-09-12).
        ink: token('ink'),

        // Directional / status accents (always paired with a label or icon).
        // THE SPLIT (2026-07-20): green = the MARKET talking (bullish, calls,
        // beats, up-moves). Neon lime = the TERMINAL talking about itself
        // (selection, navigation, brand, extreme importance). One color, one
        // meaning — and lime stays scarce, which is what makes it loud.
        // Green went mint #CFFFB1 → #30D158 on 2026-07-24: a true green reads
        // as green, and it no longer shares a hue family with the neon lime,
        // so the split is easier to see. The live chart keeps the old mint on
        // purpose — see CHART_MINT in components/gex/palette.ts.
        bull: token('bull'),
        bear: token('bear'),
        // True orange — caution reads clearly apart from green and hot red
        warn: token('warn'),
        // Interface accent — neon lime, ~17:1 on canvas. Interface only, never data.
        select: token('select'),
        // THE ACCENTS AS SURFACES (2026-09-12): a neon or a silver FILL with the
        // dark word on it is the same on either ground (a highlighter, the holo
        // flat form); only the accent as an INK is cut per theme (select, silver).
        selectFill: token('select-fill'),
        silverFill: token('silver-fill'),

        // GEX structural levels
        // Flip = INDECISION GRAY (Noah, 2026-08-29): "when something is
        // flipping it's on the verge of two sides — indecisive — vague/
        // neutral/gray." The regime border wears the color of neither side.
        flip: token('flip'),
        // Moon = the EVENING ink: after-close / overnight (the Earnings
        // "after close" markers, the Weigher's session read). A SOFT PURPLE
        // (Noah, 2026-08-30: "make the overnight color a soft purple").
        moon: token('moon'),
        // Supreme = MAGENTA (Noah, 2026-08-29): the engine's-standout family —
        // TOP PICK, supreme, NET, the whale.
        supreme: token('supreme'),
        darkpool: token('darkpool'),

        // Legacy aliases (pre-redesign pages)
        primary: token('text-primary'),
        secondary: token('text-secondary'),
        silver: token('silver'),
        gammaPos: token('select'),
        gammaNeg: token('bear'),
        warning: token('warn'),
      },
      fontSize: {
        'xxs': '0.7rem',
        'xxxs': '0.6rem',
      },
      fontFamily: {
        // One family site-wide (2026-08-16). `mono` is kept as a token — it
        // marks the data/instrument voice (tabular figures via index.css),
        // not a different typeface.
        sans: ['SF Pro', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['SF Pro', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      }
    },
  },
  plugins: [],
} satisfies Config;
