"use client";

import { signIn, signOut, useSession } from "next-auth/react";

type SessionControlsProps = {
  authReady: boolean;
};

export function SessionControls({ authReady }: SessionControlsProps) {
  const { data: session, status } = useSession();

  if (!authReady) {
    return <div className="pill">Sign-in is not configured</div>;
  }

  if (status === "loading") {
    return <div className="pill">Checking session</div>;
  }

  if (!session?.user) {
    return (
      <button className="button button-primary" onClick={() => signIn("twitch")}>
        Sign in with Twitch
      </button>
    );
  }

  return (
    <div className="session-box">
      <div>
        <div className="session-label">Signed in</div>
        <div className="session-name">{session.user.name ?? "Twitch user"}</div>
      </div>
      <button className="button button-secondary" onClick={() => signOut()}>
        Sign out
      </button>
    </div>
  );
}
