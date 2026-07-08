"use client";

import { use } from "react";
import { StreamPlayerModal } from "@/components/stream-player";

export default function WatchPage({ params }: { params: Promise<{ login: string }> }) {
  const { login } = use(params);

  return (
    <StreamPlayerModal
      target={{ login, displayName: login, url: `https://www.twitch.tv/${login}` }}
      onClose={() => {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.close();
        }
      }}
      standalone
    />
  );
}
