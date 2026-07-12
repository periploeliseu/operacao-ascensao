import React, { useState, useEffect, useCallback } from "react";
import { C, reqFor, BOSS_CAP, SKINS, PETS, MARKET, titleFor, patenteDe, CATEGORIAS, fmt, ago } from "./data/constants.js";
import { tocar } from "./logic/som.js";
import { Avatar, HeroFigure, BossFigure } from "./components/figures.jsx";
import { Bar, Chip, Coin, btnStyle, inputStyle, cardStyle } from "./components/ui.jsx";
import BattleOverlay from "./components/BattleOverlay.jsx";
import { BossForm } from "./components/forms.jsx";
import Login from "./Login.jsx";
import {
  aoMudarSessao, sair, carregarTudo, salvarPerfil,
  criarMissao, desativarMissao, enviarConclusao, avaliarConclusao,
  convocarChefao, mudarStatusChefao, excluirChefao, lancarAjuste,
  trocarSenha, comprarSkin, comprarPet, resgatarItem, marcarEntregue,
  enviarIdeia, avaliarIdeia, lancarProva,
  girarRoleta, meuIp, lerConfig, salvarConfig,
  excluirIdeia, criarModelo, excluirModelo,
  resgatarPremio, salvarPremioCategoria, entregarPremio,
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
  return { ...colab, name: colab.nome, nick: colab.apelido, tone: TONES[h % TONES.length], hair: HAIRS[(h >> 3) % HAIRS.length], skin: colab.skin || "elite", skins_possuidas: colab.skins_possuidas || ["elite"], pets_possuidos: colab.pets_possuidos || [], corpo: colab.corpo || "m" };
}

/* Nível calculado a partir do XP total do ledger */
function nivelDe(totalXp) {
  let xp = Math.max(0, totalXp), lvl = 1;
  while (xp >= reqFor(lvl) && lvl < 200) { xp -= reqFor(lvl); lvl++; }
  return { level: lvl, xp, req: reqFor(lvl) };
}

/* Herói no palco, em ordem de preferência:
   1. Modelo 3D girando 360° — /assets/heroi-{cat}-{corpo}.glb (quando você gerar)
   2. Recorte transparente     — /assets/heroi-{cat}-{corpo}.png
   3. Boneco SVG (plano B eterno) */
function HeroArt({ p, pat, height }) {
  const [erro, setErro] = useState(false);
  const [glb, setGlb] = useState(false);
  const slug = pat.categoria.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "");
  const corpo = p.corpo || "m";
  const src3d = `/assets/heroi-${slug}-${corpo}.glb`;
  const srcImg = `/assets/heroi-${slug}-${corpo}.png`;
  useEffect(() => {
    setGlb(false); setErro(false);
    fetch(src3d, { method: "HEAD" })
      .then((r) => setGlb(r.ok && !(r.headers.get("content-type") || "").includes("text/html")))
      .catch(() => setGlb(false));
  }, [src3d]);
  if (glb) {
    return (
      <model-viewer src={src3d} camera-controls auto-rotate autoplay shadow-intensity="1" exposure="0.9"
        style={{ width: height * 0.62, height, display: "block" }} />
    );
  }
  if (erro) return <HeroFigure p={p} height={height} />;
  return (
    <img key={srcImg} src={srcImg} alt={pat.titulo} onError={() => setErro(true)}
      style={{ height, display: "block", filter: "drop-shadow(0 6px 30px rgba(168,85,247,.45)) drop-shadow(0 0 12px rgba(56,189,248,.2))" }} />
  );
}

/* XP total acumulado necessário para ALCANÇAR um nível */
function xpTotalParaNivel(l) { let t = 0; for (let i = 1; i < l; i++) t += reqFor(i); return t; }

/* sequência 🔥: dias consecutivos com giro na roleta */
function calcSequencia(eventos, pid) {
  const dias = new Set(eventos.filter((e) => e.colaborador_id === pid && e.origem === "roleta").map((e) => new Date(e.criado_em).toDateString()));
  let seq = 0;
  const d = new Date();
  if (!dias.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (dias.has(d.toDateString())) { seq++; d.setDate(d.getDate() - 1); }
  return seq;
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
  const [lojaTab, setLojaTab] = useState("SKINS");
  const [senhaModal, setSenhaModal] = useState(false);
  const [wheel, setWheel] = useState(null);
  const [secoes, setSecoes] = useState({ lista: true, escada: false, feed: false });
  const [catAberta, setCatAberta] = useState(null); /* null = abre a categoria atual */
  const [fundoOk, setFundoOk] = useState(false);
  useEffect(() => { const i = new Image(); i.onload = () => setFundoOk(true); i.src = "/assets/fundo-palco.png"; }, []);
  const [novaSenha, setNovaSenha] = useState("");

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
  const pat = patenteDe(nivel.level);
  const ranked = [...colabs].sort((a, b) => saldo[b.id].mes - saldo[a.id].mes);
  const myRank = ranked.findIndex((c) => c.id === me.id) + 1;

  /* chefão: dano = missões ☠ APROVADAS de cada um, com teto individual */
  const chefao = dados.chefao;
  const cap = chefao ? Math.max(1, Math.ceil(chefao.hp_max / Math.max(1, colabs.length))) : BOSS_CAP;
  const dano = {};
  if (chefao) {
    colabs.forEach((c) => { dano[c.id] = 0; });
    dados.eventos.forEach((ev) => {
      if (ev.origem === "missao" && ev.referencia_id === chefao.id && dano[ev.colaborador_id] !== undefined) {
        dano[ev.colaborador_id] = Math.min(cap, dano[ev.colaborador_id] + ev.xp);
      }
    });
  }
  const danoTotal = chefao ? Object.values(dano).reduce((a, b) => a + b, 0) : 0;
  const hpAtual = chefao ? Math.max(0, chefao.hp_max - danoTotal) : 0;
  const prazoEstourado = chefao && chefao.status === "ativo" && Date.now() > new Date(chefao.prazo).getTime() && hpAtual > 0;

  const minhasConclusoes = dados.conclusoes.filter((cl) => cl.colaborador_id === me.id);
  const hojeStr = new Date().toDateString();
  const statusMissao = (m) => {
    const cl = minhasConclusoes.find((x) =>
      x.missao_id === m.id && x.status !== "reprovada" &&
      (m.tipo === "esporadica" || new Date(x.enviada_em).toDateString() === hojeStr)
    );
    return cl ? cl.status : null; /* null = disponível (fixa/diária renovam à meia-noite) */
  };
  const pendentes = dados.conclusoes.filter((cl) => cl.status === "pendente");
  const disponiveis = dados.missoes.filter((m) => statusMissao(m) === null).length;

  const aprovar = async (cl, sim) => {
    tocar(sim ? "golpe" : "derrota", 0.5);
    /* prepara a animação ANTES de aplicar, para capturar o HP anterior */
    let luta = null;
    if (sim && chefao && chefao.status === "ativo" && cl.missoes?.chefao_id === chefao.id) {
      const antes = dano[cl.colaborador_id] || 0;
      const d = Math.min(cl.missoes.xp, cap - antes, hpAtual);
      if (d > 0) {
        const kind = hpAtual - d <= 0 ? "victory" : antes + d >= cap ? "combo" : "hit";
        luta = { pid: cl.colaborador_id, dmg: d, kind, hpBefore: hpAtual, maxHp: chefao.hp_max, cap };
        if (kind === "victory") { tocar("vitoria", 0.7); mudarStatusChefao(chefao.id, "derrotado"); }
      }
    }
    await agir(avaliarConclusao(cl, sim), sim ? "Aprovada — prêmio lançado no extrato." : "Reprovada. A missão volta a ficar disponível.");
    if (luta) setBattle(luta);
  };

  const girar = async () => {
    const r = await girarRoleta();
    if (r.status === "ok") {
      tocar("moeda");
      setWheel({ spinning: true, rotulo: r.rotulo });
      setTimeout(() => { setWheel((w) => w && { ...w, spinning: false }); recarregar(); }, 2600);
    } else {
      const msgs = {
        ja_girou: "Você já girou a roleta hoje. Amanhã tem mais.",
        cedo: `A roleta abre às ${r.abre || "seu turno"} em ponto e fecha 5 minutos depois.`,
        atrasado: "Janela perdida: -20 XP e sequência zerada. Amanhã é revanche.",
        ip_bloqueado: "A roleta só gira na rede da empresa.",
        sem_ficha: "Sua ficha de colaborador não foi encontrada.",
      };
      notify(msgs[r.status] || r.msg || "Não foi possível girar.", r.status === "atrasado" ? C.red : C.orange);
      if (r.status === "atrasado") recarregar();
    }
  };

  /* Menu em dois blocos: GESTÃO (exclusivo do gestor) e JOGO (o que a equipe também vê) */
  const NAV_GESTAO = gestor ? [
    ["aprovacoes", "✔", `Aprovações${pendentes.length ? ` (${pendentes.length})` : ""}`],
    ["missoes", "◎", "Missões"],
    ["provas", "✎", "Provas"],
    ["colinha", "🗒", "Colinha"],
    ["equipe", "👥", "Equipe"],
  ] : [];
  const NAV_JOGO = [
    ["dashboard", "▦", "Dashboard"],
    ["chefao", "☠", "Chefão"],
    ["ranking", "♛", "Ranking"],
    ["loja", "🛍", "Loja"],
    ["mercado", "🛒", "Mercado"],
    ["ideias", "💡", "Ideias"],
    ["extrato", "📅", "Extrato"],
    ["manual", "📖", "Manual"],
  ];
  const navBtn = ([id, ic, label], cor) => (
    <button key={id} onClick={() => setView(id)} style={{
      display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 10,
      background: view === id ? `linear-gradient(90deg, ${cor}33, transparent)` : "transparent",
      border: view === id ? `1px solid ${cor}66` : "1px solid transparent",
      color: view === id ? C.text : C.dim, fontSize: 13.5, fontWeight: 600, cursor: "pointer", textAlign: "left", width: "100%",
    }}>
      <span style={{ width: 18, textAlign: "center" }}>{ic}</span>{label}
    </button>
  );
  /* rótulo para o gestor: apelido escolhido + nome real, sem alterar nada no banco */
  const rotulo = (p) => (gestor && p.nick ? `${p.nick} (${p.name.split(" ")[0]})` : (p.nick || p.name));

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
        {gestor && (
          <>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.gold, padding: "2px 12px 6px" }}>🛠 GESTÃO — SÓ VOCÊ</div>
            {NAV_GESTAO.map((item) => navBtn(item, C.gold))}
            <div style={{ borderTop: `1px solid ${C.border}`, margin: "10px 4px" }} />
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.dim, padding: "2px 12px 6px" }}>🎮 JOGO — TODOS VEEM</div>
          </>
        )}
        {NAV_JOGO.map((item) => navBtn(item, C.violetHot))}
        <div style={{ marginTop: "auto", borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px 10px" }}>
            <Avatar p={me} size={36} ring={gestor ? C.gold : undefined} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{me.nick || me.name}</div>
              <div style={{ fontSize: 11, color: gestor ? C.gold : C.dim }}>{gestor ? "Gestor" : me.funcao}</div>
            </div>
          </div>
          <button onClick={() => { setNovaSenha(""); setSenhaModal(true); }} style={{ ...btnStyle(C.violetHot, true), width: "100%", marginBottom: 8 }}>🔑 Trocar senha</button>
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
              <div style={{ fontSize: 11, marginBottom: 4 }}><span style={{ color: C.dim }}>XP · </span><b style={{ color: pat.cor }}>{pat.icone} {pat.titulo}</b></div>
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
          <button onClick={() => setView("missoes")} style={{ ...btnStyle(C.violetHot, view !== "missoes"), padding: "9px 16px", fontSize: 13 }}>
            ◎ Minhas Missões{disponiveis > 0 ? ` (${disponiveis})` : ""}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🔥</span>
            <div><div style={{ fontSize: 10, color: C.dim, letterSpacing: 1 }}>SEQUÊNCIA</div><div style={{ fontWeight: 800, fontSize: 17, color: C.orange }}>{calcSequencia(dados.eventos, me.id)} dias</div></div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 11, color: C.dim }}>XP no mês</div>
            <div style={{ fontWeight: 900, fontSize: 19, color: C.violetHot }}>{fmt(saldo[me.id].mes)}</div>
          </div>
        </header>

        {/* ============ DASHBOARD (palco decorativo) ============ */}
        {view === "dashboard" && (
          <div style={{ marginTop: 16, position: "relative", overflow: "hidden", borderRadius: 18, border: `1px solid ${C.border}`, minHeight: "74vh", display: "flex", alignItems: "center", justifyContent: "center", background: fundoOk
            ? `linear-gradient(180deg, rgba(4,6,14,.35) 0%, rgba(4,6,14,.75) 100%), url(/assets/fundo-palco.png) center / cover no-repeat`
            : `radial-gradient(900px 520px at 50% 8%, #2a104f66 0%, transparent 60%), radial-gradient(700px 420px at 18% 92%, #10306055 0%, transparent 60%), linear-gradient(180deg, #0b1120, #070b16)` }}>
            <div className="orbe o1" />
            <div className="orbe o2" />
            <div className="orbe o3" />
            <div className="grade" />
            <div style={{ position: "relative", textAlign: "center", padding: 20 }}>
              <div className="aura" style={{ position: "relative", display: "inline-block" }}>
                <HeroArt p={me} pat={pat} height={430} />
                {me.pet && <div className="pet-float" style={{ position: "absolute", bottom: 24, right: -46, fontSize: 52 }}>{(PETS.find((x) => x.id === me.pet) || {}).icon}</div>}
              </div>
              <div style={{ marginTop: 16, fontWeight: 900, fontSize: 24, letterSpacing: 4, color: pat.cor, textShadow: `0 0 28px ${pat.cor}99` }}>
                {pat.titulo.toUpperCase()}
              </div>
              <div style={{ marginTop: 4, fontSize: 12, fontWeight: 700, letterSpacing: 2, color: C.dim }}>{pat.icone} CATEGORIA {pat.categoria.toUpperCase()}</div>
              <button onClick={girar} style={{ ...btnStyle(C.violetHot), marginTop: 18, padding: "11px 26px" }}>🎰 Roleta da Pontualidade</button>
              <div style={{ fontSize: 11, color: C.dim2, marginTop: 8 }}>Abre às {String(me.turno).slice(0, 5)} e fecha 5 min depois — pelo relógio do servidor.</div>
              <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center", alignItems: "center", fontSize: 11.5, color: C.dim }}>
                Personagem:
                {[["m", "Masculino"], ["f", "Feminino"]].map(([v, l]) => (
                  <button key={v} onClick={() => me.corpo !== v && agir(salvarPerfil(me.id, { corpo: v }), "Personagem atualizado.")}
                    style={{ ...btnStyle(C.violetHot, me.corpo !== v), padding: "4px 12px", fontSize: 11 }}>{l}</button>
                ))}
              </div>
            </div>
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
                      {m.atribuidos && m.atribuidos.length > 0 && <span style={{ color: C.blue }}> · → {m.atribuidos.map((id) => (colabs.find((c) => c.id === id) || {}).nome?.split(" ")[0] || "?").join(", ")}</span>}
                    </div>
                  </div>
                  {st === "pendente" ? <Chip color={C.orange}>Aguardando gestor</Chip>
                    : st === "aprovada" ? <Chip color={C.green}>Concluída</Chip>
                    : <button onClick={() => agir(enviarConclusao(m.id, me.id), "Enviado para aprovação do gestor.")} style={btnStyle(C.violetHot)}>Concluí</button>}
                  {gestor && <button onClick={() => agir(desativarMissao(m.id), "Missão desativada.")} style={{ ...btnStyle(C.red, true), padding: "7px 10px" }}>🗑</button>}
                </div>
              );
            })}
            {gestor && <NovaMissao chefao={chefao} colabs={colabs} onCriar={async (m, salvarNaColinha) => {
              if (salvarNaColinha) await criarModelo({ nome: m.nome, xp: m.xp, moedas_ocultas: m.moedas_ocultas, tipo: m.tipo, atribuidos: m.atribuidos });
              agir(criarMissao(m), salvarNaColinha ? "Missão criada e salva na colinha." : "Missão criada.");
            }} />}
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
                    <b style={{ fontSize: 13.5 }}>{p.nick ? `${p.nick} (${p.name})` : p.name}</b> <span style={{ color: C.dim, fontSize: 13 }}>diz que concluiu</span>
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
                        <div><b style={{ fontSize: 13 }}>{rotulo(p)}</b><div style={{ fontSize: 11, color: c >= cap ? C.green : C.dim }}>{c >= cap ? "Meta batida! ⚔️" : "Em combate"}</div></div>
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
        {/* ============ RANKING (seções recolhíveis) ============ */}
        {view === "ranking" && (() => {
          const catAtual = Math.floor(Math.min(44, nivel.level - 1) / 5);
          const abertaIdx = catAberta === null ? catAtual : catAberta;
          const Cab = ({ aberto, onClick, children }) => (
            <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: "none", border: "none", color: C.text, cursor: "pointer", padding: 0, textAlign: "left", fontSize: 14, fontWeight: 800, letterSpacing: 1 }}>
              <span style={{ color: C.violetHot, fontSize: 15 }}>{aberto ? "▾" : "▸"}</span>{children}
            </button>
          );
          return (
            <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Ranking</h2>

              {/* --- colaboradores do mês --- */}
              <div style={cardStyle}>
                <Cab aberto={secoes.lista} onClick={() => setSecoes((s) => ({ ...s, lista: !s.lista }))}>👥 COLABORADORES — XP DO MÊS</Cab>
                {secoes.lista && ranked.map((p, i) => (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0", borderBottom: `1px solid ${C.border}55`, background: i === 0 ? `linear-gradient(90deg, ${C.gold}11, transparent)` : "none" }}>
                    <div style={{ fontSize: 20, width: 34, textAlign: "center" }}>{["🥇", "🥈", "🥉"][i] || `${i + 1}º`}</div>
                    <Avatar p={p} size={38} />
                    <div style={{ flex: 1 }}>
                      <b>{p.nick || p.name}</b>{gestor && p.nick && <span style={{ color: C.dim, fontWeight: 400, fontSize: 13 }}> — {p.name}</span>}
                      <div style={{ fontSize: 12, color: patenteDe(nivelDe(saldo[p.id].xp).level).cor }}>
                        {patenteDe(nivelDe(saldo[p.id].xp).level).icone} Nível {nivelDe(saldo[p.id].xp).level} · {patenteDe(nivelDe(saldo[p.id].xp).level).titulo}
                      </div>
                    </div>
                    <b style={{ color: C.violetHot }}>{fmt(saldo[p.id].mes)} XP</b>
                  </div>
                ))}
              </div>

              {/* --- a escada com prêmios --- */}
              <div style={cardStyle}>
                <Cab aberto={secoes.escada} onClick={() => setSecoes((s) => ({ ...s, escada: !s.escada }))}>🎖 A ESCADA — 45 PATENTES · 9 CATEGORIAS</Cab>
                {secoes.escada && CATEGORIAS.map((cat, ci) => {
                  const nivelEntrada = ci * 5 + 1;
                  const alcancouCat = nivel.level >= nivelEntrada;
                  const aberta = abertaIdx === ci;
                  const premio = dados.premios.find((p) => p.categoria === ci + 1);
                  const meuResgate = dados.premiosResgatados.find((r) => r.categoria === ci + 1 && r.colaborador_id === me.id);
                  const pendentesCat = dados.premiosResgatados.filter((r) => r.categoria === ci + 1 && !r.entregue);
                  return (
                    <div key={cat.nome} style={{ marginTop: 10, border: `1px solid ${aberta ? cat.cor + "55" : C.border}`, borderRadius: 12, padding: "10px 14px", opacity: alcancouCat ? 1 : 0.75 }}>
                      <button onClick={() => setCatAberta(aberta ? -1 : ci)} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}>
                        <span style={{ color: cat.cor }}>{aberta ? "▾" : "▸"}</span>
                        <span style={{ fontWeight: 800, color: cat.cor, letterSpacing: 1.5, fontSize: 13 }}>{cat.icone} {cat.nome.toUpperCase()}</span>
                        <span style={{ color: C.dim2, fontSize: 11 }}>· níveis {nivelEntrada}–{nivelEntrada + 4}</span>
                        <span style={{ marginLeft: "auto", fontSize: 12 }}>{alcancouCat ? "✅" : "🔒"}</span>
                      </button>
                      {aberta && (
                        <>
                          {ci >= 1 && premio && (
                            <div style={{ margin: "10px 0 4px", padding: "9px 12px", background: `${cat.cor}11`, border: `1px dashed ${cat.cor}55`, borderRadius: 10, fontSize: 12.5 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span>🎁 <b style={{ color: cat.cor }}>Recompensa da categoria:</b> {premio.descricao}</span>
                                {alcancouCat && !meuResgate && !me.is_gestor && (
                                  <button onClick={async () => {
                                    const r = await resgatarPremio(ci + 1);
                                    if (r.status === "ok") { notify("Recompensa resgatada! O gestor vai providenciar."); recarregar(); }
                                    else notify(r.status === "ja_resgatado" ? "Você já resgatou esta recompensa." : r.msg || "Não foi possível resgatar.", C.orange);
                                  }} style={{ ...btnStyle(cat.cor), padding: "6px 14px", fontSize: 11.5 }}>🎁 Resgatar recompensa</button>
                                )}
                                {meuResgate && <Chip color={meuResgate.entregue ? C.green : C.orange}>{meuResgate.entregue ? "Entregue ✓" : "Resgatada — aguardando entrega"}</Chip>}
                              </div>
                              {gestor && (
                                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                                  <EditaPremio premio={premio} onSalvar={(d) => agir(salvarPremioCategoria(ci + 1, d), "Prêmio da categoria atualizado.")} />
                                </div>
                              )}
                              {gestor && pendentesCat.length > 0 && pendentesCat.map((r) => {
                                const p = colabs.find((c) => c.id === r.colaborador_id);
                                return (
                                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12 }}>
                                    <span>⏳ <b>{p ? p.nome : "?"}</b> resgatou — providenciar</span>
                                    <button onClick={() => agir(entregarPremio(r.id), "Entrega registrada.")} style={{ ...btnStyle(C.green, true), padding: "4px 10px", fontSize: 11 }}>Marcar entregue</button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {cat.patentes.map((pt, pi) => {
                            const lv = nivelEntrada + pi;
                            const alcancado = nivel.level >= lv;
                            const atual = nivel.level === lv || (lv === 45 && nivel.level > 45);
                            return (
                              <div key={pt} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0 6px 22px", borderBottom: `1px solid ${C.border}44`, fontSize: 12.5, opacity: alcancado ? 1 : 0.6 }}>
                                <span style={{ width: 18, textAlign: "center" }}>{alcancado ? "✅" : "🔒"}</span>
                                <b style={{ flex: 1, color: atual ? cat.cor : C.text }}>{pt}{atual && <span style={{ color: C.gold }}> ← você está aqui</span>}</b>
                                <span style={{ color: C.dim }}>nível {lv}</span>
                                <b style={{ color: C.blue, minWidth: 105, textAlign: "right" }}>{fmt(xpTotalParaNivel(lv))} XP</b>
                              </div>
                            );
                          })}
                        </>
                      )}
                    </div>
                  );
                })}
                {secoes.escada && <div style={{ fontSize: 11.5, color: C.dim2, marginTop: 10 }}>LEI 3: patente alcançada é sua para sempre. Recompensa de categoria: 1 resgate por pessoa, validado pelo servidor.</div>}
              </div>

              {/* --- conquistas da equipe --- */}
              <div style={cardStyle}>
                <Cab aberto={secoes.feed} onClick={() => setSecoes((s) => ({ ...s, feed: !s.feed }))}>🏅 ÚLTIMAS CONQUISTAS DA EQUIPE</Cab>
                {secoes.feed && dados.eventos.slice(0, 12).map((ev) => {
                  const p = colabs.find((c) => c.id === ev.colaborador_id);
                  if (!p) return null;
                  return (
                    <div key={ev.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}55`, fontSize: 12.5 }}>
                      <Avatar p={p} size={28} />
                      <span style={{ flex: 1 }}><b style={{ color: C.blue }}>{rotulo(p)}</b> {ev.descricao || ev.origem}</span>
                      {ev.xp !== 0 && <b style={{ color: ev.xp > 0 ? C.green : C.red }}>{ev.xp > 0 ? "+" : ""}{fmt(ev.xp)} XP</b>}
                      <span style={{ color: C.dim2, fontSize: 11 }}>{ago(new Date(ev.criado_em).getTime())}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

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
            <TravaRoleta notify={notify} />
            {colabs.map((p) => (
              <FichaColab key={p.id} p={p} saldo={saldo[p.id]}
                onSalvar={(campos) => agir(salvarPerfil(p.id, campos), "Ficha atualizada.")}
                onAjuste={(xp, moedas, desc) => agir(lancarAjuste(p.id, xp, moedas, desc), "Ajuste lançado no extrato.")} />
            ))}
          </div>
        )}

        {/* ============ LOJA (skins e pets) ============ */}
        {view === "loja" && (
          <div style={{ marginTop: 16 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Loja</h2>
            <p style={{ color: C.dim, fontSize: 13 }}>LEI 2: toda recompensa custa esforço. Seu saldo: <b style={{ color: C.gold }}>{fmt(saldo[me.id].moedas)} moedas</b>.</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              {["SKINS", "PETS"].map((t) => (
                <button key={t} onClick={() => setLojaTab(t)} style={{ ...btnStyle(C.violetHot, lojaTab !== t), padding: "7px 16px", fontSize: 12 }}>{t}</button>
              ))}
            </div>
            {lojaTab === "SKINS" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
                {SKINS.map((sk) => {
                  const possui = me.skins_possuidas.includes(sk.id);
                  const equipada = me.skin === sk.id;
                  const bloqueada = sk.lockedLevel && nivel.level < sk.lockedLevel;
                  return (
                    <div key={sk.id} style={{ ...cardStyle, textAlign: "center", border: equipada ? `1.5px solid ${C.violetHot}` : `1px solid ${C.border}` }}>
                      <div style={{ height: 140, display: "flex", alignItems: "center", justifyContent: "center", filter: bloqueada ? "brightness(.22)" : "none" }}>
                        <HeroFigure p={{ ...me, skin: sk.id }} height={135} />
                      </div>
                      <b style={{ fontSize: 13.5 }}>{bloqueada ? "Skin Secreta" : sk.name}</b>
                      <div style={{ marginTop: 8 }}>
                        {bloqueada ? <div style={{ fontSize: 12, color: C.dim }}>🔒 Nível {sk.lockedLevel}</div>
                          : equipada ? <Chip color={C.green}>Equipada</Chip>
                          : possui ? <button onClick={() => agir(salvarPerfil(me.id, { skin: sk.id }), "Skin equipada!")} style={btnStyle(C.violetHot, true)}>Equipar</button>
                          : <button onClick={() => { if (saldo[me.id].moedas < sk.price) return notify("Moedas insuficientes. Farme mais.", C.red); { tocar("moeda"); agir(comprarSkin(me, sk), `Skin '${sk.name}' comprada e equipada!`); } }} style={{ ...btnStyle(C.gold), display: "inline-flex", gap: 7, alignItems: "center" }}><Coin size={14} /> {fmt(sk.price)}</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
                {PETS.map((pt) => {
                  const possui = me.pets_possuidos.includes(pt.id);
                  const junto = me.pet === pt.id;
                  return (
                    <div key={pt.id} style={{ ...cardStyle, textAlign: "center", border: junto ? `1.5px solid ${C.violetHot}` : `1px solid ${C.border}` }}>
                      <div style={{ fontSize: 44 }}>{pt.icon}</div>
                      <b style={{ fontSize: 13, display: "block", margin: "8px 0" }}>{pt.name}</b>
                      {junto ? <Chip color={C.green}>Junto de você</Chip>
                        : possui ? <button onClick={() => agir(salvarPerfil(me.id, { pet: pt.id }), "Pet equipado!")} style={btnStyle(C.violetHot, true)}>Equipar</button>
                        : <button onClick={() => { if (saldo[me.id].moedas < pt.price) return notify("Moedas insuficientes.", C.red); { tocar("moeda"); agir(comprarPet(me, pt), `${pt.name} adotado!`); } }} style={{ ...btnStyle(C.gold), display: "inline-flex", gap: 7, alignItems: "center" }}><Coin size={14} /> {fmt(pt.price)}</button>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============ MERCADO ============ */}
        {view === "mercado" && (
          <div style={{ marginTop: 16 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Mercado FlixCoin</h2>
            <p style={{ color: C.dim, fontSize: 13 }}>Recompensas REAIS. O resgate fica pendente até o gestor entregar. Saldo: <b style={{ color: C.gold }}>{fmt(saldo[me.id].moedas)}</b>.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 14 }}>
              {MARKET.map((it) => (
                <div key={it.id} style={{ ...cardStyle, textAlign: "center" }}>
                  <div style={{ fontSize: 38 }}>{it.icon}</div>
                  <b style={{ fontSize: 13, display: "block", margin: "8px 0" }}>{it.name}</b>
                  <button onClick={() => { if (saldo[me.id].moedas < it.price) return notify("Moedas insuficientes. LEI 2.", C.red); { tocar("moeda"); agir(resgatarItem(me, it), "Resgate registrado! O gestor vai providenciar."); } }} style={{ ...btnStyle(C.gold), display: "inline-flex", gap: 7, alignItems: "center" }}><Coin size={14} /> {fmt(it.price)}</button>
                </div>
              ))}
            </div>
            {dados.resgates.filter((r) => gestor || r.colaborador_id === me.id).length > 0 && (
              <div style={{ ...cardStyle, marginTop: 16 }}>
                <b style={{ fontSize: 13, letterSpacing: 1, color: C.dim }}>RESGATES {gestor ? "(providenciar)" : ""}</b>
                {dados.resgates.filter((r) => gestor || r.colaborador_id === me.id).map((r) => {
                  const p = colabs.find((c) => c.id === r.colaborador_id);
                  return (
                    <div key={r.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}55`, fontSize: 13 }}>
                      {p && <Avatar p={p} size={26} />}
                      <span style={{ flex: 1 }}><b>{p ? (p.nick || p.name.split(" ")[0]) : "—"}</b> resgatou {r.item} <span style={{ color: C.dim }}>({fmt(r.preco)} moedas)</span></span>
                      {r.status === "pendente" ? (gestor
                        ? <button onClick={() => agir(marcarEntregue(r.id), "Entrega registrada.")} style={{ ...btnStyle(C.green, true), padding: "5px 12px", fontSize: 11 }}>Marcar entregue</button>
                        : <Chip color={C.orange}>Pendente</Chip>)
                        : <Chip color={C.green}>Entregue</Chip>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============ IDEIAS ============ */}
        {view === "ideias" && (
          <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Banco de Ideias</h2>
            <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>Ideia bem detalhada que economiza dinheiro ou melhora processo vira XP após avaliação do gestor. O autor vê só a recompensa, nunca o grau da avaliação.</p>
            <FormIdeia onEnviar={(t, d) => agir(enviarIdeia(me.id, t, d), "Ideia enviada ao gestor. Quem pensa, farma.")} />
            <div style={cardStyle}>
              <b style={{ fontSize: 13, letterSpacing: 1, color: C.dim }}>IDEIAS</b>
              {dados.ideias.length === 0 && <div style={{ color: C.dim2, fontSize: 13, marginTop: 8 }}>Nenhuma ideia ainda.</div>}
              {dados.ideias.map((i) => {
                const p = colabs.find((c) => c.id === i.colaborador_id);
                return (
                  <div key={i.id} style={{ padding: "12px 0", borderBottom: `1px solid ${C.border}55` }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {p && <Avatar p={p} size={28} />}
                      <b style={{ fontSize: 13.5, flex: 1 }}>{i.titulo}</b>
                      {i.status === "avaliada" ? <Chip color={C.green}>Recompensada</Chip> : <Chip color={C.orange}>Em análise</Chip>}
                      {gestor && <button onClick={() => { if (window.confirm("Excluir esta ideia do histórico? O XP já pago permanece no extrato.")) agir(excluirIdeia(i.id), "Ideia removida do histórico."); }} style={{ ...btnStyle(C.red, true), padding: "5px 10px", fontSize: 11 }}>🗑</button>}
                    </div>
                    <div style={{ fontSize: 12.5, color: C.dim, margin: "6px 0 0 38px" }}>{i.descricao}</div>
                    {gestor && i.status === "pendente" && (
                      <div style={{ display: "flex", gap: 8, margin: "8px 0 0 38px" }}>
                        {[["baixo", 100, C.dim], ["medio", 300, C.violetHot], ["alto", 800, C.gold]].map(([g, xp, cor]) => (
                          <button key={g} onClick={() => agir(avaliarIdeia(i, g, xp), `Avaliada. +${xp} XP para o autor.`)} style={{ ...btnStyle(cor, true), padding: "5px 12px", fontSize: 11 }}>
                            Impacto {g} · +{xp} XP
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============ PROVAS (gestor) ============ */}
        {view === "provas" && gestor && (
          <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Provas</h2>
            <FormProva colabs={colabs} onLancar={(pid, nome, nota, xpp) => agir(lancarProva(pid, nome, nota, xpp), `Nota ${nota} → ${fmt(nota * xpp)} XP lançados no extrato.`)} />
            <div style={cardStyle}>
              <b style={{ fontSize: 13, letterSpacing: 1, color: C.dim }}>HISTÓRICO</b>
              {dados.eventos.filter((ev) => ev.origem === "prova").slice(0, 20).map((ev) => {
                const p = colabs.find((c) => c.id === ev.colaborador_id);
                return (
                  <div key={ev.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}55`, fontSize: 13 }}>
                    {p && <Avatar p={p} size={26} />}
                    <span style={{ flex: 1 }}>{ev.descricao}</span>
                    <b style={{ color: C.green }}>+{fmt(ev.xp)} XP</b>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============ COLINHA (gestor) ============ */}
        {view === "colinha" && gestor && (
          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>🗒 Colinha do Gestor</h2>
            <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>Modelos de missão com custo fixo: mesma função, mesmo esforço, mesmo XP — sempre. Clique em Publicar para lançar de novo sem pensar no valor. Só você vê esta aba.</p>
            {dados.modelos.length === 0 && <div style={{ ...cardStyle, color: C.dim2, fontSize: 13 }}>Colinha vazia. Ao criar uma missão, marque "salvar na colinha" — ou cadastre direto abaixo.</div>}
            {dados.modelos.map((md) => {
              const destino = md.atribuidos && md.atribuidos.length > 0 ? md.atribuidos.map((id) => (colabs.find((c) => c.id === id) || {}).nome?.split(" ")[0] || "?").join(", ") : "Todos";
              return (
                <div key={md.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <b style={{ fontSize: 14 }}>{md.nome}</b>
                    <div style={{ fontSize: 12, color: C.dim }}>+{fmt(md.xp)} XP{md.moedas_ocultas > 0 && <span style={{ color: C.gold }}> · 🤫 {fmt(md.moedas_ocultas)} moedas</span>} · {md.tipo} · <span style={{ color: C.blue }}>→ {destino}</span></div>
                  </div>
                  <button onClick={() => agir(criarMissao({ nome: md.nome, xp: md.xp, moedas_ocultas: md.moedas_ocultas, tipo: md.tipo, atribuidos: md.atribuidos, chefao_id: null }), `Missão '${md.nome}' publicada.`)} style={btnStyle(C.violetHot)}>▶ Publicar</button>
                  <button onClick={() => { if (window.confirm("Excluir este modelo da colinha?")) agir(excluirModelo(md.id), "Modelo excluído."); }} style={{ ...btnStyle(C.red, true), padding: "7px 10px" }}>🗑</button>
                </div>
              );
            })}
            <NovoModelo colabs={colabs} onCriar={(m) => agir(criarModelo(m), "Modelo salvo na colinha.")} />
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

      {/* roleta */}
      {wheel && (
        <div style={{ position: "fixed", inset: 0, zIndex: 96, background: "rgba(4,6,14,.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ ...cardStyle, width: 340, textAlign: "center" }}>
            <b style={{ fontSize: 15, letterSpacing: 1 }}>🎰 ROLETA DA PONTUALIDADE</b>
            <div style={{ display: "flex", justifyContent: "center", margin: "18px 0" }}>
              <div className={wheel.spinning ? "wheel-spin" : ""} style={{ width: 170, height: 170, borderRadius: "50%", border: `6px solid ${C.gold}`, background: `conic-gradient(${C.violetDeep} 0 60deg, #1c2942 60deg 120deg, ${C.violetDeep} 120deg 180deg, #1c2942 180deg 240deg, ${C.violetDeep} 240deg 300deg, #1c2942 300deg 360deg)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 42 }}>
                {wheel.spinning ? "🎲" : "🎉"}
              </div>
            </div>
            {wheel.spinning ? (
              <div style={{ color: C.dim, fontSize: 13 }}>O servidor está sorteando…</div>
            ) : (
              <>
                <div className="banner-pop" style={{ fontSize: 24, fontWeight: 900, color: C.gold }}>{wheel.rotulo}!</div>
                <div style={{ color: C.dim, fontSize: 12.5, margin: "6px 0 12px" }}>Pontualidade paga. Já está no seu extrato.</div>
                <button onClick={() => setWheel(null)} style={btnStyle(C.violetHot)}>Fechar</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* modal trocar senha */}
      {senhaModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(4,6,14,.85)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setSenhaModal(false)}>
          <div style={{ ...cardStyle, width: 320 }} onClick={(e) => e.stopPropagation()}>
            <b style={{ fontSize: 15 }}>🔑 Trocar senha</b>
            <p style={{ color: C.dim, fontSize: 12.5, margin: "6px 0 12px" }}>Mínimo de 6 caracteres. Vale a partir do próximo login.</p>
            <input type="password" autoFocus value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Nova senha" style={inputStyle} />
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setSenhaModal(false)} style={btnStyle(C.dim, true)}>Cancelar</button>
              <button disabled={novaSenha.length < 6} onClick={async () => { const e = await trocarSenha(novaSenha); if (e) notify(e, C.red); else { notify("Senha alterada."); setSenhaModal(false); } }} style={{ ...btnStyle(C.violetHot), opacity: novaSenha.length >= 6 ? 1 : 0.4 }}>Salvar</button>
            </div>
          </div>
        </div>
      )}

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
function EscolheDestinos({ colabs, valor, onChange }) {
  const marcado = (id) => valor.includes(id);
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 11.5, color: C.dim }}>Para:</span>
      <button onClick={() => onChange([])} style={{ ...btnStyle(C.violetHot, valor.length > 0), padding: "4px 12px", fontSize: 11 }}>Todos</button>
      {colabs.filter((c) => !c.is_gestor).map((c) => (
        <button key={c.id} onClick={() => onChange(marcado(c.id) ? valor.filter((x) => x !== c.id) : [...valor, c.id])}
          style={{ ...btnStyle(C.blue, !marcado(c.id)), padding: "4px 12px", fontSize: 11 }}>
          {c.nome.split(" ")[0]}
        </button>
      ))}
      {valor.length > 0 && <span style={{ fontSize: 11, color: C.gold }}>XP integral para CADA um dos {valor.length} selecionado(s)</span>}
    </div>
  );
}

function NovaMissao({ chefao, colabs, onCriar }) {
  const [nome, setNome] = useState("");
  const [xp, setXp] = useState("200");
  const [moedas, setMoedas] = useState("");
  const [tipo, setTipo] = useState("fixa");
  const [vinculada, setVinculada] = useState(true);
  const [destinos, setDestinos] = useState([]);
  const [colinha, setColinha] = useState(false);
  return (
    <div style={{ ...cardStyle, border: `1px dashed ${C.border2}` }}>
      <b style={{ fontSize: 13, letterSpacing: 1, color: C.dim }}>GESTOR — NOVA MISSÃO</b>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 110px 1fr", gap: 10, marginTop: 10, alignItems: "center" }}>
        <input placeholder="Nome da missão" value={nome} onChange={(e) => setNome(e.target.value)} style={inputStyle} />
        <input placeholder="XP" value={xp} onChange={(e) => setXp(e.target.value.replace(/\D/g, ""))} style={inputStyle} />
        <input placeholder="Moedas 🤫" title="Oculto para a equipe" value={moedas} onChange={(e) => setMoedas(e.target.value.replace(/\D/g, ""))} style={inputStyle} />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={inputStyle}>
          <option value="fixa">Fixa</option>
          <option value="diaria">Diária</option>
          <option value="esporadica">Esporádica</option>
        </select>
      </div>
      <div style={{ marginTop: 10 }}>
        <EscolheDestinos colabs={colabs} valor={destinos} onChange={setDestinos} />
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label style={{ fontSize: 12.5, color: C.dim, display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={vinculada} disabled={!chefao} onChange={(e) => setVinculada(e.target.checked)} /> ☠ Vincular ao Chefão
        </label>
        <label style={{ fontSize: 12.5, color: C.dim, display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={colinha} onChange={(e) => setColinha(e.target.checked)} /> 🗒 Salvar na colinha
        </label>
        <button disabled={!nome || !xp} onClick={() => {
          onCriar({ nome, xp: Number(xp), moedas_ocultas: Number(moedas) || 0, tipo, chefao_id: vinculada && chefao ? chefao.id : null, atribuidos: destinos.length ? destinos : null }, colinha);
          setNome(""); setMoedas(""); setColinha(false); setDestinos([]);
        }} style={{ ...btnStyle(C.violetHot), opacity: nome && xp ? 1 : 0.4, marginLeft: "auto" }}>Criar</button>
      </div>
      {!chefao && <div style={{ fontSize: 11.5, color: C.dim2, marginTop: 8 }}>Sem chefão ativo — convoque um na aba Chefão para vincular missões ☠.</div>}
    </div>
  );
}

function NovoModelo({ colabs, onCriar }) {
  const [nome, setNome] = useState("");
  const [xp, setXp] = useState("10");
  const [moedas, setMoedas] = useState("");
  const [tipo, setTipo] = useState("fixa");
  const [destinos, setDestinos] = useState([]);
  return (
    <div style={{ ...cardStyle, border: `1px dashed ${C.border2}` }}>
      <b style={{ fontSize: 13, letterSpacing: 1, color: C.dim }}>NOVO MODELO</b>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 110px 1fr auto", gap: 10, marginTop: 10, alignItems: "center" }}>
        <input placeholder="Nome (ex: Envio de relatório)" value={nome} onChange={(e) => setNome(e.target.value)} style={inputStyle} />
        <input placeholder="XP" value={xp} onChange={(e) => setXp(e.target.value.replace(/\D/g, ""))} style={inputStyle} />
        <input placeholder="Moedas 🤫" value={moedas} onChange={(e) => setMoedas(e.target.value.replace(/\D/g, ""))} style={inputStyle} />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={inputStyle}>
          <option value="fixa">Fixa</option>
          <option value="diaria">Diária</option>
          <option value="esporadica">Esporádica</option>
        </select>
        <button disabled={!nome || !xp} onClick={() => { onCriar({ nome, xp: Number(xp), moedas_ocultas: Number(moedas) || 0, tipo, atribuidos: destinos.length ? destinos : null }); setNome(""); setMoedas(""); setDestinos([]); }} style={{ ...btnStyle(C.violetHot), opacity: nome && xp ? 1 : 0.4 }}>Salvar</button>
      </div>
      <div style={{ marginTop: 10 }}>
        <EscolheDestinos colabs={colabs} valor={destinos} onChange={setDestinos} />
      </div>
    </div>
  );
}

/* ---------- ficha administrativa de colaborador (gestor) ---------- */
function FichaColab({ p, saldo, onSalvar, onAjuste }) {
  const [nome, setNome] = useState(p.nome || "");
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
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome real" style={{ ...inputStyle, width: 180 }} />
        <input value={funcao} onChange={(e) => setFuncao(e.target.value)} placeholder="Função" style={{ ...inputStyle, width: 150 }} />
        <input value={turno} onChange={(e) => setTurno(e.target.value)} placeholder="Turno HH:MM" style={{ ...inputStyle, width: 110 }} />
        <button onClick={() => onSalvar({ nome, funcao, turno })} style={{ ...btnStyle(C.violetHot, true), padding: "8px 14px", fontSize: 12 }}>Salvar ficha</button>
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


/* ---------- formulário: nova ideia ---------- */
function FormIdeia({ onEnviar }) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  return (
    <div style={cardStyle}>
      <b style={{ fontSize: 13, letterSpacing: 1, color: C.dim }}>NOVA IDEIA</b>
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        <input placeholder="Título da ideia" value={titulo} onChange={(e) => setTitulo(e.target.value)} style={inputStyle} />
        <textarea placeholder="Detalhe bem: problema, solução, ganho estimado. Ideia rasa não farma XP." rows={4} value={descricao} onChange={(e) => setDescricao(e.target.value)} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        <button disabled={!titulo || !descricao} onClick={() => { onEnviar(titulo, descricao); setTitulo(""); setDescricao(""); }} style={{ ...btnStyle(C.violetHot), opacity: titulo && descricao ? 1 : 0.4, justifySelf: "start" }}>Enviar ao gestor</button>
      </div>
    </div>
  );
}

/* ---------- formulário: lançar prova (gestor) ---------- */
function FormProva({ colabs, onLancar }) {
  const [pid, setPid] = useState(colabs[0]?.id || "");
  const [nome, setNome] = useState("");
  const [nota, setNota] = useState("");
  const [xpp, setXpp] = useState("10");
  const n = Math.max(0, Math.min(100, parseInt(nota, 10) || 0));
  const x = parseInt(xpp, 10) || 0;
  return (
    <div style={cardStyle}>
      <div style={{ fontSize: 13, color: C.dim, marginBottom: 12 }}>
        Prova vale 100 pontos. Conversão: <b style={{ color: C.text }}>1 ponto = {x} XP</b> → nota {n} rende <b style={{ color: C.green }}>{fmt(n * x)} XP</b>.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px auto", gap: 10 }}>
        <select value={pid} onChange={(e) => setPid(e.target.value)} style={inputStyle}>
          {colabs.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <input placeholder="Nome da prova" value={nome} onChange={(e) => setNome(e.target.value)} style={inputStyle} />
        <input placeholder="Nota 0-100" value={nota} onChange={(e) => setNota(e.target.value.replace(/\D/g, ""))} style={inputStyle} />
        <input placeholder="XP/ponto" value={xpp} onChange={(e) => setXpp(e.target.value.replace(/\D/g, ""))} style={inputStyle} />
        <button disabled={!nota || !nome} onClick={() => { onLancar(pid, nome, n, x); setNota(""); setNome(""); }} style={{ ...btnStyle(C.violetHot), opacity: nota && nome ? 1 : 0.4 }}>Lançar</button>
      </div>
    </div>
  );
}


/* ---------- trava de IP da roleta (gestor) ---------- */
function TravaRoleta({ notify }) {
  const [ip, setIp] = useState("");
  const [carregado, setCarregado] = useState(false);
  useEffect(() => { lerConfig("ip_roleta").then((v) => { setIp(v); setCarregado(true); }); }, []);
  if (!carregado) return null;
  return (
    <div style={{ ...cardStyle, border: `1px dashed ${C.border2}` }}>
      <b style={{ fontSize: 13, letterSpacing: 1, color: C.dim }}>🔒 TRAVA DA ROLETA POR IP</b>
      <p style={{ fontSize: 12.5, color: C.dim, margin: "8px 0 10px" }}>
        Com um IP cadastrado, a roleta SÓ gira em aparelhos conectados à rede da empresa — julgado pelo servidor, impossível de burlar pelo celular. Vazio = liberada em qualquer lugar.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="IP autorizado (ex: 200.10.20.30)" value={ip} onChange={(e) => setIp(e.target.value.trim())} style={{ ...inputStyle, width: 220 }} />
        <button onClick={async () => { const v = await meuIp(); if (v && v !== "desconhecido") { setIp(v); notify(`IP deste aparelho: ${v}. Clique em Salvar para travar.`); } else notify("Não consegui detectar o IP.", C.orange); }} style={{ ...btnStyle(C.violetHot, true), padding: "8px 14px", fontSize: 12 }}>Usar IP deste aparelho</button>
        <button onClick={async () => { const e = await salvarConfig("ip_roleta", ip); notify(e || (ip ? "Trava ativada para este IP." : "Trava removida — roleta liberada em qualquer rede."), e ? C.red : C.green); }} style={{ ...btnStyle(C.gold, true), padding: "8px 14px", fontSize: 12 }}>Salvar</button>
      </div>
    </div>
  );
}


/* ---------- edição do prêmio de categoria (gestor) ---------- */
function EditaPremio({ premio, onSalvar }) {
  const [d, setD] = useState(premio.descricao);
  return (
    <>
      <input value={d} onChange={(e) => setD(e.target.value)} placeholder="Descrição do prêmio" style={{ ...inputStyle, flex: 1, minWidth: 220, padding: "6px 10px", fontSize: 12 }} />
      <button disabled={!d || d === premio.descricao} onClick={() => onSalvar(d)} style={{ ...btnStyle(C.gold, true), padding: "5px 12px", fontSize: 11, opacity: d && d !== premio.descricao ? 1 : 0.4 }}>Salvar prêmio</button>
    </>
  );
}
