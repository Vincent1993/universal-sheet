import type { FilterApi, InstanceRegistry } from './types.js';

class MemoryRegistry<TDraft> implements InstanceRegistry<TDraft> {
  #defaultInstance?: FilterApi<TDraft>;
  readonly #instances = new Map<string, FilterApi<TDraft>>();

  setDefault(instance: FilterApi<TDraft>): void {
    this.#defaultInstance = instance;
  }

  getDefault(): FilterApi<TDraft> | undefined {
    return this.#defaultInstance;
  }

  set(namespace: string, instance: FilterApi<TDraft>): void {
    this.#instances.set(namespace, instance);
  }

  get(namespace: string): FilterApi<TDraft> | undefined {
    return this.#instances.get(namespace);
  }

  delete(namespace: string): void {
    this.#instances.delete(namespace);
  }

  keys(): string[] {
    return Array.from(this.#instances.keys());
  }
}

export function createInstanceRegistry<TDraft>(): InstanceRegistry<TDraft> {
  return new MemoryRegistry<TDraft>();
}

export interface RegistryEntry<TDraft> {
  namespace?: string;
  instance: FilterApi<TDraft>;
  makeDefault?: boolean;
}

export function registerInstances<TDraft>(
  registry: InstanceRegistry<TDraft>,
  entries: RegistryEntry<TDraft>[]
): void {
    for (const entry of entries) {
      if (entry.namespace) {
        registry.set(entry.namespace, entry.instance);
      }
      if (entry.makeDefault || (!entry.namespace && !registry.getDefault())) {
        registry.setDefault(entry.instance);
      }
    }
}
