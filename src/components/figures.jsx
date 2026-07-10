import React from "react";
import { C, SKINS } from "../data/constants.js";

/* ---------- Avatar SVG estilizado ---------- */
function Avatar({ p, size = 40, ring }) {
  const skin = SKINS.find((s) => s.id === p.skin) || SKINS[0];
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ borderRadius: "50%", background: `radial-gradient(circle at 50% 30%, ${skin.accent}33, #0a0f1e 75%)`, border: `2px solid ${ring || C.border2}`, flexShrink: 0 }}>
      <circle cx="24" cy="19" r="9" fill={p.tone} />
      <path d="M15 17 Q15 8 24 8 Q33 8 33 17 L33 14 Q33 6 24 6 Q15 6 15 14 Z" fill={p.hair} />
      <path d="M14 18 Q13 10 24 9 L24 12 Q17 12 16 19 Z" fill={p.hair} />
      <path d="M8 48 Q10 32 24 32 Q38 32 40 48 Z" fill={skin.suit} />
      <path d="M8 48 Q10 32 24 32 L24 48 Z" fill={skin.suit} />
      <path d="M20 33 L24 40 L28 33 L24 35 Z" fill={skin.accent} />
    </svg>
  );
}

/* ---------- Personagem grande (painel central) ---------- */
function HeroFigure({ p, height = 340 }) {
  const sk = SKINS.find((s) => s.id === p.skin) || SKINS[0];
  return (
    <svg width={height * 0.52} height={height} viewBox="0 0 130 250" style={{ filter: `drop-shadow(0 0 24px ${sk.accent}55)` }}>
      {/* aura */}
      <ellipse cx="65" cy="238" rx="46" ry="9" fill={sk.accent} opacity="0.25" />
      {/* pernas */}
      <path d="M48 140 L44 208 L54 208 L58 148 Z" fill={sk.suit} stroke={sk.trim} strokeWidth="1" />
      <path d="M82 140 L86 208 L76 208 L72 148 Z" fill={sk.suit} stroke={sk.trim} strokeWidth="1" />
      {/* botas */}
      <path d="M42 206 L56 206 L58 226 L38 226 Z" fill="#0c0d14" stroke={sk.accent} strokeWidth="1.4" />
      <path d="M74 206 L88 206 L92 226 L72 226 Z" fill="#0c0d14" stroke={sk.accent} strokeWidth="1.4" />
      {/* tronco */}
      <path d="M42 78 Q65 70 88 78 L84 145 Q65 152 46 145 Z" fill={sk.suit} stroke={sk.trim} strokeWidth="1.5" />
      {/* detalhes do traje */}
      <path d="M65 80 L65 148" stroke={sk.accent} strokeWidth="2.5" opacity="0.9" />
      <path d="M46 92 L60 96 M84 92 L70 96" stroke={sk.accent} strokeWidth="2" />
      <rect x="50" y="118" width="30" height="6" rx="2" fill="#0c0d14" stroke={sk.accent} strokeWidth="1" />
      {/* braços */}
      <path d="M42 82 L28 122 L36 128 L50 96 Z" fill={sk.suit} stroke={sk.trim} strokeWidth="1" />
      <path d="M88 82 L102 122 L94 128 L80 96 Z" fill={sk.suit} stroke={sk.trim} strokeWidth="1" />
      {/* luvas */}
      <circle cx="31" cy="126" r="6" fill="#0c0d14" stroke={sk.accent} strokeWidth="1.4" />
      <circle cx="99" cy="126" r="6" fill="#0c0d14" stroke={sk.accent} strokeWidth="1.4" />
      {/* pescoço + cabeça */}
      <rect x="59" y="62" width="12" height="10" fill={p.tone} />
      <circle cx="65" cy="48" r="17" fill={p.tone} />
      {/* cabelo */}
      <path d="M48 46 Q47 28 65 28 Q83 28 82 46 L82 40 Q82 24 65 24 Q48 24 48 40 Z" fill={p.hair} />
      <path d="M47 47 Q45 30 60 27 L60 32 Q51 34 50 48 Z" fill={p.hair} />
      <path d="M80 50 Q88 60 84 78 L79 74 Q82 62 78 52 Z" fill={p.hair} />
      {/* rosto simples */}
      <circle cx="59" cy="47" r="1.7" fill="#141420" />
      <circle cx="71" cy="47" r="1.7" fill="#141420" />
      <path d="M61 55 Q65 58 69 55" stroke="#141420" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* logo no peito */}
      <path d="M58 100 L65 92 L72 100 L65 97 Z" fill={sk.accent} />
    </svg>
  );
}

/* ---------- Monstro do chefão ---------- */
function BossFigure({ size = 200, hurt }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className={hurt ? "boss-hurt" : ""}>
      <ellipse cx="100" cy="188" rx="70" ry="10" fill="#a855f7" opacity="0.2" />
      <path d="M100 30 Q160 40 165 105 Q168 160 100 178 Q32 160 35 105 Q40 40 100 30 Z" fill="#170b2b" stroke="#5b21b6" strokeWidth="3" />
      <path d="M62 42 L38 8 L74 30 Z" fill="#2a1245" stroke="#7c3aed" strokeWidth="2" />
      <path d="M138 42 L162 8 L126 30 Z" fill="#2a1245" stroke="#7c3aed" strokeWidth="2" />
      <path d="M68 88 Q80 78 92 88 Q80 96 68 88 Z" fill={hurt ? "#f87171" : "#a855f7"} />
      <path d="M108 88 Q120 78 132 88 Q120 96 108 88 Z" fill={hurt ? "#f87171" : "#a855f7"} />
      <path d="M65 130 Q100 118 135 130 L128 146 L118 136 L108 148 L100 136 L92 148 L82 136 L72 146 Z" fill="#0b0616" stroke="#7c3aed" strokeWidth="2" />
      <path d="M55 60 Q100 48 145 60" stroke="#7c3aed" strokeWidth="2" fill="none" opacity="0.6" />
    </svg>
  );
}

export { Avatar, HeroFigure, BossFigure };
