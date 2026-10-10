/*
==================================================
  SLAYER TERMINAL - THE GLOSSARY (pages/glossary/Glossary.tsx)

  Every word the terminal defines, on one page (the
  ideas report, 2026-10-10): its one line and what it
  stands on — observed, calculated or modeled, and
  for a modeled word what the model assumes. Read off
  data/glossary.ts, which reads the Term cards'
  dictionary and the rooms' own words, so a word says
  here what it says where it is used.

  Reached from the command line ("glossary", GLOS),
  the `?` sheet and the head of every "How to read"
  guide. The search rides the address (?q=), a word
  has its own anchor (/glossary#call-wall), and `/`
  puts the keys in the search.
==================================================
*/

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { BookOpen, Search, X } from 'lucide-react';
import FilterTabs from '../../components/ui/FilterTabs';
import { DEALERS_SIDE, GLOSSARY, WORD_GROUPS, searchGlossary, type GlossaryEntry, type WordKind } from '../../data/glossary';

type KindPick = 'all' | WordKind;
const KIND_TABS: { value: KindPick; label: string }[] = [
  { value: 'all', label: 'Every word' },
  { value: 'Observed', label: 'Observed' },
  { value: 'Calculated', label: 'Calculated' },
  { value: 'Modeled', label: 'Modeled' },
];
const KIND_LINE: Record<WordKind, string> = {
  Observed: 'Read off the feed as it prints.',
  Calculated: 'Arithmetic on what was observed.',
  Modeled: 'From a model — and the model’s assumption is named.',
};
const STANDS_ON: Record<WordKind, string> = { Observed: 'Stands on', Calculated: 'Stands on', Modeled: 'Assumes' };

const count = (k: WordKind) => GLOSSARY.filter(e => e.kind === k).length;

/** `grouped`: the group's head has said the dealers' side once, so a word on it says only what it adds */
const Word = ({ e, lit, grouped }: { e: GlossaryEntry; lit: boolean; grouped: boolean }) => (
  <div
    id={e.slug}
    className={`scroll-mt-24 grid gap-x-6 gap-y-1 py-3 border-t border-borderSubtle/60 md:grid-cols-[minmax(0,13rem)_minmax(0,1fr)] ${lit ? 'bg-ink/[0.04] -mx-2 px-2 rounded-md' : ''}`}
    data-glossary-word={e.slug}
  >
    <dt className="min-w-0">
      <a href={`#${e.slug}`} className="text-[13px] font-semibold text-textPrimary hover:underline decoration-borderMuted underline-offset-4">
        {e.term}
      </a>
      <span className="block mt-0.5 text-[11px] text-textMuted" data-glossary-kind={e.kind}>
        {e.kind}
      </span>
    </dt>
    <dd className="min-w-0">
      <p className="text-[13px] leading-relaxed text-textSecondary">{e.meaning}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-textMuted">
        <span className="text-textSecondary">{STANDS_ON[e.kind]}:</span> {grouped && e.dealers ? `the dealers’ side, as above.${e.more ? ` ${e.more}` : ''}` : e.assumes}
      </p>
    </dd>
  </div>
);

const GlossaryPage = () => {
  const [params, setParams] = useSearchParams();
  const { hash } = useLocation();
  const query = params.get('q') ?? '';
  const kindParam = params.get('kind');
  const kind: KindPick = KIND_TABS.some(t => t.value === kindParam) ? (kindParam as KindPick) : 'all';
  /* the field keeps what is typed (a trailing space too); the address keeps it trimmed */
  const [draft, setDraft] = useState(query);

  /* the search and the kind ride the address, written with replace — only what differs from the default */
  const write = (q: string, k: KindPick) => {
    const next = new URLSearchParams();
    if (q.trim()) next.set('q', q.trim());
    if (k !== 'all') next.set('kind', k);
    setParams(next, { replace: true });
  };

  const found = useMemo(() => searchGlossary(draft, kind === 'all' ? null : kind), [draft, kind]);
  const byGroup = WORD_GROUPS.map(g => ({ group: g, words: found.filter(e => e.group === g) })).filter(g => g.words.length > 0);
  /* searching, the words keep the search's order (the name first, then a line that holds it) — grouped only at rest */
  const searching = draft.trim().length > 0;

  /* a word's own anchor: brought into view and lit once the page stands */
  const lit = hash ? decodeURIComponent(hash.slice(1)) : '';
  const placed = useRef('');
  useEffect(() => {
    if (!lit || placed.current === lit) return;
    const el = document.getElementById(lit);
    if (!el) return;
    placed.current = lit;
    el.scrollIntoView({ block: 'start' });
  }, [lit, found]);

  return (
    <div className="w-full max-w-[1100px] flex flex-col gap-4" data-glossary-page>
      <header className="shrink-0 flex items-start gap-x-6 gap-y-2 flex-wrap pb-3 border-b border-borderSubtle" data-shell>
        <div className="min-w-0 flex-1">
          <div className="h-6 flex items-center gap-2.5">
            <BookOpen className="w-[18px] h-[18px] text-textSecondary shrink-0" strokeWidth={1.75} aria-hidden />
            <h1 className="text-[15px] font-semibold leading-tight text-textPrimary">Glossary</h1>
          </div>
          <p className="mt-0.5 text-[11px] text-textMuted">Every word the terminal uses — what it means, and what it stands on.</p>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2" data-shell-facts>
          {(
            [
              ['Words', GLOSSARY.length],
              ['Observed', count('Observed')],
              ['Calculated', count('Calculated')],
              ['Modeled', count('Modeled')],
            ] as const
          ).map(([label, n]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[10px] text-textMuted whitespace-nowrap">{label}</dt>
              <dd className="mt-0.5 font-mono text-[12px] tnum text-textPrimary">{n}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="flex-1 min-w-0 flex items-center gap-2 h-9 px-3 rounded-md border border-borderSubtle bg-chip focus-within:border-borderMuted">
          <Search className="w-3.5 h-3.5 text-textMuted shrink-0" aria-hidden />
          <input
            type="search"
            value={draft}
            onChange={e => {
              setDraft(e.target.value);
              write(e.target.value, kind);
            }}
            placeholder="Search a word, or a word in its line — wall, open interest, assumes"
            aria-label="Search the glossary"
            spellCheck={false}
            data-page-search
            data-glossary-search
            className="flex-1 min-w-0 bg-transparent text-[13px] text-textPrimary placeholder:text-textMuted outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {draft && (
            <button type="button" onClick={() => (setDraft(''), write('', kind))} aria-label="Clear the search" className="hit shrink-0 p-0.5 rounded text-textMuted hover:text-textPrimary">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </label>
        <div className="shrink-0 overflow-x-auto">
          <FilterTabs options={KIND_TABS} value={kind} onChange={k => write(draft, k)} ariaLabel="What a word stands on" />
        </div>
      </div>

      {kind !== 'all' && <p className="text-[12px] text-textMuted" data-glossary-kind-line>{KIND_LINE[kind]}</p>}

      <p className="sr-only" role="status" aria-live="polite">
        {found.length === 0 ? 'No word found' : `${found.length} word${found.length === 1 ? '' : 's'}`}
      </p>

      {found.length === 0 ? (
        <div className="rounded-md border border-dashed border-borderSubtle/70 px-4 py-8 text-center" data-glossary-empty>
          <p className="text-[13px] text-textSecondary">No word here holds “{draft.trim()}”.</p>
          <p className="mt-1 text-[12px] text-textMuted">A word’s line is searched too — a shorter search finds more.</p>
        </div>
      ) : searching ? (
        <dl data-glossary-list="search">
          {found.map(e => (
            <Word key={e.slug} e={e} lit={e.slug === lit} grouped={false} />
          ))}
        </dl>
      ) : (
        <div className="grid gap-8 xl:grid-cols-[11rem_minmax(0,1fr)]">
          {/* the groups, a door each — beside the list from xl up */}
          <nav aria-label="The glossary's groups" className="max-xl:hidden">
            <ul className="sticky top-4 flex flex-col gap-0.5">
              {byGroup.map(g => (
                <li key={g.group}>
                  <a href={`#group-${g.group.toLowerCase().replace(/\s+/g, '-')}`} className="flex items-baseline justify-between gap-2 h-7 px-2 -mx-2 rounded-md text-[12px] text-textSecondary hover:text-textPrimary hover:bg-ink/[0.04]">
                    {g.group}
                    <span className="font-mono text-[10px] tnum text-textMuted">{g.words.length}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-col gap-8 min-w-0">
            {byGroup.map(g => (
              <section key={g.group} id={`group-${g.group.toLowerCase().replace(/\s+/g, '-')}`} className="scroll-mt-24" data-glossary-group={g.group}>
                <h2 className="pb-2 text-[13px] font-semibold text-textPrimary">
                  {g.group} <span className="font-mono text-[10px] font-normal tnum text-textMuted">{g.words.length}</span>
                </h2>
                {g.words.some(e => e.dealers) && (
                  <p className="pb-3 max-w-[72ch] text-[12px] leading-relaxed text-textMuted" data-glossary-dealers>
                    <span className="text-textSecondary">Every dealer word here assumes:</span> {DEALERS_SIDE}
                  </p>
                )}
                <dl>
                  {g.words.map(e => (
                    <Word key={e.slug} e={e} lit={e.slug === lit} grouped />
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GlossaryPage;
