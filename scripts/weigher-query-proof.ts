/*
  Acceptance test for the Weigher's contract line. The parser is order-free,
  binds only what a token names, resolves dates through the ENGINE clock
  (pinned here — a replay must parse identically), and never swallows a token
  it didn't understand.

  Run: npx tsx scripts/weigher-query-proof.ts
*/
import { withEngineClock } from '../src/core/clock';
import { parseWeighQuery, nearestListed } from '../src/components/compass/weighQuery';

let pass = 0,
  fail = 0;
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`);
  ok ? pass++ : fail++;
};

const PIN = new Date(2026, 7, 4); // Tue Aug 4 2026

withEngineClock(PIN, () => {
  const full = parseWeighQuery('HD 363C 08/07/26');
  check('full line binds every slot', full.ticker === 'HD' && full.strike === 363 && full.right === 'C' && full.dte === 3, JSON.stringify(full));

  const glued = parseWeighQuery('550p 3d');
  check('glued strike+right and dte suffix', glued.strike === 550 && glued.right === 'P' && glued.dte === 3 && glued.ticker === null);

  const orderFree = parseWeighQuery('put 550 tsla 08/14');
  check('order-free: same bindings any order', orderFree.ticker === 'TSLA' && orderFree.strike === 550 && orderFree.right === 'P' && orderFree.dte === 10);

  const partial = parseWeighQuery('425');
  check('a bare number binds ONLY the strike', partial.strike === 425 && partial.ticker === null && partial.right === null && partial.dte === null);

  const pastDate = parseWeighQuery('01/15');
  check('bare MM/DD in the past rolls to NEXT year', pastDate.dte !== null && pastDate.dte > 150, `dte ${pastDate.dte}`);

  const cAlone = parseWeighQuery('c');
  check('bare C is a RIGHT, not Citigroup', cAlone.right === 'C' && cAlone.ticker === null);

  const junk = parseWeighQuery('SPY 500c asap!!');
  check('unclaimed tokens surface as leftovers', junk.leftovers.length === 1 && junk.leftovers[0] === 'ASAP!!' && junk.strike === 500);

  const dupes = parseWeighQuery('500 510 call put');
  check('first token wins each slot, extras leave', dupes.strike === 500 && dupes.right === 'C');
});

// Date parsing follows the PIN, not the wall — same line, different pinned day
const fromFriday = withEngineClock(new Date(2026, 7, 7), () => parseWeighQuery('08/14'));
check('same date token, different pin, different dte', fromFriday.dte === 7, `dte ${fromFriday.dte}`);

check('typed strike snaps to nearest listed', nearestListed(363.4, [360, 362.5, 365]) === 362.5);
check('empty grid snaps to nothing', nearestListed(100, []) === null);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
