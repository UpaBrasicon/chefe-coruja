# Correção do bug alto A5 — atestado na justificativa de falta (29/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md`, item A5.
Autorização: RT, "Sim, A1 a A5", repassado pela sessão principal.

## Diagnóstico

1. **Upload barrado fora do médico.** A E4 levou a justificativa de falta com anexo para todos os
   papéis, mas a política `atendimento_upload` do bucket `atendimento` só aceita quem é gestor ou
   plantonista na unidade (`private.unidades_gestor_plantonista`). Enfermeira, técnico e os outros:
   `new row violates row-level security policy for table "objects"`.
2. **Link quebrado para todos.** O bucket é privado, mas a tela gravava `getPublicUrl(...)` em
   `anexo_url`; o "ver anexo" do gestor não abria.
3. **Achado junto:** a política ampla `atendimento_read` deixava qualquer plantonista da unidade ler
   o atestado de qualquer colega (dado de saúde do profissional).

**Produção, só esquema (29/10/2026):** `atendimento_upload` e `atendimento_read` limitados a
gestor/plantonista; bucket `atendimento` com `public = false`. **O bug existe na produção.**

## Banco — migration `20270208000004_escala_atestado_falta.sql`

Só acrescenta (nada do que já vale sai):

- `atendimento_justificativa_upload` (INSERT): quem tem vínculo ativo na unidade grava em
  `<unidade>/justificativas/<arquivo>`; fora dessa pasta, nada muda.
- `atendimento_justificativa_read` (SELECT): quem enviou (`owner_id`) e o gestor da unidade leem.
- `atendimento_justificativa_sigilo` (SELECT, restritiva, no padrão da `atendimento_prontuario_sigilo`):
  nas justificativas, só quem enviou, o gestor da unidade e o super admin leem.
- Funções de apoio `private.justificativa_da_minha_unidade` e `private.justificativa_que_posso_ler`.

Idempotente; rollback no cabeçalho (testado: devolve as mesmas políticas e nenhuma função nova).

## Tela

- `src/lib/anexoJustificativa.ts` (+ teste): `anexo_url` passa a guardar o **caminho** do arquivo;
  os pedidos antigos, com a URL pública, continuam abrindo (o caminho sai da URL).
- `PedidosEscala.tsx` (outros papéis) e `Escala.tsx` (plantonista): gravam o caminho.
- Aba Pedidos do gestor: "ver anexo" abre com **URL assinada** de 2 minutos; erro aparece no alto da lista.

Ordem segura: a migration só abre permissões; a tela de hoje continua igual até o merge.

## Testes

| Teste | Resultado |
|---|---|
| `supabase/tests/escala_atestado_falta.sql` sem a migration | **falha**: a enfermeira bate em `new row violates row-level security policy` |
| Com a migration | **8 de 8** |
| `escala_pedidos_categorias`, `escala_da_unidade`, `fase0_rpcs`, `porte_correcoes_pentest` com a migration (homologação) | passam |
| `src/lib/anexoJustificativa.test.ts` | 4 de 4 |
| `tsc`, `eslint` | limpos |

## Homologação

Migration aplicada pelo SQL em 29/10/2026, versão `20270208000004` registrada. Como as contas E2E,
em transação desfeita (como o Storage grava: dono = quem está logado):

| Passo | Resultado |
|---|---|
| Enfermeira 002 envia atestado em `<UPA E2E>/justificativas/` | OK (antes: barrada) |
| Técnico 003 envia atestado | OK |
| Recepção 001 grava fora das justificativas | barrado (como antes) |
| Plantonista 004 e técnico 003 leem o atestado da enfermeira | 0 (antes: o plantonista lia) |
| Enfermeira lê o próprio | 1 |
| Gestora 009 lê os atestados | 2 |

A tela da homologação fica atrás do login do Vercel; a URL assinada não foi aberta no navegador.

## Produção

Migration `20270208000004` aplicada na produção (`saqjrjtrkzkswsxxvdxn`) em 29/10/2026, com o "ok produção" do RT, pela sessão principal; versão registrada e conferida. Conferido: `atendimento_justificativa_upload`, `atendimento_justificativa_read` e `atendimento_justificativa_sigilo` (restritiva). PR #351 mesclado (tela). Concluído.
