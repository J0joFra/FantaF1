// Supabase Edge Function: send-race-reminders
// Runs on a schedule (pg_cron, see docs/web-push-notifiche.md). Each run checks
// whether the next Grand Prix has a session (qualifying / sprint / race) starting
// ~1 hour from now and, if so, sends a Web Push to every stored subscription.
// A row in `sent_reminders` guarantees each reminder goes out exactly once.
//
// Required secrets (set with `supabase secrets set`):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:you@example.com)
// Auto-provided by the platform: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

// Reminder fires this many minutes before a session; the run window must be
// >= the cron interval so exactly one run falls inside it.
const LEAD_MINUTES = 60;
const WINDOW_MINUTES = 30;

// Only these sessions get a reminder (skip free practice).
const REMINDED = ["quali", "sprint", "race"] as const;

const MESSAGES: Record<string, Record<string, { title: string; body: string }>> = {
  it: {
    quali:  { title: "🏁 Qualifiche tra 1 ora", body: "{gp}: le qualifiche stanno per iniziare" },
    sprint: { title: "🏁 Sprint tra 1 ora",     body: "{gp}: la Sprint sta per iniziare" },
    race:   { title: "🏎️ Gara tra 1 ora",       body: "{gp}: si parte tra poco!" },
  },
  en: {
    quali:  { title: "🏁 Qualifying in 1 hour", body: "{gp}: qualifying is about to start" },
    sprint: { title: "🏁 Sprint in 1 hour",     body: "{gp}: the Sprint is about to start" },
    race:   { title: "🏎️ Race in 1 hour",       body: "{gp}: lights out soon!" },
  },
  fr: {
    quali:  { title: "🏁 Qualifs dans 1 heure", body: "{gp} : les qualifications vont commencer" },
    sprint: { title: "🏁 Sprint dans 1 heure",  body: "{gp} : le Sprint va commencer" },
    race:   { title: "🏎️ Course dans 1 heure",  body: "{gp} : c'est bientôt le départ !" },
  },
  es: {
    quali:  { title: "🏁 Clasificación en 1 hora", body: "{gp}: la clasificación está por empezar" },
    sprint: { title: "🏁 Sprint en 1 hora",        body: "{gp}: el Sprint está por empezar" },
    race:   { title: "🏎️ Carrera en 1 hora",       body: "{gp}: ¡pronto la salida!" },
  },
  de: {
    quali:  { title: "🏁 Qualifying in 1 Stunde", body: "{gp}: das Qualifying beginnt gleich" },
    sprint: { title: "🏁 Sprint in 1 Stunde",     body: "{gp}: der Sprint beginnt gleich" },
    race:   { title: "🏎️ Rennen in 1 Stunde",     body: "{gp}: gleich geht's los!" },
  },
};

function msg(lang: string, key: string, gp: string) {
  const pack = MESSAGES[lang] || MESSAGES.it;
  const m = pack[key] || MESSAGES.it[key];
  return { title: m.title, body: m.body.replace("{gp}", gp || "F1") };
}

const toUtc = (d: string, t: string | null) =>
  new Date(`${d}T${(t || "00:00").slice(0, 5)}:00Z`);

Deno.serve(async () => {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const subject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@fantaf1.app";

  if (!publicKey || !privateKey) {
    return json({ ok: false, error: "VAPID keys not configured" }, 500);
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const season = new Date().getUTCFullYear();
  const today = new Date().toISOString().slice(0, 10);

  // Next upcoming race with its per-session dates/times.
  const { data: races, error: raceErr } = await supabase
    .from("race")
    .select(
      "round, year, date, time, grand_prix_id, sprint_race_date, sprint_race_time, qualifying_date, qualifying_time",
    )
    .eq("year", season)
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(1);

  if (raceErr) return json({ ok: false, error: raceErr.message }, 500);
  if (!races || !races.length) return json({ ok: true, note: "no upcoming race" });

  const r = races[0];

  // GP display name (best effort).
  let gpName = "";
  if (r.grand_prix_id) {
    const { data: gp } = await supabase
      .from("grand_prix").select("name").eq("id", r.grand_prix_id).limit(1);
    gpName = gp?.[0]?.name || "";
  }

  const sessions: Record<string, Date | null> = {
    quali:  r.qualifying_date ? toUtc(r.qualifying_date, r.qualifying_time) : null,
    sprint: r.sprint_race_date ? toUtc(r.sprint_race_date, r.sprint_race_time) : null,
    race:   r.date ? toUtc(r.date, r.time) : null,
  };

  const now = Date.now();
  const due: string[] = [];
  for (const key of REMINDED) {
    const at = sessions[key];
    if (!at) continue;
    const fireAt = at.getTime() - LEAD_MINUTES * 60_000;
    if (now >= fireAt && now < fireAt + WINDOW_MINUTES * 60_000) due.push(key);
  }
  if (!due.length) return json({ ok: true, note: "nothing due", round: r.round });

  // Filter out sessions already notified.
  const { data: sent } = await supabase
    .from("sent_reminders")
    .select("session_key")
    .eq("season", season)
    .eq("race_round", r.round);
  const already = new Set((sent || []).map((s) => s.session_key));
  const toSend = due.filter((k) => !already.has(k));
  if (!toSend.length) return json({ ok: true, note: "already sent", round: r.round });

  // All current subscriptions.
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth, lang");
  if (!subs || !subs.length) {
    // Still mark as sent so we don't retry forever with zero subscribers.
    for (const key of toSend) {
      await supabase.from("sent_reminders")
        .insert({ season, race_round: r.round, session_key: key });
    }
    return json({ ok: true, note: "no subscribers", round: r.round });
  }

  let sentCount = 0;
  const dead: string[] = [];

  for (const key of toSend) {
    for (const s of subs) {
      const { title, body } = msg(s.lang || "it", key, gpName);
      const payload = JSON.stringify({ title, body, url: "/", tag: `race-${key}` });
      const subscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      };
      try {
        await webpush.sendNotification(subscription, payload);
        sentCount += 1;
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) dead.push(s.endpoint); // gone → clean up
      }
    }
    await supabase.from("sent_reminders")
      .insert({ season, race_round: r.round, session_key: key });
  }

  if (dead.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", dead);
  }

  return json({ ok: true, round: r.round, sessions: toSend, sent: sentCount, removed: dead.length });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
