import { cloneDeep } from 'es-toolkit/clone-deep';
import { merge } from 'es-toolkit/merge';
import type { FilterListeners, Plugin } from './types.js';

export function mergePlugins<T>(
  base: Plugin<T>[],
  extra: Plugin<T>[],
  strategy: 'prepend' | 'append'
): Plugin<T>[] {
  if (strategy === 'prepend') {
    return [...extra, ...base];
  }
  return [...base, ...extra];
}

export function mergeListeners<T>(
  base: FilterListeners<T> | undefined,
  extra: FilterListeners<T> | undefined,
  strategy: 'shallow' | 'deep'
): FilterListeners<T> | undefined {
  if (!base) return extra ? cloneDeep(extra) : undefined;
  if (!extra) return cloneDeep(base);

  if (strategy === 'deep') {
    const merged = merge(cloneDeep(base) as Record<string, any>, extra as Record<string, any>);
    return merged as FilterListeners<T>;
  }

  return { ...cloneDeep(base), ...extra };
}
