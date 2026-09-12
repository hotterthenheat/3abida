/*
==================================================
  SLAYER TERMINAL - WHERE SCRIPTS ARE KEPT (data/scriptStore.ts)

  The browser's driver for the ScriptStore door
  (types/scripts.ts): a user's scripts, their
  versions, favourites and what sits on each pane,
  saved on THEIR OWN COMPUTER in IndexedDB — the
  same idea as the watchlist and the board's names,
  with room for whole files. No server, no account.
  When the server exists, its driver answers the
  same questions and this one becomes the cache.

  The built-ins never touch the database: they are
  source in the repo (data/builtinScripts.ts) and
  read-only; a copy of one is a script of yours.

  A private window, or a browser with site data
  blocked, gets a memory driver that lives for the
  page — the editor works, nothing survives a reload.
==================================================
*/

import { compile, explain } from '../core/pine';
import type { ChartScript, PaneId, Script, ScriptFavourite, ScriptInputValue, ScriptSave, ScriptShelf, ScriptStore, ScriptVersion, ScriptVisibility } from '../types/scripts';
import { SCRIPT_CAPS } from '../types/scripts';
import { builtinScripts, hashSource } from './builtinScripts';

const DB = 'slayer_scripts';
const DB_VERSION = 1;

const uid = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/* ---- a small promise face over IndexedDB ------------------------------------------ */

type StoreName = 'scripts' | 'versions' | 'favourites' | 'chartScripts';

class Db {
  private opening: Promise<IDBDatabase | null> | null = null;
  /** The memory fallback — used when IndexedDB is missing or refuses to open */
  private memory: Record<StoreName, Map<string, unknown>> | null = null;

  private open(): Promise<IDBDatabase | null> {
    if (this.opening) return this.opening;
    this.opening = new Promise(resolve => {
      try {
        if (typeof indexedDB === 'undefined') return resolve(null);
        const req = indexedDB.open(DB, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('scripts')) db.createObjectStore('scripts', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('versions')) db.createObjectStore('versions', { keyPath: 'key' });
          if (!db.objectStoreNames.contains('favourites')) db.createObjectStore('favourites', { keyPath: 'scriptId' });
          if (!db.objectStoreNames.contains('chartScripts')) {
            const cs = db.createObjectStore('chartScripts', { keyPath: 'id' });
            cs.createIndex('paneId', 'paneId', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    return this.opening;
  }

  private mem(): Record<StoreName, Map<string, unknown>> {
    if (!this.memory) this.memory = { scripts: new Map(), versions: new Map(), favourites: new Map(), chartScripts: new Map() };
    return this.memory;
  }

  private keyOf(store: StoreName, row: Record<string, unknown>): string {
    return String(store === 'versions' ? row.key : store === 'favourites' ? row.scriptId : row.id);
  }

  async all<T>(store: StoreName): Promise<T[]> {
    const db = await this.open();
    if (!db) return [...this.mem()[store].values()] as T[];
    return new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  }

  async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const db = await this.open();
    if (!db) return this.mem()[store].get(key) as T | undefined;
    return new Promise((resolve, reject) => {
      const req = db.transaction(store, 'readonly').objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  async put(store: StoreName, row: Record<string, unknown>): Promise<void> {
    const db = await this.open();
    if (!db) {
      this.mem()[store].set(this.keyOf(store, row), row);
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async del(store: StoreName, key: string): Promise<void> {
    const db = await this.open();
    if (!db) {
      this.mem()[store].delete(key);
      return;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      tx.objectStore(store).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

/* ---- the driver ---------------------------------------------------------------------- */

const byUpdated = (a: Script, b: Script) => b.updatedAt - a.updatedAt;

class BrowserScriptStore implements ScriptStore {
  private db = new Db();

  private async mine(): Promise<Script[]> {
    const rows = await this.db.all<Script>('scripts');
    return rows.filter(s => !s.deletedAt).sort(byUpdated);
  }

  async list(shelf?: ScriptShelf): Promise<Script[]> {
    if (shelf === 'built-in') return builtinScripts();
    if (shelf === 'community') return [];
    if (shelf === 'mine') return this.mine();
    return [...(await this.mine()), ...builtinScripts()];
  }

  async get(id: string): Promise<Script | null> {
    const b = builtinScripts().find(s => s.id === id);
    if (b) return b;
    const s = await this.db.get<Script>('scripts', id);
    return s && !s.deletedAt ? s : null;
  }

  async save(input: ScriptSave): Promise<Script> {
    if (input.source.length > SCRIPT_CAPS.sourceBytes) throw new Error(`A script may run to ${Math.round(SCRIPT_CAPS.sourceBytes / 1000)} KB — this one is ${Math.round(input.source.length / 1000)} KB`);
    const existing = input.id ? await this.get(input.id) : null;
    if (input.id && !existing) throw new Error('That script is gone — save it as a new one');
    if (existing?.readOnly) throw new Error('A built-in cannot be edited in place — Make a copy first');
    const now = Date.now();
    let meta: Script['meta'] = null;
    let status: Script['status'] = 'ok';
    let error: Script['error'];
    try {
      const c = compile(input.source);
      meta = c.meta;
      if (meta.plots.length > SCRIPT_CAPS.plots) throw new Error(`A script may draw ${SCRIPT_CAPS.plots} plots — this one draws ${meta.plots.length}`);
      if (meta.inputs.length > SCRIPT_CAPS.inputs) throw new Error(`A script may declare ${SCRIPT_CAPS.inputs} inputs — this one declares ${meta.inputs.length}`);
      if (meta.alerts.length > SCRIPT_CAPS.alerts) throw new Error(`A script may carry ${SCRIPT_CAPS.alerts} alert conditions — this one carries ${meta.alerts.length}`);
    } catch (e) {
      const { line, message } = explain(e);
      status = 'error';
      error = { line, message };
    }
    const title = input.title.trim() || meta?.title || existing?.title || 'Untitled script';
    const version = existing ? existing.version + 1 : 1;
    const script: Script = {
      id: existing?.id ?? uid(),
      ownerId: 'me',
      shelf: 'mine',
      title,
      description: input.description ?? existing?.description ?? '',
      tags: input.tags ?? existing?.tags ?? [],
      visibility: existing?.visibility ?? 'private',
      source: input.source,
      sourceHash: hashSource(input.source),
      meta,
      status,
      ...(error ? { error } : {}),
      ...(existing?.forkedFrom ? { forkedFrom: existing.forkedFrom } : {}),
      version,
      readOnly: false,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      ...(existing?.publishedAt ? { publishedAt: existing.publishedAt } : {}),
    };
    await this.db.put('scripts', script as unknown as Record<string, unknown>);
    const v: ScriptVersion & { key: string } = { key: `${script.id}:${version}`, scriptId: script.id, version, source: input.source, createdAt: now, ...(input.message ? { message: input.message } : {}) };
    await this.db.put('versions', v as unknown as Record<string, unknown>);
    /* the cap on kept versions: the oldest fall off */
    if (version > SCRIPT_CAPS.versions) await this.db.del('versions', `${script.id}:${version - SCRIPT_CAPS.versions}`);
    return script;
  }

  async fork(id: string, title?: string): Promise<Script> {
    const src = await this.get(id);
    if (!src) throw new Error('That script is gone');
    const copy = await this.save({ title: title ?? `${src.title} (copy)`, source: src.source, description: src.description, tags: src.tags });
    copy.forkedFrom = src.id;
    await this.db.put('scripts', copy as unknown as Record<string, unknown>);
    return copy;
  }

  async remove(id: string): Promise<void> {
    const s = await this.db.get<Script>('scripts', id);
    if (!s) return;
    if (s.readOnly) throw new Error('A built-in stays');
    await this.db.put('scripts', { ...s, deletedAt: Date.now() });
    const placed = (await this.db.all<ChartScript>('chartScripts')).filter(c => c.scriptId === id);
    for (const c of placed) await this.db.del('chartScripts', c.id);
  }

  async versions(id: string): Promise<ScriptVersion[]> {
    const rows = await this.db.all<ScriptVersion & { key: string }>('versions');
    return rows.filter(v => v.scriptId === id).sort((a, b) => b.version - a.version);
  }

  async restore(id: string, version: number): Promise<Script> {
    const v = await this.db.get<ScriptVersion>('versions', `${id}:${version}`);
    if (!v) throw new Error(`Version ${version} is not kept`);
    const s = await this.get(id);
    return this.save({ id, title: s?.title ?? 'Untitled script', source: v.source, message: `Restored version ${version}` });
  }

  async setVisibility(id: string, visibility: ScriptVisibility): Promise<Script> {
    const s = await this.db.get<Script>('scripts', id);
    if (!s) throw new Error('That script is gone');
    const next = { ...s, visibility, updatedAt: Date.now(), ...(visibility !== 'private' && !s.publishedAt ? { publishedAt: Date.now() } : {}) };
    await this.db.put('scripts', next);
    return next;
  }

  async favourites(): Promise<ScriptFavourite[]> {
    return this.db.all<ScriptFavourite>('favourites');
  }

  async toggleFavourite(id: string): Promise<boolean> {
    const have = await this.db.get<ScriptFavourite>('favourites', id);
    if (have) {
      await this.db.del('favourites', id);
      return false;
    }
    await this.db.put('favourites', { scriptId: id, at: Date.now() });
    return true;
  }

  async onPane(paneId: PaneId): Promise<ChartScript[]> {
    const rows = await this.db.all<ChartScript>('chartScripts');
    return rows.filter(c => c.paneId === paneId).sort((a, b) => a.order - b.order);
  }

  async place(paneId: PaneId, scriptId: string, inputs?: Record<string, ScriptInputValue>): Promise<ChartScript> {
    const on = await this.onPane(paneId);
    const cs: ChartScript = { id: uid(), paneId, scriptId, version: 'latest', inputs: inputs ?? {}, visible: true, order: on.length ? Math.max(...on.map(c => c.order)) + 1 : 0 };
    await this.db.put('chartScripts', cs as unknown as Record<string, unknown>);
    return cs;
  }

  async update(chartScript: ChartScript): Promise<ChartScript> {
    await this.db.put('chartScripts', chartScript as unknown as Record<string, unknown>);
    return chartScript;
  }

  async lift(chartScriptId: string): Promise<void> {
    await this.db.del('chartScripts', chartScriptId);
  }
}

/** The one store the terminal reads and writes */
export const scriptStore: ScriptStore = new BrowserScriptStore();
