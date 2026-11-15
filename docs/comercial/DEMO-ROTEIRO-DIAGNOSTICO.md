# Backlog comercial, item 1: roteiro da demo — diagnóstico

**Pedido.** Em 15/11/2026, com a revisão do HCFMUSP concluída, o RT escolheu começar o backlog comercial pelo roteiro da demo ("Comercial, roteiro demo"). O item 1 do "Backlog Comercial Paralelo" pede roteiro, base fictícia, falas, objeções e 15 minutos, com o critério "demo validada internamente".

**Escopo.** Este documento é só diagnóstico. Nada muda no banco, no código ou nos roteiros aqui.

## Como está hoje

### Materiais comerciais (pasta `produto/`, fora do git)

| Item do backlog comercial | Situação | Onde |
|---|---|---|
| 1. Demo comercial | Roteiro de 15 min para gestor de UPA, ensaiado pelo RT em 07/10/2026 (14 min) | `produto/docs/demo/roteiro-demo-gestor-upa.md` |
| 2. One-page | Feito em 08/10/2026; lista os 8 módulos daquela data | `produto/docs/comercial/chefe-coruja-one-page.pdf` |
| 3. Pitch deck | Não existe | — |
| 4. Segurança e LGPD | Feito em 07/10/2026 | `produto/docs/seguranca-lgpd.md` |
| 5. Proposta de piloto | Não existe | — |
| 6. Roteiro de objeções | Só as 4 "perguntas prováveis" no fim do roteiro da demo | — |
| 7. Matriz competitiva | Feita em 08/10/2026; o backlog pede atualizar depois de cada fase, e vieram as Fases 2 a 5 | `produto/docs/comercial/matriz-competitiva-interna.pdf` |

A pasta `produto/` fica ao lado do repositório e não tem git: esses materiais não passaram por PR.

### O roteiro de 07/10/2026

- **Público:** gestor de UPA. Uma pessoa apresenta, com uma conta que tem todos os papéis e troca de perfil na tela.
- **Fluxo:** painel do gestor → check-in → recepção → triagem → médico (NEWS2, CID) → prescrição → observação → checagem → alta com CID → higienização → painel de novo → fala de segurança. Variante de internação com reserva e bloqueio de leito.
- **Base:** a "UPA Homologação", com a escala de quem apresenta (`supabase/homolog/demo-preparar.sql`). A unidade começa vazia: o painel do gestor abre sem pacientes, e só o paciente da demo aparece.

### O que mudou no sistema desde 07/10/2026 e pesa na demo

- **Base fictícia pronta (J4, 12/11/2026).** A "UPA 24h Jardim Primavera" (`scripts/demo/`) tem 24 pessoas fictícias na escala 12x36. O `02_plantao_agora.sql` monta um plantão em curso: 17 pacientes, 8 de 11 leitos ocupados (73%), números do painel batendo com a porta. O `03_acesso_conta.sql` dá à conta de quem apresenta só os papéis **gestor e plantonista**: recepção e enfermagem, que o roteiro usa, ficam de fora.
- **Correções que o roteiro ainda trata como problema:** a triagem agora guarda rascunho cifrado (o aviso "não recarregar com a triagem aberta" caiu), e a recarga sem conexão não leva mais ao login.
- **Telas novas na porta:** frequência com horário na prescrição do PS, favoritos de prescrição do médico, CID sugerido a partir da Avaliação, pulseira de identificação, registro do óbito, anexos com arrastar e colar, prontuário completo em linha do tempo.
- **Gestão:** tela Porta (agora), Indicadores com filtros e CSV, Contingência, aprovação de trocas na escala, aba Escala para todos os papéis.
- **Central do plantonista:** cerca de 230 ferramentas clínicas e o "Pergunte à IA" com fonte citada, com as diretrizes novas das revisões do PubMed e do HCFMUSP (108 capítulos, todos aprovados pelo RT).
- **Rede:** regulação (Fase 4), UBS (Fase 5A) e faturamento (Fase 5B). A unidade de demonstração é só uma UPA, sem UBS nem central de regulação.
- **Entrada de clientes:** o formulário "Agendar demonstração" do site (J3) já manda os pedidos para o e-mail de contato. A demo é o passo seguinte desse pedido.

## Decisões para o RT

**D1. Público e tamanho.**
- **A (recomendada):** 15 minutos para o gestor de UPA, porta à alta, na Jardim Primavera, mais três desvios de 3 minutos para usar só se o público pedir: Central do plantonista com o "Pergunte à IA", regulação e UBS/faturamento.
- **B:** 15 minutos para a secretaria de saúde (rede inteira), com menos tempo na porta.
- **C:** manter só o gestor de UPA, sem desvios.

**D2. Base fictícia.**
- **A (recomendada):** usar a UPA 24h Jardim Primavera, com o plantão do `02` (a demo abre com a unidade cheia). O `03` passa a dar também os papéis **recepção e enfermeiro** à conta de quem apresenta, para o fluxo inteiro sair da mesma conta. É mudança só no roteiro da homologação, sem migration.
- **B:** manter a "UPA Homologação" vazia, como em 07/10.

**D3. Desvios fora da UPA (só se D1 = A ou B).** A Jardim Primavera não tem UBS nem central de regulação.
- **A (recomendada):** nos desvios de regulação e UBS, trocar de unidade para a rede de teste da Fase 5 já existente na homologação, com a conta de quem apresenta, e avisar na fala que é outra unidade de teste.
- **B:** criar UBS e central de regulação fictícias na rede de demonstração (mais trabalho, nomes e números coerentes).

**D4. Objeções.**
- **A (recomendada):** o roteiro traz as perguntas prováveis atualizadas (internet caiu, onde ficam os dados, RNDS, assinatura, implantação, MV/Tasy/TOTVS), com resposta curta. O roteiro completo de objeções segue como item 6 do backlog comercial.
- **B:** fazer agora o item 6 completo, junto com a demo.

**D5. Onde o roteiro mora.**
- **A (recomendada):** o roteiro novo fica no repositório, em `docs/comercial/`, e passa por PR. O de 07/10 continua em `produto/` como histórico.
- **B:** seguir em `produto/docs/demo/`, fora do git.

**D6. Validação interna.**
- **A (recomendada):** eu percorro cada passo no Chrome, na homologação, com a sua conta já logada (o login e o 2FA são seus). Anoto o tempo de cada passo e corrijo o roteiro. Depois você faz um ensaio cronometrado, que é a validação.
- **B:** só o seu ensaio.

**Decisão do RT, 15/11/2026:** D1 a D6 = A ("Todas A").

## Subtarefas (com A em tudo)

1. **Base:** `scripts/demo/03_acesso_conta.sql` com os papéis recepção e enfermeiro; rodar `01` (se o mês virou), `02` e `03` na homologação.
2. **Roteiro:** `docs/comercial/demo/roteiro-demo-gestor-upa.md`, minuto a minuto (perfil, tela, o que fazer, o que dizer), com os nomes de tela de hoje, os três desvios, as perguntas prováveis e a tabela "se algo der errado".
3. **Conferência no Chrome:** cada passo na homologação, com o tempo anotado e as capturas sem dado de fora da rede de demonstração.
4. **Ensaio do RT:** cronometrado, até 15 minutos no fluxo principal.
5. **Registro:** evidência em `docs/comercial/demo/evidencia.md` e o item 1 do backlog comercial atualizado no `BACKLOG.md`.

## Banco, funções, frontend e permissões

- **Sem migration e sem código de tela.** Só o roteiro `03` da homologação e documentos.
- **Nunca na produção.** Os roteiros de `scripts/demo/` param se o banco não for a homologação. Na produção não há unidade de demonstração, e a demo não roda lá.
- **Auditoria:** o que quem apresenta fizer na demo fica na auditoria normal da homologação, em nome da conta dela.

## Testes e critérios de aceite (com evidência)

- `02` e `03` rodam duas vezes seguidas sem erro na homologação.
- O fluxo principal roda do painel ao fechamento em até 15 minutos no ensaio do RT, só com dado fictício.
- Nenhuma tela da demo mostra "E2E", "F5", "teste" ou nome de pessoa real, fora dos desvios que trocam de unidade (D3 = A), que a fala avisa.
- Toda tela e todo botão citados no roteiro existem com aquele nome na homologação no dia da conferência.

## Riscos

- **Check-in fora da cerca:** a cerca da Jardim Primavera é um ponto genérico, e quem apresenta estará longe dele. O check-in pede justificativa na segunda tentativa; o roteiro mostra isso como recurso (o gestor vê o motivo na auditoria).
- **Plantão envelhecido:** o `02` recua horários para "agora". Rodado na véspera, as esperas ficam longas demais; rodar até uma hora antes da demo.
- **IA da homologação:** se o "Pergunte à IA" estiver fora do ar, pular o desvio.
- **Login da Vercel e 2FA:** a homologação fica atrás do login da Vercel. Entrar e marcar "confiar neste dispositivo" antes.

## Ordem

D1–D6 do RT → `03` → roteiro → conferência no Chrome → ensaio do RT → evidência e BACKLOG.

## Demonstração comercial

É o próprio item: a demo responde ao pedido do formulário "Agendar demonstração" do site.
