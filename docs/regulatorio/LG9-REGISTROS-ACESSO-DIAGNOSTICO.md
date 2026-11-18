# LG9: guarda dos registros de acesso à aplicação por 6 meses (diagnóstico, 18/11/2026)

Trilha de obrigatórios legais e regulatórios, item LG9 (P2). **Decisão do RT, 18/11/2026: "Todas A"** (R1–R3). Este documento não muda código nem banco e não é parecer jurídico.

**Base:**
- Lei 12.965/2014 (Marco Civil da Internet):
  - art. 5º, VIII: registro de acesso a aplicação é a data e a hora de uso da aplicação a partir de um endereço IP;
  - art. 15: o provedor de aplicação com fins econômicos guarda esses registros por 6 meses, sob sigilo, em ambiente controlado e seguro;
  - art. 15, §§ 1º a 3º: a autoridade pode pedir guarda por mais tempo, e a entrega só acontece com ordem judicial;
  - art. 16: é proibido guardar dado pessoal além do necessário.
- Decreto 8.771/2016, art. 13:
  - acesso restrito aos registros, com autenticação dupla de quem os acessa;
  - inventário de quem acessou os registros e quando;
  - guarda da menor quantidade possível de dado pessoal, apagado assim que o prazo legal termina (§ 2º).

## Como está hoje

Conferido na produção e na homologação em 18/11/2026, só por contagem, sem ler dado de pessoa.

| Onde | Guarda data, hora e IP? | Por quanto tempo |
|---|---|---|
| Log de auditoria do Auth no banco (`auth.audit_log_entries`): entrada, renovação de sessão, saída, troca de senha | teria data, hora, usuário e IP | **vazio** nas duas bases (0 linhas), embora a produção tenha sessões desde 07/10/2026. Sinal de que a opção "Disable writing auth audit logs to project database" está ligada no painel; você confere |
| Logs do painel do Supabase (Auth e API Gateway) | sim | **7 dias** no plano Pro (página de preços do Supabase, 18/11/2026) |
| `auth.sessions` | IP da sessão aberta | só enquanto a sessão existe; some quando a pessoa sai |
| `log_acesso_prontuario` (impressão, histórico encerrado, pedidos de acesso etc.) | sim, IP pelo `private.requisicao_ip()` | 20 anos (LG4) |
| `api_acessos` (chamadas da API de integração) | sim | 20 anos (LG4) |
| `log_auditoria` | data, hora e autor, sem IP | 20 anos (LG4) |
| Vercel (frontend) | entrega de arquivo estático, sem login | horas; não é uso identificado da aplicação |
| Hermes (WhatsApp) | telefone, data e hora; o IP fica com a Meta | `hermes_audit_log` |

**Resultado:** a obrigação do art. 15 **não está cumprida**. A entrada no sistema e o uso depois dela só ficam com IP nos logs do painel, por 7 dias. Os registros de acesso ao prontuário têm IP, mas só para algumas ações, e não substituem o registro de uso da aplicação.

Uma ressalva: o inventário (LG4) diz que a guarda de 20 anos da auditoria "cobre os 6 meses do Marco Civil". Isso vale para a auditoria do prontuário, mas não para a entrada no sistema, que hoje não é guardada.

## Decisões para o RT

**R1. De onde vem o registro**
- **A (recomendada):** religar a gravação do log de auditoria do Auth no banco.
  - Você desliga a opção "Disable writing auth audit logs to project database" no painel (Authentication → Audit Logs), primeiro na homologação.
  - O Auth grava data, hora, usuário, ação e IP em cada entrada, renovação de sessão (cerca de 1 vez por hora enquanto o app está aberto), saída e troca de senha. É do servidor: o app não consegue pular.
  - Antes da produção, confiro na homologação que o IP gravado é o real, comparando com o `cf-connecting-ip` (a mesma conferência da S6).
- **B:** mandar os logs do painel para um armazenamento externo (Log Drain). Custa US$ 60 por mês por projeto, mais o armazenamento, e precisa de outro lugar seguro para guardar.
- **C:** tabela própria, preenchida pelo app ao entrar. O app teria de chamar a função, então um cliente alterado não deixaria registro.

**R2. Prazo**
- **A (recomendada):** 6 meses. Uma rotina diária (pg_cron) apaga o que passou do prazo e anota quantas linhas apagou. É o que o Decreto 8.771, art. 13, § 2º, pede: apagar assim que o prazo legal termina.
- **B:** 1 ano, com folga.
- **C:** não apagar.

**R3. Pedido da autoridade e ordem judicial**
- **A (recomendada):** uma tabela de guarda e uma função de entrega.
  - A tabela de guarda tem usuário, data final, número do pedido e quem anotou. A rotina não apaga o que estiver nela (art. 15, § 2º).
  - A função de entrega é só do super admin, com o segundo fator. Recebe o usuário, o período e o número da ordem judicial, devolve data, hora, ação e IP, e grava na auditoria quem extraiu, de quem e por qual ordem. Isso é o inventário de acesso do decreto.
  - Um roteiro curto diz quem recebe o pedido, como responder e o prazo.
- **B:** só o roteiro. A entrega seria feita por SQL manual, sem registro automático.

## Perguntas para o advogado (vão com o pacote do LG1–LG5)

1. **Quem é o provedor de aplicação:** a Chefe Coruja, que oferece o sistema, ou o hospital que o contrata? Para a LGPD a Chefe Coruja é operadora; para o Marco Civil, a guarda parece ser de quem oferece a aplicação. A resposta muda o contrato (LG1).
2. **Porta lógica de origem:** há decisões do STJ que pedem ao provedor de aplicação a porta de origem, além do IP. O gateway do Supabase não repassa a porta, então hoje não há como guardá-la. É preciso buscar outro caminho?
3. **Uso pelo WhatsApp (Hermes):** a conversa chega pela Meta, sem IP. O registro de telefone, data e hora basta?

## Plano depois das decisões (com R1–R3 = A)

1. **Painel:** você desliga a opção na homologação, e eu confiro a entrada, a renovação e o IP.
2. **Banco** (migration expand, idempotente, com rollback):
   - `private.guardas_registros_acesso`;
   - `private.apagar_registros_acesso_vencidos()` e o job `lg9-registros-acesso-6-meses` às 06:45;
   - `public.extrair_registros_acesso(usuario, de, ate, ordem)`, só para o super admin, com o segundo fator e registro em `log_auditoria`;
   - teste em `supabase/tests/lg9_registros_acesso.sql`.
3. **Documentos:**
   - `infra/registros-acesso-lg9.md`: o que cobre, o que não cobre e como reverter;
   - o roteiro de pedido judicial;
   - LG4 corrigido, com o registro de acesso à aplicação e o prazo de 6 meses.
4. CI, homologação e o seu "ok produção". Na produção, você desliga a mesma opção no painel.

**Risco:** o tamanho é pequeno. Com cerca de 1 renovação por hora por pessoa com o app aberto, uma unidade com 30 pessoas gera perto de 20 mil linhas por mês. A rotina mantém só os últimos 6 meses.
