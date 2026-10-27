# Revisão das telas do farmacêutico — pedidos do RT em 27/10/2026

Diagnóstico dos seis pontos que o RT levantou ao rever as telas do farmacêutico. As telas são as do
master depois da revisão visual 3.7b (Alta vigilância e Interações em tabela e ficha, PR #248).

Fontes do diagnóstico:

- código em `src/pages/farmacia/`, `src/components/farmacia/`, `src/components/casca/navegacao.ts`,
  `src/components/casca/Paleta.tsx` e `src/App.tsx`;
- migrations em `supabase/migrations/`;
- esquema vivo da homologação (`kswurfyxxvfydpjfrivy`), só metadados: políticas, corpo das funções e
  lista de tabelas e colunas. A única contagem lida foi a do catálogo de medicamentos ativos (65 na
  homologação). Nenhum dado de paciente e nada da produção.

**Nada foi alterado no código nem no banco.** Este documento é proposta. Cada ponto vira item do
`BACKLOG.md` e espera a decisão do RT.

## Resumo

| Ponto | O que o RT viu | Diagnóstico em uma linha | Prioridade sugerida |
|---|---|---|---|
| 1 | Alta vigilância não adiciona medicação | Adiciona, mas escondido: a busca "Buscar no cadastro" só aparece na aba "Exige liberação". Medicamento fora do cadastro não entra | P2 (só tela, depende do ponto 4) |
| 2 | Diluição não adiciona medicação nem diluição | "Nova diluição" existe só no topo da aba "Rascunhos" e só para medicamento do cadastro. **Achado:** a diluição nova nasce como modelo da rede, e qualquer farmacêutico de qualquer unidade a publica para todas | P1 |
| 3 | Quem cadastra a falta? | O plantão, pela prescrição; o farmacêutico, só pela Disponibilidade e pelo Painel, e só quando o saldo já está em falta ou crítico. A aba Faltas não tem "Registrar falta" | P2 (só tela) |
| 4 | Unidade de consumo não adiciona item novo | Não existe cadastro de medicamento na tela. O catálogo só entra pelo ETL, e o banco só deixa o super admin inserir. Também não existe o campo "forma farmacêutica" | P1 (base dos pontos 1 e 2) |
| 5 | Dispensação avulsa: controle do que sai e do que entra | A saída baixa o estoque, com destino, motivo e auditoria. A entrada não existe como movimento: o saldo é sobrescrito à mão, sem motivo, sem histórico e sem auditoria | P1 |
| 6 | Farmacêutico não precisa da aba Prontuários | O farmacêutico tem a aba no menu, as duas rotas, a tela na paleta de busca e o direito no banco de pedir acesso ao prontuário | P1 |

**Causa comum dos pontos 1, 2 e 4:** a farmácia não tem onde cadastrar medicamento. Todas as telas
(alta vigilância, diluição, dispensação avulsa, unidade de consumo, disponibilidade) buscam no
catálogo `public.medicamento`, que só cresce pela carga do ETL (`scripts/etl/03_load_medicamento.cjs`)
ou por script do super admin. Na homologação o catálogo tem 65 medicamentos ativos. Por isso a
sugestão é fazer o ponto 4 antes dos pontos 1 e 2.

---

## Ponto 1 — Alta vigilância não tem como adicionar medicações

**O que existe hoje.**

- Tela `src/pages/farmacia/AltaVigilancia.tsx`, rota `/alta-vigilancia` (farmacêutico, enfermeiro e
  gestor).
- Abas "Sem liberação", "Exige liberação" e "Ajustes da unidade".
- Na aba "Exige liberação" há o campo "Buscar no cadastro" (`AltaVigilancia.tsx:113-121`). Ele chama
  `alta_vigilancia_da_unidade(p_unidade, p_busca)`, que procura em todo o catálogo ativo. A ficha do
  medicamento achado tem "Marcar na unidade", que pede motivo de 10 letras ou mais e chama
  `definir_alta_vigilancia` (migration `20261031000001_dupla_checagem.sql`).
- Quem pode: o farmacêutico ou o gestor da unidade marca e desmarca. O ajuste vale só para a
  unidade, fica em `alta_vigilancia_unidade` com quem, quando e motivo, e entra na auditoria.
- O medicamento novo no catálogo já nasce marcado pelas regras do ISMP Brasil 2019, pelo gatilho
  `medicamento_marca_alta_vigilancia`.

**O que falta.**

- O caminho existe, mas não aparece: não há botão "Adicionar". A busca fica só numa das três abas e
  diz "Buscar no cadastro", e não "adicionar à lista".
- Medicamento que não está no catálogo não pode ser marcado (depende do ponto 4).

**Proposta.**

- Banco e RPC: nada muda.
- Tela: botão "Adicionar medicamento" no topo da tela, visível em todas as abas para o farmacêutico
  e o gestor. Ele abre na ficha a busca no catálogo; o escolhido mostra "Marcar na unidade" com o
  motivo, como hoje. Se nada for achado, a ficha oferece "Cadastrar medicamento" (ponto 4).
- Testes: teste de tela do botão e da busca; os testes do banco seguem os de hoje
  (`fase2_dupla_checagem.sql`, `fase2_liberacao_farmacia.sql`).

**Prioridade e risco.** P2. Só tela; o risco é baixo. O texto deve dizer que a marcação vale para a
unidade, e não para a rede.

**A resposta já existe em outra tela?** Em parte: a própria tela já marca pela busca. Não há
cadastro de medicamento em nenhuma outra tela.

---

## Ponto 2 — Diluição não tem como adicionar novas medicações e diluições

**O que existe hoje.**

- Aba "Diluição" da Central do Farmacêutico (`src/pages/farmacia/Diluicoes.tsx`), com as abas internas
  "Valendo na unidade", "Rascunhos" e "Substituídas".
- "Nova diluição" existe, mas só como a primeira linha da lista da aba "Rascunhos"
  (`Diluicoes.tsx:152-157`). Quando já há rascunho, a tela abre o primeiro rascunho, e não o
  formulário novo.
- O formulário novo (`NovaDiluicao`, `Diluicoes.tsx:263-302`) pede um medicamento do catálogo (3
  letras ou mais), a via (só EV, IM ou SC, embora a tabela aceite também IN e VO) e a fonte. Ele cria
  o rascunho por `salvar_diluicao` (versão atual em `20261009000001_porte_farmacia.sql:231`).
- "Ajustar esta linha" (na aba "Valendo na unidade") cria o rascunho da unidade por
  `ajustar_diluicao_unidade`, e "Publicar aos prescritores" exige CRF do revisor, fonte e, na via EV,
  volume mínimo e tempo de infusão (`publicar_diluicao_versao`).
- Quem pode: `salvar_diluicao` aceita quem tem papel de farmacêutico em qualquer unidade
  (`private.sou_farmaceutico()`) ou o super admin. A escrita direta na tabela é só do super admin
  (política `diluicao_insert` e `diluicao_update`, conferidas na homologação).

**Achado (risco de governança).** A diluição criada por "Nova diluição" é inserida sem `unidade_id`,
ou seja, como **modelo da rede**. Para linha sem unidade, `private.pode_editar_diluicao(NULL)` aceita
qualquer farmacêutico, e `padrao_diluicao_unidade` entrega o modelo da rede a todas as unidades que
não têm ajuste próprio. Resultado: o farmacêutico da unidade A publica uma diluição que chega aos
prescritores da unidade B, sem que a farmácia de B tenha revisado.

**O que falta.**

- Botão visível para criar diluição nova, fora da aba "Rascunhos".
- Escolher se a diluição nova vale só para a unidade (o normal) ou para a rede.
- Medicamento que não está no catálogo (depende do ponto 4).
- As vias IN e VO, que a tabela já aceita.

**Proposta.**

- Banco (expand, sem mudar o sentido do que existe):
  - `salvar_diluicao` aceita `unidade_id` em `p_dados` na criação. Sem ele, a diluição nova nasce
    **da unidade ativa** de quem cria; a linha nova da unidade passa pela mesma checagem de hoje
    (`farmaceutico_da`).
  - Criar e publicar modelo da rede (`unidade_id` nulo) fica só para quem o RT decidir: sugestão,
    super admin ou um farmacêutico responsável pela rede. Os modelos que já existem não mudam.
  - Rollback: reaplicar a função de `20261009000001`.
- RPC: as mesmas, com o parâmetro novo opcional.
- Tela: botão "Nova diluição" no cabeçalho da aba, visível em todas as abas internas; o formulário
  mostra "vale para esta unidade" e, para quem pode, "modelo da rede"; vias EV, IM, SC, IN e VO; se o
  medicamento não está no catálogo, "Cadastrar medicamento" (ponto 4).
- Testes: pgTAP com farmacêutico da unidade A criando e publicando, e a unidade B sem receber;
  farmacêutico comum tentando publicar modelo da rede e recebendo erro.

**Prioridade e risco.** P1, pelo achado: hoje a publicação de um farmacêutico chega a outras
unidades. Risco da mudança: baixo, porque é expand e não muda as linhas que já valem.

**A resposta já existe em outra tela?** O "Nova diluição" existe na aba "Rascunhos"; o "Enviar padrão
da unidade" guarda o arquivo da farmácia como comprovante, mas não cria linha que chegue ao
prescritor.

---

## Ponto 3 — Quem cadastra o que está em falta?

**O que existe hoje.**

- Tabela `faltas_medicamento` e RPC `sinalizar_falta` (`20260929000008_fase4_farmacia.sql:182`).
  O banco aceita o farmacêutico da unidade ou **qualquer pessoa na escala agora** naquela unidade.
  Uma falta aberta por medicamento (a segunda chamada devolve a mesma).
- Quem sinaliza, na tela:
  - **o plantão (médico)**, pela prescrição: ao escolher o medicamento, botão "Sinalizar falta"
    (`src/components/prescricao/PrescricaoEstruturada.tsx:409-414`);
  - **o farmacêutico**, na Disponibilidade (ficha do item) e no Painel, mas o botão só aparece
    quando o saldo informado já está em "falta" ou "crítico" (`Farmacia.tsx:290-299`,
    `PainelFarmacia.tsx:164`).
- A aba Faltas (`Farmacia.tsx:317-403`) só acompanha: Registradas → Em cotação → Reposta
  (`avancar_falta`, só o farmacêutico) e o retorno ao plantão.
- A enfermagem pode sinalizar pelo banco, mas não tem botão em nenhuma tela.

**O que falta.**

- Na aba Faltas, o farmacêutico não registra falta direto. Casos reais que ficam de fora: o
  fornecedor avisou que não entrega, mas o saldo ainda está bom; o item nunca teve saldo informado;
  o saldo está defasado.
- "Reposta" não mexe no estoque: a reposição não vira entrada (ponto 5).

**Proposta.**

- Banco e RPC: nada muda; `sinalizar_falta` já aceita o farmacêutico em qualquer situação de saldo.
- Tela: botão "Registrar falta" na aba Faltas, com busca no catálogo e observação (motivo ou
  previsão). Com o ponto 5 feito, "Reposta" pode oferecer "Registrar a entrada" do item.
- Decisão do RT: a enfermagem ganha botão de sinalizar falta (por exemplo, na Checagem)?
- Testes: teste de tela do botão; pgTAP já cobre a regra de quem sinaliza.

**Prioridade e risco.** P2. Só tela; risco baixo.

**A resposta já existe em outra tela?** Sim: o médico cadastra pela prescrição, e o farmacêutico pela
Disponibilidade e pelo Painel, quando o saldo está em falta ou crítico. O vazio da aba já diz isso
("O plantão sinaliza pela prescrição e você pela Disponibilidade").

---

## Ponto 4 — Unidade de consumo não tem como adicionar itens novos com apresentação e forma

**O que existe hoje.**

- Tela `src/pages/farmacia/UnidadeConsumo.tsx`, rota `/unidade-consumo` (farmacêutico e gestor).
  Lista o catálogo e deixa só conferir ou corrigir a unidade de consumo (`definir_unidade_consumo`,
  com histórico em `medicamento_unidade_historico` e auditoria; migration
  `20261129000001_unidade_consumo.sql`).
- O catálogo `public.medicamento` é um só para a rede (decisão do RT de 17/10/2026, "1a").
  Colunas que importam aqui: `principio_ativo`, `apresentacao` (texto livre, por exemplo "Ampola 10
  mL"), `concentracao`, `unidade_consumo` (lista fixa com "outra"), `alta_vigilancia`, `ativo`,
  `fonte`. **Não há coluna de forma farmacêutica nem de via** (conferido na homologação).
- Quem pode inserir: só o super admin (políticas `medicamento_write` e `medicamento_update`,
  conferidas na homologação). Não há RPC nem tela de cadastro. O catálogo entra pela carga do ETL
  (`scripts/etl/03_load_medicamento.cjs`); as revisões em lote ficam em `revisoes_cadastro`.
- Ao entrar no catálogo, dois gatilhos já agem: a unidade de consumo é sugerida pela apresentação e a
  alta vigilância é marcada pelas regras do ISMP.

**O que falta.**

- Cadastro de medicamento pela farmácia: princípio ativo, forma farmacêutica, apresentação,
  concentração e unidade de consumo.
- O campo de forma farmacêutica, separado da apresentação.
- Corrigir e inativar o que a farmácia cadastrou, com motivo e histórico (sem excluir: prescrições,
  dispensações e contas apontam para o medicamento).

**Proposta.**

- Banco (expand):
  - colunas novas em `medicamento`: `forma_farmaceutica` (lista fixa com "outra", como a unidade de
    consumo), `cadastrado_por`, `cadastrado_em`, `cadastrado_na_unidade`;
  - a chave única que já existe (`principio_ativo_norm`, `apresentacao`) impede a duplicata exata.
  - Rollback: DROP das colunas novas e das funções novas; nenhuma coluna existente muda.
- RPC:
  - `cadastrar_medicamento(p_dados)`: farmacêutico ou gestor, 2FA, campos obrigatórios (princípio
    ativo, forma, apresentação, unidade de consumo), `fonte = 'farmacia'`, auditoria. Antes de
    gravar, devolve os parecidos (mesmo princípio ativo) para a pessoa confirmar que não é repetido;
  - `editar_medicamento(p_id, p_dados, p_motivo)` e `inativar_medicamento(p_id, p_motivo)`, com o
    antes e o depois em `revisoes_cadastro` (lote "tela").
- Tela: a página "Unidade de consumo" ganha "Novo medicamento" (formulário com os cinco campos e a
  lista dos parecidos) e passa a mostrar a forma. Sugestão de nome: "Cadastro de medicamentos", com
  a unidade de consumo como uma das colunas. Os pontos 1 e 2 ligam a esta tela quando a busca não
  acha.
- Testes: pgTAP de quem cadastra (farmacêutico, gestor, médico com erro), duplicata, gatilhos de
  unidade de consumo e alta vigilância no item novo, inativar sem excluir.

**Decisões do RT.**

- O catálogo continua um só para a rede? Se sim, o item cadastrado pela farmácia da unidade A
  aparece para os prescritores de todas as unidades. A alternativa é o item novo valer primeiro só
  na unidade de quem cadastrou.
- A forma farmacêutica é campo novo ou a unidade de consumo basta?

**Prioridade e risco.** P1, porque destrava os pontos 1 e 2 e a dispensação avulsa. Risco clínico: um
nome ou uma concentração errados chegam à prescrição. Mitigação: lista dos parecidos antes de gravar,
"cadastrado pela farmácia de X" visível no item, correção com histórico. O sistema continua sem
sugerir dose.

**A resposta já existe em outra tela?** Não. Nenhuma tela insere em `medicamento`.

---

## Ponto 5 — Na dispensação avulsa, como fica o controle do que sai e do que entra no estoque?

**O que existe hoje.**

- Tela `src/pages/farmacia/Dispensacao.tsx`, abas Prescrições, Avulsa e Registro; migration
  `20261130000001_dispensacao_farmacia.sql` (decisões do RT de 17/10/2026).
- **Saída avulsa** (`dispensar_avulso`): só o farmacêutico da unidade; medicamento do catálogo,
  quantidade, destino (3 letras ou mais) e motivo (10 ou mais). Grava em `dispensacoes` (tipo
  "avulsa"), baixa o estoque por `private.mover_estoque` e grava auditoria. O saldo pode ficar
  negativo (decisão "5a"), e a tela avisa para conferir.
- **Devolução** (`devolver_dispensacao`): com motivo, volta ao estoque, com auditoria.
- **Registro**: as dispensações das últimas 72 horas, com conferir e devolver.
- **Entrada**: não existe como movimento. O único jeito de aumentar o saldo é a ficha da
  Disponibilidade, que chama `atualizar_estoque` e **sobrescreve** a quantidade. Essa função não pede
  motivo, não grava auditoria (conferido na homologação) e guarda só o último "atualizado por" e
  "atualizado em" em `estoque_medicamento`. Não há tabela de movimentos de estoque na homologação.
- "Reposta" na falta não muda o saldo.

**O que falta.**

- Registrar a entrada (compra, transferência entre unidades, reposição) com quantidade, documento e
  data.
- Ajuste de inventário com motivo, no lugar da sobrescrita silenciosa.
- Extrato por item: saldo anterior, cada entrada e saída, quem e por quê.
- Registro da avulsa além de 72 horas (filtro por período).

**Proposta.**

- Banco (expand):
  - tabela `movimentos_estoque`, só inserção: unidade, medicamento, tipo (`entrada`, `saida_prescricao`,
    `saida_avulsa`, `devolucao`, `ajuste_inventario`, `perda`), quantidade com sinal, saldo depois do
    movimento, documento (nota fiscal ou requisição), motivo, ligação com a dispensação, quem e
    quando; gatilho que bloqueia UPDATE e DELETE, como nas tabelas clínicas;
  - `private.mover_estoque` passa a gravar o movimento (mesma assinatura; quem já chama não muda);
  - na migration, uma linha "saldo inicial" por item que já tem saldo, para o extrato começar certo.
  - Rollback: voltar `mover_estoque` e `atualizar_estoque` às versões de hoje; a tabela fica (só
    inserção) ou sai com DROP na janela declarada.
- RPC:
  - `registrar_entrada_estoque(p_unidade, p_medicamento, p_quantidade, p_documento, p_motivo)`;
  - `atualizar_estoque` vira ajuste de inventário: calcula a diferença, exige motivo (parâmetro novo,
    opcional no banco para não quebrar quem chama; obrigatório na tela) e grava o movimento e a
    auditoria;
  - `extrato_estoque(p_unidade, p_medicamento, p_desde)`.
- Tela: na ficha da Disponibilidade, "Entrada" (quantidade, documento, motivo), "Ajuste de inventário"
  (no lugar do "Salvar" do saldo) e o extrato do item; no Registro da dispensação, filtro por período e
  por tipo; na falta "Reposta", atalho para a entrada.
- Decisão do RT: lote e validade entram agora (rastreio por lote e aviso de vencimento) ou ficam para
  depois? Sugestão: depois, como item próprio.
- Testes: pgTAP do saldo depois de cada tipo de movimento, saldo negativo continua permitido, só
  inserção, extrato igual ao saldo.

**Prioridade e risco.** P1. Hoje o saldo muda sem trilha, e a conta (Fase 5B, 3.3) e o painel do
gestor contam com ele. Risco da mudança: médio, porque mexe em `mover_estoque`, que a dispensação e a
conta usam; por isso a mesma assinatura e os testes de regressão da 3.2 e da 3.3.

**A resposta já existe em outra tela?** A saída e a devolução, sim (Dispensação). A entrada, não.

---

## Ponto 6 — O farmacêutico não precisa da aba Prontuários

**O que existe hoje.** O farmacêutico chega ao pedido de acesso ao prontuário por quatro caminhos na
tela, e o banco aceita o pedido dele:

| Onde | O que libera | Arquivo |
|---|---|---|
| Menu lateral | item "Prontuários" no menu do farmacêutico | `src/components/casca/navegacao.ts:161` |
| Rota `/prontuarios` | tela de pedido de acesso | `src/App.tsx:330` (`RequireRole` com `farmaceutico`) |
| Rota `/prontuarios/:pacienteId` | leitura do prontuário com pedido aprovado | `src/App.tsx:333` |
| Paleta de busca | a tela "Prontuários" aparece como destino, porque a paleta indexa os itens do menu do papel (`AppShell.tsx:568`) | `src/components/casca/Paleta.tsx` |
| Banco | `private.papel_pode_pedir_acesso` inclui `farmaceutico`; vale para `buscar_paciente_para_pedido` e `pedir_acesso_prontuario`. Aprovado pelo gestor, o pedido abre leitura por 24 h nas tabelas clínicas (`acesso_encerrado_vigente`) | `20261001000001_fase6_pedido_acesso_encerrado.sql:84-90` (conferido na homologação) |

O bloco "Fora do seu acesso / Pedir acesso ao prontuário" da paleta só aparece para o plantonista
(depende da busca de pacientes), então não muda para o farmacêutico.

**Diferença com a frase do RT.** O RT disse que a aba é exclusiva do plantonista e do gestor. Hoje:

- também têm a aba e o direito de pedir: enfermeiro, técnico de enfermagem e telemedicina;
- o gestor não tem a aba "Prontuários": ele decide os pedidos em Auditoria e lê o prontuário pela
  rota `/prontuarios/:pacienteId` (por exemplo, a partir do mapa de leitos).

Este documento propõe tirar só o farmacêutico, como o RT pediu. Se a regra valer também para
enfermagem e telemedicina, é decisão do RT e item à parte.

**O que falta.** Tirar o farmacêutico dos quatro caminhos e do banco.

**Proposta.**

- Banco: `papel_pode_pedir_acesso` sem `farmaceutico` (CREATE OR REPLACE). `acesso_encerrado_vigente`
  passa a exigir que o papel atual possa pedir, para que um pedido aprovado antes da mudança deixe
  de valer. Os pedidos pendentes do farmacêutico são cancelados pela migration, com registro na
  auditoria. Rollback: reaplicar as duas funções de `20261001000001`.
- Tela: tirar `ITEM_PRONTUARIOS` do menu do farmacêutico (sai também da paleta e da barra do
  celular, que leem o mesmo menu); tirar `farmaceutico` das duas rotas.
- Testes: pgTAP (farmacêutico pede e recebe "Acesso negado"; pedido aprovado antigo não abre
  leitura; plantonista continua pedindo); teste do menu por papel; teste de rota.

**Risco.** O farmacêutico clínico às vezes precisa de alergia, função renal ou peso para validar. A
validação já mostra o peso (`fila_validacao`), mas não mostra alergias. Se o RT achar necessário, o
caminho certo é trazer esse dado para a ficha da validação, e não reabrir o prontuário.

**Prioridade.** P1: é minimização de acesso a dado de paciente (LGPD). Mudança pequena e fácil de
reverter.

**A resposta já existe em outra tela?** O que o farmacêutico precisa do paciente já chega pela
validação e pela dispensação (nome, setor, leito, itens, peso), por funções do banco que não passam
pelo pedido de acesso.

---

## Ordem sugerida

Sugestão, pela prioridade e pela dependência. Cada item em branch e PR próprios, homologação antes.

1. **Ponto 6** — Prontuários fora do farmacêutico (P1, pequeno, LGPD).
2. **Ponto 4** — Cadastro de medicamentos pela farmácia (P1, base dos pontos 1 e 2).
3. **Ponto 2** — Diluição nova visível e da unidade por padrão (P1, corrige a publicação para a rede).
4. **Ponto 5** — Entrada, ajuste e extrato do estoque (P1, o maior dos seis).
5. **Ponto 1** — "Adicionar medicamento" na Alta vigilância (P2, só tela).
6. **Ponto 3** — "Registrar falta" na aba Faltas (P2, só tela).

## Perguntas ao RT

1. Quais dos seis entram no backlog, com que prioridade e em que ordem?
2. Ponto 4: o catálogo continua um só para a rede, com o item novo visível a todas as unidades? A
   forma farmacêutica vira campo próprio?
3. Ponto 2: quem pode criar e publicar o modelo da rede?
4. Ponto 3: a enfermagem ganha botão de sinalizar falta?
5. Ponto 5: lote e validade entram agora ou depois?
6. Ponto 6: a regra vale só para o farmacêutico, ou também para enfermagem e telemedicina?
