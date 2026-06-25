import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names with Tailwind conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Pseudo-deterministic pick (used in seeds/placeholder helpers). */
export function pick<T>(arr: readonly T[], i: number): T {
  return arr[((i % arr.length) + arr.length) % arr.length];
}
