import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { cloneDeep } from 'es-toolkit/clone-deep';
import type {
  Draft,
  FilterPreset,
  PresetPluginOptions,
  PresetPluginState,
  PresetStorage,
  UseFilterPresetsOptions,
  UseFilterPresetsResult,
} from '../core/types.js';
import type { Plugin } from '../core/types.js';
import { useFilter } from '../core/FilterProvider.js';
import { ERROR_CODES, FilterError } from '../core/errors.js';

const DEFAULT_PRESET_KEY = Symbol('preset-plugin');

class NamespacedMemoryPresetStorage<TDraft extends Draft> implements PresetStorage<TDraft> {
  private readonly namespaces = new Map<string, Map<string, FilterPreset<TDraft>>>();
  private readonly listeners = new Map<string, Set<() => void>>();

  list(namespace: string): FilterPreset<TDraft>[] {
    const map = this.ensureNamespace(namespace);
    return Array.from(map.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((preset) => cloneDeep(preset));
  }

  get(namespace: string, id: string): FilterPreset<TDraft> | undefined {
    const map = this.ensureNamespace(namespace);
    const preset = map.get(id);
    return preset ? cloneDeep(preset) : undefined;
  }

  save(namespace: string, preset: FilterPreset<TDraft>): void {
    const map = this.ensureNamespace(namespace);
    map.set(preset.id, cloneDeep(preset));
    this.notify(namespace);
  }

  remove(namespace: string, id: string): void {
    const map = this.ensureNamespace(namespace);
    if (map.delete(id)) {
      this.notify(namespace);
    }
  }

  subscribe(namespace: string, listener: () => void): () => void {
    const set = this.ensureListeners(namespace);
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  private ensureNamespace(namespace: string) {
    let bucket = this.namespaces.get(namespace);
    if (!bucket) {
      bucket = new Map();
      this.namespaces.set(namespace, bucket);
    }
    return bucket;
  }

  private ensureListeners(namespace: string) {
    let set = this.listeners.get(namespace);
    if (!set) {
      set = new Set();
      this.listeners.set(namespace, set);
    }
    return set;
  }

  private notify(namespace: string) {
    const listeners = this.listeners.get(namespace);
    if (!listeners) return;
    for (const listener of listeners) {
      listener();
    }
  }
}

const globalPresetStorage = new NamespacedMemoryPresetStorage<any>();

export function createMemoryPresetStorage<TDraft extends Draft>(): PresetStorage<TDraft> {
  return new NamespacedMemoryPresetStorage<TDraft>();
}

export function createPresetPlugin<TDraft extends Draft = Draft>(
  options: PresetPluginOptions<TDraft> = {}
): Plugin<TDraft> {
  const key = options.key ?? DEFAULT_PRESET_KEY;
  const storage = (options.storage ?? globalPresetStorage) as PresetStorage<TDraft>;
  const initialPresets = options.initialPresets?.map((preset) => cloneDeep(preset)) ?? [];

  return {
    name: 'preset-plugin',
    onInit({ root }) {
      const namespace = options.namespace ?? root.id;
      const state: PresetPluginState<TDraft> = { storage, namespace, key };
      root.setPluginState(key, state);
      for (const preset of initialPresets) {
        storage.save(namespace, { ...preset, updatedAt: preset.updatedAt ?? Date.now() });
      }
    },
    onDestroy({ root }) {
      root.setPluginState(key, undefined);
    },
  };
}

export function useFilterPresets<TDraft extends Draft>(
  options: UseFilterPresetsOptions<TDraft> = {}
): UseFilterPresetsResult<TDraft> {
  const filter = useFilter<TDraft>(options);
  const pluginKey = options.pluginKey ?? DEFAULT_PRESET_KEY;
  const state = filter.getPluginState<PresetPluginState<TDraft>>(pluginKey);

  if (!state) {
    throw new FilterError(
      ERROR_CODES.PLUGIN_STATE_NOT_READY,
      'Preset plugin state is not available. Ensure createPresetPlugin is installed.'
    );
  }

  const { storage, namespace } = state;

  const subscribe = useCallback(
    (listener: () => void) => storage.subscribe?.(namespace, listener) ?? (() => {}),
    [namespace, storage]
  );

  const getSnapshot = useCallback(() => storage.list(namespace), [namespace, storage]);

  const presets = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const createPreset = useCallback(
    (name: string, metadata?: Record<string, any>): FilterPreset<TDraft> => ({
      id: `${namespace}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      values: cloneDeep(filter.draft),
      metadata: metadata ? cloneDeep(metadata) : undefined,
      updatedAt: Date.now(),
    }),
    [filter.draft, namespace]
  );

  const savePreset = useCallback<UseFilterPresetsResult<TDraft>['savePreset']>(
    (name, metadata) => {
      const preset = createPreset(name, metadata);
      storage.save(namespace, preset);
      return preset;
    },
    [createPreset, namespace, storage]
  );

  const overwritePreset = useCallback<UseFilterPresetsResult<TDraft>['overwritePreset']>(
    (id, updater) => {
      const existing = storage.get(namespace, id);
      if (!existing) {
        return undefined;
      }
      const next: FilterPreset<TDraft> = {
        ...existing,
        ...cloneDeep(updater),
        values: updater.values ? cloneDeep(updater.values) : existing.values,
        metadata: updater.metadata ? cloneDeep(updater.metadata) : existing.metadata,
        name: updater.name ?? existing.name,
        updatedAt: updater.updatedAt ?? Date.now(),
      };
      storage.save(namespace, next);
      return next;
    },
    [namespace, storage]
  );

  const applyPreset = useCallback<UseFilterPresetsResult<TDraft>['applyPreset']>(
    async (id) => {
      const preset = storage.get(namespace, id);
      if (!preset) {
        return;
      }
      filter.load(preset.values, { mode: 'replace', decode: false });
      options.onApply?.(preset);
    },
    [filter, namespace, options, storage]
  );

  const removePreset = useCallback<UseFilterPresetsResult<TDraft>['removePreset']>(
    (id) => {
      storage.remove(namespace, id);
    },
    [namespace, storage]
  );

  const renamePreset = useCallback<UseFilterPresetsResult<TDraft>['renamePreset']>(
    (id, name) => {
      overwritePreset(id, { name });
    },
    [overwritePreset]
  );

  return useMemo<UseFilterPresetsResult<TDraft>>(
    () => ({
      presets,
      savePreset,
      applyPreset,
      removePreset,
      renamePreset,
      overwritePreset,
    }),
    [applyPreset, overwritePreset, presets, removePreset, renamePreset, savePreset]
  );
}

export const PRESET_PLUGIN_KEY = DEFAULT_PRESET_KEY;
