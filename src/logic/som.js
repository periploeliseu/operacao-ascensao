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
