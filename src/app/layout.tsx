import type { Metadata } from "next";

import { Providers } from "@/components/providers";
import { auth } from "@/lib/auth";
import { hasAuthRuntimeConfig } from "@/lib/env";
import { getServerAppPreferences } from "@/lib/preferences";

import "./globals.css";

export const metadata: Metadata = {
  title: "SiftTV",
  description: "Standalone Twitch live browsing with exact low-to-high category snapshots."
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authReady = hasAuthRuntimeConfig();
  const session = authReady ? await auth() : null;
  const preferences = await getServerAppPreferences();

  return (
    <html
      lang="en"
      data-theme={preferences.themeMode}
      style={{ colorScheme: preferences.themeMode }}
      suppressHydrationWarning
    >
      <body>
        <Providers
          session={session}
          playbackPreferences={{
            playbackEngine: preferences.playbackEngine,
            lowLatencyAutoFallback: preferences.lowLatencyAutoFallback,
            lowLatencyCatchUp: preferences.lowLatencyCatchUp,
            autoOpenChat: preferences.autoOpenChat,
            chatAutoLogin: preferences.chatAutoLogin,
            hoverPreview: preferences.hoverPreview,
            mpegtsLowLatency: preferences.mpegtsLowLatency,
            openInNewTab: preferences.openInNewTab
          }}
        >
          {children}
        </Providers>
      </body>
    </html>
  );
}
