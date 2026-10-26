import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, notAuthenticated, errorResult, jsonResult } from "../supabase";

export default defineTool({
  name: "list_messages",
  title: "List contact messages",
  description: "List enquiry messages submitted through the website contact form.",
  inputSchema: {
    unread_only: z.boolean().optional().describe("Only return unread messages."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows (default 25)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ unread_only, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return notAuthenticated();
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit ?? 25);
    if (unread_only) query = query.eq("is_read", false);
    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ count: data?.length ?? 0, messages: data ?? [] });
  },
});
