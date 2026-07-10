/* Camada de persistência.
   Hoje: localStorage (dados ficam no navegador de cada aparelho).
   Fase 3: trocamos SÓ este arquivo por chamadas ao Supabase —
   o resto do app nem fica sabendo. Isso é o "padrão adapter". */
const KEY = "ascensao:team:v4";

export async function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : null;
    return data && data.version === 4 ? data : null;
  } catch { return null; }
}

export async function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { console.error("Falha ao salvar:", e); }
}

export async function clearState() {
  try { localStorage.removeItem(KEY); } catch {}
}
