import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated, errorResult, jsonResult } from "../supabase";

export default defineTool({
  name: "list_sold_phones",
  title: "List sold phones",
  description: "List phones that have been sold, most recently sold first.",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("phones")
      .select(
        "id, phone_name, model, condition, selling_price, purchase_price, sold_date, payment_method, customer_id",
      )
      .eq("is_sold", true)
      .order("sold_date", { ascending: false })
      .limit(limit ?? 25);
    if (error) return errorResult(error.message);
    return jsonResult({ count: data?.length ?? 0, sold: data ?? [] });
  },
});
