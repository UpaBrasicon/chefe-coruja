# Aba "Escala" para todos os papéis — diagnóstico

27/10/2026. Pedido do RT: uma aba "Escala" para todos os papéis da unidade, menos gestor e
administrador, no mesmo molde das revisões do farmacêutico e do plantonista. Esta etapa é só o
diagnóstico, a proposta e as perguntas. **Nenhum código antes do "sim" do RT.**

**Situação no backlog.** O RT respondeu às dez perguntas em 27/10/2026 e mandou começar agora.
O pedido entrou no `BACKLOG.md` ("Aba Escala para todos os papéis"). As respostas e o que mudou na
proposta estão na seção 8, no fim.

**Como foi levantado.** Leitura do código no master (`19a3354`) e consultas só de leitura na
homologação (`kswurfyxxvfydpjfrivy`): políticas de RLS, definição das funções e contagens sem nome.
A produção foi lida depois, com a autorização do RT (pergunta 9), só com contagens sem nome
(seção 8).

---

## 1. Resumo em cinco linhas

1. A escala já é **uma tabela só para todos os papéis** (`escala_plantao`). Ela não diz de qual
   categoria é o plantão: diz só pessoa, setor, dia e turno.
2. **O gestor só consegue escalar plantonistas pela tela.** A lista de pessoas vem de
   `plantonistas_da_unidade`, que filtra `papel = 'plantonista'`. Enfermagem, técnicos, recepção,
   regulador, NIR e telemedicina só entram na escala por SQL (é assim na homologação).
3. Quem "entra pela escala" (plantonista, enfermagem, recepção, telemedicina, regulador, NIR e
   papéis de rede) **não vê o app fora do plantão**: vê só a tela "Fora do seu horário", com o
   próximo plantão. Uma aba "Escala" dentro do menu, do jeito que o app funciona hoje, só abriria
   durante o plantão.
4. **Defeito no plantonista, já em produção:** a "Escala da unidade" e a troca de plantão leem a
   tabela direto, mas a RLS só devolve os plantões da própria pessoa. Os plantões dos colegas
   aparecem como "livre" e a lista para troca vem vazia. Provado na homologação (seção 3.3).
5. Trocas, passagens e faltas já funcionam no banco para qualquer pessoa escalada, **sem conferir
   a categoria**: hoje o banco aceitaria um técnico trocar plantão com um médico. A tela não oferece
   isso a ninguém além do plantonista, então ainda não acontece.

---

## 2. Papéis e o menu de cada um hoje

Papéis da unidade (`public.papel`): admin, gestor, plantonista
(`supabase/migrations/20260815000001_fase1_schema.sql:21`); enfermeiro, tecnico_enfermagem,
recepcao, farmaceutico, telemedicina (`20260926000004_fase1_papeis.sql:12-16`); regulador
(`20261102000001_papel_regulador.sql:5`); faturamento (`20261103000001_papel_faturamento.sql:6`);
secretaria, regulacao_regional, faturamento_rede (`20261116000001_papeis_rede_enum.sql:6-8`); nir
(`20261117000001_nir_enum.sql:6`).

Quem tem mais de um papel na unidade troca pelo menu do usuário. O papel "mais forte" é o de
`private.papel_na_unidade` (`20260926000005_fase1_papeis_ordem.sql:4-23`).

Quem entra pela escala: `PAPEIS_POR_ESCALA` (`src/lib/constants.ts:122-126`) = plantonista,
enfermeiro, tecnico_enfermagem, recepcao, telemedicina, regulador, secretaria, regulacao_regional,
faturamento_rede, nir. Fora da lista: farmacêutico e faturamento (o BACKLOG anota o faturamento
como pendência, linha 813: pela regra do RT ele também passa a ter escala). O bloqueio fora do
plantão está em `src/components/AppShell.tsx:267` e `:402-413`; a tela é
`src/components/casca/ForaDoExpediente.tsx:51-130`.

Menus (`src/components/casca/navegacao.ts`):

| Papel | Linhas | O que tem de escala hoje |
|---|---|---|
| Plantonista | 59-71 | "Minha agenda" (`/agenda`, linha 68): abas Minha escala, Escala da unidade, Todas as unidades, Vagas e Extrato (`src/pages/grupos/AgendaGrupo.tsx:11-17`). Dentro de Minha escala: passar plantão, trocar, fracionar, sair da fixa, justificar falta (`src/pages/Escala.tsx:641-770`). Cartão do turno na Central (`src/components/plantonista/central/CartaoTurno.tsx:43,73`). |
| Enfermeiro | 111-123 | Nada. |
| Técnico de enfermagem | 124-132 | Nada no menu. A tela inicial dele segue a escala de agora (`src/pages/enfermagem/InicioEnfermagem.tsx:14-19`). |
| Recepção | 135-141 | Nada. |
| Regulador | 144-147 | Nada. |
| Faturamento | 150-156 | Nada (e hoje entra sem escala). |
| Farmacêutico | 157-166 | Nada (e hoje entra sem escala). |
| Telemedicina | 167-176 | "Minha agenda" (`/telemedicina/agenda`, linha 170): os próprios plantões dos próximos 14 dias, por `tele_minha_escala` (`src/pages/telemedicina/Telemedicina.tsx:146`; função em `20261009000002_porte_telemedicina.sql`). |
| NIR | 184-188 | Nada. |
| Papéis de rede | 180-182 | Nada (escalados na unidade Secretaria). |
| Gestor | 72-108 | Escala completa (`/escala`, linha 101): Mensal com o dia ao lado (opção A, PR #253), Pedidos, Carga horária, Fixa, Presenças, Histórico (`src/pages/grupos/EscalaGrupo.tsx:16-23`). |
| Administrador | 189-196 | Escala na grade da semana. |

Todos os escalados, de qualquer papel, já veem o **próximo plantão** na tela "Fora do seu horário"
(`meu_proximo_plantao`), e o check-in vale para todos.

---

## 3. De onde vem a escala

### 3.1 Uma tabela para todos

`public.escala_plantao` (`20260815000014_fase3_escala_dedicada.sql:14-29`, mais a janela
`inicio`/`duracao_min` em `20260926000003_fase1_turno_como_janela.sql:21-75` e o fracionamento em
`20260815000028_fase3_modulos_plantonista.sql:222-224`): unidade, setor, **perfil**, data, turno,
rótulo, observação, quinzenal, ativo. **Não tem coluna de papel ou categoria.** A escala fixa
(`escala_fixa`) e as vagas (`escala_vagas`) também não têm.

Na homologação, últimos 60 dias, por papel do vínculo (as pessoas de teste têm vários papéis, então
os números se repetem entre linhas; servem para mostrar que há plantão de todas as categorias):

| Papel | Pessoas com vínculo | Escaladas | Plantões |
|---|---|---|---|
| plantonista | 13 | 13 | 296 |
| enfermeiro | 2 | 2 | 131 |
| tecnico_enfermagem | 2 | 2 | 119 |
| regulador | 2 | 2 | 89 |
| farmaceutico | 2 | 2 | 83 |
| recepcao | 2 | 2 | 83 |
| telemedicina | 1 | 1 | 71 |
| nir | 1 | 1 | 12 |

Na homologação há 46 pares "mesma pessoa, mesma unidade, dois papéis". Com a tabela sem categoria,
o plantão de quem tem dois papéis não diz em qual dos dois a pessoa está.

**Resposta à pergunta da tarefa:** não é preciso criar outra escala para a enfermagem e as outras
categorias. A escala delas já mora na mesma tabela, e o acesso (estar de plantão, check-in, tela
inicial do técnico, avisos para "enfermeiros escalados no setor") já lê dela. O que falta é: (a) a
**categoria do plantão**, (b) o **gestor conseguir escalar** essas pessoas pela tela, (c) a
**leitura** para quem não é gestor.

### 3.2 Como o gestor escala

- Calendário do mês: `escala_mes_gestor` e `private.escala_faixas`
  (`20261012000001_limites_unidade_chamados_fracionar.sql`). A faixa fica "coberta" quando
  **qualquer pessoa** está escalada no setor, de qualquer categoria.
- Lista de quem pode ser escalado: `plantonistas_da_unidade`
  (`20260926000001_fase0_endurecer_rpcs.sql`), filtra `papel = 'plantonista'`. Usada em
  `src/pages/gestor/EscalaMes.tsx:84-91` e `src/pages/Escala.tsx:249-257`.
- Gravação: `adicionar_plantao_escala` aceita qualquer pessoa com vínculo (não confere papel). A
  tela é que limita a plantonistas.

### 3.3 Defeito: "Escala da unidade" e troca do plantonista

`src/pages/Escala.tsx:219-247` e `:259-276` leem `escala_plantao` direto. A política de leitura
(`20260815000014_fase3_escala_dedicada.sql:42-48`, igual na homologação) só libera a própria linha,
o gestor e o super admin.

Prova na homologação (transação desfeita no fim), como um plantonista sem papel de gestão, no mês
corrente da unidade dele:

| | Linhas |
|---|---|
| Plantões ativos da unidade no mês | 216 |
| Visíveis para o plantonista | 24 (todos dele) |
| De colegas, visíveis para ele | 0 |

Efeitos na tela:

- "Escala da unidade": cada turno é "livre" quando a lista de ocupados vem vazia
  (`src/pages/Escala.tsx:1409-1412` e `:1507-1508`). Turnos de colegas aparecem como livres, e a
  tela oferece candidatura neles.
- Troca bilateral: a lista de "plantões de outros" (`:259-276`) vem sempre vazia, então a troca
  não tem com quem ser feita pela tela.

Não envolve paciente. É defeito de produção, mas não é crítico. Pela regra do projeto, a correção
vai em branch própria; ela entra como primeira entrega da proposta (seção 5, entrega E0), se o RT
concordar (pergunta 8).

### 3.4 Pedidos de escala no banco

| Ação | Função | Confere categoria? |
|---|---|---|
| Troca | `solicitar_troca` / `private.aplicar_troca` (`20261019000001_fix_redteam_v3_v4.sql`) | Não. Só confere mesma unidade, dono do plantão A e conflito de horário. |
| Passar plantão | `passar_plantao` (mesma migration) | Não. Destino só precisa de vínculo ativo na unidade. |
| Sair da fixa, justificar falta | `insert` em `solicitacoes_escala` (`src/pages/Escala.tsx:646`, `:687`) | Não. |
| Candidatura a vaga | `candidatar_vaga` | Sim: só plantonista. |
| Vaga aberta pela geração do mês | `gerar_escala_mensal_detalhada` | Avisa só plantonistas. |
| Extrato e remuneração | `gerar_extrato_plantonista`, `remuneracoes_plantao` | Só plantonista, gestor e admin. |

Com aprovação do gestor ligada (padrão seguro desde 01/10/2026), uma troca errada ainda passaria
pelo gestor. Mesmo assim, abrir trocas para todos exige a trava de categoria no banco.

### 3.5 Outros pontos que leem a escala sem olhar categoria

- `private.escala_faixas` (calendário do gestor): "coberto" se há qualquer pessoa. Com a
  enfermagem escalada pela tela, um setor só com técnico apareceria "coberto" para médico.
- `vagas_abertas`: a vaga deixa de aparecer se há qualquer pessoa no setor e horário.
- Envio ao ERP (`20270120000002_erp_plantoes.sql`, `plantao_erp_valor`): lê todos os plantões. Um
  plantão de enfermagem iria ao ERP com o valor do plantão do setor. Precisa da categoria antes de
  a enfermagem ser escalada pela tela.
- `private.escalados_agora(p_unidade, p_setor, p_papel)` já filtra pelo papel do vínculo (é o que
  os avisos usam); funciona enquanto a pessoa tem um só papel escalável.

---

## 4. O que cada papel deve ver (proposta)

Princípio: escala é dado de trabalho, não de paciente. **Nenhum dado de paciente entra na aba.**
Dos colegas, só nome, categoria, setor e horário: sem e-mail, telefone ou CPF.

| Papel | Própria escala | Equipe | Pedidos (troca, passagem, falta) |
|---|---|---|---|
| Plantonista | já tem (Minha agenda) | já tem "Escala da unidade" (com o defeito da 3.3) | já tem |
| Enfermeiro, técnico | sim | colegas do mesmo setor e turno dos meus plantões (proposta) | troca e passagem só dentro da mesma categoria |
| Recepção, regulador, NIR, telemedicina | sim | idem | idem |
| Farmacêutico, faturamento | sim, se o RT confirmar que entram pela escala | idem | idem |
| Papéis de rede | sim, na unidade Secretaria | idem | idem |
| Gestor, administrador | fora do pedido (já têm a Escala do gestor) | | |

Vagas, candidatura e extrato continuam só do plantonista nesta etapa (pergunta 5).

---

## 5. Proposta de banco, RPC e frontend

Tudo por RPC (o app é RPC-only para dado novo), `SECURITY DEFINER`, `search_path = ''`, escopo por
unidade e papel. **A RLS da tabela não é aberta**: a leitura de colegas sai só pela RPC, com as
colunas que a RPC escolhe.

### Banco (expand/contract, idempotente, com rollback)

1. `escala_plantao.papel public.papel NULL` (expand). Preenchimento: o único papel escalável da
   pessoa na unidade; quem tem mais de um fica `NULL` e aparece para o gestor resolver. Gatilho
   preenche na gravação quando a pessoa tem um só papel escalável. Mesma coluna em `escala_fixa` e
   `escala_vagas`. Contrato (`NOT NULL`) só depois, com janela declarada.
2. Trava de categoria em `aplicar_troca` e `passar_plantao`: os dois lados com o mesmo papel.
3. `escala_faixas`, `vagas_abertas` e o envio ao ERP passam a olhar a categoria (o ERP só leva
   plantão médico, salvo decisão contrária do RT).

Rollback: retirar gatilho e coluna nova (sem uso por código antigo); funções voltam à versão
anterior, guardada na própria migration de rollback.

### RPC

- `minha_escala(p_de date, p_ate date)`: meus plantões em todas as unidades (setor, turno, janela,
  check-in, pedido pendente). Funciona **fora do plantão**. Generaliza `tele_minha_escala`, que
  passa a chamá-la.
- `equipe_do_plantao(p_escala uuid)`: quem está comigo no mesmo setor e janela (nome e categoria).
  Só para o dono do plantão.
- `escala_da_unidade(p_unidade, p_de, p_ate, p_papel)`: para o plantonista (corrige a 3.3) e, se o
  RT quiser, para as outras categorias ("escala da minha categoria").
- `profissionais_da_unidade(p_unidade, p_papel)`: lista do gestor por categoria; substitui
  `plantonistas_da_unidade` na tela (a antiga fica para o app antigo).
- Testes em `supabase/tests/` no padrão dos outros: cada papel vê só o que deve; papel sem vínculo
  recebe "Acesso negado"; troca entre categorias recusada.

### Frontend

- Componente de leitura reaproveitando o calendário da Escala do gestor (opção A, "mês com o dia
  ao lado", `src/pages/gestor/EscalaMes.tsx`) em modo só leitura: à esquerda o mês com os meus
  plantões, à direita o dia escolhido com setor, horário, equipe e as ações permitidas.
- Item "Escala" no menu de cada papel da tabela da seção 4.
- **Fora do plantão:** a casca (`AppShell.tsx:402-413`) passa a deixar abrir só a aba Escala para
  quem entra pela escala, ou a tela "Fora do seu horário" ganha o mês inteiro em vez de só o próximo
  plantão (pergunta 3).
- Gestor: seletor de categoria ao escalar e cobertura por categoria no calendário.
- Plantonista: a "Minha agenda" fica como está; só troca a fonte de dados das abas Escala da
  unidade e Minha escala para as RPCs novas. **O menu do plantonista não muda** (combinar com a
  sessão plantonista-revisao se mudar).

### Ordem sugerida (cada uma em branch e PR próprios, homologação antes)

| Entrega | O quê | Depende de |
|---|---|---|
| E0 | Corrigir a "Escala da unidade" e a troca do plantonista (3.3) por RPC | nada |
| E1 | Categoria do plantão (coluna, preenchimento, gatilho) e travas de troca/passagem | nada |
| E2 | Gestor escala todas as categorias (seletor, cobertura por categoria, ERP só médico) | E1 |
| E3 | Aba Escala de leitura para os outros papéis, inclusive fora do plantão | E1; útil só depois de E2 |
| E4 | Pedidos (troca, passagem, falta) para os outros papéis | E1, E3 |

Toda opção visual da E2 e da E3 nasce de telas reais do Refero, mostradas ao RT antes de aplicar.

---

## 6. Riscos

- **Categoria de quem tem dois papéis.** O preenchimento automático não decide sozinho; plantões
  sem categoria precisam de revisão do gestor. Medir na homologação e, com autorização, na produção.
- **Calendário do gestor muda de sentido.** "Coberto" passa a ser por categoria. Muda uma tela em
  produção desde 27/10; precisa de opção visual aprovada.
- **ERP.** Se a enfermagem for escalada pela tela antes de o ERP filtrar a categoria, o envio do mês
  leva plantões de enfermagem como plantão médico. Por isso a E2 inclui o ERP.
- **LGPD.** Mostrar colegas é dado pessoal de trabalho. A RPC devolve só nome, categoria, setor e
  horário, e só da unidade onde a pessoa tem vínculo.
- **Abrir o app fora do plantão.** Hoje nada abre fora do plantão. Abrir só a aba Escala exige que
  a casca deixe passar essa rota e nenhuma outra; o servidor continua barrando dado clínico pela
  escala, como hoje.
- **Sessões em paralelo.** `Escala.tsx` e `EscalaMes.tsx` são da revisão visual 3.9 (concluída). O
  menu do plantonista é da plantonista-revisao: a proposta não mexe nele.

---

## 7. Perguntas ao RT

1. **Backlog.** O pedido entra no `BACKLOG.md`? Com que prioridade (P0, P1, P2) e em que fase?
2. **O que cada um vê.** (a) só a própria escala; (b) a própria e quem está comigo no mesmo setor e
   turno; (c) a própria e a escala da unidade inteira da minha categoria; (d) a unidade inteira, de
   todas as categorias. Sugestão: (b), e o plantonista segue com a "Escala da unidade" que já tem.
3. **Fora do plantão.** A aba Escala abre fora do plantão (só ela, nada clínico), ou a tela "Fora do
   seu horário" passa a mostrar o mês inteiro? Sugestão: abrir só a aba Escala.
4. **Trocas, passagens e faltas para todos?** Sugestão: sim, só dentro da mesma categoria
   (enfermeiro com enfermeiro, técnico com técnico), sempre com aprovação do gestor.
5. **Vagas e candidatura para todos?** Hoje só o plantonista se candidata. Sugestão: não nesta
   etapa.
6. **Categoria do plantão.** De acordo em gravar a categoria em cada plantão? E quem tem dois papéis
   na mesma unidade (ex.: enfermeiro que também é NIR) é escalado escolhendo a categoria?
7. **Farmacêutico e faturamento.** Pela regra "todo mundo tem escala, menos administrador e
   gestor", eles passam a entrar pela escala (bloqueio fora do plantão) ou só ganham a aba para
   consulta?
8. **Defeito do plantonista (3.3).** Corrigir primeiro, em branch própria (E0), mesmo antes do resto?
9. **Produção.** Autoriza uma consulta só de leitura, sem nomes (contagem de plantões por categoria
   e de pessoas com dois papéis), para medir o preenchimento da categoria?
10. **Telemedicina.** A "Minha agenda" dela vira a aba Escala comum, ou fica como está?

---

## 8. Decisões do RT (27/10/2026)

| # | Pergunta | Resposta do RT | O que muda na proposta |
|---|---|---|---|
| 1 | Backlog | Sim, agora | Entra no `BACKLOG.md` como trilha própria, executada já, na ordem E0 → E4 |
| 2 | O que cada um vê | A própria escala e a escala da equipe inteira da sua categoria (farmacêutico vê os farmacêuticos, enfermeiro os enfermeiros, e assim por diante) | Opção (c). `escala_da_unidade` devolve só a categoria de quem chama, decidida no servidor (o app não escolhe a categoria). Quem tem dois papéis na unidade vê as duas categorias |
| 3 | Fora do plantão | Sim, a aba Escala abre | A casca deixa passar só a rota da Escala para quem está fora do plantão; nada clínico |
| 4 | Trocas, passagens e faltas | Para todos, só dentro da mesma categoria | Trava de categoria no banco (E1) e telas para todos (E4) |
| 5 | Vagas e candidatura | Para todas as categorias, menos administrador e gestor | **Muda a sugestão.** A vaga ganha categoria (E1) e `candidatar_vaga` passa a aceitar quem tem o papel da vaga (E4) |
| 6 | Categoria do plantão | Sim; quem tem dois papéis é escalado escolhendo a categoria | Coluna `papel` em `escala_plantao`, `escala_fixa` e `escala_vagas` (E1); seletor de categoria na tela do gestor (E2) |
| 7 | Farmacêutico e faturamento | Passam a entrar pela escala | `farmaceutico` e `faturamento` entram em `PAPEIS_POR_ESCALA` (E3). Só liga depois que o gestor conseguir escalá-los pela tela (E2), senão eles perdem o acesso |
| 8 | Defeito do plantonista | Corrigir primeiro | E0 começa já, em branch própria |
| 9 | Consulta à produção | Autorizada, só leitura e sem nomes | Feita; resultado abaixo |
| 10 | Agenda da telemedicina | Vira a aba Escala comum | Na E3, `/telemedicina/agenda` dá lugar à aba Escala; `tele_minha_escala` passa a chamar `minha_escala` |

### Produção (consulta só de leitura, sem nomes, 27/10/2026)

- `escala_plantao` ativa: 701 plantões. 700 são de uma pessoa **sem vínculo ativo** (15/08 a
  30/09/2026, dados do início do projeto); 1 é do super admin de teste, que tem vínculo com todos os
  papéis.
- Vínculos ativos: um por papel (admin, gestor, plantonista, enfermeiro, técnico, recepção,
  telemedicina, farmacêutico), todos da mesma pessoa de teste. Uma pessoa com mais de um papel
  escalável na mesma unidade.
- Conclusão: **a produção ainda não tem escala real.** O preenchimento da categoria (E1) não tem
  risco de errar plantão de ninguém. Os 700 plantões sem vínculo ficam com categoria vazia; a decisão
  de apagá-los ou não é do RT, fora desta trilha.

### E0 — como fica com a resposta 2

Antes da E1 não há coluna de categoria. Na E0, `escala_da_unidade` considera "plantonista" quem tem
vínculo ativo de plantonista na unidade. Na E1, o filtro passa a ser a coluna `papel` do plantão,
sem mudar a assinatura da função nem a tela.

Toda opção visual da E2 e da E3 continua nascendo de telas reais do Refero, mostradas ao RT antes de
aplicar. A E0 não muda a tela: só a fonte dos dados.
