import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const supabase = createClient(
  "https://ngwqniaiawjtpcpmgnki.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nd3FuaWFpYXdqdHBjcG1nbmtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwMTY5MjcsImV4cCI6MjA5ODU5MjkyN30.7NOhDVKpP217Qr29CCwSdk3TI9b6ZUDYmsI1tO_j5XQ"
);

const tables = [
  "appointments",
  "barbers",
  "coupons",
  "holidays",
  "profiles",
  "reviews",
  "services",
  "user_roles",
  "working_hours"
];

async function run() {
  // 🔥 FIX: JS için güvenli obje tanımı
  const dump = {};

  for (const t of tables) {
    console.log(`Exporting: ${t}`);

    const { data, error } = await supabase
      .from(t)
      .select("*");

    if (error) {
      console.log(`❌ ${t}:`, error.message);
      continue;
    }

    dump[t] = data || [];
    console.log(`✔ ${t}: ${data?.length || 0} rows`);
  }

  fs.writeFileSync(
    "backup.json",
    JSON.stringify(dump, null, 2)
  );

  console.log("🎉 DONE → backup.json oluştu");
}

run();