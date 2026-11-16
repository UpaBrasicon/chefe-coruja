# S0 — fatos 4 e 6 (conferidos em 16/11/2026)

Trilha de segurança da auditoria Cloudflare, item S0. Os fatos 1, 2, 3 e 5 já estavam conferidos (ver `BACKLOG.md`); este documento fecha os dois que faltavam. Só leitura: nada foi alterado.

## Fato 4 — o Storage serve SVG ou HTML como página?

Ele decide o achado 12 da auditoria (`docs/seguranca/auditoria-cloudflare-2026-11-15/RESUMO.md`): um SVG ou HTML anexado abriria como página.

**Conferido** em `storage.buckets` da homologação e da produção, que estão iguais. Os 8 buckets têm lista de tipos permitidos e limite de tamanho, desde o S5 (migration `20270414000060`, PR #763):

| Bucket | Público | Tipos aceitos | Limite |
|---|---|---|---|
| `atendimento` | não | PDF, JPEG, PNG, WebP, HEIC/HEIF | 20 MB |
| `banners` | sim | PNG, JPEG, WebP | 5 MB |
| `exames` | não | PDF, JPEG, PNG | 10 MB |
| `farmacia` | não | PDF, CSV, planilhas e documentos do Office | 20 MB |
| `fotos` | não | PNG, JPEG, WebP | 5 MB |
| `painel` | sim | PNG, JPEG, WebP | 5 MB |
| `receitas` | não | PDF, JPEG, PNG | 10 MB |
| `regulacao` | não | PDF, JPEG, PNG | 10 MB |

Na produção os buckets estão vazios (0 objetos).

**Conclusão:**
- Nenhum bucket aceita `image/svg+xml` nem `text/html`, então o Storage recusa o envio.
- Quem declara um tipo falso (um SVG enviado como `image/png`) recebe o arquivo de volta com o tipo declarado. Navegador não roda script de um arquivo servido como imagem PNG, JPEG ou WebP.
- O Storage responde no domínio do Supabase (`*.supabase.co`), não no do app. Mesmo um arquivo que rodasse script não alcançaria a sessão do app.

**O achado 12 está resolvido pelo S5.** Não há item novo.

## Fato 6 — qual fluxo de sessão (`flowType`) o supabase-js usa?

Ele decide o achado 5 da auditoria: um link preparado podia logar a vítima na conta do atacante.

**Conferido no código:**
- `src/lib/supabase.ts` cria o cliente sem `flowType`, então vale o padrão do supabase-js 2, o fluxo **implícito**: a sessão chega no fragmento do link, `#access_token=…`.
- Desde o S2 (decisão E3, PR #759), o cliente tem `detectSessionInUrl: false`. A sessão do link é lida à mão por `aceitarSessaoDoLink` (`src/lib/sessaoDoLink.ts`, chamada em `src/main.tsx` antes de o app subir), com estas regras:
  - fora de `/recuperar-senha` e `/login`, o link é ignorado;
  - se já há sessão aberta de outra pessoa na aba, a troca é recusada;
  - o link nunca fica na barra de endereço nem no histórico.

**O que sobra:** alguém sem sessão aberta que abre, em `/login` ou `/recuperar-senha`, um link preparado com os tokens de outra conta entra nessa conta. Para virar dano, a pessoa ainda teria de:
- não perceber que entrou como outra pessoa (o nome aparece na tela);
- fazer algo que beneficie o dono da conta, como aceitar um convite.

O aceite de convite passou a pedir e-mail confirmado (S2) e tem limite de tentativas.

**A correção completa é o fluxo PKCE** (`flowType: 'pkce'`). Com ele, o link traz um código que só funciona no navegador que pediu o e-mail, e um link preparado em outro navegador não abre sessão. Mudar exige:
- trocar os modelos de e-mail do Auth (confirmação, recuperação e convite) para o formato com código;
- refazer a tela de recuperação de senha;
- testar os três caminhos na homologação.

### Decisão para o RT (F6)

- **A (recomendada):** registrar no BACKLOG um item novo da trilha, "S12 — login por PKCE", com prioridade P3, para fazer depois do S9. O risco que sobra hoje é baixo e depende de a pessoa não ver em que conta entrou.
- **B:** aceitar o risco como está, com a proteção do S2, e registrar a decisão.

## Estado do S0

Com os fatos 4 e 6, os seis fatos estão conferidos. O S0 fecha com a decisão F6.
