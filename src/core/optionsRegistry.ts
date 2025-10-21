import { cloneDeep } from 'es-toolkit/clone-deep';
import type { Draft, OptionItem, OptionSource } from './types.js';

export class OptionsRegistry {
  private readonly map = new Map<string, OptionSource>();

  register(path: string, source: OptionSource): void {
    this.map.set(path, { ...source, key: cloneDeep(source.key) });
  }

  remove(path: string): void {
    this.map.delete(path);
  }

  get(path: string): OptionSource | undefined {
    const entry = this.map.get(path);
    if (!entry) {
      return undefined;
    }
    return { ...entry, key: cloneDeep(entry.key) };
  }

  resolveEnabled(path: string, draft: Draft): boolean {
    const entry = this.map.get(path);
    if (!entry) {
      return false;
    }
    const { enabled } = entry;
    if (enabled === undefined) {
      return true;
    }
    return typeof enabled === 'function' ? Boolean((enabled as (draft: Draft) => boolean)(draft)) : Boolean(enabled);
  }

  list(): Array<{ path: string; source: OptionSource }> {
    return Array.from(this.map.entries()).map(([path, source]) => ({ path, source }));
  }

  update(path: string, updater: (source: OptionSource) => OptionSource): void {
    const current = this.map.get(path);
    if (!current) {
      return;
    }
    this.map.set(path, updater(current));
  }

  setStatic(path: string, options: OptionItem[]): void {
    this.map.set(path, {
      key: ['filter-options', path],
      fetcher: async () => options,
      enabled: true,
      staleTime: Infinity,
      placeholderData: cloneDeep(options),
    });
  }
}
