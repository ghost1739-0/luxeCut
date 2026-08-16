import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { CheckCircle2, Search, XCircle } from "lucide-react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { fetchAppointmentByCode, cancelMyAppointment } from "@/lib/booking";

export const Route = createFileRoute("/randevu-yonet")({
  head: () => ({ meta: [{ title: "Randevumu Yönet — Maison Barber" }] }),
  component: ManageAppointmentPage,
});

type ApptResult = {
  id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price: number;
  customer_name: string;
  barbers: { full_name: string } | null;
};

function ManageAppointmentPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [appt, setAppt] = useState<ApptResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // URL'de ?kod=XXXX varsa otomatik doldur ve ara
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("kod");
    if (fromUrl) {
      setCode(fromUrl);
      search(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = async (value: string) => {
    if (!value.trim()) return;
    setLoading(true);
    setError(null);
    setAppt(null);
    try {
      const res = await fetchAppointmentByCode(value.trim());
      setAppt(res);
    } catch (e: any) {
      setError(e.message ?? "Randevu bulunamadı.");
    } finally {
      setLoading(false);
    }
  };

  const cancel = async () => {
    if (!appt) return;
    if (!confirm("Randevunuzu iptal etmek istediğinize emin misiniz?")) return;
    setCancelling(true);
    try {
      await cancelMyAppointment(code.trim());
      toast.success("Randevunuz iptal edildi.");
      setAppt({ ...appt, status: "cancelled" });
    } catch (e: any) {
      toast.error(e.message ?? "İptal edilemedi.");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="min-h-screen">
      <Header />
      <section className="pt-32 pb-20 container-luxe max-w-xl mx-auto">
        <div className="text-center mb-10">
          <span className="text-xs uppercase tracking-[0.3em] text-gold">Randevu</span>
          <h1 className="font-display text-4xl mt-2">Randevumu Yönet</h1>
          <p className="text-sm text-muted-foreground mt-3">
            Randevu alırken size verilen doğrulama kodunu girin.
          </p>
        </div>

        <div className="glass-panel rounded-2xl p-6 md:p-8">
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && search(code)}
              placeholder="Doğrulama Kodu (ör. D8F68B63)"
              className="flex-1 bg-transparent border border-border/60 rounded-lg px-3 py-2.5 text-sm uppercase tracking-wider"
            />
            <button
              onClick={() => search(code)}
              disabled={loading}
              className="btn-gold px-4 rounded-lg text-xs uppercase tracking-widest inline-flex items-center gap-1 disabled:opacity-50"
            >
              <Search className="h-4 w-4" /> {loading ? "..." : "Bul"}
            </button>
          </div>

          {error && (
            <p className="text-sm text-destructive mt-4 flex items-center gap-2">
              <XCircle className="h-4 w-4" /> {error}
            </p>
          )}

          {appt && (
            <div className="mt-6 border-t border-border/40 pt-6 space-y-3">
              <Row label="Müşteri" value={appt.customer_name} />
              <Row label="Usta" value={appt.barbers?.full_name ?? "İlk uygun usta"} />
              <Row
                label="Tarih / Saat"
                value={`${new Date(appt.appointment_date).toLocaleDateString("tr", { day: "numeric", month: "long", year: "numeric" })} · ${appt.start_time.slice(0, 5)}`}
              />
              <Row label="Tutar" value={`₺${Number(appt.total_price).toFixed(0)}`} />
              <Row label="Durum" value={<StatusText status={appt.status} />} />

              {canStillCancel(appt) && (
                <button
                  onClick={cancel}
                  disabled={cancelling}
                  className="w-full mt-4 px-6 py-3 rounded-full text-xs uppercase tracking-widest border border-destructive/50 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                >
                  {cancelling ? "İptal ediliyor..." : "Randevuyu İptal Et"}
                </button>
              )}
              {appt.status !== "cancelled" && appt.status !== "completed" && !canStillCancel(appt) && (
                <p className="text-sm text-muted-foreground mt-4">
                  Randevu saatine 2 saatten az kaldığı için artık siteden iptal edilemez. Değişiklik için lütfen berberi arayın.
                </p>
              )}
              {appt.status === "cancelled" && (
                <p className="text-sm text-muted-foreground mt-4 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" /> Bu randevu iptal edilmiş.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}

function canStillCancel(appt: ApptResult) {
  if (appt.status === "cancelled" || appt.status === "completed") return false;
  // +03:00 sabit ekleniyor ki müşterinin telefon saat dilimi yanlış ayarlı olsa
  // bile randevu Türkiye saatine göre değerlendirilsin.
  const apptDateTime = new Date(`${appt.appointment_date}T${appt.start_time}+03:00`);
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  return apptDateTime.getTime() - Date.now() >= TWO_HOURS_MS;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-foreground/90">{value}</span>
    </div>
  );
}

function StatusText({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "Onay bekliyor",
    approved: "Onaylandı",
    completed: "Tamamlandı",
    cancelled: "İptal edildi",
    no_show: "Gelmedi",
  };
  return <span>{map[status] ?? status}</span>;
}
