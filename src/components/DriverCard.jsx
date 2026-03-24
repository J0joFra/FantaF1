/**
 * DriverCard — card pilota selezionabile nella pagina Pick GP
 * Mostra numero, iniziali, nome, team e un indicatore colore.
 */
export default function DriverCard({ driver, selected, onSelect, disabled }) {
  const initials = driver.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <button
      onClick={() => !disabled && onSelect(driver)}
      disabled={disabled}
      className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left
        ${selected
          ? 'border-red-500 bg-red-500/10'
          : 'border-white/5 bg-[#1a1a1a] hover:border-white/15 hover:bg-white/[0.03]'
        }
        ${disabled ? 'opacity-40 cursor-not-allowed scale-95' : 'cursor-pointer active:scale-[0.98]'} `}
    >
      {/* Numero + colore laterale */}
      <div
        className="w-1 self-stretch rounded-full shrink-0"
        style={{ backgroundColor: driver.color }}
      />

      {/* Avatar iniziali */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0"
        style={{ backgroundColor: driver.color + '33', color: driver.color }}
      >
        {initials}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">{driver.id}</p>
        <p className="font-black text-white uppercase truncate">{driver.name.split(' ').slice(-1)[0]}</p>
        <p className="text-xs text-zinc-600">{driver.team}</p>
      </div>

      {/* Numero */}
      <span className="text-zinc-700 font-black text-lg tabular-nums shrink-0">
        {driver.number}
      </span>

      {selected && (
        <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center shrink-0">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
            <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}
    </button>
  );
}
