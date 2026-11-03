# Correção do bug médio M3 — conferência do pedido de passagem (30/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md`, item M3 (e parte do B12).
Ordem da sessão principal (RT fora): médios na ordem da seção 7.

## Diagnóstico

O pedido de passagem aceitava:
- destino com plantão sobreposto em **outro setor** (`private.tem_conflito_plantao` compara só o mesmo
  setor, data e faixa; a sobreposição real só aparecia na hora de aplicar);
- **pedido repetido** do mesmo plantão, com o primeiro ainda pendente;
- plantão que **já terminou**.

**Produção, só esquema (30/10/2026):** `solicitacoes_escala` sem gatilho de conferência na inserção;
`tem_conflito_plantao` só no mesmo setor/faixa. **O bug existe na produção.**

## Correção — migration `20270208000009_escala_passagem_conferencia.sql`

Gatilho `trg_passagem_conferir` (BEFORE INSERT, tipo `passar_plantao`), que vale para `passar_plantao`
e para a inserção direta:
- plantão já terminado: "O plantão já terminou; não dá para passá-lo.";
- outro pedido de passagem pendente do mesmo plantão: "Já existe um pedido de passagem pendente para
  este plantão. Cancele ou espere a resposta.";
- destino com horário sobreposto em qualquer setor (`private.conflito_escala`, a mesma regra da trava de
  sobreposição): "Conflito de horário: Fulano já está escalado(a) no setor … de … a …".

O plantão **em curso** continua podendo ser passado (quem sai no meio do plantão). Sem tela (o erro
aparece nas janelas que já mostram o erro da RPC). Idempotente; rollback no cabeçalho, **testado**.

## Testes

| Teste | Resultado |
|---|---|
| `supabase/tests/escala_passagem_conferencia.sql` sem a migration | **falha**: `M3: o destino escalado na Sala Vermelha no mesmo horário não recebe a passagem — passou sem erro` |
| Com a migration | **4 de 4** |
| `escala_pedidos_categorias`, `escala_categoria`, `fase0_rpcs` com a migration | passam |

## Homologação

Aplicada pelo SQL em 30/10/2026, versão `20270208000009` registrada. Como as contas E2E, em transação
desfeita: 005 escalado na Sala Vermelha em 04/11 manhã; 004 tenta passar o PS de 04/11 manhã para 005 →
"Conflito de horário: Plantonista Dois E2E já está escalado(a) no setor Sala Vermelha (UPA E2E 24h) de
07:00 de 04/11 a 13:00 de 04/11."; 004 passa o PS de 05/11 tarde → pedido criado; pede de novo o mesmo
→ "Já existe um pedido de passagem pendente para este plantão."

## Produção

Migration `20270208000009` aplicada na produção (`saqjrjtrkzkswsxxvdxn`) em 30/10/2026, com o "ok produção" do RT, pela sessão principal; versão registrada e conferida (gatilhos e grants: RPCs com execute para `authenticated`, não para `anon`). PR #360 mesclado em 30/10/2026, com o arquivo da migration idêntico ao aplicado. Concluído.
