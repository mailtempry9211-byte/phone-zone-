/** Standalone DB initializer: `npm run db:init` inside backend/. */
import { initDatabase, closeDatabase } from "./index.js";
import { ensureBootstrapAdmin } from "../services/authService.js";
import { PATHS } from "../config/paths.js";

initDatabase();
const info = ensureBootstrapAdmin();
closeDatabase();

console.log(`Database ready at ${PATHS.databaseFile}`);
if (info.created) {
  console.log(`Bootstrap admin created: ${info.email}`);
  console.log("Sign in and change the password immediately.");
}
