declare module '@tanstack/react-query' {
  export interface UseQueryResult<TData = unknown, TError = unknown> {
    data: TData | undefined;
    error: TError | null;
    isLoading: boolean;
    isFetching: boolean;
    refetch: () => Promise<any>;
  }

  export interface UseQueryOptions<TData = unknown> {
    queryKey: ReadonlyArray<unknown>;
    queryFn: () => Promise<TData>;
    enabled?: boolean;
    staleTime?: number;
    placeholderData?: TData;
    refetchOnMount?: boolean | 'always';
  }

  export function useQuery<TData = unknown>(options: UseQueryOptions<TData>): UseQueryResult<TData>;
}
