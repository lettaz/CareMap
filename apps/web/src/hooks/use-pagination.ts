import { useState, useCallback, useMemo } from "react";
import type { PaginationState } from "@/lib/types/pagination";

interface UsePaginationOptions {
  defaultPage?: number;
  defaultPageSize?: number;
}

export function usePagination(total: number, options: UsePaginationOptions = {}) {
  const { defaultPage = 1, defaultPageSize = 20 } = options;
  const [state, setState] = useState<PaginationState>({
    page: defaultPage,
    pageSize: defaultPageSize,
  });

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / state.pageSize)),
    [total, state.pageSize],
  );

  const setPage = useCallback(
    (page: number) => setState((s) => ({ ...s, page: Math.max(1, Math.min(page, totalPages)) })),
    [totalPages],
  );

  const setPageSize = useCallback(
    (pageSize: number) => setState({ page: 1, pageSize }),
    [],
  );

  const nextPage = useCallback(() => setPage(state.page + 1), [state.page, setPage]);
  const prevPage = useCallback(() => setPage(state.page - 1), [state.page, setPage]);

  const resetPage = useCallback(() => setState((s) => ({ ...s, page: 1 })), []);

  return {
    ...state,
    totalPages,
    setPage,
    setPageSize,
    nextPage,
    prevPage,
    resetPage,
    hasNext: state.page < totalPages,
    hasPrev: state.page > 1,
  };
}
