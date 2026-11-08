# Item 14: a faixa de notificações mostra no máximo 3

**Achado:** achado 4 da conferência das telas de 07/11 (`CONFERENCIA-TELAS.md`), repetido como achado 3 em `CONFERENCIA-TELAS-08NOV.md`, P3.

**Pedido:** o RT escolheu esta correção em 08/11/2026 ("Avisos empilhados"). Só frontend, sem migration.

**Branch:** `correcoes/avisos-empilhados`.

## O que acontecia
- A Central do Plantonista abria com 39 avisos empilhados no topo. A Central só aparecia depois de rolar a página.
- **A origem não era a pilha flutuante.** O registro de 08/11 apontava para `AvisosFlutuantesContext`, mas a pilha da entrada já corta em 3 avisos (`AvisosDeEntrada`, em `AppShell.tsx`).
- **A origem real é a faixa `NotificacoesTurnoBanner`.** Ela fica fixa no topo da casca do plantonista e mostrava uma linha para cada notificação não lida do dia, sem limite: turno, prazos e eventos da regulação, exames, escala.
- Na homologação, em 06/11/2026, havia dezenas de notificações não lidas por pessoa, vindas dos testes da regulação. Um plantão movimentado chega lá também.

## Decisão
- A faixa mostra as 3 notificações mais novas.
- Abaixo delas, "e mais N notificações", quando houver mais.
- Com 2 ou mais notificações, aparece o botão "Fechar todas". Ele marca todas como lidas, uma a uma, com a mesma RPC `marcar_notificacao_lida` (não há RPC em lote).
- O sino (`SinoAvisos`) continua listando as notificações como antes.

## Feito
- **`src/lib/faixaNotificacoes.ts` e teste:** escolhe as 3 mais novas e conta as outras; o rótulo concorda com o número. O teste falhou antes do código e passa com ele (5 de 5).
- **`useNotificacoesTurno`:** ganhou `marcarTodas`.
- **`NotificacoesTurnoBanner`:** usa a seleção, mostra "e mais N" e "Fechar todas".

## Conferência na homologação
- Foram criadas 8 notificações de teste (`teste_faixa_1` a `teste_faixa_8`) para `medico.hospital.f5`, no Hospital F5.
- **Antes da publicação:** a faixa mostrou as 8, e a Central desceu para o meio da tela.
- **Depois da publicação** (branch `homolog` em e027038a, com o service worker desregistrado):
  - a faixa mostrou só as nºs 8, 7 e 6, com "e mais 5 notificações" e "Fechar todas";
  - a Central ficou logo abaixo da faixa;
  - "Fechar todas" fez a faixa sumir. No banco, as 8 notificações de teste ficaram com `lida_em` preenchido.
