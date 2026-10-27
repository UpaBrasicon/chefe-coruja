# Ponto 3 — Registrar falta na aba Faltas

Pedido do RT em 27/10/2026 ("Quem cadastra o que está em falta?"), aprovado no mesmo dia como o último
dos seis pontos (`docs/farmacia/REVISAO-FARMACEUTICO-2026-10.md`).

**Diagnóstico:**

- O médico sinaliza a falta pela prescrição.
- O farmacêutico só conseguia sinalizar pela Disponibilidade e pelo Painel, e só quando o saldo já
  estava em falta ou crítico.
- A aba Faltas não tinha como registrar.

**Decisão do RT em 27/10/2026:** só a farmácia ganha o botão; a enfermagem não.

## O que mudou

Só a tela (`src/pages/farmacia/Farmacia.tsx`). Não houve migration.

- **"Registrar falta"** fica no topo da aba Faltas, também quando ainda não há nenhuma falta.
- **A ficha "Registrar falta":**
  - busca na lista do estoque da unidade, a mesma da Disponibilidade, e mostra o saldo de cada item;
  - mostra quando o item já tem falta aberta;
  - aceita uma observação opcional, como "fornecedor sem previsão" ou "saldo defasado".
- **Qualquer saldo:** o registro vale para o item com saldo ok, crítico, em falta ou nunca
  informado. Ele usa a mesma `sinalizar_falta` do plantão (uma falta aberta por item), avisa o plantão
  na prescrição e cai em "Registradas".

## Evidência

- **Teste da tela** `src/lib/faltasRegistrar.test.ts`: confere o botão, também com a aba vazia, e o
  uso de `sinalizar_falta` com observação.
- **Banco:** nada muda. A regra de quem sinaliza já estava no banco.
- **Local:** typecheck, lint, catraca, os 145 testes de `src/lib`, os 1089 testes clínicos e o build,
  todos verdes.

## Teste do RT na homologação

1. Como farmacêutico, abrir Central do Farmacêutico › Faltas. "Registrar falta" aparece no topo.
2. Buscar um item com saldo ok, escrever uma observação e registrar. A falta aparece em "Registradas".
3. Como médico, escolher esse medicamento na prescrição. Aparece o aviso de falta.
4. Buscar o mesmo item de novo. A ficha diz que a falta já está aberta.

**Teste do RT em 27/10/2026: ok na homologação.**
