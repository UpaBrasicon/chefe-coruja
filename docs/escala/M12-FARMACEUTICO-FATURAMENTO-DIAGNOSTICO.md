# M12: farmacêutico e faturamento entram pela escala, diagnóstico

O RT pediu em 11/11/2026 que a fila andasse para o M12. Este documento é só diagnóstico, sem código.

## De onde vem

- **Decisão 7 do RT (27/10/2026,** `docs/escala/ABA-ESCALA-PAPEIS-DIAGNOSTICO.md`, seção 8): farmacêutico e faturamento passam a entrar pela escala. A condição é que só liga depois que o gestor conseguir escalá-los pela tela (E2); senão, os dois perdem o acesso.
- **E3 (PR #320, 28/10/2026):** a decisão ficou de fora de propósito: "Pendente, em passo próprio: farmacêutico e faturamento entrarem pela escala, depois que o gestor escalar os dois".
- **Teste de ponta a ponta de 29/10/2026, item M12:** confirmou que os dois continuam entrando sem escala (`src/lib/constants.ts:124`).

## Como está hoje

- **A porta da escala (ADR 0003)** é a lista `PAPEIS_POR_ESCALA` (`src/lib/constants.ts:124`). Quem está nela só entra na unidade com plantão agora, pelo relógio do servidor (`situacao_checkin`), e faz check-in. Fora do plantão, vê a tela "Fora do seu horário", que mostra a própria escala e não abre nada clínico (`AppShell.tsx:274`, `ForaDoExpediente.tsx`). O super admin não passa pela escala.
- Entram pela escala hoje:
  - plantonista, enfermeiro, técnico de enfermagem, recepção, telemedicina e regulador;
  - os papéis de rede;
  - o NIR.
  **Farmacêutico e faturamento não entram.**
- **A condição da decisão já existe.** Desde a E2 (#315, na produção em 28/10/2026), o gestor escala qualquer categoria, menos gestor e administrador (`20270202000002`, `20270202000003`). Farmacêutico e faturamento podem ser escalados pela tela.

## Quem seria afetado (contagens, sem nomes, 11/11/2026)

| Ambiente | Farmacêutico | Faturamento |
|---|---|---|
| Produção | 1 vínculo ativo (o do RT, que tem os 8 papéis na UPA Centro), sem equipe em uso | nenhum vínculo |
| Homologação | 4 vínculos, com 9 plantões nos próximos 30 dias | 5 vínculos, **nenhum plantão** |

Ligando hoje, as 5 contas de faturamento da homologação, inclusive as de teste ponta a ponta, ficariam presas em "Fora do seu horário" até alguém escalá-las. Na produção não muda nada para usuário real. Se o RT entrar como farmacêutico sem ser super admin, também vai precisar de plantão.

## O que muda no código (opção A ou B)

- `src/lib/constants.ts`: `'farmaceutico'` e `'faturamento'` em `PAPEIS_POR_ESCALA`. É uma linha, sem migration.
- Na homologação, antes de publicar: escalar as contas de teste de faturamento e farmacêutico pela tela do gestor e conferir os roteiros de teste que entram com esses papéis.
- Teste de unidade da lista.

## Opções

- **A. Ligar os dois agora, como decidido em 27/10 (recomendada).** Antes de publicar, escalo na homologação as contas de teste de faturamento e farmacêutico. Na produção não há efeito até a implantação; ao implantar uma unidade, o gestor escala os dois antes do primeiro dia. Motivo: cumpre a decisão 7, e a condição dela (a E2) já está na produção há duas semanas.
- **B. Ligar só o farmacêutico.** O faturamento é trabalho administrativo, em horário comercial e sem plantão clínico, e continua entrando sem escala. Risco: abre exceção à regra "todo mundo tem escala, menos administrador e gestor".
- **C. Adiar para a implantação,** junto com a pulseira e a RNDS. Liga quando o gestor da primeira unidade real tiver escalado os dois. Risco: a pendência continua aberta, e o teste de ponta a ponta segue sem cobrir a porta desses papéis.

## Decisão do RT

| Pergunta | Recomendação | Decisão |
|---|---|---|
| Farmacêutico e faturamento pela escala | A | |
