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
  const [coins, setCoins] = useState("");
  const [tipo, setTipo] = useState("fixa");
  const [boss, setBoss] = useState(true);
  return (
    <div style={{ ...cardStyle, border: `1px dashed ${C.border2}` }}>
      <b style={{ fontSize: 13, letterSpacing: 1, color: C.dim }}>GESTOR — NOVA MISSÃO</b>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 80px 110px 1.4fr auto auto", gap: 10, marginTop: 10, alignItems: "center" }}>
        <input placeholder="Nome da missão" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        <input placeholder="XP" value={xp} onChange={(e) => setXp(e.target.value.replace(/\D/g, ""))} style={inputStyle} />
        <input placeholder="Moedas 🤫" title="Oculto para a equipe — revelado só ao concluir" value={coins} onChange={(e) => setCoins(e.target.value.replace(/\D/g, ""))} style={inputStyle} />
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={inputStyle}>
          <option value="fixa">Fixa — renova 00:00, sem punição</option>
          <option value="diaria">Diária — renova 00:00, PUNE se não fizer</option>
          <option value="esporadica">Esporádica — única</option>
        </select>
        <label style={{ fontSize: 12.5, color: C.dim, display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={boss} onChange={(e) => setBoss(e.target.checked)} /> ☠ Chefão
        </label>
        <button disabled={!name || !xp} onClick={() => { onAdd(name, Number(xp), boss, Number(coins) || 0, tipo !== "esporadica", tipo === "diaria"); setName(""); setCoins(""); }} style={{ ...btnStyle(C.violetHot), opacity: name && xp ? 1 : 0.4 }}>Criar</button>
      </div>
      <div style={{ fontSize: 11.5, color: C.dim2, marginTop: 8 }}>As moedas ficam OCULTAS para a equipe (surpresa ao concluir). Diária não concluída até 00:00: perde o XP previsto e 5 moedas.</div>
    </div>
  );
}

function BossForm({ onSummon }) {
  const [name, setName] = useState("");
  const [focus, setFocus] = useState("");
  const [hp, setHp] = useState("6000");
  const [days, setDays] = useState("7");
  const [reward, setReward] = useState("");
  const [extra, setExtra] = useState("");
  const [kind, setKind] = useState("Chefão da Semana");
  return (
    <div style={{ ...cardStyle, border: `1px dashed ${C.border2}`, marginTop: 14 }}>
      <b style={{ fontSize: 13, letterSpacing: 1, color: C.dim }}>GESTOR — CONVOCAR NOVO CHEFÃO</b>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
        <input placeholder="Nome (ex: Algoz da Desorganização)" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        <input placeholder="Foco da semana (ex: liberar só equipamento bom)" value={focus} onChange={(e) => setFocus(e.target.value)} style={inputStyle} />
        <input placeholder="HP total (vida do vilão)" value={hp} onChange={(e) => setHp(e.target.value.replace(/\D/g, ""))} style={inputStyle} />
        <input placeholder="Prazo em dias" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} style={inputStyle} />
        <input placeholder="Prêmio (OCULTO para a equipe)" value={reward} onChange={(e) => setReward(e.target.value)} style={inputStyle} />
        <input placeholder="Extra (opcional)" value={extra} onChange={(e) => setExtra(e.target.value)} style={inputStyle} />
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={inputStyle}>
          <option>Chefão da Semana</option>
          <option>Chefão do Mês</option>
        </select>
        <button disabled={!name || !hp || !days} onClick={() => onSummon({ name, focus, maxHp: Number(hp), deadline: Date.now() + Number(days) * 864e5, reward: reward || "Prêmio surpresa", extra, kind })} style={{ ...btnStyle(C.red), opacity: name && hp && days ? 1 : 0.4 }}>⚔ Convocar</button>
      </div>
      <div style={{ fontSize: 11.5, color: C.dim2, marginTop: 8 }}>A cota individual = HP ÷ nº de colaboradores. A equipe só vê "???" no prêmio — a curiosidade é parte da mecânica.</div>
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

export { ProvaForm, AddMission, IdeaForm, BossForm };
