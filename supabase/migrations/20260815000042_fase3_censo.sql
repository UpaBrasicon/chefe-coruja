-- ─────────────────────────────────────────────────────────────────────────────
-- FASE 3 ADT — Censo materializado + indicadores
-- gerar_censo_diario  : calcula ocupação/taxa/permanência/giro por setor e dia
--                       a partir dos eventos ADT, gravando em censo_ocupacao.
-- censo_recente       : projeção para o dashboard (por unidade, período).
-- ─────────────────────────────────────────────────────────────────────────────

-- Gera/atualiza o censo de um dia (idempotente). Fonte de verdade: eventos ADT
-- (admissao/entrada_observacao/internacao definem presença; alta/óbito removem).
CREATE OR REPLACE FUNCTION public.gerar_censo_diario(
  p_unidade uuid,
  p_data date
) RETURNS integer AS $$
DECLARE
  v_org uuid;
  v_dia_inicio timestamptz := (p_data::text || ' 00:00:00-03')::timestamptz;
  v_dia_fim timestamptz := (p_data::text || ' 23:59:59-03')::timestamptz;
  v_internados integer;
  v_leitos_total integer;
  v_leitos_ocupados integer;
  v_leitos_livres integer;
  v_leitos_hig integer;
  v_leitos_bloq integer;
  v_taxa numeric;
  v_permanencia numeric;
  v_giro numeric;
  v_registros integer := 0;
  v_setor record;
BEGIN
  SELECT organizacao_id INTO v_org FROM public.unidades WHERE id = p_unidade;
  IF v_org IS NULL THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;

  -- 1. pacientes presentes no dia (episódios com admissão <= fim do dia e
  --    (sem data_alta OU data_alta >= início do dia))
  --    Presença = existir internação ativa naquele dia.
  FOR v_setor IN
    SELECT s.id AS setor_id
    FROM public.setores s
    WHERE s.unidade_id = p_unidade AND s.ativo
      AND s.tipo IN ('internacao','observacao','uti','isolamento')
  LOOP
    -- internados no dia no setor: episódios cujo setor_atual era este e que
    -- estavam vigentes no dia (admissão <= fim; sem alta ou alta >= início).
    SELECT count(DISTINCT i.id) INTO v_internados
    FROM public.internacoes i
    WHERE i.unidade_id = p_unidade
      AND i.setor_atual_id = v_setor.setor_id
      AND i.data_admissao <= v_dia_fim
      AND (i.data_alta IS NULL OR i.data_alta >= v_dia_inicio);

    -- leitos do setor
    SELECT
      count(*) FILTER (WHERE status = 'ocupado'),
      count(*) FILTER (WHERE status = 'livre'),
      count(*) FILTER (WHERE status = 'higienizacao'),
      count(*) FILTER (WHERE status = 'bloqueado'),
      count(*)
    INTO v_leitos_ocupados, v_leitos_livres, v_leitos_hig, v_leitos_bloq, v_leitos_total
    FROM public.leitos
    WHERE setor_id = v_setor.setor_id AND ativo;

    v_taxa := CASE WHEN v_leitos_total > 0
             THEN round((v_internados::numeric / v_leitos_total::numeric) * 100, 1)
             ELSE NULL END;

    -- permanência média (horas) dos episódios encerrados no dia (ou em curso)
    SELECT round(avg(extract(epoch FROM coalesce(data_alta, now()) - data_admissao)/3600)::numeric, 1)
    INTO v_permanencia
    FROM public.internacoes
    WHERE unidade_id = p_unidade AND setor_atual_id = v_setor.setor_id
      AND data_admissao <= v_dia_fim;

    -- giro de leito = altas no dia / leitos do setor
    SELECT round((count(*)::numeric / NULLIF(v_leitos_total,0))::numeric, 2)
    INTO v_giro
    FROM public.internacoes
    WHERE unidade_id = p_unidade AND setor_atual_id = v_setor.setor_id
      AND data_alta >= v_dia_inicio AND data_alta <= v_dia_fim;

    INSERT INTO public.censo_ocupacao
      (organizacao_id, unidade_id, setor_id, data, turno,
       internados, leitos_total, leitos_ocupados, leitos_livres,
       leitos_higienizacao, leitos_bloqueados,
       taxa_ocupacao, permanencia_media_h, giro_leito, snapshot)
    VALUES
      (v_org, p_unidade, v_setor.setor_id, p_data, 'diario',
       v_internados, v_leitos_total, v_leitos_ocupados, v_leitos_livres,
       v_leitos_hig, v_leitos_bloq, v_taxa, v_permanencia, v_giro,
       jsonb_build_object('gerado_em', now()))
    ON CONFLICT (unidade_id, setor_id, data, turno)
    DO UPDATE SET
      internados = EXCLUDED.internados,
      leitos_total = EXCLUDED.leitos_total,
      leitos_ocupados = EXCLUDED.leitos_ocupados,
      leitos_livres = EXCLUDED.leitos_livres,
      leitos_higienizacao = EXCLUDED.leitos_higienizacao,
      leitos_bloqueados = EXCLUDED.leitos_bloqueados,
      taxa_ocupacao = EXCLUDED.taxa_ocupacao,
      permanencia_media_h = EXCLUDED.permanencia_media_h,
      giro_leito = EXCLUDED.giro_leito,
      snapshot = EXCLUDED.snapshot,
      criado_em = now();

    v_registros := v_registros + 1;
  END LOOP;

  RETURN v_registros;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Censo agregado para o dashboard (por unidade e período)
CREATE OR REPLACE FUNCTION public.censo_recente(
  p_unidade uuid,
  p_dias integer DEFAULT 7
) RETURNS TABLE (
  data date,
  setor_id uuid,
  setor_nome text,
  internados integer,
  leitos_total integer,
  taxa_ocupacao numeric,
  permanencia_media_h numeric,
  giro_leito numeric
) AS $$
BEGIN
  RETURN QUERY
    SELECT c.data, c.setor_id, s.nome AS setor_nome,
           c.internados, c.leitos_total, c.taxa_ocupacao,
           c.permanencia_media_h, c.giro_leito
    FROM public.censo_ocupacao c
    JOIN public.setores s ON s.id = c.setor_id
    WHERE c.unidade_id = p_unidade
      AND c.data >= current_date - p_dias
    ORDER BY c.data DESC, s.ordem, s.nome;
END; $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
