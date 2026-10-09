# Slayer UX/UI audit: the pages outside the terminal, and site-wide cross-cutting checks

Scope: `/welcome`, `/i/:code`, `/signup`, `/signin`, `/reset`, `/verified`, `/expired`, `/status`, `/about`, `/legal`, `/legal/:doc` (terms, privacy, risk, refunds, data), `/maintenance`, the 404 prompt (`/nope`, `/pricing`, `/login`), plus a sweep over every route declared in `src/App.tsx` (125 addresses, legacy redirects and in-terminal 404s included).

Method and evidence base (all run 2026-10-09 against the already-running dev server at http://localhost:5300, Chromium via Playwright; repo untouched):
- `scratchpad/audit-outside/sweep.mjs`: every route at 390 × 844, dark theme. Recorded console errors and warnings, page errors, failed requests, responses ≥ 400, final URL, `<title>`, horizontal overflow, h1/main/footer counts and time to settle. Raw output is in `shots-outside/_raw/sweep-390.json` and `sweep-390.log`.
- `outside.mjs`: screenshots of every outside page at desk (1440 × 900) and phone (390 × 844) in both themes, plus every form, link, tab and door pressed. It also covered the keyboard Tab walk, computed contrast, tap targets, theme persistence and back/forward. Raw output is in `shots-outside/_raw/outside.out`.
- `textscan.mjs`: rendered text, `aria-label`, `title`, `placeholder` and `alt` on every distinct final URL (79) at 1440 × 900, checked for the banned words, unlabeled inputs, unnamed controls and heading skips. Raw output is in `shots-outside/_raw/textscan.json`.
- Small follow-up probes: `extras.mjs` (404 suggestions, head meta, the boot gate), `case.mjs` (trailing slash and case variants), `links.mjs`, `rm.mjs` (reduced motion), `calls.mjs`, `nf.mjs`, `busy.mjs`.
- All screenshots are in `research_notes/Slayer full UX UI audit/shots-outside/`, written below as `shots/…`.

Caveat on timings: about six other audit agents were driving the same Vite dev server at the same time (about 95 Chromium processes). Every "settle" time is inflated and is useful only for comparing pages with each other. It is not a real-world load time.

Severity scale: **Broken** (wrong or false result, or a dead end) · **Major** (a real user gets stuck or misled, or an owner rule is broken in a visible place) · **Minor** (friction or a standards gap) · **Polish**.

---

## Q1. Every control on the outside pages: forms, validation, password show/hide, submit, links between the forms, legal tabs, status items, footer links. Is anything dead, confusing, or missing a label, error or autocomplete?

### Takeaway
Nothing is dead: every link and door on the outside pages goes where it says, and the forms validate and move to the next screen as designed. Signing in opens `/pulse`. There is one real **Broken** bug: any account address with a trailing slash or capital letters (`/signin/`, `/signup/`, `/reset/`, `/SIGNUP`, `/Expired`) shows the green-light "You're in. Your email is confirmed." screen. The biggest UX gaps are these:
- Sign-in has no way to make an account.
- No form has a password show/hide.
- Validation errors are not announced to assistive technology.
- Every outside page opens behind a full-screen "Entering terminal" gate.
- The legal pages are nearly empty.

### Cited Findings

**Account forms (`src/pages/auth/Auth.tsx`)**

| ID | Sev | Where | What is wrong | Evidence | Fix |
|---|---|---|---|---|---|
| A1 | **Broken** | `/signin/`, `/signup/`, `/reset/`, `/expired/`, `/SIGNUP`, `/Expired`, `/SignIn`; `Auth.tsx:73` and `Auth.tsx:182-189` | The screen comes from `pathname.slice(1)`, so `"signin/"` or `"SIGNUP"` matches none of the branches. The `else` branch is the **verified** screen, so the reader is told "You're in. Your email is confirmed." and offered "Open Pulse". The tab title still says "Sign in" (`PageMeta` strips the slash and the router is case-insensitive), so the title and the page disagree. | `case.mjs`: `/signin/ → h1 "You're in."`, `/signup/ → "You're in."`, `/reset/ → "You're in."`, `/SIGNUP → "You're in."`, `/Expired → "You're in."`. Screenshot: `shots/signin-trailing-slash-shows-youre-in.png` | Pass the screen as a prop from each `<Route>` (`<Auth screen="signin"/>`), or normalise it: `pathname.replace(/\/+$/,'').slice(1).toLowerCase()`. Never let the fall-through land on `verified`; fall through to `signin`. |
| A2 | Major | `/signin` foot, `Auth.tsx:156-158` | Sign-in offers only "Forgot your password?". A new visitor who lands here (for example from `/login`, which the 404 sends to `/signin`) has no link to `/signup`. | `outside.out`: `SIGNIN links/buttons ["BUTTON:Sign in:","A:Forgot your password?:/reset"]`, `SIGNIN has signup link? false`. Screenshot: `shots/signin-desk-dark.png` | Add "New here? Make an account" → `/signup` beside the reset link, keeping `?plan`/`?from` if present. |
| A3 | Major | All password fields, `Auth.tsx:139`, `Auth.tsx:153` | There is no show/hide toggle on either password field. On a phone the reader can't check what they typed, and the sign-up form has no confirm field. | `outside.out`: `show/hide password toggle on any form? 0` | Add an eye toggle inside the field (`aria-label="Show password"`, `aria-pressed`), at least 44 px. Never toggle `autocomplete`. |
| A4 | Minor (a11y) | `Field`, `Auth.tsx:38-52`; submit, `Auth.tsx:98-101` | Error text is a bare `<span>` with no `id`, the input has no `aria-describedby`, and there is no `role="alert"` or `aria-live` region. Focus stays on the submit button after a failed submit, so a screen-reader user hears nothing. | `outside.out`: `aria-invalid` is set, but `desc: null`, `role=alert / aria-live count 0`, `focus after empty submit BUTTON Make account` | Give each error an `id` and set `aria-describedby` on the input, and move focus to the first invalid field on submit. An `aria-live="polite"` summary is optional. |
| A5 | Minor | `Auth.tsx:92` | An empty email field gets "That doesn't look like an email address." The password field already has its own empty message ("Type your password."). | `shots/signup-empty-submit.png` | Use "Type your email." when the field is empty, and keep the current line for a malformed address. |
| A6 | Minor | `/signup` password field, `Auth.tsx:139` | The 8-character rule shows only after a failed submit ("Use at least 8 characters."). | `outside.out`: the `bad email/short pw` errors | Show "At least 8 characters" as quiet hint text under the label from the start. |
| A7 | Minor | `/reset` and `/expired` sent state, `Auth.tsx:163-169` | "Check your email." offers only "Back to sign in". There is no "Send it again" (sign-up's sent state has one, `Auth.tsx:108-116`) and no way to fix a mistyped address. Sign-up's sent state can't change the address either. | `outside.out`: `RESET sent … Check your email. … Back to sign in` | Reuse the resend button and add "Wrong address? Change it" to step back to the filled form. |
| A8 | Minor | Sent states, `Auth.tsx:83` | "Sent" is component state, not a history entry. Browser Back from "Check your email" leaves the flow entirely, and a reload drops back to the empty form. | `outside.out`: `SIGNUP back after sent -> about:blank` (first page in the tab), `SIGNUP reload after sent -> Make your account.` | Put the step in the URL (`?sent=1` or `/signup/sent`) so Back and reload behave. |
| A9 | Minor | Sign-in submit, `Auth.tsx:151`, `LaunchTransition.tsx:86` | `launch('/pulse')` pushes a history entry, so Back from the terminal returns to the filled sign-in form. | `outside.out`: `SIGNIN back from /pulse -> /signin "Sign in."` | Use `navigate(to, { replace: true })` for the post-sign-in launch. |
| A10 | Minor (tap) | `Auth.tsx:118,143,157,167,178` | The foot links ("Sign in", "Forgot your password?", "Back to sign in") are 15 px tall at 390 px. | `outside.out` SMALLTAPS: `A[Sign in] 41x15`, `A[Forgot your password?] 138x15`, `A[Back to sign in] 88x15` | Pad them to a 44 px hit area with the landing's `before:` box technique. |
| A11 | Minor | Input focus, `Auth.tsx:48` (`outline-none focus:border-textPrimary/60`) | The global silver focus ring is switched off on the inputs. Focus shows only as the border turning 60% ink, which is faint on light ground. | `outside.out`: `input focus style {"outline":"solid 2px","border":"rgba(237,237,237,0.6)"}` (2 px transparent outline). Screenshot: `shots/signin-input-focus.png` | Keep the border change and add the house `:focus-visible` ring, or a 2 px silver box-shadow. |
| A12 | Polish | Inputs, `Auth.tsx:41-49` | There are no `name` or `id` attributes. `autocomplete` is right (`email`, `new-password`, `current-password`), but some password managers also key on `name`. | `outside.out`: SIGNUP and SIGNIN inputs have `name:"" id:""` | Add `name="email"` and `name="password"`. |
| A13 | Polish | `?plan=` line, `Auth.tsx:134` | It reads "Compass · $180 / month". The landing's rule says a price states its currency ("$180 USD / month"). | `shots/signup_plan_compass_from_zak-desk-dark.png` | Render `{plan.price} USD {plan.period}`. |
| A14 | Polish | `?from=` and `?plan=lifetime`, `Auth.tsx:74-78` | `?from=%3Cimg%3E` becomes "Brought in by Img". `?plan=lifetime` is silently ignored. | `outside.out` SIGNUP lines | Drop `from` when the cleaned handle differs from the raw one. Fine to keep ignoring Lifetime. |
| A15 | Polish | `/verified`, `Auth.tsx:187` | "Signed in as …" appears only when `?email=` is in the URL. Without it the card ends abruptly. | `shots/verified_email_me_x_com-phone-light.png` vs `verified-desk-dark` | Either always omit it, or keep it until a session exists. |
| A16 | Polish (naming) | Landing door, page head and button | The same action has three names: "Sign up free" (landing, about, invite) → "Make your account." (h1 and title) → "Make account" (button). | Screenshots of the signup pages | Pick one verb pair, e.g. h1 "Sign up free." and button "Sign up". |

**What works on the forms:** the right `type`, `autocomplete` and labels (wrapping `<label>`, so every input has an accessible name). `noValidate` with custom messages. `aria-invalid` is set. `?email=` pre-fills. `?plan=` and `?from=` show on sign-up. Resend disables after one press ("Sent again."). Every "Back to sign in" and "Have one? Sign in" link works. Sign-in → launch gate → `/pulse` works. Fields are 48 px tall and the submit is 48 px.

**Invite and welcome (`src/pages/outside/Invite.tsx`)**

| ID | Sev | Where | What is wrong | Evidence | Fix |
|---|---|---|---|---|---|
| I1 | Minor | `/i/:code` with a long code, `Invite.tsx:36,38` | The URL line and the h1 never wrap, so an 80-character code overflows the page by **945 px** at 390 px. | `outside.out`: `INVITE aaaa… over: 945`. Screenshot: `shots/invite-long-code-phone.png` | Add `break-all` on the URL line and `break-words` on the h1, and cap the displayed name (e.g. 24 characters plus an ellipsis). |
| I2 | Polish | `nameOf`, `Invite.tsx:21-24` | `%3Cb%3Ehi` becomes "Bhi invited you", and a key-only code `7Q2M` becomes "7Q2M invited you". | `outside.out` INVITE lines | Fall back to "A trader" when the handle part is missing or was altered by sanitising. |
| I3 | Minor | Door, `Invite.tsx:39-46` | "Sign up free" is a `<button>` calling `navigate()`, so it can't be opened in a new tab, copied or middle-clicked. Every other door on these pages is a link. | `outside.out`: `INVITE door is BUTTON Sign up free` | Use `<Link to={…}>`. |
| I4 | Minor (content) | The invite card | The card says who invited you, but not what Slayer is. There is no product line, no glyphs and no "look first" door, although the file header says an invite "opens the terminal" (`Invite.tsx:5-6`). | `shots/i_zak_7Q2M-desk-dark.png` | Add the one-line pitch and a secondary "Look around first" → `/pulse` (launch). |
| I5 | Minor | `/i/:code` and `/welcome?from=` `<title>` | Both titles are just "Slayer Terminal" with the landing's description. They are missing from `PageMeta` TOP (`PageMeta.tsx:66-88`). | `extras.mjs` HEAD: `/i/zak-1 "Slayer Terminal"`, `/welcome?from=zak "Slayer Terminal"` | Add entries like "Zak invited you · Slayer Terminal" and "Welcome · Slayer Terminal". |
| I6 | Minor (copy) | `/welcome` h1, `Invite.tsx:71`; `/verified` line, `Auth.tsx:185`; `PageMeta.tsx:80` | "Start on the landing desk." A visitor who just came from the *landing page* will read "landing" as the front page, not Pulse. | Screenshots `welcome_from_zak-*`, `verified_*` | "Start on Pulse, the live desk." |
| I7 | Polish | Welcome avatar, `Invite.tsx:66` | The ring is drawn in `NAV_INK.pulse` (pink-red). This is outside the landing's colour rule, but it is the only non-silver accent on these pages. | `shots/welcome_from_zak-desk-light.png` | Optional: draw the ring in silver. |
| — | (works) | `/welcome` with no `from` | Redirects to `/`, as the code comment intends. `/welcome?from=zak` → "Open Pulse" → launch → `/pulse`. | `outside.out` | — |

**Status (`src/pages/outside/Status.tsx`)**

| ID | Sev | Where | What is wrong | Evidence | Fix |
|---|---|---|---|---|---|
| S1 | Major | The 30-day strip, `Status.tsx:75,78` | The legend says "gray is a closed market day". On **dark**, open days are the *grey* squares (silver at 45%) and closed days are near-black, so the legend is backwards. On light, both are greys. The open-to-closed contrast is **2.81:1 on dark** and **1.81:1 on light**, under the 3:1 that WCAG 1.4.11 asks of meaningful graphics. | Computed: open `rgb(95,100,110)` vs closed `rgb(30,30,30)` = 2.81; light `rgb(166,176,195)` vs `rgb(233,233,234)` = 1.81. Screenshots: `shots/status-desk-dark.png`, `shots/status-phone-light.png` | Make closed days an outline only, or `ink/0.04`, and open days `silver` at 80% or more. Rewrite the legend for each theme ("filled: market open · outlined: closed"). |
| S2 | Minor (a11y) | Day squares, `Status.tsx:75` | Each day's meaning is only in a `title` tooltip on a non-focusable `<span>`, so keyboard and touch users can't read it, and screen readers skip it. | `outside.out`: `dayFocusable:false` | Give the strip `role="img"` and an `aria-label` that summarises it ("21 of the last 30 days open"), or make it a list with visually hidden text. |
| S3 | Minor | Changelog, `src/data/release.ts:23-31` | The newest entry is v2026.10.01. Since then the landing v5 (10-05), the stronger foil (10-05), the scale pass (10-06/07) and the 3D wall (10-08) have shipped. The page titled "What's new" is eight days stale. | `outside.out` STATUS changelog | Add the entries, or generate the list from tagged commits. |
| S4 | Minor | "What's new" card, `release.ts:38` | It shows the first entry that has a `product` (Paper, 09-30), not the newest entry (the mark, 10-01). The card and the top of the changelog disagree about what is newest. | `outside.out`: `whatsNew: "Paper trades options only…"` | Pick `CHANGELOG[0]`, or give each entry an explicit `featured` flag. |
| S5 | Polish | Parts list, `Status.tsx:25-30, 63` | "Normal" × 4 and "· all systems normal" are constants. They can never show anything else. The comment says it claims nothing it can't back, but this reads as a live claim. | Code | Fine for now (no backend). When there is one, drive it from data, or label the card "As of {time}". |
| S6 | Polish | Phone changelog, `Status.tsx:86` (`grid-cols-[96px_22px_1fr]`) | At 390 px the 96 px version column leaves about 150 px for the text, which wraps every 3–4 words. | `shots/status-phone-dark-full.png` | On small screens, stack the version above the line. |
| S7 | Polish | Doors | Changelog rows use a plain `<Link>` into the terminal, with no gate. "Open in Paper" uses `launch()` and the gate. Two behaviours for the same kind of jump. | `Status.tsx:91` vs `Status.tsx:109-114` | Pick one. The gate is the house pattern for a door into the terminal. |
| S8 | Minor (tap) | "Open in Paper" `h-9` (`Status.tsx:115`) | 36 px tall on a phone. | SMALLTAPS: `A[Open in Paper] 116x36` | `h-11`. |
| — | (works) | All 9 changelog links and the What's-new door | Every one resolves to a real page (`/pulse`, `/practice/paper`, `/settings/appearance`, `/practice/journal`, `/alerts`→drawer over `/pulse`, `/trace/live-tape`, `/weigher`). | `outside.out` "changelog link … ok" | — |

**Legal (`src/pages/outside/Legal.tsx`)**

| ID | Sev | Where | What is wrong | Evidence | Fix |
|---|---|---|---|---|---|
| L1 | Minor (layout) | `/legal/risk` (lead only, no sections, no Contact); `/legal/terms`, `/privacy`, `/refunds` (lead + Contact) | By design only sections with words show. The result is a page that is about 75% empty, and with `main` held to at least one screen (`OutsideFrame.tsx:49`) the footer sits a full scroll below. Risk has no Contact section at all (`Legal.tsx:168`). | `shots/legal_risk-desk-dark.png`, `shots/legal_terms-phone-light.png`; `outside.out`: risk `h2:[]` | Add `{head:'Contact'}` to Risk. On legal pages drop the `min-h` on `main` (or reduce it) so the footer follows the text, or add a "Last updated" line and "Questions? Write to …". |
| L2 | Minor | Contact body, `Legal.tsx:201` | "Write to info@slayerterminal.com." is plain text, not a `mailto:` link. About and the footer do link it. | Screenshot | Render the address as `<a href="mailto:…">`. |
| L3 | Major (claim / owner rule) | `/legal/data`, `Legal.tsx:184` | "Live — straight from a **licensed feed**, as it happens." The owner's rule for buyer-facing copy is "no vendor named, **no licence claimed**", and there is no feed yet. | `shots/legal_data-desk-dark.png` | "Live — from the market feed, as it happens." |
| L4 | Minor (consistency) | `/legal/data` vs the landing's read (`Landing.tsx:234-236`) and `PageMeta.tsx:87` | The landing names three kinds, **Observed / Calculated / Modeled**. The Data sources page names four, **Live / Measured / Derived / Model**. A reader who follows "the Data page carries the rest" meets a different vocabulary. | Code and screenshots | Use one taxonomy (the landing's three, or the four everywhere, terminal chips included). |
| L5 | Minor (tap) | Legal tab pills, `Legal.tsx:211` (`h-8`) | 32 px tall on a phone. | SMALLTAPS: `A[Terms] 65x32 … A[Data sources] 107x32` | `h-11` on phone, or a 44 px `before:` hit area. |
| L6 | Minor | `/legal/<unknown>`, `Legal.tsx:199` | A mistyped document (`/legal/nope`) silently becomes Terms. Every other wrong address gets the not-found page with a suggestion. | Sweep row 19: `/legal/nope → /legal/terms` | Render the not-found prompt with a suggestion (`suggest()`), or at least say "No such document — here are the terms". |
| L7 | Polish (brand naming) | Terms lead, `Legal.tsx:155` | "…for using Slayer Terminal. Slayer is a terminal…" mixes "Slayer Terminal" and "Slayer" in one sentence. The same mix appears on About, the footer and the meta description ("Slayer gathers it…"). | Screenshots | Decide: "Slayer Terminal" on first mention per page, "Slayer" after. That is what happens now, so this is only a style note. |
| — | (works) | Tabs | `aria-current="page"` is set, `nav aria-label="Legal"` is present, the URL and title change per tab, scroll resets to the top on switch, and `/legal` → `/legal/terms`. | `outside.out` LEGAL lines | — |

**About, Maintenance, header and footer**

| ID | Sev | Where | What is wrong | Evidence | Fix |
|---|---|---|---|---|---|
| O1 | Major | Every outside page on a direct load; `LaunchTransition.tsx:51,54,60` | Only `/` and `/welcome` boot "bare". Every other outside page (`/about`, `/status`, `/legal/*`, `/signin`, and even the 404 prompt) opens behind the full-screen **launch gate**, captioned **"Entering terminal"**, for about 1.35 s or more. That is wrong for an About or legal page, and on `/nope` the gate overlays the prompt while it types. | `extras.mjs` GATE: `/about ["Entering terminal slayer:~ $ live" × 4, …]`, `/nope ["Page not found slayer:~ $ Entering terminal…"]`. Screenshots: `shots/gate-on-about-700ms.png`, `shots/gate-on-legal-400ms.png`. Under the shared load the content appeared 3.9–5.6 s after navigation (`USABLE /signin 5552 ms`). | Extend `bootsBare()` to the outside routes (`/^\/(welcome\|i\/\|signup\|signin\|reset\|verified\|expired\|status\|about\|legal\|maintenance)/`) and to the not-found prompt, or caption the gate "Loading" off the terminal. |
| O2 | Minor | Header, `OutsideFrame.tsx:43-48` | The header has only the wordmark and "Launch terminal". There is no Sign in, no Pricing (`/#pricing`) and no theme switch. The footer has no Sign in or Sign up either (`SiteFooter.tsx:42-71`), so from About, Status or Legal the only way to sign in is through the landing. | `links.mjs`: the full link list of `/about` | Add a quiet "Sign in" text link before "Launch terminal" on outside pages, and a Pricing link in the footer's Company stack. |
| O3 | Minor (tap) | Header on a phone | The wordmark home link's hit box is **135 × 14 px**, and "Launch terminal" is **36 px** tall (`OutsideFrame.tsx:28`, `h-9`). | SMALLTAPS on every outside page | Pad the wordmark link to 44 px (`py-3.5` or a `before:` box). Use `h-11` for the pill below `sm`. |
| O4 | Minor (tap) | Footer on a phone (every page) | All 21 footer links are **18 px** tall (`A[Pulse] 31x18 … A[Data sources] 74x18`). The owner's 44 px phone rule is written for the landing, but the footer is the same component there. | SMALLTAPS | Add a `before:` hit box (`-inset-y-3`). |
| O5 | Minor (copy) | About body, `About.tsx:137-143` | The paragraph that walks the rooms leaves out **Terrain** and **Alerts**, although both are in the list below it. "It says what every number stands on" has an unclear "It" (Practice?). | `shots/about-desk-dark.png` | Add "Terrain is charts and nothing in the way." and change the last sentence to "Every number says what it stands on." |
| O6 | Polish (owner pattern) | About and Status heads, `About.tsx:130-131`, `Status.tsx:55-58` | The small label + silver bar + two-tone headline pattern and the tracked caps (`About.tsx:157` "HOME / MARKET…", uppercase, letter-spacing 0.14em) are what the owner removed from the landing on 2026-10-06 as reading "generated". The outside pages still use them. | Screenshots | Apply the landing's heads rule to the outside pages: no eyebrow or bar, sentence-case group names, one-tone heads. |
| O7 | Minor (copy/data) | `/maintenance`, `Maintenance.tsx:101` | "Down for maintenance until 6:00 ET." is hard-coded, with no day and no AM/PM. The mark is drawn in the `closed` state (the market's word), while the brand has an `offline` state that fits better. | `shots/maintenance-phone-light.png` | Read the time from a config (`MAINTENANCE_UNTIL`) and write it as "until 6:00 AM ET, Sat Oct 10". Use `state="offline"`. |
| O8 | Minor (tap) | `/maintenance` "Status" door, `Maintenance.tsx:103` (`h-10`) | 40 px tall. | SMALLTAPS: `A[Status] 82x40` | `h-11`. |
| — | (works) | Footer links (21) and header links | Every internal link resolves to a real page with its own title, `@JoinSlayer on X` has `target=_blank rel=noopener noreferrer`, and the mailto links are correct. The footer is on every outside page except the 404 prompt (by design). | `links.mjs` | — |

**404 prompt (`src/pages/notFound/NotFound.tsx`, `suggest.ts`)**

| ID | Sev | Where | What is wrong | Evidence | Fix |
|---|---|---|---|---|---|
| N1 | Minor | `/features`, `/tools`, `/products`, `/tour` → "did you mean `/#tools`" (`suggest.ts:65,77`) | The landing has no `#tools` anchor since v5 (the sections are `#how`, `#rooms`, `#trust`, `#pricing`, `#faq`), so the suggestion lands at the top of the landing. | `extras.mjs`: `features -> suggestion lands /#tools scrollY 0 has #tools? false` | Point those aliases at `/#rooms` and rename the label "The rooms". |
| N2 | Minor | The `KNOWN` list (`suggest.ts:56-70`) has no outside pages | `/terms`, `/privacy`, `/refund`, `/changelog`, `/forgot`, `/forgot-password` and `/logout` get no suggestion. `/contact` suggests **`/compass`**. `/about/x` suggests **Settings › About** instead of `/about`. | `extras.mjs` 404SUG lines; `outside.out`: `/about/x … did you mean /settings/about` | Add `/about`, `/status`, `/legal/*`, `/reset` and `/maintenance` to `KNOWN`, and add aliases: terms, privacy, refund(s), risk, data → legal; changelog → `/status`; forgot* → `/reset`; contact → `mailto:` or `/about`. |
| N3 | Polish (copy) | `NotFound.tsx:264` | "That looks like Sign in, on the **Account page**." There is no Account page. Likewise "About, on the Settings page". | `outside.out` `/login` | Drop the "on the … page" phrase when `where` is not a real page title. |
| N4 | Polish (owner rule) | Prompt type, `NotFound.tsx:233` (`font-mono`) | `font-mono` is Helvetica in this house (`tailwind.config` line 108). The rule says the prompt and the signature use `--font-code`, so `slayer:~ $ cd /nope` renders in a proportional face, unlike the signature. | `shots/nope-desk-dark.png` | `font-code`. |
| N5 | Polish (owner rule) | Prompt cursor, `NotFound.tsx:238,253` (`animate-cursor-blink`) | The cursor uses its own keyframes, not `sm-blink`, so it is not pinned by `brandClock.ts` and blinks out of sync with the wordmark's cursor in the header. | `rm.mjs`: `/nope ["sm-blink(inf)","cursor-blink(inf)"]` | Use the `sm-blink` keyframes, or register it with `brandClock`. |
| — | (works) | `/pricing` → `/#pricing` with Enter (scrolls to pricing, `scrollY 5497`), `/login` → `/signin`, Front page door, `noindex` and the "Page not found" title, an sr-only h1, reduced motion showing the answer at once. In-terminal 404s (`/pinpoint/ahed` → "Did you mean Ahead") keep the rail. | `outside.out` 404 lines; `shots/notfound-inside_pinpoint_ahed.png` | — |

### Inferences
- A1 is the one result that is actually false. Its likely triggers are real: a trailing slash from a pasted link, or a capitalised link in a tweet or email. One prop or a normalised path fixes it.
- A2, O1 and O2 together mean an existing user arriving anywhere but the landing has a slow, misleading path to sign in.
- Most Minor items are 44 px tap-target misses on a phone (header, footer, legal tabs, form foot links, status and maintenance doors). The landing already has the `before:` hit-area technique, so it can be shared through `OutsideFrame` and `SiteFooter`.

### Gaps
- No real email is sent and no session exists, by design, so password-manager save prompts and real reset links could not be tested.
- Screen-reader output was inferred from the DOM (ARIA attributes, focus), not heard in NVDA or VoiceOver.

---

## Q2. Which routes throw errors, fail requests, 404 or redirect unexpectedly? Which have duplicate or missing `<title>`s, or overflow on a phone? The full route table.

### Takeaway
Across all **125 addresses** there were **zero page errors, zero failed requests, zero 4xx/5xx responses and zero horizontal overflow at 390 px**. The only console error is a React duplicate-key warning on the NVDA earnings page. Redirects all behave as their comments describe. The title problems are:
- Generic "Slayer Terminal" titles on `/i/:code`, `/welcome?from=` and any case-variant URL.
- Ids read as tickers ("ABC123 · Backtest", "X · Journal").
- On a trailing slash, the title and the content disagree (see A1).

### Cited Findings

| ID | Sev | Where | What | Evidence | Fix |
|---|---|---|---|---|---|
| R1 | Minor | `/dossier/earnings/NVDA` (and `/earnings/NVDA`), `src/pages/record/EarningsName.tsx:475` | Console error: "Encountered two children with the same key `PUT-137.5`". Two of `dossier.activePuts` share an `id`, so a row can be dropped or duplicated as the list refreshes every 10 s. | Sweep rows 57 and 66: `consoleErr: ["Warning: Encountered two children with the same key, … PUT-137.5"]` | De-duplicate the busiest-puts list by `id` in the data builder, or key on `${c.id}-${i}`. |
| R2 | Polish | Every load | Two React Router "Future Flag" warnings (`v7_startTransition`, `v7_relativeSplatPath`). | Sweep `consoleWarn` on every route | Opt into both flags on the router, or silence them in development. |
| R3 | Minor | `PageMeta.tsx:153-155` (case-sensitive lookup) while the router is case-insensitive | `/About`, `/STATUS`, `/SignIn` render the page but title it "Slayer Terminal" (and `/SignIn` shows "You're in", see A1). | `case.mjs`: `/About Slayer Terminal`, `/STATUS Slayer Terminal` | Lower-case and strip the trailing slash before the lookup. |
| R4 | Minor | `/i/:code`, `/welcome?from=`, and `/alerts` before its redirect | Generic title "Slayer Terminal" with the landing description. | `extras.mjs` HEAD | Add TOP entries (see I5). |
| R5 | Polish | `/practice/backtest/abc123` → "ABC123 · Backtest · …"; `/practice/journal/x/y` → "X · Journal · …" | `TICKER = /^[A-Za-z^][A-Za-z0-9.^-]{0,5}$/` (`PageMeta.tsx:150`) reads short ids as tickers. On a real session id the page's `SayPage` wins, but for a missing or invalid id the tab shows a fake ticker. | Sweep rows 35, 38, 44, 48, 51 | Use the ticker rule only under `/dossier/stocks` and `/dossier/earnings` (the `NAME_PAGE` parents). Elsewhere fall back to the parent label. |
| R6 | Minor | `/legal/<unknown>` → `/legal/terms`; `/settings/<unknown>` → `/settings/account` | Silent redirects where the rest of the site shows "Nothing at this address" with a suggestion. | Sweep rows 19 and 80 | Route these through the not-found pages. |
| R7 | Minor (a11y, cross-ref) | `/pulse`, `/pulse/board` (desk), `/terrain`, `/pinpoint/map`, and their aliases (`/home`, `/live-terminal`, `/workspace`, `/pinpoint/command`, `/pinpoint/flow-map`, `/alerts`) | No `<h1>` at all. Other terminal pages have an h1, but it is the 15 px section name ("Compass" on the board, the tracker and a setup's page; "Settings" on every settings section), so the h1 often does not name the page. | Sweep h1 = 0 (390); textscan h1 list (1440) | Add a visually hidden h1 with the page's own name (the title's first part). |
| R8 | Polish | Duplicate titles | Distinct pages share a title only where intended (redirect aliases). `/i/:code` and `/welcome?from=` share the generic one. | Table below | See R4. |
| — | Context | Settle times | Outside pages had a median of about 3.1 s and terminal pages about 9.2 s. Twelve terminal routes (`/weigher`, `/dossier/news` and aliases, `/pinpoint/map`, `/pinpoint`, `/alerts`, `/compass/<bad id>`) still had a skeleton or `aria-busy` element at 15 s. A 20 s re-probe showed `/weigher` and `/dossier/news` settled, while `/pinpoint/map` at 390 px still had `aria-busy` and `data-skeleton` boxes (calendar-box, day-box, report-box), most likely below-the-fold Deferred panels waiting for scroll. | `busy.mjs` | Treat this as a pointer for the Pinpoint auditor, not a finding here (the server was shared and loaded). |

**Full route table (390 × 844, dark).** Columns: console errors / page errors / failed requests / 4xx-5xx. "Settle" means no `[aria-busy]`, `[data-skeleton]`, `.animate-pulse` or `#boot` for 0.5 s, timed out at 15 s, on a shared and loaded dev server.

| # | Route asked | Lands on | `<title>` | Err | Overflow | h1 | Settle (ms) |
|---|---|---|---|---|---|---|---|
| 1 | `/` | same | Slayer Terminal — Trade what you can see | 0/0/0/0 | 0 | 1 | 2274 |
| 2 | `/welcome` | `/` | Slayer Terminal — Trade what you can see | 0/0/0/0 | 0 | 1 | 3657 |
| 3 | `/welcome?from=zak` | same | **Slayer Terminal** (generic) | 0/0/0/0 | 0 | 1 | 2264 |
| 4 | `/i/zak-7Q2M` | same | **Slayer Terminal** (generic) | 0/0/0/0 | 0 | 1 | 3332 |
| 5 | `/signup` | same | Make your account · Slayer Terminal | 0/0/0/0 (harness crash on first pass; clean on re-check) | 0 | 1 | n/a |
| 6 | `/signup?plan=compass` | same | Make your account · Slayer Terminal | 0/0/0/0 | 0 | 1 | 1834 |
| 7 | `/signin` | same | Sign in · Slayer Terminal | 0/0/0/0 | 0 | 1 | 2619 |
| 8 | `/reset` | same | Reset your password · Slayer Terminal | 0/0/0/0 | 0 | 1 | 2265 |
| 9 | `/verified` | same | You’re in · Slayer Terminal | 0/0/0/0 | 0 | 1 | 1985 |
| 10 | `/expired` | same | That link has expired · Slayer Terminal | 0/0/0/0 | 0 | 1 | 3099 |
| 11 | `/status` | same | Status · Slayer Terminal | 0/0/0/0 | 0 | 1 | 2588 |
| 12 | `/about` | same | About · Slayer Terminal | 0/0/0/0 | 0 | 1 | 3322 |
| 13 | `/legal` | `/legal/terms` | Terms · Legal · Slayer Terminal | 0/0/0/0 | 0 | 1 | 3172 |
| 14 | `/legal/terms` | same | Terms · Legal · Slayer Terminal | 0/0/0/0 | 0 | 1 | 3339 |
| 15 | `/legal/privacy` | same | Privacy · Legal · Slayer Terminal | 0/0/0/0 | 0 | 1 | 3217 |
| 16 | `/legal/risk` | same | Risk disclosure · Legal · Slayer Terminal | 0/0/0/0 | 0 | 1 | 3179 |
| 17 | `/legal/refunds` | same | Refund policy · Legal · Slayer Terminal | 0/0/0/0 | 0 | 1 | 3583 |
| 18 | `/legal/data` | same | Data sources · Legal · Slayer Terminal | 0/0/0/0 | 0 | 1 | 2235 |
| 19 | `/legal/nope` | `/legal/terms` (silent) | Terms · Legal · Slayer Terminal | 0/0/0/0 | 0 | 1 | 4392 |
| 20 | `/maintenance` | same | Down for maintenance · Slayer Terminal | 0/0/0/0 | 0 | 1 | 2491 |
| 21 | `/home` | `/pulse` | Pulse · Slayer Terminal | 0/0/0/0 | 0 | **0** | 7607 |
| 22 | `/pulse` | same | Pulse · Slayer Terminal | 0/0/0/0 | 0 | **0** | 11471 |
| 23 | `/pulse/board` | same | Four charts · Pulse · Slayer Terminal | 0/0/0/0 | 0 | 1 | 13576 |
| 24 | `/terrain` | same | Terrain · Slayer Terminal | 0/0/0/0 | 0 | **0** | 11821 |
| 25 | `/live-terminal` | `/pulse` | Pulse · Slayer Terminal | 0/0/0/0 | 0 | 0 | 13593 |
| 26 | `/workspace` | `/pulse` | Pulse · Slayer Terminal | 0/0/0/0 | 0 | 0 | 12749 |
| 27 | `/compass` | same | Compass · Slayer Terminal | 0/0/0/0 | 0 | 1 | 8784 |
| 28 | `/compass/tracker` | same | Tracker · Compass · Slayer Terminal | 0/0/0/0 | 0 | 1 | 9078 |
| 29 | `/compass/NVDA-480-C-weekly` | same (no such setup) | Page not found · Slayer Terminal | 0/0/0/0 | 0 | 1 | >15 s |
| 30 | `/weigher` | same | Weigher · Slayer Terminal | 0/0/0/0 | 0 | 1 | >15 s |
| 31 | `/skys-vision` | `/compass` | Compass · Slayer Terminal | 0/0/0/0 | 0 | 1 | 15277 |
| 32 | `/practice` | `/practice/paper` | Paper · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 12769 |
| 33 | `/practice/paper` | same | Paper · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 9798 |
| 34 | `/practice/backtest` | same | Backtest · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 11069 |
| 35 | `/practice/backtest/abc123` | same | **ABC123** · Backtest · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 18195 |
| 36 | `/practice/backtest/abc123/report` | same | ABC123 · Backtest · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 7771 |
| 37 | `/practice/journal` | same | Journal · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 15128 |
| 38 | `/practice/journal/x/y` | same | **X** · Journal · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 12018 |
| 39 | `/paper` | `/practice/paper` | Paper · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 9525 |
| 40 | `/paper/live-chart` | `/practice/paper` | Paper · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 10593 |
| 41 | `/paper/desk` | `/practice/paper` | Paper · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 9788 |
| 42 | `/paper/evaluation` | `/practice/paper` | Paper · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 9296 |
| 43 | `/paper/journal` | `/practice/journal` | Journal · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 9787 |
| 44 | `/paper/journal/x/y` | `/practice/journal/x/y` | X · Journal · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 9482 |
| 45 | `/review` | `/practice/backtest` | Backtest · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 10294 |
| 46 | `/review/backtest` | `/practice/backtest` | Backtest · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 11052 |
| 47 | `/review/futures` | `/practice/backtest` | Backtest · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 10375 |
| 48 | `/review/backtest/abc` | `/practice/backtest/abc` | ABC · Backtest · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 11202 |
| 49 | `/review/backtest/abc/report` | `/practice/backtest/abc/report` | ABC · Backtest · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 8761 |
| 50 | `/review/journal` | `/practice/journal?book=backtest` | Journal · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 11198 |
| 51 | `/review/journal/x/y` | `/practice/journal/x/y?book=backtest` | X · Journal · Practice · Slayer Terminal | 0/0/0/0 | 0 | 1 | 15161 |
| 52 | `/record` | `/dossier/news` | News · Dossier · Slayer Terminal | 0/0/0/0 | 0 | 1 | >15 s |
| 53 | `/record/news` | `/dossier/news` | News · Dossier · Slayer Terminal | 0/0/0/0 | 0 | 1 | >15 s |
| 54 | `/dossier` | `/dossier/news` | News · Dossier · Slayer Terminal | 0/0/0/0 | 0 | 1 | >15 s |
| 55 | `/dossier/news` | same | News · Dossier · Slayer Terminal | 0/0/0/0 | 0 | 1 | 13385 |
| 56 | `/dossier/earnings` | same | Earnings · Dossier · Slayer Terminal | 0/0/0/0 | 0 | 1 | 6443 |
| 57 | `/dossier/earnings/NVDA` | same | NVDA · Earnings · Dossier · Slayer Terminal | **1**/0/0/0 | 0 | 1 | 8461 |
| 58 | `/dossier/insiders` | same | Insiders · Dossier · Slayer Terminal | 0/0/0/0 | 0 | 1 | 10422 |
| 59 | `/dossier/congress` | same | Congress · Dossier · Slayer Terminal | 0/0/0/0 | 0 | 1 | 8431 |
| 60 | `/dossier/stocks` | same | Stocks · Dossier · Slayer Terminal | 0/0/0/0 | 0 | 1 | 16305 |
| 61 | `/dossier/stocks/NVDA` | same | NVDA · Stocks · Dossier · Slayer Terminal | 0/0/0/0 | 0 | 1 | 9735 |
| 62 | `/stocks` | `/dossier/stocks` | Stocks · Dossier · Slayer Terminal | 0/0/0/0 | 0 | 1 | 25325 |
| 63 | `/news` | `/dossier/news` | News · Dossier · Slayer Terminal | 0/0/0/0 | 0 | 1 | >15 s |
| 64 | `/newsroom` | `/dossier/news` | News · Dossier · Slayer Terminal | 0/0/0/0 | 0 | 1 | >15 s |
| 65 | `/earnings` | `/dossier/earnings` | Earnings · Dossier · Slayer Terminal | 0/0/0/0 | 0 | 1 | 10045 |
| 66 | `/earnings/NVDA` | `/dossier/earnings/NVDA` | NVDA · Earnings · Dossier · Slayer Terminal | **1**/0/0/0 | 0 | 1 | 13798 |
| 67 | `/watchlist` | `/weigher` | Weigher · Slayer Terminal | 0/0/0/0 | 0 | 1 | >15 s |
| 68 | `/tracker` | `/compass/tracker` | Tracker · Compass · Slayer Terminal | 0/0/0/0 | 0 | 1 | 8200 |
| 69 | `/settings` | `/settings/account` | Account · Settings · Slayer Terminal | 0/0/0/0 | 0 | 1 | 7723 |
| 70 | `/settings/account` | same | Account · Settings · Slayer Terminal | 0/0/0/0 | 0 | 1 | 6073 |
| 71 | `/settings/billing` | same | Billing · Settings · Slayer Terminal | 0/0/0/0 | 0 | 1 | 6175 |
| 72 | `/settings/data` | same | Data · Settings · Slayer Terminal | 0/0/0/0 | 0 | 1 | 7059 |
| 73 | `/settings/appearance` | same | Appearance · Settings · Slayer Terminal | 0/0/0/0 | 0 | 1 | 5815 |
| 74 | `/settings/desk` | same | The desk · Settings · Slayer Terminal | 0/0/0/0 | 0 | 1 | 7313 |
| 75 | `/settings/sounds` | same | Sounds · Settings · Slayer Terminal | 0/0/0/0 | 0 | 1 | 7464 |
| 76 | `/settings/invite` | same | Invite a trader · Settings · Slayer Terminal | 0/0/0/0 | 0 | 1 | 5657 |
| 77 | `/settings/mail` | same | Email preferences · Settings · Slayer Terminal | 0/0/0/0 | 0 | 1 | 7570 |
| 78 | `/settings/keyboard` | same | Keyboard · Settings · Slayer Terminal | 0/0/0/0 | 0 | 1 | 6682 |
| 79 | `/settings/about` | same | About · Settings · Slayer Terminal | 0/0/0/0 | 0 | 1 | 6773 |
| 80 | `/settings/nope` | `/settings/account` (silent) | Account · Settings · Slayer Terminal | 0/0/0/0 | 0 | 1 | 6645 |
| 81 | `/pinpoint` | `/pinpoint/map` | Map · Pinpoint · Slayer Terminal | 0/0/0/0 | 0 | 1 | >15 s |
| 82 | `/pinpoint/command` | `/pulse` | Pulse · Slayer Terminal | 0/0/0/0 | 0 | 0 | 13770 |
| 83 | `/pinpoint/flow-map` | `/pulse` | Pulse · Slayer Terminal | 0/0/0/0 | 0 | 0 | 16304 |
| 84 | `/pinpoint/map` | same | Map · Pinpoint · Slayer Terminal | 0/0/0/0 | 0 | **0** | >15 s |
| 85 | `/pinpoint/ahead` | same | Ahead · Pinpoint · Slayer Terminal | 0/0/0/0 | 0 | 1 | 11890 |
| 86 | `/pinpoint/building` | same | Building · Pinpoint · Slayer Terminal | 0/0/0/0 | 0 | 1 | 10399 |
| 87 | `/pinpoint/wall` | same | At the wall · Pinpoint · Slayer Terminal | 0/0/0/0 | 0 | 1 | 7552 |
| 88 | `/pinpoint/targets` | same | Targets · Pinpoint · Slayer Terminal | 0/0/0/0 | 0 | 1 | 12033 |
| 89 | `/pinpoint/board` | same | Board · Pinpoint · Slayer Terminal | 0/0/0/0 | 0 | 1 | 13742 |
| 90 | `/pinpoint/compare` | same | Compare · Pinpoint · Slayer Terminal | 0/0/0/0 | 0 | 1 | 12053 |
| 91 | `/pinpoint/ranked-targets` | `/pinpoint/targets` | Targets · Pinpoint · Slayer Terminal | 0/0/0/0 | 0 | 1 | 11867 |
| 92 | `/pinpoint/vol-lab` | `/pinpoint/map` | Map · Pinpoint · Slayer Terminal | 0/0/0/0 | 0 | 1 | >15 s |
| 93 | `/trace` | `/trace/live-tape` | Live Tape · Trace · Slayer Terminal | 0/0/0/0 | 0 | 1 | 9889 |
| 94 | `/trace/live-tape` | same | Live Tape · Trace · Slayer Terminal | 0/0/0/0 | 0 | 1 | 11074 |
| 95 | `/trace/screener` | same | Screener · Trace · Slayer Terminal | 0/0/0/0 | 0 | 1 | 12273 |
| 96 | `/trace/net-flow` | same | Net Flow · Trace · Slayer Terminal | 0/0/0/0 | 0 | 1 | 9590 |
| 97 | `/trace/footprints` | same | Footprints · Trace · Slayer Terminal | 0/0/0/0 | 0 | 1 | 8233 |
| 98 | `/trace/watchers` | same | Watchers · Trace · Slayer Terminal | 0/0/0/0 | 0 | 1 | 11104 |
| 99 | `/trace/flow-alerts` | `/trace/watchers` | Watchers · Trace · Slayer Terminal | 0/0/0/0 | 0 | 1 | 10508 |
| 100 | `/trace/windows` | same | Windows · Trace · Slayer Terminal | 0/0/0/0 | 0 | 1 | 13161 |
| 101 | `/trace/intervals` | `/trace/windows` | Windows · Trace · Slayer Terminal | 0/0/0/0 | 0 | 1 | 13490 |
| 102 | `/trace/odte` | same | 0DTE · Trace · Slayer Terminal | 0/0/0/0 | 0 | 1 | 10871 |
| 103 | `/trace/multi-leg` | same | Multi-Leg · Trace · Slayer Terminal | 0/0/0/0 | 0 | 1 | 13211 |
| 104 | `/trace/compare` | same | Compare · Trace · Slayer Terminal | 0/0/0/0 | 0 | 1 | 10344 |
| 105 | `/trace/dark-pool` | same | Dark Pool · Trace · Slayer Terminal | 0/0/0/0 | 0 | 1 | 12577 |
| 106 | `/trace/dark-feed` | `/trace/dark-pool` | Dark Pool · Trace · Slayer Terminal | 0/0/0/0 | 0 | 1 | 10944 |
| 107 | `/trace/scanner` | `/trace/screener` | Screener · Trace · Slayer Terminal | 0/0/0/0 | 0 | 1 | 14778 |
| 108 | `/trace/tracker` | same | Tracker · Trace · Slayer Terminal | 0/0/0/0 | 0 | 1 | 9300 |
| 109 | `/liquidity` | `/trace/live-tape` | Live Tape · Trace · Slayer Terminal | 0/0/0/0 | 0 | 1 | 12696 |
| 110 | `/flow-desk/x` | `/trace/live-tape` | Live Tape · Trace · Slayer Terminal | 0/0/0/0 | 0 | 1 | 12392 |
| 111 | `/pinpoint-gex/x` | `/pinpoint/map` | Map · Pinpoint · Slayer Terminal | 0/0/0/0 | 0 | 1 | 8206 |
| 112 | `/community` | same | Community · Slayer Terminal | 0/0/0/0 | 0 | 1 | 8281 |
| 113 | `/community/x` | `/community` | Community · Slayer Terminal | 0/0/0/0 | 0 | 1 | 5990 |
| 114 | `/alerts` | `/pulse` (drawer open) | Pulse · Slayer Terminal | 0/0/0/0 | 0 | 0 | >15 s |
| 115 | `/auditor-log` | `/compass/tracker` | Tracker · Compass · Slayer Terminal | 0/0/0/0 | 0 | 1 | 6813 |
| 116 | `/pulse/nope` | same (in-terminal 404) | Page not found · Slayer Terminal | 0/0/0/0 | 0 | 1 | 6464 |
| 117 | `/pinpoint/ahed` | same (in-terminal 404) | Page not found · Slayer Terminal | 0/0/0/0 | 0 | 1 | 9085 |
| 118 | `/trace/nope` | same | Page not found · Slayer Terminal | 0/0/0/0 | 0 | 1 | 5034 |
| 119 | `/dossier/nope` | same | Page not found · Slayer Terminal | 0/0/0/0 | 0 | 1 | 4934 |
| 120 | `/practice/nope` | same | Page not found · Slayer Terminal | 0/0/0/0 | 0 | 1 | 4428 |
| 121 | `/weigher/nope` | same | Page not found · Slayer Terminal | 0/0/0/0 | 0 | 1 | 5663 |
| 122 | `/terrain/nope` | same | Page not found · Slayer Terminal | 0/0/0/0 | 0 | 1 | 5577 |
| 123 | `/nope` | same (prompt) | Page not found · Slayer Terminal | 0/0/0/0 | 0 | 1 | 4045 |
| 124 | `/pricing` | same (prompt → `/#pricing`) | Page not found · Slayer Terminal | 0/0/0/0 | 0 | 1 | 3234 |
| 125 | `/login` | same (prompt → `/signin`) | Page not found · Slayer Terminal | 0/0/0/0 | 0 | 1 | 2591 |

Extra addresses probed outside the table: `/signin/`, `/signup/`, `/reset/`, `/SIGNUP`, `/Expired` all show "You're in" (A1). `/About` and `/STATUS` show the right page with a generic title (R3). `/terms`, `/privacy`, `/contact`, `/features`, `/tools`, `/products`, `/register`, `/changelog`, `/forgot`, `/forgot-password`, `/logout`, `/refund` all reach the prompt (see N1 and N2 for their suggestions).

### Inferences
- Every route is technically healthy. Every problem in this section is about meaning (false screen, wrong title, silent redirect), not crashes.
- Deep-link reloads are covered by this table: every row is a cold load of that address, and all render the right page, apart from the trailing-slash and case issues.

### Gaps
- The sweep ran in development mode. A production build (`vite build && preview`) was not swept, since the brief said not to start servers. That leaves bundle-split timing and any production-only error unmeasured.
- Settle times are not trustworthy as absolute numbers (shared, loaded server).

---

## Q3. Accessibility site-wide: lang, landmarks, heading order, focus rings, form labels, muted-text contrast in both themes, reduced motion, 44 px tap targets on a phone.

### Takeaway
The basics are sound:
- `lang="en"` everywhere.
- One `<main>`, one `<header>` and one footer per outside page.
- A labelled legal nav, labelled inputs, a visible focus ring on every Tab stop.
- Reduced motion fully honoured.
- Muted text passing AA in both themes.

The gaps:
- Tap targets under 44 px across the outside pages and the footer.
- Thin focus rings (1 px at 55% on dark).
- Errors not announced.
- The Status strip's meaning carried by colour and `title` alone.
- No skip link.
- No `<main>` on the landing.
- No h1 on Pulse, Terrain and Pinpoint Map.

### Cited Findings

| ID | Sev | Where | What | Evidence | Fix |
|---|---|---|---|---|---|
| X1 | (works) | All outside pages | `lang="en"`, 1 `main`, 1 `header`, 1 `footer` (the prompt has no footer, by design), `nav aria-label="Legal"` and `"Footer"`. One h1 per page; Status has h1 → h2; Legal has h1 → h2. | `outside.out` A11Y lines, both themes | — |
| X2 | Minor | `/` landing | 0 `<main>` landmarks, and 3 controls with no accessible name (two FAQ-style buttons, one `before:` anchor). | Sweep `main!=1: ['/', '/welcome'→'/']`; textscan `/ noname 3` | Wrap the landing's content in `<main>`, and give the unnamed buttons text or an `aria-label` (cross-ref the landing auditor). |
| X3 | Minor | `/pulse`, `/terrain`, `/pinpoint/map` | No h1. See R7. | Sweep | Add a visually hidden h1. |
| X4 | Minor | `/pinpoint/wall`, `/trace/multi-leg` | The headings skip from h1 to h3. | `textscan.json` `skip: ['h1->h3']` | Make the first sub-heading an h2. |
| X5 | Minor | `/settings/account` | 3 visible inputs (`text`, `text`, `email`) have no label, `aria-label` or `title`. | `textscan.json`: `unl 3 ['input[text] ph=""', 'input[text] ph=""', 'input[email] ph=""']` | Associate the visible captions with `<label htmlFor>`. |
| X6 | Minor | Global ring, `src/index.css:36-46` | `:focus-visible` is `outline: 1px solid rgb(var(--silver)/var(--ring-a))` with `--ring-a: 0.55` on dark (`tokens.css:172`). A 1 px ring at 55% alpha is hard to see on dense pages, and the landing's own bar uses 2 px. Inputs switch it off entirely (A11). | Tab walk: every stop `outline=solid 1px rgba(199,211,232,0.55)` (`outside.out` TAB) | Use 2 px everywhere (`outline-width: 2px; outline-offset: 2px`). Keep the per-theme strength. |
| X7 | Minor | All outside pages | No "Skip to content" link. The first Tab stop is the wordmark, then "Launch terminal", then the page. On a legal page the reader passes 2 stops; inside the terminal, many more. | TAB walks | Add a visually hidden skip link as the first focusable element in `OutsideFrame` and `AppShell`. |
| X8 | Minor | Phone tap targets (390 px) | Header wordmark 135×14; Launch terminal 125×36; footer links ×21 at 18 px tall; legal pills 32 px; form foot links 15 px; "Open in Paper" 36 px; maintenance "Status" 40 px; About's mailto 21 px. The owner's rule "ON A PHONE NOTHING TAKES LESS THAN A FINGER: every control is 44 px" is written for the landing, but the footer is shared with it. | `outside.out` SMALLTAPS (identical in both themes) | Apply the landing's `before:` hit-area utility to `OutsideFrame`, `SiteFooter`, the Legal tabs and the `Foot` links. |
| X9 | (works) | Muted-text contrast, computed from tokens | Dark: `--text-muted` 125/125/125 is **4.95:1** on canvas and **4.81:1** on panel; `--text-secondary` is 8.08 and 7.85. Light: muted (64,67,74) is **8.69:1** on canvas and **9.91:1** on panel. Error ink (`--bear`) is 5.58 on the dark panel and 4.92 on the light panel (4.31 on the light canvas, but errors sit on the panel). Every text node on the 12 outside pages passed AA in both themes. The one automated failure ("Launch terminal" on `/nope`, 1.03 and 1.14) is a false positive: the pill's ground is a gradient `background-image` that the checker can't read. | `links.mjs` TOK lines; `outside.out` LOWCONTRAST | Dark muted is at 4.81–4.95, so any further dimming (e.g. `text-textMuted/80`) will fail. Keep muted text at full token strength on dark. |
| X10 | Minor | Status strip | Non-text contrast is 2.81 on dark and 1.81 on light, and meaning is carried only by colour and `title`. See S1 and S2. | — | — |
| X11 | (works) | Reduced motion | With `reducedMotion: 'reduce'`, no animation runs on `/signin`, `/maintenance`, `/status` or `/nope` (the brand's foil `sm-pan` and cursor `sm-blink` stop). The 404 prompt shows its answer at once. The boot gate and the `index.html` wordmark-typing go still. | `rm.mjs`: no-preference `["sm-blink(inf)","sm-pan(inf)"]`, reduce `[]` | — |
| X12 | Polish | `/nope` and `/pricing` before the prompt "answers" | The typing div is `aria-hidden` until it answers (`NotFound.tsx:233`). The sr-only h1 "Page not found" covers it. Good, though a screen-reader user hears the suggestion only after about 1 s. | Code | Optionally put an `aria-live="polite"` wrapper on the answer. |

### Inferences
- Taken together, the outside pages rate AA-adjacent. The fixes that matter most for a phone user are the 44 px targets (X8), and for a keyboard user the 2 px ring and skip link (X6, X7).
- Dark-theme muted text has almost no headroom above 4.5:1. Treat `--text-muted` on dark as a floor.

### Gaps
- No screen reader was run. Windows High Contrast and forced colours were not tested. Zoom to 200% and text-spacing overrides were not tested.

---

## Q4. Copy: the banned words, any visible "[placeholder]", typos and inconsistent brand naming (rendered text plus a grep of src).

### Takeaway
**No banned word and no "[placeholder]" is visible** on any of the 79 distinct pages in their default state, in body text, `aria-label`, `title`, `placeholder` or `alt`. A check for trade-call words (ENTER, EXIT, BUY, SELL, OVERWEIGHT, signal) on Compass, Live Tape, Stocks, NVDA, Pulse, Weigher and News also came back clean. In `src` the banned words survive only in comments and identifiers, and two comments now contradict the owner's rules. The copy problems are:
- A licence claim on `/legal/data`.
- Two data taxonomies (Observed / Calculated / Modeled vs Live / Measured / Derived / Model).
- "landing desk".
- About leaving out rooms.
- Small naming drift.

### Cited Findings

| ID | Sev | Where | What | Evidence | Fix |
|---|---|---|---|---|---|
| C1 | (works) | 79 rendered URLs at 1440 × 900, dark | 0 hits for `grade|score|win rate|guaranteed|confluence|market intelligence|simulat*|demo*|fake|preview*|pretend*|at launch|placeholder|lorem|undefined|NaN|null|[object` or any `[…]` token. The single regex hit was `[ / ]` key caps on `/settings/keyboard`, a false positive. | `textscan.json` | — |
| C2 | (works) | Trade-call words | 0 hits on 7 key pages. | `calls.mjs` | — |
| C3 | Major | `/legal/data` "licensed feed" | See L3. | — | — |
| C4 | Minor | Data taxonomy | See L4. | — | — |
| C5 | Minor | "landing desk" (`Auth.tsx:185`, `Invite.tsx:71`, `PageMeta.tsx:80`) | See I6. | — | — |
| C6 | Minor | About body | Terrain and Alerts are missing, and the "It" in the last sentence is unclear. See O5. | — | — |
| C7 | Polish | Comments that contradict the rules (not visible) | `src/pages/practice/PracticeLayout.tsx:18-22` says the Paper page "says 'Simulated feed'" and Backtest "'Simulated tape'". `src/pages/outside/Status.tsx:10` says "Sign-in says it opens at launch". `src/components/layout/SideNav.tsx:34` and `src/data/release.ts:6` quote "● simulated · demo feed". None of these render, but they will mislead the next edit. | grep | Update the comments to today's rule. |
| C8 | Polish | Naming | "Make your account" / "Make account" / "Sign up free" (A16). "Slayer" vs "Slayer Terminal" (L7). The 404 says "Account page" and "Settings page" (N3). `/maintenance` says "6:00 ET" with no AM/PM (O7). | — | — |
| C9 | Polish | Status | The legend's "gray" is US spelling. The code comments use "grey" (`Status.tsx:10`). Pick one; US matches the rest of the UI. | — | — |
| C10 | (works) | `filled()` placeholder guard, `src/data/company.ts:26` | `legalName` and `address` are still `[Company legal name]` and `[Mailing address]`, and neither renders anywhere (the footer and legal pages skip them). | `textscan.json` (no `[…]` hits) | — |

### Inferences
- The owner's banned-word and "never say simulated" rules hold in the rendered UI. The remaining risk is claims (the licensed feed) and vocabulary drift between the landing and the legal page.

### Gaps
- The text scan read each page in its default state. Menus, drawers, tooltips that appear only on hover, toasts and modals deeper in the terminal were not opened. The terminal-room auditors cover those.

---

## Q5. Cross-cutting: consistency of buttons, inputs, headings, spacing and footer; favicon and og meta; the theme persisting across navigation; back/forward; deep-link reloads.

### Takeaway
- **Icons, manifest and og:** all present and well-formed.
- **Stored theme:** persists through navigation, back and reload.
- **Back/forward:** behaves, except the form sent states (A8) and the post-sign-in entry (A9).
- **No stored theme:** a visitor on a light machine moves from a light landing to a **dark** sign-up form mid-flow, with no theme switch on any outside page.
- **Consistency:** buttons, headline sizes and card radii vary page to page; the footer is consistent.

### Cited Findings

| ID | Sev | Where | What | Evidence | Fix |
|---|---|---|---|---|---|
| T1 | Major | First visit, no stored choice, machine in light mode; `index.html:58` (only `location.pathname === "/"` follows the machine), `src/theme/theme.ts:69-77` (`firstGround` only on `/`), `loadChoice()` defaults to `'dark'` | The landing stands light. Pressing "Sign up free" lands on a **dark** `/signup`, and a direct load of `/signin` or `/about` is dark as well. The visitor sees the site switch themes mid-flow and has no switch on any outside page to change it. | `outside.out`: `THEME no choice, machine light [["/","light"],["/signin via SPA","dark"],["/signin direct","dark"],["/about direct","dark"],["landing Sign up free -> /signup","dark"]]`. Screenshot: `shots/machine-light-signup-from-landing.png` | Let the outside pages follow the machine like the landing (extend the `/` test in `index.html` and `firstGround` to `OutsideFrame` routes), and add the landing's theme button to the `OutsideFrame` header. |
| T2 | (works) | Stored `slayer_theme=light` | Stays light across `/about` → footer Terms → Launch terminal → `/pulse` → Back → reload. | `outside.out` `THEME stored light` | — |
| B1 | (works) | Back/forward | `/signin` → Forgot → Back to sign in → Back → Back → Forward walks the right pages. Navigating to a new page starts at the top (footer Terms from the bottom of `/about` → `scrollY 0`). The legal tab switch resets scroll. | `outside.out` BACK/FWD and FOOTER lines | — |
| B2 | Polish | Scroll restoration | After `/status` scrolled to 700 → footer Privacy → Back, the page restored to **1091**, not 700. The footer art or the late-loading changelog probably changes the height before the restore. | `outside.out` `SCROLL status@700 … back scrollY 1091` | Restore after the layout settles, or use the router's `<ScrollRestoration>` keyed by location. |
| B3 | Minor | Post-sign-in Back, and the form sent states | See A8 and A9. | — | — |
| D1 | (works) | Deep-link reloads | Every one of the 125 addresses loads cold and renders correctly (the route table). Exceptions: A1 (trailing slash and case) and R6 (silent legal and settings fallbacks). | Sweep | — |
| F1 | (works) | Favicons and manifest (`index.html:16-20`, `public/`) | `favicon.ico` (16/32/48, 200 `image/x-icon`), `favicon.svg` (200), `favicon-32.png` (32×32), `apple-touch-icon.png` (180×180), `icon-192/512`, `icon-maskable-512` (512×512), shortcut icons (96×96) and `site.webmanifest` (200 `application/manifest+json`, `start_url /pulse`, 3 shortcuts) all load. The SVG icon is swapped at runtime for a data-URL of the mark's state (`src/brand/favicon.tsx`). | `curl` and `file` checks; `extras.mjs` HEAD `icon:["/favicon.ico","data:image/svg+xml…","/favicon-32.png"]` | — |
| F2 | (works) | og and twitter (`index.html:21-34`) | `og:type`, `og:site_name`, `og:title`, `og:description`, `og:url`, `og:image` (1200×630 JPEG, 120 KB, matches the declared width and height) and `og:image:alt` are present, as are `twitter:card=summary_large_image`, `twitter:site=@JoinSlayer` and the title, description and image. `PageMeta` keeps `og:title` and `og:description` in step per page. | `extras.mjs` HEAD; PIL: `og.jpg (1200, 630)` | — |
| F3 | Polish | Head per page (`PageMeta.tsx:186-201`) | `og:url` stays `https://slayerterminal.com/` on every page while `og:title` changes. There is no `<link rel="canonical">`. On not-found pages `og:title` stays the site name while the tab says "Page not found". | `extras.mjs` HEAD: `ogu` is constant, `canon:null` | Set `og:url` and a canonical link to `origin + pathname` in `PageMeta`. (Link previews read `index.html` anyway, so this matters only to crawlers that run JS.) |
| F4 | Polish | `/robots.txt`, `/sitemap.xml` | Neither exists. The SPA fallback answers both with the HTML shell and **200 `text/html`**. | `curl`: `robots.txt 200 text/html` | Add a `public/robots.txt` (and a sitemap later). |
| F5 | Polish | `meta theme-color` | `#050505` on dark and switched by `theme.ts` (`apply()`) to the ground in light. | `extras.mjs` HEAD | — |
| K1 | Polish | Primary button heights on outside pages | Auth submit 48 px (`h-12`); Invite and Welcome 48; About "Sign up free" 44 (`h-11`); 404 doors 48; header Launch 36 (`h-9`); Status "Open in Paper" 36; Maintenance "Status" 40 (`h-10`). | Code and SMALLTAPS | Two sizes only: 44 (`lg`) for page doors and 48 (`block`) for full-width form submits. Use `LaunchPill`'s `size` prop everywhere. |
| K2 | Polish | Headline scale on outside pages | Invite, Welcome and Maintenance h1 30 px; auth 32 px; Legal 40→52 px; About and Status 40→56 px; all weight 300. In the terminal, h1 is 15–18 px semibold. | textscan h1 `fs` | Set one outside display size for card pages (32) and one for document pages (52), as tokens. |
| K3 | Polish | Card radii | Auth card 32 px; Invite and Welcome 28 px; Status sections 16 px (`rounded-2xl`); Maintenance `BracketCard`. | Code (`Auth.tsx:31`, `Invite.tsx:33,63`, `Status.tsx:62`) | Pick one radius for outside cards. |
| K4 | Polish | Vertical rhythm | Card pages centre with `pb-[10vh]` (auth, invite) or `pb-[12vh]` (maintenance, 404). Document pages start at `pt-10` (About, Status) or `pt-8` (Legal). | Code | Pick one top inset and one centring offset. |
| K5 | (works) | Footer | Identical `SiteFooter` on every outside page and every terminal page (1 footer each; the not-found prompt has none, by design). The page's own scene, the same link set, and the column layout at 920 px. | Sweep `footer` counts; `links.mjs` | Tap-target issue in O4. |

### Inferences
- T1 is the most visible cross-cutting flaw: the owner put real care into the landing's first-frame ground (index.html pre-paint, `ground.tsx`), and it breaks one click later.
- The visual inconsistencies (K1–K4) are small one at a time. Together they make the outside pages feel like separately built screens. A tiny `OutsidePage` and `OutsideCard` primitive (heading size, radius, padding, door sizes) would settle all four.

### What works well (summary for the report writer)
- Zero runtime errors, failed requests or phone overflow on 125 routes. Every legacy address lands on its new page with its query carried through (`/review/journal?…` → `/practice/journal?…&book=backtest`).
- Account forms: correct input types, `autocomplete` tokens, labels and `aria-invalid`; clear one-line errors; resend; prefill from `?email`; plan and inviter shown on sign-up.
- The two 404s are well judged: the in-terminal one keeps the rail with "Did you mean", the full-screen prompt guesses (`/pricing` → `/#pricing`, `/login` → `/signin`) and takes Enter, and both are `noindex` with a clear title.
- The footer is consistent everywhere and every link works. Legal tabs are a labelled nav with `aria-current`.
- Reduced motion is honoured completely, and muted text passes AA in both themes.
- Icons, manifest and the share card are complete and correctly sized. The tab icon follows the mark's state.
- No banned word, "simulated"-type word or placeholder is visible anywhere scanned.

### Gaps
- Real devices (iOS Safari, Android Chrome) were not used. "Phone" here means Chromium at 390 × 844 without touch emulation.
- Which icon Chromium actually picks from the three `<link rel=icon>` entries (ICO with sizes, SVG, PNG-32 listed last) was not determined. If the static PNG wins, the state-following SVG would never show. Worth checking in a real browser tab.
- A production build was not swept.
