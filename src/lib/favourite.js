// "Pilota del cuore" — the user's favourite driver, kept per-device in
// localStorage (wrapped so private browsing / blocked storage never throws).
// A custom event keeps every mounted component in sync when it changes.
import { useEffect, useState } from "react";

const KEY = "gridup_fav_driver";
const EVT = "gridup:fav";

export function getFav() {
  try { return localStorage.getItem(KEY) || null; } catch { return null; }
}

export function setFav(id) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  try { window.dispatchEvent(new CustomEvent(EVT, { detail: id || null })); } catch { /* ignore */ }
}

// Hook: { fav, toggle, isFav }. Re-renders when the favourite changes anywhere
// (another row, the driver page, or another tab via the storage event).
export function useFavourite() {
  const [fav, setFavState] = useState(getFav);
  useEffect(() => {
    const onEvt = (e) => setFavState(e?.detail ?? getFav());
    const onStorage = (e) => { if (e.key === KEY) setFavState(getFav()); };
    window.addEventListener(EVT, onEvt);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVT, onEvt);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const toggle = (id) => setFav(getFav() === id ? null : id);
  return { fav, toggle, isFav: (id) => !!id && fav === id };
}
