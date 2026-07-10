import React, { useState } from "react";
import { C, fmt } from "../data/constants.js";
import { btnStyle, inputStyle, cardStyle } from "./ui.jsx";

/* ---------- Formulários auxiliares ---------- */
function ProvaForm({ players, cfg, onApply }) {
  const [pid, setPid] = useState(players[0].id);
  const [nome, setNome] = useState("");
  const [nota, setNota] = useState("");
  const n = Math.max(0, Math.min(100, Number(nota) || 0));
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 120px", gap: 10 }}>
        <select value={pid} onChange={(e) => setPid(e.target.value)} style={inputStyle}>
          {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input placeholder="Nome da prova (ex: Prova de Recebimento)" value={nome} onChange={(e) => setNome(e.target.value)} style={inputStyle} />
        <input placeholder="Nota (0-100)" value={nota} onChange={(e) => setNota(e.target.value.replace(/\D/g, ""))} style={inputStyle} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 13, color: C.dim }}>Conversão: <b style={{ color: C.green, fontSize: 15 }}>{n} pontos → +{fmt(n * cfg.xpPerPoint)} XP</b></div>
        <button disabled={!nota} onClick={() => { onApply(pid, nome, n); setNota(""); setNome(""); }} style={{ ...btnStyle(C.violetHot), opacity: nota ? 1 : 0.4 }}>Lançar nota</button>
      </div>
    </div>
  );
}

function AddMission({ onAdd }) {
  const [name, setName] = useState("");
  const [xp, setXp] = useState("200");
  const [boss, setBoss] = useState(true);
  return (
    <div style={{ ...cardStyle, border: `1px dashed ${C.border2}` }}>
      <b style={{ fontSize: 13, letterSpacing: 1, color: C.dim }}>GESTOR — NOVA MISSÃO</b>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 110px auto auto", gap: 10, marginTop: 10, alignItems: "center" }}>
        <input placeholder="Nome da missão" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        <input placeholder="XP" value={xp} onChange={(e) => setXp(e.target.value.replace(/\D/g, ""))} style={inputStyle} />
        <label style={{ fontSize: 12.5, color: C.dim, display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={boss} onChange={(e) => setBoss(e.target.checked)} /> ☠ Chefão
        </label>
        <button disabled={!name || !xp} onClick={() => { onAdd(name, Number(xp), boss); setName(""); }} style={{ ...btnStyle(C.violetHot), opacity: name && xp ? 1 : 0.4 }}>Criar</button>
      </div>
    </div>
  );
}

function IdeaForm({ onSubmit }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <div style={cardStyle}>
      <b style={{ fontSize: 13, letterSpacing: 1, color: C.dim }}>NOVA IDEIA</b>
      <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
        <input placeholder="Título da ideia" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
        <textarea placeholder="Detalhe bem: problema, solução, ganho estimado. Ideia rasa não farma XP." rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        <button disabled={!title || !desc} onClick={() => { onSubmit(title, desc); setTitle(""); setDesc(""); }} style={{ ...btnStyle(C.violetHot), opacity: title && desc ? 1 : 0.4, justifySelf: "start" }}>Enviar ao gestor</button>
      </div>
    </div>
  );
}

export { ProvaForm, AddMission, IdeaForm };
