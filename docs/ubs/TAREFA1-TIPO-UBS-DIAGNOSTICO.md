# 5A, tarefa 1: tipo de unidade UBS real

Fase 5A, UBS Mínima, do `BACKLOG.md`. Prioridade: **P1**. Começada pelo RT em 02/11/2026 ("Começar a 5A"), com a 5C parada só pela credencial da RNDS.

Aceite do backlog: "UBS pode ser cadastrada e operar sem inconsistência".

**Decisões do RT em 02/11/2026: opção A em D1 a D5 ("Sim, todas A").** A implementação segue em PR próprio.

## 1. Diagnóstico do estado atual

### O que existe

- **Tipo da unidade:** é o enum `public.tipo_unidade`, com `hospital`, `upa` e `clinica`, criado em `20260815000001`. Usam o enum a coluna `unidades.tipo` e a view `vw_censo_unidade.unidade_tipo`.
- **Unidades hoje:**

  | Ambiente | hospital | upa | clinica |
  |---|---|---|---|
  | Homologação | 11 | 8 | 0 |
  | Produção | 1 | 2 | 0 |

  `clinica` nunca foi usado.
- **O tipo é só um rótulo:**
  - Nenhuma RPC muda de comportamento pelo tipo.
  - O menu (`src/components/casca/navegacao.ts`) é montado só pelo papel da pessoa.
  - O tipo aparece em três lugares: em Configuração (só leitura), na lista de unidades de Pessoas (`TIPO_UNIDADE_LABEL`) e no censo.
- **Implantação:** tem o próprio tipo, em texto (`upa`, `ps`, `hospital`), separado do enum. `implantacao_abrir` recusa qualquer outro valor. O catálogo de itens só cobre porta, observação e internação.
- **Setores:** o enum `tipo_setor` tem `emergencia`, `observacao`, `internacao`, `isolamento`, `uti` e `outro`. Não há consultório, acolhimento nem sala de vacina.

### O que falta

- **O valor `ubs`** no enum.
- **Um cadastro de unidade:**
  - Não há tela nem RPC para criar unidade.
  - Toda unidade nasceu de SQL nosso: seed, script de teste e o cadastro da UPA Centro.
  - A RLS permite o INSERT direto para o super admin e o admin da organização, mas nenhuma tela usa.
- **Um menu que respeite o tipo:** numa UBS, os papéis de hoje veriam porta, triagem, leitos, internação, observação, AIH e NIR, que uma UBS não tem. As telas abririam vazias. É essa a "inconsistência" do aceite.

### O que está errado (achado deste diagnóstico)

- **O gestor altera qualquer coluna da própria unidade:**
  - A policy `unidades_update_gestor` confere só se a pessoa é gestor da unidade.
  - O `authenticated` tem UPDATE em todas as colunas.
  - Com isso, o gestor consegue mudar pela API direta o `tipo`, o `nome`, o `ativo` e até o `organizacao_id`, levando a unidade para outra organização.
  - A tela de Configuração só grava canal, WhatsApp, coordenadas e raio. O CNES já tem RPC própria (`definir_cnes_unidade`).
  - Com o tipo passando a mudar o menu, a falha fica maior. Proposta: fechar nesta tarefa (D4).

## 2. Subtarefas técnicas

| # | Subtarefa | Depende de |
|---|---|---|
| 1 | Valor `ubs` no enum (migration própria, sem uso no mesmo arquivo) | D1 |
| 2 | RPC de cadastro e de edição da identificação da unidade | D2 |
| 3 | Gestor sem UPDATE direto em tipo, nome, ativo e organização | D4 |
| 4 | Rótulo "UBS" em `TIPO_UNIDADE_LABEL`, nos tipos gerados e em Configuração | 1 |
| 5 | Menu por tipo de unidade: numa UBS, somem os itens de porta, leito e hospital | D3 |
| 6 | Tela de cadastro de unidade no Admin (opções pelo Refero antes) | D2 |
| 7 | Testes de banco e de tela; homologação; produção com o "ok" do RT | todas |

## 3. Banco (expand/contract e rollback)

1. **`20270210000001_tipo_unidade_ubs.sql`:** `ALTER TYPE public.tipo_unidade ADD VALUE IF NOT EXISTS 'ubs';`.
   - Fica sozinha no arquivo: o valor novo só pode ser usado depois do commit.
   - É expansão pura.
   - **Rollback:** o Postgres não remove valor de enum sem recriar o tipo, e recriar seria `ALTER TYPE` destrutivo, proibido sem janela. O rollback escrito, portanto, é:
     - deixar o valor sem uso;
     - travar o uso com `CHECK (tipo <> 'ubs')` em `unidades`;
     - documentar o uso.
     - Testado na homologação.
2. **`20270210000002_unidade_cadastro.sql`:**
   - RPCs `admin_criar_unidade` e `admin_editar_unidade`;
   - REVOKE do UPDATE de `tipo`, `nome`, `ativo` e `organizacao_id` para o `authenticated`, e GRANT só das colunas que a Configuração grava (D4);
   - rollback: DROP das duas RPCs e o GRANT de volta.

Sem tabela nova, sem DROP e sem RENAME.

## 4. Backend e RPC

| RPC | Assinatura | Permissão | Estados | Auditoria | Chamada repetida |
|---|---|---|---|---|---|
| `admin_criar_unidade` | `(p_organizacao uuid, p_nome text, p_tipo tipo_unidade, p_cnes text, p_municipio text, p_uf text) returns uuid` | super admin ou admin da organização, com 2º fator (`private.exigir_segundo_fator`) | cria a unidade ativa | `unidade_criada` na hash-chain, com tipo e organização | mesmo nome na mesma organização: erro claro, sem duplicar |
| `admin_editar_unidade` | `(p_unidade uuid, p_nome text, p_tipo tipo_unidade, p_ativo boolean) returns void` | os mesmos | troca de tipo só sem atendimento aberto e sem leito ocupado | `unidade_editada`, com o valor anterior e o novo | sem mudança: não grava evento |

O CNES continua em `definir_cnes_unidade`. O município e a UF entram na criação e passam a ser editáveis só pela RPC.

## 5. Frontend

- `TIPO_UNIDADE_LABEL`, com "UBS"; `database.ts` regenerado.
- `navegacao.ts`: `itensDeNavegacao` recebe o tipo da unidade. Numa UBS saem:
  - para o gestor: Porta, Intercorrências, Internação, Observação, NIR, AIH e APAC;
  - para o enfermeiro: Triagem, Pronto-Socorro e Internação;
  - para o técnico de enfermagem: Pronto-Socorro e Internação;
  - para a recepção: Fila da triagem e Painel de chamada;
  - para o plantonista: Central do Plantonista, Plantão e Contingência da porta;
  - para o regulador e o NIR: todos os itens.

  A lista final sai da D3. O que a UBS ganha, como atendimento, agenda e CIAP-2, vem nas tarefas 2 a 4.
- Admin: tela "Unidades", com a lista e o botão "Nova unidade" (nome, tipo, CNES, município e UF). As opções de layout saem do Refero antes.
- Configuração: mostra "UBS" e continua só leitura no tipo.

## 6. Permissões e auditoria

- **RLS de `unidades`:** sem mudança nas policies. A trava é a do GRANT por coluna (D4), e a escrita de identificação passa às RPCs.
- **Testes de banco:**
  - o gestor não muda `tipo` nem `organizacao_id` pela API, e recebe erro de permissão;
  - o admin de outra organização não cria unidade na organização alheia;
  - os eventos `unidade_criada` e `unidade_editada` entram na cadeia, e a verificação da cadeia passa.

## 7. Testes

- **`supabase/tests/5a_tipo_ubs.sql`:**
  - cria uma UBS pela RPC;
  - a criação repetida dá erro sem duplicar;
  - a troca de tipo com atendimento aberto é recusada;
  - o gestor sem UPDATE direto;
  - os eventos de auditoria.
- **`src/components/casca/navegacao.test.ts`:** o menu numa UBS, para cada papel, sem os itens da lista da D3; numa UPA, o menu sem mudança.
- **Regressão:** `src/lib`, os testes clínicos, os tipos e o lint.

## 8. Critérios de aceite

| Critério do backlog | Evidência |
|---|---|
| UBS pode ser cadastrada | teste do banco: criação pela RPC; na homologação, UBS de teste criada pela tela do Admin |
| Opera sem inconsistência | teste do menu por papel numa UBS; na homologação, login como gestor e enfermeiro da UBS de teste sem item de porta ou leito |
| Ajustar permissões | teste: gestor sem UPDATE de tipo e organização; admin de outra organização recusado |

## 9. Riscos

- O valor do enum não sai sem recriar o tipo, por isso a decisão da D1 é definitiva.
- **Telas abertas por endereço direto numa UBS** (por exemplo, `/internacao`) continuam abrindo vazias, porque o banco não traz dados. A trava por rota fica para quando a UBS tiver telas próprias.
- **O REVOKE da D4 pode quebrar algum script ou tela que grave direto o nome ou o tipo.** Hoje nenhum grava, conforme a busca no `src/`. Os scripts de teste usam o `postgres` e não são afetados.
- **A implantação de uma UBS fica fora (D5).** `implantacao_abrir` segue recusando o tipo até existir o checklist da atenção primária.

## 10. Ordem de implementação

1. As decisões D1 a D5 do RT.
2. As migrations 1 e 2, com os testes, na homologação e com o rollback testado.
3. O menu por tipo e o rótulo, com os testes.
4. As opções da tela do Admin pelo Refero, a escolha do RT e a tela.
5. O PR, a homologação e o "ok produção" das migrations.

## 11. Demonstração comercial

Cadastrar ao vivo uma UBS na rede da secretaria e entrar como gestor dela. O sistema mostra só o que cabe numa UBS, sem porta nem leito. Esse é o primeiro passo para a secretaria ter UPA, hospital e UBS no mesmo sistema, que é o argumento contra os sistemas que só cobrem a atenção primária ou só o hospital.

## Implementação (02/11/2026)

### Banco

- **`20270210000001_tipo_unidade_ubs.sql`:** o valor `ubs` no enum.
- **`20270210000002_unidade_cadastro.sql`:**
  - `admin_criar_unidade` e `admin_editar_unidade`, como na seção 4;
  - o `authenticated` perde o INSERT e o UPDATE da tabela e fica só com o UPDATE de `canal_comunicacao`, `whatsapp_numero`, `latitude`, `longitude`, `raio_metros` e `updated_at`.
- **Diferenças do diagnóstico:**
  - Também sai o INSERT direto. A criação passa só pela RPC, com auditoria. Nenhuma tela inseria unidade.
  - A auditoria guarda o nome, o tipo, o tipo anterior, a situação e a lista dos campos alterados. O filtro `private.payload_auditoria` não deixa passar o município nem a UF.

### Tela

- **`navegacao.ts`:** `itensDeNavegacao` recebe o tipo da unidade. Numa UBS saem as rotas da lista da D3, mais `/enfermagem`, a entrada da enfermagem que leva ao Pronto-Socorro ou à Internação.
- **Itens que ficam:** o NIR fica com Regulação, Avisos e Escala. A Regulação continua no gestor, porque o encaminhamento da UBS (tarefa 5) passa por ela.
- **Tela inicial:** `inicioDoPapel`, as abas estreitas do plantonista e o `RedirectHome` seguem o tipo. Numa UBS, a tela inicial de porta ou de leito dá lugar ao primeiro item do menu.
- **Avisos:** a tela de Avisos usa o mesmo menu.
- **Rótulo:** "UBS" em `TIPO_UNIDADE_LABEL`. Os tipos de `database.ts` ganham o valor e as duas RPCs.
- **Ainda falta:** a tela "Unidades" do Admin (D2). Ela entra num passo próprio, com as opções do Refero antes.

### Evidências

- **Homologação:**
  - as duas migrations foram aplicadas duas vezes, sem erro, e as versões estão registradas;
  - antes delas, o teste `supabase/tests/5a_tipo_ubs.sql` falhava (a RPC não existia);
  - depois, ele passa inteiro.
- **Rollback testado na homologação:**
  - as duas RPCs foram removidas, o GRANT voltou e o `CHECK (tipo <> 'ubs')` entrou;
  - os grants por coluna voltaram ao md5 de antes (`32b8437c…`);
  - o teste voltou a falhar;
  - depois, o CHECK foi retirado e a migration reaplicada. O estado ficou igual ao de depois: grants `DELETE,SELECT` na tabela e md5 `28bba808…` nas colunas.
- **Tela:**
  - `src/lib/menuUbs.test.ts` passa 5 de 5 e falha sem a correção;
  - `src/lib` passa inteiro (232), e os testes clínicos também (1105);
  - sem erro de tipos e de lint.
- **Navegador:** não abri o menu, porque as telas ficam atrás do login. O teste cobre o menu de cada papel.

### Produção

As migrations `20270210000001` e `20270210000002` foram aplicadas na produção (`saqjrjtrkzkswsxxvdxn`) em 02/11/2026, com o "ok produção" do RT e depois do CI verde. Conferido depois de aplicar:
- as duas versões estão registradas;
- o enum tem `ubs`;
- a tabela tem os grants `DELETE,SELECT` e as colunas o md5 `28bba808…`, os mesmos da homologação;
- o md5, o ACL e o dono das duas RPCs são iguais aos da homologação.

O PR #409 foi mesclado em seguida. Falta a tela "Unidades" do Admin.

## Decisões do RT

| # | Pergunta | Opções | Recomendação |
|---|---|---|---|
| D1 | Como entra o tipo UBS | **A)** valor `ubs` no enum atual. **B)** trocar o enum por texto com CHECK, o que exige `ALTER TYPE` destrutivo e janela | A |
| D2 | Como se cadastra uma unidade | **A)** RPC mais tela "Unidades" no Admin, para o super admin e o admin da organização. **B)** só a RPC, chamada por nós, sem tela | A |
| D3 | O menu numa UBS | **A)** somem os itens de porta, leito e hospital, conforme a lista da seção 5. **B)** o menu não muda até a tarefa 2 | A |
| D4 | Gestor muda tipo, nome, ativo e organização pela API direta | **A)** fechar nesta tarefa, com GRANT por coluna e escrita pelas RPCs. **B)** registrar como achado e fazer depois | A |
| D5 | Implantação de UBS | **A)** fora desta tarefa; o checklist da atenção primária entra depois da tarefa 2. **B)** aceitar `ubs` agora com os itens genéricos | A |

Fica registrado para a 5A, e não para esta tarefa: o e-SUS APS veio da 5C para a 5A (decisão do RT em 28/10/2026). A produção de uma UBS segue para o SISAB pelo e-SUS APS, e não pelo BPA. Por isso a proposta da D3 também tira AIH e APAC. O BPA fica até a decisão do e-SUS APS.
