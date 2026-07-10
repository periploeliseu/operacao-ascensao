import React, { useState, useEffect, useCallback } from "react";
import { C, reqFor, BOSS_CAP, SKINS, titleFor, fmt, ago } from "./data/constants.js";
import { Avatar, HeroFigure, BossFigure } from "./components/figures.jsx";
import { Bar, Chip, Coin, btnStyle, inputStyle, cardStyle } from "./components/ui.jsx";
import BattleOverlay from "./components/BattleOverlay.jsx";
import { BossForm } from "./components/forms.jsx";
import Login from "./Login.jsx";
import {
  aoMudarSessao, sair, carregarTudo, salvarPerfil,
  criarMissao, desativarMissao, enviarConclusao, avaliarConclusao,
  convocarChefao, mudarStatusChefao, excluirChefao, lancarAjuste,
} from "./logic/api.js";

/* ============================================================
   OPERAÇÃO ASCENSÃO — Fase 3.1 (banco de dados central)
   Os dados agora vivem no Supabase. Este arquivo só EXIBE e
   dispara ações da camada de API (src/logic/api.js).
   ============================================================ */

/* Aparência determinística do avatar a partir do id (o banco não guarda cor) */
const TONES = ["#c98d63", "#8d5a3b", "#a06a44", "#d9a06f", "#b97a50", "#e3b48a", "#7a4a2e", "#caa27a"];
const HAIRS = ["#141420", "#241a12", "#101018", "#2b1a10", "#15161e", "#1c1410", "#30231a", "#0d0d12"];
function hashId(id) { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
function decorar(colab) {
  const h = hashId(colab.id);
  return { ...colab, name: colab.nome, nick: colab.apelido, tone: TONES[h % TONES.length], hair: HAIRS[(h >> 3) % HAIRS.length], skin: colab.skin || "elite" };
}

/* Nível calculado a partir do XP total do ledger */
function nivelDe(totalXp) {
  let xp = Math.max(0, totalXp), lvl = 1;
  while (xp >= reqFor(lvl) && lvl < 200) { xp -= reqFor(lvl); lvl++; }
  return { level: lvl, xp, req: reqFor(lvl) };
}

const dataBr = (iso) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

export default function App() {
  const [sessao, setSessao] = useState(undefined); /* undefined = verificando */
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [view, setView] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [battle, setBattle] = useState(null);
  const [editNick, setEditNick] = useState(false);
  const [nickDraft, setNickDraft] = useState("");
  const [extratoDe, setExtratoDe] = useState(null);

  useEffect(() => { aoMudarSessao(setSessao); }, []);

  const recarregar = useCallback(async () => {
    try { setDados(await carregarTudo()); setErro(null); }
    catch (e) { setErro(e.message || String(e)); }
  }, []);

  useEffect(() => {
    if (!sessao) return;
    recarregar();
    const iv = setInterval(recarregar, 30000);            /* sincroniza a cada 30s */
    const foco = () => recarregar();                       /* e ao voltar pra aba  */
    window.addEventListener("focus", foco);
    return () => { clearInterval(iv); window.removeEventListener("focus", foco); };
  }, [sessao, recarregar]);

  const notify = (msg, cor = C.green) => { setToast({ msg, cor }); setTimeout(() => setToast(null), 3500); };
  const agir = async (promessa, msgOk) => {
    const e = await promessa;
    if (e) notify(e, C.red); else { if (msgOk) notify(msgOk); recarregar(); }
  };

  if (sessao === undefined) return <Tela msg="Verificando acesso…" />;
  if (!sessao) return <Login />;
  if (erro) return <Tela msg={`Erro ao carregar: ${erro}`} extra={<button onClick={recarregar} style={btnStyle(C.violetHot)}>Tentar de novo</button>} />;
  if (!dados) return <Tela msg="Carregando Operação Ascensão…" />;

  /* ---------- montagem dos dados derivados (do ledger) ---------- */
  const colabs = dados.colabs.map(decorar);
  const me = colabs.find((c) => c.id === sessao.user.id);
  if (!me) return <Tela msg="Seu usuário ainda não tem ficha de colaborador. Fale com o gestor." extra={<button onClick={() => sair()} style={btnStyle(C.violetHot, true)}>Sair</button>} />;
  const gestor = !!me.is_gestor;

  const saldo = {};
  colabs.forEach((c) => { saldo[c.id] = { xp: 0, moedas: 0, mes: 0 }; });
  const mesAtual = new Date().getMonth(), anoAtual = new Date().getFullYear();
  dados.eventos.forEach((ev) => {
    const s = saldo[ev.colaborador_id]; if (!s) return;
    s.xp += ev.xp; s.moedas += ev.moedas;
    const d = new Date(ev.criado_em);
    if (ev.xp > 0 && d.getMonth() === mesAtual && d.getFullYear() === anoAtual) s.mes += ev.xp;
  });
  const nivel = nivelDe(saldo[me.id].xp);
  const ranked = [...colabs].sort((a, b) => saldo[b.id].mes - saldo[a.id].mes);
  const myRank = ranked.findIndex((c) => c.id === me.id) + 1;

  /* chefão: dano = missões ☠ APROVADAS de cada um, com teto individual */
  const chefao = dados.chefao;
  const cap = chefao ? Math.max(1, Math.ceil(chefao.hp_max / Math.max(1, colabs.length))) : BOSS_CAP;
  const dano = {};
  if (chefao) {
    colabs.forEach((c) => { dano[c.id] = 0; });
    dados.conclusoes.forEach((cl) => {
      if (cl.status === "aprovada" && cl.missoes?.chefao_id === chefao.id && dano[cl.colaborador_id] !== undefined) {
        dano[cl.colaborador_id] = Math.min(cap, dano[cl.colaborador_id] + cl.missoes.xp);
      }
    });
  }
  const danoTotal = chefao ? Object.values(dano).reduce((a, b) => a + b, 0) : 0;
  const hpAtual = chefao ? Math.max(0, chefao.hp_max - danoTotal) : 0;
  const prazoEstourado = chefao && chefao.status === "ativo" && Date.now() > new Date(chefao.prazo).getTime() && hpAtual > 0;

  const minhasConclusoes = dados.conclusoes.filter((cl) => cl.colaborador_id === me.id);
  const statusMissao = (m) => {
    const cl = minhasConclusoes.find((x) => x.missao_id === m.id && x.status !== "reprovada");
    return cl ? cl.status : null; /* null = disponível */
  };
  const pendentes = dados.conclusoes.filter((cl) => cl.status === "pendente");

  const aprovar = async (cl, sim) => {
    /* prepara a animação ANTES de aplicar, para capturar o HP anterior */
    let luta = null;
    if (sim && chefao && chefao.status === "ativo" && cl.missoes?.chefao_id === chefao.id) {
      const antes = dano[cl.colaborador_id] || 0;
      const d = Math.min(cl.missoes.xp, cap - antes, hpAtual);
      if (d > 0) {
        const kind = hpAtual - d <= 0 ? "victory" : antes + d >= cap ? "combo" : "hit";
        luta = { pid: cl.colaborador_id, dmg: d, kind, hpBefore: hpAtual, maxHp: chefao.hp_max, cap };
        if (kind === "victory") mudarStatusChefao(chefao.id, "derrotado");
      }
    }
    await agir(avaliarConclusao(cl, sim), sim ? "Aprovada — prêmio lançado no extrato." : "Reprovada. A missão volta a ficar disponível.");
    if (luta) setBattle(luta);
  };

  const NAV = [
    ["dashboard", "▦", "Dashboard"],
    ["missoes", "◎", "Missões"],
    ...(gestor ? [["aprovacoes", "✔", `Aprovações${pendentes.length ? ` (${pendentes.length})` : ""}`]] : []),
    ["chefao", "☠", "Chefão"],
    ["ranking", "♛", "Ranking"],
    ["extrato", "📅", "Extrato"],
    ...(gestor ? [["equipe", "👥", "Equipe"]] : []),
    ["manual", "📖", "Manual"],
  ];

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(1200px 600px at 70% -10%, #1a1040 0%, ${C.bg} 55%)`, color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif", display: "flex" }}>
      {/* ================= SIDEBAR ================= */}
      <aside style={{ width: 218, background: C.panel, borderRight: `1px solid ${C.border}`, padding: "18px 12px", display: "flex", flexDirection: "column", gap: 4, position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 18px" }}>
          <svg width="34" height="34" viewBox="0 0 40 40"><path d="M6 30 L16 10 L23 24 L28 16 L34 30 Z" fill="none" stroke={C.blue} strokeWidth="3.4" strokeLinejoin="round" /></svg>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.15 }}>OPERAÇÃO<br />ASCENSÃO</div>
            <div style={{ color: C.blue, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>ONLINE</div>
          </div>
        </div>
        {NAV.map(([id, ic, label]) => (
          <button key={id} onClick={() => setView(id)} style={{
            display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 10,
            background: view === id ? `linear-gradient(90deg, ${C.violetDeep}44, transparent)` : "transparent",
            border: view === id ? `1px solid ${C.violet}55` : "1px solid transparent",
            color: view === id ? C.text : C.dim, fontSize: 13.5, fontWeight: 600, cursor: "pointer", textAlign: "left",
          }}>
            <span style={{ width: 18, textAlign: "center" }}>{ic}</span>{label}
          </button>
        ))}
        <div style={{ marginTop: "auto", borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px 10px" }}>
            <Avatar p={me} size={36} ring={gestor ? C.gold : undefined} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{me.nick || me.name}</div>
              <div style={{ fontSize: 11, color: gestor ? C.gold : C.dim }}>{gestor ? "Gestor" : me.funcao}</div>
            </div>
          </div>
          <button onClick={() => sair()} style={{ ...btnStyle(C.dim, true), width: "100%" }}>Sair da conta</button>
        </div>
      </aside>

      {/* ================= MAIN ================= */}
      <main style={{ flex: 1, padding: "16px 22px 40px", maxWidth: 1400, minWidth: 0 }}>
        {/* HEADER */}
        <header style={{ display: "flex", alignItems: "center", gap: 22, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 18px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar p={me} size={46} ring={C.violet} />
            {editNick ? (
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input autoFocus value={nickDraft} onChange={(e) => setNickDraft(e.target.value.slice(0, 18))} placeholder="Nome de jogo" style={{ ...inputStyle, width: 160, padding: "7px 10px" }} />
                <button onClick={() => { agir(salvarPerfil(me.id, { apelido: nickDraft.trim() || null }), "Nome de jogo salvo."); setEditNick(false); }} style={{ ...btnStyle(C.violetHot), padding: "7px 12px", fontSize: 12 }}>OK</button>
              </div>
            ) : (
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, display: "flex", gap: 7, alignItems: "center" }}>
                  {me.nick || me.name}
                  <button onClick={() => { setNickDraft(me.nick || ""); setEditNick(true); }} title="Escolher nome de jogo" style={{ background: "none", border: "none", color: C.dim, cursor: "pointer", fontSize: 13, padding: 0 }}>✏️</button>
                </div>
                <div style={{ color: C.blue, fontSize: 12 }}>{me.nick ? `${me.name} · ${me.funcao}` : me.funcao}</div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ border: `2px solid ${C.violetHot}`, borderRadius: 10, padding: "4px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: C.dim, letterSpacing: 1 }}>NÍVEL</div>
              <div style={{ fontWeight: 900, fontSize: 20, color: C.violetHot }}>{nivel.level}</div>
            </div>
            <div style={{ width: 210 }}>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>XP · {titleFor(nivel.level)}</div>
              <Bar value={nivel.xp} max={nivel.req} />
              <div style={{ fontSize: 11, color: C.dim, textAlign: "right", marginTop: 3 }}>{fmt(nivel.xp)} / {fmt(nivel.req)}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Coin size={26} />
            <div><div style={{ fontSize: 10, color: C.dim, letterSpacing: 1 }}>FLIXCOINS</div><div style={{ fontWeight: 800, fontSize: 17 }}>{fmt(saldo[me.id].moedas)}</div></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>🏆</span>
            <div><div style={{ fontSize: 10, color: C.dim, letterSpacing: 1 }}>RANKING</div><div style={{ fontWeight: 800, fontSize: 17 }}>{myRank}º</div></div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 11, color: C.dim }}>XP no mês</div>
            <div style={{ fontWeight: 900, fontSize: 19, color: C.violetHot }}>{fmt(saldo[me.id].mes)}</div>
          </div>
        </header>

        {/* ============ DASHBOARD ============ */}
        {view === "dashboard" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 5fr) minmax(340px, 7fr)", gap: 16, marginTop: 16 }}>
            <section style={{ ...cardStyle, textAlign: "center" }}>
              <HeroFigure p={me} height={300} />
              <div style={{ marginTop: 10, fontWeight: 800, color: C.violetHot }}>{titleFor(nivel.level).toUpperCase()}</div>
              <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>{me.funcao} · Região {me.regiao} · Turno {String(me.turno).slice(0, 5)}</div>
            </section>
            <section style={{ display: "grid", gap: 16, alignContent: "start" }}>
              <div style={cardStyle}>
                <b style={{ fontSize: 12, letterSpacing: 1.5, color: C.dim }}>MINHAS MISSÕES</b>
                {dados.missoes.slice(0, 4).map((m) => {
                  const st = statusMissao(m);
                  return (
                    <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.border}55`, fontSize: 13 }}>
                      <span>{m.chefao_id ? "☠" : "◎"}</span>
                      <span style={{ flex: 1 }}>{m.nome} <span style={{ color: C.dim }}>· +{fmt(m.xp)} XP</span></span>
                      {st === "pendente" ? <Chip color={C.orange}>Aguardando gestor</Chip>
                        : st === "aprovada" ? <Chip color={C.green}>Concluída</Chip>
                        : <button onClick={() => agir(enviarConclusao(m.id, me.id), "Enviado para aprovação do gestor.")} style={{ ...btnStyle(C.violetHot), padding: "6px 14px", fontSize: 12 }}>Concluí</button>}
                    </div>
                  );
                })}
                <button onClick={() => setView("missoes")} style={{ ...btnStyle(C.violetHot, true), marginTop: 10, padding: "6px 14px", fontSize: 12 }}>Ver todas</button>
              </div>
              <div style={cardStyle}>
                <b style={{ fontSize: 12, letterSpacing: 1.5, color: C.dim }}>ÚLTIMAS CONQUISTAS DA EQUIPE</b>
                {dados.eventos.slice(0, 6).map((ev) => {
                  const p = colabs.find((c) => c.id === ev.colaborador_id);
                  if (!p) return null;
                  return (
                    <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}55`, fontSize: 12.5 }}>
                      <Avatar p={p} size={28} />
                      <span style={{ flex: 1 }}><b style={{ color: C.blue }}>{p.nick || p.name.split(" ")[0]}</b> {ev.descricao || ev.origem}</span>
                      {ev.xp !== 0 && <b style={{ color: ev.xp > 0 ? C.green : C.red }}>{ev.xp > 0 ? "+" : ""}{fmt(ev.xp)} XP</b>}
                      <span style={{ color: C.dim2, fontSize: 11 }}>{ago(new Date(ev.criado_em).getTime())}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}

        {/* ============ MISSÕES ============ */}
        {view === "missoes" && (
          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Missões</h2>
            <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>Marcou "Concluí"? A solicitação vai pra fila do gestor. O prêmio (XP visível + moedas surpresa) cai no extrato só depois da aprovação.</p>
            {dados.missoes.map((m) => {
              const st = statusMissao(m);
              return (
                <div key={m.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14, opacity: st === "aprovada" ? 0.55 : 1 }}>
                  <span style={{ fontSize: 22 }}>{m.chefao_id ? "☠" : "◎"}</span>
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: 14 }}>{m.nome}</b>
                    <div style={{ fontSize: 12, color: C.dim }}>
                      +{fmt(m.xp)} XP · {m.tipo === "diaria" ? "Diária" : m.tipo === "fixa" ? "Fixa" : "Esporádica"}
                      {m.chefao_id && <span style={{ color: C.orange }}> · vinculada ao Chefão</span>}
                      {gestor && m.moedas_ocultas > 0 && <span style={{ color: C.gold }}> · 🤫 {fmt(m.moedas_ocultas)} moedas (oculto)</span>}
                    </div>
                  </div>
                  {st === "pendente" ? <Chip color={C.orange}>Aguardando gestor</Chip>
                    : st === "aprovada" ? <Chip color={C.green}>Concluída</Chip>
                    : <button onClick={() => agir(enviarConclusao(m.id, me.id), "Enviado para aprovação do gestor.")} style={btnStyle(C.violetHot)}>Concluí</button>}
                  {gestor && <button onClick={() => agir(desativarMissao(m.id), "Missão desativada.")} style={{ ...btnStyle(C.red, true), padding: "7px 10px" }}>🗑</button>}
                </div>
              );
            })}
            {gestor && <NovaMissao chefao={chefao} onCriar={(m) => agir(criarMissao(m), "Missão criada.")} />}
          </div>
        )}

        {/* ============ APROVAÇÕES (gestor) ============ */}
        {view === "aprovacoes" && gestor && (
          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Fila de Aprovação</h2>
            <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>Confere se o serviço foi feito DE VERDADE. Aprovou: XP + moedas caem no extrato e, se a missão for ☠, o chefão apanha. Reprovou: nada acontece e a missão volta a ficar disponível.</p>
            {pendentes.length === 0 && <div style={{ ...cardStyle, color: C.dim2, fontSize: 13 }}>Fila limpa. Ninguém aguardando.</div>}
            {pendentes.map((cl) => {
              const p = colabs.find((c) => c.id === cl.colaborador_id);
              if (!p) return null;
              return (
                <div key={cl.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <Avatar p={p} size={36} />
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <b style={{ fontSize: 13.5 }}>{p.nick || p.name}</b> <span style={{ color: C.dim, fontSize: 13 }}>diz que concluiu</span>
                    <div style={{ fontSize: 13 }}>{cl.missoes?.chefao_id ? "☠ " : ""}{cl.missoes?.nome} <span style={{ color: C.dim }}>· +{fmt(cl.missoes?.xp || 0)} XP{cl.missoes?.moedas_ocultas ? ` · 🤫 ${fmt(cl.missoes.moedas_ocultas)} moedas` : ""}</span></div>
                    <div style={{ fontSize: 11, color: C.dim2 }}>{ago(new Date(cl.enviada_em).getTime())}</div>
                  </div>
                  <button onClick={() => aprovar(cl, true)} style={btnStyle(C.green)}>✔ Aprovar</button>
                  <button onClick={() => aprovar(cl, false)} style={btnStyle(C.red, true)}>✘ Reprovar</button>
                </div>
              );
            })}
          </div>
        )}

        {/* ============ CHEFÃO ============ */}
        {view === "chefao" && (
          <div style={{ marginTop: 16 }}>
            {chefao ? (
              <div style={{ ...cardStyle, textAlign: "center", background: `radial-gradient(500px 260px at 50% 0%, #2a104f55, ${C.panel})` }}>
                <Chip color={C.orange}>Chefão</Chip>
                <h2 style={{ margin: "10px 0 2px", fontSize: 26, letterSpacing: 1 }}>{chefao.nome}</h2>
                {chefao.foco && <div style={{ color: C.blue, fontSize: 13, marginBottom: 4 }}>🎯 Foco: {chefao.foco}</div>}
                <div style={{ color: C.gold, fontSize: 13, marginBottom: 10 }}>
                  🎁 Prêmio: {gestor || chefao.status === "derrotado"
                    ? <b>{chefao.premio_oculto}{chefao.extra ? ` + ${chefao.extra}` : ""}{gestor && chefao.status !== "derrotado" ? " (oculto p/ equipe)" : ""}</b>
                    : <b>??? — derrotem o chefão para descobrir</b>}
                </div>
                <BossFigure size={200} />
                <div style={{ maxWidth: 480, margin: "10px auto" }}>
                  <Bar value={hpAtual} max={chefao.hp_max} color={C.red} h={14} />
                  <div style={{ fontSize: 13, color: C.dim, marginTop: 5 }}>
                    {fmt(hpAtual)} / {fmt(chefao.hp_max)} HP
                    {chefao.status === "derrotado" && <b style={{ color: C.gold }}> — DERROTADO! 🏆</b>}
                    {chefao.status === "falhou" && <b style={{ color: C.red }}> — ELE VENCEU.</b>}
                    {prazoEstourado && <b style={{ color: C.red }}> — prazo estourado!</b>}
                  </div>
                  {chefao.status === "ativo" && !prazoEstourado && (
                    <div style={{ fontSize: 12.5, color: C.orange, marginTop: 4 }}>⏳ Tempo restante: {Math.max(0, Math.ceil((new Date(chefao.prazo).getTime() - Date.now()) / 864e5))} dia(s)</div>
                  )}
                </div>
                <p style={{ color: C.dim, fontSize: 13, maxWidth: 560, margin: "6px auto" }}>
                  Cota individual: <b style={{ color: C.text }}>{fmt(cap)} XP</b> de dano em missões ☠ aprovadas. A equipe vence junta ou não vence.
                </p>
                {gestor && (
                  <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 10, flexWrap: "wrap" }}>
                    {prazoEstourado && <button onClick={() => { agir(mudarStatusChefao(chefao.id, "falhou"), "Derrota registrada."); setBattle({ pid: me.id, dmg: 0, kind: "fail", hpBefore: hpAtual, maxHp: chefao.hp_max, cap }); }} style={btnStyle(C.red)}>Declarar derrota da equipe</button>}
                    <button onClick={() => agir(mudarStatusChefao(chefao.id, "arquivado"), "Chefão arquivado (histórico preservado).")} style={btnStyle(C.orange, true)}>Arquivar</button>
                    <button onClick={() => { if (window.confirm(`Excluir '${chefao.nome}' de vez? As missões vinculadas sobrevivem desvinculadas.`)) agir(excluirChefao(chefao.id), "Chefão excluído."); }} style={btnStyle(C.red, true)}>🗑 Excluir</button>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ ...cardStyle, textAlign: "center", color: C.dim }}>Nenhum chefão em campo. {gestor ? "Convoque o próximo abaixo." : "Aguardem a convocação do gestor."}</div>
            )}
            {chefao && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginTop: 14 }}>
                {colabs.map((p) => {
                  const c = dano[p.id] || 0;
                  return (
                    <div key={p.id} style={cardStyle}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                        <Avatar p={p} size={36} />
                        <div><b style={{ fontSize: 13 }}>{p.nick || p.name.split(" ")[0]}</b><div style={{ fontSize: 11, color: c >= cap ? C.green : C.dim }}>{c >= cap ? "Meta batida! ⚔️" : "Em combate"}</div></div>
                      </div>
                      <Bar value={c} max={cap} color={c >= cap ? C.green : C.violetHot} />
                      <div style={{ fontSize: 11.5, color: C.dim, marginTop: 4, textAlign: "right" }}>{fmt(c)} / {fmt(cap)} XP de dano</div>
                    </div>
                  );
                })}
              </div>
            )}
            {gestor && !chefao && <BossForm onSummon={(b) => agir(convocarChefao(b), "Chefão convocado. Vincule as missões ☠ a ele.")} />}
          </div>
        )}

        {/* ============ RANKING ============ */}
        {view === "ranking" && (
          <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Ranking do Mês — XP farmado</h2>
            {ranked.map((p, i) => (
              <div key={p.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14, border: i === 0 ? `1.5px solid ${C.gold}` : `1px solid ${C.border}` }}>
                <div style={{ fontSize: 22, width: 34, textAlign: "center" }}>{["🥇", "🥈", "🥉"][i] || `${i + 1}º`}</div>
                <Avatar p={p} size={40} />
                <div style={{ flex: 1 }}>
                  <b>{p.nick || p.name}</b>
                  <div style={{ fontSize: 12, color: C.dim }}>Nível {nivelDe(saldo[p.id].xp).level} · {titleFor(nivelDe(saldo[p.id].xp).level)}</div>
                </div>
                <b style={{ color: C.violetHot }}>{fmt(saldo[p.id].mes)} XP</b>
              </div>
            ))}
          </div>
        )}

        {/* ============ EXTRATO (histórico por data) ============ */}
        {view === "extrato" && (() => {
          const alvo = (gestor && extratoDe) || me.id;
          const eventosAlvo = dados.eventos.filter((ev) => ev.colaborador_id === alvo);
          const porDia = {};
          eventosAlvo.forEach((ev) => { const d = dataBr(ev.criado_em); (porDia[d] = porDia[d] || []).push(ev); });
          return (
            <div style={{ marginTop: 16, display: "grid", gap: 14, maxWidth: 760 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Extrato — o livro-razão</h2>
              {gestor && (
                <select value={alvo} onChange={(e) => setExtratoDe(e.target.value)} style={{ ...inputStyle, maxWidth: 320 }}>
                  {colabs.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              )}
              {Object.keys(porDia).length === 0 && <div style={{ ...cardStyle, color: C.dim2, fontSize: 13 }}>Nenhum evento ainda. Todo XP e moeda ganho ou perdido aparecerá aqui, dia a dia.</div>}
              {Object.entries(porDia).map(([dia, evs]) => (
                <div key={dia} style={cardStyle}>
                  <b style={{ fontSize: 13, letterSpacing: 1, color: C.violetHot }}>{dia}</b>
                  {evs.map((ev) => (
                    <div key={ev.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}55`, fontSize: 13, alignItems: "center" }}>
                      <Chip color={ev.xp < 0 || ev.moedas < 0 ? C.red : C.blue}>{ev.origem}</Chip>
                      <span style={{ flex: 1 }}>{ev.descricao || "—"}</span>
                      {ev.xp !== 0 && <b style={{ color: ev.xp > 0 ? C.green : C.red }}>{ev.xp > 0 ? "+" : ""}{fmt(ev.xp)} XP</b>}
                      {ev.moedas !== 0 && <b style={{ color: ev.moedas > 0 ? C.gold : C.red }}>{ev.moedas > 0 ? "+" : ""}{fmt(ev.moedas)} 🪙</b>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          );
        })()}

        {/* ============ EQUIPE (gestor) ============ */}
        {view === "equipe" && gestor && (
          <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Equipe</h2>
            <div style={{ ...cardStyle, fontSize: 13, color: C.dim }}>
              Para ADICIONAR alguém: Supabase → Authentication → Add user (e-mail + senha). A ficha nasce sozinha aqui. Depois ajuste função e turno abaixo.
            </div>
            {colabs.map((p) => (
              <FichaColab key={p.id} p={p} saldo={saldo[p.id]}
                onSalvar={(campos) => agir(salvarPerfil(p.id, campos), "Ficha atualizada.")}
                onAjuste={(xp, moedas, desc) => agir(lancarAjuste(p.id, xp, moedas, desc), "Ajuste lançado no extrato.")} />
            ))}
          </div>
        )}

        {/* ============ MANUAL ============ */}
        {view === "manual" && (
          <div style={{ marginTop: 16, display: "grid", gap: 12, maxWidth: 780 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>📖 Manual do Jogo</h2>
            {[
              ["As 4 Leis", "LEI 1: tudo gera XP. LEI 2: nada é de graça. LEI 3: nível conquistado é seu para sempre. LEI 4: todo mês existe algo novo."],
              ["Como funciona agora", "Cada um entra com a PRÓPRIA conta (e-mail e senha). Tudo que você faz vale para a equipe inteira, em qualquer aparelho — o jogo agora vive num banco de dados central."],
              ["Missões", "Marcou 'Concluí'? Vai para a fila do gestor. Ele confere o serviço de verdade. Aprovou: XP + moedas surpresa caem no seu extrato. Reprovou: nada acontece e você pode refazer direito. Não existe atalho."],
              ["☠ Chefão", "Vilão com foco definido pelo gestor. Só missões ☠ APROVADAS causam dano. Cada um tem uma cota; todos batem antes do prazo → prêmio secreto revelado. Um falhar → derrota da equipe."],
              ["Extrato", "Seu livro-razão: cada XP e moeda, ganho ou perdido, registrado com data e motivo. Transparência total — inclusive ajustes do gestor ficam visíveis."],
              ["Ranking", "XP farmado no mês corrente. O 1º lugar leva prêmios reais definidos pelo gestor."],
            ].map(([t, d]) => (
              <div key={t} style={cardStyle}>
                <b style={{ fontSize: 14 }}>{t}</b>
                <p style={{ color: C.dim, fontSize: 13, margin: "6px 0 0", lineHeight: 1.7 }}>{d}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* overlay de batalha */}
      {battle && (() => {
        const jogador = colabs.find((c) => c.id === battle.pid);
        if (!jogador) return null;
        return <BattleOverlay battle={battle}
          boss={{ kind: "Chefão", name: chefao?.nome || "Chefão", reward: chefao?.premio_oculto || "", extra: chefao?.extra || "" }}
          player={jogador} onDone={() => setBattle(null)} />;
      })()}

      {/* toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 22, right: 22, zIndex: 99, background: C.panel, border: `1.5px solid ${toast.cor}`, color: C.text, padding: "12px 18px", borderRadius: 12, fontSize: 13.5, fontWeight: 600, boxShadow: `0 0 24px ${toast.cor}44`, maxWidth: 340 }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ---------- telas simples ---------- */
function Tela({ msg, extra }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.dim, display: "flex", flexDirection: "column", gap: 16, alignItems: "center", justifyContent: "center", fontFamily: "system-ui", padding: 20, textAlign: "center" }}>
      <div>{msg}</div>{extra}
    </div>
  );
}

/* ---------- formulário: nova missão (gestor) ---------- */
function NovaMissao({ chefao, onCriar }) {
  const [nome, setNome] = useState("");
  const [xp, setXp] = useState("200");
  const [moedas, setMoedas] = useState("");
  const [tipo, setTipo] = useState("fixa");
  const [vinculada, setVinculada] = useState(true);
  return (
    <div style={{ ...cardStyle, border: `1px dashed ${C.border2}` }}>
      <b style={{ fontSize: 13, letterSpacing: 1, color: C.dim }}>GESTOR — NOVA MISSÃO</b>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 110px 1fr auto auto", gap: 10, marginTop: 10, alignItems: "center" }}>
        <input placeholder="Nome da missão" value={nome} onChange={(e) => setNome(e.target.value)} style={inputStyle} />
        <input placeholder="XP" value={xp} onChange={(e) => setXp(e.target.value.replace(/\D/g, ""))} style={inputStyle} />
        <input placeholder="Moedas 🤫" title="Oculto para a equipe" value={moedas} onChange={(e) => setMoedas(e.target.value.replace(/\D/g, ""))} style={inputStyle} />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={inputStyle}>
          <option value="fixa">Fixa</option>
          <option value="diaria">Diária</option>
          <option value="esporadica">Esporádica</option>
        </select>
        <label style={{ fontSize: 12.5, color: C.dim, display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={vinculada} disabled={!chefao} onChange={(e) => setVinculada(e.target.checked)} /> ☠ Chefão
        </label>
        <button disabled={!nome || !xp} onClick={() => {
          onCriar({ nome, xp: Number(xp), moedas_ocultas: Number(moedas) || 0, tipo, chefao_id: vinculada && chefao ? chefao.id : null });
          setNome(""); setMoedas("");
        }} style={{ ...btnStyle(C.violetHot), opacity: nome && xp ? 1 : 0.4 }}>Criar</button>
      </div>
      {!chefao && <div style={{ fontSize: 11.5, color: C.dim2, marginTop: 8 }}>Sem chefão ativo — convoque um na aba Chefão para vincular missões ☠.</div>}
    </div>
  );
}

/* ---------- ficha administrativa de colaborador (gestor) ---------- */
function FichaColab({ p, saldo, onSalvar, onAjuste }) {
  const [funcao, setFuncao] = useState(p.funcao || "");
  const [turno, setTurno] = useState(String(p.turno).slice(0, 5));
  const [xp, setXp] = useState("");
  const [moedas, setMoedas] = useState("");
  const [desc, setDesc] = useState("");
  const num = (v) => parseInt(v, 10) || 0;
  const info = nivelDe(saldo.xp);
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Avatar p={p} size={40} ring={p.is_gestor ? C.gold : undefined} />
        <div style={{ flex: 1, minWidth: 170 }}>
          <b>{p.nome}</b> {p.is_gestor && <Chip color={C.gold}>Gestor</Chip>}
          <div style={{ fontSize: 12, color: C.dim }}>Nível {info.level} · {fmt(saldo.xp)} XP total · {fmt(saldo.moedas)} moedas</div>
        </div>
        <input value={funcao} onChange={(e) => setFuncao(e.target.value)} placeholder="Função" style={{ ...inputStyle, width: 170 }} />
        <input value={turno} onChange={(e) => setTurno(e.target.value)} placeholder="Turno HH:MM" style={{ ...inputStyle, width: 110 }} />
        <button onClick={() => onSalvar({ funcao, turno })} style={{ ...btnStyle(C.violetHot, true), padding: "8px 14px", fontSize: 12 }}>Salvar ficha</button>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="± XP" value={xp} onChange={(e) => setXp(e.target.value.replace(/[^0-9-]/g, ""))} style={{ ...inputStyle, width: 100 }} />
        <input placeholder="± Moedas" value={moedas} onChange={(e) => setMoedas(e.target.value.replace(/[^0-9-]/g, ""))} style={{ ...inputStyle, width: 110 }} />
        <input placeholder="Motivo do ajuste (aparece no extrato)" value={desc} onChange={(e) => setDesc(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
        <button disabled={(!num(xp) && !num(moedas)) || !desc} onClick={() => { onAjuste(num(xp), num(moedas), desc); setXp(""); setMoedas(""); setDesc(""); }}
          style={{ ...btnStyle(C.gold, true), opacity: (num(xp) || num(moedas)) && desc ? 1 : 0.4, padding: "8px 14px", fontSize: 12 }}>Lançar ajuste</button>
      </div>
    </div>
  );
}
