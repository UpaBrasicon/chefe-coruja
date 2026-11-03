# Ponto 1 — Adicionar medicamento na Alta vigilância

Pedido do RT em 27/10/2026 ("Alta vigilância não tem como adicionar medicações"), aprovado no mesmo dia
como o quinto dos seis pontos (`docs/farmacia/REVISAO-FARMACEUTICO-2026-10.md`).

**Diagnóstico:** o caminho já existia, mas ficava escondido. A busca "Buscar no cadastro" aparecia só
na aba "Exige liberação". Um medicamento que não está no cadastro não podia ser marcado.

## O que mudou

Só a tela (`src/pages/farmacia/AltaVigilancia.tsx`). Não houve migration.

- **Botão "Adicionar medicamento":** fica no topo, em todas as abas, para o farmacêutico e o gestor.
  Na aba "Sem liberação", ele leva à aba "Exige liberação".
- **Ficha "Adicionar medicamento":** faz a busca no cadastro. Ela mostra quando o medicamento já
  exige liberação e por quê, e para os outros pede o motivo e oferece "Marcar na unidade". A marcação
  usa a mesma `definir_alta_vigilancia` de hoje: motivo de 10 letras ou mais, histórico e auditoria.
  Depois de marcar, a tela mostra o item em "Ajustes da unidade".
- **Medicamento fora do cadastro:** a busca oferece "Cadastrar em Unidade de consumo", que é o
  cadastro do ponto 4.
- A busca antiga da aba "Exige liberação" continua no lugar.

## Evidência

- **Teste da tela** `src/lib/altaVigilanciaAdicionar.test.ts`: confere o botão para quem ajusta a
  lista, a marcação na unidade com motivo e o link para o cadastro.
- **Banco:** nada muda. A regra continua coberta pelos testes `fase2_dupla_checagem.sql` e
  `fase2_liberacao_farmacia.sql`.
- **Local:** typecheck, lint, catraca, os 146 testes de `src/lib`, os 1089 testes clínicos e o build,
  todos verdes.

## Teste do RT na homologação

1. Como farmacêutico, abrir Alta vigilância. "Adicionar medicamento" aparece no topo, em qualquer aba.
2. Buscar um medicamento que não exige liberação, escrever o motivo e clicar em "Marcar na unidade".
   O item aparece em "Ajustes da unidade", com o motivo, quem marcou e quando.
3. Buscar um medicamento que já exige liberação. A ficha diz por quê, em vez de oferecer a marcação.
4. Buscar um nome que não existe. A ficha oferece "Cadastrar em Unidade de consumo".

**Teste do RT em 27/10/2026: ok na homologação**, depois de recarregar a página (o print anterior era da versão de antes da publicação).
