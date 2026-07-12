import React, { useEffect, useRef, useState } from "react";
import { C } from "./data/constants.js";
import { btnStyle, inputStyle, cardStyle } from "./components/ui.jsx";
import { entrar } from "./logic/api.js";

/* Tela-título cinematográfica.
   Arquivos em public/assets/ (todos opcionais — o jogo nunca quebra por falta de arte):
   - capa.png      arte oficial (obrigatória para o modo capa)
   - capa.mp4      loop animado da capa (se existir, substitui a imagem AUTOMATICAMENTE)
   - ambiente.mp3  trilha de suspense em loop (começa no primeiro clique — regra do navegador)
   - iniciar.mp3   efeito ao apertar INICIAR (opcional) */
const CAPA = "/assets/capa.png";
const VIDEO = "/assets/capa.mp4";
const AMBIENTE = "/assets/ambiente.mp3";
const STING = "/assets/iniciar.mp3";

/* Pontos de brilho sobre a arte (percentuais RELATIVOS AO QUADRO — ajuste fino aqui) */
const BRILHOS = [
  { x: 16.5, y: 14,   size: 80,  cor: "rgba(255,70,70,.55)",   dur: 3.4 },            /* olhos vermelhos */
  { x: 47.6, y: 11.5, size: 55,  cor: "rgba(168,85,247,.55)",  dur: 4.2 },            /* chefão olho E */
  { x: 52.4, y: 11.5, size: 55,  cor: "rgba(168,85,247,.55)",  dur: 4.2, delay: 0.5 },/* chefão olho D */
  { x: 79,   y: 13.5, size: 75,  cor: "rgba(168,85,247,.45)",  dur: 3.8, delay: 1.1 },/* vilã mascarada */
  { x: 89.5, y: 14.5, size: 120, cor: "rgba(139,92,246,.4)",   dur: 5.2 },            /* alvo hacker */
  { x: 50,   y: 63,   size: 240, cor: "rgba(124,58,237,.32)",  dur: 6.5 },            /* portal central */
];

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [capaOk, setCapaOk] = useState(false);
  const [videoOk, setVideoOk] = useState(false);
  const [somAtivo, setSomAtivo] = useState(false);
  const amb = useRef(null);

  /* sonda a arte e o vídeo (se não existirem, cai no plano B em silêncio) */
  useEffect(() => {
    const img = new Image();
    img.onload = () => setCapaOk(true);
    img.src = CAPA;
    const v = document.createElement("video");
    v.onloadeddata = () => setVideoOk(true);
    v.src = VIDEO;
    v.load();
  }, []);

  /* trilha ambiente: navegadores SÓ liberam áudio após o 1º gesto do usuário */
  useEffect(() => {
    const a = new Audio(AMBIENTE);
    a.loop = true;
    a.volume = 0.35;
    amb.current = a;
    const ligar = () => a.play().then(() => setSomAtivo(true)).catch(() => {});
    window.addEventListener("pointerdown", ligar, { once: true });
    window.addEventListener("keydown", ligar, { once: true });
    return () => {
      a.pause();
      window.removeEventListener("pointerdown", ligar);
      window.removeEventListener("keydown", ligar);
    };
  }, []);

  const alternarSom = (e) => {
    e.stopPropagation();
    const a = amb.current;
    if (!a) return;
    if (somAtivo) { a.pause(); setSomAtivo(false); }
    else a.play().then(() => setSomAtivo(true)).catch(() => {});
  };

  const submeter = async () => {
    if (!email || !senha || carregando) return;
    try { const s = new Audio(STING); s.volume = 0.6; s.play().catch(() => {}); } catch { /* sem sting, sem drama */ }
    setCarregando(true); setErro(null);
    const e = await entrar(email.trim(), senha);
    if (e) { setErro(e); setCarregando(false); }
  };

  const formulario = (
    <div style={{ display: "grid", gap: 10 }}>
      <input placeholder="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
      <input placeholder="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submeter()} style={inputStyle} />
      {erro && <div style={{ color: C.red, fontSize: 12.5 }}>{erro}</div>}
      <button onClick={submeter} disabled={carregando} style={{ ...btnStyle(C.violetHot), opacity: carregando ? 0.6 : 1, letterSpacing: 3, fontWeight: 800 }}>
        {carregando ? "ENTRANDO…" : "▲ INICIAR"}
      </button>
      <div style={{ color: C.dim2, fontSize: 11.5, textAlign: "center" }}>Sem conta? Fale com o gestor do estoque.</div>
    </div>
  );

  if (capaOk) {
    return (
      <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden", background: "#04060e", color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", padding: "20px 16px 4.5vh" }}>
        {/* camada 1: a própria arte, desfocada, preenchendo as bordas */}
        <div style={{ position: "absolute", inset: 0, backgroundImage: `url(${CAPA})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(28px) brightness(.4)", transform: "scale(1.15)" }} />
        {/* camada 2: a arte INTEIRA, sempre enquadrada, com zoom lento */}
        {/* A arte ocupa TODA a largura; a proporção 3:2 é preservada e o excedente
            vertical é cortado com viés: pouco do teto, mais do chão (reflexo + texto). */}
        <div style={{ position: "absolute", inset: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "relative", flex: "none", width: "100vw", aspectRatio: "3 / 2", transform: "translateY(5.5%)" }}>
            <div className="zoom-lento" style={{ position: "absolute", inset: 0 }}>
              {videoOk
                ? <video src={VIDEO} autoPlay muted loop playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                : <img src={CAPA} alt="Operação Ascensão" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />}
            </div>
            {/* olhos e núcleos de energia pulsando sobre a arte */}
            {!videoOk && BRILHOS.map((g, i) => (
              <div key={i} className="brilho" style={{ left: `${g.x}%`, top: `${g.y}%`, width: g.size, height: g.size, background: `radial-gradient(circle, ${g.cor} 0%, transparent 70%)`, animationDuration: `${g.dur}s`, animationDelay: `${g.delay || 0}s` }} />
            ))}
            <div className="fumaca f1" />
            <div className="fumaca f2" />
          </div>
        </div>
        {/* brasas subindo + tremulação de energia */}
        {[...Array(9)].map((_, i) => (
          <div key={i} className="brasa" style={{ left: `${7 + i * 10.5}%`, animationDelay: `${i * 1.6}s`, animationDuration: `${9 + (i % 4) * 3}s` }} />
        ))}
        <div className="tremula" />
        {/* controle de som */}
        <button onClick={alternarSom} title={somAtivo ? "Silenciar" : "Ativar trilha"} style={{ position: "fixed", top: 14, right: 16, zIndex: 6, background: "rgba(9,12,24,.6)", border: `1px solid ${C.violet}55`, borderRadius: 999, color: C.text, padding: "8px 14px", fontSize: 13, cursor: "pointer", backdropFilter: "blur(8px)" }}>
          {somAtivo ? "🔊 som ativo" : "🔇 ativar som"}
        </button>
        {/* formulário de vidro, ancorado no INICIAR da arte */}
        <div style={{ position: "relative", zIndex: 5, width: "min(380px, 92vw)", background: "rgba(9,12,24,.72)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${C.violet}44`, borderRadius: 16, padding: 18, boxShadow: "0 0 40px rgba(124,58,237,.25)" }}>
          {formulario}
        </div>
      </div>
    );
  }

  /* plano B: sem a arte, visual clássico */
  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(900px 500px at 50% 20%, #2a104f 0%, ${C.bg} 60%)`, color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 20 }}>
      <svg width="60" height="60" viewBox="0 0 40 40"><path d="M6 30 L16 10 L23 24 L28 16 L34 30 Z" fill="none" stroke={C.blue} strokeWidth="3" strokeLinejoin="round" /></svg>
      <div style={{ fontSize: "clamp(24px, 5vw, 36px)", fontWeight: 900, letterSpacing: 3, textShadow: `0 0 30px ${C.violetHot}88` }}>OPERAÇÃO ASCENSÃO</div>
      <div style={{ color: C.dim, fontSize: 13, marginBottom: 10 }}>Flix Telecom · Estoque</div>
      <div style={{ ...cardStyle, width: "min(380px, 92vw)" }}>{formulario}</div>
    </div>
  );
}
