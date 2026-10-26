import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated, errorResult, jsonResult } from "../supabase";

export default defineTool({
  name: "list_inventory",
  title: "List inventory",
  description:
    "List phones currently available in inventory (not sold), newest first.",
  inputSchema: {
    search: z
      .string()
      .trim()
      .optional()
      .describe("Optional text to match against phone name or model."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("phones")
      .select(
        "id, phone_name, model, condition, imei_number, selling_price, purchase_price, rating, features, created_at",
      )
      .eq("is_sold", false)
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);

    if (search) query = query.or(`phone_name.ilike.%${search}%,model.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ count: data?.length ?? 0, phones: data ?? [] });
  },
});
