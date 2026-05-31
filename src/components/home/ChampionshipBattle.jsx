import { motion } from "framer-motion";
import { getTeamColor, calculateMaxAvailablePoints, isMathematicallyEliminated } from "@/lib/f1Utils";
import { Trophy, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

function DriverRow({ driver, leader, maxAvailable, index }) {
  const isLeader   = index === 0;
  const color      = getTeamColor(driver.team);
  const gap        = leader.points - driver.points;
  const eliminated = !isLeader && isMathematicallyEliminated(driver.points, leader.points, maxAvailable);

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`flex items-center gap-4 py-3.5
        ${index > 0 ? "border-t border-gray-100" : ""}
        ${isLeader ? "accent-bar" : ""}`}
    >
      <span className={`w-6 text-center font-heading font-black text-lg shrink-0
        ${isLeader ? "text-primary" : "text-gray-300"}`}>
        {driver.position}
      </span>
      <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center
                      font-heading font-black text-sm text-white"
           style={{ background: `linear-gradient(135deg, ${color}bb, ${color})` }}>
        {driver.driver_code?.slice(0,3) || driver.driver_name.slice(0,2).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-heading font-black text-base leading-tight truncate
          ${eliminated ? "line-through text-gray-300" : ""}`}>
          {driver.driver_name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <p className="text-xs text-muted-foreground font-body truncate">{driver.team}</p>
          {eliminated && (
            <span className="tag bg-red-50 text-red-400 border border-red-100">OUT</span>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <span className="font-heading font-black text-xl leading-none">{driver.points}</span>
        <p className="text-[10px] text-muted-foreground font-body mt-0.5">
          {isLeader ? "PTI" : `−${gap}`}
        </p>
      </div>
    </motion.div>
  );
}

export default function ChampionshipBattle({ drivers, config }) {
  if (!drivers?.length) return null;
  const leader       = drivers[0];
  const maxAvailable = calculateMaxAvailablePoints(config);

  return (
    <div className="app-card overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" strokeWidth={2} />
          <h2 className="font-heading font-black text-base uppercase tracking-wide">Classifica Piloti</h2>
        </div>
        <Link to="/calculator" className="flex items-center gap-0.5 text-xs text-primary font-body font-semibold">
          Scenari <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="px-4">
        {drivers.slice(0, 8).map((d, i) => (
          <DriverRow key={d.id} driver={d} leader={leader} maxAvailable={maxAvailable} index={i} />
        ))}
      </div>
    </div>
  );
}
