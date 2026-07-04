import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { sendWhatsApp, bookingReminderMessage } from "@/lib/notifications.server";

// Called by pg_cron once per hour. Sends a WhatsApp reminder for every
// approved appointment happening ~24h from now that hasn't been reminded yet.
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

        // Target: appointments on tomorrow's date, approved, not yet reminded.
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const { data: appts, error } = await admin
          .from("appointments")
          .select("id, customer_name, customer_phone, appointment_date, start_time, total_price, reminder_sent_at, barbers(full_name)")
          .eq("appointment_date", tomorrow)
          .eq("status", "approved")
          .is("reminder_sent_at", null);
        if (error) return Response.json({ error: error.message }, { status: 500 });

        const owner = process.env.SHOP_OWNER_WHATSAPP;
        let sent = 0;
        for (const a of appts ?? []) {
          if (owner) {
            const r = await sendWhatsApp(owner, bookingReminderMessage({
              customer_name: a.customer_name,
              customer_phone: a.customer_phone,
              appointment_date: a.appointment_date,
              start_time: a.start_time,
              total_price: a.total_price,
              barber_name: (a as any).barbers?.full_name ?? null,
            }));
            if (r.ok) sent++;
          }
          await admin.from("appointments").update({ reminder_sent_at: new Date().toISOString() }).eq("id", a.id);
        }

        return Response.json({ ok: true, checked: appts?.length ?? 0, sent, date: tomorrow });
      },
    },
  },
});
