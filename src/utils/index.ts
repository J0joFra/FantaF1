import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina classi Tailwind eliminando conflitti.
 * Uso: cn('px-4 py-2', condition && 'bg-red-600', className)
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Formatta una data in italiano.
 * format: 'short' → "29 mar" | 'long' → "29 marzo 2026"
 */
export function formatDate(dateStr, format = 'short') {
  const d = new Date(dateStr);
  if (format === 'long') {
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

/**
 * Calcola il countdown a una data futura.
 * Ritorna { gg, hh, mm, ss, expired }
 */
export function getCountdown(targetDateStr) {
  const diff = new Date(targetDateStr) - new Date();
  if (diff <= 0) return { gg: '00', hh: '00', mm: '00', ss: '00', expired: true };
  return {
    gg: String(Math.floor(diff / 86400000)).padStart(2, '0'),
    hh: String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0'),
    mm: String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0'),
    ss: String(Math.floor((diff % 60000) / 1000)).padStart(2, '0'),
    expired: false,
  };
}

/**
 * Converte un nome team in un id slug.
 * es. "Red Bull" → "red-bull"
 */
export function teamSlug(teamName) {
  return (teamName || '').toLowerCase().replace(/\s+/g, '-');
}

/**
 * Tronca una stringa a n caratteri aggiungendo "…"
 */
export function truncate(str, n = 20) {
  return str?.length > n ? str.slice(0, n) + '…' : str;
}
