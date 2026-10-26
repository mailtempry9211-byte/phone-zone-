import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listInventoryTool from "./tools/list-inventory";
import listSoldPhonesTool from "./tools/list-sold-phones";
import listCustomersTool from "./tools/list-customers";
import listMessagesTool from "./tools/list-messages";
import getBusinessStatsTool from "./tools/get-business-stats";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "phonezonestp",
  title: "phonezonestp",
  version: "0.1.0",
  instructions:
    "Tools for the PhoneZone mobile store. Read inventory, sold phones, customers, contact messages, and business stats. All data is scoped to the signed-in staff account.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    getBusinessStatsTool,
    listInventoryTool,
    listSoldPhonesTool,
    listCustomersTool,
    listMessagesTool,
  ],
});
