# Onboarding dentro do app: diagnóstico (OB1 a OB4)

Fase 1, item 13 (P2): "criar tour ou dicas nas telas críticas; incluir recepção, triagem, prescrição e leitos". Critério de aceite: usuário novo entende o fluxo básico sem treinamento externo pesado. Pedido pelo RT em 23/11/2026. Lido na master (5344ab81). Nada foi programado.

## O que já existe

- **Roteiros de treinamento por papel** em `docs/implantacao/treinamento/` (recepção, enfermagem, médico, farmácia, faturamento, gestor), de 1 a 2 horas na homologação, cada um com exercícios, regras e uma checagem final. O gestor registra o treinamento na tela.
- **Texto de ajuda nas abas**: várias telas já explicam a aba no topo (ex.: Recepção, "Procure o paciente antes de cadastrar…").
- **Nada dentro do app guia a primeira vez**: não há tour, lista de primeiros passos nem lembrete das regras do papel.

## Referências reais (Refero)

- **Lista de primeiros passos no painel**: Intercom, "Getting started guide" (refero.design/pages/98da2ce2-b069-4539-8f42-fbabb4b4ae1b); Cake Equity (refero.design/pages/007fef39-1323-4171-9cb2-3fcf842cb131); DocuSign, com barra de progresso (refero.design/pages/d197ffa5-9a1f-4491-8d26-336ec3516471).
- **Tour guiado passo a passo**: Hashnode, janela "passo 2 de 4" (refero.design/pages/9de296fd-0293-4009-846f-aed7664582cc); Tango, destaque escurecendo o resto da tela (refero.design/pages/8a3b9459-7662-42c7-b8e1-2f03b96dd21c).

## Decisões

### OB1. Formato

**A (recomendo).** **Primeiros passos**, um cartão no topo da tela inicial de cada papel, com 4 a 6 tarefas reais do papel (ex., na recepção: "Procure o paciente antes de cadastrar", "Abra uma ficha", "Acompanhe a fila"). Cada tarefa leva à tela certa e tem "Já sei". Barra de progresso, como Intercom e Cake. Não cobre a tela nem trava o trabalho: num plantão cheio, ninguém fica preso num tour.

**B.** **Tour guiado** com destaque (como Tango e Hashnode) na primeira vez em cada tela crítica (recepção, triagem, prescrição, leitos): escurece a tela e aponta botão por botão, com "Próximo" e "Pular". Ensina mais no lugar, mas interrompe o trabalho e quebra quando a tela muda.

### OB2. Conteúdo

**A (recomendo).** Tirado dos roteiros de treinamento que já existem, um por papel, com as regras curtas do papel no fim do cartão (ex., "A recepção não classifica risco"; "Cada ficha leva o nome de quem está logado"). Um texto só para treinar e para o app.

**B.** Texto novo, escrito só para o app.

### OB3. Quando aparece

**A (recomendo).** Aparece até a pessoa completar ou clicar em "Esconder"; volta pelo menu do usuário, em "Primeiros passos".

**B.** Só no primeiro acesso, uma vez.

### OB4. Onde fica guardado o progresso

**A (recomendo).** No aparelho, separado por pessoa (o `localStorage` com o id do perfil na chave). Sem migration, pronto até quarta. Em computador compartilhado, cada pessoa vê o seu. Se trocar de computador, o cartão aparece de novo, com "Esconder" à mão.

**B.** No perfil, no banco (migration e RPC, por causa da trava das colunas do próprio perfil do S1). Segue a pessoa em qualquer aparelho.

## Perguntas ao RT

1. OB1 a OB4: A ou B em cada um?
