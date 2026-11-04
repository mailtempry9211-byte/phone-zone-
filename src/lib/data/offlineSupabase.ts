/**
 * Offline drop-in replacement for the Supabase JS client.
 *
 * Implements only the subset of the API the existing admin UI already uses
 * (from/select/insert/update/delete + filters, auth, storage, rpc) and proxies
 * it to the local Express + SQLite backend. This lets every existing admin
 * screen run unchanged in Offline / EXE mode - no UI rewrites.
 */
import { LOCAL_API_BASE } from "./config";

type Filter = { op: string; col: string; val: unknown };
type Result<T = any> = { data: T; error: any };

async function call<T>(path: string, body?: unknown, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${LOCAL_API_BASE}${path}`, {
    method: opts.method || "POST",
    credentials: "include",
    headers: body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    body: body instanceof FormData ? body : body === undefined ? undefined : JSON.stringify(body),
    ...opts,
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as any).error || `Request failed (${res.status})`);
  }

  if (res.headers.get("X-Prompt-Carry-Forward") === "true") {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("phonezone:previous-year-change", {
          detail: {
            fromYear: res.headers.get("X-From-Year"),
            toYear: res.headers.get("X-To-Year"),
          },
        })
      );
    }
  }

  const data = res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  if (data && typeof data === "object" && (data as any).promptCarryForward) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("phonezone:previous-year-change", {
          detail: {
            fromYear: (data as any).fromYear,
            toYear: (data as any).toYear,
          },
        })
      );
    }
  }
  return data;
}

class QueryBuilder implements PromiseLike<Result> {
  private filters: Filter[] = [];
  private orderBy?: { column: string; ascending: boolean };
  private limitCount?: number;
  private singleRow = false;
  private action: "select" | "insert" | "update" | "delete" = "select";
  private payload: any = null;

  constructor(private table: string) {}

  select(_cols?: string) {
    if (this.action === "select") this.action = "select";
    return this;
  }
  insert(rows: any) { this.action = "insert"; this.payload = rows; return this; }
  update(values: any) { this.action = "update"; this.payload = values; return this; }
  upsert(rows: any) { this.action = "insert"; this.payload = rows; return this; }
  delete() { this.action = "delete"; return this; }

  eq(col: string, val: unknown) { this.filters.push({ op: "eq", col, val }); return this; }
  neq(col: string, val: unknown) { this.filters.push({ op: "neq", col, val }); return this; }
  gte(col: string, val: unknown) { this.filters.push({ op: "gte", col, val }); return this; }
  lte(col: string, val: unknown) { this.filters.push({ op: "lte", col, val }); return this; }
  is(col: string, val: unknown) { this.filters.push({ op: "is", col, val }); return this; }
  in(col: string, val: unknown[]) { this.filters.push({ op: "in", col, val }); return this; }
  or(expr: string) { this.filters.push({ op: "or", col: "", val: expr }); return this; }
  ilike(col: string, val: string) { this.filters.push({ op: "or", col: "", val: `${col}.ilike.${val}` }); return this; }
  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: opts?.ascending !== false };
    return this;
  }
  limit(n: number) { this.limitCount = n; return this; }
  single() { this.singleRow = true; return this; }
  maybeSingle() { this.singleRow = true; return this; }

  private async run(): Promise<Result> {
    try {
      const base = `/pg/${this.table}`;
      let data: any;
      if (this.action === "select") {
        data = await call(`${base}/select`, { filters: this.filters, order: this.orderBy, limit: this.limitCount });
      } else if (this.action === "insert") {
        data = await call(`${base}/insert`, { rows: this.payload });
      } else if (this.action === "update") {
        data = await call(`${base}/update`, { values: this.payload, filters: this.filters });
      } else {
        data = await call(`${base}/delete`, { filters: this.filters });
        return { data: null, error: null };
      }
      if (this.singleRow) return { data: Array.isArray(data) ? data[0] ?? null : data, error: null };
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error: { message: error?.message || "Request failed" } };
    }
  }

  then<R1 = Result, R2 = never>(
    onfulfilled?: ((v: Result) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((r: any) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

/**
 * Server-assigned file id per uploaded object path, so getPublicUrl() can hand
 * back the login-free /public/files/:id route for photos that the server marked
 * public. Cleared automatically when the page reloads; paths uploaded in an
 * earlier session fall back to the object route below.
 */
const uploadedFileIds = new Map<string, string>();
const objectKey = (bucket: string, path: string) => `${bucket}::${path}`;

function storageBucket(bucket: string) {
  return {
    async upload(path: string, file: File | Blob) {
      try {
        const fd = new FormData();
        fd.append("bucket", bucket);
        fd.append("path", path);
        fd.append("file", file as Blob, (file as File).name || path.split("/").pop() || "file");
        const data = await call<any>("/pg/storage/upload", fd);
        if (data?.id) uploadedFileIds.set(objectKey(bucket, path), data.id);
        return { data, error: null };
      } catch (error: any) {
        return { data: null, error: { message: error?.message } };
      }
    },
    getPublicUrl(path: string) {
      const id = uploadedFileIds.get(objectKey(bucket, path));
      // Two routes on purpose:
      //   * a file the server flagged public (product photos, logo, signature)
      //     is served by the login-free public route, so the customer homepage
      //     and invoices work with nobody signed in;
      //   * private documents (purchase-documents, payment-proof, aadhaar) go
      //     through the object route, which now demands a staff session - the
      //     same-origin <img>/fetch request carries the session cookie, so the
      //     admin screens keep displaying them.
      const publicUrl = id
        ? `${LOCAL_API_BASE}/public/files/${id}`
        : `${LOCAL_API_BASE}/pg/storage/object/${bucket}/${path}`;
      return { data: { publicUrl } };
    },
    async list(_prefix?: string) {
      try {
        return { data: await call<any[]>("/pg/storage/list", { bucket }), error: null };
      } catch (error: any) {
        return { data: null, error: { message: error?.message } };
      }
    },
    async remove(paths: string[]) {
      try {
        await call("/pg/storage/remove", { bucket, paths });
        return { data: null, error: null };
      } catch (error: any) {
        return { data: null, error: { message: error?.message } };
      }
    },
  };
}

const listeners = new Set<(event: string, session: any) => void>();
let currentSession: any = null;

function toSession(user: any) {
  return user ? { user: { ...user, email: user.email }, access_token: "local" } : null;
}

export function createOfflineSupabase() {
  return {
    from: (table: string) => new QueryBuilder(table),

    rpc: async (fn: string, args: any) => {
      try {
        if (fn === "process_phone_return") {
          const data = await call("/returns", {
            phone_id: args.p_phone_id,
            return_type: args.p_return_type,
            return_amount: args.p_return_amount,
            return_reason: args.p_return_reason,
            notes: args.p_notes,
            customer_id: args.p_customer_id,
            seller_id: args.p_seller_id,
          });
          return { data, error: null };
        }
        return { data: null, error: { message: `RPC ${fn} is not available offline` } };
      } catch (error: any) {
        return { data: null, error: { message: error?.message } };
      }
    },

    auth: {
      async getSession() {
        try {
          const user = await call("/auth/me", undefined, { method: "GET" });
          currentSession = toSession(user);
        } catch {
          currentSession = null;
        }
        return { data: { session: currentSession }, error: null };
      },
      async getUser() {
        const { data } = await this.getSession();
        return { data: { user: data.session?.user ?? null }, error: null };
      },
      onAuthStateChange(cb: (event: string, session: any) => void) {
        listeners.add(cb);
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
      },
      async signInWithPassword({ email, password }: { email: string; password: string }) {
        try {
          const result = await call<any>("/auth/login", { email, password });
          currentSession = toSession(result.user ?? result);
          listeners.forEach((cb) => cb("SIGNED_IN", currentSession));
          return { data: { session: currentSession }, error: null };
        } catch (error: any) {
          return { data: { session: null }, error: { message: error?.message || "Invalid credentials" } };
        }
      },
      async signUp() {
        return { data: null, error: { message: "Sign-up is disabled in offline mode. Ask an admin to create the account." } };
      },
      async signOut() {
        try { await call("/auth/logout"); } catch { /* ignore */ }
        currentSession = null;
        listeners.forEach((cb) => cb("SIGNED_OUT", null));
        return { error: null };
      },
      async updateUser({ password, currentPassword }: { password?: string; currentPassword?: string }) {
        try {
          await call("/auth/change-password", { currentPassword, newPassword: password });
          return { data: null, error: null };
        } catch (error: any) {
          return { data: null, error: { message: error?.message } };
        }
      },
    },

    storage: {
      from: storageBucket,
      async listBuckets() {
        return { data: [{ id: "phonezone-uploads", name: "phonezone-uploads" }], error: null };
      },
    },
  };
}
