# VD15 — Menores da revisão do lote

Lote "Virada de data" do `BACKLOG.md`. Prioridade: **P3**. São os achados menores da revisão do lote. O RT mandou seguir em 01/11/2026 ("Sim, VD15").

O banco roda em UTC. Das 21h às 24h de Brasília, o dia UTC já é amanhã. Na tela, o dia sai do relógio e do fuso do aparelho, e não do de Brasília.

## Diagnóstico e correção

### Banco: migration `20270209000011_menores_revisao.sql`

1. **`private.implantacao_verificar`:** o item que pede atendimentos depois do D0 contava as chegadas a partir de `d0::timestamptz`, meia-noite UTC. Isso inclui as chegadas das 21h às 24h da véspera. Passa a contar da meia-noite de Brasília do D0.
2. **`painel_organizacao`:** a média de ocupação do censo usava `(now() - p_dias)::date`, o dia UTC. Passa a `private.data_atual() - v_dias`. As outras janelas do painel (chegadas, encerrados, expediente) são de horas corridas e não mudam.
3. **`hermes_minhas_notificacoes`:** mesma troca na janela de `p_dias`.
4. **`gerar_notificacoes_turno`, aviso de 6 h de observação:**
   - O aviso é gravado por (perfil, unidade, dia, tipo). Quando a janela de 15 min do aviso passa da meia-noite, uma chamada antes e outra depois gravam o mesmo aviso em dois dias, e o aviso já lido volta como novo.
   - Agora o aviso não é gravado de novo se o mesmo tipo já foi gravado na última hora.
   - Depois da meia-noite, a lista continua mostrando o aviso de observação da última hora, para ele não sumir antes de ser lido.

As trocas são feitas na definição atual de cada função, como em `20270209000003`, sempre em linha única. As trocas da mesma função vão juntas num só `CREATE OR REPLACE`: uma troca sozinha pode deixar o corpo inválido. A primeira versão da migration falhou na homologação exatamente por isso, e nada foi gravado. Mesma assinatura, dono e grants. É idempotente.

### Tela

- **`src/lib/exportacao.ts`:** o nome do arquivo de uma exportação sem período (leitos) usava a data UTC de `geradoEm`. Passa a `dataIso(geradoEm)`.
- **Telas que usavam o relógio do aparelho para saber o dia de hoje**, que passam a `dataIso()`:
  - `Extrato.tsx`: o mês padrão; o primeiro e o último dia saíam de `toISOString()` sobre a meia-noite local;
  - `Escala.tsx`: `hojeISO`;
  - `MinhaAgenda.tsx`: o mês padrão;
  - `EnvioErp.tsx`: a competência atual;
  - `rascunho.ts`: `hojeLocal`;
  - `EncaminhamentosRecebidos.tsx`: a idade.
- **`curvas.ts`:** a idade na aferição e o par peso + estatura do IMC usavam o dia do aparelho. Passam ao dia de Brasília.
- **`Alta.tsx`:** o campo data e hora da alta abria com a hora do aparelho e era lido como hora do aparelho. Passa a abrir com `dataHoraInput()` e a ser lido como hora de Brasília (`-03:00`, como em `retroativo.ts`).

Num aparelho em Brasília, nada muda na tela. A diferença aparece num aparelho com o fuso errado ou fora do Brasil.

### Verificados, sem correção

- **Crítica de idade da AIH (`private.criticas_aih`):** usa a idade de hoje. Todos os caminhos que a chamam rodam no dia do laudo: o gatilho da emissão do laudo (`aih_do_laudo`), a conferência ao editar (`conferir_aih`) e a APAC (`criticas_apac`). Hoje é, portanto, o dia do laudo. A crítica por lançamento já usa a data do lançamento desde o VD10. Fica a diferença quando o laudo sai em outro dia que não o da internação e o paciente faz aniversário no meio.
- **Observações da revisão que não são código:**
  - na primeira geração depois do VD6, o quinzenal pode pular ou repetir uma semana entre um mês gerado antes e outro depois: avisar o gestor;
  - no gráfico da evolução, a aferição do dia da admissão anterior à hora da admissão sai como "D+1", e não "Adm": falta o RT confirmar;
  - `hermes/dist` no VPS tem de ser um build novo, para o Hermes pegar o VD11.

## Rollback

As mesmas trocas invertidas, na ordem inversa, com o helper da migration. Testado na homologação:

```sql
CREATE OR REPLACE FUNCTION pg_temp.vd15_trocar(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    IF position(p_pares[k + 1] IN novo) > 0 AND position(p_pares[k] IN novo) = 0 THEN CONTINUE; END IF;
    IF position(p_pares[k] IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, p_pares[k];
    END IF;
    novo := replace(novo, p_pares[k], p_pares[k + 1]);
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

SELECT pg_temp.vd15_trocar('public.gerar_notificacoes_turno(uuid)',
  'AND (n.data = private.data_atual() OR (n.tipo LIKE ''obs\_%'' AND n.created_at > now() - interval ''1 hour''))',
  'AND n.data = private.data_atual()',
  '''Paciente '' || v_pac.nome || '' completa 6h de observação em 15 minutos. Internar ou liberar.'' WHERE NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista n0 WHERE n0.perfil_id = auth.uid() AND n0.unidade_id = p_unidade AND n0.tipo = ''obs_15min_'' || v_pac.paciente_id AND n0.created_at > now() - interval ''1 hour'')',
  '''Paciente '' || v_pac.nome || '' completa 6h de observação em 15 minutos. Internar ou liberar.'')',
  'SELECT auth.uid(), p_unidade, private.data_atual(), ''obs_15min_'' || v_pac.paciente_id,',
  'VALUES (auth.uid(), p_unidade, private.data_atual(), ''obs_15min_'' || v_pac.paciente_id,',
  '''Paciente '' || v_pac.nome || '' completa 6h de observação em 30 minutos. Internar ou liberar.'' WHERE NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista n0 WHERE n0.perfil_id = auth.uid() AND n0.unidade_id = p_unidade AND n0.tipo = ''obs_30min_'' || v_pac.paciente_id AND n0.created_at > now() - interval ''1 hour'')',
  '''Paciente '' || v_pac.nome || '' completa 6h de observação em 30 minutos. Internar ou liberar.'')',
  'SELECT auth.uid(), p_unidade, private.data_atual(), ''obs_30min_'' || v_pac.paciente_id,',
  'VALUES (auth.uid(), p_unidade, private.data_atual(), ''obs_30min_'' || v_pac.paciente_id,');
SELECT pg_temp.vd15_trocar('public.hermes_minhas_notificacoes(uuid, uuid, integer)',
  'n.data >= private.data_atual() - p_dias',
  'n.data >= (now() - make_interval(days => p_dias))::date');
SELECT pg_temp.vd15_trocar('public.painel_organizacao(integer)',
  'co.data > private.data_atual() - v_dias',
  'co.data > (now() - make_interval(days => v_dias))::date');
SELECT pg_temp.vd15_trocar('private.implantacao_verificar(text, public.implantacoes)',
  'e.chegada_em >= (i.d0::timestamp AT TIME ZONE ''America/Sao_Paulo'')',
  'e.chegada_em >= i.d0::timestamptz');
DROP FUNCTION pg_temp.vd15_trocar(regprocedure, text[]);
```

As telas voltam com o `git revert` do commit.

## Testes

- **`supabase/tests/vd15_menores_revisao.sql`** cria o próprio cenário, sem o seed, e roda também na homologação:
  1. **Definição:** `implantacao_verificar` e `painel_organizacao` são conferidas pela definição, porque o cenário de cada uma depende do seed.
  2. **Notificações do Hermes:** com `private.data_atual()` fixada em 10/05/2031, a janela de 7 dias traz o aviso de 03/05 e não o de 02/05.
  3. **Aviso de 6 h:** enfermeira de plantão na observação, com check-in, e paciente há 5h35 em observação. Uma chamada grava o aviso de 30 min. Com o dia de Brasília trocado para amanhã, outra chamada não grava de novo, e a lista ainda traz o aviso.
- **`src/lib/vd15Datas.test.ts`**, com o aparelho em Tóquio (UTC+9):
  - nome do arquivo da exportação;
  - `hojeLocal`;
  - IMC com peso das 8h e estatura das 22h do mesmo dia;
  - idade na aferição das 22h;
  - telas sem `new Date()` para o dia de hoje.

- **`supabase/tests/fase3_implantacao.sql`:** abria a implantação com `D0 = current_date`, o dia UTC, e contava os prazos e a escala da primeira semana a partir dele. Com a correção, o CI das 22h05 de Brasília falhou no V04: o D0 era 02/11 e o atendimento das 22h05 de 01/11 ficou antes dele. O teste antigo só passava porque o D0 e a contagem erravam o dia juntos. As datas do teste passam ao dia de Brasília.

Evidência:
- **Sem a correção, falha:**
  - no banco, cada seção falha sozinha na homologação: a definição antiga; o aviso de 02/05 veio junto; o aviso de 30 min foi gravado de novo depois da meia-noite;
  - na tela, 5 dos 6 testes falham; o que passa é o que confere o fuso do aparelho do teste.
- **Com a correção, passa:**
  - o teste do banco passa;
  - na tela, 6 de 6;
  - `src/lib` passa inteiro (227) e os testes clínicos também (1105);
  - sem erro de tipos e de lint.
- **Rollback testado na homologação:**
  - a migration aplicada duas vezes não deu erro;
  - depois do rollback, o md5, o ACL e o dono das quatro funções voltaram aos de antes, e o teste voltou a falhar.

As telas não foram abertas no navegador, porque ficam atrás do login. A mudança é o valor inicial do dia ou do mês.

## Homologação

Aplicada pelo SQL em 01/11/2026, com a versão `20270209000011` registrada. md5 depois:
- `gerar_notificacoes_turno`: `ed96e25a…`;
- `painel_organizacao`: `ae2f95d6…`;
- `hermes_minhas_notificacoes`: `430eaf72…`;
- `implantacao_verificar`: `620486c2…`.

## Produção

Migration `20270209000011` aplicada na produção (`saqjrjtrkzkswsxxvdxn`) em 01/11/2026, com o "ok produção" do RT e depois do CI verde. Conferido depois de aplicar:
- versão registrada;
- md5 das quatro funções iguais aos da homologação;
- ACL e dono iguais.

PR #407 mesclado em seguida. Concluído.

## Riscos

- O aviso de 6 h de um paciente que recebe alta e volta à observação em menos de 1 hora não é repetido. O tipo do aviso é por paciente, e a janela de 6 h já conta do cadastro do paciente.
- Quem usa o app com o aparelho fora do fuso de Brasília passa a ver o dia de Brasília nas telas citadas. É o que o resto do app já faz.
