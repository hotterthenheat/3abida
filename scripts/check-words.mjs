/*
  THE WORDS A READER MUST NEVER SEE (2026-10-09) — `npm run words:check`.

  The owner's rules, in one pass over the source (.claude/CLAUDE.md, and the audit's X7 and X8):

    · the data is never said to be anything but the market's: no "simulated", "demo", "fake", "preview", "pretend",
      "at launch", "invented", "sample", "until the feed lands", nor a claim the other way ("licensed feed");
    · the terminal reads, it never grades or calls a trade: no "grade", "score", "win rate", "signal" (as a trade
      call), "guaranteed", "confluence", "market intelligence";
    · and no trade instruction: "buy the", "sell the", "sell into", "scalp", "take profit", "trade the break",
      "don't chase", "fade", "should struggle", "protective floor under our entry", "you should", "enter long",
      "go long", "go short".

  WHAT IS READ: only what can reach a reader — JSX text, the string props of an element (a title, an aria-label, a
  placeholder, a component's own words), and string literals and template literals in code that read as words (more
  than one word, a capitalised word, or the value of a key such as label, title, text, line or tip). WHAT IS NOT:
  comments, import paths, identifiers, types, object keys, className values and class-list strings, selectors, URLs,
  data-* and the other plumbing attributes. It is a scan, not a proof: a hit it should not have made goes in the
  allowlist with its reason, and a word it cannot see (a string built from pieces) is still the writer's to catch.

  THE ALLOWLIST is scripts/check-words.allow.json — [{ file, rule?, text?, reason }]: `file` a path, a folder ending in
  "/", or a pattern with *; `rule` the rule's id (omit for any); `text` a piece of the flagged string (omit for any).
  Every entry says why. An entry that no longer matches anything is reported, so the list stays true.

  It prints every hit as file:line:col [rule] "the words", then the count by file, and exits 1 if any hit is not on the
  allowlist. `--json` prints the hits as JSON instead.
*/
import ts from 'typescript';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const SRC = join(ROOT, 'src');
const ALLOW_FILE = join(ROOT, 'scripts', 'check-words.allow.json');
const asJson = process.argv.includes('--json');

/* ── the rules ── */
const RULES = [
  // the data is the market's
  ['simulated', /\bsimulated\b/i],
  ['demo', /\bdemos?\b/i],
  ['fake', /\bfakes?\b|\bfaked\b/i],
  ['preview', /\bpreviews?\b/i],
  ['pretend', /\bpretend(s|ed|ing)?\b/i],
  ['at-launch', /\bat launch\b/i],
  ['invented', /\binvented\b/i],
  ['sample', /\bsamples?\b/i],
  ['until-the-feed-lands', /\buntil the (\w+ )?feed lands\b/i],
  ['licensed-feed', /\blicensed feed\b/i],
  // no grades, no calls
  ['grade', /\bgrade[sd]?\b|\bgrading\b/i],
  ['score', /\bscor(e|es|ed|ing)\b/i],
  ['win-rate', /\bwin[- ]rate\b/i],
  ['signal', /\bsignals?\b/i],
  ['guaranteed', /\bguarantee[ds]?\b/i],
  ['confluence', /\bconfluence\b/i],
  ['market-intelligence', /\bmarket intelligence\b/i],
  // no trade instructions
  ['buy-the', /\bbuy the\b/i],
  ['sell-the', /\bsell the\b/i],
  ['sell-into', /\bsell into\b/i],
  ['scalp', /\bscalp(s|ing)?\b/i],
  ['take-profit', /\btake profits?\b/i],
  ['trade-the-break', /\btrade the break\b/i],
  ['dont-chase', /\bdon['’]?t chase\b|\bdo not chase\b/i],
  ['fade', /\bfade\b/i],
  ['should-struggle', /\bshould struggle\b/i],
  ['protective-floor', /\bprotective floor under our entry\b/i],
  ['you-should', /\byou should\b/i],
  ['enter-long', /\benter long\b/i],
  ['go-long', /\bgo long\b/i],
  ['go-short', /\bgo short\b/i],
];

/* ── what is plumbing, not words ── */
const SKIP_ATTRS = new Set(
  `className class id key ref style href to src srcSet type name role rel target method action d viewBox fill stroke
   transform xmlns points path as htmlFor form inputMode autoComplete lang dir tabIndex mode testId icon glyph ink tone
   kind variant size align side anchor ground theme value accept pattern clipPath mask filter fillRule clipRule
   strokeLinecap strokeLinejoin strokeDasharray gradientUnits gradientTransform preserveAspectRatio sizes loading
   decoding fetchPriority crossOrigin referrerPolicy download slot x y x1 x2 y1 y2 cx cy r rx ry width height offset
   stopColor textAnchor dominantBaseline fontFamily fontWeight vectorEffect shapeRendering marker markerEnd markerStart
   aria-hidden aria-controls aria-labelledby aria-describedby aria-current aria-live aria-haspopup aria-expanded
   aria-pressed aria-orientation aria-sort aria-autocomplete aria-keyshortcuts aria-owns aria-activedescendant
   aria-selected aria-checked aria-disabled aria-modal aria-atomic aria-relevant aria-busy aria-level aria-colindex
   aria-rowindex aria-setsize aria-posinset aria-valuemin aria-valuemax aria-valuenow`.split(/\s+/)
);
const skipAttr = n => SKIP_ATTRS.has(n) || n.startsWith('data-') || /(ClassName|Class|Cls|Ref|Id|Key|Style|Path|Href|Src)$/.test(n);
/* a key whose value is shown to the reader, even as one word */
const UI_KEYS = /^(label|title|text|words|word|line|lines|lead|desc|description|tip|tooltip|hint|placeholder|caption|heading|head|sub|subtitle|note|notes|blurb|summary|body|message|msg|why|read|verb|cta|aside|first|second|empty|emptyText|alt|ariaLabel|headerName|headerTooltip|q|a|answer|question|sentence|reason|detail|details|help|says|say|story|name)$/;
/* calls whose string arguments are code: selectors, storage keys, events, styles */
const CODE_CALLS = new Set([
  'querySelector', 'querySelectorAll', 'closest', 'matches', 'getElementById', 'getElementsByClassName', 'addEventListener',
  'removeEventListener', 'dispatchEvent', 'getItem', 'setItem', 'removeItem', 'getPropertyValue', 'setProperty',
  'removeProperty', 'getAttribute', 'setAttribute', 'removeAttribute', 'hasAttribute', 'toggleAttribute', 'add', 'remove',
  'toggle', 'contains', 'require', 'cn', 'clsx', 'cx', 'classNames', 'twMerge', 'readToken', 'resolveInk', 'matchMedia',
  'createElement', 'createElementNS', 'postMessage', 'fetch', 'debug', 'warn', 'error', 'log', 'info', 'mark', 'measure',
]);
const CLASS_VAR = /(cls|Cls|CLS|class|Class|CLASS)$|^(cls|class)/;

const CLASS_TOKEN = /^!?-?[a-z0-9@\[\]:/.%_#()&>*=,+'"-]+$/;
const looksLikeClasses = s => {
  const toks = s.trim().split(/\s+/).filter(Boolean);
  return toks.length > 0 && toks.every(t => CLASS_TOKEN.test(t)) && toks.some(t => /[-:\[\]/]/.test(t));
};
const looksLikeCode = s =>
  /^(https?:|mailto:|\/|\.\/|\.\.\/|#|\[|rgb|var\(|calc\(|cubic-bezier|url\()/.test(s.trim()) ||
  /^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/.test(s) ||
  looksLikeClasses(s);
const isProse = s => {
  const t = s.trim();
  if (!/[A-Za-z]{2}/.test(t) || looksLikeCode(t)) return false;
  if (/\s/.test(t)) return /[A-Za-z]{2,}[^\n]*\s+[^\n]*[A-Za-z]{2,}/.test(t) || /^[A-Z][a-z]/.test(t);
  return /^[A-Z][a-z]+[.!?:]?$/.test(t);
};

/* ── the walk ── */
const walk = dir =>
  readdirSync(dir).flatMap(f => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|ts)$/.test(f) && !/\.d\.ts$/.test(f) ? [p] : [];
  });

const hits = [];
const keyName = n => (n && (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isPrivateIdentifier(n)) ? n.text : n && ts.isComputedPropertyName(n) ? '' : '');
const calleeName = e => (ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : '');

function check(file, sf, node, raw, how) {
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return;
  for (const [rule, rx] of RULES) {
    if (rx.test(text)) {
      const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
      hits.push({ file, line: line + 1, col: character + 1, rule, text: text.length > 160 ? `${text.slice(0, 157)}…` : text, how });
    }
  }
}

for (const path of walk(SRC)) {
  const file = relative(ROOT, path).split('\\').join('/');
  const src = readFileSync(path, 'utf8');
  const sf = ts.createSourceFile(path, src, ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  const visit = node => {
    /* plumbing: whole subtrees skipped */
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isImportEqualsDeclaration(node)) return;
    if (ts.isTypeNode(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) return;
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(sf);
      if (skipAttr(name)) return;
      const init = node.initializer;
      if (init && ts.isStringLiteral(init)) {
        if (!looksLikeCode(init.text)) check(file, sf, init, init.text, 'attr');
        return;
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = calleeName(node.expression);
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword || CODE_CALLS.has(callee)) return;
    }
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && /^(CustomEvent|Event|RegExp|URL|Worker)$/.test(node.expression.text)) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && CLASS_VAR.test(node.name.text)) return;
    if (ts.isPropertyAssignment(node) && /^(className|class|cls|style)$|Class(Name)?$|Cls$/.test(keyName(node.name))) return;
    if (ts.isElementAccessExpression(node)) {
      visit(node.expression);
      return;
    }
    if (ts.isEnumMember(node)) return;

    /* words */
    if (ts.isJsxText(node)) {
      if (/[A-Za-z]/.test(node.text)) check(file, sf, node, node.text, 'jsx');
      return;
    }
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      const p = node.parent;
      /* a key, not a value */
      if ((ts.isPropertyAssignment(p) || ts.isPropertyDeclaration(p) || ts.isMethodDeclaration(p) || ts.isPropertySignature(p)) && p.name === node) return;
      if (ts.isLiteralTypeNode(p)) return;
      const text = ts.isTemplateExpression(node) ? node.head.text + node.templateSpans.map(s => ` {} ${s.literal.text}`).join('') : node.text;
      const inJsx = ts.isJsxExpression(p) || ts.isJsxAttribute(p);
      const uiKey = ts.isPropertyAssignment(p) && UI_KEYS.test(keyName(p.name));
      const shown = inJsx || uiKey ? /[A-Za-z]{2}/.test(text) && !looksLikeCode(text) : isProse(text);
      if (shown) check(file, sf, node, text, inJsx ? 'jsx-expr' : uiKey ? 'ui-key' : 'string');
      if (ts.isTemplateExpression(node)) node.templateSpans.forEach(s => visit(s.expression));
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

/* ── the allowlist ── */
const allow = existsSync(ALLOW_FILE) ? JSON.parse(readFileSync(ALLOW_FILE, 'utf8')) : [];
const fileMatch = (pat, f) =>
  pat.endsWith('/') ? f.startsWith(pat) : pat.includes('*') ? new RegExp(`^${pat.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '§').replace(/\*/g, '[^/]*').replace(/§/g, '.*')}$`).test(f) : pat === f;
const used = new Set();
const open = hits.filter(h => {
  const i = allow.findIndex(a => fileMatch(a.file, h.file) && (!a.rule || a.rule === h.rule) && (!a.text || h.text.toLowerCase().includes(a.text.toLowerCase())));
  if (i >= 0) used.add(i);
  return i < 0;
});
const stale = allow.filter((_, i) => !used.has(i));

if (asJson) {
  console.log(JSON.stringify({ hits: open, allowed: hits.length - open.length, stale }, null, 2));
} else {
  for (const h of open) console.log(`${h.file}:${h.line}:${h.col}  [${h.rule}]  "${h.text}"`);
  const byFile = new Map();
  for (const h of open) byFile.set(h.file, (byFile.get(h.file) ?? 0) + 1);
  if (open.length) {
    console.log(`\n${open.length} hit${open.length === 1 ? '' : 's'} in ${byFile.size} file${byFile.size === 1 ? '' : 's'} (${hits.length - open.length} allowed):`);
    for (const [f, n] of [...byFile].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) console.log(`  ${String(n).padStart(4)}  ${f}`);
  } else {
    console.log(`words:check — clean (${hits.length} allowed).`);
  }
  for (const s of stale) console.log(`allowlist entry matches nothing now: ${JSON.stringify(s)}`);
}
process.exit(open.length ? 1 : 0);
