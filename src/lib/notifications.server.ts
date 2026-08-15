// Server-only helpers for sending WhatsApp notifications via Twilio.
// Best-effort: failures are logged but never thrown to the caller so that
// booking flows remain resilient if Twilio is down or misconfigured.

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  // TR local format e.g. 05xx... -> +905xx...
  if (digits.startsWith("0")) return "+90" + digits.slice(1);
  return "+" + digits;
}

export async function sendWhatsApp(toRaw: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
  const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
  const FROM = process.env.TWILIO_WHATSAPP_FROM
    ? (process.env.TWILIO_WHATSAPP_FROM.startsWith("whatsapp:")
        ? process.env.TWILIO_WHATSAPP_FROM
        : `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`)
    : "whatsapp:+14155238886";

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn("[whatsapp] missing Twilio credentials, skipping");
    return { ok: false, error: "missing_credentials" };
  }

  const to = `whatsapp:${normalizePhone(toRaw)}`;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const basicAuth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: FROM, Body: message.slice(0, 1500) }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn("[whatsapp] failed", res.status, text);
      return { ok: false, error: `${res.status}: ${text.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    console.warn("[whatsapp] error", e);
    return { ok: false, error: String(e) };
  }
}

export function formatDateTR(date: string, time?: string) {
  const t = time ? time.slice(0, 5) : "";
  return t ? `${date} ${t}` : date;
}

type ApptSummary = {
  customer_name: string;
  customer_phone: string;
  appointment_date: string;
  start_time: string;
  total_price: number | string;
  barber_name?: string | null;
  qr_code?: string | null;
};

export function bookingCreatedMessage(a: ApptSummary) {
  return `🗓️ Yeni Randevu (BEKLEMEDE)\n\nMüşteri: ${a.customer_name}\nTelefon: ${a.customer_phone}\nTarih: ${formatDateTR(a.appointment_date, a.start_time)}\nUsta: ${a.barber_name ?? "Fark etmez"}\nTutar: ₺${Number(a.total_price).toFixed(0)}\n\nOnaylamak için yönetim paneline giriş yapın.`;
}

export function bookingApprovedMessage(a: ApptSummary) {
  return `✅ Randevu Onaylandı\n\n${a.customer_name} için ${formatDateTR(a.appointment_date, a.start_time)} randevusu onaylandı.\nUsta: ${a.barber_name ?? "Fark etmez"}\nTutar: ₺${Number(a.total_price).toFixed(0)}`;
}

export function bookingCancelledMessage(a: ApptSummary) {
  return `❌ Randevu İptal\n\n${a.customer_name} — ${formatDateTR(a.appointment_date, a.start_time)} randevusu iptal edildi.`;
}

export function bookingReminderMessage(a: ApptSummary) {
  return `⏰ Yarınki Randevu Hatırlatma\n\n${a.customer_name} • ${a.customer_phone}\nSaat: ${a.start_time.slice(0, 5)}\nUsta: ${a.barber_name ?? "Fark etmez"}\nTutar: ₺${Number(a.total_price).toFixed(0)}`;
}

// ---- Müşteriye giden mesajlar (aynı olaylar, karşı taraftan bakış) ----

export function customerBookingReceivedMessage(a: ApptSummary) {
  return `Merhaba ${a.customer_name} 👋\n\nRandevu talebiniz alındı ve onay bekliyor.\n\n📅 ${formatDateTR(a.appointment_date, a.start_time)}\n✂️ Usta: ${a.barber_name ?? "Fark etmez"}\n💰 Tutar: ₺${Number(a.total_price).toFixed(0)}\n\nOnaylandığında size ayrıca haber vereceğiz.`;
}

export function customerBookingApprovedMessage(a: ApptSummary) {
  const manageLink = a.qr_code
    ? `\n\nRandevunuzu görüntülemek/iptal etmek için: https://luxe-cut.vercel.app/randevu-yonet?kod=${a.qr_code}`
    : "";

  return `Merhaba ${a.customer_name} 👋\n\n✅ Randevunuz onaylandı!\n\n📅 ${formatDateTR(a.appointment_date, a.start_time)}\n✂️ Usta: ${a.barber_name ?? "Fark etmez"}\n💰 Tutar: ₺${Number(a.total_price).toFixed(0)}${manageLink}\n\nSizi bekliyoruz!`;
}

export function customerBookingCancelledMessage(a: ApptSummary) {
  return `Merhaba ${a.customer_name},\n\n❌ ${formatDateTR(a.appointment_date, a.start_time)} tarihli randevunuz iptal edildi.\n\nYeni bir randevu almak isterseniz sitemizden tekrar oluşturabilirsiniz.`;
}

export function customerBookingReminderMessage(a: ApptSummary) {
  return `Merhaba ${a.customer_name} 👋\n\n⏰ Hatırlatma: yarın saat ${a.start_time.slice(0, 5)}'te randevunuz var.\n\n✂️ Usta: ${a.barber_name ?? "Fark etmez"}\n💰 Tutar: ₺${Number(a.total_price).toFixed(0)}\n\nGörüşmek üzere!`;
}