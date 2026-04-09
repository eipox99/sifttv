# Twitch Low High

Standalone Twitch live discovery app focused on exact low-to-high browsing for categories like Just Chatting.

## Stack

- Next.js App Router
- TypeScript
- Auth.js with Twitch OAuth
- Local SQLite storage via `node:sqlite`
- BullMQ + Redis for background refresh jobs

## Environment

Copy `.env.example` to `.env` and fill in:

- `TWITCH_CLIENT_ID`
- `TWITCH_CLIENT_SECRET`
- `AUTH_SECRET`
- `APP_URL`
- `TWITCH_REDIRECT_URI`

Optional:

- `DATABASE_URL` to override the default SQLite file location
- `REDIS_URL` to run background refresh jobs through BullMQ
- `INLINE_REFRESH_JOBS=true` to run refresh jobs inline during development when Redis is not configured
- `TWITCH_MAX_CRAWL_PAGES=0` for unlimited pages, or a positive integer to cap crawls

## Twitch app setup

Create an app at <https://dev.twitch.tv/console/apps> with:

- OAuth Redirect URL: `http://localhost:3000/api/auth/callback/twitch`
- Category: `Website Integration`

Provide the generated `Client ID` and `Client Secret` in the environment file.

## Database

This project uses SQLite by default and creates the database file automatically at `prisma/dev.db`.

## Running

App only:

```bash
npm run dev
```

App with a separate queue worker:

```bash
npm run dev
npm run worker
```

If `REDIS_URL` is unset and `INLINE_REFRESH_JOBS=true`, refresh jobs run inline inside the web process for local development.
The SQLite file is stored at `prisma/dev.db`.

## Notes

- Twitch OAuth reuses the browser's existing Twitch login session when possible, but it still goes through Twitch's official consent flow.
- Twitch does not offer ascending viewer sorting through Helix. Exact low-to-high requires crawling pages, deduplicating, and sorting a completed snapshot locally.
