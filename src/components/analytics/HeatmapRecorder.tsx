"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Records where shoppers click and how far down each page they scroll, for Admin → Analytics → Heatmaps.
 * Mounted by <Analytics>, so never for the shop's own team, and only while `allowed()` says the visitor
 * accepts analytics. Nothing typed is ever sent: a click in a form field is kept as a spot with no words.
 */
type Click = { p: string; d: string; s: string; rx: number; ry: number; x: number; y: number; l: string | null };
type View = { p: string; d: string; depth: number };

const ENDPOINT = "/api/hm";
const SKIP = /^\/(account|login|register|forgot-password|reset-password|checkout\/success)(\/|$)/;
const FORM_FIELD = "input, textarea, select, [contenteditable], [data-clarity-mask]";
const MAX_CLICKS_PER_PAGE = 60;

const deviceNow = () => (window.innerWidth < 768 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop");
const STABLE_ID = /^[A-Za-z][\w-]{0,40}$/;

/** A CSS path to the element from <body> (or the nearest element with a stable id). */
function selectorFor(el: Element): string | null {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node !== document.body && node !== document.documentElement) {
    if (node.id && STABLE_ID.test(node.id)) {
      parts.unshift(`#${node.id}`);
      break;
    }
    const tag = node.tagName.toLowerCase();
    if (!/^[a-z][a-z0-9-]*$/.test(tag)) return null;
    const parent: Element | null = node.parentElement;
    let part = tag;
    if (parent) {
      const same = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
    }
    parts.unshift(part);
    node = parent;
  }
  if (node === document.body) parts.unshift("body");
  const s = parts.join(" > ");
  return s && s.length <= 512 ? s : null;
}

/** The words a shopper saw on what they clicked: a link or button's name, or a picture's description. */
function labelFor(target: Element): string | null {
  if (target.closest(FORM_FIELD)) return null;
  const control = target.closest("a, button, [role=button], summary, label");
  const el = control ?? target;
  const named = el.getAttribute("aria-label") || (el instanceof HTMLElement ? el.innerText : "") || el.querySelector("img")?.getAttribute("alt") || (el instanceof HTMLImageElement ? el.alt : "");
  const text = (named || "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  // Long blocks of text aren't a name; keep the first words.
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

export function HeatmapRecorder({ allowed }: { allowed: () => boolean }) {
  const path = usePathname();
  const clicks = useRef<Click[]>([]);
  const views = useRef<View[]>([]);
  const depth = useRef(0);
  const pageClicks = useRef(0);

  // Send what's waiting: every 10 seconds, and when the page is hidden or closed.
  useEffect(() => {
    const send = () => {
      if (!clicks.current.length && !views.current.length) return;
      const body = JSON.stringify({ c: clicks.current.splice(0, 60), v: views.current.splice(0, 10) });
      try {
        if (!navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }))) {
          void fetch(ENDPOINT, { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
        }
      } catch {}
    };
    const timer = setInterval(send, 10_000);
    const hidden = () => {
      if (document.visibilityState === "hidden") {
        endView();
        send();
      }
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", hidden);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", hidden);
    };
    // endView reads refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = useRef<string | null>(null);
  const viewSent = useRef(true);
  /** Notes the page view once, the first time the shopper leaves the page or hides the tab. */
  function endView() {
    if (current.current && !viewSent.current && allowed()) views.current.push({ p: current.current, d: deviceNow(), depth: Math.round(depth.current * 100) });
    viewSent.current = true;
  }

  // A page view per path: how far down it got is noted when the shopper leaves it.
  useEffect(() => {
    endView();
    current.current = SKIP.test(path) ? null : path;
    if (!current.current) return;
    viewSent.current = false;
    depth.current = 0;
    pageClicks.current = 0;
    const measure = () => {
      const doc = document.documentElement;
      const seen = (window.scrollY + window.innerHeight) / Math.max(doc.scrollHeight, 1);
      if (seen > depth.current) depth.current = Math.min(1, seen);
    };
    // Pages fill in after they appear, so measure once they've settled too.
    const t = setTimeout(measure, 1200);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!current.current || !allowed() || pageClicks.current >= MAX_CLICKS_PER_PAGE) return;
      const target = e.target instanceof Element ? e.target : null;
      if (!target || target.closest("[data-heatmap-ignore]")) return;
      const s = selectorFor(target);
      if (!s) return;
      const r = target.getBoundingClientRect();
      const doc = document.documentElement;
      pageClicks.current += 1;
      clicks.current.push({
        p: current.current,
        d: deviceNow(),
        s,
        rx: r.width ? ((e.clientX - r.left) / r.width) * 1000 : 500,
        ry: r.height ? ((e.clientY - r.top) / r.height) * 1000 : 500,
        x: (e.pageX / Math.max(doc.scrollWidth, 1)) * 1000,
        y: e.pageY,
        l: current.current.startsWith("/checkout") ? null : labelFor(target),
      });
    };
    document.addEventListener("click", onClick, { capture: true, passive: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, [allowed]);

  return null;
}
