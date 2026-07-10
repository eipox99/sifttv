import { DefaultSession, NextAuthConfig } from "next-auth";
import NextAuth from "next-auth";
import Twitch from "next-auth/providers/twitch";

import { env, hasAuthRuntimeConfig, hasTwitchClientCredentials } from "@/lib/env";
import { refreshAccessTokenFromRefreshToken } from "@/lib/twitch";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      legacyId?: string;
    };
  }
}

export const authConfig: NextAuthConfig = {
  secret: env.AUTH_SECRET,
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: hasTwitchClientCredentials()
    ? [
        Twitch({
          clientId: env.TWITCH_CLIENT_ID ?? "",
          clientSecret: env.TWITCH_CLIENT_SECRET ?? "",
          authorization: {
            params: {
              scope: "openid user:read:email user:read:follows",
              claims: {
                id_token: {
                  email: null,
                  picture: null,
                  preferred_username: null
                }
              }
            }
          }
        })
      ]
    : [],
  callbacks: {
    async jwt({ token, account, user }) {
      if (account?.provider === "twitch") {
        const twitchUserId = account.providerAccountId;
        if (user?.id && user.id !== twitchUserId) {
          token.legacyId = user.id;
        }
        token.sub = twitchUserId;
        token.twitchUserId = twitchUserId;
        token.twitchAccessToken = account.access_token;
        token.twitchRefreshToken = account.refresh_token;
        token.twitchAccessTokenExpiresAt = account.expires_at;
      }

      if (!token.twitchAccessTokenExpiresAt || !token.twitchRefreshToken) {
        return token;
      }

      const now = Math.floor(Date.now() / 1000);
      if (token.twitchAccessTokenExpiresAt > now + 60) {
        return token;
      }

      try {
        const refreshed = await refreshAccessTokenFromRefreshToken(token.twitchRefreshToken);
        token.twitchAccessToken = refreshed.accessToken;
        token.twitchAccessTokenExpiresAt = refreshed.expiresAt;
        token.twitchRefreshToken = refreshed.refreshToken ?? token.twitchRefreshToken;
        token.twitchAuthError = undefined;
      } catch {
        token.twitchAuthError = "RefreshAccessTokenError";
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        if (token.legacyId) {
          session.user.legacyId = token.legacyId as string;
        }
      }

      return session;
    }
  },
  trustHost: true
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
