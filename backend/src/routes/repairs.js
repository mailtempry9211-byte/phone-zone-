/**
 * Routes for the private repairs module.
 * Mounted under /api/repair. Strictly protected by staff middleware.
 */
import express from "express";
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
import {
  listRepairCustomers,
  getRepairCustomer,
  getRepairCustomerByPhone,
  createRepairCustomer,
  updateRepairCustomer,
  deleteRepairCustomer,
  getRepairCustomerHistory,
} from "../services/repairCustomerService.js";
import {
  listRepairJobs,
  getRepairJob,
  createRepairJob,
  createReworkJob,
  getRepairAccounting,
  updateRepairJob,
  updateRepairJobStatus,
  addRepairJobItems,
  deleteRepairJob,
  getRepairJobsByImei,
} from "../services/repairJobService.js";
import { isPreviousYearActive, recordPreviousYearChange } from "../services/financialYearService.js";

function withPrevYearMetadata(data) {
  const prev = isPreviousYearActive();
  if (prev.isPrevious && data && typeof data === "object") {
    return { ...data, promptCarryForward: true, fromYear: prev.activeYear, toYear: prev.latestYear };
  }
  return data;
}

export function buildRepairsRouter() {
  const r = express.Router();

  // Customer routes
  r.get("/customers", wrap((req, res) => {
    res.json(listRepairCustomers({ search: req.query.search, limit: req.query.limit }));
  }));

  r.post("/customers", wrap((req, res) => {
    res.status(201).json(createRepairCustomer(req.body || {}));
  }));

  r.get("/customers/by-phone/:phone", wrap((req, res) => {
    const cust = getRepairCustomerByPhone(req.params.phone);
    if (!cust) return res.status(404).json({ error: "No customer found with that phone." });
    res.json(cust);
  }));

  r.get("/customers/:id", wrap((req, res) => {
    res.json(getRepairCustomer(req.params.id));
  }));

  r.put("/customers/:id", wrap((req, res) => {
    res.json(updateRepairCustomer(req.params.id, req.body || {}));
  }));

  r.delete("/customers/:id", wrap((req, res) => {
    res.json(deleteRepairCustomer(req.params.id));
  }));

  r.get("/customers/:id/history", wrap((req, res) => {
    res.json(getRepairCustomerHistory(req.params.id));
  }));

  // Accounting route
  r.get("/accounting", wrap((_req, res) => {
    res.json(getRepairAccounting());
  }));

  // Rework / warranty return route
  r.post("/jobs/:id/rework", wrap((req, res) => {
    const job = createReworkJob(req.params.id, {
      reason: req.body?.reason,
      technician: req.body?.technician,
      notes: req.body?.notes,
      userId: req.user?.id,
    });
    recordPreviousYearChange("repair_job", job.id, "rework_created", { jobNo: job.job_no, originalId: req.params.id });
    res.status(201).json(withPrevYearMetadata(job));
  }));

  // Jobs routes
  r.get("/jobs", wrap((req, res) => {
    const isAdmin = req.user?.roles?.includes("admin");
    const userShopId = req.user?.shopId || "shop_1";
    const query = { ...req.query };
    if (!isAdmin) {
      query.shop = userShopId;
    }
    res.json(listRepairJobs(query));
  }));

  r.post("/jobs", wrap((req, res) => {
    const isAdmin = req.user?.roles?.includes("admin");
    const userShopId = req.user?.shopId || "shop_1";
    const shop_id = !isAdmin ? userShopId : (req.body?.shop_id || userShopId);
    const job = createRepairJob({
      ...req.body,
      shop_id,
      user_id: req.user?.id,
    });
    recordPreviousYearChange("repair_job", job.id, "create", { jobNo: job.job_no });
    res.status(201).json(withPrevYearMetadata(job));
  }));

  r.get("/jobs/:id", wrap((req, res) => {
    const job = getRepairJob(req.params.id);
    const isAdmin = req.user?.roles?.includes("admin");
    const userShopId = req.user?.shopId || "shop_1";
    if (!isAdmin && job.shop_id && job.shop_id !== userShopId) {
      return res.status(403).json({ error: "Access denied to other shop's repair job." });
    }
    res.json(job);
  }));

  const handleJobUpdate = wrap((req, res) => {
    const job = getRepairJob(req.params.id);
    const isAdmin = req.user?.roles?.includes("admin");
    const userShopId = req.user?.shopId || "shop_1";
    if (!isAdmin && job.shop_id && job.shop_id !== userShopId) {
      return res.status(403).json({ error: "Access denied to other shop's repair job." });
    }
    const updated = updateRepairJob(req.params.id, req.body || {});
    recordPreviousYearChange("repair_job", req.params.id, "update", req.body || {});
    res.json(withPrevYearMetadata(updated));
  });

  r.put("/jobs/:id", handleJobUpdate);
  r.patch("/jobs/:id", handleJobUpdate);

  r.post("/jobs/:id/status", wrap((req, res) => {
    const job = getRepairJob(req.params.id);
    const isAdmin = req.user?.roles?.includes("admin");
    const userShopId = req.user?.shopId || "shop_1";
    if (!isAdmin && job.shop_id && job.shop_id !== userShopId) {
      return res.status(403).json({ error: "Access denied to other shop's repair job." });
    }
    const updated = updateRepairJobStatus(req.params.id, {
      status: req.body.status,
      note: req.body.note,
      userId: req.user?.id,
    });
    recordPreviousYearChange("repair_job", req.params.id, "status_change", { status: req.body.status });
    res.json(withPrevYearMetadata(updated));
  }));

  r.post("/jobs/:id/items", wrap((req, res) => {
    const job = getRepairJob(req.params.id);
    const isAdmin = req.user?.roles?.includes("admin");
    const userShopId = req.user?.shopId || "shop_1";
    if (!isAdmin && job.shop_id && job.shop_id !== userShopId) {
      return res.status(403).json({ error: "Access denied to other shop's repair job." });
    }
    res.json(addRepairJobItems(req.params.id, req.body.items || []));
  }));

  r.delete("/jobs/:id", wrap((req, res) => {
    const job = getRepairJob(req.params.id);
    const isAdmin = req.user?.roles?.includes("admin");
    const userShopId = req.user?.shopId || "shop_1";
    if (!isAdmin && job.shop_id && job.shop_id !== userShopId) {
      return res.status(403).json({ error: "Access denied to other shop's repair job." });
    }
    const deleted = deleteRepairJob(req.params.id);
    recordPreviousYearChange("repair_job", req.params.id, "delete", {});
    res.json(withPrevYearMetadata(deleted));
  }));

  // Cross-check route
  r.get("/by-imei/:imei", wrap((req, res) => {
    res.json(getRepairJobsByImei(req.params.imei));
  }));

  return r;
}
