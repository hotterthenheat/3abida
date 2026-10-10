/*
==================================================
  SLAYER TERMINAL - YOUR PICTURE
  (pages/settings/PictureDrop.tsx)

  The Account page's picture, as a place to DROP one
  (Noah, 2026-09-20, with a reference of an upload
  card: "can we take insipration from this on the 'add
  a picture' section… i like the look but i also like
  the look of our current layout of 'account'"). It was
  a row with one button, "Add a picture".

  WHAT IS TAKEN from the reference is its GRAMMAR:
    · a dashed zone that says what to do ("Drop your
      picture here"), one round button in its middle,
      one line of guidance under it;
    · the file you picked as a ROW of its own — what
      it is, how big, where it stands, a bar, an × ;
    · two buttons: Cancel, and the one that commits.
  WHAT STAYS OURS is the look: the Account page's row
  (the avatar and its words at the left, the control at
  the right), hairlines and tokens, mono captions, and
  the house's colours — SILVER for "armed" (a file over
  the zone) and for the commit, never the reference's
  blue; red only for a file we cannot use.

  NOTHING IS APPLIED UNTIL YOU SAY SO. Picking a file
  stages it: it is read and cropped square exactly as it
  will be kept (data/profile.ts readAvatar), and the row
  shows THAT crop, round, the way the terminal will draw
  it. "Use this picture" commits; Cancel, the ×, or
  picking another lets it go.

  THE TWO SIDES ARE THE SAME HEIGHT (Noah, the same
  day, on the first cut: "this now throws off the
  proportions of the left section"). The first zone was
  the reference's — a centred stack, 146px tall — beside
  a 56px avatar and two lines of words: a small thing
  floating in the corner of a tall one. So the zone lies
  DOWN (the button at its left, the words beside it,
  96px) and the picture stands UP: 64px (80 was "just a
  bit enlarged" — his word, the same hour), centred on the
  zone, and it is the PREVIEW — a staged crop shows there
  at once, tagged, before anything is kept.

  THE BAR IS REAL. It fills when the read-and-crop is
  done — today that is a moment; at launch the same
  promise is the upload, and the bar is its progress
  (`onProgress`). No wait is invented for it.
==================================================
*/

import { useRef, useState, type DragEvent as ReactDragEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Upload, X } from 'lucide-react';
import Avatar from '../../components/ui/Avatar';
import { AVATAR_PX, readAvatar, setProfile, useProfile } from '../../data/profile';

/** The zone's height, and so the height the picture at the left centres on — the two sides of the row are one height */
const ZONE_H = 96;

/** The largest file the zone takes — a phone's photo fits; a raw scan does not */
const MAX_BYTES = 12 * 1024 * 1024;

const sizeWords = (bytes: number): string => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const kindWords = (f: File): string => (f.type.split('/')[1] ?? f.name.split('.').pop() ?? 'file').replace('jpeg', 'jpg').toUpperCase();

interface Staged {
  name: string;
  kind: string;
  size: string;
  /** 0–1: the read-and-crop today, the upload at launch */
  progress: number;
  /** The crop, as it will be kept — absent until the read is done */
  crop: string | null;
  error: string | null;
}

const PictureDrop = () => {
  const p = useProfile();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [staged, setStaged] = useState<Staged | null>(null);
  const [over, setOver] = useState(false);
  /* a later pick wins: an earlier file still being read must not land on top of it */
  const pickId = useRef(0);

  const stage = async (f: File | undefined) => {
    if (!f) return;
    const id = ++pickId.current;
    const base = { name: f.name, kind: kindWords(f), size: sizeWords(f.size) };
    if (!f.type.startsWith('image/')) return setStaged({ ...base, progress: 0, crop: null, error: 'that file is not a picture' });
    if (f.size > MAX_BYTES) return setStaged({ ...base, progress: 0, crop: null, error: `over ${sizeWords(MAX_BYTES)} — pick a smaller one` });
    setStaged({ ...base, progress: 0.12, crop: null, error: null });
    try {
      const crop = await readAvatar(f);
      if (id === pickId.current) setStaged({ ...base, progress: 1, crop, error: null });
    } catch {
      if (id === pickId.current) setStaged({ ...base, progress: 0, crop: null, error: 'that file could not be read as a picture' });
    }
  };
  const letGo = () => {
    pickId.current++;
    setStaged(null);
  };
  const commit = () => {
    if (!staged?.crop) return;
    setProfile({ avatar: staged.crop });
    letGo();
  };

  const open = () => fileRef.current?.click();
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    open();
  };
  const onDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setOver(false);
    void stage(e.dataTransfer.files?.[0]);
  };

  const ready = !!staged?.crop;
  return (
    <div className="px-5 py-4 border-t border-borderSubtle/60 flex items-start justify-between gap-6 max-lg:flex-col max-lg:items-stretch max-lg:gap-4" data-settings-row="picture">
      {/* WHO — the picture as it stands, and what it is for: the Account page's own row */}
      <div className="min-w-0 flex items-center gap-5" style={{ minHeight: ZONE_H }} data-picture-who>
        {/* the picture as it stands — or, the moment one is staged, as it WOULD stand */}
        <Avatar profile={ready && staged?.crop ? { ...p, avatar: staged.crop } : p} size={64} className={ready ? 'ring-2 ring-silver/70 ring-offset-2 ring-offset-panel' : ''} />
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[12px] text-textPrimary">
            Your picture
            {ready && <span className="h-4 px-1.5 inline-flex items-center rounded bg-silverFill font-mono text-[11px] font-bold uppercase tracking-widest text-[#0a0a0a]" data-picture-preview>not saved</span>}
          </div>
          <div className="text-[11px] text-textMuted">Signs your posts on Community, beside your name</div>
          {p.avatar && !staged && (
            <button type="button" onClick={() => setProfile({ avatar: null })} className="mt-1.5 font-mono text-[11px] uppercase tracking-wider text-textSecondary hover:text-bear transition-colors" data-settings-door="avatar-remove">
              Remove it
            </button>
          )}
        </div>
      </div>

      {/* THE DROP — the zone, then the file you picked, then the two buttons */}
      <div className="w-[440px] max-w-full max-lg:w-full shrink-0 flex flex-col gap-2.5" data-picture-drop={staged ? (staged.error ? 'error' : ready ? 'ready' : 'reading') : 'rest'}>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            void stage(e.target.files?.[0]);
            e.target.value = '';
          }}
          data-settings-avatar-input
        />
        <div
          role="button"
          tabIndex={0}
          aria-label="Add a picture: drop a file here, or press to choose one"
          onClick={open}
          onKeyDown={onKey}
          onDragEnter={e => {
            e.preventDefault();
            setOver(true);
          }}
          onDragOver={e => e.preventDefault()}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          /* silver is "armed": a file is over the zone */
          style={{ minHeight: ZONE_H }}
          className={`group/drop relative rounded-lg border border-dashed px-5 py-3.5 flex items-center gap-4 text-left cursor-pointer select-none outline-none transition-colors duration-200 focus-visible:border-silver ${
            over ? 'border-silver bg-silver/[0.07]' : 'border-borderMuted hover:border-textSecondary bg-ink/[0.02]'
          }`}
          data-picture-zone={over ? 'over' : 'rest'}
        >
          {/* the one round button, on a soft halo — the reference's gesture in the house's silver */}
          <span className="relative shrink-0 flex items-center justify-center w-12 h-12" aria-hidden="true">
            <span className={`absolute inset-[-6px] rounded-full blur-md transition-opacity duration-300 bg-silver/20 ${over ? 'opacity-100' : 'opacity-50 group-hover/drop:opacity-90'}`} />
            <span className={`relative flex items-center justify-center w-11 h-11 rounded-full border bg-panel transition-colors duration-200 ${over ? 'border-silver text-silver' : 'border-borderMuted text-textSecondary group-hover/drop:text-textPrimary group-hover/drop:border-textSecondary'}`}>
              <Upload className="w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/drop:-translate-y-0.5 motion-reduce:transform-none" />
            </span>
          </span>
          <span className="min-w-0 flex flex-col gap-1">
            <span className="text-[12px] font-medium text-textPrimary">{over ? 'Let go to add it' : p.avatar ? 'Drop a new picture here' : 'Drop your picture here'}</span>
            <span className="text-[11px] leading-snug text-textMuted">
              or press to choose one · a square works best · JPG, PNG or WebP · cropped to the centre and kept at {AVATAR_PX}px
            </span>
          </span>
        </div>

        {staged && (
          <div className="rounded-lg border border-borderSubtle bg-ink/[0.02] px-3 pt-2.5 pb-3 animate-soft-in" data-picture-file>
            <div className="flex items-center gap-3">
              {/* the crop itself, round — what the terminal will draw */}
              {staged.crop ? (
                <img src={staged.crop} alt="" className="w-9 h-9 rounded-full object-cover border border-borderSubtle shrink-0" data-picture-crop />
              ) : (
                <span className={`w-9 h-9 rounded-full border shrink-0 ${staged.error ? 'border-bear/40 bg-bear/10' : 'border-borderSubtle bg-ink/[0.05]'}`} aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-textPrimary truncate" title={staged.name}>
                  {staged.name}
                </div>
                <div className="font-mono text-[11px] text-textMuted truncate">
                  {staged.kind} · {staged.size} ·{' '}
                  {staged.error ? <span className="text-bear">{staged.error}</span> : ready ? <span className="text-textSecondary">cropped · ready to use</span> : 'reading…'}
                </div>
              </div>
              <button type="button" onClick={letGo} aria-label="Let this file go" title="Let this file go" className="shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-full border border-borderSubtle text-textMuted hover:text-textPrimary hover:border-borderMuted transition-colors" data-picture-letgo>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {/* the bar: the read today, the upload at launch */}
            <div className="mt-2.5 h-[3px] rounded-full bg-ink/[0.08] overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(staged.progress * 100)}>
              <div className={`h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${staged.error ? 'bg-bear/70' : 'bg-silver'}`} style={{ width: `${Math.round((staged.error ? 1 : staged.progress) * 100)}%` }} data-picture-bar />
            </div>
          </div>
        )}

        {staged && (
          <div className="flex items-center gap-2" data-picture-actions>
            <button type="button" onClick={letGo} className="flex-1 h-8 rounded-md border border-borderSubtle font-mono text-[11px] uppercase tracking-wider text-textSecondary hover:text-textPrimary hover:border-borderMuted transition-colors" data-picture-cancel>
              Cancel
            </button>
            <button
              type="button"
              onClick={commit}
              disabled={!ready}
              className="flex-1 h-8 rounded-md bg-silverFill font-mono text-[11px] font-semibold uppercase tracking-wider text-[#0a0a0a] transition-opacity disabled:opacity-35 disabled:cursor-not-allowed hover:opacity-90"
              data-picture-use
            >
              Use this picture
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PictureDrop;
