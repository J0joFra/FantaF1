import { useEffect, useState } from 'react';

/**
 * Ritorna true se la larghezza della finestra è < 768px (breakpoint md di Tailwind).
 * Si aggiorna al resize.
 */
export function useMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);

  return isMobile;
}
