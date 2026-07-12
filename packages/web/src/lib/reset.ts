import { useStore } from "../store/store.js";

/** Wipe all persisted Swaggy data and reload into a pristine initial state. Clearing the
 * persisted store then navigating to the bare path (dropping any `?op=` selection) means the
 * app boots exactly as a first-time visit would. */
export function hardResetApp(): void {
  useStore.persist.clearStorage();
  window.location.href = window.location.pathname;
}
