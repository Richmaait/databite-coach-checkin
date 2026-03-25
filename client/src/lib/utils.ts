import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a YYYY-MM-DD date string as DD/MM/YYYY (Australian format).
 * Safe to use for weekStart strings and other ISO date strings.
 */
export function formatDateAU(dateStr: string): string {
  if (!dateStr) return dateStr;
  const [y, m, d] = dateStr.split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

/**
 * Format a YYYY-MM-DD weekStart as "w/c DD/MM/YYYY" (week commencing).
 */
export function formatWeekAU(weekStart: string): string {
  return `w/c ${formatDateAU(weekStart)}`;
}

/**
 * Format a Date object or ISO timestamp as DD/MM/YYYY.
 */
export function formatDateObjAU(date: Date | string | number): string {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
