// "Del cuore" — the user's favourite driver and favourite team, kept per-device
// in localStorage (wrapped so private browsing / blocked storage never throws).
// A custom event keeps every mounted component in sync when it changes.
import { useEffect, useState } from "react";

function make(KEY, EVT) {
  const get = () => { try { return localStorage.getItem(KEY) || null; } catch { return null; } };
  const set = (id) => {
    try {
      if (id) localStorage.setItem(KEY, id);
      else localStorage.removeItem(KEY);
    } catch { /* ignore */ }
    try { window.dispatchEvent(new CustomEvent(EVT, { detail: id || null })); } catch { /* ignore */ }
  };
  const useHook = () => {
    const [v, setV] = useState(get);
    useEffect(() => {
      const onEvt = (e) => setV(e?.detail ?? get());
      const onStorage = (e) => { if (e.key === KEY) setV(get()); };
      window.addEventListener(EVT, onEvt);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(EVT, onEvt);
        window.removeEventListener("storage", onStorage);
      };
    }, []);
    const toggle = (id) => set(get() === id ? null : id);
    return { fav: v, toggle, isFav: (id) => !!id && v === id };
  };
  return { get, set, useHook };
}

// ── Favourite driver ──
const driver = make("gridup_fav_driver", "gridup:fav");
export const getFav = driver.get;
export const setFav = driver.set;
export const useFavourite = driver.useHook;

// ── Favourite team ──
const team = make("gridup_fav_team", "gridup:favteam");
export const getFavTeam = team.get;
export const setFavTeam = team.set;
export const useFavouriteTeam = team.useHook;
