/**
 * Formatting utilities for PhoneZone Admin Dashboard.
 * Formats Indian Rupee (₹ 1,23,456), dates (DD-MM-YYYY), and human relative intervals.
 */

/** Format currency in Indian numbering system (Lakhs & Crores). */
export function formatINR(val?: number | null): string {
  if (val === undefined || val === null || isNaN(val)) return "₹0";
  return "₹" + Number(val).toLocaleString("en-IN");
}

/** Format simple number in Indian numbering system. */
export function formatNumberIN(val?: number | null): string {
  if (val === undefined || val === null || isNaN(val)) return "0";
  return Number(val).toLocaleString("en-IN");
}

/** Format ISO or date string to DD-MM-YYYY. */
export function formatDateDMY(dateInput?: string | null): string {
  if (!dateInput) return "";
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return dateInput;
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateInput || "";
  }
}

/** Human relative time (e.g. "Just now", "2 hours ago", "3 days ago"). */
export function formatRelativeTime(dateInput?: string | null): string {
  if (!dateInput) return "";
  try {
    const d = new Date(dateInput);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 0) return "Just now";
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 30) return `${diffDays} days ago`;
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths} mo ago`;
  } catch {
    return "";
  }
}

/** Calculate percentage change safely. */
export function calcPercentChange(current: number, previous: number): { value: number; direction: "up" | "down" | "flat" } {
  if (previous === 0) {
    if (current === 0) return { value: 0, direction: "flat" };
    return { value: 100, direction: "up" };
  }
  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100);
  if (pct > 0) return { value: pct, direction: "up" };
  if (pct < 0) return { value: Math.abs(pct), direction: "down" };
  return { value: 0, direction: "flat" };
}

