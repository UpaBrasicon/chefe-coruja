# Trilha de segurança, S7: sessão no navegador — diagnóstico

**Pedido.** Em 15/11/2026, depois do S6, o RT escolheu o S7 ("S7 segurança").

**Origem.** Auditoria Cloudflare (`docs/seguranca/auditoria-cloudflare-2026-11-15/RESUMO.md`), item 14 e as notas de endurecimento.

**Escopo.** Só diagnóstico, lido no código (`src/contexts/AuthContext.tsx`, `src/lib/supabase.ts`, `src/components/seguranca/SegundoFator.tsx` e a migration `20261022000001_segundo_fator_email.sql`).

## Como está hoje

**O "Sair" limpa tudo** (`signOut` no `AuthContext`):
- avisa as outras abas;
- apaga os rascunhos clínicos, a sessão guardada para uso sem rede, as consultas guardadas e as chaves do cofre e da fila;
- limpa o cache das telas (`queryClient.clear()`);
- encerra a sessão e apaga o token dos dois armazenamentos, de novo 5 s depois.

Os registros que esperam rede continuam cifrados no aparelho e voltam a ser enviados quando a mesma pessoa entra de novo.

**"Manter conectado"** guarda a sessão no `localStorage` por até 12 horas. Sem ele, a sessão fica no `sessionStorage` e acaba ao fechar a aba.

**"Confiar neste dispositivo"** (segundo fator por e-mail):
- grava um token de 30 dias no `localStorage` (`cc_dispositivo_2fa`), que pula o código no próximo login da mesma pessoa naquele navegador;
- o servidor guarda só o resumo do token, e a pessoa pode revogar o aparelho no Perfil.

## As lacunas

1. **Sessão encerrada pelo servidor deixa dados na aba.**
   - Quando a sessão acaba sem o "Sair", o evento `SIGNED_OUT` chega. Isso acontece quando o servidor recusa a renovação: senha trocada, vínculo revogado (S1), sessão derrubada em outro lugar.
   - Nesse caso, a aba só zera o perfil e as chamadas compartilhadas.
   - Ficam na memória e no navegador: o cache das telas (pacientes, prescrições, escala lidos antes), os rascunhos, as consultas guardadas para uso sem rede e as chaves do cofre e da fila.
   - Quem senta depois no mesmo computador, sem entrar, não vê a tela de dados, porque a casca volta ao login. Mas o conteúdo continua no navegador até a aba fechar ou a próxima pessoa entrar.
2. **As 12 horas do "Manter conectado" só valem ao abrir a página.**
   - `manterConectadoVencido()` roda uma vez, na carga.
   - Com a aba aberta, o supabase-js renova o token sozinho e a sessão passa das 12 horas sem limite.
3. **O token de dispositivo confiável fica depois do "Sair".**
   - No computador do posto, quem marcou "confiar" deixa um token de 30 dias no navegador.
   - Quem descobrir a senha dessa pessoa entra ali sem o código. O segundo fator vale só nos outros aparelhos.
   - O token é da pessoa: outro usuário que entra no mesmo navegador não aproveita o token, e a tentativa dele apaga o token.

## Decisões para o RT

**C1. Sessão encerrada pelo servidor.**
- **A (recomendada):** o `SIGNED_OUT` que não veio do "Sair" faz a mesma limpeza do "Sair".
  - Saem rascunhos, consultas guardadas, chaves e o cache das telas.
  - Os registros sem rede continuam cifrados e voltam quando a pessoa entra de novo, como hoje no "Sair".
  - A tela de entrada mostra: "Sua sessão foi encerrada. Entre de novo."
- **B:** só limpar o cache das telas.

**C2. 12 horas com a aba aberta.**
- **A (recomendada):** a aba confere o prazo a cada minuto e quando volta ao primeiro plano.
  - 15 minutos antes do fim, aparece o aviso "Sua sessão termina às HH:MM. Salve o que estiver fazendo."
  - No prazo, a sessão acaba com a limpeza do "Sair", e a tela de entrada explica que as 12 horas acabaram.
- **B:** encerrar no prazo, sem o aviso antes.

**C3. Dispositivo confiável.**
- **A (recomendada):** "Confiar neste dispositivo" só aparece quando a pessoa marcou "Manter conectado" (aparelho dela).
  - Sem "Manter conectado", o token não é gravado, e o "Sair" apaga o que houver.
  - No celular da pessoa nada muda.
- **B:** o "Sair" sempre apaga o token, e todo login depois de sair pede o código.

**C4. Prazo no servidor.**
- **A (recomendada):** não mexer agora.
  - O limite de sessão do Supabase (time-box) vale para todas as sessões, inclusive as sem "Manter conectado".
  - Com 12 horas, ele derrubaria quem está no meio de um plantão de 24 horas.
  - A regra fica no navegador (C2), e a revogação no servidor já existe (S1, troca de senha).
- **B:** você confere no painel do Supabase se o plano permite o limite e escolhe um prazo de pelo menos 24 horas.

## Riscos

- **Rascunho perdido quando o servidor encerra a sessão (C1):**
  - o rascunho já fica ilegível hoje, porque a chave do cofre morre com a sessão no servidor;
  - a limpeza só tira do navegador o que não abre mais.
- **Aviso de 15 minutos no meio de um atendimento (C2):** o aviso não bloqueia a tela, e a pessoa entra de novo marcando "Manter conectado" se quiser mais 12 horas.
- **Quem usava "confiar" no computador do posto (C3):** volta a receber o código por e-mail ali. É o comportamento esperado para máquina compartilhada.
- **Rollback:** só frontend; voltar o PR.

## Critérios de aceite

1. Teste de unidade: o `SIGNED_OUT` que não veio do "Sair" chama a mesma limpeza.
2. Teste de unidade: o prazo de 12 horas é conferido com a aba aberta (relógio simulado), com o aviso 15 minutos antes.
3. Teste de unidade: sem "Manter conectado", o token de dispositivo não é gravado e o "Sair" o apaga.
4. Na homologação: sessão derrubada pelo servidor (revogar a sessão da conta de teste) leva à tela de entrada com o aviso e sem dados no cache.
5. CI verde.

## Depois

Com as decisões, abro a tarefa. Começo pelo frontend; o S7 não tem migration.
