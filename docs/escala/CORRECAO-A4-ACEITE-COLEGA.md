# Correção do bug alto A4 — "assumir o plantão" e aceite do colega (30/10/2026)

Origem: teste ponta a ponta da escala, `docs/escala/TESTE-E2E-2026-10-29.md`, item A4.
Decisão do RT em 30/10/2026: **proposta A**, igual para passagem e troca.

## Diagnóstico

"Assumir o plantão" não existia. Quem recebia a passagem não via o pedido, não aceitava e não era
avisado; a tela prometia aviso. O plantão era empurrado sem o colega saber (e, na unidade sem
aprovação do gestor, aplicado na hora). Na troca, depois do A2, o colega só recusava.

**Produção, só esquema (30/10/2026):** `passar_plantao` e `solicitar_troca` aplicam na hora quando
`escala_passagem_exige_aprovacao = false`; nenhuma função de aceite; nenhum aviso ao destino.

## Fluxo (proposta A)

1. Quem pede escolhe o colega da mesma categoria. O pedido nasce **esperando o colega**, que recebe
   aviso no sino ("Fulano quer passar o plantão de Pronto Socorro em 01/11 (manhã) para você…").
2. O colega vê o pedido em **Pedidos para você** (aba Escala de todos os papéis e do plantonista) e
   aceita ou recusa. Se recusar, o pedido acaba e quem pediu é avisado. Se aceitar, quem pediu e o
   gestor são avisados.
3. O gestor só decide **depois do aceite** (antes, a aba Pedidos mostra "Esperando o colega aceitar",
   sem botões). Aprovou: o plantão muda de dono (ou os dois trocam) e os dois são avisados. Recusou:
   os dois são avisados.
4. Na unidade com `escala_passagem_exige_aprovacao = false`, o aceite do colega já aplica.
5. Quem pediu cancela enquanto o gestor não decidir ("Seus pedidos" e "Minhas trocas").

## Banco — migration `20270208000006_escala_aceite_colega.sql`

- Colunas `aceito_em` em `solicitacoes_escala` e `trocas_plantao`; status `cancelado` acrescentado ao
  CHECK de `solicitacoes_escala` (expand).
- Funções novas: `pedidos_para_mim`, `aceitar_passagem`, `recusar_passagem`, `cancelar_pedido_escala`,
  `aceitar_troca`, `cancelar_troca`; apoio `private.avisar`, `avisar_gestores`, `descrever_plantao`,
  `nome_de`, `efetivar_troca`.
- Corpos novos: `passar_plantao` e `solicitar_troca` (sem aplicar na hora; avisam o colega),
  `aprovar_troca` (exige o aceite; avisa os dois), `recusar_troca` (avisa), `private.passagem_aprovada`
  (exige o aceite).
- Gatilhos: `trg_passagem_avisos` (avisos da decisão da passagem) e `trg_solicitacao_insercao`
  (inserção direta pela API nasce pendente, sem aceite nem decisão; cargas do servidor não passam por ele).
- O UPDATE direto de `solicitacoes_escala` fica só em `status` e `decidido_por` (o que a tela do gestor
  grava): o gestor não marca o aceite por update.
- Idempotente (aplicada duas vezes seguidas na homologação, sem erro). Rollback no cabeçalho,
  **testado**: funções, gatilhos e grants voltam iguais (as colunas `aceito_em` ficam, expand).

## Tela

- `src/components/escala/PedidosParaVoce.tsx` (novo): lista por `pedidos_para_mim`, com Aceitar/Recusar.
  Entra na aba Escala dos outros papéis (`EscalaEquipe.tsx`) e na do plantonista (`Escala.tsx`).
- "Seus pedidos" (`PedidosEscala.tsx`): "aguardando o colega" / "aguardando a coordenação", botão
  Cancelar; só as trocas que eu pedi (antes mostrava como minha a troca em que sou o colega, B7); rótulo
  de "cancelada" (B6).
- "Minhas trocas" do plantonista: quem pediu vê o estado e cancela; quem recebe responde em Pedidos
  para você.
- Aba Pedidos do gestor e aviso do mês: passagem e troca só com botões depois do aceite; a contagem
  "aguardando você" conta só essas.
- Textos: a janela e as mensagens dizem que o colega aceita e a coordenação aprova.
- `src/types/database.ts`: colunas e funções novas.

## Testes

| Teste | Resultado |
|---|---|
| `supabase/tests/escala_aceite_colega.sql` sem a migration | **falha**: `A4: a passagem nasce esperando o colega, que é avisado` |
| Com a migration | **21 de 21** (inclui a inserção direta forjando aceite e aprovação, que nasce pendente) |
| `escala_passagem_aprovada` (C2), `escala_troca_gestor` (A2), `escala_troca_forcada` (C1), `porte_redteam_v3_v4` (V4) | ajustados ao aceite (o colega aceita antes do gestor; na unidade sem aprovação, o aceite aplica) |
| `escala_categoria`, `escala_pedidos_categorias`, `escala_atestado_falta`, `fase0_rpcs`, `escala_da_unidade` com a migration | passam |
| `fase5c_erp_plantoes` | passa (o CI pegou a 1ª versão do gatilho de inserção, que forçava "pendente" também na carga de teste feita como postgres; agora só vale para `authenticated`/`anon`) |
| `tsc`, `eslint`, guia do frontend | limpos |

## Homologação

Migration aplicada pelo SQL em 30/10/2026, versão `20270208000006` registrada. Como as contas E2E, em
transação desfeita:

| Passo | Quem | Resultado |
|---|---|---|
| Escala 004 no PS em 01/11 manhã | Gestora E2E | OK |
| Passa para 005 | Plantonista E2E (004) | pedido criado |
| Sino de 005 | Plantonista Dois E2E | "Plantonista E2E quer passar o plantão de Pronto Socorro em 01/11 (manhã) para você. Aceite ou recuse na aba Escala." |
| Pedidos para você | 005 | 1 passagem, de Plantonista E2E |
| Aprova antes do aceite | Gestora E2E | "O colega ainda não aceitou a passagem…" |
| Aceita | 005 | aceita |
| Sino da gestora | Gestora E2E | "Passagem para aprovar: Plantonista E2E → Plantonista Dois E2E, Pronto Socorro em 01/11 (manhã)…" |
| Aprova | Gestora E2E | aprovado; dono = Plantonista Dois E2E |
| Sino de 004 | 004 | "Passagem aprovada: o plantão de Pronto Socorro em 01/11 (manhã) agora é de Plantonista Dois E2E." |

A tela da homologação fica atrás do login do Vercel; a tela não foi aberta no navegador.

## Riscos

- Pedidos pendentes de antes desta migration ficam esperando o aceite do colega (que agora os vê).
- Na unidade sem aprovação do gestor, a passagem e a troca deixam de valer na hora: passam a esperar
  o aceite do colega (decisão do RT).

## Produção

Nada aplicado. Ordem: "ok produção" do RT → migration pelo SQL, versão registrada → merge (publica a tela).
