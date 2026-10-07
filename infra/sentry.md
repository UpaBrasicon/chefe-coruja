# Sentry — observabilidade mínima (Fase 0, item 11)

Projeto `chefe-coruja` no Sentry, **região UE** (dados na Alemanha), plano **Developer** (gratuito, **1 usuário** — convidar uma segunda pessoa exige o plano Team: avisar o responsável antes). Só *Error monitoring*; **Session replay desligado de propósito** (gravaria a tela com dado de paciente).

**Projeto travado contra dado pessoal** (Settings → Projects → chefe-coruja → Security & Privacy): *Prevent Storing of IP Addresses* **ligado**, *Data Scrubber* e *Use Default Scrubbers* ligados. (O evento de teste de instalação, enviado do computador do responsável, tinha gravado o IP de origem — daí a trava no projeto, além do `sendDefaultPii: false` no código.)

DSN (não é segredo; vai embutido no site): `https://c4ff5eec6cc7d1cf63df712d20dcf9ae@o4512212070301696.ingest.de.sentry.io/4512212075741264` — em `src/lib/sentry.ts` e `supabase/functions/_shared/sentry.ts`; o host está na CSP (`vercel.json` e `vite.config.ts`).

## O que vai ao Sentry — e o que nunca vai

| Vai | Nunca vai |
|---|---|
| Mensagem do erro **higienizada** (e-mail, CPF/CNS, ids, números longos viram `<email>`, `<doc>`, `<id>`, `<n>`) | Texto digitado, corpo de requisição, resposta do banco |
| Rota como **template** (`/prontuarios/:id`), sem query string | Nome de paciente ou de profissional, e-mail do usuário |
| Tags: `tipo`, `area` (`prescricao`, `autenticacao`, `rpc`, `edge`, `app`), `unidade` (id), `papel`, `request_id` | Breadcrumbs (cliques, console, URLs), replay, IP/usuário (`sendDefaultPii: false`) |
| Pilha (stack) do erro, higienizada | Mensagem do Postgres em erro de função (vai só o **código** SQLSTATE e a rota) |

**Como:** o SDK do Sentry roda **sem integrações padrão** — ele não coleta nada sozinho. O único caminho é `reportarErro` (`src/lib/reportarErro.ts`), que já higieniza e descarta recusa esperada (acesso negado, 2FA, convite, sessão) e ruído de navegador; só então chama `enviarAoSentry`. O `beforeSend` limpa de novo (request, user, breadcrumbs, contexts). Limite conhecido: nome próprio não é detectável por regra — por isso as mensagens de erro do código nunca incluem nome.

## O que é capturado

- **Frontend:** tela quebrada (`ErroBoundary`), erro JS e promessa rejeitada não tratados, falha de rede, **resposta 5xx** da API e **4xx cujo código do Postgres é defeito** (erro interno de função `SECURITY DEFINER`, coluna/função inexistente, deadlock — `src/lib/defeitoBanco.ts`; recusa de regra `P0001`/`42501`/JWT/duplicado fica fora).
- **Edge Functions** (`clinical-search`, `enviar-codigo-2fa`, `folha`): exceção não tratada (`comRelato` → 500 genérico ao cliente) e pontos conhecidos (biblioteca indisponível, Resend falhou ou sem chave, documento ilegível na folha).
- **Ambiente** pela base de dados do build: `producao`, `homolog`; no computador de desenvolvimento (`local`) fica desligado.

## Alerta de erro novo

Sentry → Alerts → Create alert → *Issues* → quando **"A new issue is created"** → enviar **e-mail** ao responsável (ambientes `producao` e `homolog`). É o alerta de **erro novo** (primeira ocorrência), não de volume.

## Teste (homologação)

1. Abrir `https://homolog.chefecoruja.com.br/?forcar-erro-sentry` (só fora da produção) → a tela de erro aparece.
2. No Sentry, em menos de 1 minuto: issue "Teste do Sentry: erro forçado no motor de prescrição (CPF `<doc>`, contato `<email>`, prescrição `<id>`)", `environment: homolog`, `area: prescricao` — **sem o CPF, o e-mail e o id originais**.
3. E-mail de "new issue" recebido.
