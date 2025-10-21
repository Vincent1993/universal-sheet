import { cloneDeep } from 'es-toolkit/clone-deep';
import type { FilterApi } from '../core/types.js';

export interface MemoryAdapterSnapshot<TDraft> {
  draft: TDraft;
  applied: any;
}

export interface MemoryAdapterApi<TDraft> {
  readonly filter: FilterApi<TDraft>;
  getSnapshot(): MemoryAdapterSnapshot<TDraft>;
  setValue(path: string, value: any): void;
  subscribe(listener: (snapshot: MemoryAdapterSnapshot<TDraft>) => void): () => void;
  dispose(): void;
}

export function createMemoryAdapter<TDraft>(filter: FilterApi<TDraft>): MemoryAdapterApi<TDraft> {
  let snapshot: MemoryAdapterSnapshot<TDraft> = {
    draft: cloneDeep(filter.draft),
    applied: cloneDeep(filter.applied)
  };

  const listeners = new Set<(state: MemoryAdapterSnapshot<TDraft>) => void>();
  const unsubscribe = filter.subscribe((state) => {
    snapshot = {
      draft: cloneDeep(state.draft),
      applied: cloneDeep(state.applied)
    };
    for (const listener of Array.from(listeners)) {
      listener(snapshot);
    }
  });

  return {
    filter,
    getSnapshot: () => snapshot,
    setValue(path, value) {
      filter.getField(path).setValue(value);
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      listeners.clear();
      unsubscribe();
    }
  };
}
