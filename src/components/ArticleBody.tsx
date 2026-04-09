"use client";

import { useEffect, useRef } from "react";

// Renders WP article HTML and makes its embedded <script> tags actually run.
// Browsers do NOT execute <script> elements inserted via innerHTML, so after
// React mounts the markup we walk the body, replace every <script> with a
// freshly created element (which the parser will execute), and ping the
// well-known social embed SDKs so blockquotes get processed even when the SDK
// was already loaded by an earlier article in the same session.
type SocialGlobals = {
  twttr?: { widgets?: { load?: (el?: Element | null) => void } };
  instgrm?: { Embeds?: { process?: () => void } };
  FB?: { XFBML?: { parse?: (el?: Element | null) => void } };
};

export default function ArticleBody({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    // Re-create every <script> in the article body so the browser executes it.
    // External scripts (with `src`) are deduped across the page so we don't
    // pull the same SDK twice within one session.
    const scripts = Array.from(root.querySelectorAll("script"));
    for (const old of scripts) {
      const src = old.getAttribute("src");
      if (src) {
        const dedupeAttr = `data-article-script`;
        const already = document.querySelector(
          `script[${dedupeAttr}="${cssEscape(src)}"]`,
        );
        if (already) {
          old.remove();
          continue;
        }
        const fresh = document.createElement("script");
        for (const { name, value } of Array.from(old.attributes)) {
          fresh.setAttribute(name, value);
        }
        fresh.setAttribute(dedupeAttr, src);
        old.parentNode?.replaceChild(fresh, old);
      } else {
        // Inline script — always re-execute (cheap, no network).
        const fresh = document.createElement("script");
        for (const { name, value } of Array.from(old.attributes)) {
          fresh.setAttribute(name, value);
        }
        fresh.textContent = old.textContent ?? "";
        old.parentNode?.replaceChild(fresh, old);
      }
    }

    // Many social SDKs only auto-scan the DOM at first load. If the user is
    // navigating client-side from another article that already loaded the
    // SDK, those new blockquotes won't be processed unless we ping the SDK.
    // Defer one tick so any freshly-injected <script> has a chance to set
    // up its globals first.
    const t = window.setTimeout(() => {
      const w = window as unknown as SocialGlobals;
      w.twttr?.widgets?.load?.(root);
      w.instgrm?.Embeds?.process?.();
      w.FB?.XFBML?.parse?.(root);
    }, 250);

    return () => window.clearTimeout(t);
  }, [html]);

  return (
    <div
      ref={ref}
      className="article-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Minimal CSS attribute-selector escape so srcs containing quotes/colons are
// safe inside `[attr="..."]`. document.querySelector chokes on raw URLs.
function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}
