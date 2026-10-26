import { randomUUID, randomBytes } from "node:crypto";

export const newId = () => randomUUID();
export const newToken = () => randomBytes(32).toString("hex");

/** User-facing error: its message IS safe to display. */
export class AppError extends Error {
  constructor(message, status = 400, code = "app_error") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (m) => new AppError(m, 400, "bad_request");
export const unauthorized = (m = "Please sign in to continue.") => new AppError(m, 401, "unauthorized");
export const forbidden = (m = "You do not have permission to do that.") => new AppError(m, 403, "forbidden");
export const notFound = (m = "That record could not be found.") => new AppError(m, 404, "not_found");
