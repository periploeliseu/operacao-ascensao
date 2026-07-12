import React, { useEffect, useState } from "react";
import { C } from "./data/constants.js";
import { btnStyle, inputStyle, cardStyle } from "./components/ui.jsx";
import { entrar } from "./logic/api.js";

/* Tela de login com a arte oficial de capa (public/assets/capa.png).
   Se a imagem não existir, cai no visual antigo — o jogo nunca quebra por causa de arte. */
const CAPA = "/assets/capa.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [capaOk, setCapaOk] = useState(false);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setCapaOk(true);
    img.src = CAPA;
  }, []);

  const submeter = async () => {
    if (!email || !senha || carregando) return;
    setCarregando(true); setErro(null);
    const e = await entrar(email.trim(), senha);
    if (e) { setErro(e); setCarregando(false); }
    /* sucesso: o App troca de tela sozinho ao detectar a sessão */
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
    /* ---- modo capa: arte em tela cheia, formulário ancorado embaixo ---- */
    return (
      <div style={{ minHeight: "100vh", color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", padding: "20px 16px 6vh", background: `linear-gradient(180deg, rgba(4,6,14,0) 40%, rgba(4,6,14,.82) 88%), url(${CAPA}) center / cover no-repeat fixed, ${C.bg}` }}>
        <div style={{ width: "min(380px, 92vw)", background: "rgba(9,12,24,.72)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", border: `1px solid ${C.violet}44`, borderRadius: 16, padding: 18, boxShadow: `0 0 40px rgba(124,58,237,.25)` }}>
          {formulario}
        </div>
      </div>
    );
  }

  /* ---- modo reserva: sem a imagem, visual clássico ---- */
  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(900px 500px at 50% 20%, #2a104f 0%, ${C.bg} 60%)`, color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 20 }}>
      <svg width="60" height="60" viewBox="0 0 40 40"><path d="M6 30 L16 10 L23 24 L28 16 L34 30 Z" fill="none" stroke={C.blue} strokeWidth="3" strokeLinejoin="round" /></svg>
      <div style={{ fontSize: "clamp(24px, 5vw, 36px)", fontWeight: 900, letterSpacing: 3, textShadow: `0 0 30px ${C.violetHot}88` }}>OPERAÇÃO ASCENSÃO</div>
      <div style={{ color: C.dim, fontSize: 13, marginBottom: 10 }}>Flix Telecom · Estoque</div>
      <div style={{ ...cardStyle, width: "min(380px, 92vw)" }}>{formulario}</div>
    </div>
  );
}
