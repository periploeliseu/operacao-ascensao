import React, { useState, useEffect, useRef } from "react";
import { C, uid, fmt, BOSS_CAP } from "../data/constants.js";
import { HeroFigure, BossFigure } from "./figures.jsx";
import { Bar, Chip, btnStyle } from "./ui.jsx";

/* kinds: hit (golpe), combo (bateu a cota), victory (chefão caiu), fail (prazo estourou) */
function BattleOverlay({ battle, player, boss, onDone }) {
  const [floats, setFloats] = useState([]);
  const [hurt, setHurt] = useState(false);
  const [heroHurt, setHeroHurt] = useState(false);
  const [lunge, setLunge] = useState(false);
  const [banner, setBanner] = useState(null);
  const timers = useRef([]);
  const fail = battle.kind === "fail";

  useEffect(() => {
    const kind = battle.kind;
    const hits = kind === "combo" ? 8 : kind === "victory" ? 10 : kind === "fail" ? 6 : 3;
    const gap = kind === "hit" ? 420 : 280;
    const per = Math.max(1, Math.round((battle.dmg || 0) / hits));
    for (let i = 0; i < hits; i++) {
      timers.current.push(setTimeout(() => {
        if (kind === "fail") {
          setHeroHurt(true);
          setFloats((f) => [...f, { id: uid(), v: null, x: 16 + Math.random() * 20, y: 28 + Math.random() * 25, crit: true }]);
          timers.current.push(setTimeout(() => setHeroHurt(false), 170));
        } else {
          setLunge(true); setHurt(true);
          setFloats((f) => [...f, { id: uid(), v: per, x: 38 + Math.random() * 24, y: 20 + Math.random() * 25, crit: kind !== "hit" }]);
          timers.current.push(setTimeout(() => { setLunge(false); setHurt(false); }, 160));
        }
      }, 500 + i * gap));
    }
    timers.current.push(setTimeout(() => {
      setBanner(kind === "victory" ? "CHEFÃO DERROTADO!" : kind === "combo" ? "SEQUÊNCIA SUPREMA!" : kind === "fail" ? "FOMOS DERROTADOS…" : "GOLPE CERTEIRO!");
    }, 600 + hits * gap));
    return () => timers.current.forEach(clearTimeout);
  }, [battle]);

  const cap = battle.cap || BOSS_CAP;
  const hpNow = Math.max(0, battle.hpBefore - (battle.dmg || 0));
  const shortName = player.nick || player.name.split(" ")[0];
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(4,6,14,.92)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "min(680px, 94vw)", textAlign: "center" }}>
        <Chip color={C.orange}>{boss.kind}</Chip>
        <h2 style={{ margin: "10px 0 4px", color: C.text, fontSize: 24, letterSpacing: 1 }}>{boss.name}</h2>
        <div style={{ maxWidth: 420, margin: "0 auto 6px" }}>
          <Bar value={hpNow} max={battle.maxHp} color={C.red} h={12} />
          <div style={{ color: C.dim, fontSize: 12, marginTop: 4 }}>{fmt(hpNow)} / {fmt(battle.maxHp)} HP</div>
        </div>
        <div style={{ position: "relative", height: 260, display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 40 }}>
          <div className={`${lunge ? "lunge" : ""} ${heroHurt ? "hero-hurt" : ""} ${fail && banner ? "hero-down" : ""}`} style={{ transition: "transform .15s" }}>
            <HeroFigure p={player} height={190} />
            <div style={{ color: C.violetHot, fontWeight: 700, fontSize: 13, marginTop: 4 }}>{shortName}</div>
          </div>
          <div className={fail ? "boss-rage" : ""}>
            <BossFigure size={220} hurt={hurt} />
          </div>
          {floats.map((f) => (
            <div key={f.id} className="dmg-float" style={{ position: "absolute", left: `${f.x + 25}%`, top: `${f.y}%`, color: f.v == null ? C.red : f.crit ? C.gold : C.red, fontWeight: 900, fontSize: f.crit ? 30 : 22, textShadow: "0 0 12px currentColor" }}>
              {f.v == null ? "✗" : `-${fmt(f.v)}`}
            </div>
          ))}
        </div>
        {banner && (
          <div className="banner-pop" style={{ margin: "8px 0 14px", fontSize: 30, fontWeight: 900, letterSpacing: 2, color: banner.includes("DERROTADOS") ? C.red : banner.includes("DERROT") ? C.gold : C.violetHot, textShadow: "0 0 24px currentColor" }}>
            {banner}
            {battle.kind === "victory" && <div style={{ fontSize: 14, color: C.green, marginTop: 6, letterSpacing: 0 }}>🏆 Prêmio revelado: {boss.reward}{boss.extra ? " + " + boss.extra : ""}</div>}
            {battle.kind === "combo" && <div style={{ fontSize: 13, color: C.dim, marginTop: 6, letterSpacing: 0 }}>{shortName} completou os {fmt(cap)} XP de contribuição!</div>}
            {battle.kind === "fail" && <div style={{ fontSize: 13, color: C.dim, marginTop: 6, letterSpacing: 0 }}>A meta não foi batida no prazo. Ele voltará mais forte — preparem-se.</div>}
          </div>
        )}
        {banner && <button onClick={onDone} style={btnStyle(C.violetHot)}>Continuar</button>}
      </div>
    </div>
  );
}

export default BattleOverlay;
