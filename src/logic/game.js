import { reqFor, uid } from "../data/constants.js";

/* ---------- 3. LÓGICA (funções puras sobre o estado) ---------- */
function applyXp(s, pid, amount, label) {
  let leveled = false;
  const players = s.players.map((p) => {
    if (p.id !== pid) return p;
    let xp = p.xp + amount, lvl = p.level;
    if (amount >= 0) {
      while (xp >= reqFor(lvl)) { xp -= reqFor(lvl); lvl++; leveled = true; }
    } else {
      xp = Math.max(0, xp); // LEI 3: nível conquistado nunca é perdido
    }
    return { ...p, xp, level: lvl, totalMonth: p.totalMonth + Math.max(0, amount) };
  });
  const feed = [{ id: uid(), who: pid, text: label, xp: amount, t: Date.now() }, ...s.feed].slice(0, 60);
  return { next: { ...s, players, feed }, leveled };
}

function applyCoins(s, pid, amount) {
  return { ...s, players: s.players.map((p) => (p.id === pid ? { ...p, coins: p.coins + amount } : p)) };
}

function nowMinutes(cfg) {
  if (cfg.simTime && /^\d{2}:\d{2}$/.test(cfg.simTime)) {
    const [h, m] = cfg.simTime.split(":").map(Number);
    return h * 60 + m;
  }
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export { applyXp, applyCoins, nowMinutes };
