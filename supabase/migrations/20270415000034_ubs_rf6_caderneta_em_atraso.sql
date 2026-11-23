-- ════════════════════════════════════════════════════════════════════════════
-- Refinamento da UBS, RF6 = A (RT, 23/11/2026): a caderneta de vacina mostra
-- primeiro o que está em atraso ou a completar. Diagnóstico em
-- docs/ubs/REFINAMENTO-UBS-DIAGNOSTICO.md.
--
-- Opção A: só o que o app já calcula pelas notas metodológicas da SAPS/MS
-- (junho de 2026), cada linha com a fonte. Não é o Calendário Nacional
-- completo (opção B, que fica para trilha própria):
--   C2 (criança até 2 anos): o que falta no esquema da boa prática E, pela
--      private.vacina_c2_faltam (migration 20270415000029). A tríplice viral só
--      aparece a partir dos 12 meses, quando a janela da própria regra abre;
--   C3 (gestante): dTpa a partir da 20ª semana (DUM + 140 dias) até 42 semanas
--      (DUM + 294), na gestação ativa do pré-natal, sem dTpa (57) nessa janela;
--   C6 (pessoa idosa, 60 anos ou mais): influenza (33 ou 77) nos últimos 12 meses;
--   C7 (mulher de 9 a 14 anos): HPV (67 ou 93) aplicada dos 9 aos 14 anos.
--
-- Expand: função nova private.vacina_pendencias e o campo novo 'pendencias'
-- na vacina_caderneta (o resto do retorno não muda).
-- Reaplicável: CREATE OR REPLACE.
--
-- Rollback (testado na homologação): recriar public.vacina_caderneta com a
-- definição da migration 20270415000028 (seção 5) e
--   DROP FUNCTION IF EXISTS private.vacina_pendencias(public.pacientes);
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.vacina_pendencias(pa public.pacientes)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_hoje date := private.data_atual();
  v_meses int;
  v_anos int;
  g record;
  f text;
  r jsonb := '[]'::jsonb;
BEGIN
  IF pa.data_nascimento IS NULL THEN RETURN r; END IF;
  v_meses := (date_part('year', age(v_hoje, pa.data_nascimento)) * 12 + date_part('month', age(v_hoje, pa.data_nascimento)))::int;
  v_anos := v_meses / 12;

  -- C2: criança até 2 anos
  IF v_meses < 24 THEN
    FOREACH f IN ARRAY coalesce(private.vacina_c2_faltam(pa.id, pa.data_nascimento), '{}') LOOP
      CONTINUE WHEN f = 'tríplice viral' AND v_meses < 12;
      r := r || jsonb_build_object('vacina', f, 'indicador', 'C2',
        'texto', 'esquema incompleto; completar até os 2 anos',
        'fonte', 'Nota metodológica C2 da SAPS/MS (jun/2026), boa prática E');
    END LOOP;
  END IF;

  -- C3: gestante a partir da 20ª semana, sem dTpa
  FOR g IN
    SELECT pg.dum FROM public.pre_natal_gestacoes pg
     WHERE pg.paciente_id = pa.id AND pg.dum IS NOT NULL AND pg.desfecho IS NULL AND pg.saida_em IS NULL
       AND v_hoje BETWEEN pg.dum + 140 AND pg.dum + 294
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.vacinacoes v
                    WHERE v.paciente_id = pa.id AND v.imunobiologico = 57 AND v.cancelado_em IS NULL
                      AND v.data_aplicacao BETWEEN g.dum + 140 AND g.dum + 294) THEN
      r := r || jsonb_build_object('vacina', 'dTpa', 'indicador', 'C3',
        'texto', 'gestante com 20 semanas ou mais; vale até 42 semanas',
        'fonte', 'Nota metodológica C3 da SAPS/MS (jun/2026), boa prática F');
    END IF;
  END LOOP;

  -- C6: pessoa idosa, influenza nos últimos 12 meses
  IF v_anos >= 60 AND NOT EXISTS (
       SELECT 1 FROM public.vacinacoes v
        WHERE v.paciente_id = pa.id AND v.imunobiologico IN (33, 77) AND v.cancelado_em IS NULL
          AND v.data_aplicacao > (v_hoje - interval '12 months')::date) THEN
    r := r || jsonb_build_object('vacina', 'influenza', 'indicador', 'C6',
      'texto', 'pessoa idosa sem dose nos últimos 12 meses',
      'fonte', 'Nota metodológica C6 da SAPS/MS (jun/2026), boa prática D');
  END IF;

  -- C7: mulher de 9 a 14 anos, HPV
  IF v_anos BETWEEN 9 AND 14 AND upper(coalesce(pa.sexo, '')) LIKE 'F%' AND NOT EXISTS (
       SELECT 1 FROM public.vacinacoes v
        WHERE v.paciente_id = pa.id AND v.imunobiologico IN (67, 93) AND v.cancelado_em IS NULL
          AND v.data_aplicacao >= (pa.data_nascimento + interval '9 years')::date
          AND v.data_aplicacao < (pa.data_nascimento + interval '15 years')::date) THEN
    r := r || jsonb_build_object('vacina', 'HPV', 'indicador', 'C7',
      'texto', 'menina de 9 a 14 anos sem dose',
      'fonte', 'Nota metodológica C7 da SAPS/MS (jun/2026), boa prática B');
  END IF;

  RETURN r;
END $$;
REVOKE ALL ON FUNCTION private.vacina_pendencias(public.pacientes) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.vacina_caderneta(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE pa public.pacientes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND OR NOT private.vacina_pode_ler(pa.unidade_id) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN jsonb_build_object(
    'paciente', jsonb_build_object('id', pa.id, 'nome', pa.nome, 'nome_social', pa.nome_social, 'sexo', pa.sexo,
                                   'data_nascimento', pa.data_nascimento),
    'pode_registrar', private.vacina_pode_registrar(pa.unidade_id),
    'hoje', private.data_atual(),
    -- RF6 (RT, 23/11/2026): em atraso ou a completar, pelas notas da SAPS
    'pendencias', private.vacina_pendencias(pa),
    'registros', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', v.id, 'registro_anterior', v.registro_anterior, 'data_aplicacao', v.data_aplicacao,
               'imunobiologico', v.imunobiologico, 'imunobiologico_nome', i.nome, 'sigla', i.sigla,
               'estrategia', e.nome, 'dose', dz.nome, 'lote', v.lote, 'fabricante', f.nome,
               'via', vi.nome, 'local', lo.nome, 'aplicado_exterior', v.aplicado_exterior,
               'registrado_por', pr.nome_completo, 'registrado_em', v.registrado_em,
               'cancelado', v.cancelado_em IS NOT NULL, 'motivo_cancelamento', v.motivo_cancelamento,
               'meu', v.registrado_por = private.meu_perfil_id())
             ORDER BY v.data_aplicacao DESC, v.registrado_em DESC)
        FROM public.vacinacoes v
        JOIN terminologia.vacina_imunobiologico i ON i.codigo = v.imunobiologico
        JOIN terminologia.vacina_dose dz ON dz.codigo = v.dose
        JOIN terminologia.vacina_via vi ON vi.codigo = v.via
        JOIN terminologia.vacina_local lo ON lo.codigo = v.local
        LEFT JOIN terminologia.vacina_estrategia e ON e.codigo = v.estrategia
        LEFT JOIN terminologia.vacina_fabricante f ON f.codigo_rnds = v.fabricante
        LEFT JOIN public.perfis pr ON pr.id = v.registrado_por
       WHERE v.paciente_id = pa.id), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.vacina_caderneta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vacina_caderneta(uuid) TO authenticated;
