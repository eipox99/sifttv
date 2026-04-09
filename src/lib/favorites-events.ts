export const FAVORITES_UPDATED_EVENT = "favorites-updated";

export function emitFavoritesUpdated() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(FAVORITES_UPDATED_EVENT));
}
