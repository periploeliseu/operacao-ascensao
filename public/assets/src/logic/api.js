import { supabase } from "./supabase.js";

/* ============================================================
   CAMADA DE API — todas as conversas com o banco moram AQUI.
   A interface nunca fala com o Supabase diretamente; ela chama
   estas funções. Trocar de banco um dia = trocar este arquivo.
   (Mesmo princípio do storage.js da fase anterior.)
   ============================================================ */

/* ---------- autenticação ---------- */
export async function entrar(email, senha) {
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  return error ? traduzErro(error.message) : null;
}
export async function sair() { await supabase.auth.signOut(); }
export function aoMudarSessao(cb) {
  supabase.auth.getSession().then(({ data }) => cb(data.session));
  supabase.auth.onAuthStateChange((_evento, sessao) => cb(sessao));
}
function traduzErro(msg) {
  if (/invalid login/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/rate limit/i.test(msg)) return "Muitas tentativas. Aguarde um minuto.";
  return msg;
}

/* ---------- carga geral ---------- */
export async function carregarTudo() {
  const [c, m, ch, ev, cl, id, rg, md, pc, pr] = await Promise.all([
    supabase.from("colaboradores").select("*").order("nome"),
    supabase.from("missoes").select("*").eq("ativa", true).order("criado_em"),
    supabase.from("chefoes").select("*").neq("status", "arquivado").order("criado_em", { ascending: false }).limit(1),
    supabase.from("eventos_xp").select("*").order("criado_em", { ascending: false }).limit(3000),
    supabase.from("conclusoes").select("*, missoes(nome, xp, moedas_ocultas, chefao_id)").order("enviada_em", { ascending: false }).limit(500),
    supabase.from("ideias").select("*").order("criado_em", { ascending: false }).limit(200),
    supabase.from("resgates").select("*").order("criado_em", { ascending: false }).limit(200),
    supabase.from("modelos_missao").select("*").order("nome"),
    supabase.from("premios_categoria").select("*").order("categoria"),
    supabase.from("premios_resgatados").select("*").order("resgatado_em", { ascending: false }),
  ]);
  const erro = c.error || m.error || ch.error || ev.error || cl.error;
  if (erro) throw erro;
  return { colabs: c.data, missoes: m.data, chefao: ch.data[0] || null, eventos: ev.data, conclusoes: cl.data, ideias: id.data || [], resgates: rg.data || [], modelos: md.data || [], premios: pc.data || [], premiosResgatados: pr.data || [] };
}

/* ---------- colaborador ---------- */
export async function salvarPerfil(id, campos) {
  const { error } = await supabase.from("colaboradores").update(campos).eq("id", id);
  return error?.message || null;
}

/* ---------- missões ---------- */
export async function criarMissao(m) {
  const { error } = await supabase.from("missoes").insert(m);
  return error?.message || null;
}
export async function desativarMissao(id) {
  const { error } = await supabase.from("missoes").update({ ativa: false }).eq("id", id);
  return error?.message || null;
}

/* ---------- conclusões (fila de aprovação) ---------- */
export async function enviarConclusao(missaoId, colaboradorId) {
  const { error } = await supabase.from("conclusoes").insert({ missao_id: missaoId, colaborador_id: colaboradorId });
  return error?.message || null;
}
export async function avaliarConclusao(conclusao, aprovar) {
  const { error } = await supabase.from("conclusoes")
    .update({ status: aprovar ? "aprovada" : "reprovada", avaliada_em: new Date().toISOString() })
    .eq("id", conclusao.id);
  if (error) return error.message;
  if (aprovar) {
    const m = conclusao.missoes;
    const { error: e2 } = await supabase.from("eventos_xp").insert({
      colaborador_id: conclusao.colaborador_id,
      origem: "missao",
      xp: m.xp,
      moedas: m.moedas_ocultas || 0,
      descricao: `Missão aprovada: ${m.nome}`,
      referencia_id: m.chefao_id || conclusao.missao_id,
    });
    if (e2) return e2.message;
  }
  return null;
}

/* ---------- chefão ---------- */
export async function convocarChefao(b) {
  const { error } = await supabase.from("chefoes").insert({
    nome: b.name, foco: b.focus || null, hp_max: b.maxHp,
    prazo: new Date(b.deadline).toISOString(),
    premio_oculto: b.reward, extra: b.extra || null,
  });
  return error?.message || null;
}
export async function mudarStatusChefao(id, status) {
  const { error } = await supabase.from("chefoes").update({ status }).eq("id", id);
  return error?.message || null;
}
export async function excluirChefao(id) {
  const { error } = await supabase.from("chefoes").delete().eq("id", id);
  return error?.message || null;
}

/* ---------- ajustes manuais do gestor (ledger) ---------- */
export async function lancarAjuste(colaboradorId, xp, moedas, descricao) {
  const { error } = await supabase.from("eventos_xp").insert({
    colaborador_id: colaboradorId, origem: "ajuste", xp, moedas, descricao,
  });
  return error?.message || null;
}

/* ---------- conta ---------- */
export async function trocarSenha(nova) {
  const { error } = await supabase.auth.updateUser({ password: nova });
  return error?.message || null;
}

/* ---------- compras (loja / pets / mercado) ---------- */
async function debitar(colaboradorId, preco, descricao) {
  const { error } = await supabase.from("eventos_xp").insert({
    colaborador_id: colaboradorId, origem: "compra", xp: 0, moedas: -Math.abs(preco), descricao,
  });
  return error?.message || null;
}
export async function comprarSkin(colab, sk) {
  const e = await debitar(colab.id, sk.price, `Comprou a skin '${sk.name}'`);
  if (e) return e;
  return salvarPerfil(colab.id, { skin: sk.id, skins_possuidas: [...(colab.skins_possuidas || ["elite"]), sk.id] });
}
export async function comprarPet(colab, pt) {
  const e = await debitar(colab.id, pt.price, `Adotou o pet '${pt.name}'`);
  if (e) return e;
  return salvarPerfil(colab.id, { pet: pt.id, pets_possuidos: [...(colab.pets_possuidos || []), pt.id] });
}
export async function resgatarItem(colab, item) {
  const e = await debitar(colab.id, item.price, `Resgatou '${item.name}' no mercado`);
  if (e) return e;
  const { error } = await supabase.from("resgates").insert({ colaborador_id: colab.id, item: item.name, preco: item.price });
  return error?.message || null;
}
export async function marcarEntregue(id) {
  const { error } = await supabase.from("resgates").update({ status: "entregue" }).eq("id", id);
  return error?.message || null;
}

/* ---------- ideias ---------- */
export async function enviarIdeia(colaboradorId, titulo, descricao) {
  const { error } = await supabase.from("ideias").insert({ colaborador_id: colaboradorId, titulo, descricao });
  return error?.message || null;
}
export async function avaliarIdeia(ideia, impacto, xp) {
  const { error } = await supabase.from("ideias").update({ status: "avaliada", impacto }).eq("id", ideia.id);
  if (error) return error.message;
  const { error: e2 } = await supabase.from("eventos_xp").insert({
    colaborador_id: ideia.colaborador_id, origem: "ideia", xp, moedas: 0,
    descricao: `Ideia reconhecida: ${ideia.titulo}`, referencia_id: ideia.id,
  });
  return e2?.message || null;
}

/* ---------- provas ---------- */
export async function lancarProva(colaboradorId, nomeProva, nota, xpPorPonto) {
  const { error } = await supabase.from("eventos_xp").insert({
    colaborador_id: colaboradorId, origem: "prova",
    xp: Math.round(nota * xpPorPonto), moedas: 0,
    descricao: `Prova '${nomeProva}': nota ${nota}`,
  });
  return error?.message || null;
}

/* ---------- roleta da pontualidade (horário do servidor) ---------- */
export async function girarRoleta() {
  const { data, error } = await supabase.rpc("girar_roleta");
  if (error) return { status: "erro", msg: error.message };
  return data;
}
export async function meuIp() {
  const { data, error } = await supabase.rpc("meu_ip");
  return error ? null : data;
}
export async function lerConfig(chave) {
  const { data } = await supabase.from("config").select("valor").eq("chave", chave).maybeSingle();
  return data?.valor || "";
}
export async function salvarConfig(chave, valor) {
  const { error } = await supabase.from("config").upsert({ chave, valor });
  return error?.message || null;
}

/* ---------- ideias: exclusão pelo gestor ---------- */
export async function excluirIdeia(id) {
  const { error } = await supabase.from("ideias").delete().eq("id", id);
  return error?.message || null;
}

/* ---------- colinha do gestor (modelos de missão) ---------- */
export async function criarModelo(m) {
  const { error } = await supabase.from("modelos_missao").insert(m);
  return error?.message || null;
}
export async function excluirModelo(id) {
  const { error } = await supabase.from("modelos_missao").delete().eq("id", id);
  return error?.message || null;
}

/* ---------- prêmios por categoria ---------- */
export async function resgatarPremio(categoria) {
  const { data, error } = await supabase.rpc("resgatar_premio", { cat: categoria });
  if (error) return { status: "erro", msg: error.message };
  return data;
}
export async function salvarPremioCategoria(categoria, descricao) {
  const { error } = await supabase.from("premios_categoria").update({ descricao }).eq("categoria", categoria);
  return error?.message || null;
}
export async function entregarPremio(id) {
  const { error } = await supabase.from("premios_resgatados").update({ entregue: true }).eq("id", id);
  return error?.message || null;
}
