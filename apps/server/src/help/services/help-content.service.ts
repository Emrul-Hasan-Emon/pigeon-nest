import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

type Json = Record<string, unknown>;

export interface HelpTopicView {
  slug: string;
  title: string;
  icon: string;
  order: number;
  summary: string;
  openPath: string;
  openLabel: string;
  sections: Json[];
}

interface Cached {
  mtimeMs: number;
  topic: HelpTopicView | null;
}

const BLOCK_TYPES = ['steps', 'words', 'points', 'faq', 'note'];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Help topics for a portal, read from JSON files in `content/<audience>/` (one file per topic). Nothing is kept in
 * the database. Add a file and it appears in the Help menu; edit a file and the next request shows the change (files
 * are re-read when their modified time changes, so there is no restart and no deploy of code).
 *
 * The reader is forgiving on purpose, so a small mistake while writing never takes Help down: a file that is not
 * valid JSON, or has no slug, title or sections, is skipped with a warning in the log; a block with an unknown
 * type is dropped; fields it does not know are passed through untouched. A missing icon, order or summary gets a
 * default. Two files with the same slug: the first file (by name) wins.
 */
@Injectable()
export class HelpContentService {
  private readonly log = new Logger(HelpContentService.name);
  private readonly cache = new Map<string, Cached>();
  private warned = new Set<string>();

  /** The folder with the topic files. HELP_CONTENT_DIR overrides it; otherwise apps/server/content. */
  private root(): string {
    const candidates = [
      process.env.HELP_CONTENT_DIR,
      join(process.cwd(), 'content'),
      join(__dirname, '..', '..', '..', 'content'),
      join(__dirname, '..', '..', '..', '..', 'content'),
    ].filter((p): p is string => Boolean(p));
    const found = candidates.find((p) => existsSync(p));
    return found ?? candidates[0];
  }

  list(audience: string): Omit<HelpTopicView, 'sections'>[] {
    return this.load(audience).map((t) => ({
      slug: t.slug,
      title: t.title,
      icon: t.icon,
      order: t.order,
      summary: t.summary,
      openPath: t.openPath,
      openLabel: t.openLabel,
    }));
  }

  get(audience: string, slug: string): HelpTopicView {
    const topic = this.load(audience).find((t) => t.slug === slug);
    if (!topic) throw new NotFoundException('Help topic not found');
    return topic;
  }

  private load(audience: string): HelpTopicView[] {
    const dir = join(this.root(), audience);
    if (!existsSync(dir)) return [];
    const topics: HelpTopicView[] = [];
    const seen = new Set<string>();
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
      const file = join(dir, name);
      const topic = this.read(file, name);
      if (!topic) continue;
      if (seen.has(topic.slug)) {
        this.warnOnce(file, `${name}: slug "${topic.slug}" is already used by another file, skipped`);
        continue;
      }
      seen.add(topic.slug);
      topics.push(topic);
    }
    return topics.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  }

  private read(file: string, name: string): HelpTopicView | null {
    let mtimeMs: number;
    try {
      mtimeMs = statSync(file).mtimeMs;
    } catch {
      return null;
    }
    const hit = this.cache.get(file);
    if (hit && hit.mtimeMs === mtimeMs) return hit.topic;
    const topic = this.parse(file, name);
    this.cache.set(file, { mtimeMs, topic });
    if (topic) this.warned.delete(file);
    return topic;
  }

  private parse(file: string, name: string): HelpTopicView | null {
    let raw: Json;
    try {
      raw = JSON.parse(readFileSync(file, 'utf8')) as Json;
    } catch (e) {
      this.warnOnce(file, `${name}: not valid JSON (${(e as Error).message}), skipped`);
      return null;
    }
    const slug = typeof raw.slug === 'string' ? raw.slug.trim() : '';
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    if (!SLUG.test(slug) || !title || !Array.isArray(raw.sections)) {
      this.warnOnce(file, `${name}: needs a slug (a-z, 0-9, dashes), a title and a sections list, skipped`);
      return null;
    }
    const sections = (raw.sections as unknown[])
      .map((s, i) => this.section(s, i, name, file))
      .filter((s): s is Json => s !== null);
    const str = (v: unknown, d: string) => (typeof v === 'string' && v.trim() ? v : d);
    return {
      slug,
      title,
      icon: str(raw.icon, 'circle-help'),
      order: typeof raw.order === 'number' && Number.isFinite(raw.order) ? raw.order : 1000,
      summary: str(raw.summary, ''),
      openPath: str(raw.openPath, ''),
      openLabel: str(raw.openLabel, 'Open'),
      sections,
    };
  }

  private section(s: unknown, i: number, name: string, file: string): Json | null {
    if (!s || typeof s !== 'object') return null;
    const sec = s as Json;
    const title = typeof sec.title === 'string' ? sec.title : '';
    if (!title) {
      this.warnOnce(file, `${name}: section ${i + 1} has no title, skipped`);
      return null;
    }
    const id = typeof sec.id === 'string' && sec.id ? sec.id : `section-${i + 1}`;
    const blocks = (Array.isArray(sec.blocks) ? sec.blocks : []).filter((b) => {
      const ok = b && typeof b === 'object' && BLOCK_TYPES.includes((b as Json).type as string);
      if (!ok) this.warnOnce(file, `${name}: a block in "${title}" has an unknown type, dropped`);
      return ok;
    });
    return { ...sec, id, title, blocks };
  }

  private warnOnce(file: string, message: string) {
    const key = `${file}:${message}`;
    if (this.warned.has(key)) return;
    this.warned.add(key);
    this.log.warn(message);
  }
}
