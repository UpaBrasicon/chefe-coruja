# Trilha de segurança, S11: painel do Auth e avisos do Supabase — diagnóstico

**Pedido.** Em 16/11/2026 o RT pediu para fechar o S11 ("vamos finalizar o s11"). O item nasceu de duas leituras de 15 e 16/11:
- os prints do painel do Auth da produção, enviados pelo RT;
- os avisos de segurança do Supabase (`get_advisors`), lidos pelo plugin com a autorização do RT.

**Escopo.** Só diagnóstico. Leitura da produção (`saqjrjtrkzkswsxxvdxn`) pelo plugin e do código no repositório. Nada foi alterado.

## Correção do que eu disse em 16/11

Quando o RT mandou o print dos Auth Hooks vazio, eu disse que "o código não depende dele". **Estava errado.**

- A função `public.hook_segundo_fator_tentativa` existe na produção. As migrations `20261003000005` e `20270414000054` (S3, T4) a criaram para ser o hook **MFA verification attempt**.
- O hook só funciona se for **ligado no painel** do Auth. No `supabase/config.toml` (ambiente local e CI) ele está ligado, e por isso os testes passaram.
- Na produção, o painel não tem nenhum hook.

O que o hook faz e hoje **não vale** na produção:
1. **T4 do S3:**
   - o primeiro cadastro de um aplicativo autenticador (TOTP) exige o código por e-mail dos últimos 15 minutos;
   - sem o hook, quem tem só a senha cadastra o próprio aplicativo, vira `aal2` e passa pelo segundo fator sem ver o e-mail;
   - é o achado da passada 1 da auditoria, e o S3 só fecha com o hook ligado.
2. **Bloqueio por erros:** depois de várias tentativas erradas de código, o hook bloqueia. Sem o hook, não há esse bloqueio no Auth.

`exigir_segundo_fator` está `true` na produção, então a lacuna vale hoje.

## Outros achados

### Painel do Auth (prints do RT)

| Opção | Hoje | Leitura |
|---|---|---|
| Confirm email | ligado | certo (E4 do S2) |
| Prevent use of leaked passwords | **desligado** | o plano é Pro, então a opção está disponível |
| Enable magic links and email OTP | **ligado** (8 dígitos, 1 h) | o app não usa: nenhum `signInWithOtp` no código. Ligado, permite entrar só com o código do e-mail, e aí senha e segundo fator dependem da mesma caixa de entrada |
| Require current password when updating | desligado | a única troca de senha do app é pela recuperação (`RecuperarSenha.tsx`, `updateUser`); "Secure password change" já está ligado |
| Allow new users to sign up | ligado | precisa ficar: o cadastro por convite usa `signUp` |

### Avisos do Supabase (`get_advisors`, produção)

| Aviso | Quantos | Leitura |
|---|---|---|
| `security_definer_view` (ERROR) | 2 | **Falso alarme**, intencional e documentado. `vw_censo_unidade` e `vw_indicadores_unidade` leem de `private.fn_censo_unidade()` e `fn_indicadores_unidade()`, que filtram por unidade e papel do usuário e suprimem contagens de 1 a 4 (comentário na migration `20260823000002`). Desde o S3 também exigem o segundo fator. Também corrijo o que disse em 16/11: as views **não** mostram as unidades de outras redes. O hook `useCenso` do app não é usado em nenhuma tela. |
| `rls_disabled_in_public` (ERROR) | 2 | `terminologia.ciap2` e `terminologia.sigtap_procedimento_cid` sem RLS. Quem está logado só tem SELECT, e o conteúdo é tabela pública do Ministério. Risco baixo; ligar RLS com leitura liberada tira o aviso sem mudar nada. |
| `function_search_path_mutable` (WARN) | 16 | Funções auxiliares sem `search_path` fixo (`private.set_updated_at`, `private.so_digitos`, `terminologia.buscar`…). |
| `extension_in_public` (WARN) | 1 | `pg_net` no schema `public`. A extensão não pode ser movida (`ALTER EXTENSION … SET SCHEMA` não vale para ela), e as funções dela ficam no schema `net`. Fica como está. |
| `anon_security_definer_function_executable` (WARN) | 8 | Todas são entradas públicas de propósito: `conferir_convite`, `conferir_contrato`, `pedir_novo_convite`, `painel_chamadas` (TV), `abrir_pacote_alta` e `situacao_pacote_alta` (por token), `registrar_erro_cliente` e `portao_requisicao` (o hook do PostgREST). |
| `authenticated_security_definer_function_executable` (WARN) | 713 | É o desenho do app: tudo por RPC, com a regra dentro da função. |
| `rls_enabled_no_policy` (INFO) | 74 | Falha fechada de propósito (só `service_role`), documentado na `20260823000002`. |
| `auth_leaked_password_protection` (WARN) | 1 | O mesmo da tabela do painel. |

## Decisões para o RT

**F1. Ligar o hook do segundo fator (urgente).**
- **A (recomendada):** você liga no painel, primeiro na homologação e depois na produção.
  - Caminho: Authentication → Auth Hooks → Add hook → "MFA verification attempt" → Postgres → schema `public`, função `hook_segundo_fator_tentativa`.
  - Eu confiro pelos prints e registro.
- **B:** eu ligo pela API de gestão do Supabase, com o seu ok.

**F2. Senhas vazadas.**
- **A (recomendada):** ligar "Prevent use of leaked passwords" na produção e na homologação. Vale só para cadastro e troca de senha novos; quem já tem senha não é afetado.
- **B:** deixar desligado.

**F3. Magic link e código por e-mail para entrar.**
- **A (recomendada):** desligar, primeiro na homologação.
  - Antes de levar à produção, você faz uma recuperação de senha na homologação para confirmar que o link de recuperação continua chegando e funcionando.
  - O app não usa entrada por código.
- **B:** deixar ligado.

**F4. Senha atual na troca.**
- **A (recomendada):** deixar desligado. A troca só existe pela recuperação, onde a pessoa não sabe a senha antiga, e ligar quebraria o fluxo.
- **B:** ligar e mudar a tela.

**F5. Funções sem `search_path`.**
- **A (recomendada):** uma migration fixa o `search_path` nas 16 funções, qualificando os nomes onde for preciso, com teste e na homologação primeiro.
- **B:** deixar.

**F6. Tabelas de terminologia.**
- **A (recomendada):** ligar RLS com política de leitura para quem está logado. O comportamento não muda, e o aviso some.
- **B:** deixar.

**F7. Avisos intencionais.**
- **A (recomendada):** registrar no BACKLOG como intencionais, cada um com o motivo da tabela acima:
  - as views;
  - as 8 funções públicas;
  - as 713 RPCs;
  - as 74 tabelas sem política;
  - o `pg_net`.

  Assim a próxima leitura dos avisos não os confunde com falha. Junto, tirar o hook `useCenso`, que não é usado.
- **B:** só registrar.

## Riscos

- **F1:**
  - com o hook ligado, quem errar o código muitas vezes fica bloqueado por um tempo, o que é o comportamento esperado;
  - se a função tiver erro, o Auth recusa a verificação do código;
  - a função já roda nos testes do CI com o hook ligado.
- **F3:** se a recuperação de senha depender da opção, a homologação mostra antes da produção.
- **F5:** função com nome sem schema quebra com `search_path` vazio. O teste e a homologação mostram antes.
- **Rollback:**
  - painel: desligar a opção;
  - banco: migration com a volta escrita.

## Critérios de aceite

1. Print do Auth Hooks com o "MFA verification attempt" ligado na homologação e na produção.
2. Print das opções F2 e F3 na homologação e na produção; recuperação de senha testada na homologação depois do F3.
3. `get_advisors` sem os avisos de `search_path` e de terminologia.
4. BACKLOG com a lista dos avisos intencionais.
5. CI verde.
