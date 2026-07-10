import React, { useState, useEffect, useRef } from "react";
import { C, reqFor, uid, BOSS_CAP, SKINS, MARKET, titleFor, SEED, fmt, ago } from "./data/constants.js";
import { applyXp, applyCoins, nowMinutes } from "./logic/game.js";
import { loadState, saveState, clearState } from "./logic/storage.js";
import { Avatar, HeroFigure, BossFigure } from "./components/figures.jsx";
import { Bar, Chip, Coin, btnStyle, inputStyle, cardStyle } from "./components/ui.jsx";
import BattleOverlay from "./components/BattleOverlay.jsx";
import { ProvaForm, AddMission, IdeaForm } from "./components/forms.jsx";

export default function App() {
  const [state, setState] = useState(null);
  const [view, setView] = useState("dashboard");
  const [gestor, setGestor] = useState(false);
  const [activeId, setActiveId] = useState("p1");
  const [skinTab, setSkinTab] = useState("SKINS");
  const [battle, setBattle] = useState(null);
  const [toast, setToast] = useState(null);
  const [pinModal, setPinModal] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const saveT = useRef(null);

  /* carregar / salvar */
  useEffect(() => {
    (async () => {
      try {
        const data = await loadState();
        if (data) {
          if (!data.config.gestorPin) data.config.gestorPin = "2026";
          setState(data);
        } else setState(SEED);
      } catch { setState(SEED); }
    })();
  }, []);
  useEffect(() => {
    if (!state) return;
    clearTimeout(saveT.current);
    saveT.current = setTimeout(async () => {
      await saveState(state);
    }, 600);
  }, [state]);


  if (!state) return <div style={{ minHeight: "100vh", background: C.bg, color: C.dim, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>Carregando Operação Ascensão…</div>;

  const me = state.players.find((p) => p.id === activeId);
  const notify = (msg, color = C.green) => { setToast({ msg, color }); setTimeout(() => setToast(null), 3200); };

  /* ---------- AÇÕES ---------- */
  const gainXp = (pid, amount, label, coins = 0) => {
    setState((s) => {
      let { next, leveled } = applyXp(s, pid, amount, label);
      if (coins) next = applyCoins(next, pid, coins);
      if (leveled) {
        const p = next.players.find((x) => x.id === pid);
        next = { ...next, feed: [{ id: uid(), who: pid, text: `alcançou o nível ${p.level}`, xp: 0, t: Date.now() }, ...next.feed] };
      }
      return next;
    });
  };

  const completeMission = (m) => {
    if (m.completedBy.includes(activeId)) return notify("Você já concluiu esta missão.", C.orange);
    setState((s) => {
      let next = { ...s, missions: s.missions.map((x) => (x.id === m.id ? { ...x, completedBy: [...x.completedBy, activeId] } : x)) };
      const r = applyXp(next, activeId, m.xp, `concluiu a missão '${m.name}'`);
      next = applyCoins(r.next, activeId, Math.round(m.xp / 10));
      if (m.boss && !next.boss.defeated && next.boss.hp > 0) {
        const contrib = next.boss.contributions[activeId] || 0;
        const dmg = Math.min(m.xp, BOSS_CAP - contrib, next.boss.hp);
        if (dmg > 0) {
          const hpBefore = next.boss.hp;
          const newContrib = contrib + dmg;
          const hpAfter = hpBefore - dmg;
          next = { ...next, boss: { ...next.boss, hp: hpAfter, defeated: hpAfter <= 0, contributions: { ...next.boss.contributions, [activeId]: newContrib } } };
          const kind = hpAfter <= 0 ? "victory" : newContrib >= BOSS_CAP ? "combo" : "hit";
          setTimeout(() => setBattle({ pid: activeId, dmg, kind, hpBefore, maxHp: next.boss.maxHp }), 50);
        }
      }
      return next;
    });
  };

  const applyProva = (pid, nome, nota) => {
    const xp = Math.round(nota * state.config.xpPerPoint);
    setState((s) => ({ ...applyXp(s, pid, xp, `fez ${nota} pontos na prova '${nome || "Avaliação"}'`).next, provas: [{ id: uid(), pid, nome: nome || "Avaliação", nota, xp, t: Date.now() }, ...s.provas] }));
    notify(`Nota ${nota} → ${fmt(xp)} XP aplicados.`);
  };

  const submitIdea = (title, desc) => {
    setState((s) => ({ ...s, ideas: [{ id: uid(), pid: activeId, title, desc, status: "pendente", t: Date.now() }, ...s.ideas] }));
    notify("Ideia enviada ao gestor. Boa!");
  };

  const evalIdea = (idea, grade) => {
    const xp = state.config.ideaXp[grade];
    setState((s) => {
      const ideas = s.ideas.map((i) => (i.id === idea.id ? { ...i, status: "avaliada", xp } : i));
      // LEI: colaborador NÃO vê o grau da avaliação, só a recompensa
      return { ...applyXp({ ...s, ideas }, idea.pid, xp, `teve uma ideia reconhecida: '${idea.title}'`).next };
    });
    notify(`Ideia avaliada. +${fmt(xp)} XP para o autor.`);
  };

  const buy = (item, kind) => {
    if (me.coins < item.price) return notify("FlixCoins insuficientes. Farme mais XP.", C.red);
    setState((s) => {
      let next = applyCoins(s, activeId, -item.price);
      if (kind === "skin") {
        next = { ...next, players: next.players.map((p) => (p.id === activeId ? { ...p, ownedSkins: [...p.ownedSkins, item.id], skin: item.id } : p)) };
      } else {
        next = { ...next, redeems: [{ id: uid(), pid: activeId, item: item.name, price: item.price, t: Date.now(), status: "pendente" }, ...next.redeems] };
      }
      return { ...next, feed: [{ id: uid(), who: activeId, text: kind === "skin" ? `desbloqueou a skin '${item.name}'` : `resgatou '${item.name}' no mercado`, xp: 0, t: Date.now() }, ...next.feed] };
    });
    notify(kind === "skin" ? `Skin '${item.name}' equipada!` : `Resgate de '${item.name}' registrado. O gestor vai providenciar.`);
  };

  const checkin = () => {
    const today = new Date().toDateString();
    if (me.lastCheckin === today) return notify("Check-in de hoje já foi feito.", C.orange);
    const [h, m] = me.schedule.split(":").map(Number);
    const start = h * 60 + m;
    const now = nowMinutes(state.config);
    const inWindow = now >= start - 10 && now <= start + 5;
    const late = now > start + 5;
    setState((s) => ({ ...s, players: s.players.map((p) => (p.id === activeId ? { ...p, lastCheckin: today, streak: inWindow ? p.streak + 1 : 0 } : p)) }));
    if (inWindow) {
      gainXp(activeId, state.config.checkinXp, "fez check-in no horário 🔥", 10);
      notify(`Check-in no horário! +${state.config.checkinXp} XP, sequência mantida.`);
    } else if (late && state.config.latePenalty) {
      gainXp(activeId, -state.config.penaltyValue, "perdeu XP por check-in atrasado");
      notify(`Atrasado. -${state.config.penaltyValue} XP e sequência zerada.`, C.red);
    } else {
      notify(late ? "Atrasado. Sequência zerada, sem XP hoje." : "Ainda não abriu a janela de check-in.", C.orange);
    }
  };

  const resetAll = async () => {
    await clearState();
    setState(SEED); notify("Dados resetados para o padrão.");
  };

  /* ---------- NAV ---------- */
  const NAV = [
    ["dashboard", "▦", "Dashboard"],
    ["missoes", "◎", "Missões"],
    ["chefao", "☠", "Chefão"],
    ["provas", "✎", "Provas"],
    ["ideias", "💡", "Banco de Ideias"],
    ["ranking", "♛", "Ranking"],
    ["conquistas", "🏅", "Conquistas"],
    ["loja", "🛍", "Loja de Skins", true],
    ["mercado", "🛒", "Mercado"],
    ["config", "⚙", "Configurações"],
  ];

  const ranked = [...state.players].sort((a, b) => b.totalMonth - a.totalMonth);
  const myRank = ranked.findIndex((p) => p.id === activeId) + 1;
  const req = reqFor(me.level);

  /* ============================ RENDER ============================ */
  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(1200px 600px at 70% -10%, #1a1040 0%, ${C.bg} 55%)`, color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif", display: "flex" }}>

      {/* ================= SIDEBAR ================= */}
      <aside style={{ width: 218, background: C.panel, borderRight: `1px solid ${C.border}`, padding: "18px 12px", display: "flex", flexDirection: "column", gap: 4, position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 18px" }}>
          <svg width="34" height="34" viewBox="0 0 40 40"><path d="M6 30 L16 10 L23 24 L28 16 L34 30 Z" fill="none" stroke={C.blue} strokeWidth="3.4" strokeLinejoin="round" /></svg>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.15 }}>OPERAÇÃO<br />ASCENSÃO</div>
            <div style={{ color: C.blue, fontSize: 10, fontWeight: 700, letterSpacing: 2 }}>MVP</div>
          </div>
        </div>
        {NAV.map(([id, ic, label, nov]) => (
          <button key={id} onClick={() => setView(id)} style={{
            display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 10,
            background: view === id ? `linear-gradient(90deg, ${C.violetDeep}44, transparent)` : "transparent",
            border: view === id ? `1px solid ${C.violet}55` : "1px solid transparent",
            color: view === id ? C.text : C.dim, fontSize: 13.5, fontWeight: 600, cursor: "pointer", textAlign: "left",
          }}>
            <span style={{ width: 18, textAlign: "center" }}>{ic}</span>{label}
            {nov && <Chip color={C.violetHot}>novo</Chip>}
          </button>
        ))}
        <div style={{ marginTop: "auto", borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 6px 10px" }}>
            <div style={{ width: 36, height: 36, borderRadius: "50%", background: `linear-gradient(135deg, ${C.violet}, ${C.blue})`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>ET</div>
            <div><div style={{ fontSize: 13, fontWeight: 700 }}>Eliseu Tavares</div><div style={{ fontSize: 11, color: C.dim }}>Gestor</div></div>
          </div>
          <button onClick={() => { if (gestor) { setGestor(false); notify("Modo colaborador ativado.", C.blue); } else { setPinInput(""); setPinModal(true); } }} style={{ ...btnStyle(gestor ? C.gold : C.violetHot, !gestor), width: "100%" }}>
            {gestor ? "◉ Modo Gestor ATIVO" : "🔒 Modo Gestor"}
          </button>
        </div>
      </aside>

      {/* ================= MAIN ================= */}
      <main style={{ flex: 1, padding: "16px 22px 40px", maxWidth: 1400, minWidth: 0 }}>
        {/* HEADER */}
        <header style={{ display: "flex", alignItems: "center", gap: 22, background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 18px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Avatar p={me} size={46} ring={C.violet} />
            <div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>{me.name}</div>
              <div style={{ color: C.blue, fontSize: 12 }}>{me.role}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="glow" style={{ border: `2px solid ${C.violetHot}`, borderRadius: 10, padding: "4px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: C.dim, letterSpacing: 1 }}>NÍVEL</div>
              <div style={{ fontWeight: 900, fontSize: 20, color: C.violetHot }}>{me.level}</div>
            </div>
            <div style={{ width: 210 }}>
              <div style={{ fontSize: 11, color: C.dim, marginBottom: 4 }}>XP</div>
              <Bar value={me.xp} max={req} />
              <div style={{ fontSize: 11, color: C.dim, textAlign: "right", marginTop: 3 }}>{fmt(me.xp)} / {fmt(req)}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Coin size={26} />
            <div><div style={{ fontSize: 10, color: C.dim, letterSpacing: 1 }}>FLIX COINS</div><div style={{ fontWeight: 800, fontSize: 17 }}>{fmt(me.coins)}</div></div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>🏆</span>
            <div><div style={{ fontSize: 10, color: C.dim, letterSpacing: 1 }}>RANKING</div><div style={{ fontWeight: 800, fontSize: 17 }}>{myRank}º</div></div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 11, color: C.orange, fontWeight: 700 }}>Sequência 🔥</div>
            <div style={{ fontWeight: 900, fontSize: 19, color: C.orange }}>{me.streak} dias</div>
          </div>
        </header>

        {/* ============ VIEWS ============ */}
        {view === "dashboard" && (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(420px, 7fr) minmax(340px, 5fr)", gap: 16, marginTop: 16 }}>
            {/* Painel do personagem */}
            <section style={{ ...cardStyle, background: `linear-gradient(160deg, #0d1226 0%, #090d1c 60%), ${C.panel}`, position: "relative", overflow: "hidden" }}>
              <div style={{ display: "flex", gap: 14 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 168 }}>
                  {[["CABELO", "Padrão"], ["TRAJE", SKINS.find((s) => s.id === me.skin).name], ["ACESSÓRIO", "Luvas Táticas"], ["CALÇADO", "Botas de Carga"], ["EMBLEMA", "Guardião"]].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", gap: 9, alignItems: "center", background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 8 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: `linear-gradient(135deg, ${C.violetDeep}55, #0b0f1e)`, border: `1px solid ${C.violet}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>
                        {{ CABELO: "💇", TRAJE: "🧥", ACESSÓRIO: "🧤", CALÇADO: "🥾", EMBLEMA: "🛡️" }[k]}
                      </div>
                      <div><div style={{ fontSize: 9, color: C.dim, letterSpacing: 1 }}>{k}</div><div style={{ fontSize: 11.5, fontWeight: 600 }}>{v}</div></div>
                    </div>
                  ))}
                </div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <HeroFigure p={me} height={330} />
                </div>
                <div style={{ width: 190, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: C.dim, marginBottom: 10 }}>ATRIBUTOS</div>
                    {Object.entries(me.attrs).map(([k, v]) => (
                      <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: `1px solid ${C.border}55` }}>
                        <span style={{ color: C.dim }}>{k}</span><b>{v}</b>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: C.panel2, border: `1px solid ${C.violet}44`, borderRadius: 10, padding: 12, textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: C.dim, letterSpacing: 1, marginBottom: 6 }}>TÍTULO ATUAL</div>
                    <div style={{ fontSize: 30 }}>◆</div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: C.violetHot }}>{titleFor(me.level).toUpperCase()}</div>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 14, alignItems: "center" }}>
                <button onClick={checkin} style={btnStyle(C.violetHot)}>✓ Check-in diário</button>
                <div style={{ flex: 1, background: C.panel2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.dim }}>
                    <span>Próximo nível — <b style={{ color: C.text }}>{titleFor(me.level + 1)}</b></span>
                    <span style={{ border: `1.5px solid ${C.violetHot}`, borderRadius: 6, padding: "0 8px", color: C.violetHot, fontWeight: 800 }}>NÍVEL {me.level + 1}</span>
                  </div>
                  <div style={{ marginTop: 6 }}><Bar value={me.xp} max={req} /></div>
                </div>
              </div>
            </section>

            {/* Loja lateral (skins) */}
            <section style={cardStyle}>
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {["SKINS", "EMOTES", "EFEITOS", "ITENS"].map((t) => (
                  <button key={t} onClick={() => setSkinTab(t)} style={{ ...btnStyle(C.violetHot, skinTab !== t), padding: "7px 14px", fontSize: 11 }}>{t}</button>
                ))}
              </div>
              {skinTab === "SKINS" ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
                  {SKINS.map((sk) => {
                    const owned = me.ownedSkins.includes(sk.id);
                    const locked = sk.lockedLevel && me.level < sk.lockedLevel;
                    const equipped = me.skin === sk.id;
                    return (
                      <div key={sk.id} style={{ background: C.panel2, border: `1.5px solid ${equipped ? C.violetHot : C.border}`, borderRadius: 12, padding: 10, textAlign: "center" }}>
                        <div style={{ height: 92, display: "flex", alignItems: "center", justifyContent: "center", filter: locked ? "brightness(.25)" : "none" }}>
                          <HeroFigure p={{ ...me, skin: sk.id }} height={90} />
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, margin: "6px 0 4px" }}>{locked ? "Skin Secreta" : sk.name}</div>
                        {locked ? (
                          <div style={{ fontSize: 11, color: C.dim }}>🔒 Nível {sk.lockedLevel}</div>
                        ) : equipped ? (
                          <Chip color={C.green}>Equipada</Chip>
                        ) : owned ? (
                          <button onClick={() => setState((s) => ({ ...s, players: s.players.map((p) => (p.id === activeId ? { ...p, skin: sk.id } : p)) }))} style={{ ...btnStyle(C.violetHot, true), padding: "5px 12px", fontSize: 11 }}>Equipar</button>
                        ) : (
                          <button onClick={() => buy(sk, "skin")} style={{ ...btnStyle(C.gold, true), padding: "5px 12px", fontSize: 11, display: "inline-flex", gap: 6, alignItems: "center" }}><Coin size={13} /> {fmt(sk.price)}</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: C.dim, fontSize: 13, padding: 30, textAlign: "center" }}>“{skinTab}” chega na próxima temporada. LEI 4: todo mês existe algo novo.</div>
              )}
              <div style={{ marginTop: 14, background: `linear-gradient(90deg, ${C.violetDeep}33, transparent)`, border: `1px solid ${C.violet}44`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 28 }}>🧰</span>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 13 }}>Pacote Guardião</b>
                  <div style={{ fontSize: 11, color: C.violetHot }}>Conjunto completo com desconto!</div>
                </div>
                <button style={{ ...btnStyle(C.gold), display: "flex", gap: 6, alignItems: "center" }} onClick={() => notify("Pacotes entram na fase 2.", C.orange)}>6.500 <Coin size={14} /></button>
              </div>
            </section>

            {/* Equipe */}
            <section style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: C.dim, marginBottom: 12 }}>EQUIPE — clique para trocar de colaborador</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {state.players.map((p) => (
                  <button key={p.id} onClick={() => setActiveId(p.id)} style={{
                    background: C.panel2, border: `1.5px solid ${p.id === activeId ? C.violetHot : C.border}`, borderRadius: 12,
                    padding: "10px 12px", cursor: "pointer", textAlign: "center", color: C.text, minWidth: 92,
                  }}>
                    <Avatar p={p} size={44} ring={p.id === activeId ? C.violetHot : undefined} />
                    <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>{p.name.split(" ")[0]}</div>
                    <div style={{ fontSize: 10.5, color: C.dim }}>Nível {p.level}</div>
                    <div style={{ fontSize: 10.5, color: C.violetHot, fontWeight: 700 }}>{fmt(p.totalMonth)} XP</div>
                  </button>
                ))}
              </div>
            </section>

            {/* Últimas conquistas */}
            <section style={cardStyle}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: C.dim, marginBottom: 12 }}>ÚLTIMAS CONQUISTAS</div>
              {state.feed.slice(0, 6).map((f) => {
                const p = state.players.find((x) => x.id === f.who);
                return (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}55` }}>
                    <Avatar p={p} size={30} />
                    <div style={{ flex: 1, fontSize: 12.5 }}><b style={{ color: C.blue }}>{p.name.split(" ")[0]}</b> {f.text}</div>
                    {f.xp !== 0 && <b style={{ color: f.xp > 0 ? C.green : C.red, fontSize: 12.5 }}>{f.xp > 0 ? "+" : ""}{fmt(f.xp)} XP</b>}
                    <span style={{ color: C.dim2, fontSize: 11 }}>{ago(f.t)}</span>
                  </div>
                );
              })}
            </section>
          </div>
        )}

        {view === "missoes" && (
          <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Missões — {me.name.split(" ")[0]}</h2>
            <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>LEI 1: tudo gera XP. Missões marcadas com ☠ causam dano no Chefão.</p>
            {state.missions.map((m) => {
              const done = m.completedBy.includes(activeId);
              return (
                <div key={m.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14, opacity: done ? 0.55 : 1 }}>
                  <span style={{ fontSize: 22 }}>{m.boss ? "☠" : "◎"}</span>
                  <div style={{ flex: 1 }}>
                    <b style={{ fontSize: 14 }}>{m.name}</b>
                    <div style={{ fontSize: 12, color: C.dim }}>+{fmt(m.xp)} XP · +{fmt(Math.round(m.xp / 10))} FlixCoins {m.boss && <span style={{ color: C.orange }}>· vinculada ao Chefão</span>}</div>
                  </div>
                  {done ? <Chip color={C.green}>Concluída</Chip> : <button onClick={() => completeMission(m)} style={btnStyle(C.violetHot)}>Concluir</button>}
                </div>
              );
            })}
            {gestor && <AddMission onAdd={(name, xp, boss) => setState((s) => ({ ...s, missions: [...s.missions, { id: uid(), name, xp, boss, completedBy: [] }] }))} />}
          </div>
        )}

        {view === "chefao" && (
          <div style={{ marginTop: 16 }}>
            <div style={{ ...cardStyle, textAlign: "center", background: `radial-gradient(500px 260px at 50% 0%, #2a104f55, ${C.panel})` }}>
              <Chip color={C.orange}>{state.boss.kind}</Chip>
              <h2 style={{ margin: "10px 0 2px", fontSize: 26, letterSpacing: 1 }}>{state.boss.name}</h2>
              <div style={{ color: C.gold, fontSize: 13, marginBottom: 10 }}>🏆 Prêmio: {state.boss.reward}</div>
              <BossFigure size={210} />
              <div style={{ maxWidth: 480, margin: "10px auto" }}>
                <Bar value={state.boss.hp} max={state.boss.maxHp} color={C.red} h={14} />
                <div style={{ fontSize: 13, color: C.dim, marginTop: 5 }}>{fmt(state.boss.hp)} / {fmt(state.boss.maxHp)} HP {state.boss.defeated && <b style={{ color: C.gold }}> — DERROTADO! 🏆</b>}</div>
              </div>
              <p style={{ color: C.dim, fontSize: 13, maxWidth: 560, margin: "6px auto" }}>
                Cada colaborador precisa causar <b style={{ color: C.text }}>{fmt(BOSS_CAP)} XP</b> de dano via missões ☠. Se UM não bater a meta, o chefão sobrevive. A equipe vence junta ou não vence.
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginTop: 14 }}>
              {state.players.map((p) => {
                const c = state.boss.contributions[p.id] || 0;
                return (
                  <div key={p.id} style={cardStyle}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                      <Avatar p={p} size={36} />
                      <div><b style={{ fontSize: 13 }}>{p.name.split(" ")[0]}</b><div style={{ fontSize: 11, color: c >= BOSS_CAP ? C.green : C.dim }}>{c >= BOSS_CAP ? "Meta batida! ⚔️" : "Em combate"}</div></div>
                    </div>
                    <Bar value={c} max={BOSS_CAP} color={c >= BOSS_CAP ? C.green : C.violetHot} />
                    <div style={{ fontSize: 11.5, color: C.dim, marginTop: 4, textAlign: "right" }}>{fmt(c)} / {fmt(BOSS_CAP)} XP de dano</div>
                  </div>
                );
              })}
            </div>
            {gestor && (
              <button style={{ ...btnStyle(C.red, true), marginTop: 14 }} onClick={() => setState((s) => ({ ...s, boss: { ...s.boss, hp: s.boss.maxHp, defeated: false, contributions: {} }, missions: s.missions.map((m) => ({ ...m, completedBy: [] })) }))}>
                ↺ Novo chefão (reseta missões e HP)
              </button>
            )}
          </div>
        )}

        {view === "provas" && (
          <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Provas</h2>
            <div style={cardStyle}>
              <div style={{ fontSize: 13, color: C.dim, marginBottom: 12 }}>
                Regra de conversão: <b style={{ color: C.text }}>1 ponto = {state.config.xpPerPoint} XP</b> (ajustável em Configurações). Prova vale 100 pontos → máx. {fmt(100 * state.config.xpPerPoint)} XP. Monte a prova com pesos por dificuldade (fácil 5 / médio 10 / difícil 15) — aqui você só lança a nota final.
              </div>
              {gestor ? <ProvaForm players={state.players} cfg={state.config} onApply={applyProva} /> : <div style={{ color: C.orange, fontSize: 13 }}>Apenas o gestor lança notas. Ative o Modo Gestor.</div>}
            </div>
            <div style={cardStyle}>
              <b style={{ fontSize: 13, letterSpacing: 1, color: C.dim }}>HISTÓRICO</b>
              {state.provas.length === 0 && <div style={{ color: C.dim2, fontSize: 13, marginTop: 8 }}>Nenhuma prova lançada ainda.</div>}
              {state.provas.map((pr) => {
                const p = state.players.find((x) => x.id === pr.pid);
                return (
                  <div key={pr.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${C.border}55`, fontSize: 13 }}>
                    <Avatar p={p} size={28} />
                    <span style={{ flex: 1 }}><b>{p.name.split(" ")[0]}</b> — {pr.nome}</span>
                    <span>Nota <b>{pr.nota}</b></span>
                    <b style={{ color: C.green }}>+{fmt(pr.xp)} XP</b>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "ideias" && (
          <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Banco de Ideias</h2>
            <p style={{ color: C.dim, fontSize: 13, margin: 0 }}>Ideia bem detalhada que gera economia ou melhoria vira XP. O gestor avalia o impacto — o autor vê só a recompensa, nunca o grau.</p>
            <IdeaForm onSubmit={submitIdea} />
            <div style={cardStyle}>
              <b style={{ fontSize: 13, letterSpacing: 1, color: C.dim }}>IDEIAS ENVIADAS</b>
              {state.ideas.length === 0 && <div style={{ color: C.dim2, fontSize: 13, marginTop: 8 }}>Nenhuma ideia ainda. Quem pensa, farma.</div>}
              {state.ideas.map((i) => {
                const p = state.players.find((x) => x.id === i.pid);
                return (
                  <div key={i.id} style={{ padding: "12px 0", borderBottom: `1px solid ${C.border}55` }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <Avatar p={p} size={28} />
                      <b style={{ fontSize: 13.5, flex: 1 }}>{i.title}</b>
                      {i.status === "avaliada" ? <Chip color={C.green}>Recompensada +{fmt(i.xp)} XP</Chip> : <Chip color={C.orange}>Em análise</Chip>}
                    </div>
                    <div style={{ fontSize: 12.5, color: C.dim, margin: "6px 0 0 38px" }}>{i.desc}</div>
                    {gestor && i.status === "pendente" && (
                      <div style={{ display: "flex", gap: 8, margin: "8px 0 0 38px" }}>
                        {["baixo", "medio", "alto"].map((g) => (
                          <button key={g} onClick={() => evalIdea(i, g)} style={{ ...btnStyle(g === "alto" ? C.gold : g === "medio" ? C.violetHot : C.dim, true), padding: "5px 12px", fontSize: 11 }}>
                            Impacto {g} · +{state.config.ideaXp[g]} XP
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

        {view === "ranking" && (
          <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Ranking do Mês — XP farmado</h2>
            {ranked.map((p, i) => (
              <div key={p.id} style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 14, border: i === 0 ? `1.5px solid ${C.gold}` : cardStyle.border && `1px solid ${C.border}` }}>
                <div style={{ fontSize: 22, width: 34, textAlign: "center" }}>{["🥇", "🥈", "🥉"][i] || `${i + 1}º`}</div>
                <Avatar p={p} size={40} />
                <div style={{ flex: 1 }}>
                  <b>{p.name}</b>
                  <div style={{ fontSize: 12, color: C.dim }}>Nível {p.level} · {titleFor(p.level)}</div>
                </div>
                <b style={{ color: C.violetHot }}>{fmt(p.totalMonth)} XP</b>
              </div>
            ))}
            <div style={{ ...cardStyle, border: `1px solid ${C.gold}66` }}>
              <b style={{ color: C.gold, fontSize: 13, letterSpacing: 1 }}>🏆 PRÊMIOS DO 1º LUGAR DO MÊS</b>
              <div style={{ fontSize: 13, color: C.dim, marginTop: 8, lineHeight: 1.8 }}>
                Pin exclusivo · PIX · Reconhecimento por escrito · Almoço com a diretoria · Fim de semana em Airbnb com tudo pago · Crachá simbólico ("Arauto da Organização", "Máquina de Produção")
              </div>
            </div>
            <div style={cardStyle}>
              <b style={{ fontSize: 13, letterSpacing: 1, color: C.dim }}>OS 3 PILARES</b>
              <div style={{ fontSize: 13, color: C.dim, marginTop: 8, lineHeight: 1.9 }}>
                <b style={{ color: C.blue }}>Evolução pessoal</b> — você contra você mesmo: nível nunca se perde (LEI 3).<br />
                <b style={{ color: C.violetHot }}>Colaboração</b> — a equipe vence junta no Chefão.<br />
                <b style={{ color: C.gold }}>Excelência</b> — quem se destaca leva reconhecimento extra.
              </div>
            </div>
          </div>
        )}

        {view === "conquistas" && (
          <div style={{ marginTop: 16 }}>
            <h2 style={{ margin: "0 0 14px", fontSize: 20 }}>Feed de Conquistas</h2>
            <div style={cardStyle}>
              {state.feed.map((f) => {
                const p = state.players.find((x) => x.id === f.who);
                return (
                  <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${C.border}55`, fontSize: 13 }}>
                    <Avatar p={p} size={30} />
                    <span style={{ flex: 1 }}><b style={{ color: C.blue }}>{p.name.split(" ")[0]}</b> {f.text}</span>
                    {f.xp !== 0 && <b style={{ color: f.xp > 0 ? C.green : C.red }}>{f.xp > 0 ? "+" : ""}{fmt(f.xp)} XP</b>}
                    <span style={{ color: C.dim2, fontSize: 11 }}>{ago(f.t)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "loja" && (
          <div style={{ marginTop: 16 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Loja de Skins</h2>
            <p style={{ color: C.dim, fontSize: 13 }}>LEI 2: toda recompensa custa esforço. Skins são compradas com FlixCoins farmadas.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 14 }}>
              {SKINS.map((sk) => {
                const owned = me.ownedSkins.includes(sk.id);
                const locked = sk.lockedLevel && me.level < sk.lockedLevel;
                return (
                  <div key={sk.id} style={{ ...cardStyle, textAlign: "center", border: me.skin === sk.id ? `1.5px solid ${C.violetHot}` : `1px solid ${C.border}` }}>
                    <div style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center", filter: locked ? "brightness(.22)" : "none" }}>
                      <HeroFigure p={{ ...me, skin: sk.id }} height={145} />
                    </div>
                    <b style={{ fontSize: 13.5 }}>{locked ? "Skin Secreta" : sk.name}</b>
                    <div style={{ marginTop: 8 }}>
                      {locked ? <div style={{ fontSize: 12, color: C.dim }}>🔒 Disponível no nível {sk.lockedLevel}</div>
                        : me.skin === sk.id ? <Chip color={C.green}>Equipada</Chip>
                        : owned ? <button onClick={() => setState((s) => ({ ...s, players: s.players.map((p) => (p.id === activeId ? { ...p, skin: sk.id } : p)) }))} style={btnStyle(C.violetHot, true)}>Equipar</button>
                        : <button onClick={() => buy(sk, "skin")} style={{ ...btnStyle(C.gold), display: "inline-flex", gap: 7, alignItems: "center" }}><Coin size={14} /> {fmt(sk.price)}</button>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {view === "mercado" && (
          <div style={{ marginTop: 16 }}>
            <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>Mercado FlixCoin</h2>
            <p style={{ color: C.dim, fontSize: 13 }}>Recompensas reais. O resgate fica pendente para o gestor providenciar.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
              {MARKET.map((it) => (
                <div key={it.id} style={{ ...cardStyle, textAlign: "center" }}>
                  <div style={{ fontSize: 40 }}>{it.icon}</div>
                  <b style={{ fontSize: 13.5, display: "block", margin: "8px 0" }}>{it.name}</b>
                  <button onClick={() => buy(it, "market")} style={{ ...btnStyle(C.gold), display: "inline-flex", gap: 7, alignItems: "center" }}><Coin size={14} /> {fmt(it.price)}</button>
                </div>
              ))}
            </div>
            {state.redeems.length > 0 && (
              <div style={{ ...cardStyle, marginTop: 16 }}>
                <b style={{ fontSize: 13, letterSpacing: 1, color: C.dim }}>RESGATES {gestor ? "(providenciar)" : ""}</b>
                {state.redeems.map((r) => {
                  const p = state.players.find((x) => x.id === r.pid);
                  return (
                    <div key={r.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${C.border}55`, fontSize: 13 }}>
                      <Avatar p={p} size={26} />
                      <span style={{ flex: 1 }}><b>{p.name.split(" ")[0]}</b> resgatou {r.item}</span>
                      {r.status === "pendente" ? (gestor
                        ? <button onClick={() => setState((s) => ({ ...s, redeems: s.redeems.map((x) => (x.id === r.id ? { ...x, status: "entregue" } : x)) }))} style={{ ...btnStyle(C.green, true), padding: "5px 12px", fontSize: 11 }}>Marcar entregue</button>
                        : <Chip color={C.orange}>Pendente</Chip>)
                        : <Chip color={C.green}>Entregue</Chip>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {view === "config" && (
          <div style={{ marginTop: 16, display: "grid", gap: 14, maxWidth: 640 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>Configurações {gestor ? "" : "(somente leitura — ative o Modo Gestor)"}</h2>
            <div style={cardStyle}>
              <b style={{ fontSize: 13, letterSpacing: 1, color: C.dim }}>REGRAS DE XP</b>
              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <label style={{ fontSize: 13 }}>XP por ponto de prova
                  <input type="number" disabled={!gestor} value={state.config.xpPerPoint} onChange={(e) => setState((s) => ({ ...s, config: { ...s.config, xpPerPoint: Number(e.target.value) || 0 } }))} style={{ ...inputStyle, marginTop: 5 }} />
                </label>
                <label style={{ fontSize: 13 }}>XP do check-in no horário
                  <input type="number" disabled={!gestor} value={state.config.checkinXp} onChange={(e) => setState((s) => ({ ...s, config: { ...s.config, checkinXp: Number(e.target.value) || 0 } }))} style={{ ...inputStyle, marginTop: 5 }} />
                </label>
                <label style={{ fontSize: 13, display: "flex", gap: 10, alignItems: "center" }}>
                  <input type="checkbox" disabled={!gestor} checked={state.config.latePenalty} onChange={(e) => setState((s) => ({ ...s, config: { ...s.config, latePenalty: e.target.checked } }))} />
                  Punir atraso com -{state.config.penaltyValue} XP (recomendo desligar: zerar a sequência já dói e preserva o espírito da LEI 3)
                </label>
                <label style={{ fontSize: 13 }}>Simular horário atual (HH:MM) — para testar o check-in
                  <input placeholder="ex: 08:55 (vazio = relógio real)" disabled={!gestor} value={state.config.simTime} onChange={(e) => setState((s) => ({ ...s, config: { ...s.config, simTime: e.target.value } }))} style={{ ...inputStyle, marginTop: 5 }} />
                </label>
                {gestor && (
                  <label style={{ fontSize: 13 }}>PIN do Gestor (troque o padrão 2026 antes de liberar pra equipe)
                    <input value={state.config.gestorPin} onChange={(e) => setState((s) => ({ ...s, config: { ...s.config, gestorPin: e.target.value } }))} style={{ ...inputStyle, marginTop: 5 }} />
                  </label>
                )}
              </div>
            </div>
            <div style={cardStyle}>
              <b style={{ fontSize: 13, letterSpacing: 1, color: C.dim }}>AS 4 LEIS DA ASCENSÃO</b>
              <div style={{ fontSize: 13, color: C.dim, marginTop: 10, lineHeight: 2 }}>
                <b style={{ color: C.text }}>LEI 1</b> — Tudo gera XP.<br />
                <b style={{ color: C.text }}>LEI 2</b> — Toda recompensa custa esforço. Nada de XP de graça.<br />
                <b style={{ color: C.text }}>LEI 3</b> — O colaborador nunca perde evolução. Nível conquistado é dele para sempre.<br />
                <b style={{ color: C.text }}>LEI 4</b> — Todo mês existe algo novo: chefões, eventos, temporadas, missões secretas.
              </div>
            </div>
            {gestor && <button onClick={resetAll} style={btnStyle(C.red, true)}>⚠ Resetar todos os dados</button>}
          </div>
        )}
      </main>

      {/* overlay de batalha */}
      {battle && (
        <BattleOverlay battle={battle} boss={state.boss} player={state.players.find((p) => p.id === battle.pid)} onDone={() => setBattle(null)} />
      )}

      {/* modal de PIN do gestor */}
      {pinModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(4,6,14,.85)", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setPinModal(false)}>
          <div style={{ ...cardStyle, width: 320, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🔒</div>
            <b style={{ fontSize: 15 }}>PIN do Gestor</b>
            <p style={{ color: C.dim, fontSize: 12.5, margin: "6px 0 12px" }}>Somente o gestor lança provas, avalia ideias e cria missões.</p>
            <input
              type="password" autoFocus value={pinInput} placeholder="••••"
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { if (pinInput === state.config.gestorPin) { setGestor(true); setPinModal(false); notify("Modo Gestor ativado.", C.gold); } else notify("PIN incorreto.", C.red); } }}
              style={{ ...inputStyle, textAlign: "center", fontSize: 18, letterSpacing: 6 }}
            />
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 14 }}>
              <button onClick={() => setPinModal(false)} style={btnStyle(C.dim, true)}>Cancelar</button>
              <button onClick={() => { if (pinInput === state.config.gestorPin) { setGestor(true); setPinModal(false); notify("Modo Gestor ativado.", C.gold); } else notify("PIN incorreto.", C.red); }} style={btnStyle(C.violetHot)}>Entrar</button>
            </div>
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 22, right: 22, zIndex: 99, background: C.panel, border: `1.5px solid ${toast.color}`, color: C.text, padding: "12px 18px", borderRadius: 12, fontSize: 13.5, fontWeight: 600, boxShadow: `0 0 24px ${toast.color}44`, maxWidth: 340 }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

