import React, { createContext, useContext, useMemo } from 'react';
import { createInstanceRegistry } from './registry.js';
import type { FilterConfigureProps, FilterConfigureValue, GlobalDefaults } from './types.js';

const DEFAULT_VALUE: Required<FilterConfigureValue<any>> = {
  defaults: {},
  registry: createInstanceRegistry(),
  mergeStrategy: {
    plugins: 'append',
    listeners: 'shallow'
  }
};

const ConfigureContext = createContext<Required<FilterConfigureValue<any>>>(DEFAULT_VALUE);

export function FilterConfigure<TDraft extends Record<string, any> = Record<string, any>>(
  props: FilterConfigureProps<TDraft>
): any {
  const { value, children } = props;
  const memoised = useMemo(() => {
    const defaults: GlobalDefaults<any> = value.defaults
      ? (value.defaults as GlobalDefaults<any>)
      : ({} as GlobalDefaults<any>);
    const merged: Required<FilterConfigureValue<any>> = {
      defaults,
      registry: value.registry ?? DEFAULT_VALUE.registry,
      mergeStrategy: {
        plugins: value.mergeStrategy?.plugins ?? DEFAULT_VALUE.mergeStrategy.plugins,
        listeners: value.mergeStrategy?.listeners ?? DEFAULT_VALUE.mergeStrategy.listeners
      }
    };
    return merged;
  }, [value]);

  return React.createElement(ConfigureContext.Provider, { value: memoised, children });
}

export function useConfigure<TDraft>(): Required<FilterConfigureValue<TDraft>> {
  return useContext(ConfigureContext) as Required<FilterConfigureValue<TDraft>>;
}

export function getGlobalConfigure<TDraft>(): Required<FilterConfigureValue<TDraft>> {
  const context = ConfigureContext as unknown as { _currentValue?: Required<FilterConfigureValue<TDraft>> };
  return context._currentValue ?? (DEFAULT_VALUE as Required<FilterConfigureValue<TDraft>>);
}
