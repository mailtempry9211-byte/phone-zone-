import { useQuery } from "@tanstack/react-query";

export interface DashboardOverviewData {
  generatedAt: string;
  timezone: string;
  financialYear: string;
  range?: "today" | "yesterday" | "week" | "month" | "year";
  selectedDate?: string | null;
  periodLabel?: string;
  periodMetrics?: {
    salesAmount: number;
    phonesSold: number;
    profit?: number;
    purchasesAmount: number;
    phonesBought: number;
    returnsCount: number;
  };
  today: {
    salesAmount: number;
    phonesSold: number;
    profit?: number;
    purchasesAmount: number;
    phonesBought: number;
    returnsCount: number;
  };
  yesterday: {
    salesAmount: number;
    phonesSold: number;
    profit?: number;
    purchasesAmount: number;
    phonesBought: number;
    returnsCount: number;
  };
  fyTotals?: {
    soldCount: number;
    revenue: number;
    cost: number;
    profit?: number;
  };
  stock: {
    count: number;
    value?: number;
    agingBuckets: {
      d0_30: number;
      d31_60: number;
      d61_90: number;
      d90plus: number;
    };
    lowStock: boolean;
    threshold: number;
  };
  people: {
    customers: number;
    sellers: number;
    newCustomers30d: number;
  };
  messages: {
    unread: number;
  };
  repairs: {
    available: boolean;
    pending: number;
    readyForDelivery: number;
    balanceDue?: number;
    totalDelivered?: number;
    totalRevenue?: number;
    todayDelivered?: number;
    todayRevenue?: number;
    byStage: {
      received: number;
      diagnosing: number;
      waiting_parts: number;
      in_progress: number;
      ready: number;
      delivered: number;
    };
    jobs: Array<{
      id: string;
      jobNo: string;
      customerName: string;
      device: string;
      problem: string;
      status: string;
      ageDays: number;
    }>;
  };
  series: Array<{
    label: string;
    date: string;
    sales: number;
    count: number;
    profit?: number;
  }>;
  brands: Array<{
    name: string;
    count: number;
    value?: number;
  }>;
  recentInvoices: Array<{
    id: string;
    number: string;
    type: string;
    party: string;
    amount: number;
    status: string;
    date: string;
  }>;
  alerts: Array<{
    type: string;
    severity: "warning" | "info" | "critical";
    text: string;
    count: number;
    link: string;
  }>;
  purchaseOverview?: {
    incoming7dCount: number;
    incoming7dAmount: number;
    incomingPrev7dCount: number;
    isLowIncoming: boolean;
    modelAverages: Array<{
      phone_name: string;
      model: string;
      units_purchased: number;
      avg_purchase_price: number;
      min_purchase_price: number;
      max_purchase_price: number;
      avg_selling_price: number;
    }>;
    brandAverages: Array<{
      brand: string;
      units: number;
      avg_purchase_price: number;
      avg_selling_price: number;
    }>;
    topSellers: Array<{
      id: string;
      name: string;
      phone: string;
      phones_supplied: number;
      total_volume: number;
      avg_ticket: number;
    }>;
  };
}

export function useDashboardData({
  range = "week",
  date = "",
  fy = "",
  shop = "",
}: {
  range?: "today" | "yesterday" | "week" | "month" | "year";
  date?: string;
  fy?: string;
  shop?: string;
} = {}) {
  return useQuery<DashboardOverviewData, Error>({
    queryKey: ["dashboard-overview", range, date, fy, shop],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (range) params.set("range", range);
      if (date) params.set("date", date);
      if (fy) params.set("fy", fy);
      if (shop) params.set("shop", shop);

      const res = await fetch(`/api/dashboard/overview?${params.toString()}`, {
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please log in again to view dashboard analytics.");
        }
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to load dashboard metrics (${res.status})`);
      }

      return res.json();
    },
    staleTime: 20 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

