# Trilha de segurança, S3: segundo fator uniforme — diagnóstico

**Pedido.** Em 15/11/2026, o RT escolheu o S3 da trilha de segurança ("S3 segurança"). A trilha nasceu da auditoria Cloudflare (`docs/seguranca/auditoria-cloudflare-2026-11-15/`).

**Por que agora.** O segundo fator está ligado na produção desde 02/10/2026 (`exigir_segundo_fator` = `true`, lido em 15/11/2026 com autorização do RT). Então as lacunas abaixo estão abertas na produção hoje.

**Escopo.** Só diagnóstico. Nada muda antes das decisões.

## Como o 2FA funciona hoje

- **Escritas e RPCs:** passam por `public.portao_requisicao`, o hook `db_pre_request` do PostgREST (`20261023000001_segundo_fator_servidor.sql:111-143`). Sem o segundo fator, ele recusa toda escrita e toda RPC fora da lista de exceções.
- **Leituras de tabela (GET):** o portão deixa passar e confia na RLS. Cada tabela de paciente precisa de uma política RESTRICTIVE `<tabela>_segundo_fator USING (private.segundo_fator_ok())`. Hoje 66 tabelas têm essa política.
- **Funções de borda (Edge Functions):** não passam pelo portão, porque ele é do PostgREST.
- **Fator TOTP:** conta como segundo fator se o JWT tiver `aal2` e uma verificação TOTP de menos de 24 horas (`private.segundo_fator_valido`).

## As lacunas (conferidas na homologação em 15/11/2026, só a estrutura, sem dado de paciente)

### 1. Tabelas com dado de paciente legíveis sem o segundo fator

Uma sessão só com senha consegue ler, por GET direto na tabela, as linhas que a própria RLS já lhe permite ver (a isolação entre unidades continua valendo):

| Grupo | Tabelas |
|---|---|
| Clínico | `teleinterconsultas` (pergunta e resposta em texto livre), `pedidos_acesso_prontuario`, `reentradas_contingencia`, `classificacoes_fugulin`, `classificacoes_dini`, `duplas_checagens`, `eventos_leito`, `chamadas`, `assinaturas`, `destinacoes_prontuario` |
| Farmácia | `dispensacoes`, `dispensacao_devolucoes`, `movimentos_estoque` |
| Faturamento | `contas`, `conta_eventos`, `conta_lancamentos`, `conta_versoes_erp` |
| Outros | `impressoes_pulseira` |
| Sem coluna de paciente, mas com conteúdo clínico | `chat_mensagens` (também pelo Realtime) |

Já estão protegidas de forma indireta, porque a política delas consulta uma tabela que tem o 2FA: `prescricao_itens`, `links_publicos_receita`, `notificacoes_whatsapp`, `receitas_retidas` (por `prescricoes`) e `pacientes_identidade_provisoria` (por `pacientes`). `admissao_fichas` não tem política de leitura.

### 2. Views com SECURITY DEFINER

`vw_censo_unidade` e `vw_indicadores_unidade` são SECURITY DEFINER de propósito: mostram contagens ao gestor sem dar acesso ao paciente. Por isso a RLS das tabelas de origem não vale para elas, e elas podem ser lidas antes do 2FA.

### 3. A função de borda `clinical-search`

Ela confere só o login (`auth.getUser()`) e passa a usar a chave de serviço (`supabase/functions/clinical-search/index.ts:86-110`). Com uma sessão só de senha:
- usa o "Pergunte à IA";
- lê a lista de nomes da unidade para a pseudonimização;
- no modo de pergunta, a resposta 422 indica se um nome digitado é de paciente ou de profissional da unidade.

Nenhuma outra função de borda tem o mesmo problema:
- `enviar-codigo-2fa` precisa funcionar antes do 2FA;
- `folha` repassa o JWT do usuário, então o portão vale para ela;
- `api`, `webhooks` e `pedir-demonstracao` não usam sessão de usuário.

### 4. Cadastro do TOTP com sessão só de senha

O Supabase permite cadastrar e verificar o primeiro fator TOTP com uma sessão `aal1`, só com a senha. Ao verificar, a sessão vira `aal2` com TOTP e passa no portão sem nunca receber o código por e-mail. Quem tem só a senha de um profissional cadastra o próprio TOTP e entra.

O hook `hook_segundo_fator_tentativa` só conta erros; não olha se é o primeiro cadastro.

## Decisões para o RT

**T1. Tabelas e chat.**
- **A (recomendada):** política RESTRICTIVE `segundo_fator_ok()` nas 18 tabelas e no `chat_mensagens`, no padrão das outras 66. Junto vem um teste de banco no CI que falha quando uma tabela legível pelo `authenticated` com coluna de paciente fica sem a política, com uma lista de exceções justificadas.
- **B:** só as 18 tabelas, sem o teste.

**T2. Views.**
- **A (recomendada):** acrescentar `WHERE private.segundo_fator_ok()` às duas views. As contagens continuam iguais para quem passou pelo 2FA.
- **B:** trocar por funções RPC (mais trabalho, mesma proteção).

**T3. `clinical-search`.**
- **A (recomendada):** antes de usar a chave de serviço, chamar `segundo_fator_status` com o JWT do usuário e responder 403 quando o 2FA for exigido e não estiver válido. A tela mostra "Confirme o segundo fator".
- **B:** ler `aal` e `amr` direto do JWT na função (duplica a regra do banco).

**T4. Cadastro do TOTP.**
- **A (recomendada):** no hook de verificação, quando o fator ainda não foi verificado (é o primeiro cadastro), exigir que a pessoa tenha passado pelo código por e-mail nos últimos 15 minutos. Senão, recusa com "Confirme o código por e-mail antes de cadastrar o aplicativo".
- **B:** desligar o TOTP e manter só o código por e-mail.
- **C:** deixar como está e registrar como risco aceito.

**T5. Ordem e produção.**
- **A (recomendada):** uma migration expand por item (T1, T2 e T4), testada na homologação com o teste de banco. A mudança de T3 na função de borda vem junto. Tudo num PR só, e a produção só com o seu ok depois da conferência na homologação. Antes de subir, conferir na homologação que nenhuma tela lê essas tabelas antes do 2FA (login, tela do código, cadastro).
- **B:** um PR por item.

**Decisão do RT, 15/11/2026:** T1 a T5 = A ("Todas A").

## Riscos

- **Tela que leia uma dessas tabelas antes do 2FA:** ela passa a vir vazia. Mitigação: conferência na homologação com conta sem 2FA válido (QA com JWT simulado em transação desfeita).
- **Hermes e jobs:** usam os papéis `hermes_*` e `service_role`. As políticas novas valem só para `authenticated`, então não são afetados.
- **Realtime do chat:** passa a exigir o 2FA, que é o esperado.
- **Rollback:** `DROP POLICY` das políticas novas e a definição anterior das views, escritos na própria migration.

## Critérios de aceite

1. O teste de banco novo passa, e falha se a política for retirada de qualquer uma das tabelas.
2. Na homologação, uma sessão `aal1` sem o código por e-mail:
   - recebe zero linhas nas 18 tabelas e nas duas views;
   - recebe 403 do `clinical-search`;
   - tem o primeiro cadastro de TOTP recusado.
3. Uma sessão com o 2FA válido continua vendo o mesmo de antes.

## Depois

Com as decisões, abro a tarefa no formato do plano de trabalho e começo pela migration na homologação.
