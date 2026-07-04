import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Users, Scissors, TrendingUp, CheckCircle2, XCircle, Clock, Plus, Trash2, Save, CalendarX } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { supabase } from "@/integrations/supabase/client";
import { updateAppointmentStatus } from "@/lib/booking.functions";
import { useServerFn } from "@tanstack/react-start";
import { fetchBlockedSlots, addBlockedSlot, removeBlockedSlot } from "@/lib/booking";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Yönetim Paneli — Maison Barber" }, { name: "robots", content: "noindex" }] }),
  component: AdminDashboard,
});

const TABS = [
  { id: "appointments", label: "Randevular", icon: CalendarDays },
  { id: "services", label: "Hizmetler", icon: Scissors },
  { id: "barbers", label: "Ustalar", icon: Users },
  { id: "hours", label: "Müsaitlik", icon: Clock },
] as const;

function AdminDashboard() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("appointments");
  const { canInstall, isInstalled, promptInstall } = useInstallPrompt();

  return (
    <div className="min-h-screen">
      <Header />
      <section className="pt-32 pb-16 container-luxe">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-xs uppercase tracking-[0.3em] text-gold">Yönetim</span>
            <h1 className="font-display text-4xl mt-2">Kontrol Paneli</h1>
          </div>
          
          {canInstall && !isInstalled && (
            <button
              onClick={promptInstall}
              className="btn-gold px-4 py-2 rounded-full text-xs uppercase tracking-widest flex items-center gap-2 transition-all duration-300 hover:opacity-90"
            >
              <span>📱</span> Panelini Telefona Yükle
            </button>
          )}
        </div>

        <div className="flex gap-2 mt-8 border-b border-border/60 overflow-x-auto">
          {TABS.map((tb) => {
            const Icon = tb.icon;
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                className={`px-4 py-3 text-sm inline-flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                  active ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" /> {tb.label}
              </button>
            );
          })}
        </div>

        <div className="mt-8">
          {tab === "appointments" && <AppointmentsTab />}
          {tab === "services" && <ServicesTab />}
          {tab === "barbers" && <BarbersTab />}
          {tab === "hours" && <HoursTab />}
        </div>
      </section>
      <Footer />
    </div>
  );
}

/* ----------------- Appointments ----------------- */

function AppointmentsTab() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: appts = [] } = useQuery({
    queryKey: ["admin-appts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments")
        .select("*, barbers(full_name)")
        .order("appointment_date", { ascending: false })
        .order("start_time", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const todaysAppts = appts.filter((a: any) => a.appointment_date === today);
    const revenue = appts.filter((a: any) => a.status === "completed" || a.status === "approved")
      .reduce((sum: number, a: any) => sum + Number(a.total_price), 0);
    const upcoming = appts.filter((a: any) => a.appointment_date >= today).length;
    const customers = new Set(appts.map((a: any) => a.customer_phone)).size;
    return { today: todaysAppts.length, upcoming, customers, revenue };
  }, [appts, today]);

  const updateStatus = useServerFn(updateAppointmentStatus);
  const setStatus = async (id: string, status: "pending" | "approved" | "completed" | "cancelled" | "no_show") => {
    try {
      await updateStatus({ data: { id, status } });
      toast.success("Güncellendi");
      qc.invalidateQueries({ queryKey: ["admin-appts"] });
    } catch (e: any) { toast.error(e?.message ?? "Hata"); }
  };

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi icon={<CalendarDays />} label="Bugünkü Randevu" value={stats.today} />
        <Kpi icon={<Clock />} label="Yaklaşan" value={stats.upcoming} />
        <Kpi icon={<Users />} label="Müşteri" value={stats.customers} />
        <Kpi icon={<TrendingUp />} label="Ciro" value={`₺${stats.revenue.toFixed(0)}`} accent />
      </div>

      <div className="glass-panel rounded-2xl p-6 mt-8">
        <h2 className="font-display text-2xl mb-4">Son Randevular</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-widest text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="text-left py-3">Tarih</th>
                <th className="text-left">Müşteri</th>
                <th className="text-left">Usta</th>
                <th className="text-left">Tutar</th>
                <th className="text-left">Durum</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {appts.slice(0, 30).map((a: any) => (
                <tr key={a.id} className="border-b border-border/40 hover:bg-onyx/40">
                  <td className="py-3">
                    <div>{a.appointment_date}</div>
                    <div className="text-xs text-muted-foreground">{String(a.start_time).slice(0, 5)}</div>
                  </td>
                  <td>
                    <div>{a.customer_name}</div>
                    <div className="text-xs text-muted-foreground">{a.customer_phone}</div>
                  </td>
                  <td>{a.barbers?.full_name ?? "—"}</td>
                  <td className="text-gold">₺{Number(a.total_price).toFixed(0)}</td>
                  <td><StatusBadge status={a.status} /></td>
                  <td className="text-right">
                    {a.status === "pending" && (
                      <button onClick={() => setStatus(a.id, "approved")} className="text-xs text-gold hover:underline mr-3 inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Onayla</button>
                    )}
                    {a.status !== "cancelled" && (
                      <button onClick={() => setStatus(a.id, "cancelled")} className="text-xs text-destructive hover:underline inline-flex items-center gap-1"><XCircle className="h-3 w-3" /> İptal</button>
                    )}
                  </td>
                </tr>
              ))}
              {appts.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-muted-foreground">Henüz randevu yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ----------------- Services ----------------- */

type ServiceEdit = {
  id: string;
  name_tr: string;
  name_en: string;
  price: number;
  duration_minutes: number;
  category: string;
  is_active: boolean;
  sort_order: number;
};

function ServicesTab() {
  const qc = useQueryClient();
  const { data: services = [] } = useQuery({
    queryKey: ["admin-services"],
    queryFn: async () => (await supabase.from("services").select("*").order("sort_order")).data ?? [],
  });

  const save = async (s: ServiceEdit) => {
    const { error } = await supabase
      .from("services")
      .update({
        name_tr: s.name_tr, name_en: s.name_en,
        price: s.price, duration_minutes: s.duration_minutes,
        category: s.category, is_active: s.is_active, sort_order: s.sort_order,
      })
      .eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Kaydedildi");
    qc.invalidateQueries({ queryKey: ["admin-services"] });
    qc.invalidateQueries({ queryKey: ["services"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Silinsin mi?")) return;
    const { error } = await supabase.from("services").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Silindi");
    qc.invalidateQueries({ queryKey: ["admin-services"] });
    qc.invalidateQueries({ queryKey: ["services"] });
  };

  const create = async () => {
    const { error } = await supabase.from("services").insert({
      name_tr: "Yeni Hizmet", name_en: "New Service",
      price: 100, duration_minutes: 30, category: "general", sort_order: services.length,
    });
    if (error) return toast.error(error.message);
    toast.success("Eklendi");
    qc.invalidateQueries({ queryKey: ["admin-services"] });
    qc.invalidateQueries({ queryKey: ["services"] });
  };

  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-display text-2xl">Hizmetler</h2>
        <button onClick={create} className="btn-gold px-4 py-2 rounded-full text-xs uppercase tracking-widest inline-flex items-center gap-1">
          <Plus className="h-3 w-3" /> Ekle
        </button>
      </div>
      <div className="space-y-3">
        {services.map((s: any) => (
          <ServiceRow key={s.id} initial={s} onSave={save} onRemove={remove} />
        ))}
      </div>
    </div>
  );
}

function ServiceRow({ initial, onSave, onRemove }: { initial: ServiceEdit; onSave: (s: ServiceEdit) => void; onRemove: (id: string) => void }) {
  const [s, setS] = useState<ServiceEdit>(initial);
  return (
    <div className="grid grid-cols-12 gap-2 items-center border border-border/40 rounded-xl p-3">
      <input value={s.name_tr} onChange={(e) => setS({ ...s, name_tr: e.target.value })} placeholder="Ad (TR)" className="col-span-3 bg-transparent border border-border/60 rounded-lg px-2 py-1.5 text-sm" />
      <input value={s.name_en} onChange={(e) => setS({ ...s, name_en: e.target.value })} placeholder="Ad (EN)" className="col-span-3 bg-transparent border border-border/60 rounded-lg px-2 py-1.5 text-sm" />
      <input type="number" value={s.price} onChange={(e) => setS({ ...s, price: Number(e.target.value) })} placeholder="₺" className="col-span-2 bg-transparent border border-border/60 rounded-lg px-2 py-1.5 text-sm" />
      <input type="number" value={s.duration_minutes} onChange={(e) => setS({ ...s, duration_minutes: Number(e.target.value) })} placeholder="dk" className="col-span-2 bg-transparent border border-border/60 rounded-lg px-2 py-1.5 text-sm" />
      <label className="col-span-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <input type="checkbox" checked={s.is_active} onChange={(e) => setS({ ...s, is_active: e.target.checked })} /> Aktif
      </label>
      <div className="col-span-1 flex justify-end gap-1">
        <button onClick={() => onSave(s)} className="p-1.5 text-gold hover:bg-gold/10 rounded"><Save className="h-4 w-4" /></button>
        <button onClick={() => onRemove(s.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

/* ----------------- Barbers ----------------- */

type BarberEdit = {
  id: string;
  full_name: string;
  bio_tr: string | null;
  years_experience: number;
  rating: number;
  specialties: string[];
  is_active: boolean;
  sort_order: number;
};

function BarbersTab() {
  const qc = useQueryClient();
  const { data: barbers = [] } = useQuery({
    queryKey: ["admin-barbers"],
    queryFn: async () => (await supabase.from("barbers").select("*").order("sort_order")).data ?? [],
  });

  const save = async (b: BarberEdit) => {
    const { error } = await supabase.from("barbers").update({
      full_name: b.full_name, bio_tr: b.bio_tr,
      years_experience: b.years_experience, rating: b.rating,
      specialties: b.specialties, is_active: b.is_active, sort_order: b.sort_order,
    }).eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success("Kaydedildi");
    qc.invalidateQueries({ queryKey: ["admin-barbers"] });
    qc.invalidateQueries({ queryKey: ["barbers"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Silinsin mi?")) return;
    const { error } = await supabase.from("barbers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Silindi");
    qc.invalidateQueries({ queryKey: ["admin-barbers"] });
    qc.invalidateQueries({ queryKey: ["barbers"] });
  };

  const create = async () => {
    const { error } = await supabase.from("barbers").insert({
      full_name: "Yeni Usta", specialties: [], years_experience: 0, rating: 5, sort_order: barbers.length,
    });
    if (error) return toast.error(error.message);
    toast.success("Eklendi");
    qc.invalidateQueries({ queryKey: ["admin-barbers"] });
    qc.invalidateQueries({ queryKey: ["barbers"] });
  };

  return (
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="font-display text-2xl">Ustalar</h2>
        <button onClick={create} className="btn-gold px-4 py-2 rounded-full text-xs uppercase tracking-widest inline-flex items-center gap-1">
          <Plus className="h-3 w-3" /> Ekle
        </button>
      </div>
      <div className="space-y-3">
        {barbers.map((b: any) => (
          <BarberRow key={b.id} initial={b} onSave={save} onRemove={remove} />
        ))}
      </div>
    </div>
  );
}

function BarberRow({ initial, onSave, onRemove }: { initial: BarberEdit; onSave: (b: BarberEdit) => void; onRemove: (id: string) => void }) {
  const [b, setB] = useState<BarberEdit>({ ...initial, specialties: initial.specialties ?? [] });
  return (
    <div className="grid grid-cols-12 gap-2 items-center border border-border/40 rounded-xl p-3">
      <input value={b.full_name} onChange={(e) => setB({ ...b, full_name: e.target.value })} placeholder="Ad Soyad" className="col-span-3 bg-transparent border border-border/60 rounded-lg px-2 py-1.5 text-sm" />
      <input value={b.specialties.join(", ")} onChange={(e) => setB({ ...b, specialties: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="Uzmanlıklar (virgülle)" className="col-span-4 bg-transparent border border-border/60 rounded-lg px-2 py-1.5 text-sm" />
      <input type="number" value={b.years_experience} onChange={(e) => setB({ ...b, years_experience: Number(e.target.value) })} placeholder="Yıl" className="col-span-1 bg-transparent border border-border/60 rounded-lg px-2 py-1.5 text-sm" />
      <input type="number" step="0.1" value={b.rating} onChange={(e) => setB({ ...b, rating: Number(e.target.value) })} placeholder="★" className="col-span-1 bg-transparent border border-border/60 rounded-lg px-2 py-1.5 text-sm" />
      <label className="col-span-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <input type="checkbox" checked={b.is_active} onChange={(e) => setB({ ...b, is_active: e.target.checked })} /> Aktif
      </label>
      <div className="col-span-1 flex justify-end gap-1">
        <button onClick={() => onSave(b)} className="p-1.5 text-gold hover:bg-gold/10 rounded"><Save className="h-4 w-4" /></button>
        <button onClick={() => onRemove(b.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

/* ----------------- Hours & Holidays ----------------- */

const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function HoursTab() {
  const qc = useQueryClient();
  const { data: hours = [] } = useQuery({
    queryKey: ["admin-hours"],
    queryFn: async () => (await supabase.from("working_hours").select("*").order("day_of_week")).data ?? [],
  });
  const { data: holidays = [] } = useQuery({
    queryKey: ["admin-holidays"],
    queryFn: async () => (await supabase.from("holidays").select("*").order("holiday_date")).data ?? [],
  });
  const { data: blocked = [] } = useQuery({
    queryKey: ["admin-blocked-slots"],
    queryFn: fetchBlockedSlots,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-hours"] });
    qc.invalidateQueries({ queryKey: ["admin-holidays"] });
    qc.invalidateQueries({ queryKey: ["working_hours"] });
    qc.invalidateQueries({ queryKey: ["holidays"] });
  };

  const invalidateBlocked = () => {
    qc.invalidateQueries({ queryKey: ["admin-blocked-slots"] });
    qc.invalidateQueries({ queryKey: ["blocked_slots"] });
  };

  const updateDay = async (day: number, patch: any) => {
    const { error } = await supabase.from("working_hours").update(patch).eq("day_of_week", day);
    if (error) return toast.error(error.message);
    toast.success("Güncellendi");
    invalidate();
  };

  const [holidayInput, setHolidayInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");
  const addHoliday = async () => {
    if (!holidayInput) return;
    const { error } = await supabase.from("holidays").insert({ holiday_date: holidayInput, reason: reasonInput || null });
    if (error) return toast.error(error.message);
    toast.success("Tatil eklendi");
    setHolidayInput(""); setReasonInput("");
    invalidate();
  };
  const removeHoliday = async (id: string) => {
    const { error } = await supabase.from("holidays").delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  };

  const [selectedDay, setSelectedDay] = useState(1); // Pazartesi varsayılan

  const toggleSlot = async (dow: number, time: string, isBlocked: boolean) => {
    try {
      if (isBlocked) {
        await removeBlockedSlot(dow, time);
      } else {
        await addBlockedSlot(dow, time);
      }
      invalidateBlocked();
    } catch (e: any) {
      toast.error(e.message ?? "Hata");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div className="glass-panel rounded-2xl p-6">
          <h2 className="font-display text-2xl mb-4">Haftalık Çalışma Saatleri</h2>
          <div className="space-y-2">
            {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
              const row = hours.find((h: any) => h.day_of_week === dow);
              if (!row) return null;
              return <HoursRow key={dow} row={row} onSave={(patch) => updateDay(dow, patch)} />;
            })}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <h2 className="font-display text-2xl mb-4 flex items-center gap-2"><CalendarX className="h-5 w-5 text-gold" /> Tatil Günleri</h2>
          <div className="flex gap-2 mb-4">
            <input type="date" value={holidayInput} onChange={(e) => setHolidayInput(e.target.value)} className="bg-transparent border border-border/60 rounded-lg px-3 py-2 text-sm" />
            <input value={reasonInput} onChange={(e) => setReasonInput(e.target.value)} placeholder="Sebep (ops.)" className="flex-1 bg-transparent border border-border/60 rounded-lg px-3 py-2 text-sm" />
            <button onClick={addHoliday} className="btn-gold px-3 py-2 rounded-lg text-xs uppercase tracking-widest">Ekle</button>
          </div>
          <ul className="space-y-2">
            {holidays.map((h: any) => (
              <li key={h.id} className="flex justify-between items-center border border-border/40 rounded-lg px-3 py-2 text-sm">
                <span>{h.holiday_date} {h.reason && <span className="text-muted-foreground">— {h.reason}</span>}</span>
                <button onClick={() => removeHoliday(h.id)} className="text-destructive hover:opacity-70"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
            {holidays.length === 0 && <p className="text-sm text-muted-foreground">Tatil eklenmemiş.</p>}
          </ul>
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6">
        <h2 className="font-display text-2xl mb-4">Slot Bazlı Müsaitlik</h2>
        <p className="text-sm text-muted-foreground mb-4">Bir gün seçin, o güne ait saatlerden kapatmak istediklerinize tıklayın.</p>

        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {DAY_NAMES.map((name, dow) => (
            <button
              key={dow}
              onClick={() => setSelectedDay(dow)}
              className={`px-4 py-2 rounded-full text-xs uppercase tracking-widest whitespace-nowrap border transition ${
                selectedDay === dow ? "border-gold bg-gold/10 text-gold" : "border-border text-muted-foreground hover:border-gold/50"
              }`}
            >
              {name}
            </button>
          ))}
        </div>

        <SlotGrid
          dow={selectedDay}
          workingHourRow={hours.find((h: any) => h.day_of_week === selectedDay)}
          blocked={blocked.filter((b) => b.day_of_week === selectedDay).map((b) => b.time_slot.slice(0, 5))}
          onToggle={toggleSlot}
        />
      </div>
    </div>
  );
}

function SlotGrid({ dow, workingHourRow, blocked, onToggle }: {
  dow: number;
  workingHourRow: any;
  blocked: string[];
  onToggle: (dow: number, time: string, isBlocked: boolean) => void;
}) {
  if (!workingHourRow) return <p className="text-sm text-muted-foreground">Bu gün için çalışma saati tanımlı değil.</p>;
  if (workingHourRow.is_closed) return <p className="text-sm text-muted-foreground">Bu gün kapalı olarak işaretli.</p>;

  const slots = useMemo(() => {
    const [openH, openM] = String(workingHourRow.open_time).slice(0, 5).split(":").map(Number);
    const [closeH, closeM] = String(workingHourRow.close_time).slice(0, 5).split(":").map(Number);
    const openMin = openH * 60 + openM;
    const closeMin = closeH * 60 + closeM;
    const list: string[] = [];
    for (let m = openMin; m < closeMin; m += 30) {
      const h = Math.floor(m / 60);
      const mm = m % 60;
      list.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
    }
    return list;
  }, [workingHourRow]);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {slots.map((time) => {
        const isBlocked = blocked.includes(time);
        return (
          <button
            key={time}
            onClick={() => onToggle(dow, time, isBlocked)}
            className={`py-3 rounded-lg border text-sm transition ${
              isBlocked
                ? "border-destructive/40 bg-destructive/10 text-destructive line-through"
                : "border-gold/40 bg-gold/5 text-foreground hover:border-gold"
            }`}
          >
            {time}
          </button>
        );
      })}
    </div>
  );
}

function HoursRow({ row, onSave }: { row: any; onSave: (patch: any) => void }) {
  const [open, setOpen] = useState(String(row.open_time).slice(0, 5));
  const [close, setClose] = useState(String(row.close_time).slice(0, 5));
  const [closed, setClosed] = useState(row.is_closed);
  const changed = open !== String(row.open_time).slice(0, 5) || close !== String(row.close_time).slice(0, 5) || closed !== row.is_closed;
  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <span className="col-span-3 text-sm">{DAY_NAMES[row.day_of_week]}</span>
      <input type="time" value={open} onChange={(e) => setOpen(e.target.value)} disabled={closed} className="col-span-3 bg-transparent border border-border/60 rounded-lg px-2 py-1.5 text-sm disabled:opacity-40" />
      <input type="time" value={close} onChange={(e) => setClose(e.target.value)} disabled={closed} className="col-span-3 bg-transparent border border-border/60 rounded-lg px-2 py-1.5 text-sm disabled:opacity-40" />
      <label className="col-span-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
        <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} /> Kapalı
      </label>
      <button
        disabled={!changed}
        onClick={() => onSave({ open_time: open, close_time: close, is_closed: closed })}
        className="col-span-1 p-1.5 text-gold hover:bg-gold/10 rounded disabled:opacity-30"
      >
        <Save className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ----------------- Shared ----------------- */

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`glass-panel rounded-2xl p-6 ${accent ? "border-gold/40" : ""}`}>
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-3 ${accent ? "bg-gold/20 text-gold" : "bg-onyx text-foreground/70"}`}>{icon}</div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-display text-3xl mt-1">{value}</p>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    approved: "bg-green-500/15 text-green-400 border-green-500/30",
    completed: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
    no_show: "bg-gray-500/15 text-gray-400 border-gray-500/30",
  };
  return <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${map[status] ?? ""}`}>{status}</span>;
}
