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

const TITLES = ["Recruta", "Operador", "Especialista em Conferência", "Veterano", "Arauto da Organização", "Máquina de Produção", "Lenda Viva"];
const titleFor = (lvl) => TITLES[Math.min(TITLES.length - 1, Math.floor(lvl / 5))];

function mkPlayer(id, name, role, level, xp, coins, streak, tone, hair, sched) {
  return {
    id, name, role, level, xp, coins, streak,
    totalMonth: xp + level * 400,
    skin: "elite", ownedSkins: ["elite"],
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

const SEED = {
  version: 3,
  players: [
    mkPlayer("p1", "Andressa Silva", "Operadora de Estoque", 15, 8450, 2450, 27, "#c98d63", "#141420", "09:00"),
    mkPlayer("p2", "Mauro Lima",     "Conferente",           13, 6230, 1800, 12, "#8d5a3b", "#241a12", "08:00"),
    mkPlayer("p3", "José Pereira",   "Auxiliar de Estoque",  12, 5480, 1500, 9,  "#a06a44", "#101018", "09:00"),
    mkPlayer("p4", "Lunara Costa",   "Operadora de Estoque", 11, 4210, 1200, 15, "#d9a06f", "#2b1a10", "09:00"),
    mkPlayer("p5", "Carlos Souza",   "Conferente",           10, 3890, 900,  5,  "#b97a50", "#15161e", "07:00"),
    mkPlayer("p6", "Ana Rocha",      "Auxiliar de Estoque",  9,  3150, 700,  21, "#e3b48a", "#1c1410", "09:00"),
  ],
  missions: [
    { id: "m1", name: "Inventário Perfeito",            xp: 300, boss: true,  completedBy: [] },
    { id: "m2", name: "Recebimento Nacional sem erro",  xp: 250, boss: true,  completedBy: [] },
    { id: "m3", name: "Zerar divergências da semana",   xp: 400, boss: true,  completedBy: [] },
    { id: "m4", name: "Checklist de transferência",     xp: 200, boss: true,  completedBy: [] },
    { id: "m5", name: "Organizar endereçamento A1–A4",  xp: 150, boss: false, completedBy: [] },
    { id: "m6", name: "Treinar um colega novo",         xp: 250, boss: false, completedBy: [] },
  ],
  boss: {
    name: "Devorador de Prazos",
    kind: "Chefão da Semana",
    maxHp: 6000, hp: 6000,
    reward: "Almoço com a diretoria + 500 FlixCoins p/ cada",
    contributions: {}, defeated: false,
  },
  provas: [],
  ideas: [],
  redeems: [],
  feed: [
    { id: uid(), who: "p1", text: "concluiu a missão 'Inventário Perfeito'", xp: 300, t: Date.now() - 2 * 36e5 },
    { id: uid(), who: "p3", text: "concluiu 'Recebimento Nacional'", xp: 250, t: Date.now() - 3 * 36e5 },
    { id: uid(), who: "p2", text: "alcançou o nível 13", xp: 500, t: Date.now() - 5 * 36e5 },
  ],
  config: { xpPerPoint: 10, checkinXp: 50, latePenalty: true, penaltyValue: 20, ideaXp: { baixo: 100, medio: 300, alto: 800 }, simTime: "", gestorPin: "2026" },
};

/* ---------- Helpers de UI ---------- */
const fmt = (n) => n.toLocaleString("pt-BR");
const ago = (t) => {
  const h = Math.floor((Date.now() - t) / 36e5);
  if (h < 1) return "agora";
  return `há ${h}h`;
};

export { C, reqFor, uid, BOSS_CAP, SKINS, MARKET, TITLES, titleFor, SEED, fmt, ago };
