import React from "react";
import { C } from "../data/constants.js";

/* ---------- Barra de XP ---------- */
function Bar({ value, max, color = C.violetHot, h = 8 }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ height: h, background: "#1a2440", borderRadius: h, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", borderRadius: h, background: `linear-gradient(90deg, ${C.violetDeep}, ${color})`, boxShadow: `0 0 10px ${color}88`, transition: "width .6s ease" }} />
    </div>
  );
}

function Chip({ children, color = C.violetHot, bg }) {
  return <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.8, color, background: bg || `${color}1c`, border: `1px solid ${color}55`, padding: "3px 8px", borderRadius: 6, textTransform: "uppercase" }}>{children}</span>;
}

function Coin({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
      <circle cx="10" cy="10" r="9" fill={C.gold} stroke={C.goldDeep} strokeWidth="1.5" />
      <text x="10" y="14" textAnchor="middle" fontSize="11" fontWeight="900" fill="#7a4d00">$</text>
    </svg>
  );
}

/* ---------- estilos de botão ---------- */
const btnStyle = (color, ghost) => ({
  background: ghost ? "transparent" : `linear-gradient(135deg, ${color}, ${C.violetDeep})`,
  color: ghost ? color : "#fff",
  border: ghost ? `1px solid ${color}66` : "none",
  padding: "9px 18px", borderRadius: 9, fontWeight: 700, fontSize: 13,
  cursor: "pointer", letterSpacing: 0.4,
});
const inputStyle = {
  background: C.panel2, border: `1px solid ${C.border2}`, color: C.text,
  padding: "9px 12px", borderRadius: 8, fontSize: 13, outline: "none", width: "100%",
};
const cardStyle = { background: C.panel, border: `1px solid ${C.border}`, borderRadius: 14, padding: 16 };

export { Bar, Chip, Coin, btnStyle, inputStyle, cardStyle };
