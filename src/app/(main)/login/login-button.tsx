"use client";

import { signIn } from "next-auth/react";

export default function LoginButton() {
  return (
    <button className="button button-primary" onClick={() => signIn("twitch")}>
      Continue with Twitch
    </button>
  );
}

