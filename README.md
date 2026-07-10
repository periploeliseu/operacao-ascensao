# Operação Ascensão — Flix Telecom

Plataforma de gamificação da equipe de estoque. Projeto React + Vite.

## Estrutura do projeto

```
index.html              Página base (só tem a div #root)
vite.config.js          Configuração do compilador
package.json            Dependências e comandos
src/
  main.jsx              Ponto de entrada: monta o App na tela
  App.jsx               Componente principal (telas e ações)
  styles.css            Animações e estilos globais
  data/constants.js     Paleta, regras de XP, skins, mercado, dados iniciais
  logic/game.js         Funções puras: XP, moedas, horário de check-in
  logic/storage.js      Camada de persistência (hoje localStorage, futuro Supabase)
  components/
    figures.jsx         Avatar, personagem grande e monstro do chefão (SVG)
    ui.jsx              Barra de XP, chips, moeda, estilos de botão
    BattleOverlay.jsx   Animação da batalha contra o chefão
    forms.jsx           Formulários de prova, missão e ideia
```

## Rodar no seu computador (opcional)

1. Instale o Node.js LTS: https://nodejs.org
2. No terminal, dentro desta pasta:
   - `npm install`  (baixa as dependências — só na primeira vez)
   - `npm run dev`  (abre em http://localhost:5173)

## Publicar na internet (Vercel)

1. Crie conta em https://github.com e https://vercel.com (entre na Vercel COM a conta do GitHub).
2. No GitHub: New repository → nome `operacao-ascensao` → Create.
3. Clique em "uploading an existing file" e arraste TODOS os arquivos desta pasta
   (menos `node_modules` e `dist`, se existirem) → Commit changes.
4. Na Vercel: Add New → Project → Import no repositório `operacao-ascensao`.
   Ela detecta Vite sozinha. → Deploy.
5. Em ~1 minuto você recebe o link público (ex: operacao-ascensao.vercel.app).

Toda vez que você alterar o código no GitHub, a Vercel republica sozinha.

## Avisos importantes

- PIN padrão do Modo Gestor: **2026** — troque em Configurações antes de divulgar o link.
- Nesta versão os dados ficam no `localStorage` do NAVEGADOR de cada aparelho
  (cada celular vê o próprio jogo). Ranking unificado da equipe chega na
  Fase 3 (Supabase: login individual + banco de dados central).
