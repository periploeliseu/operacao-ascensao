/* ---------- 1. TOKENS DE DESIGN (paleta do mockup) ---------- */
const C = {
  bg: "#070b16",
  panel: "#0b1120",
  panel2: "#0f1728",
  card: "#111c33",
  border: "#1d2a45",
  border2: "#2a3a5e",
  violet: "#8b5cf6",
  violetHot: "#a855f7",
  violetDeep: "#5b21b6",
  gold: "#f5b52e",
  goldDeep: "#b97f0f",
  text: "#e9eefb",
  dim: "#8e9ab5",
  dim2: "#5d6a86",
  green: "#34d399",
  red: "#f8717a",
  orange: "#fb923c",
  blue: "#38bdf8",
};

/* ---------- 2. REGRAS DO JOGO ---------- */
// XP necessário para subir do nível N para N+1 (cresce até travar em 10.000)
const reqFor = (lvl) => Math.min(10000, 1000 + (lvl - 1) * 650);
const uid = () => Math.random().toString(36).slice(2, 9);
const BOSS_CAP = 1000; // XP que cada colaborador precisa causar no chefão

const SKINS = [
  { id: "elite",     name: "Elite de Estoque",  price: 0,    suit: "#181a24", accent: "#a855f7", trim: "#6d28d9" },
  { id: "comandante",name: "Comandante",        price: 2000, suit: "#0e1b33", accent: "#38bdf8", trim: "#1d4ed8" },
  { id: "lenda",     name: "Lenda da Logística",price: 3500, suit: "#241a06", accent: "#f5b52e", trim: "#92610a" },
  { id: "guardiao",  name: "Guardião Supremo",  price: 5000, suit: "#0a2230", accent: "#22d3ee", trim: "#0e7490" },
  { id: "ascensao",  name: "Ascensão Máxima",   price: 7500, suit: "#1c1206", accent: "#fbbf24", trim: "#7c2d12" },
  { id: "secreta",   name: "Skin Secreta",      price: 9999, suit: "#12061c", accent: "#f0abfc", trim: "#701a75", lockedLevel: 20 },
];

const MARKET = [
  { id: "camisa",  name: "Camisa Flix",           price: 800,  icon: "👕" },
  { id: "caneca",  name: "Caneca Ascensão",       price: 400,  icon: "☕" },
  { id: "mouse",   name: "Mouse Gamer",           price: 1500, icon: "🖱️" },
  { id: "livro",   name: "Livro à escolha",       price: 600,  icon: "📚" },
  { id: "curso",   name: "Curso online",          price: 2500, icon: "🎓" },
  { id: "fone",    name: "Fone Bluetooth",        price: 2000, icon: "🎧" },
  { id: "gas",     name: "Vale Combustível",      price: 3000, icon: "⛽" },
  { id: "pix",     name: "PIX R$ 100",            price: 5000, icon: "💸" },
  { id: "airbnb",  name: "Fim de semana Airbnb",  price: 12000, icon: "🏡" },
];

/* 9 categorias de raridade × 5 patentes = 45 títulos. 1 patente por nível. */
const CATEGORIAS = [
  { nome: "Comum",         icone: "🟢", cor: "#34d399", patentes: ["Recruta", "Operador", "Executor", "Especialista", "Veterano"] },
  { nome: "Incomum",       icone: "🔵", cor: "#38bdf8", patentes: ["Guardião", "Sentinela", "Patrulheiro", "Defensor", "Supervisor"] },
  { nome: "Raro",          icone: "🟣", cor: "#a855f7", patentes: ["Mestre", "Estrategista", "Comandante", "Oficial", "Arquiteto"] },
  { nome: "Super Raro",    icone: "🟠", cor: "#fb923c", patentes: ["Marechal", "Titã", "Soberano", "General", "Imperador"] },
  { nome: "Épico",         icone: "🔴", cor: "#f8717a", patentes: ["Lenda", "Campeão Supremo", "Guardião Supremo", "Conquistador", "Herói da Ascensão"] },
  { nome: "Mítico",        icone: "🟡", cor: "#fbbf24", patentes: ["Arconte", "Ascendente", "Dominador", "Arquiteto Supremo", "Supremo Executor"] },
  { nome: "Lendário",      icone: "💎", cor: "#f0abfc", patentes: ["Avatar da Logística", "Senhor da Operação", "Mestre Absoluto", "Lenda Viva", "Escolhido da Ascensão"] },
  { nome: "Transcendente", icone: "👑", cor: "#e6c463", patentes: ["Semideus", "Primordial", "Ancião Supremo", "Entidade Suprema", "Avatar Supremo"] },
  { nome: "Deus",          icone: "⚡", cor: "#7dd3fc", patentes: ["Deus da Logística", "Deus da Precisão", "Deus da Operação", "Deus da Ascensão", "Criador da Ordem"] },
];
/* Patente completa de um nível (trava no topo: 45+) */
function patenteDe(level) {
  const idx = Math.min(44, Math.max(0, level - 1));
  const cat = CATEGORIAS[Math.floor(idx / 5)];
  return { titulo: cat.patentes[idx % 5], categoria: cat.nome, cor: cat.cor, icone: cat.icone };
}
/* Compatibilidade: título simples do nível */
const titleFor = (lvl) => patenteDe(lvl).titulo;

function mkPlayer(id, name, role, level, xp, coins, streak, tone, hair, sched) {
  return {
    id, name, role, level, xp, coins, streak,
    totalMonth: xp + level * 400,
    skin: "elite", ownedSkins: ["elite"],
    nick: null, pet: null, ownedPets: [],
    tone, hair, schedule: sched, lastCheckin: null,
    attrs: {
      "Organização": 60 + ((level * 7) % 35),
      "Precisão": 60 + ((level * 11) % 35),
      "Agilidade": 55 + ((level * 5) % 30),
      "Liderança": 50 + ((level * 3) % 30),
      "Trabalho em Equipe": 62 + ((level * 9) % 30),
      "Responsabilidade": 65 + ((level * 13) % 30),
    },
  };
}

/* Paletas para novos colaboradores (tom de pele e cabelo do avatar) */
const TONES = ["#c98d63", "#8d5a3b", "#a06a44", "#d9a06f", "#b97a50", "#e3b48a", "#7a4a2e", "#caa27a"];
const HAIRS = ["#141420", "#241a12", "#101018", "#2b1a10", "#15161e", "#1c1410", "#30231a", "#0d0d12"];

/* Novo colaborador SEMPRE começa do zero: nível 1, 0 XP, 0 moedas (LEI 2) */
function mkNewPlayer(name, role, sched) {
  const i = Math.floor(Math.random() * TONES.length);
  const p = mkPlayer("pl" + uid(), name, role || "Colaborador", 1, 0, 0, 0, TONES[i], HAIRS[i], sched || "09:00");
  p.totalMonth = 0;
  return p;
}


/* Pets decorativos (cosmético puro) */
const PETS = [
  { id: "lobo", name: "Lobo de Carga", icon: "🐺", price: 1200 },
  { id: "falcao", name: "Falcão do Inventário", icon: "🦅", price: 1500 },
  { id: "tartaruga", name: "Tartaruga Blindada", icon: "🐢", price: 900 },
  { id: "dragao", name: "Dragão da Auditoria", icon: "🐉", price: 3000 },
];

/* Roleta da pontualidade — 6 prêmios, pesos iguais */
const ROULETTE = [
  { label: "+5 XP", xp: 5 }, { label: "+6 XP", xp: 6 }, { label: "+7 XP", xp: 7 },
  { label: "+1 moeda", coins: 1 }, { label: "+2 moedas", coins: 2 }, { label: "+3 moedas", coins: 3 },
];

const SEED = {
  version: 5,
  players: [],
  missions: [
    { id: "m1", name: "Inventário Perfeito",            xp: 300, boss: true,  coins: 0, renew: true, punish: false, completedBy: [] },
    { id: "m2", name: "Recebimento Nacional sem erro",  xp: 250, boss: true,  coins: 0, renew: true, punish: false, completedBy: [] },
    { id: "m3", name: "Zerar divergências da semana",   xp: 400, boss: true,  coins: 0, renew: true, punish: false, completedBy: [] },
    { id: "m4", name: "Checklist de transferência",     xp: 200, boss: true,  coins: 0, renew: true, punish: false, completedBy: [] },
    { id: "m5", name: "Organizar endereçamento A1–A4",  xp: 150, boss: false, coins: 0, renew: true, punish: false, completedBy: [] },
    { id: "m6", name: "Treinar um colega novo",         xp: 250, boss: false, coins: 0, renew: true, punish: false, completedBy: [] },
  ],
  boss: {
    name: "Devorador de Prazos",
    kind: "Chefão da Semana",
    maxHp: 0, hp: 0,
    reward: "Almoço com a diretoria + 500 FlixCoins p/ cada",
    cap: 1000, focus: "", extra: "", deadline: null, failed: false,
    contributions: {}, defeated: false,
  },
  provas: [],
  ideas: [],
  redeems: [],
  lastRollover: null,
  feed: [],
  config: { xpPerPoint: 10, checkinXp: 50, latePenalty: true, penaltyValue: 20, ideaXp: { baixo: 100, medio: 300, alto: 800 }, simTime: "", gestorPin: "2026", coinName: "FlixCoins", seasonTitle: "" },
};

/* ---------- Helpers de UI ---------- */
const fmt = (n) => n.toLocaleString("pt-BR");
const ago = (t) => {
  const h = Math.floor((Date.now() - t) / 36e5);
  if (h < 1) return "agora";
  return `há ${h}h`;
};

export { C, reqFor, uid, BOSS_CAP, SKINS, MARKET, CATEGORIAS, patenteDe, titleFor, SEED, fmt, ago, mkNewPlayer, PETS, ROULETTE };
