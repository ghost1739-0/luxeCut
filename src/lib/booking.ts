import { supabase } from "@/integrations/supabase/client";
import { getBusySlots, createBooking } from "@/lib/booking.functions";

export type ServiceRow = {
  id: string;
  name_tr: string;
  name_en: string;
  description_tr: string | null;
  description_en: string | null;
  category: string;
  duration_minutes: number;
  price: number;
  image_url: string | null;
  is_active: boolean;
  sort_order: number;
};

export type BarberRow = {
  id: string;
  full_name: string;
  bio_tr: string | null;
  bio_en: string | null;
  specialties: string[];
  years_experience: number;
  rating: number;
  avatar_url: string | null;
  is_active: boolean;
  sort_order: number;
};

export async function fetchServices(): Promise<ServiceRow[]> {
  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as ServiceRow[];
}

export async function fetchBarbers(): Promise<BarberRow[]> {
  const { data, error } = await supabase
    .from("barbers")
    .select("*")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as BarberRow[];
}

export type WorkingHourRow = {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
};

export async function fetchWorkingHours(): Promise<WorkingHourRow[]> {
  const { data, error } = await supabase.from("working_hours").select("*").order("day_of_week");
  if (error) throw error;
  return (data ?? []) as WorkingHourRow[];
}

export async function fetchHolidays(): Promise<string[]> {
  const { data, error } = await supabase.from("holidays").select("holiday_date");
  if (error) throw error;
  return (data ?? []).map((h: any) => h.holiday_date as string);
}

export async function fetchBusySlots(barberId: string, date: string) {
  return await getBusySlots({ data: { barberId, date } });
}

export function generateTimeSlots(startHour = 9, endHour = 20, stepMin = 30) {
  const slots: string[] = [];
  for (let h = startHour; h < endHour; h++) {
    for (let m = 0; m < 60; m += stepMin) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

export function addMinutesToTime(time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

export function timeOverlaps(aStart: string, aEnd: string, bStart: string, bEnd: string) {
  return aStart < bEnd && aEnd > bStart;
}

export type BookingPayload = {
  barber_id: string | null;
  service_ids: string[];
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  notes: string | null;
  appointment_date: string;
  start_time: string;
  coupon_code?: string | null;
};

export async function createAppointment(payload: BookingPayload) {
  return await createBooking({ data: payload });
}

export type BlockedSlotRow = { id: string; day_of_week: number; time_slot: string };

export async function fetchBlockedSlots(): Promise<BlockedSlotRow[]> {
  const { data, error } = await (supabase.from("blocked_time_slots" as any) as any).select("*");
  if (error) throw error;
  return (data ?? []) as BlockedSlotRow[];
}

export async function addBlockedSlot(day_of_week: number, time_slot: string) {
  const { error } = await (supabase.from("blocked_time_slots" as any) as any).insert({ day_of_week, time_slot });
  if (error) throw error;
}

export async function removeBlockedSlot(day_of_week: number, time_slot: string) {
  const { error } = await (supabase.from("blocked_time_slots" as any) as any)
    .delete()
    .eq("day_of_week", day_of_week)
    .eq("time_slot", time_slot);
  if (error) throw error;
}