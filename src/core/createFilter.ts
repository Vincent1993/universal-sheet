import { FilterController } from './controller.js';
import type { Draft, FilterApi, FilterOptions } from './types.js';

export function createFilter<TDraft extends Draft = Draft>(options: FilterOptions<TDraft> = {}): FilterApi<TDraft> {
  return new FilterController<TDraft>(options);
}
