import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import { X, Flag } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { format } from "date-fns";

// Fix Leaflet icon paths in Vite
import L from "leaflet";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: "", iconUrl: "", shadowUrl: "" });

export default function SeasonMapModal({ races = [], open, onClose }) {
  const { t } = useI18n();
  const mapRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const next = races.find(r => !r.isPast);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[200] flex flex-col"
          style={{ background: "#01161E" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 shrink-0"
               style={{ background: "linear-gradient(to right, #E8002D, #C20028)" }}>
            <div>
              <h2 className="font-heading font-black text-white text-lg uppercase tracking-wide leading-none">
                {t("map_title")}
              </h2>
              <p className="text-white/70 text-[11px] font-body mt-0.5">
                {races.filter(r => r.isPast).length} / {races.length} GP
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/15 border border-white/25 flex items-center justify-center text-white active:scale-95 transition-transform"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Map */}
          <div className="flex-1 relative">
            <MapContainer
              center={[25, 10]}
              zoom={2}
              minZoom={1}
              maxZoom={5}
              style={{ height: "100%", width: "100%", background: "#0a2030" }}
              zoomControl={false}
              attributionControl={false}
              ref={mapRef}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
                subdomains="abcd"
              />

              {races.map((race) => {
                const isNext = race.id === next?.id;
                const color = race.isPast ? "#598392" : isNext ? "#E8002D" : "#AEC3B0";
                const radius = isNext ? 10 : 7;

                return (
                  <CircleMarker
                    key={race.id}
                    center={[race.lat, race.lng]}
                    radius={radius}
                    pathOptions={{
                      color: isNext ? "#fff" : color,
                      weight: isNext ? 2 : 1,
                      fillColor: color,
                      fillOpacity: race.isPast ? 0.55 : 1,
                    }}
                  >
                    <Popup className="f1-map-popup">
                      <div className="text-center py-1 px-0.5">
                        <p className="font-heading font-black text-sm leading-tight">
                          {race.isPast ? "✓" : isNext ? "▶" : ""} {race.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{race.place}</p>
                        <p className="text-xs font-semibold mt-1">
                          Round {race.round} · {format(new Date(race.date), "d MMM yyyy")}
                        </p>
                        {race.isPast && (
                          <span className="inline-block mt-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            {t("map_completed")}
                          </span>
                        )}
                        {isNext && (
                          <span className="inline-block mt-1 text-[10px] font-bold text-red-500 uppercase tracking-wider">
                            {t("map_next")}
                          </span>
                        )}
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>

            {/* Legend */}
            <div className="absolute bottom-4 left-4 z-[400] flex flex-col gap-1.5 bg-black/60 backdrop-blur-sm rounded-xl px-3 py-2.5">
              <LegendItem color="#E8002D" label={t("map_next")} />
              <LegendItem color="#AEC3B0" label={t("map_upcoming")} />
              <LegendItem color="#598392" label={t("map_past")} opacity={0.55} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function LegendItem({ color, label, opacity = 1 }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color, opacity }} />
      <span className="text-[11px] text-white/80 font-body">{label}</span>
    </div>
  );
}
