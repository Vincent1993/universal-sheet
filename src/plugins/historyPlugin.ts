import { cloneDeep } from 'es-toolkit/clone-deep';
import type { Plugin } from '../core/types.js';

export interface HistoryPluginOptions<TDraft = Record<string, any>> {
  limit?: number;
  onHistoryChange?: (history: ReadonlyArray<{ draft: TDraft; applied: any }>) => void;
}

export function createHistoryPlugin<TDraft = Record<string, any>>(
  options: HistoryPluginOptions<TDraft> = {}
): Plugin<TDraft> {
  const { limit = 20, onHistoryChange } = options;
  let history: Array<{ draft: TDraft; applied: any }> = [];

  const push = (draft: TDraft, applied: any) => {
    history = [...history, { draft: cloneDeep(draft), applied: cloneDeep(applied) }];
    if (history.length > limit) {
      history = history.slice(history.length - limit);
    }
    onHistoryChange?.(history);
  };

  return {
    name: 'history-plugin',
    onInit({ root }) {
      push(root.draft, root.applied);
    },
    onAfterApply({ draft, payload }) {
      push(draft, payload);
    }
  };
}
