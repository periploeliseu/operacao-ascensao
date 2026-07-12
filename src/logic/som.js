/* Motor de som do jogo. Arquivos em public/assets/sons/{nome}.mp3.
   Sem o arquivo, falha em silêncio — som é tempero, nunca dependência. */
const cache = {};
export function tocar(nome, volume = 0.6) {
  try {
    if (!cache[nome]) cache[nome] = new Audio(`/assets/sons/${nome}.mp3`);
    const a = cache[nome];
    a.volume = volume;
    a.currentTime = 0;
    a.play().catch(() => {});
  } catch { /* nunca quebra o jogo */ }
}

/* ---- trilha ambiente: UMA instância, compartilhada entre capa e jogo ----
   A troca de tela não recarrega a página, então a música atravessa o login
   sem cortar. A preferência (ligada/silenciada) fica salva no aparelho. */
let trilha = null;
export function trilhaPreferencia() {
  try { return localStorage.getItem("trilha") || "on"; } catch { return "on"; }
}
function lembrar(v) { try { localStorage.setItem("trilha", v); } catch { /* sem memória, sem drama */ } }
export function trilhaIniciar() {
  if (!trilha) { trilha = new Audio("/assets/ambiente.mp3"); trilha.loop = true; trilha.volume = 0.3; }
  lembrar("on");
  return trilha.play().then(() => true).catch(() => false);
}
export function trilhaParar() { lembrar("off"); if (trilha) trilha.pause(); }
