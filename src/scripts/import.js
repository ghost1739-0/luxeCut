import { createClient } from "@supabase/supabase-js";
import fs from "fs";

// 🔥 NEW SUPABASE (target)
const supabase = createClient(
  "https://ctqykrsfkjchaiwacwrk.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0cXlrcnNma2pjaGFpd2Fjd3JrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzE2NDkwMywiZXhwIjoyMDk4NzQwOTAzfQ.J2JLajxmqRpbWhBLAwkjpaXjzr9w7SBVcn1Vz6N4Olk"
);

// backup.json oku
const backup = JSON.parse(fs.readFileSync("backup.json", "utf-8"));

async function run() {
  for (const table in backup) {
    const rows = backup[table];

    console.log(`Importing ${table} -> ${rows.length} rows`);

    if (!rows || rows.length === 0) continue;

    // ⚠️ batch insert (daha stabil)
    const chunkSize = 500;

    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);

      const { error } = await supabase
        .from(table)
        .insert(chunk);

      if (error) {
        console.log(`❌ ${table}:`, error.message);
      } else {
        console.log(`✔ ${table} chunk ${i / chunkSize + 1}`);
      }
    }
  }

  console.log("🎉 ALL DATA IMPORTED");
}

run();