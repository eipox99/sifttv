"use client";

import { useEffect, useRef } from "react";

type IframeWithCredentialless = HTMLIFrameElement & { credentialless?: boolean };

export function credentiallessSupported() {
  return (
    typeof HTMLIFrameElement !== "undefined" && "credentialless" in HTMLIFrameElement.prototype
  );
}

type ChatEmbedProps = {
  src: string;
  anonymous: boolean;
  title: string;
};

// Renders the Twitch chat embed. When `anonymous` is true, the iframe is loaded
// as `credentialless` so it starts from an empty cookie jar (no Twitch login),
// letting you read chat without appearing as yourself. The `src` is assigned
// imperatively so `credentialless` is applied before the iframe navigates.
export function ChatEmbed({ src, anonymous, title }: ChatEmbedProps) {
  const ref = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const iframe = ref.current as IframeWithCredentialless | null;
    if (!iframe) {
      return;
    }

    try {
      iframe.credentialless = anonymous;
    } catch {
      // Attribute unsupported in this browser; falls back to a normal load.
    }

    iframe.src = src;
  }, [src, anonymous]);

  return <iframe ref={ref} className="player-chat" title={title} />;
}
