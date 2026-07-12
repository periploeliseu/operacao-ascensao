import { createClient } from "@supabase/supabase-js";

/* ============================================================
   CONEXÃO COM O BANCO (Supabase)
   Cole aqui os DOIS valores de: Project Settings > Data API
   - A chave anon foi FEITA para ficar em código público.
     Quem protege os dados é o RLS dentro do banco.
   - NUNCA cole a service_role aqui.
   ============================================================ */
const SUPABASE_URL = "https://gldgcbnfxhlxddpydlbj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_SUACHAVE";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
