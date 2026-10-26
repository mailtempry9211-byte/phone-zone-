import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, notAuthenticated, errorResult, jsonResult } from "../supabase";

export default defineTool({
  name: "get_business_stats",
  title: "Get business stats",
  description:
    "Summary of the store: available stock count, sold count, total revenue, gross profit, customers and sellers.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);

    const [available, sold, customers, sellers] = await Promise.all([
      supabase.from("phones").select("id", { count: "exact", head: true }).eq("is_sold", false),
      supabase.from("phones").select("selling_price, purchase_price").eq("is_sold", true),
      supabase.from("customers").select("id", { count: "exact", head: true }),
      supabase.from("sellers").select("id", { count: "exact", head: true }),
    ]);

    const firstError = available.error || sold.error || customers.error || sellers.error;
    if (firstError) return errorResult(firstError.message);

    const rows = sold.data ?? [];
    const totalRevenue = rows.reduce((sum, r) => sum + Number(r.selling_price ?? 0), 0);
    const totalCost = rows.reduce((sum, r) => sum + Number(r.purchase_price ?? 0), 0);

    return jsonResult({
      phones_in_stock: available.count ?? 0,
      phones_sold: rows.length,
      total_revenue: totalRevenue,
      gross_profit: totalRevenue - totalCost,
      total_customers: customers.count ?? 0,
      total_sellers: sellers.count ?? 0,
      currency: "INR",
    });
  },
});
