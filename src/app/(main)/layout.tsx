import { AppHeader } from "@/components/app-header";
import { AppSidebar } from "@/components/app-sidebar";
import { auth } from "@/lib/auth";
import { hasAuthRuntimeConfig } from "@/lib/env";
import { getServerAppPreferences } from "@/lib/preferences";

export default async function MainLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const authReady = hasAuthRuntimeConfig();
  const session = authReady ? await auth() : null;
  const preferences = await getServerAppPreferences();

  return (
    <div className="app-shell">
      <AppHeader authReady={authReady} initialThemeMode={preferences.themeMode} />
      <div className="app-content">
        <AppSidebar authReady={authReady} />
        <main className="page-shell">{children}</main>
      </div>
    </div>
  );
}
