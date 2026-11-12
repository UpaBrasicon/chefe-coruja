# J5: Preços e Contato na página de entrada — diagnóstico

**Pedido.** Pedido 8 do RT, caminho C, item J5: a página de entrada do app (www.chefecoruja.com.br) ganha links para Preços e Contato, no topo e no rodapé. A decisão D3 de 11/11/2026 manda Preços, Contato e Privacidade ficarem na `landing/`, num subdomínio.

**Escopo.** Este documento é só diagnóstico. Nada muda no código, no Vercel ou no DNS aqui.

## Como está hoje

- **Página de entrada do app** (`src/pages/landing/Landing.tsx`):
  - o topo tem "Telas", "Como funciona", "Segurança" e "Papéis", mais "Primeiro acesso" e "Entrar";
  - o rodapé tem só o nome e a frase da marca;
  - não há link de Preços, de Contato nem de Privacidade. O app não tem página de privacidade.
- **`landing/`** (Next, projeto Vercel `chefe-coruja-landing`):
  - está só em chefe-coruja-landing.vercel.app, sem domínio próprio. O subdomínio da D3 ainda não existe;
  - tem `/precos` (três planos "sob consulta"), `/contato` (formulário que envia pela Resend, testado em 09/11/2026), `/privacidade`, `/obrigado`, `/funcionalidades` e a página inicial;
  - o endereço oficial dela (`SITE_URL`, em `landing/lib/site.ts`) vale `https://chefecoruja.com.br` se a variável `NEXT_PUBLIC_SITE_URL` não estiver definida. O endereço canônico, o mapa do site e as migalhas de pão apontam para o domínio do app, onde essas páginas não existem;
  - publica só o que vai para o master (`landing/vercel.json`).

## O que muda

1. **Subdomínio da `landing/`:**
   - eu adiciono o domínio ao projeto `chefe-coruja-landing` pelo conector do Vercel, e o Vercel diz qual registro CNAME criar;
   - o RT cria esse registro no Cloudflare, sem o proxy laranja, porque o Vercel emite o certificado;
   - a variável `NEXT_PUBLIC_SITE_URL` do projeto passa a ser o subdomínio, e o canônico, o mapa do site e as migalhas de pão passam a apontar para ele.
2. **Páginas que sobram na `landing/`:** a página inicial e `/funcionalidades` repetem o que a página do app já mostra. Pela D3, elas redirecionam para www.chefecoruja.com.br, e `/obrigado` continua, porque é a volta do formulário.
3. **Links na página do app:**
   - no topo, "Preços" ao lado das seções;
   - no rodapé, "Preços", "Contato" e "Privacidade";
   - os links abrem o subdomínio na mesma aba.

## Banco, funções e permissões

Nada. Não há migration nem função. A CSP do app não muda, porque link não é pedido de rede.

## Testes e critérios de aceite (com evidência)

- O subdomínio abre `/precos`, `/contato` e `/privacidade` com certificado válido.
- O canônico de cada página aponta para o subdomínio.
- A página inicial e `/funcionalidades` do subdomínio redirecionam para www.chefecoruja.com.br.
- Na página do app, os links do topo e do rodapé levam às páginas certas, sem passar da largura em 375 px.
- O formulário de contato no subdomínio envia e o e-mail chega, como em 09/11/2026.
- A evidência fica em `docs/landing/j5-evidencia/`.

## Riscos

- **Dois formulários:** o de contato da `landing/` e o "Agendar demonstração" do J3, no app. Os dois mandam para o mesmo endereço, contato@. Quando o J3 sair, o "Contato" do app pode passar a abrir o formulário do próprio app.
- **DNS depende do RT:** sem o registro no Cloudflare, os links não podem ir para o ar. Link para o endereço vercel.app parece provisório para quem compra.
- **Proxy do Cloudflare:** com o proxy ligado, o certificado do Vercel não é emitido e o subdomínio fica fora do ar.

## Decisões do RT

| # | Pergunta | Opções | Recomendação | Decisão do RT |
|---|---|---|---|---|
| K1 | Nome do subdomínio | a) `site.chefecoruja.com.br`; b) `planos.chefecoruja.com.br`; c) outro, à escolha do RT | a | b) `planos.chefecoruja.com.br` (12/11/2026) |
| K2 | Enquanto o DNS não existe | a) os links esperam o subdomínio; b) os links vão já para chefe-coruja-landing.vercel.app e trocam depois; c) só "Contato" vai já, para o e-mail contato@, e "Preços" espera | a | a) esperam o subdomínio (12/11/2026) |
| K3 | Página inicial e `/funcionalidades` da `landing/` | a) redirecionam para www.chefecoruja.com.br; b) ficam no ar | a | a) redirecionam (12/11/2026) |

## Ordem

K1–K3 → domínio no Vercel e registro do RT no Cloudflare → variável `NEXT_PUBLIC_SITE_URL` e redirecionamentos na `landing/`, em PR próprio → links na página do app, em PR próprio → conferência → ok do RT → mesclar.

## Demonstração comercial

Quem chega pelo endereço da marca acha o preço e o contato a um clique, sem sair do mesmo domínio.
