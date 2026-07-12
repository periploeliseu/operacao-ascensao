import { createClient } from "@supabase/supabase-js";

/* ============================================================
   CONEXÃO COM O BANCO (Supabase)
   - A chave publishable foi FEITA para ficar em código público.
     Quem protege os dados é o RLS dentro do banco.
   - NUNCA cole a service_role aqui.
   ============================================================ */
const SUPABASE_URL = "https://gldgcbnfxhlxddpydlbj.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_FbhP1PcLmE_Vu4KBet2fuw_RsDTQLS8";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
