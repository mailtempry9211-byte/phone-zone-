import { useQuery, useQueryClient } from "@tanstack/react-query";
import { OFFLINE } from "@/lib/data";
import { getFinancialYears, type FinancialYearState } from "@/lib/data/financialYear";

/**
 * Financial-year state, shared across the admin UI through react-query.
 *
 * `enabled` is false on the hosted (online) build, where the endpoints do not
 * exist - callers use it to hide the year switcher entirely.
 */
export function useFinancialYear() {
  const queryClient = useQueryClient();
  const query = useQuery<FinancialYearState>({
    queryKey: ["financial-years"],
    queryFn: getFinancialYears,
    enabled: OFFLINE,
    staleTime: 30_000,
  });

  return {
    enabled: OFFLINE,
    active: query.data?.active ?? null,
    years: query.data?.years ?? [],
    isPreviousYear: query.data?.isPreviousYear ?? false,
    latestYear: query.data?.latestYear ?? null,
    isLoading: OFFLINE && query.isLoading,
    error: query.error as Error | null,
    refresh: () => queryClient.invalidateQueries({ queryKey: ["financial-years"] }),
  };
}
