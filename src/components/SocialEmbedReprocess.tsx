"use client";

import { useEffect } from "react";

// After client-side navigation, third-party social SDKs that were already
// loaded by an earlier page won't auto-scan the new DOM. Call each provider's
// reprocess hook on mount so embeds always render. Safe to call when the SDK
// hasn't loaded yet — the calls just no-op.
type Provider = "twitter" | "instagram" | "tiktok" | "facebook";

declare global {
  interface Window {
    twttr?: { widgets?: { load?: (el?: Element | null) => void } };
    instgrm?: { Embeds?: { process?: () => void } };
    FB?: { XFBML?: { parse?: (el?: Element | null) => void } };
  }
}

export default function SocialEmbedReprocess({
  providers,
}: {
  providers: Provider[];
}) {
  useEffect(() => {
    if (!providers.length) return;
    // Defer one tick so the embed markup from dangerouslySetInnerHTML is in
    // the DOM before the SDKs scan for it.
    const id = window.setTimeout(() => {
      if (providers.includes("twitter")) {
        window.twttr?.widgets?.load?.();
      }
      if (providers.includes("instagram")) {
        window.instgrm?.Embeds?.process?.();
      }
      if (providers.includes("facebook")) {
        window.FB?.XFBML?.parse?.();
      }
      // TikTok's embed.js processes once on script load and exposes no
      // re-process API. A full reload is the only reliable way to refresh it
      // mid-session — acceptable since users rarely navigate between many
      // TikTok-embed articles in one session.
    }, 0);
    return () => window.clearTimeout(id);
  }, [providers]);

  return null;
}
