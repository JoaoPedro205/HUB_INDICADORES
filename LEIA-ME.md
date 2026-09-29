# LBX Hub — publicação no Netlify (com salvamento compartilhado)

O Hub (`public/index.html`) fala com uma pequena API (`netlify/functions/hub.mjs`) que grava
versões, nomes e indicadores no **Netlify Blobs**. Assim, tudo o que alguém salvar ou atualizar
aparece para todos que abrirem o endereço do site (a cada 45 s, ao voltar para a aba, ou em
"Verificar atualizações agora" em Configurações → Backup).

## Publicar (recomendado: Netlify CLI)
1. Instale o Node.js e rode uma vez: `npm install -g netlify-cli` e `netlify login`
2. Dentro desta pasta: `netlify init` (cria o site) e depois `netlify deploy --prod`
   (o `netlify.toml` já aponta `public/` e `netlify/functions/`).
3. No painel do Netlify: **Site configuration → Environment variables → adicionar `HUB_KEY`**
   com uma senha de acesso (recomendado) e refazer o deploy. Quem abrir o Hub digita a chave uma vez.

Também funciona conectando esta pasta a um repositório Git no Netlify.
Arrastar a pasta em app.netlify.com/drop pode publicar só a página, sem a função — nesse caso o
Hub abre em "modo local".

## Atualizar o Hub depois
Basta publicar de novo (`netlify deploy --prod`). O `netlify.toml` força o navegador a revalidar
o `index.html`, então todos recebem a nova versão ao recarregar. As versões salvas na nuvem
**não são apagadas** por novos deploys.

## Testar no seu computador (sem Netlify)
`node dev-server.mjs` e abra http://localhost:8888 (opcional: `HUB_KEY=senha node dev-server.mjs`).

## Segurança — leia
- `HUB_KEY` protege a **API** (versões e configurações na nuvem), mas o `index.html` contém os
  painéis-base com os dados que estavam neles e é público para quem tiver o endereço.
  Para restringir o acesso à página inteira, use a proteção de site do Netlify (senha/SSO, planos pagos)
  ou um serviço como o Cloudflare Access na frente do site.
- Limite: cada versão salva na nuvem pode ter até ~4,5 MB compactados (limite das Functions do Netlify).

## Primeiro acesso
Se você já salvou versões no Hub em modo local, ao abrir a versão hospedada pela primeira vez
o Hub oferece **enviar essas versões para a nuvem**. Depois, em Configurações → Backup há o botão
"Enviar para a nuvem".
