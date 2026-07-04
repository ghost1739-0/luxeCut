import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Public: fetch busy slots for a barber+date via service-role helper.
// Only exposes {start_time, end_time}, no PII.
export const getBusySlots = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({
      barberId: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }).parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .rpc("get_busy_slots" as never, { _barber_id: data.barberId, _date: data.date } as never);
    if (error) throw new Error(error.message);
    return (rows ?? []) as { start_time: string; end_time: string }[];
  });

const bookingSchema = z.object({
  barber_id: z.string().uuid().nullable(),
  service_ids: z.array(z.string().uuid()).min(1).max(10),
  customer_name: z.string().trim().min(2).max(100),
  customer_phone: z.string().trim().min(7).max(30),
  customer_email: z.string().trim().email().max(255).nullable(),
  notes: z.string().max(500).nullable(),
  appointment_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  coupon_code: z.string().trim().max(50).nullable().optional(),
});

// Public booking endpoint. Recalculates price/duration server-side from the DB.
export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => bookingSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Load services and compute totals from trusted DB values.
    const { data: svcs, error: svcErr } = await supabaseAdmin
      .from("services")
      .select("id, price, duration_minutes, is_active")
      .in("id", data.service_ids);
    if (svcErr) throw new Error(svcErr.message);
    if (!svcs || svcs.length !== data.service_ids.length) throw new Error("Invalid services");
    if (svcs.some((s) => !s.is_active)) throw new Error("Inactive service selected");

    const total_price = svcs.reduce((sum, s) => sum + Number(s.price), 0);
    const total_duration = svcs.reduce((sum, s) => sum + Number(s.duration_minutes), 0);

    // 2. Validate against working hours + holidays from DB.
    const dow = new Date(data.appointment_date + "T00:00:00Z").getUTCDay();
    const { data: wh } = await supabaseAdmin.from("working_hours").select("*").eq("day_of_week", dow).maybeSingle();
    if (!wh || wh.is_closed) throw new Error("Closed on this day");
    const { data: hol } = await supabaseAdmin.from("holidays").select("holiday_date").eq("holiday_date", data.appointment_date).maybeSingle();
    if (hol) throw new Error("Holiday");
    const [h, m] = data.start_time.split(":").map(Number);
    const [oh, om] = String(wh.open_time).split(":").map(Number);
    const [ch, cm] = String(wh.close_time).split(":").map(Number);
    const startMin = h * 60 + m;
    const endMin = startMin + total_duration;
    if (startMin < oh * 60 + om || endMin > ch * 60 + cm) throw new Error("Outside working hours");

    const pad = (n: number) => String(n).padStart(2, "0");
    const end_time = `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`;

    // 2.5 Check blocked slot
    const { data: blockedRow } = await (supabaseAdmin.from("blocked_time_slots" as any) as any)
      .select("id")
      .eq("day_of_week", dow)
      .eq("time_slot", data.start_time)
      .maybeSingle();
    if (blockedRow) throw new Error("Slot blocked by admin");

    // 3. Validate coupon server-side if provided.
    let discount = 0;
    let coupon_code: string | null = null;
    if (data.coupon_code) {
      const { data: coupon } = await supabaseAdmin
        .from("coupons")
        .select("code, discount_percent, expires_at, is_active")
        .eq("code", data.coupon_code)
        .maybeSingle();
      if (coupon && coupon.is_active && (!coupon.expires_at || new Date(coupon.expires_at) > new Date())) {
        discount = (total_price * Number(coupon.discount_percent)) / 100;
        coupon_code = coupon.code;
      }
    }

    // 4. Check barber isn't already booked for this window.
    if (data.barber_id) {
      const { data: busy } = await supabaseAdmin
        .from("appointments")
        .select("start_time, end_time")
        .eq("barber_id", data.barber_id)
        .eq("appointment_date", data.appointment_date)
        .in("status", ["pending", "approved", "completed"]);
      const overlap = (busy ?? []).some((b: { start_time: string; end_time: string }) =>
        data.start_time < b.end_time.slice(0, 5) && end_time > b.start_time.slice(0, 5),
      );
      if (overlap) throw new Error("Slot no longer available");
    }

    // 5. Insert.
    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("appointments")
      .insert({
        barber_id: data.barber_id,
        service_ids: data.service_ids,
        customer_id: null,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        customer_email: data.customer_email,
        notes: data.notes,
        appointment_date: data.appointment_date,
        start_time: data.start_time,
        end_time,
        total_price: total_price - discount,
        total_duration,
        coupon_code,
        discount,
        status: "pending",
      })
      .select("id, qr_code")
      .single();
    if (insErr) throw new Error(insErr.message);

    // Fire-and-forget WhatsApp notification to shop owner.
    try {
      const { sendWhatsApp, bookingCreatedMessage } = await import("./notifications.server");
      let barber_name: string | null = null;
      if (data.barber_id) {
        const { data: b } = await supabaseAdmin.from("barbers").select("full_name").eq("id", data.barber_id).maybeSingle();
        barber_name = b?.full_name ?? null;
      }
      const owner = process.env.SHOP_OWNER_WHATSAPP;
      if (owner) {
        await sendWhatsApp(owner, bookingCreatedMessage({
          customer_name: data.customer_name,
          customer_phone: data.customer_phone,
          appointment_date: data.appointment_date,
          start_time: data.start_time,
          total_price: total_price - discount,
          barber_name,
        }));
      }
    } catch (e) {
      console.warn("[booking] notification failed", e);
    }

    return inserted as { id: string; qr_code: string };
  });

// Admin-only: change appointment status and notify shop owner via WhatsApp.
export const updateAppointmentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["pending", "approved", "completed", "cancelled", "no_show"]),
    }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Verify admin.
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Forbidden");

    const { data: updated, error } = await supabaseAdmin
      .from("appointments")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("*, barbers(full_name)")
      .single();
    if (error) throw new Error(error.message);

    // Notify owner on approve/cancel.
    if (data.status === "approved" || data.status === "cancelled") {
      try {
        const { sendWhatsApp, bookingApprovedMessage, bookingCancelledMessage } = await import("./notifications.server");
        const owner = process.env.SHOP_OWNER_WHATSAPP;
        if (owner) {
          const summary = {
            customer_name: updated.customer_name,
            customer_phone: updated.customer_phone,
            appointment_date: updated.appointment_date,
            start_time: updated.start_time,
            total_price: updated.total_price,
            barber_name: (updated as any).barbers?.full_name ?? null,
          };
          const body = data.status === "approved" ? bookingApprovedMessage(summary) : bookingCancelledMessage(summary);
          await sendWhatsApp(owner, body);
        }
      } catch (e) {
        console.warn("[admin] notification failed", e);
      }
    }

    return { ok: true };
  });

// Check if the signed-in caller is an admin. Used by admin route gate.
export const checkIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { isAdmin: !!data };
  });