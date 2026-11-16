# Trilha de segurança, S2: entrada na conta — diagnóstico

**Pedido.** Em 15/11/2026, depois do S1, o RT escolheu o S2 ("S2 entrada na conta").

**Origem.** Auditoria Cloudflare, passadas 1 e 3: `docs/seguranca/auditoria-cloudflare-2026-11-15/`.

**Escopo.** Só diagnóstico, feito pelo código e pelas migrations. Nada muda antes das decisões.

## As três lacunas

### 1. O código de convite pode ser adivinhado pelo `aceitar_convite`

O convite é um código `CC-` com 5 caracteres de um alfabeto de 31, o que dá cerca de 28,6 milhões de valores (`20261003000001_convites_primeiro_acesso.sql:316-322`). Ele vale de 1 a 30 dias.

Há três portas para usar o código:

| Porta | Quem chama | Limite de tentativas |
|---|---|---|
| `conferir_convite` (tela de cadastro) | anônimo | Sim: 10 erros em 15 min por origem e disjuntor global de 120 em 5 min (`20261018000001_correcoes_pentest.sql:26-36`) |
| Cadastro novo (`signUp` com o código) | anônimo | Só o limite de cadastro do próprio Auth |
| `aceitar_convite` (quem já tem conta) | logado, antes do 2FA | **Nenhum** |

No `aceitar_convite`, um código errado gera um erro. Esse erro desfaz a transação inteira, então nada fica registrado e o disjuntor não conta essa tentativa. Quem tem uma conta qualquer pode testar códigos em série. Um acerto dá, na hora, um vínculo ativo com o papel do convite.

A chance de acerto por tentativa é pequena, porque há poucos convites válidos ao mesmo tempo. Mas não existe teto.

### 2. A adesão ao contrato vale antes de provar que o e-mail é da pessoa

O caminho do contrato confere o domínio do e-mail (por exemplo, só `@saocamilo.org.br`). Essa conferência é feita no gatilho que roda quando a conta é criada (`20261003000001...:534-541, 612`), antes de o e-mail ser confirmado. Quem digitar um e-mail do domínio, mesmo sem ser o dono dele, já fica com a adesão registrada.

O código do contrato é `CT-AAAA-NNN`, ou seja, mil valores por ano. Desde o S1, a entrada só se completa quando o admin conclui a adesão. Mesmo assim, ele vê na lista alguém que pode não ser o dono do e-mail.

O `config.toml` local tem a confirmação de e-mail desligada. A tela de cadastro tem a etapa "confirmar e-mail", e o README diz que ela é obrigatória. O valor da produção está no painel do Supabase, não no código.

### 3. Um link preparado pode logar a vítima na conta de outra pessoa

O cliente do Supabase usa o fluxo padrão (`src/lib/supabase.ts:209-212`): lê a sessão que vem no fragmento da URL (`#access_token=...`) em qualquer tela.

Funciona assim:
1. O atacante manda um link do sistema com os tokens da conta dele.
2. Quem abre o link entra na conta do atacante sem perceber.
3. Se essa pessoa aceitar um convite logo depois, o vínculo fica na conta do atacante.

A tela de convite para quem já está logado (`src/pages/Cadastro.tsx:42, 450`) não mostra em que conta o convite está sendo aceito.

## Decisões para o RT

**E1. Convite.**
- **A (recomendada):**
  - **Limite de tentativas:** `aceitar_convite` passa a conferir o código antes de aplicar. Usa o mesmo bloqueio do `conferir_convite` (por origem e global), mais um teto por conta: 10 erros por hora. Devolve o resultado sem erro, para a tentativa ficar registrada.
  - **Transição:** a tela usa a versão nova; a antiga é retirada depois, no padrão expand e contract.
  - **Códigos:** os convites novos passam a ter 8 caracteres, cerca de 850 bilhões de valores. Os de 5 que já existem valem até vencer.
- **B:** só o limite de tentativas, sem código mais longo.

**E2. Contrato.**
- **A (recomendada):**
  - `concluir_adesao` recusa quem não confirmou o e-mail;
  - a tela Pessoas mostra "e-mail não confirmado" e não deixa concluir;
  - os contratos novos passam a ter código mais longo (`CT-AAAA-` mais 6 caracteres);
  - os que já existem continuam valendo.
- **B:** mover a adesão para depois da confirmação do e-mail. É mais trabalho no gatilho de cadastro.

**E3. Sessão vinda da URL.**
- **A (recomendada):**
  - **Onde a sessão da URL vale:** o app só aceita sessão vinda do link nas telas de recuperação de senha e de retorno da confirmação de e-mail.
  - **Sessão já aberta:** se já houver sessão de outra pessoa na aba, recusa a troca e avisa.
  - **Tela de convite para quem está logado:** mostra "Você vai aceitar este convite como <e-mail>", com o botão "Não sou eu: sair".
- **B:** trocar para o fluxo PKCE. Fecha o mesmo caminho, mas o link de recuperação de senha passa a funcionar só no mesmo navegador que pediu, o que atrapalha quem pede no celular e abre no computador do posto.

**E4. Confirmação de e-mail na produção.**
- **A (recomendada):** você confere no painel do Supabase da produção, em Authentication → Sign In / Providers → Email → "Confirm email", e me diz se está ligado. Ligado, o E2 A fecha a lacuna. Desligado, a recomendação é ligar, já que o README diz que é obrigatório. Na mesma ida ao painel, vale olhar o hook "MFA verification attempt", que o T4 do S3 precisa ligado.
- **B:** deixar como está.

**Decisão do RT, 15/11/2026:** E1 a E4 = A ("Todas A"). Para o E4, falta o RT dizer o que viu no painel da produção (Confirm email e o hook MFA verification attempt).

## Riscos

- **Cadastro e aceite de convite:** são o primeiro contato da equipe com o sistema. Conferir na homologação os três caminhos (convite novo, convite com conta já existente e contrato) antes da produção.
- **Recuperação de senha e confirmação de e-mail:** com o E3 A, continuam funcionando em qualquer navegador. Conferir os dois links reais na homologação.
- **Códigos de 5 caracteres em uso:** valem até vencer (no máximo 30 dias), sem corte para ninguém.
- **Rollback:**
  - banco: as versões anteriores das funções, escritas na própria migration;
  - tela: voltar a versão anterior.

## Critérios de aceite

1. Uma conta que erra o código no `aceitar_convite` 10 vezes em uma hora fica bloqueada, e o disjuntor global conta essas tentativas.
2. Os convites novos saem com 8 caracteres; os de 5 que existem continuam aceitos até vencer.
3. `concluir_adesao` recusa a adesão de e-mail não confirmado.
4. Uma sessão no fragmento da URL fora das telas de recuperação e de confirmação é ignorada. Com sessão aberta de outra pessoa, a troca é recusada.
5. Testes de banco no CI cobrindo 1 a 3, e teste da regra de sessão no frontend.

## Depois

Com as decisões, abro a tarefa e começo pela migration na homologação.
