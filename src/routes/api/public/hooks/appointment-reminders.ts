import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsApp, bookingReminderMessage, customerBookingReminderMessage } from "@/lib/notifications.server";

// Called by pg_cron once per hour. Sends a WhatsApp reminder for every
// approved appointment happening in the next ~2 hours that hasn't been
// reminded yet. Saatlik çalıştığı için pencere biraz geniş tutulur (0-2 saat
// kala) ki hiçbir randevu cron'un çalışma anına denk gelmediği için atlanmasın.
export const Route = createFileRoute("/api/public/hooks/appointment-reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth: require the Supabase publishable key in the apikey header.
        const apikey = request.headers.get("apikey") ?? request.headers.get("x-api-key");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Unauthorized", { status: 401 });
        }

        const admin = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );

        // Bugün ve yarının randevularını çekip, tam 2 saatlik pencereye
        // (0 < kalan süre <= 2 saat) girenleri JS tarafında filtreliyoruz —
        // appointment_date + start_time ayrı sütunlar olduğu için tarih
        // aritmetiğini burada yapmak, Supabase sorgusunda yapmaktan daha
        // güvenilir.
        const todayStr = new Date().toISOString().slice(0, 10);
        const tomorrowStr = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const { data: candidates, error } = await admin
          .from("appointments")
          .select("id, customer_name, customer_phone, appointment_date, start_time, total_price, reminder_sent_at, barbers(full_name)")
          .in("appointment_date", [todayStr, tomorrowStr])
          .eq("status", "approved")
          .is("reminder_sent_at", null);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
        const now = Date.now();
        // NOT: +03:00 sabit ekleniyor — bkz. cancelAppointmentByCode'daki aynı açıklama.
        const appts = (candidates ?? []).filter((a) => {
          const apptTime = new Date(`${a.appointment_date}T${a.start_time}+03:00`).getTime();
          const msUntil = apptTime - now;
          return msUntil > 0 && msUntil <= TWO_HOURS_MS;
        });

        const owner = process.env.SHOP_OWNER_WHATSAPP;
        let sent = 0;
        for (const a of appts) {
          const summary = {
            customer_name: a.customer_name,
            customer_phone: a.customer_phone,
            appointment_date: a.appointment_date,
            start_time: a.start_time,
            total_price: a.total_price,
            barber_name: (a as any).barbers?.full_name ?? null,
          };
          let ok = false;
          if (owner) {
            const r = await sendWhatsApp(owner, bookingReminderMessage(summary));
            ok = ok || r.ok;
          }
          if (a.customer_phone) {
            const r = await sendWhatsApp(a.customer_phone, customerBookingReminderMessage(summary));
            ok = ok || r.ok;
          }
          if (ok) sent++;
          await admin.from("appointments").update({ reminder_sent_at: new Date().toISOString() }).eq("id", a.id);
        }

        return Response.json({ ok: true, checked: candidates?.length ?? 0, sent });
      },
    },
  },
});
