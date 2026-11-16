# S12 — login por PKCE (diagnóstico, 16/11/2026)

Trilha de segurança, item S12 (P3). Ele nasceu da decisão F6 = A do S0 (`docs/seguranca/S0-FATOS-4-6.md`, fato 6) e fecha de vez o achado 5 da auditoria: o login cruzado por link preparado.

## Como é hoje

- O app usa o fluxo **implícito** (padrão do supabase-js 2). O link do e-mail volta com a sessão no fragmento, `#access_token=…&refresh_token=…`.
- `detectSessionInUrl: false` (S2, E3): `aceitarSessaoDoLink` (`src/lib/supabase.ts` e `src/lib/sessaoDoLink.ts`) lê o fragmento à mão, só em `/login` e `/recuperar-senha`, e recusa a troca se já houver sessão de outra pessoa.
- Os e-mails do Auth que levam link são estes:

  | Fluxo | Onde nasce | Volta para |
  |---|---|---|
  | Recuperação de senha | `RecuperarSenha.tsx`, `resetPasswordForEmail` | `/recuperar-senha` |
  | Confirmação de cadastro | `Cadastro.tsx` (`emailRedirectTo: /login`) e `AuthContext.signUp`, sem redirect | `/login` e o Site URL |
  | Troca de e-mail, convite do Auth, link de acesso | modelos existem em `supabase/templates/`, mas o app não chama esses fluxos | — |

  O convite do app é por código próprio, não pelo convite do Auth.
- Os modelos usam `{{ .ConfirmationURL }}`, que já funciona com PKCE: o Supabase troca o fragmento por `?code=…`. Não é preciso mexer no texto dos e-mails para o link funcionar.

## O que sobra de risco

Uma pessoa **sem sessão aberta** que abre, em `/login` ou `/recuperar-senha`, um link preparado com os tokens de outra conta entra nessa conta. Com PKCE, o link traz um código que só vira sessão no navegador que fez o pedido, porque o navegador guarda a outra metade do segredo. Um link preparado em outro navegador não abre sessão.

## O custo do PKCE

- **O link só funciona no mesmo navegador que fez o pedido.** Quem pede a recuperação no computador e abre o e-mail no celular não consegue trocar a senha por aquele link. Precisa abrir no computador, ou pedir de novo no celular. No plantão isso acontece: o e-mail costuma ser lido no celular.
- **Confirmação de cadastro:** se aberta em outro aparelho, a confirmação do e-mail vale do mesmo jeito, porque o Supabase confirma antes de redirecionar. A pessoa só não entra sozinha: precisa digitar e-mail e senha.

## Decisões para o RT

**K1. Fluxo**
- **A:** PKCE (`flowType: 'pkce'`).
  - `/login` e `/recuperar-senha` trocam o `?code=` por sessão com `exchangeCodeForSession`, tiram o código da barra de endereço e mantêm a regra do S2 (recusa se houver sessão de outra pessoa).
  - Quando o link é aberto em outro navegador, a tela explica e oferece pedir de novo ali mesmo.
- **B:** manter o fluxo implícito, com a proteção do S2, e fechar o S12 aceitando o risco.

**K2. Recuperação aberta em outro aparelho (só se K1 = A)**
- **A (recomendada):**
  - a tela de recuperação mostra "Abra o link no mesmo aparelho em que pediu, ou peça um link novo aqui", com o campo de e-mail já na tela;
  - o e-mail de recuperação ganha uma linha: "abra este link no mesmo aparelho em que você pediu".
- **B:** a recuperação usa `token_hash` (`verifyOtp`), que funciona em qualquer aparelho. Só que volta a aceitar o link preparado, justamente o que o S12 quer fechar.

**K3. Transição (só se K1 = A)**
- **A (recomendada):**
  - no deploy, o app aceita os dois formatos: `?code=` novo e `#access_token` antigo, com as regras do S2;
  - um dia depois, um PR pequeno tira o leitor do fragmento. Os links do formato antigo valem 1 hora.
- **B:** trocar de uma vez. Quem tiver um link antigo aberto naquela hora pede outro.

**K4. Testes**
- **A (recomendada):**
  - testes de unidade da decisão (código × fragmento × sessão de outra pessoa);
  - na homologação, que agora manda e-mail de novo (#814), os dois caminhos: recuperação no mesmo navegador e em outro, e confirmação de cadastro.
- **B:** só os testes de unidade.

## Minha recomendação

Esta é a única decisão da trilha em que a recomendação não é óbvia.

O risco que o PKCE fecha é baixo: precisa de alguém sem sessão aberta, que não perceba que entrou na conta de outra pessoa e que faça algo que beneficie o dono dela. O custo, por outro lado, aparece todo dia: a recuperação aberta no celular, depois de pedida no computador, deixa de funcionar.

Por isso recomendo **K1 = B**: fechar o S12 aceitando o risco, com a proteção do S2. O S12 volta se o app passar a ter fluxos de link mais sensíveis (convite do Auth, troca de e-mail).

Se o RT preferir fechar o risco mesmo assim: **K1 = A**, com K2, K3 e K4 = A.
