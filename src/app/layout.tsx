import type { Metadata } from "next";
import Script from "next/script";

import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { Providers } from "@/components/providers";
import { auth } from "@/lib/auth";
import { hasAuthRuntimeConfig } from "@/lib/env";

import "./globals.css";

export const metadata: Metadata = {
  title: "Twitch Low High",
  description: "Standalone Twitch live browsing with exact low-to-high category snapshots."
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authReady = hasAuthRuntimeConfig();
  const session = authReady ? await auth() : null;

  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(() => {
            try {
              const theme = localStorage.getItem("theme-mode") === "light" ? "light" : "dark";
              document.documentElement.dataset.theme = theme;
              document.documentElement.style.colorScheme = theme;
            } catch {
              document.documentElement.dataset.theme = "dark";
              document.documentElement.style.colorScheme = "dark";
            }
          })();`}
        </Script>
        <Providers session={session}>
          <div className="app-shell">
            <AppHeader authReady={authReady} />
            <div className="app-content">
              <AppSidebar authReady={authReady} />
              <main className="page-shell">{children}</main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
