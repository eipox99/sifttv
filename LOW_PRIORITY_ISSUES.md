# Low Priority / Polish Backlog

These are the remaining low-severity issues from the code review. Critical, high, and
medium items have already been fixed. Items below are safe to defer and can be picked up
opportunistically.

## Security / correctness

### L1. Preferences endpoints are unauthenticated
- **File:** `src/app/api/preferences/route.ts` (GET line ~20, PATCH line ~34)
- **Issue:** The "owner" is identified only by the `twitch_low_high_owner` cookie (a plain
  UUID). Anyone can forge/replay a UUID to read or overwrite another anonymous user's
  preferences.
- **Impact:** Low — preferences are non-sensitive and normalized downstream.
- **Fix:** Sign the cookie (e.g. `jose`) or bind preferences to the authenticated Twitch
  user when a session exists. Document that anonymous prefs are best-effort otherwise.

### L2. `STREAMLINK_BIN` bypasses the validated env
- **File:** `src/lib/streamlink.ts:3`
- **Issue:** Reads `process.env.STREAMLINK_BIN` directly instead of going through the zod
  schema in `src/lib/env.ts`.
- **Fix:** Add `STREAMLINK_BIN: z.string().min(1).default("streamlink")` to `envSchema`
  and consume `env.STREAMLINK_BIN`.

### L3. No CSRF token on state-changing endpoints
- **Files:** `src/app/api/favorites/route.ts` (POST), `src/app/api/favorites/[channelId]/route.ts`
  (DELETE), `src/app/api/categories/[categoryId]/refresh/route.ts` (POST),
  `src/app/api/preferences/route.ts` (PATCH)
- **Issue:** Auth relies on the session cookie with `SameSite=Lax`; cross-origin POST/PATCH/DELETE
  could still be triggered in some browsers.
- **Fix:** Add NextAuth CSRF protection or a double-submit cookie for mutations.

## Database / dead code

### L4. Dual database layers
- **Files:** `src/lib/local-store.ts:104`, `prisma/schema.prisma:8`
- **Issue:** Prisma (NextAuth tables) and `node:sqlite` (app data) both target the same
  SQLite file. If `DATABASE_URL` is unset, Prisma fails while `node:sqlite` silently
  defaults to `prisma/dev.db`.
- **Fix:** Document the split clearly, or consolidate on one layer. Consider failing fast
  when `DATABASE_URL` is missing.

### L5. Dead `Favorite` Prisma model
- **File:** `prisma/schema.prisma:58-73`
- **Issue:** The Prisma `Favorite` model is never used; all favorites go through
  `node:sqlite`.
- **Fix:** Remove the model (or migrate favorites to Prisma).

### L6. Runtime schema mutation is injection-shaped
- **File:** `src/lib/local-store.ts:224-232` (`ensureColumnExists`)
- **Issue:** Interpolates `tableName`/`columnName`/`definition` into `PRAGMA`/`ALTER TABLE`.
  Currently only called with hardcoded literals, so no live risk.
- **Fix:** Whitelist-validate identifiers, or move to a real migration tool.

### L7. Sequential single-row snapshot inserts
- **File:** `src/lib/local-store.ts:740-758` (`createSnapshotWithStreams`)
- **Issue:** Inserts stream rows one at a time (inside a transaction).
- **Fix:** Batch into multi-row `INSERT ... VALUES` for very large categories. Measure
  first — likely negligible.

## Auth

### L8. Silent Twitch token-refresh failure
- **File:** `src/lib/auth.ts:69-71`
- **Issue:** `token.twitchAuthError` is set on refresh failure but never surfaced; the user
  just gets a generic 401 later.
- **Fix:** Propagate to `session.error` and prompt re-auth in the UI.

### L9. `AUTH_SECRET` optional while auth is enabled
- **File:** `src/lib/env.ts:9`
- **Issue:** If Twitch creds are set but `AUTH_SECRET` is missing, NextAuth may generate a
  random per-restart secret, invalidating sessions.
- **Fix:** `.refine()` the schema to require `AUTH_SECRET` when Twitch creds are present.

## Resource management

### L10. No graceful shutdown for worker / Redis
- **Files:** `scripts/worker.ts:4-13`, `src/lib/jobs.ts:8-55`
- **Issue:** No SIGTERM/SIGINT handling; jobs can be left RUNNING and the Redis connection
  isn't closed cleanly.
- **Fix:**
  ```ts
  const shutdown = async () => { await worker.close(); process.exit(0); };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  ```

## API design

### L11. DELETE favorite always returns `{ ok: true }`
- **File:** `src/app/api/favorites/[channelId]/route.ts:18-20`
- **Issue:** No indication when nothing was deleted.
- **Fix:** Have `deleteFavorite` return `.changes` and respond 404 when zero rows affected.

### L12. Ambiguous 404 vs 502 on category refresh
- **File:** `src/app/api/categories/[categoryId]/refresh/route.ts:19-23`
- **Issue:** A transient Twitch failure during name resolution returns 404, same as a truly
  unknown category.
- **Fix:** Return 502 for upstream failures, 404 only for confirmed-missing categories.

### L13. Fragile boolean parsing
- **File:** `src/app/api/categories/[categoryId]/streams/route.ts:30-32`
- **Issue:** `parseBoolean` only matches `"true"`.
- **Fix:** `return value === "true" || value === "1";`

## UX / accessibility polish

### L14. Missing form labels
- **Files:** `src/components/search-explorer.tsx` (search input),
  `src/components/category-explorer.tsx` (language `<select>` — has `aria-label` but no
  visible label).
- **Fix:** Add visible `<label>` elements (or at least `aria-label` on the search input).

### L15. Thumbnails lack `loading="lazy"`
- **Files:** `src/components/stream-card.tsx:25`, `src/components/category-card.tsx:12`,
  `src/components/search-explorer.tsx`, `src/components/app-sidebar.tsx`
- **Fix:** Add `loading="lazy"` to below-the-fold `<img>` tags.

### L16. Long stream lists are not virtualized
- **File:** `src/components/category-explorer.tsx` (grid render ~line 530)
- **Issue:** Infinite scroll keeps all cards mounted (180+ after several pages).
- **Fix:** Use `@tanstack/react-virtual` or `react-window` for the stream grid.

### L17. Player chat iframe has no loading/blocked fallback
- **File:** `src/components/stream-player.tsx` (chat iframe)
- **Issue:** If Twitch blocks the embed, users see a blank panel.
- **Fix:** Add a loading placeholder and an `onError`/timeout fallback message with a link
  to open chat on Twitch.

### L18. Player volume/mute not persisted
- **File:** `src/components/stream-player.tsx` (`<video>`)
- **Fix:** Persist `volume`/`muted` to `localStorage` and restore on open.

### L19. Player has no Picture-in-Picture / minimize
- **File:** `src/components/stream-player.tsx`
- **Fix:** Add a PiP toggle (`requestPictureInPicture`) or a dockable mini-player so the
  user can keep browsing.

### L20. "Remove favorite" has no confirmation
- **File:** `src/components/favorites-page.tsx`
- **Fix:** Add a confirm step or an undo toast.

### L21. `formatDateTime` can render "Invalid Date"
- **File:** `src/lib/formatters.ts` (used at `category-explorer.tsx` ~line 512)
- **Fix:** Guard against `NaN` dates and return a fallback string.

### L22. Category explorer runs two effects on sort change
- **File:** `src/components/category-explorer.tsx` (the two effects keyed on `sort`)
- **Issue:** Both effects run on `sort` change (one early-returns). Minor waste.
- **Fix:** Consider merging into one effect that switches on `sort`.
