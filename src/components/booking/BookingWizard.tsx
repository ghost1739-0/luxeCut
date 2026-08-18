import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Clock, Sparkles, User, Calendar as CalIcon, ScissorsSquare } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useI18n } from "@/lib/i18n";
import {
  fetchServices, fetchBarbers, fetchBusySlots, fetchBusySlotsForDate, fetchWorkingHours, fetchHolidays,
  fetchWorkingHourOverrides,
  fetchBlockedSlots,
  generateTimeSlots, addMinutesToTime, timeOverlaps, createAppointment,
  normalizeTimeSlot, getWeekStartIso,
  type ServiceRow, type BarberRow, type WorkingHourRow, type WorkingHourOverrideRow,
} from "@/lib/booking";
import barber1 from "@/assets/barber-1.jpg";
import barber2 from "@/assets/barber-2.jpg";
import barber3 from "@/assets/barber-3.jpg";
import barber4 from "@/assets/barber-4.jpg";
const barberImgs = [barber1, barber2, barber3, barber4];

const PHONE_PREFIX = "+90";

function parseLocalPhoneDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length > 10) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

const infoSchema = z.object({
  customer_name: z.string().trim().min(2).max(100),
  customer_phone: z
    .string()
    .trim()
    .regex(/^\+90\d{10}$/, "Geçerli bir telefon numarası girin (10 hane)"),
  customer_email: z.string().trim().email().max(255).or(z.literal("")),
  notes: z.string().max(500).optional(),
});

type Info = z.infer<typeof infoSchema>;

const STEPS = ["service", "barber", "date", "time", "info", "confirm"] as const;

export function BookingWizard() {
  const { t, lang } = useI18n();
  const [step, setStep] = useState(0);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [barberId, setBarberId] = useState<string | null>(null); // null = no preference
  const [date, setDate] = useState<string>(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [time, setTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<{ id: string; qr_code: string; barber_name: string | null } | null>(null);

  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: fetchServices });
  const { data: barbers = [] } = useQuery({ queryKey: ["barbers"], queryFn: fetchBarbers });
  const { data: workingHours = [] } = useQuery({ queryKey: ["working_hours"], queryFn: fetchWorkingHours });
  const visibleWeekStarts = useMemo(() => {
    const today = new Date();
    const weekStarts = new Set<string>();
    for (let i = 0; i < 21; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      weekStarts.add(getWeekStartIso(d));
    }
    weekStarts.add(getWeekStartIso(date));
    return Array.from(weekStarts);
  }, [date]);
  const { data: workingHourOverrides = [] } = useQuery({
    queryKey: ["working_hour_overrides", visibleWeekStarts.join("|")],
    queryFn: () => fetchWorkingHourOverrides(visibleWeekStarts),
    enabled: visibleWeekStarts.length > 0,
  });
  const selectedWeekStart = useMemo(() => getWeekStartIso(date), [date]);
  const { data: blockedSlots = [] } = useQuery({
    queryKey: ["blocked_slots", visibleWeekStarts.join("|")],
    queryFn: () => fetchBlockedSlots(visibleWeekStarts),
    enabled: visibleWeekStarts.length > 0,
  });
  const { data: holidays = [] } = useQuery({ queryKey: ["holidays"], queryFn: fetchHolidays });

  const chosenServices = useMemo(
    () => services.filter((s) => selectedServices.includes(s.id)),
    [services, selectedServices],
  );
  const totalDuration = chosenServices.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalPrice = chosenServices.reduce((sum, s) => sum + Number(s.price), 0);

  const chosenBarber = barbers.find((b) => b.id === barberId) ?? null;

  const resolveWorkingHour = useMemo(() => {
    return (isoDate: string): WorkingHourRow | WorkingHourOverrideRow | null => {
      const dow = new Date(isoDate + "T00:00:00").getDay();
      const weekStart = getWeekStartIso(isoDate);
      const override = workingHourOverrides.find(
        (row) => Number(row.day_of_week) === dow && String(row.week_start) === weekStart,
      );
      if (override) return override;
      return workingHours.find((w) => w.day_of_week === dow) ?? null;
    };
  }, [workingHours, workingHourOverrides]);

  const dayInfo = useMemo(() => {
    const wh = resolveWorkingHour(date);
    const isHoliday = holidays.includes(date);
    const closed = !wh || wh.is_closed || isHoliday;
    return { closed, isHoliday, wh: wh ?? null };
  }, [date, resolveWorkingHour, holidays]);

  // Fetch busy slots for chosen barber+date
  const { data: busy = [] } = useQuery({
    queryKey: ["busy", barberId, date],
    queryFn: () => (barberId ? fetchBusySlots(barberId, date) : Promise.resolve([])),
    enabled: !!barberId && !!date,
  });

  // Fetch busy slots for ALL barbers when no preference was selected
  const { data: allBusy = [] } = useQuery({
    queryKey: ["busy-all", date],
    queryFn: () => fetchBusySlotsForDate(date),
    enabled: !barberId && !!date,
  });

 const availableSlots = useMemo(() => {
  if (!totalDuration || dayInfo.closed || !dayInfo.wh) return [];
  const dow = new Date(date + "T00:00:00").getDay();
  const dayBlocked = new Set(
    blockedSlots
      .filter((b) => b.week_start === selectedWeekStart && String(b.day_of_week) === String(dow))
      .map((b) => normalizeTimeSlot(b.time_slot)),
  );
  const [openH, openM] = dayInfo.wh.open_time.split(":").map(Number);
  const [closeH, closeM] = dayInfo.wh.close_time.split(":").map(Number);
  const openMin = openH * 60 + openM;
  const closeMin = closeH * 60 + closeM;
  const slots = generateTimeSlots(0, 24, 30);
  return slots
    .map((start) => ({ start, end: addMinutesToTime(start, totalDuration) }))
    .filter(({ start, end }) => {
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      return sh * 60 + sm >= openMin && eh * 60 + em <= closeMin;
    })
    .map(({ start, end }) => {
      let taken: boolean;
      if (dayBlocked.has(start)) {
        taken = true;
      } else if (barberId) {
        taken = busy.some((b) => timeOverlaps(start, end, b.start_time.slice(0, 5), b.end_time.slice(0, 5)));
      } else {
        // "Fark etmez": slot only taken if EVERY active barber is busy at this time
        const busyBarberIds = new Set(
          allBusy
            .filter((b) => timeOverlaps(start, end, b.start_time.slice(0, 5), b.end_time.slice(0, 5)))
            .map((b) => b.barber_id),
        );
        taken = barbers.length > 0 && barbers.every((b) => busyBarberIds.has(b.id));
      }
      const past = isSlotPast(date, start);
      return { start, end, taken: taken || past, past };
    });
}, [busy, allBusy, barbers, barberId, totalDuration, dayInfo, blockedSlots, date, selectedWeekStart]);

  useEffect(() => {
    if (!time) return;
    const slotStillOpen = availableSlots.some((slot) => slot.start === time && !slot.taken);
    if (!slotStillOpen) {
      setTime(null);
    }
  }, [time, availableSlots]);

  const form = useForm<Info>({
    resolver: zodResolver(infoSchema),
    mode: "onChange",
    defaultValues: { customer_email: "", customer_phone: PHONE_PREFIX },
  });

  const canNext = () => {
    if (step === 0) return selectedServices.length > 0;
    if (step === 1) return true;
    if (step === 2) return !!date && !dayInfo.closed && !isPast(date);
    if (step === 3) return !!time;
    if (step === 4) return form.formState.isValid;
    return true;
  };

  const goNext = async () => {
    if (step === 4) {
      const ok = await form.trigger();
      if (!ok) return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const submit = async () => {
    if (!time) return;
    setSubmitting(true);
    try {
      const info = form.getValues();
      const res = await createAppointment({
        barber_id: barberId,
        service_ids: selectedServices,
        customer_name: info.customer_name,
        customer_phone: info.customer_phone,
        customer_email: info.customer_email || null,
        notes: info.notes || null,
        appointment_date: date,
        start_time: time,
      });
      setSuccess(res);
      toast.success(t("book.success"));
    } catch (e: any) {
      toast.error(e.message ?? "Randevu oluşturulamadı");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) return <SuccessCard qr={success.qr_code} barberName={success.barber_name} />;

  return (
    <div className="glass-panel rounded-3xl p-6 md:p-10">
      <Stepper step={step} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="mt-8 min-h-75"
        >
          {step === 0 && <StepServices services={services} selected={selectedServices} onToggle={(id) => setSelectedServices((v) => v.includes(id) ? v.filter((x) => x !== id) : [...v, id])} lang={lang} />}
          {step === 1 && <StepBarber barbers={barbers} selected={barberId} onSelect={setBarberId} lang={lang} />}
          {step === 2 && <StepDate date={date} onChange={setDate} resolveWorkingHour={resolveWorkingHour} holidays={holidays} />}
          {step === 3 && <StepTime slots={availableSlots} value={time} onSelect={setTime} noBarber={!barberId} />}
          {step === 4 && <StepInfo form={form} />}
          {step === 5 && <StepConfirm services={chosenServices} barber={chosenBarber} date={date} time={time!} totalPrice={totalPrice} totalDuration={totalDuration} info={form.getValues()} lang={lang} />}
        </motion.div>
      </AnimatePresence>

      {/* Footer bar */}
      <div className="mt-8 pt-6 border-t border-border/50 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-6 text-sm text-foreground/80">
          {chosenServices.length > 0 && (
            <>
              <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-gold" /> {totalDuration} {t("book.min")}</span>
              <span className="flex items-center gap-2 text-gold font-semibold">₺{totalPrice.toFixed(0)}</span>
            </>
          )}
        </div>
        <div className="flex gap-3">
          {step > 0 && (
            <button onClick={() => setStep((s) => s - 1)} className="px-5 py-2.5 rounded-full text-xs uppercase tracking-widest border border-border hover:border-gold hover:text-gold flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" /> {t("book.back")}
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={goNext} disabled={!canNext()} className="btn-gold px-6 py-2.5 rounded-full text-xs uppercase tracking-widest disabled:opacity-40 flex items-center gap-1">
              {t("book.next")} <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={submit} disabled={submitting} className="btn-gold px-6 py-2.5 rounded-full text-xs uppercase tracking-widest disabled:opacity-40">
              {submitting ? "..." : t("book.confirm_btn")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  const labels = ["Hizmet", "Usta", "Tarih", "Saat", "Bilgi", "Onay"];
  return (
    <div className="flex items-center justify-between gap-2">
      {labels.map((l, i) => (
        <div key={l} className="flex items-center gap-2 flex-1">
          <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold border transition-all ${
            i < step ? "bg-gold text-primary-foreground border-gold" :
            i === step ? "border-gold text-gold" : "border-border text-muted-foreground"
          }`}>
            {i < step ? <Check className="h-4 w-4" /> : i + 1}
          </div>
          <span className={`hidden md:inline text-xs uppercase tracking-widest ${i === step ? "text-gold" : "text-muted-foreground"}`}>{l}</span>
          {i < labels.length - 1 && <div className={`flex-1 h-px ${i < step ? "bg-gold" : "bg-border"}`} />}
        </div>
      ))}
    </div>
  );
}

function StepServices({ services, selected, onToggle, lang }: { services: ServiceRow[]; selected: string[]; onToggle: (id: string) => void; lang: string }) {
  return (
    <div>
      <h3 className="font-display text-2xl mb-1">Hizmet Seçin</h3>
      <p className="text-sm text-muted-foreground mb-6">Birden fazla hizmet seçebilirsiniz.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {services.map((s) => {
          const active = selected.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onToggle(s.id)}
              className={`text-left p-4 rounded-xl border transition-all ${active ? "border-gold bg-gold/10" : "border-border hover:border-gold/50"}`}
            >
              <div className="flex justify-between items-start gap-3">
                <div>
                  <p className="font-medium">{lang === "tr" ? s.name_tr : s.name_en}</p>
                  <p className="text-xs text-muted-foreground mt-1">{s.duration_minutes} dk</p>
                </div>
                <span className="text-gold font-semibold text-sm">₺{Number(s.price).toFixed(0)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepBarber({ barbers, selected, onSelect, lang }: { barbers: BarberRow[]; selected: string | null; onSelect: (id: string | null) => void; lang: string }) {
  return (
    <div>
      <h3 className="font-display text-2xl mb-1">Usta Seçin</h3>
      <p className="text-sm text-muted-foreground mb-6">Tercih etmediğiniz takdirde ilk uygun usta atanacaktır.</p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`col-span-2 lg:col-span-1 p-3 sm:p-4 rounded-xl border text-left ${selected === null ? "border-gold bg-gold/10" : "border-border hover:border-gold/50"}`}
        >
          <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-gold mb-1 sm:mb-2" />
          <p className="font-medium text-sm sm:text-base">Fark etmez</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 sm:mt-1">İlk uygun usta</p>
        </button>
        {barbers.map((b, i) => {
          const active = selected === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onSelect(b.id)}
              className={`rounded-xl border text-left transition overflow-hidden ${active ? "border-gold bg-gold/10" : "border-border hover:border-gold/50"}`}
            >
              <img src={barberImgs[i % barberImgs.length]} className="aspect-square w-full object-cover" alt="" />
              <div className="p-2 sm:p-3">
                <p className="font-medium text-xs sm:text-sm truncate">{b.full_name}</p>
                <p className="text-[10px] sm:text-xs text-gold mt-0.5">★ {b.rating}</p>
                <p className="hidden sm:block text-xs text-muted-foreground mt-1 line-clamp-2">{lang === "tr" ? b.bio_tr : b.bio_en}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function isPast(d: string) { const x = new Date(d); x.setHours(23,59,59); return x.getTime() < Date.now(); }

function isSlotPast(dateIso: string, start: string) {
  const todayIso = new Date().toISOString().slice(0, 10);
  if (dateIso !== todayIso) return false;
  const [h, m] = start.split(":").map(Number);
  const now = new Date();
  return h * 60 + m < now.getHours() * 60 + now.getMinutes();
}

function StepDate({ date, onChange, resolveWorkingHour, holidays }: {
  date: string; onChange: (d: string) => void;
  resolveWorkingHour: (isoDate: string) => WorkingHourRow | WorkingHourOverrideRow | null;
  holidays: string[];
}) {
  const today = new Date();
  const days: Date[] = [];
  for (let i = 0; i < 21; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    days.push(d);
  }
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const labels = ["Paz","Pzt","Sal","Çar","Per","Cum","Cts"];
  return (
    <div>
      <h3 className="font-display text-2xl mb-1">Tarih Seçin</h3>
      <p className="text-sm text-muted-foreground mb-6">Kapalı günler ve tatiller pasiftir.</p>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
        {days.map((d) => {
          const iso = fmt(d);
          const wh = resolveWorkingHour(iso);
          const disabled = !wh || wh.is_closed || holidays.includes(iso);
          const active = iso === date;
          return (
            <button
              key={iso}
              disabled={disabled}
              onClick={() => onChange(iso)}
              className={`p-3 rounded-xl border text-center transition ${active ? "border-gold bg-gold/10 text-gold" : disabled ? "opacity-30 cursor-not-allowed border-border" : "border-border hover:border-gold/50"}`}
            >
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{labels[d.getDay()]}</p>
              <p className="font-display text-lg mt-1">{d.getDate()}</p>
              <p className="text-[10px] text-muted-foreground">{d.toLocaleDateString("tr", { month: "short" })}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StepTime({ slots, value, onSelect, noBarber }: {
  slots: { start: string; end: string; taken: boolean; past?: boolean }[];
  value: string | null;
  onSelect: (t: string) => void;
  noBarber: boolean;
}) {
  return (
    <div>
      <h3 className="font-display text-2xl mb-1">Saat Seçin</h3>
      <p className="text-sm text-muted-foreground mb-6">
        {noBarber ? "İlk uygun usta seçildi — sadece tüm ustalar dolu olan saatler pasiftir." : "Geçmiş ve dolu saatler üstü çizili olarak görüntülenir."}
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {slots.map((s) => (
          <button
            key={s.start}
            disabled={s.taken}
            onClick={() => onSelect(s.start)}
            className={`py-3 rounded-lg border text-sm transition ${
              value === s.start ? "border-gold bg-gold/10 text-gold" :
              s.taken ? "opacity-30 line-through cursor-not-allowed border-border" :
              "border-border hover:border-gold/50"
            }`}
          >{s.start}</button>
        ))}
      </div>
    </div>
  );
}

function StepInfo({ form }: { form: ReturnType<typeof useForm<Info>> }) {
  const { register, formState: { errors }, setValue, watch } = form;
  const fullPhone = watch("customer_phone") || PHONE_PREFIX;
  const localPhone = fullPhone.startsWith(PHONE_PREFIX)
    ? fullPhone.slice(PHONE_PREFIX.length).replace(/\D/g, "")
    : parseLocalPhoneDigits(fullPhone);

  const updatePhone = (raw: string) => {
    const local = parseLocalPhoneDigits(raw);
    setValue("customer_phone", PHONE_PREFIX + local, { shouldValidate: true, shouldDirty: true });
  };

  return (
    <div>
      <h3 className="font-display text-2xl mb-1">Bilgileriniz</h3>
      <p className="text-sm text-muted-foreground mb-6">İletişim bilgilerinizi girin.</p>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-foreground/70">Ad Soyad *</span>
          <input {...register("customer_name")} className="input-wiz" />
          {errors.customer_name && <p className="text-xs text-destructive mt-1">{errors.customer_name.message}</p>}
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-widest text-foreground/70">Telefon *</span>
          <div className="flex mt-2">
            <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-border bg-onyx/80 text-foreground/70 text-sm font-medium select-none shrink-0">
              +90
            </span>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={localPhone}
              onChange={(e) => updatePhone(e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                updatePhone(e.clipboardData.getData("text"));
              }}
              className="input-wiz input-wiz-phone flex-1 rounded-l-none mt-0!"
              placeholder="5xx xxx xx xx"
              maxLength={10}
            />
          </div>
          {errors.customer_phone && <p className="text-xs text-destructive mt-1">{errors.customer_phone.message}</p>}
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs uppercase tracking-widest text-foreground/70">E-posta</span>
          <input {...register("customer_email")} type="email" className="input-wiz" />
          {errors.customer_email && <p className="text-xs text-destructive mt-1">{errors.customer_email.message}</p>}
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs uppercase tracking-widest text-foreground/70">Notlar</span>
          <textarea {...register("notes")} rows={3} className="input-wiz resize-none" />
        </label>
      </div>
      <style>{`
        .input-wiz {
          width: 100%; margin-top: .5rem;
          background: color-mix(in oklab, var(--input) 60%, transparent);
          border: 1px solid var(--border); border-radius: .75rem;
          padding: .75rem 1rem; color: var(--foreground); font-size: .95rem;
        }
        .input-wiz:focus { outline: none; border-color: var(--gold); box-shadow: 0 0 0 3px oklch(0.78 0.15 82 / .15); }
        .input-wiz-phone { border-top-left-radius: 0; border-bottom-left-radius: 0; }
      `}</style>
    </div>
  );
}

function StepConfirm({ services, barber, date, time, totalPrice, totalDuration, info, lang }: any) {
  return (
    <div>
      <h3 className="font-display text-2xl mb-1">Onaylayın</h3>
      <p className="text-sm text-muted-foreground mb-6">Detaylar doğruysa randevuyu onaylayın.</p>
      <div className="space-y-3 text-sm">
        <Row icon={<ScissorsSquare className="h-4 w-4" />} label="Hizmetler" value={services.map((s: any) => lang === "tr" ? s.name_tr : s.name_en).join(", ")} />
        <Row icon={<User className="h-4 w-4" />} label="Usta" value={barber ? barber.full_name : "İlk uygun usta"} />
        <Row icon={<CalIcon className="h-4 w-4" />} label="Tarih" value={new Date(date).toLocaleDateString("tr", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} />
        <Row icon={<Clock className="h-4 w-4" />} label="Saat" value={`${time} · ${totalDuration} dk`} />
        <Row icon={<User className="h-4 w-4" />} label="İletişim" value={`${info.customer_name} · ${info.customer_phone}`} />
      </div>
      <div className="mt-6 p-4 rounded-xl border border-gold/40 bg-gold/5 flex justify-between items-center">
        <span className="text-sm uppercase tracking-widest text-foreground/80">Toplam</span>
        <span className="font-display text-2xl text-gold">₺{totalPrice.toFixed(0)}</span>
      </div>
    </div>
  );
}
function Row({ icon, label, value }: any) {
  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/40">
      <span className="text-gold mt-0.5">{icon}</span>
      <div className="flex-1">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="text-foreground/90">{value}</p>
      </div>
    </div>
  );
}

function SuccessCard({ qr, barberName }: { qr: string; barberName: string | null }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-panel rounded-3xl p-10 text-center">
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring" }} className="mx-auto h-20 w-20 rounded-full bg-gold flex items-center justify-center mb-6">
        <Check className="h-10 w-10 text-primary-foreground" />
      </motion.div>
      <h2 className="font-display text-4xl">Randevunuz Alındı!</h2>
      {barberName && (
        <p className="text-gold mt-2 text-sm uppercase tracking-widest">Ustanız: {barberName}</p>
      )}
      <div className="mt-8 inline-block p-4 rounded-xl bg-onyx border border-gold/40">
        <p className="text-xs uppercase tracking-widest text-gold mb-1">Doğrulama Kodu</p>
        <p className="font-mono text-sm">{qr.slice(0, 8).toUpperCase()}</p>
      </div>
      <div className="mt-8">
        <Link to="/" className="btn-gold px-6 py-3 rounded-full text-sm uppercase tracking-widest inline-block">Ana Sayfa</Link>
      </div>
    </motion.div>
  );
}
