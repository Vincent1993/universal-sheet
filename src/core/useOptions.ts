import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFilter } from './FilterProvider.js';
import type { OptionsResult, UseOptionsInput } from './types.js';

export function useOptions(input: UseOptionsInput): OptionsResult {
  const { path, keyword, ...rest } = input;
  const filter = useFilter(rest);
  const source = filter.getOptionSource(path);

  const enabled = source
    ? typeof source.enabled === 'function'
      ? source.enabled(filter.draft)
      : source.enabled ?? true
    : false;

  const queryKey = source?.key ?? ['filter', filter.id, 'options', path, keyword ?? null];

  const queryFn = async () => {
    if (!source) {
      return [] as any[];
    }
    const data = await source.fetcher({ keyword, draft: filter.draft });
    return data ?? [];
  };

  const query = useQuery({
    queryKey,
    queryFn,
    enabled,
    staleTime: source?.staleTime,
    placeholderData: source?.placeholderData,
    refetchOnMount: source?.refetchOnMount,
  });

  return useMemo<OptionsResult>(() => {
    const data = query.data ?? source?.placeholderData ?? [];
    return {
      data,
      isLoading: query.isLoading,
      isFetching: query.isFetching,
      error: query.error ?? null,
      refetch: () => {
        void query.refetch();
      },
    };
  }, [query, source?.placeholderData]);
}
