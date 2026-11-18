# Registros de acesso à aplicação (LG9)

Marco Civil da Internet, art. 15, e Decreto 8.771/2016, art. 13. Decisões R1–R3 = A do RT em 18/11/2026 (`docs/regulatorio/LG9-REGISTROS-ACESSO-DIAGNOSTICO.md`). Migration `20270418000093_lg9_registros_acesso.sql`.

## O que cobre

- **Fonte:** o log de auditoria do Auth no banco (`auth.audit_log_entries`). O Auth grava usuário, ação, data, hora e IP:
  - em cada entrada;
  - em cada renovação da sessão (cerca de 1 vez por hora com o app aberto);
  - em cada saída e troca de senha.
  O app não consegue pular esse registro.
- **Prazo:** 6 meses. O job `lg9-registros-acesso-6-meses` roda às 06:45 UTC (03:45 de Brasília) e chama `private.apagar_registros_acesso_vencidos(6)`.
  - Apaga o que tem mais de 6 meses e anota a quantidade em `log_auditoria`.
  - O prazo nunca fica abaixo de 6 meses, mesmo se a função for chamada com menos.
  - Não apaga o registro de usuário com guarda vigente.
- **Guarda pedida pela autoridade** (art. 15, § 2º): `public.anotar_guarda_registros_acesso(usuario, ate, pedido)`. Só o super admin chama, com o segundo fator. A anotação fica em `private.guardas_registros_acesso` e na auditoria.
- **Entrega por ordem judicial** (art. 15, § 3º): `public.extrair_registros_acesso(usuario, de, ate, ordem)`. Só o super admin chama, com o segundo fator. Devolve data, hora, ação e IP do período. A auditoria guarda quem extraiu, de quem, o número da ordem e quantas linhas saíram, o que serve de inventário de acesso do decreto (art. 13, III).

## O que não cobre

- **Porta lógica de origem:** o gateway do Supabase não a repassa. É a pergunta 2 ao advogado.
- **WhatsApp (Hermes):** chega pela Meta, sem IP. Fica o telefone, a data e a hora em `hermes_audit_log`. É a pergunta 3 ao advogado.
- **Logs do painel do Supabase:** guardam por 7 dias no plano Pro e continuam como estão.
- **Antes de religar:** o registro anterior à mudança no painel não existe e não volta.

## Chaves envolvidas

Nenhuma chave nova. A gravação depende de uma opção no painel do Supabase de cada projeto: Authentication → Audit Logs → "Disable writing auth audit logs to project database", que precisa ficar **desligada**.

## Como ligar (o RT, primeiro na homologação)

1. No painel do projeto, abrir Authentication → Audit Logs e desligar "Disable writing auth audit logs to project database".
2. Entrar no app e sair.
3. Conferir que apareceram as linhas de entrada e de saída, com o IP real. Comparar com o `cf-connecting-ip` (S6):

   ```sql
   SELECT created_at, payload ->> 'action', ip_address <> '' AS tem_ip
     FROM auth.audit_log_entries ORDER BY created_at DESC LIMIT 5;
   ```

## Roteiro: pedido de guarda ou ordem judicial

1. **Quem recebe:** o encarregado (LG2), que avisa o RT no mesmo dia. Ninguém mais é avisado, nem o cliente nem o usuário: o pedido de guarda é sigiloso (art. 13, § 4º, aplicado pelo art. 15, § 2º). A ordem judicial diz se pode ser comunicada.
2. **Pedido de guarda** (polícia, autoridade administrativa ou Ministério Público, sem ordem judicial):
   - não entregar nada;
   - anotar a guarda com o número do ofício e a data final pedida (`anotar_guarda_registros_acesso`);
   - responder por escrito que a guarda foi feita.
   - A autoridade tem 60 dias para pedir a autorização judicial (art. 13, § 3º). Se não pedir, ou se o juiz negar, o pedido de guarda perde o efeito. Anote a guarda com uma data final de até 60 dias, e anote de novo só quando chegar a ordem.
3. **Ordem judicial:**
   - conferir que a ordem é autêntica e diz o usuário e o período;
   - extrair com `extrair_registros_acesso`, informando o número do processo;
   - entregar só o que a ordem pede, por meio seguro;
   - guardar a cópia da ordem com o registro de incidentes (LG5).
4. **Prazo de resposta:** o da ordem. Sem prazo escrito, responder em até 5 dias úteis.
5. **Nunca** entregar registro de acesso sem ordem judicial, nem para o cliente. O cliente vê o registro de acesso ao prontuário pela Auditoria do gestor, que é outra coisa.

## Como reverter

- **Parar a gravação:** ligar de novo a opção no painel.
- **Tirar a rotina, as funções e a tabela:** `docs/regulatorio/LG9-ROLLBACK-20270418000093.sql`, testado na homologação em 18/11/2026. Antes de rodar, conferir se há guarda vigente.
