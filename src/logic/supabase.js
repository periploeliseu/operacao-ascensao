import { createClient } from "@supabase/supabase-js";

/* ============================================================
   CONEXÃO COM O BANCO (Supabase)
   - A chave publishable foi FEITA para ficar em código público.
     Quem protege os dados é o RLS dentro do banco.
   - NUNCA cole a service_role aqui.
   ============================================================ */
const SUPABASE_URL = "https://gldgcbnfxhlxddpydlbj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdsZGdjYm5meGhseGRkcHlkbGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NjIxOTcsImV4cCI6MjA5OTIzODE5N30.D3hLHJe1oKm3bCI9YfPBK9DBVUAYfqcDT6jySsiKAoI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
