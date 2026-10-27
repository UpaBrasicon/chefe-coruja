# Ponto 5 — entrada, ajuste e extrato do estoque

Pedido do RT em 27/10/2026 ("Na dispensação avulsa, como fica o controle do que sai e do que entra no
estoque?"), aprovado no mesmo dia como o quarto dos seis pontos (`docs/farmacia/REVISAO-FARMACEUTICO-2026-10.md`).

**Diagnóstico:**

- A saída avulsa e a devolução já mexiam no saldo e ficavam registradas.
- A **entrada não existia como movimento**. O saldo era sobrescrito na Disponibilidade, sem motivo,
  sem histórico e sem auditoria.

**Decisão do RT em 27/10/2026:** lote e validade ficam para depois, como item próprio.

## O que mudou

### Banco

Migration `supabase/migrations/20270110000001_movimentos_estoque.sql`.

- **Livro do estoque, só de inserção:** a tabela nova `public.movimentos_estoque` guarda cada mudança
  de saldo. Cada linha tem:
  - o tipo: saldo inicial, entrada, saída por prescrição, saída avulsa, devolução ou ajuste de
    inventário;
  - a quantidade com sinal e o saldo depois do movimento;
  - o documento, o motivo e a dispensação de origem;
  - quem fez e quando.
- **Quem escreve o livro é um gatilho no próprio saldo** (`estoque_medicamento`). Assim nenhuma
  mudança de saldo fica fora do livro.
  - O tipo do movimento vem do contexto da transação. A dispensação e a devolução marcam esse
    contexto pelos gatilhos delas, e as funções novas marcam o delas.
  - A dispensação e a devolução de hoje não mudaram de corpo.
  - Mudança sem contexto (a tela antiga, `atualizar_estoque`) entra como "ajuste de inventário",
    com o motivo "saldo informado sem motivo".
- **Funções novas:**

  | Função | O que faz | Quem pode |
  |---|---|---|
  | `registrar_entrada_estoque` | registra a entrada, com quantidade, documento (nota, requisição ou transferência) e observação | farmacêutico da unidade |
  | `ajustar_estoque` | grava o saldo contado; pede motivo e recusa o saldo igual ao atual | farmacêutico da unidade |
  | `extrato_estoque` | lista os movimentos do item, do mais novo ao mais antigo (90 dias), com quem fez, documento, motivo e paciente da dispensação | farmacêutico e gestor |

- **Saldo inicial:** a migration grava uma linha por item que já tem saldo, para o extrato fechar com o
  saldo. A homologação não tinha saldo informado.

### Tela

- **Disponibilidade, ficha do item** (`Farmacia.tsx`):
  - o saldo deixa de ser um campo solto;
  - entram os botões "Entrada" (quantidade, documento e observação) e "Ajuste de inventário" (saldo
    contado e motivo);
  - entra o extrato do item, com o tipo, a quantidade com sinal, o saldo, a data, quem fez, o
    documento, o paciente e o motivo;
  - os limites só se definem depois de haver saldo.
- **Dispensação, Registro** (`Dispensacao.tsx`): ganha o período (24 h, 72 h, 7 dias e 30 dias). A
  função do banco já aceitava o período.

## O que não cobre

- **Lote e validade:** ficam para depois, por decisão do RT.
- **Saldo negativo:** continua permitido, como na decisão "5a" de 17/10/2026, e aparece no extrato.
- **Saldo negativo e limites:** com saldo negativo, os limites do item não se salvam até um ajuste.
  Isso já era assim antes.

## Rollback

- Fazer DROP dos gatilhos `trg_estoque_movimento`, `trg_dispensacao_movimento` e
  `trg_devolucao_movimento` e das funções novas.
- A tabela fica, porque é trilha só de inserção. Ela sai só numa janela declarada (contract).

## Evidência

- **Teste do banco** `supabase/tests/movimentos_estoque.sql`. Cria o próprio cenário: rede, unidade,
  farmacêutico, gestor e medicamento. Confere que:
  - o gestor não registra entrada;
  - a entrada sem documento ou com quantidade zero é recusada;
  - entrada, saída avulsa e devolução entram no livro com a dispensação;
  - o ajuste sem motivo, ou com o mesmo saldo, é recusado;
  - a tela antiga entra como ajuste sem motivo;
  - salvar só os limites não vira movimento;
  - o extrato tem os 5 movimentos, na ordem, e soma o saldo (9);
  - o gestor lê o extrato;
  - o livro não se altera;
  - a devolução fica ligada à dispensação.
- **Teste da tela** `src/lib/movimentosEstoque.test.ts`: os tipos são os mesmos do banco, e a ficha
  usa a entrada e o ajuste, não o saldo solto.
- **Local:** typecheck, lint, catraca, os 147 testes de `src/lib`, os 1089 testes clínicos e o build,
  todos verdes.
- **Homologação** (`kswurfyxxvfydpjfrivy`), 27/10/2026:
  - migration aplicada e registrada como `20270110000001 movimentos_estoque`;
  - o teste do banco rodou inteiro numa transação desfeita, e todos os passos passaram;
  - o rollback (DROP dos gatilhos e das funções) rodou numa transação desfeita;
  - depois, nada sobrou e os 3 gatilhos estão no lugar.

## Teste do RT na homologação

1. Como farmacêutico, abrir Central do Farmacêutico › Disponibilidade e escolher um item.
2. Clicar em "Entrada", informar a quantidade e o documento (por exemplo "NF 123") e registrar. O
   saldo sobe, e o extrato mostra a entrada com o documento.
3. Em Dispensação › Avulsa, dispensar parte desse item. De volta à ficha, o extrato mostra a saída
   avulsa com o destino.
4. Fazer um "Ajuste de inventário" com o saldo contado e o motivo. O extrato mostra a diferença.
5. Em Dispensação › Registro, trocar o período para 7 dias ou 30 dias.
