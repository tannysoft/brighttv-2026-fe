"use client";

import { useEffect } from "react";

/** Counts one view of a story (lib/views.ts), once per page load. */
export default function ViewBeacon({ id }: { id: number }) {
  useEffect(() => {
    const body = JSON.stringify({ id });
    if (!navigator.sendBeacon?.("/api/views", new Blob([body], { type: "application/json" })))
      fetch("/api/views", { method: "POST", body, keepalive: true }).catch(() => {});
  }, [id]);
  return null;
}
