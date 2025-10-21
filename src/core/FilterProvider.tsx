import React, { useContext, useEffect, useMemo } from 'react';
import { FormProvider } from '@formily/react';
import { FilterContext, DEFAULT_NAMESPACE } from './context.js';
import { ERROR_CODES, FilterError } from './errors.js';
import { useConfigure } from './configure.js';
import type { FilterApi, FilterProviderProps, UseFilterInput } from './types.js';

export function FilterProvider<TDraft>(props: FilterProviderProps<TDraft>): any {
  const { instance, namespace, children } = props;
  const configure = useConfigure<TDraft>();
  const parentMap = useContext(FilterContext);

  const map = useMemo(() => {
    const next = new Map(parentMap ?? undefined);
    const key = namespace ?? DEFAULT_NAMESPACE;
    next.set(key, instance as FilterApi<any>);
    return next;
  }, [instance, namespace, parentMap]);

  useEffect(() => {
    if (namespace) {
      configure.registry.set(namespace, instance as FilterApi<any>);
      return () => configure.registry.delete(namespace);
    }
    configure.registry.setDefault(instance as FilterApi<any>);
    return undefined;
  }, [configure.registry, instance, namespace]);

  return (
    <FormProvider form={instance.form as any}>
      <FilterContext.Provider value={map}>{children}</FilterContext.Provider>
    </FormProvider>
  );
}

export function useFilter<TDraft>(input?: UseFilterInput<TDraft>): FilterApi<TDraft> {
  if (input?.instance) {
    return input.instance;
  }

  const contextMap = useContext(FilterContext);
  const configure = useConfigure<TDraft>();

  if (input?.namespace) {
    const key = input.namespace;
    const fromContext = contextMap?.get(key) as FilterApi<TDraft> | undefined;
    if (fromContext) {
      return fromContext;
    }
    const fromRegistry = configure.registry.get(key) as FilterApi<TDraft> | undefined;
    if (fromRegistry) {
      return fromRegistry;
    }
    throw new FilterError(ERROR_CODES.NAMESPACE_NOT_FOUND, `Namespace "${key}" is not registered`);
  }

  const defaultContext = contextMap?.get(DEFAULT_NAMESPACE) as FilterApi<TDraft> | undefined;
  if (defaultContext) {
    return defaultContext;
  }

  const defaultRegistry = configure.registry.getDefault() as FilterApi<TDraft> | undefined;
  if (defaultRegistry) {
    return defaultRegistry;
  }

  throw new FilterError(ERROR_CODES.NO_FILTER_CONTEXT, 'No filter instance available in context');
}
