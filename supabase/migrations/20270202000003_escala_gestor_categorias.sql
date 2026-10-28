-- Aba Escala para todos os papéis, entrega E2 (decisões do RT em 28/10/2026:
-- opção B, "todas juntas, categoria ao lado do nome"; o ERP leva só o plantão
-- de plantonista).
--
-- O gestor passa a escalar todas as categorias pela tela, e a cobertura do mês
-- passa a ser por categoria:
--   * profissionais_da_unidade: quem pode ser escalado, um por papel escalável
--     (quem tem dois papéis aparece duas vezes, uma em cada categoria);
--   * adicionar_plantao_escala ganha p_papel (opcional): a categoria escolhida;
--   * escala_faixas devolve a categoria de cada escalado, as vagas abertas da
--     faixa (com categoria) e `abertas`: o que falta, categoria por categoria
--     (vaga marcada sem ninguém daquela categoria, ou plantão previsto pela fixa
--     sem ninguém dela). A vaga sem categoria (antiga) só fecha com alguém
--     escalado, de qualquer categoria, como antes;
--   * escala_mes_gestor: "vaga" quando há algo em `abertas`; devolve também as
--     categorias da unidade (filtro da tela);
--   * publicar_escala conta as vagas pelo mesmo `abertas`;
--   * marcar_vaga_escala ganha p_papel (opcional): a vaga é de uma categoria, e o
--     aviso vai para quem tem esse papel (sem categoria: plantonistas, como antes);
--   * vagas_abertas: cada um vê as vagas da própria categoria (e as sem categoria),
--     e a vaga só deixa de aparecer quando alguém da categoria dela é escalado;
--   * gerar_escala_mensal_detalhada leva a categoria da fixa para o plantão e para
--     a vaga aberta no conflito;
--   * plantoes_erp_linhas: o envio ao ERP leva só o plantão de plantonista (ou,
--     sem categoria gravada, de quem tem vínculo de plantonista).
--
-- Rollback: DROP FUNCTION IF EXISTS public.profissionais_da_unidade(uuid);
--   DROP FUNCTION IF EXISTS public.adicionar_plantao_escala(uuid, uuid, uuid, date, text, text, boolean, public.papel);
--   DROP FUNCTION IF EXISTS public.marcar_vaga_escala(uuid, date, text, text, public.papel);
--   DROP FUNCTION IF EXISTS private.escala_faixas(uuid, date, date);
--   e reaplicar as versões anteriores, nos arquivos onde estão:
--   adicionar_plantao_escala (20260926000001_fase0_endurecer_rpcs.sql),
--   escala_faixas e vagas_abertas (20261012000001_limites_unidade_chamados_fracionar.sql),
--   escala_mes_gestor, marcar_vaga_escala e publicar_escala (20261007000003_escala_publicar_vagas.sql),
--   gerar_escala_mensal_detalhada (20261123000001_escala_sem_sobreposicao.sql),
--   plantoes_erp_linhas (20270120000002_erp_plantoes.sql).

-- ── Quem o gestor pode escalar, por categoria ──────────────────────────────
CREATE OR REPLACE FUNCTION public.profissionais_da_unidade(p_unidade uuid)
RETURNS TABLE (perfil_id uuid, nome_completo text, crm text, papel public.papel)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: só o gestor da unidade monta a escala.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN QUERY
  SELECT DISTINCT p.id, p.nome_completo, p.crm, v.papel
    FROM public.vinculos v
    JOIN public.perfis p ON p.id = v.perfil_id AND p.ativo
   WHERE v.unidade_id = p_unidade AND v.ativo AND v.papel NOT IN ('admin', 'gestor')
   ORDER BY v.papel, p.nome_completo;
END;
$function$;
REVOKE ALL ON FUNCTION public.profissionais_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profissionais_da_unidade(uuid) TO authenticated;

-- ── Escalar com categoria ──────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.adicionar_plantao_escala(uuid, uuid, uuid, date, text, text, boolean);
CREATE OR REPLACE FUNCTION public.adicionar_plantao_escala(
  p_unidade uuid, p_setor uuid, p_perfil uuid, p_data date, p_turno text,
  p_rotulo text DEFAULT NULL, p_quinzenal boolean DEFAULT false, p_papel public.papel DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_existente uuid;
  v_id uuid;
BEGIN
  IF (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) = 'gestor') IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas o gestor pode montar a escala.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.vinculos v
                 WHERE v.perfil_id = p_perfil AND v.unidade_id = p_unidade AND v.ativo) THEN
    RAISE EXCEPTION 'Este profissional não tem vínculo ativo nesta unidade.';
  END IF;
  -- a categoria escolhida tem de ser um papel da pessoa (o gatilho confere de novo)
  IF p_papel IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.vinculos v
                 WHERE v.perfil_id = p_perfil AND v.unidade_id = p_unidade AND v.ativo AND v.papel = p_papel) THEN
    RAISE EXCEPTION 'Este profissional não tem o papel de % nesta unidade.', replace(p_papel::text, '_', ' ');
  END IF;

  SELECT e.id INTO v_existente
  FROM public.escala_plantao e
  WHERE e.perfil_id = p_perfil
    AND e.data = p_data
    AND e.turno = p_turno
    AND e.setor_id <> p_setor
    AND e.ativo
  LIMIT 1;

  IF v_existente IS NOT NULL THEN
    RAISE EXCEPTION 'Conflito: este profissional já está escalado em outro setor nesta data/turno.';
  END IF;

  INSERT INTO public.escala_plantao
    (unidade_id, setor_id, perfil_id, data, turno, rotulo, quinzenal, ativo, criado_por, papel)
  VALUES (p_unidade, p_setor, p_perfil, p_data, p_turno, p_rotulo, p_quinzenal, true, auth.uid(), p_papel)
  ON CONFLICT (setor_id, data, turno, perfil_id) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Este plantão já está preenchido por este profissional.';
  END IF;

  RETURN v_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.adicionar_plantao_escala(uuid, uuid, uuid, date, text, text, boolean, public.papel) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.adicionar_plantao_escala(uuid, uuid, uuid, date, text, text, boolean, public.papel) TO authenticated;

-- ── Faixas do mês com categoria ────────────────────────────────────────────
-- Colunas novas (previstos, vagas, abertas) no fim: os chamadores leem por nome.
DROP FUNCTION IF EXISTS private.escala_faixas(uuid, date, date);
CREATE FUNCTION private.escala_faixas(p_unidade uuid, p_inicio date, p_fim date)
RETURNS TABLE (data date, setor_id uuid, turno text, escalados jsonb, previsto boolean, vaga_id uuid, vaga_obs text,
               previstos jsonb, vagas jsonb, abertas jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH faixas AS (
    SELECT d::date AS data, s.id AS setor_id, t.turno,
           private.inicio_do_turno(d::date, t.turno) AS ini,
           private.inicio_do_turno(d::date, t.turno) + make_interval(hours => t.horas) AS fim
      FROM generate_series(p_inicio, p_fim, interval '1 day') d
     CROSS JOIN public.setores s
     CROSS JOIN (VALUES ('manha', 6), ('tarde', 6), ('noite', 12)) t(turno, horas)
     WHERE s.unidade_id = p_unidade AND s.ativo
  ), base AS (
    SELECT f.data, f.setor_id, f.turno,
           coalesce((SELECT jsonb_agg(jsonb_build_object('plantao_id', e.id, 'perfil_id', e.perfil_id, 'nome', p.nome_completo,
                                                         'turno', e.turno, 'duracao_min', e.duracao_min, 'quinzenal', e.quinzenal,
                                                         'rotulo', e.rotulo, 'papel', e.papel) ORDER BY e.inicio, p.nome_completo)
                       FROM public.escala_plantao e JOIN public.perfis p ON p.id = e.perfil_id
                      WHERE e.setor_id = f.setor_id AND e.ativo
                        AND e.inicio < f.fim AND e.inicio + make_interval(mins => e.duracao_min) > f.ini), '[]'::jsonb) AS escalados,
           -- categorias que a fixa prevê na faixa (null = fixa sem categoria)
           coalesce((SELECT jsonb_agg(DISTINCT to_jsonb(x.papel)) FROM public.escala_fixa x
                      WHERE x.setor_id = f.setor_id AND x.ativo AND x.turno = f.turno
                        AND x.dia_semana = extract(dow FROM f.data)::int), '[]'::jsonb) AS previstos,
           coalesce((SELECT jsonb_agg(jsonb_build_object('id', ev.id, 'obs', ev.observacao, 'papel', ev.papel)
                                      ORDER BY (ev.plantao_origem_id IS NOT NULL), ev.inicio NULLS FIRST)
                       FROM public.escala_vagas ev
                      WHERE ev.setor_id = f.setor_id AND ev.data = f.data AND ev.turno = f.turno AND ev.fechada_em IS NULL), '[]'::jsonb) AS vagas
      FROM faixas f
  )
  SELECT b.data, b.setor_id, b.turno, b.escalados,
         jsonb_array_length(b.previstos) > 0,
         (b.vagas -> 0 ->> 'id')::uuid, b.vagas -> 0 ->> 'obs',
         b.previstos, b.vagas,
         coalesce((SELECT jsonb_agg(a.j) FROM (
           -- vaga marcada sem ninguém da categoria dela (sem categoria: sem ninguém)
           SELECT jsonb_build_object('papel', vg -> 'papel', 'vaga_id', vg -> 'id', 'obs', vg -> 'obs') AS j
             FROM jsonb_array_elements(b.vagas) vg
            WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(b.escalados) es
                               WHERE vg ->> 'papel' IS NULL OR es ->> 'papel' = vg ->> 'papel')
           UNION ALL
           -- previsto pela fixa, sem ninguém da categoria e sem vaga marcada dela
           SELECT jsonb_build_object('papel', pv, 'vaga_id', NULL, 'obs', NULL)
             FROM jsonb_array_elements(b.previstos) pv
            WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(b.escalados) es
                               WHERE pv #>> '{}' IS NULL OR es ->> 'papel' = pv #>> '{}')
              AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(b.vagas) vg
                               WHERE (vg ->> 'papel') IS NOT DISTINCT FROM (pv #>> '{}'))
         ) a), '[]'::jsonb)
    FROM base b
$function$;
REVOKE ALL ON FUNCTION private.escala_faixas(uuid, date, date) FROM PUBLIC, anon, authenticated;

-- ── Escala do mês do gestor ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.escala_mes_gestor(p_unidade uuid, p_ano integer, p_mes integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_ini date;
  v_fim date;
  v_pub public.escala_publicacoes;
BEGIN
  IF private.segundo_fator_ok() IS NOT TRUE OR NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: escala do gestor da unidade.';
  END IF;
  IF p_mes NOT BETWEEN 1 AND 12 OR p_ano NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'Mês inválido.'; END IF;
  v_ini := make_date(p_ano, p_mes, 1);
  v_fim := (v_ini + interval '1 month' - interval '1 day')::date;
  SELECT * INTO v_pub FROM public.escala_publicacoes
   WHERE unidade_id = p_unidade AND competencia = v_ini ORDER BY versao DESC LIMIT 1;
  RETURN jsonb_build_object(
    'setores', coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome, 'tipo', s.tipo) ORDER BY s.ordem, s.nome)
                           FROM public.setores s WHERE s.unidade_id = p_unidade AND s.ativo), '[]'::jsonb),
    -- categorias que a unidade escala (filtro da tela)
    'categorias', coalesce((SELECT jsonb_agg(c.papel ORDER BY c.papel)
                              FROM (SELECT DISTINCT v.papel FROM public.vinculos v
                                     WHERE v.unidade_id = p_unidade AND v.ativo AND v.papel NOT IN ('admin', 'gestor')) c), '[]'::jsonb),
    'faixas', coalesce((SELECT jsonb_agg(jsonb_build_object(
                                 'data', f.data, 'setor_id', f.setor_id, 'turno', f.turno, 'escalados', f.escalados,
                                 'previsto', f.previsto, 'vaga_id', f.vaga_id, 'vaga_obs', f.vaga_obs,
                                 'vagas', f.vagas, 'abertas', f.abertas,
                                 'situacao', CASE WHEN jsonb_array_length(f.abertas) > 0 THEN 'vaga'
                                                  WHEN jsonb_array_length(f.escalados) > 0 THEN 'coberto'
                                                  ELSE 'sem_plantao' END)
                               ORDER BY f.data, f.setor_id, f.turno)
                          FROM private.escala_faixas(p_unidade, v_ini, v_fim) f), '[]'::jsonb),
    'publicacao', CASE WHEN v_pub.id IS NULL THEN NULL ELSE jsonb_build_object(
       'versao', v_pub.versao, 'publicada_em', v_pub.publicada_em, 'plantoes', v_pub.plantoes, 'vagas', v_pub.vagas,
       'publicada_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = v_pub.publicada_por),
       'alteracoes_depois', (SELECT count(*) FROM public.historico_escala h
                              WHERE h.unidade_id = p_unidade AND h.created_at > v_pub.publicada_em
                                AND h.acao IN ('criar', 'alterar', 'remover')
                                AND coalesce(h.dados -> 'depois' ->> 'data', h.dados -> 'antes' ->> 'data')::date BETWEEN v_ini AND v_fim)) END);
END
$function$;

-- ── Publicar: as vagas contam por categoria ────────────────────────────────
CREATE OR REPLACE FUNCTION public.publicar_escala(p_unidade uuid, p_ano integer, p_mes integer, p_observacao text DEFAULT NULL::text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_ini date;
  v_fim date;
  v_versao int;
  v_plantoes int;
  v_vagas int;
  v_perfil uuid;
  v_rotulo text;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.sou_gestor_da_unidade(p_unidade) THEN RAISE EXCEPTION 'Só o gestor da unidade publica a escala.'; END IF;
  IF p_mes NOT BETWEEN 1 AND 12 OR p_ano NOT BETWEEN 2000 AND 2100 THEN RAISE EXCEPTION 'Mês inválido.'; END IF;
  v_ini := make_date(p_ano, p_mes, 1);
  v_fim := (v_ini + interval '1 month' - interval '1 day')::date;
  IF v_fim < private.data_atual() THEN RAISE EXCEPTION 'Este mês já terminou: a escala dele não se publica mais.'; END IF;
  SELECT count(*) INTO v_plantoes FROM public.escala_plantao
   WHERE unidade_id = p_unidade AND ativo AND data BETWEEN v_ini AND v_fim;
  IF v_plantoes = 0 THEN RAISE EXCEPTION 'Não há plantão neste mês para publicar.'; END IF;
  SELECT coalesce(sum(jsonb_array_length(f.abertas)), 0) INTO v_vagas FROM private.escala_faixas(p_unidade, v_ini, v_fim) f;
  SELECT coalesce(max(versao), 0) + 1 INTO v_versao FROM public.escala_publicacoes
   WHERE unidade_id = p_unidade AND competencia = v_ini;
  INSERT INTO public.escala_publicacoes (unidade_id, competencia, versao, plantoes, vagas, observacao, publicada_por)
  VALUES (p_unidade, v_ini, v_versao, v_plantoes, v_vagas, nullif(btrim(p_observacao), ''), private.meu_perfil_id());
  v_rotulo := to_char(v_ini, 'MM/YYYY');
  INSERT INTO public.historico_escala (unidade_id, perfil_id, acao, detalhe, dados)
  VALUES (p_unidade, private.meu_perfil_id(), 'publicar',
          'Escala de ' || v_rotulo || ' publicada (versão ' || v_versao || ', ' || v_plantoes || ' plantões, ' || v_vagas || ' vagas abertas)',
          jsonb_build_object('competencia', v_ini, 'versao', v_versao, 'plantoes', v_plantoes, 'vagas', v_vagas));
  FOR v_perfil IN SELECT DISTINCT e.perfil_id FROM public.escala_plantao e
                   WHERE e.unidade_id = p_unidade AND e.ativo AND e.data BETWEEN v_ini AND v_fim LOOP
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (v_perfil, p_unidade, v_ini, 'escala_publicada_' || to_char(v_ini, 'YYYY_MM') || '_v' || v_versao,
            'A escala de ' || v_rotulo || ' foi publicada' || CASE WHEN v_versao > 1 THEN ' (versão ' || v_versao || ')' ELSE '' END
              || '. Confira seus plantões na agenda.')
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
  END LOOP;
  PERFORM private.registrar_auditoria('publicar_escala', 'escala_publicacoes', NULL, p_unidade,
    jsonb_build_object('quantidade', v_plantoes, 'status', 'versao ' || v_versao));
  RETURN v_versao;
END
$function$;

-- ── Marcar vaga de uma categoria ───────────────────────────────────────────
DROP FUNCTION IF EXISTS public.marcar_vaga_escala(uuid, date, text, text);
CREATE OR REPLACE FUNCTION public.marcar_vaga_escala(p_setor uuid, p_data date, p_turno text,
                                                     p_observacao text DEFAULT NULL, p_papel public.papel DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_unidade uuid;
  v_setor_nome text;
  v_id uuid;
  v_perfil uuid;
  v_cat text := replace(coalesce(p_papel::text, 'plantonista'), '_', ' ');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id, nome INTO v_unidade, v_setor_nome FROM public.setores WHERE id = p_setor AND ativo;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Setor não encontrado.'; END IF;
  IF NOT private.sou_gestor_da_unidade(v_unidade) THEN RAISE EXCEPTION 'Só o gestor da unidade marca vaga na escala.'; END IF;
  IF p_turno NOT IN ('manha', 'tarde', 'noite') THEN RAISE EXCEPTION 'Faixa inválida: manhã, tarde ou noite.'; END IF;
  IF p_data < private.data_atual() THEN RAISE EXCEPTION 'Não se marca vaga em dia que já passou.'; END IF;
  IF p_papel IN ('admin', 'gestor') THEN RAISE EXCEPTION 'Gestor e administrador não são categoria de plantão.'; END IF;
  -- já tem alguém da categoria na faixa (sem categoria: alguém de qualquer uma)
  IF EXISTS (SELECT 1 FROM private.escala_faixas(v_unidade, p_data, p_data) f, jsonb_array_elements(f.escalados) es
              WHERE f.setor_id = p_setor AND f.turno = p_turno
                AND (p_papel IS NULL OR es ->> 'papel' = p_papel::text)) THEN
    RAISE EXCEPTION 'Esta faixa já tem % escalado.', CASE WHEN p_papel IS NULL THEN 'alguém' ELSE v_cat END;
  END IF;
  SELECT id INTO v_id FROM public.escala_vagas
   WHERE setor_id = p_setor AND data = p_data AND turno = p_turno AND fechada_em IS NULL
     AND plantao_origem_id IS NULL AND papel IS NOT DISTINCT FROM p_papel;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;   -- já marcada: não duplica
  INSERT INTO public.escala_vagas (unidade_id, setor_id, data, turno, observacao, aberta_por, papel)
  VALUES (v_unidade, p_setor, p_data, p_turno, nullif(btrim(p_observacao), ''), private.meu_perfil_id(), p_papel)
  RETURNING id INTO v_id;
  -- avisa quem tem o papel da vaga (a candidatura continua pela escala)
  FOR v_perfil IN SELECT DISTINCT v.perfil_id FROM public.vinculos v
                   WHERE v.unidade_id = v_unidade AND v.papel = coalesce(p_papel, 'plantonista') AND v.ativo LOOP
    INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
    VALUES (v_perfil, v_unidade, p_data, 'vaga_' || v_id,
            'Vaga aberta em ' || v_setor_nome || ' em ' || to_char(p_data, 'DD/MM') || ' ('
              || CASE p_turno WHEN 'manha' THEN 'manhã' WHEN 'tarde' THEN 'tarde' ELSE 'noite' END || '). Candidate-se pela escala.')
    ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
  END LOOP;
  INSERT INTO public.historico_escala (unidade_id, perfil_id, acao, detalhe, dados)
  VALUES (v_unidade, private.meu_perfil_id(), 'marcar_vaga',
          v_setor_nome || ' · ' || to_char(p_data, 'DD/MM') || ' · ' || p_turno || CASE WHEN p_papel IS NULL THEN '' ELSE ' · ' || v_cat END,
          jsonb_build_object('vaga_id', v_id, 'setor_id', p_setor, 'data', p_data, 'turno', p_turno, 'papel', p_papel));
  RETURN v_id;
END
$function$;
REVOKE ALL ON FUNCTION public.marcar_vaga_escala(uuid, date, text, text, public.papel) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_vaga_escala(uuid, date, text, text, public.papel) TO authenticated;

-- ── Vagas abertas: as da minha categoria ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.vagas_abertas()
RETURNS TABLE(id uuid, unidade_id uuid, unidade_nome text, latitude double precision, longitude double precision, setor_id uuid,
              setor_nome text, especialidade text, data date, turno text, inicio timestamp with time zone, fim timestamp with time zone,
              parte smallint, partes smallint, observacao text, minha_candidatura text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT v.id, v.unidade_id, u.nome, u.latitude, u.longitude, v.setor_id, s.nome, s.especialidade, v.data, v.turno,
         j.ini, j.fim, v.parte, v.partes, v.observacao,
         (SELECT c.status FROM public.candidaturas_escala c
           WHERE c.perfil_id = private.meu_perfil_id()
             AND (c.vaga_id = v.id
                  OR (c.vaga_id IS NULL AND v.plantao_origem_id IS NULL
                      AND c.setor_id = v.setor_id AND c.data = v.data AND c.turno = v.turno))
           ORDER BY c.created_at DESC LIMIT 1)
    FROM public.escala_vagas v
    JOIN public.unidades u ON u.id = v.unidade_id
    JOIN public.setores s ON s.id = v.setor_id AND s.ativo
    CROSS JOIN LATERAL (
      SELECT coalesce(v.inicio, private.inicio_do_turno(v.data, v.turno)) AS ini,
             coalesce(v.inicio, private.inicio_do_turno(v.data, v.turno))
               + make_interval(mins => coalesce(v.duracao_min, CASE v.turno WHEN 'noite' THEN 720 ELSE 360 END)) AS fim) j
   WHERE v.fechada_em IS NULL
     AND private.membro_da_unidade(v.unidade_id)
     -- a vaga de uma categoria só aparece para quem tem esse papel na unidade
     AND (v.papel IS NULL OR EXISTS (SELECT 1 FROM public.vinculos vi
                                      WHERE vi.perfil_id = private.meu_perfil_id() AND vi.unidade_id = v.unidade_id
                                        AND vi.ativo AND vi.papel = v.papel))
     AND j.fim > now()
     -- a faixa marcada que já tem alguém da categoria escalado não é mais vaga
     AND (v.plantao_origem_id IS NOT NULL
          OR NOT EXISTS (SELECT 1 FROM public.escala_plantao e
                          WHERE e.setor_id = v.setor_id AND e.ativo
                            AND (v.papel IS NULL OR e.papel = v.papel)
                            AND e.inicio < j.fim AND e.inicio + make_interval(mins => e.duracao_min) > j.ini))
   ORDER BY j.ini, s.nome
$function$;

-- ── Geração do mês leva a categoria da fixa ────────────────────────────────
CREATE OR REPLACE FUNCTION public.gerar_escala_mensal_detalhada(p_unidade uuid, p_ano integer, p_mes integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $function$
DECLARE
  v_ini date := make_date(p_ano, p_mes, 1);
  v_fim date := (make_date(p_ano, p_mes, 1) + interval '1 month' - interval '1 day')::date;
  v_dia date;
  v_dow int;
  v_semana_do_mes int;
  v_count int := 0;
  v_gerados int := 0;
  v_vagas jsonb := '[]'::jsonb;
  f record;
  v_conflito text;
  v_vaga uuid;
  v_perfil uuid;
BEGIN
  IF (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) = 'gestor') IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: apenas o gestor gera a escala da unidade.';
  END IF;

  FOR v_dia IN SELECT generate_series(v_ini, v_fim, interval '1 day')::date LOOP
    v_dow := EXTRACT(ISODOW FROM v_dia)::int % 7;
    v_semana_do_mes := (EXTRACT(day FROM v_dia)::int - 1) / 7;

    FOR f IN
      SELECT x.unidade_id, x.setor_id, x.perfil_id, x.turno, x.quinzenal, x.papel, s.nome AS setor, pf.nome_completo AS profissional
        FROM public.escala_fixa x
        LEFT JOIN public.setores s ON s.id = x.setor_id
        LEFT JOIN public.perfis pf ON pf.id = x.perfil_id
       WHERE x.unidade_id = p_unidade
         AND x.ativo
         AND x.dia_semana = v_dow
         AND (x.quinzenal = false OR v_semana_do_mes % 2 = 0)
    LOOP
      -- já gerado antes (mesma pessoa, setor, dia e turno): nada a fazer
      CONTINUE WHEN EXISTS (SELECT 1 FROM public.escala_plantao e WHERE e.setor_id = f.setor_id AND e.data = v_dia
                              AND e.turno = f.turno AND e.perfil_id = f.perfil_id);
      v_conflito := private.conflito_escala(f.perfil_id, private.inicio_do_turno(v_dia, f.turno), private.duracao_padrao(f.turno));
      IF v_conflito IS NULL THEN
        INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, quinzenal, ativo, papel)
        VALUES (f.unidade_id, f.setor_id, f.perfil_id, v_dia, f.turno, f.quinzenal, true, f.papel)
        ON CONFLICT (setor_id, data, turno, perfil_id) DO NOTHING;
        v_gerados := v_gerados + 1;
      ELSE
        -- vaga aberta no lugar, da mesma categoria, como em marcar_vaga_escala (sem
        -- duplicar se o mês for gerado de novo); quem tem o papel é avisado
        IF NOT EXISTS (SELECT 1 FROM public.escala_vagas v WHERE v.setor_id = f.setor_id AND v.data = v_dia
                        AND v.turno = f.turno AND v.fechada_em IS NULL AND v.papel IS NOT DISTINCT FROM f.papel) THEN
          INSERT INTO public.escala_vagas (unidade_id, setor_id, data, turno, observacao, aberta_por, papel)
          VALUES (f.unidade_id, f.setor_id, v_dia, f.turno,
                  'Vaga aberta na geração do mês: ' || coalesce(f.profissional, 'o profissional') || ' já estava escalado(a) ' || v_conflito || '.',
                  private.meu_perfil_id(), f.papel)
          RETURNING id INTO v_vaga;
          FOR v_perfil IN SELECT DISTINCT vi.perfil_id FROM public.vinculos vi
                           WHERE vi.unidade_id = f.unidade_id AND vi.papel = coalesce(f.papel, 'plantonista') AND vi.ativo LOOP
            INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
            VALUES (v_perfil, f.unidade_id, v_dia, 'vaga_' || v_vaga,
                    'Vaga aberta em ' || coalesce(f.setor, 'setor') || ' em ' || to_char(v_dia, 'DD/MM') || ' (' || f.turno || '). Candidate-se pela escala.')
            ON CONFLICT (perfil_id, unidade_id, data, tipo) DO NOTHING;
          END LOOP;
          INSERT INTO public.historico_escala (unidade_id, perfil_id, acao, detalhe, dados)
          VALUES (f.unidade_id, private.meu_perfil_id(), 'marcar_vaga',
                  coalesce(f.setor, 'setor') || ' · ' || to_char(v_dia, 'DD/MM') || ' · ' || f.turno || ' (conflito na geração do mês)',
                  jsonb_build_object('vaga_id', v_vaga, 'setor_id', f.setor_id, 'data', v_dia, 'turno', f.turno, 'papel', f.papel,
                                     'perfil_em_conflito', f.perfil_id, 'conflito', v_conflito));
        END IF;
        v_vagas := v_vagas || jsonb_build_object('data', v_dia, 'turno', f.turno, 'setor', f.setor,
                                                 'profissional', f.profissional, 'conflito', v_conflito);
      END IF;
    END LOOP;

    v_count := v_count + 1;
  END LOOP;
  RETURN jsonb_build_object('dias', v_count, 'gerados', v_gerados, 'vagas', v_vagas);
END;
$function$;
REVOKE ALL ON FUNCTION public.gerar_escala_mensal_detalhada(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_escala_mensal_detalhada(uuid, integer, integer) TO authenticated;

-- ── ERP: só o plantão de plantonista ───────────────────────────────────────
CREATE OR REPLACE FUNCTION private.plantoes_erp_linhas(p_unidade uuid, p_competencia text)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT coalesce(jsonb_agg(l.j ORDER BY l.inicio, l.id), '[]'::jsonb) FROM (
    SELECT e.id, e.inicio, jsonb_build_object(
      'plantao_id', e.id, 'data', e.data, 'turno', e.turno,
      'setor', jsonb_build_object('id', s.id, 'nome', s.nome),
      'inicio', e.inicio, 'duracao_min', e.duracao_min, 'fracionado', f.fr,
      'profissional', jsonb_build_object('id', p.id, 'nome', p.nome_completo, 'cpf', p.cpf, 'conselho', p.conselho,
                        'registro', coalesce(p.registro_numero, p.crm), 'registro_uf', coalesce(p.registro_uf, p.uf_crm), 'cbo', p.cbo),
      'checkin_em', pr.checkin_em, 'checkout_em', pr.checkout_em, 'checkout_automatico', coalesce(pr.checkout_automatico, false),
      'minutos_presentes', CASE WHEN pr.checkout_em IS NOT NULL THEN floor(extract(epoch FROM pr.checkout_em - pr.checkin_em) / 60)::int END,
      'situacao', st.sit, 'tipo_falta', fj.tipo_falta,
      'valor_referencia', v.vr,
      'valor', CASE WHEN st.sit = 'realizado' THEN v.vr ELSE 0 END) AS j
      FROM public.escala_plantao e
      JOIN public.setores s ON s.id = e.setor_id
      JOIN public.perfis p ON p.id = e.perfil_id
      LEFT JOIN LATERAL (SELECT x.checkin_em, x.checkout_em, x.checkout_automatico FROM public.presenca_plantonista x
                          WHERE x.escala_plantao_id = e.id AND x.checkin_em IS NOT NULL ORDER BY x.checkin_em LIMIT 1) pr ON true
      LEFT JOIN LATERAL (SELECT true AS justificada, x.tipo_falta FROM public.solicitacoes_escala x
                          WHERE x.escala_plantao_id = e.id AND x.tipo = 'justificar_falta' AND x.status = 'aprovado'
                          ORDER BY x.updated_at DESC LIMIT 1) fj ON true
      CROSS JOIN LATERAL (SELECT e.fracionado OR e.plantao_origem_id IS NOT NULL AS fr) f
      CROSS JOIN LATERAL (SELECT private.plantao_erp_valor(e.unidade_id, e.setor_id, e.turno, e.duracao_min, f.fr) AS vr) v
      CROSS JOIN LATERAL (SELECT CASE WHEN pr.checkin_em IS NOT NULL THEN 'realizado'
                                      WHEN fj.justificada THEN 'falta_justificada'
                                      ELSE 'sem_presenca' END AS sit) st
     WHERE e.unidade_id = p_unidade AND e.ativo AND e.perfil_id IS NOT NULL
       -- E2 da aba Escala (decisão do RT em 28/10/2026): o ERP leva só o plantão de
       -- plantonista; sem categoria gravada, vale o vínculo de plantonista da pessoa
       AND (e.papel = 'plantonista'
            OR (e.papel IS NULL AND EXISTS (SELECT 1 FROM public.vinculos vi
                                             WHERE vi.perfil_id = e.perfil_id AND vi.unidade_id = e.unidade_id
                                               AND vi.ativo AND vi.papel = 'plantonista')))
       AND e.data >= to_date(p_competencia, 'YYYYMM') AND e.data < to_date(p_competencia, 'YYYYMM') + interval '1 month') l
$function$;
