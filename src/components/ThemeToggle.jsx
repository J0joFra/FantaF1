import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

function getInitial() {
  if (typeof window === "undefined") return false;
  try {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export default function ThemeToggle() {
  const [dark, setDark] = useState(getInitial);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch { /* ignore */ }
  }, [dark]);

  return (
    <button
      onClick={() => setDark(d => !d)}
      title={dark ? "Tema chiaro" : "Tema scuro"}
      aria-label="Cambia tema"
      className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-muted-foreground border border-gray-200 active:scale-95 transition-transform"
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
