-- ════════════════════════════════════════════════════════════════════════════
-- VD15 do lote "Virada de data" (BACKLOG.md, RT em 01/11/2026, P3): menores
-- da revisão do lote.
--
-- O banco roda em UTC; das 21h às 24h de Brasília o dia UTC já é amanhã.
-- 1. private.implantacao_verificar: as chegadas depois do D0 contavam de
--    d0::timestamptz, meia-noite UTC (21h da véspera em Brasília). Passa a
--    contar da meia-noite de Brasília do D0.
-- 2. painel_organizacao: a média do censo usava (now() - p_dias)::date, o dia
--    UTC. Passa a private.data_atual() - p_dias. As outras janelas do painel
--    são de horas corridas e não mudam.
-- 3. hermes_minhas_notificacoes: mesma troca na janela de p_dias.
-- 4. gerar_notificacoes_turno: o aviso de 6 h de observação é gravado por
--    (perfil, unidade, data, tipo). Quando a janela de 15 min do aviso passa
--    da meia-noite, a chamada depois da meia-noite gravava o mesmo aviso no
--    dia novo, e o aviso já lido voltava. Agora o aviso não é gravado de novo
--    se o mesmo tipo já foi gravado na última hora; e o aviso de observação
--    da última hora segue na lista depois da meia-noite.
--
-- Como em 20270209000003, cada troca é feita na definição atual da função,
-- lida sem o CR do fim de linha, sempre numa linha só; as trocas da mesma
-- função vão juntas. Mesma assinatura, dono e grants. Idempotente: trecho já
-- trocado não muda; função mudada para com erro.
-- Teste: supabase/tests/vd15_menores_revisao.sql
--
-- Rollback: as mesmas trocas invertidas, na ordem inversa (ver o doc
-- docs/virada-de-data/CORRECAO-VD15-MENORES-REVISAO.md).
-- ════════════════════════════════════════════════════════════════════════════

-- p_pares: antigo, novo, antigo, novo... Todas as trocas de uma função vão
-- juntas num só CREATE OR REPLACE (uma troca sozinha pode deixar o corpo
-- inválido, como o VALUES ( sem o parêntese que fecha).
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

-- 1. implantação: chegadas a partir da meia-noite de Brasília do D0
SELECT pg_temp.vd15_trocar('private.implantacao_verificar(text, public.implantacoes)',
  'e.chegada_em >= i.d0::timestamptz',
  'e.chegada_em >= (i.d0::timestamp AT TIME ZONE ''America/Sao_Paulo'')');

-- 2 e 3. janelas em dias de Brasília
SELECT pg_temp.vd15_trocar('public.painel_organizacao(integer)',
  'co.data > (now() - make_interval(days => v_dias))::date',
  'co.data > private.data_atual() - v_dias');
SELECT pg_temp.vd15_trocar('public.hermes_minhas_notificacoes(uuid, uuid, integer)',
  'n.data >= (now() - make_interval(days => p_dias))::date',
  'n.data >= private.data_atual() - p_dias');

-- 4. aviso de 6 h de observação: uma vez só, também na virada do dia
SELECT pg_temp.vd15_trocar('public.gerar_notificacoes_turno(uuid)',
  'VALUES (auth.uid(), p_unidade, private.data_atual(), ''obs_30min_'' || v_pac.paciente_id,',
  'SELECT auth.uid(), p_unidade, private.data_atual(), ''obs_30min_'' || v_pac.paciente_id,',
  '''Paciente '' || v_pac.nome || '' completa 6h de observação em 30 minutos. Internar ou liberar.'')',
  '''Paciente '' || v_pac.nome || '' completa 6h de observação em 30 minutos. Internar ou liberar.'' WHERE NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista n0 WHERE n0.perfil_id = auth.uid() AND n0.unidade_id = p_unidade AND n0.tipo = ''obs_30min_'' || v_pac.paciente_id AND n0.created_at > now() - interval ''1 hour'')',
  'VALUES (auth.uid(), p_unidade, private.data_atual(), ''obs_15min_'' || v_pac.paciente_id,',
  'SELECT auth.uid(), p_unidade, private.data_atual(), ''obs_15min_'' || v_pac.paciente_id,',
  '''Paciente '' || v_pac.nome || '' completa 6h de observação em 15 minutos. Internar ou liberar.'')',
  '''Paciente '' || v_pac.nome || '' completa 6h de observação em 15 minutos. Internar ou liberar.'' WHERE NOT EXISTS (SELECT 1 FROM public.notificacoes_plantonista n0 WHERE n0.perfil_id = auth.uid() AND n0.unidade_id = p_unidade AND n0.tipo = ''obs_15min_'' || v_pac.paciente_id AND n0.created_at > now() - interval ''1 hour'')',
  'AND n.data = private.data_atual()',
  'AND (n.data = private.data_atual() OR (n.tipo LIKE ''obs\_%'' AND n.created_at > now() - interval ''1 hour''))');

DROP FUNCTION pg_temp.vd15_trocar(regprocedure, text[]);
