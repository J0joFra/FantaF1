import { useState, useEffect } from 'react';

export default function GpCountdown({ targetDate }) {
  const [time, setTime] = useState({ gg: '00', hh: '00', mm: '00', ss: '00', expired: false });

  useEffect(() => {
    const target = new Date(targetDate);

    const tick = () => {
      const diff = target - new Date();
      if (diff <= 0) {
        setTime({ gg: '00', hh: '00', mm: '00', ss: '00', expired: true });
        return;
      }
      setTime({
        gg: String(Math.floor(diff / 86400000)).padStart(2, '0'),
        hh: String(Math.floor((diff % 86400000) / 3600000)).padStart(2, '0'),
        mm: String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0'),
        ss: String(Math.floor((diff % 60000) / 1000)).padStart(2, '0'),
        expired: false,
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  if (time.expired) {
    return <p className="text-red-500 font-black text-sm uppercase tracking-widest">Pick chiusi</p>;
  }

  return (
    <div className="flex items-center gap-2">
      {[
        { val: time.gg, label: 'GG' },
        { val: time.hh, label: 'HH' },
        { val: time.mm, label: 'MM' },
        { val: time.ss, label: 'SS' },
      ].map(({ val, label }, i) => (
        <div key={label} className="flex items-center gap-2">
          {i > 0 && <span className="text-red-500 font-black text-xl">:</span>}
          <div className="flex flex-col items-center">
            <span className="bg-[#1a1a1a] text-red-500 font-black text-xl tabular-nums w-12 h-12 flex items-center justify-center rounded-xl">
              {val}
            </span>
            <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest mt-1">{label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
