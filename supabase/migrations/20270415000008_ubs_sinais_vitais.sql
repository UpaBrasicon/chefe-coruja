-- Percurso da UBS, U7, PR 4 (plano docs/ubs/U6-U7-PLANO.md; RT, 17/11/2026):
-- sinais vitais na UBS fora da escuta inicial.
--
-- Achado A2 do percurso: a pressão só se registrava na escuta inicial. A
-- consulta marcada (hiperdia, pré-natal, puericultura) não tinha campo de
-- sinais vitais, e o técnico de enfermagem não tinha tela para isso.
--
-- registrar_sinais_aps(p_episodio, p_sinais): o médico, o enfermeiro ou o
-- técnico de enfermagem de plantão no consultório registra os sinais vitais de
-- uma ficha aberta da UBS (aguardando ou em atendimento). Grava em observacao,
-- como a escuta e a porta; o hiperdia e o pré-natal já leem a pressão, o peso e
-- a altura daqui. No técnico, conta o CBO 3222 das notas da SAPS (P4 = A).
--
-- Idempotente. Teste: supabase/tests/ubs_sinais_vitais.sql
--
-- Rollback: DROP FUNCTION public.registrar_sinais_aps(uuid, jsonb);

CREATE OR REPLACE FUNCTION public.registrar_sinais_aps(p_episodio uuid, p_sinais jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.episodios;
  v_eu uuid := private.meu_perfil_id();
  v_conceito uuid;
  k text;
  n int := 0;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  IF e.tipo_atendimento_aps IS NULL THEN RAISE EXCEPTION 'Os sinais vitais por aqui são da UBS.'; END IF;
  IF e.etapa NOT IN ('triagem', 'atendimento') THEN RAISE EXCEPTION 'A ficha já foi encerrada.'; END IF;
  IF e.setor_id NOT IN (SELECT private.setores_na_escala_agora()) THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão neste consultório.';
  END IF;
  IF NOT (private.tenho_papel(e.unidade_id, 'plantonista') IS TRUE OR private.tenho_papel(e.unidade_id, 'enfermeiro') IS TRUE
          OR private.tenho_papel(e.unidade_id, 'tecnico_enfermagem') IS TRUE) THEN
    RAISE EXCEPTION 'Os sinais vitais são registrados pelo médico, pelo enfermeiro ou pelo técnico de enfermagem.';
  END IF;
  IF jsonb_typeof(coalesce(p_sinais, '{}')) <> 'object' OR p_sinais = '{}'::jsonb THEN
    RAISE EXCEPTION 'Informe ao menos um sinal vital.';
  END IF;

  FOR k IN SELECT jsonb_object_keys(p_sinais) LOOP
    IF jsonb_typeof(p_sinais -> k) <> 'number' THEN RAISE EXCEPTION 'Sinal vital sem número: %.', replace(k, '-', ' '); END IF;
    SELECT id INTO v_conceito FROM public.conceito WHERE nome = k AND (unidade_id IS NULL OR unidade_id = e.unidade_id) LIMIT 1;
    IF v_conceito IS NULL THEN RAISE EXCEPTION 'Sinal vital desconhecido: %.', k; END IF;
    INSERT INTO public.observacao (unidade_id, paciente_id, episodio_id, conceito_id, aferido_em, registrado_por, valor_num, origem)
    VALUES (e.unidade_id, e.paciente_id, e.id, v_conceito, now(), v_eu, (p_sinais ->> k)::numeric, 'manual');
    n := n + 1;
  END LOOP;

  PERFORM private.registrar_auditoria('sinais_aps_registrados', 'episodios', e.id, e.unidade_id,
    jsonb_build_object('quantidade', n));
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.registrar_sinais_aps(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_sinais_aps(uuid, jsonb) TO authenticated;
