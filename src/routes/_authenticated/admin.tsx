import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Users, Scissors, TrendingUp, CheckCircle2, XCircle, Clock, Plus, Trash2, Save, CalendarX } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { supabase } from "@/integrations/supabase/client";
import { updateAppointmentStatus } from "@/lib/booking.functions";
import { useServerFn } from "@tanstack/react-start";
import { fetchBlockedSlots, addBlockedSlot, removeBlockedSlot, getWeekStartIso } from "@/lib/booking";

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
      <section className="pt-24 sm:pt-32 pb-12 sm:pb-16 container-luxe">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4">
          <div>
            <span className="text-xs uppercase tracking-[0.3em] text-gold">Yönetim</span>
            <h1 className="font-display text-3xl sm:text-4xl mt-2">Kontrol Paneli</h1>
          </div>
          
          {canInstall && !isInstalled && (
            <button
              onClick={promptInstall}
              className="btn-gold px-4 py-2 rounded-full text-xs uppercase tracking-widest flex items-center gap-2 transition-all duration-300 hover:opacity-90 self-start shrink-0"
            >
              <span>📱</span> Panelini Telefona Yükle
            </button>
          )}
        </div>

        <div className="flex gap-1 sm:gap-2 mt-6 sm:mt-8 border-b border-border/60 overflow-x-auto -mx-1 px-1">
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

        <div className="mt-6 sm:mt-8">
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

// Saati geçmiş ama hâlâ "onaylı" (approved) görünen randevuları, elle bir şey
// yapmaya gerek kalmadan otomatik olarak "tamamlandı" (completed) sayar —
// admin panelinde gösterim ve ciro hesaplaması bunu kullanır. Veritabanındaki
// gerçek status alanı değişmez, sadece ekranda böyle davranılır.
function effectiveStatus(a: any): string {
  if (a.status !== "approved") return a.status;
  const apptDateTime = new Date(`${a.appointment_date}T${a.start_time}`);
  return apptDateTime.getTime() < Date.now() ? "completed" : a.status;
}

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
    // Ciro sadece GERÇEKTEN tamamlanmış randevulardan hesaplanır: elle "Tamamlandı"
    // işaretlenenler + saati geçmiş ama hâlâ "onaylı" görünen randevular (bunlar
    // otomatik olarak tamamlanmış sayılır). Sadece gelecekteki "onaylı" randevular
    // ciroya dahil edilmez — henüz gerçekleşmediler.
    const revenue = appts
      .filter((a: any) => effectiveStatus(a) === "completed")
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

  const revenueLabel = `₺${stats.revenue.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`;

  return (
    <>
      <div className="grid grid-cols-2 gap-2 w-full max-w-70">
        <Kpi icon={<CalendarDays />} label="Bugünkü Randevu" value={stats.today} />
        <Kpi icon={<Clock />} label="Yaklaşan" value={stats.upcoming} />
        <Kpi icon={<Users />} label="Müşteri" value={stats.customers} />
        <Kpi icon={<TrendingUp />} label="Ciro" value={revenueLabel} accent />
      </div>

      <div className="glass-panel rounded-2xl p-4 sm:p-6 mt-6 sm:mt-8">
        <h2 className="font-display text-xl sm:text-2xl mb-4">Son Randevular</h2>

        <div className="md:hidden space-y-3">
          {appts.slice(0, 30).map((a: any) => {
            const eff = effectiveStatus(a);
            return (
            <div key={a.id} className="border border-border/40 rounded-xl p-3 space-y-2">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="text-sm font-medium">{a.customer_name}</div>
                  <div className="text-xs text-muted-foreground">{a.customer_phone}</div>
                </div>
                <StatusBadge status={eff} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{a.appointment_date} · {String(a.start_time).slice(0, 5)}</span>
                <span>{a.barbers?.full_name ?? "—"}</span>
                <span className="text-gold font-medium">₺{Number(a.total_price).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
              </div>
              {eff !== "completed" && eff !== "cancelled" && (
                <div className="flex gap-3 pt-1">
                  {a.status === "pending" && (
                    <button onClick={() => setStatus(a.id, "approved")} className="text-xs text-gold hover:underline inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Onayla</button>
                  )}
                  <button onClick={() => setStatus(a.id, "cancelled")} className="text-xs text-destructive hover:underline inline-flex items-center gap-1"><XCircle className="h-3 w-3" /> İptal</button>
                </div>
              )}
            </div>
            );
          })}
          {appts.length === 0 && <p className="py-10 text-center text-muted-foreground text-sm">Henüz randevu yok.</p>}
        </div>

        <div className="hidden md:block overflow-x-auto">
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
              {appts.slice(0, 30).map((a: any) => {
                const eff = effectiveStatus(a);
                return (
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
                  <td className="text-gold">₺{Number(a.total_price).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</td>
                  <td><StatusBadge status={eff} /></td>
                  <td className="text-right">
                    {eff !== "completed" && eff !== "cancelled" && (
                      <>
                        {a.status === "pending" && (
                          <button onClick={() => setStatus(a.id, "approved")} className="text-xs text-gold hover:underline mr-3 inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Onayla</button>
                        )}
                        <button onClick={() => setStatus(a.id, "cancelled")} className="text-xs text-destructive hover:underline inline-flex items-center gap-1"><XCircle className="h-3 w-3" /> İptal</button>
                      </>
                    )}
                  </td>
                </tr>
                );
              })}
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
      name_tr: "Yeni Hizmet", name_en: "Yeni Hizmet",
      price: 100, duration_minutes: 30, category: "general", sort_order: services.length,
    });
    if (error) return toast.error(error.message);
    toast.success("Eklendi");
    qc.invalidateQueries({ queryKey: ["admin-services"] });
    qc.invalidateQueries({ queryKey: ["services"] });
  };

  return (
    <div className="glass-panel rounded-2xl p-4 sm:p-6">
      <div className="flex justify-between items-center gap-3 mb-4 sm:mb-6">
        <h2 className="font-display text-xl sm:text-2xl">Hizmetler</h2>
        <button onClick={create} className="btn-gold px-3 sm:px-4 py-2 rounded-full text-xs uppercase tracking-widest inline-flex items-center gap-1 shrink-0">
          <Plus className="h-3 w-3" /> Ekle
        </button>
      </div>
      <div className="hidden md:grid mb-2 grid-cols-12 gap-2 px-3 text-[11px] uppercase tracking-widest text-muted-foreground">
        <span className="col-span-4">Ad</span>
        <span className="col-span-2">Fiyat (TL)</span>
        <span className="col-span-2">Süre (dk)</span>
        <span className="col-span-2">Durum</span>
        <span className="col-span-2 text-right">İşlem</span>
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
  const inputCls = "w-full bg-transparent border border-border/60 rounded-lg px-2 py-1.5 text-sm";
  return (
    <div className="border border-border/40 rounded-xl p-3">
      <div className="flex flex-col gap-3 md:hidden">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">Ad</label>
          <input value={s.name_tr} onChange={(e) => setS({ ...s, name_tr: e.target.value })} placeholder="Hizmet adı" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">Fiyat (TL)</label>
            <input type="number" value={s.price} onChange={(e) => setS({ ...s, price: Number(e.target.value) })} placeholder="₺" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">Süre (dk)</label>
            <input type="number" value={s.duration_minutes} onChange={(e) => setS({ ...s, duration_minutes: Number(e.target.value) })} placeholder="dk" className={inputCls} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={s.is_active} onChange={(e) => setS({ ...s, is_active: e.target.checked })} /> Aktif
          </label>
          <div className="flex gap-1">
            <button onClick={() => onSave(s)} className="p-1.5 text-gold hover:bg-gold/10 rounded"><Save className="h-4 w-4" /></button>
            <button onClick={() => onRemove(s.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
      <div className="hidden md:grid grid-cols-12 gap-2 items-center">
        <input value={s.name_tr} onChange={(e) => setS({ ...s, name_tr: e.target.value })} placeholder="Ad" className="col-span-4 bg-transparent border border-border/60 rounded-lg px-2 py-1.5 text-sm" />
        <input type="number" value={s.price} onChange={(e) => setS({ ...s, price: Number(e.target.value) })} placeholder="₺" className="col-span-2 bg-transparent border border-border/60 rounded-lg px-2 py-1.5 text-sm" />
        <input type="number" value={s.duration_minutes} onChange={(e) => setS({ ...s, duration_minutes: Number(e.target.value) })} placeholder="dk" className="col-span-2 bg-transparent border border-border/60 rounded-lg px-2 py-1.5 text-sm" />
        <label className="col-span-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
          <input type="checkbox" checked={s.is_active} onChange={(e) => setS({ ...s, is_active: e.target.checked })} /> Aktif
        </label>
        <div className="col-span-2 flex justify-end gap-1">
          <button onClick={() => onSave(s)} className="p-1.5 text-gold hover:bg-gold/10 rounded"><Save className="h-4 w-4" /></button>
          <button onClick={() => onRemove(s.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4" /></button>
        </div>
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
    <div className="glass-panel rounded-2xl p-4 sm:p-6">
      <div className="flex justify-between items-center gap-3 mb-4 sm:mb-6">
        <h2 className="font-display text-xl sm:text-2xl">Ustalar</h2>
        <button onClick={create} className="btn-gold px-3 sm:px-4 py-2 rounded-full text-xs uppercase tracking-widest inline-flex items-center gap-1 shrink-0">
          <Plus className="h-3 w-3" /> Ekle
        </button>
      </div>
      <div className="hidden md:grid mb-2 grid-cols-12 gap-2 px-3 text-[11px] uppercase tracking-widest text-muted-foreground">
        <span className="col-span-3">Ad Soyad</span>
        <span className="col-span-4">Uzmanlıklar</span>
        <span className="col-span-1">Yıl</span>
        <span className="col-span-1">Puan</span>
        <span className="col-span-2">Durum</span>
        <span className="col-span-1 text-right">İşlem</span>
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
  const inputCls = "w-full bg-transparent border border-border/60 rounded-lg px-2 py-1.5 text-sm";
  return (
    <div className="border border-border/40 rounded-xl p-3">
      <div className="flex flex-col gap-3 md:hidden">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">Ad Soyad</label>
          <input value={b.full_name} onChange={(e) => setB({ ...b, full_name: e.target.value })} placeholder="Ad Soyad" className={inputCls} />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">Uzmanlıklar</label>
          <input value={b.specialties.join(", ")} onChange={(e) => setB({ ...b, specialties: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="Virgülle ayırın" className={inputCls} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">Yıl</label>
            <input type="number" value={b.years_experience} onChange={(e) => setB({ ...b, years_experience: Number(e.target.value) })} placeholder="Yıl" className={inputCls} />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 block">Puan</label>
            <input type="number" step="0.1" value={b.rating} onChange={(e) => setB({ ...b, rating: Number(e.target.value) })} placeholder="★" className={inputCls} />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={b.is_active} onChange={(e) => setB({ ...b, is_active: e.target.checked })} /> Aktif
          </label>
          <div className="flex gap-1">
            <button onClick={() => onSave(b)} className="p-1.5 text-gold hover:bg-gold/10 rounded"><Save className="h-4 w-4" /></button>
            <button onClick={() => onRemove(b.id)} className="p-1.5 text-destructive hover:bg-destructive/10 rounded"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
      <div className="hidden md:grid grid-cols-12 gap-2 items-center">
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
    </div>
  );
}

/* ----------------- Hours & Holidays ----------------- */

const DAY_NAMES = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function HoursTab() {
  const qc = useQueryClient();
  const currentWeekStart = useMemo(() => getWeekStartIso(new Date()), []);
  const currentWeekStartLabel = useMemo(() => {
    const [y, m, d] = currentWeekStart.split("-");
    return `${d}-${m}-${y}`;
  }, [currentWeekStart]);
  const { data: hours = [] } = useQuery({
    queryKey: ["admin-hours"],
    queryFn: async () => (await supabase.from("working_hours").select("*").order("day_of_week")).data ?? [],
  });
  const { data: hourOverrides = [] } = useQuery({
    queryKey: ["admin-hour-overrides", currentWeekStart],
    queryFn: async () =>
      (await supabase
        .from("working_hours_overrides")
        .select("*")
        .eq("week_start", currentWeekStart)
        .order("day_of_week")).data ?? [],
  });
  const { data: holidays = [] } = useQuery({
    queryKey: ["admin-holidays"],
    queryFn: async () => (await supabase.from("holidays").select("*").order("holiday_date")).data ?? [],
  });
  const { data: blocked = [] } = useQuery({
    queryKey: ["admin-blocked-slots", currentWeekStart],
    queryFn: () => fetchBlockedSlots([currentWeekStart]),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-hours"] });
    qc.invalidateQueries({ queryKey: ["admin-hour-overrides"] });
    qc.invalidateQueries({ queryKey: ["admin-holidays"] });
    qc.invalidateQueries({ queryKey: ["working_hours"] });
    qc.invalidateQueries({ queryKey: ["working_hour_overrides"] });
    qc.invalidateQueries({ queryKey: ["holidays"] });
  };

  const invalidateBlocked = () => {
    qc.invalidateQueries({ queryKey: ["admin-blocked-slots"] });
    qc.invalidateQueries({ queryKey: ["blocked_slots"] });
  };

  const updateDay = async (day: number, patch: any) => {
    const baseRow = hours.find((h: any) => h.day_of_week === day);
    if (!baseRow) return toast.error("Çalışma saati bulunamadı");

    const payload = {
      week_start: currentWeekStart,
      day_of_week: day,
      open_time: patch.open_time ?? String(baseRow.open_time).slice(0, 5),
      close_time: patch.close_time ?? String(baseRow.close_time).slice(0, 5),
      is_closed: typeof patch.is_closed === "boolean" ? patch.is_closed : baseRow.is_closed,
    };

    const { error } = await supabase
      .from("working_hours_overrides")
      .upsert(payload, { onConflict: "week_start,day_of_week" });
    if (error) return toast.error(error.message);
    toast.success("Güncellendi");
    invalidate();
  };

  const effectiveHoursByDay = useMemo(() => {
    const map = new Map<number, any>();
    for (const row of hours) map.set(Number(row.day_of_week), row);
    for (const row of hourOverrides) map.set(Number(row.day_of_week), row);
    return map;
  }, [hours, hourOverrides]);

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
  const [pendingBlockedByDay, setPendingBlockedByDay] = useState<Record<number, Record<string, boolean>>>({});

  const effectiveBlockedByDay = useMemo(() => {
    const map: Record<number, Set<string>> = {};
    for (const item of blocked) {
      const key = Number(String(item.day_of_week));
      if (!Number.isNaN(key)) {
        if (!map[key]) map[key] = new Set();
        map[key].add(String(item.time_slot).slice(0, 5));
      }
    }
    for (const [dow, pending] of Object.entries(pendingBlockedByDay)) {
      const key = Number(dow);
      if (!map[key]) map[key] = new Set();
      for (const [time, shouldBlock] of Object.entries(pending)) {
        if (shouldBlock) map[key].add(time);
        else map[key].delete(time);
      }
    }
    return map;
  }, [blocked, pendingBlockedByDay]);

  const savePendingSlots = async (dow: number) => {
    const pending = pendingBlockedByDay[dow] ?? {};
    const entries = Object.entries(pending);
    if (!entries.length) return;

    try {
      const nextBlocked = new Set(
        (blocked ?? [])
          .filter((b) => b.week_start === currentWeekStart && String(b.day_of_week) === String(dow))
          .map((b) => String(b.time_slot).slice(0, 5)),
      );
      for (const [time, shouldBlock] of entries) {
        const alreadyBlocked = nextBlocked.has(time);
        if (shouldBlock === alreadyBlocked) continue;
        if (shouldBlock) {
          await addBlockedSlot(currentWeekStart, dow, time);
          nextBlocked.add(time);
        } else {
          await removeBlockedSlot(currentWeekStart, dow, time);
          nextBlocked.delete(time);
        }
      }

      const nextRows = [
        ...((blocked ?? []).filter((b) => !(b.week_start === currentWeekStart && String(b.day_of_week) === String(dow)))),
        ...Array.from(nextBlocked).map((time) => ({
          id: `optimistic-${currentWeekStart}-${dow}-${time}`,
          week_start: currentWeekStart,
          day_of_week: String(dow),
          time_slot: time,
          created_at: new Date().toISOString(),
        })),
      ];

      qc.setQueryData(["blocked_slots"], nextRows);
      qc.setQueryData(["admin-blocked-slots"], nextRows);
      setPendingBlockedByDay((prev) => ({ ...prev, [dow]: {} }));
      invalidateBlocked();
    } catch (e: any) {
      const message = e?.message ?? "Hata";
      if (/duplicate key value violates unique constraint/i.test(message)) {
        invalidateBlocked();
        return;
      }
      toast.error(message);
    }
  };

  const toggleSlot = async (dow: number, time: string, shouldBlock: boolean) => {
    setPendingBlockedByDay((prev) => ({
      ...prev,
      [dow]: { ...(prev[dow] ?? {}), [time]: shouldBlock },
    }));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        <div className="glass-panel rounded-2xl p-4 sm:p-6">
          <h2 className="font-display text-xl sm:text-2xl mb-3 sm:mb-4">Bu Haftanın Çalışma Saatleri</h2>
          <p className="text-xs text-muted-foreground mb-3">Ayarlar yalnızca {currentWeekStartLabel} haftası için geçerlidir.</p>
          <div className="space-y-3 sm:space-y-2">
            {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
              const row = effectiveHoursByDay.get(dow);
              if (!row) return null;
              return <HoursRow key={dow} row={row} onSave={(patch) => updateDay(dow, patch)} />;
            })}
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-4 sm:p-6">
          <h2 className="font-display text-xl sm:text-2xl mb-3 sm:mb-4 flex items-center gap-2"><CalendarX className="h-5 w-5 text-gold shrink-0" /> Tatil Günleri</h2>
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input type="date" value={holidayInput} onChange={(e) => setHolidayInput(e.target.value)} className="bg-transparent border border-border/60 rounded-lg px-3 py-2 text-sm w-full sm:w-auto" />
            <input value={reasonInput} onChange={(e) => setReasonInput(e.target.value)} placeholder="Sebep (ops.)" className="flex-1 bg-transparent border border-border/60 rounded-lg px-3 py-2 text-sm min-w-0" />
            <button onClick={addHoliday} className="btn-gold px-3 py-2 rounded-lg text-xs uppercase tracking-widest shrink-0">Ekle</button>
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

      <div className="glass-panel rounded-2xl p-4 sm:p-6">
        <h2 className="font-display text-xl sm:text-2xl mb-3 sm:mb-4">Slot Bazlı Müsaitlik</h2>
        <p className="text-sm text-muted-foreground mb-4">Bir gün seçin, o güne ait saatlerden kapatmak istediklerinize tıklayın. Bu ayarlar sadece {currentWeekStartLabel} haftası için geçerlidir.</p>

        <div className="flex gap-2 mb-4 sm:mb-6 overflow-x-auto pb-2 -mx-1 px-1">
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
          workingHourRow={effectiveHoursByDay.get(selectedDay)}
          blocked={Array.from(effectiveBlockedByDay[selectedDay] ?? new Set())}
          pendingChanges={pendingBlockedByDay[selectedDay] ?? {}}
          onToggle={toggleSlot}
          onSave={() => savePendingSlots(selectedDay)}
        />
      </div>
    </div>
  );
}

function SlotGrid({ dow, workingHourRow, blocked, pendingChanges, onToggle, onSave }: {
  dow: number;
  workingHourRow: any;
  blocked: string[];
  pendingChanges: Record<string, boolean>;
  onToggle: (dow: number, time: string, isBlocked: boolean) => void;
  onSave: () => void | Promise<void>;
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

  const hasPendingChanges = Object.keys(pendingChanges).length > 0;

  return (
    <>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {slots.map((time) => {
          const isBlocked = blocked.includes(time) || pendingChanges[time] === true;

          const handleClick = () => {
            const nextBlocked = !isBlocked;
            onToggle(dow, time, nextBlocked);
          };

          return (
            <button
              key={time}
              type="button"
              onClick={handleClick}
              className={`py-3 rounded-lg border text-sm transition ${
                isBlocked
                  ? "border-destructive/40 bg-destructive/10 text-destructive line-through opacity-100"
                  : "border-gold/40 bg-gold/5 text-foreground hover:border-gold"
              }`}
            >
              {time}
            </button>
          );
        })}
      </div>

      {hasPendingChanges && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onSave}
            className="btn-gold px-4 py-2.5 rounded-full text-xs uppercase tracking-widest"
          >
            Müsaitlikleri Kaydet
          </button>
        </div>
      )}
    </>
  );
}

function HoursRow({ row, onSave }: { row: any; onSave: (patch: any) => void }) {
  const [open, setOpen] = useState(String(row.open_time).slice(0, 5));
  const [close, setClose] = useState(String(row.close_time).slice(0, 5));
  const [closed, setClosed] = useState(row.is_closed);
  const changed = open !== String(row.open_time).slice(0, 5) || close !== String(row.close_time).slice(0, 5) || closed !== row.is_closed;
  const timeInputCls = "w-full bg-transparent border border-border/60 rounded-lg px-2 py-1.5 text-sm disabled:opacity-40";
  return (
    <div className="border border-border/30 rounded-lg p-3 md:border-0 md:p-0 md:rounded-none">
      <div className="flex flex-col gap-2 md:hidden">
        <span className="text-sm font-medium">{DAY_NAMES[row.day_of_week]}</span>
        <div className="grid grid-cols-2 gap-2">
          <input type="time" value={open} onChange={(e) => setOpen(e.target.value)} disabled={closed} className={timeInputCls} />
          <input type="time" value={close} onChange={(e) => setClose(e.target.value)} disabled={closed} className={timeInputCls} />
        </div>
        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} /> Kapalı
          </label>
          <button
            disabled={!changed}
            onClick={() => onSave({ open_time: open, close_time: close, is_closed: closed })}
            className="p-1.5 text-gold hover:bg-gold/10 rounded disabled:opacity-30"
          >
            <Save className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="hidden md:grid grid-cols-12 gap-2 items-center">
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
    </div>
  );
}

/* ----------------- Shared ----------------- */

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-panel rounded-xl p-3 aspect-square flex flex-col justify-between min-w-0 overflow-hidden ${accent ? "border-gold/40" : ""}`}
    >
      <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5 ${accent ? "bg-gold/20 text-gold" : "bg-onyx text-foreground/70"}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground leading-tight truncate">{label}</p>
        <p className="font-display text-base sm:text-lg mt-0.5 truncate tabular-nums">{value}</p>
      </div>
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
  const labels: Record<string, string> = {
    pending: "Bekliyor",
    approved: "Onaylı",
    completed: "Tamamlandı",
    cancelled: "İptal",
    no_show: "Gelmedi",
  };
  return <span className={`text-[10px] uppercase tracking-widest px-2 py-1 rounded-full border ${map[status] ?? ""}`}>{labels[status] ?? status}</span>;
}