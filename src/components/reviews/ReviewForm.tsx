import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Star, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchBarbers, fetchServices } from "@/lib/booking";

export function ReviewForm() {
  const qc = useQueryClient();

  const { data: barbers = [] } = useQuery({ queryKey: ["barbers"], queryFn: fetchBarbers });
  const { data: services = [] } = useQuery({ queryKey: ["services"], queryFn: fetchServices });

  const [rating, setRating] = useState(5);
  const [barberId, setBarberId] = useState<string>("");
  const [serviceId, setServiceId] = useState<string>("");
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!comment.trim() || !name.trim()) return toast.error("Lütfen ad ve yorum girin.");
    if (!barberId) return toast.error("Lütfen bir usta seçin.");
    setSubmitting(true);
    const { error } = await supabase.from("reviews").insert({
      customer_name: name.trim(),
      rating,
      comment: comment.trim(),
      barber_id: barberId || null,
      service_id: serviceId || null,
    } as any);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Yorumunuz için teşekkürler!");
    setComment(""); setRating(5); setBarberId(""); setServiceId("");
    qc.invalidateQueries({ queryKey: ["reviews"] });
  };

  return (
    <div className="glass-panel rounded-2xl p-6 md:p-8 max-w-2xl mx-auto mt-10">
      <h3 className="font-display text-2xl mb-1">Deneyiminizi paylaşın</h3>
      <p className="text-sm text-muted-foreground mb-6">Yıldız verin, usta ve hizmet seçin, birkaç kelime yazın.</p>

      <div className="flex justify-center gap-1 mb-6">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setRating(n)} className="p-1">
            <Star className={`h-8 w-8 ${n <= rating ? "fill-gold text-gold" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Adınız *" className="bg-transparent border border-border/60 rounded-lg px-3 py-2.5 text-sm" />
        <select value={barberId} onChange={(e) => setBarberId(e.target.value)} required className="bg-transparent border border-border/60 rounded-lg px-3 py-2.5 text-sm">
          <option value="">Usta seçin *</option>
          {barbers.map((b) => <option key={b.id} value={b.id}>{b.full_name}</option>)}
        </select>
        <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="bg-transparent border border-border/60 rounded-lg px-3 py-2.5 text-sm sm:col-span-2">
          <option value="">Hizmet seçin (opsiyonel)</option>
          {services.map((s) => <option key={s.id} value={s.id}>{s.name_tr}</option>)}
        </select>
        <textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Yorumunuz..." rows={4} className="bg-transparent border border-border/60 rounded-lg px-3 py-2.5 text-sm sm:col-span-2 resize-none" />
      </div>

      <button onClick={submit} disabled={submitting} className="btn-gold w-full mt-4 px-6 py-3 rounded-full text-xs uppercase tracking-widest inline-flex items-center justify-center gap-2 disabled:opacity-50">
        <Send className="h-4 w-4" /> {submitting ? "Gönderiliyor..." : "Yorum Gönder"}
      </button>
    </div>
  );
}
