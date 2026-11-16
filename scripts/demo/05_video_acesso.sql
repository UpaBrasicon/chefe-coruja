-- ════════════════════════════════════════════════════════════════════════════
-- Vídeo de venda (backlog comercial, item 8): acesso da coordenadora fictícia.
--
-- O gravar-video.mjs entra como a coordenadora (Simone Aparecida Prado,
-- d0300000-…-0001), que só é gestora. Para o vídeo mostrar a recepção, a
-- triagem, o atendimento e a Central do Plantonista, este roteiro dá a ela,
-- na UPA 24h Jardim Primavera:
--   • os papéis plantonista, enfermeiro e recepção (religa se estavam desligados);
--   • a escala de hoje no Pronto Socorro, como plantonista, nos turnos que
--     ainda não acabaram (turno com sobreposição fica de fora e aparece no aviso);
--   • o check-in desses plantões já começados, dentro da cerca da unidade,
--     como o 02 faz com a equipe fictícia (sem ele, a porta do médico fecha
--     30 min depois do início do turno).
--
-- SÓ NA HOMOLOGAÇÃO. Repetível. Rodar depois do 02, no dia da gravação.
-- O 99 apaga tudo junto com a rede.
--
-- Uso (homologação): npx supabase db query --linked -f scripts/demo/05_video_acesso.sql
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

DO $$
DECLARE
  v_id      constant uuid := 'd0300000-0000-4000-8000-000000000001';  -- Simone Aparecida Prado
  v_unidade constant uuid := 'd0100000-0000-4000-8000-000000000001';  -- UPA 24h Jardim Primavera
  v_ps      constant uuid := 'd0200000-0000-4000-8000-000000000001';  -- Pronto Socorro
  v_hoje    date := private.data_atual();
  v_papel   text;
  p         record;
  v_conflito text;
  v_fora    text[] := '{}';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.unidades WHERE id = '31000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'Este banco não é a homologação (falta a UPA Homologação). Confira o projeto ligado (kswurfyxxvfydpjfrivy).';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.perfis WHERE id = v_id) THEN
    RAISE EXCEPTION 'A coordenadora fictícia não existe: rode antes scripts/demo/01_rede_demonstracao.sql.';
  END IF;

  FOREACH v_papel IN ARRAY ARRAY['plantonista', 'enfermeiro', 'recepcao'] LOOP
    UPDATE public.vinculos SET ativo = true
     WHERE perfil_id = v_id AND unidade_id = v_unidade AND papel = v_papel::public.papel AND NOT ativo;
    INSERT INTO public.vinculos (perfil_id, unidade_id, papel)
    SELECT v_id, v_unidade, v_papel::public.papel
     WHERE NOT EXISTS (SELECT 1 FROM public.vinculos
                        WHERE perfil_id = v_id AND unidade_id = v_unidade AND papel = v_papel::public.papel);
  END LOOP;

  FOR p IN SELECT x.data, x.turno FROM (VALUES (v_hoje - 1, 'noite'), (v_hoje, 'manha'), (v_hoje, 'tarde'), (v_hoje, 'noite')) x(data, turno)
            WHERE now() < private.inicio_do_turno(x.data, x.turno) + make_interval(mins => private.duracao_padrao(x.turno)) LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.escala_plantao e WHERE e.perfil_id = v_id AND e.setor_id = v_ps
                            AND e.data = p.data AND e.turno = p.turno AND e.ativo);
    v_conflito := private.conflito_escala(v_id, private.inicio_do_turno(p.data, p.turno), private.duracao_padrao(p.turno), NULL);
    IF v_conflito IS NOT NULL THEN
      v_fora := v_fora || (p.turno || ' de ' || to_char(p.data, 'DD/MM') || ': ' || v_conflito);
      CONTINUE;
    END IF;
    UPDATE public.escala_plantao SET ativo = true
     WHERE perfil_id = v_id AND setor_id = v_ps AND data = p.data AND turno = p.turno AND NOT ativo;
    INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, papel, observacao, criado_por)
    VALUES (v_unidade, v_ps, v_id, p.data, p.turno, 'plantonista', 'vídeo de venda', v_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  IF cardinality(v_fora) > 0 THEN
    RAISE NOTICE 'Fora da escala do vídeo (sobreposição): %', array_to_string(v_fora, '; ');
  END IF;
END $$;

-- check-in dos plantões já começados, dentro da cerca (como o 02)
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em,
                                         checkin_lat, checkin_lng, checkin_dentro, checkin_distancia_m)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno,
       least(e.inicio + make_interval(mins => 3), now()), u.latitude, u.longitude, true, 18
  FROM public.escala_plantao e
  JOIN public.unidades u ON u.id = e.unidade_id
 WHERE e.ativo AND e.perfil_id = 'd0300000-0000-4000-8000-000000000001'
   AND e.unidade_id = 'd0100000-0000-4000-8000-000000000001'
   AND e.inicio <= now() AND e.inicio > now() - interval '24 hours'
ON CONFLICT DO NOTHING;

-- itens para a cena da checagem: cuidados prescritos pela coordenadora (como
-- plantonista) para os pacientes em atendimento na porta, e um deles checado
-- (como enfermeira). Só cuidados: o roteiro não inventa dose.
CREATE OR REPLACE FUNCTION pg_temp.demo_como(p_perfil uuid, p_sql text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE v text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_perfil, 'role', 'authenticated', 'aal', 'aal2')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  EXECUTE p_sql INTO v;
  PERFORM set_config('role', 'postgres', true);
  RETURN v;
END $f$;

DO $$
DECLARE
  v_id constant uuid := 'd0300000-0000-4000-8000-000000000001';
  e record;
  v_item uuid;
  v_n int := 0;
BEGIN
  FOR e IN SELECT ep.paciente_id FROM public.episodios ep
            WHERE ep.unidade_id = 'd0100000-0000-4000-8000-000000000001' AND ep.etapa = 'atendimento'
              AND ep.atendimento_iniciado_em IS NOT NULL AND ep.encerrado_em IS NULL
            ORDER BY ep.chegada_em LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.prescricao_itens i JOIN public.prescricoes pr ON pr.id = i.prescricao_id
                           WHERE pr.paciente_id = e.paciente_id AND i.descricao = 'Cabeceira elevada');
    PERFORM pg_temp.demo_como(v_id, format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e.paciente_id,
                                           jsonb_build_object('tipo', 'cuidado', 'descricao', 'Cabeceira elevada')));
    PERFORM pg_temp.demo_como(v_id, format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e.paciente_id,
                                           jsonb_build_object('tipo', 'cuidado', 'descricao', 'Sinais vitais')));
    v_n := v_n + 1;
    -- o primeiro paciente sai com a cabeceira já checada
    IF v_n = 1 THEN
      SELECT i.id INTO v_item FROM public.prescricao_itens i JOIN public.prescricoes pr ON pr.id = i.prescricao_id
       WHERE pr.paciente_id = e.paciente_id AND i.descricao = 'Cabeceira elevada' ORDER BY i.created_at DESC LIMIT 1;
      PERFORM pg_temp.demo_como(v_id, format('SELECT public.checar(%L::uuid, %L)::text', v_item, 'feito'));
    END IF;
  END LOOP;
  RAISE NOTICE 'Cuidados prescritos para % paciente(s) em atendimento.', v_n;
END $$;

COMMIT;

SELECT 'acesso da coordenadora para o vídeo' AS situacao,
       (SELECT string_agg(v.papel::text, ', ' ORDER BY v.papel::text) FROM public.vinculos v
         WHERE v.perfil_id = 'd0300000-0000-4000-8000-000000000001' AND v.ativo) AS papeis,
       (SELECT count(*) FROM public.escala_plantao e WHERE e.perfil_id = 'd0300000-0000-4000-8000-000000000001'
           AND e.ativo AND e.data >= private.data_atual() - 1 AND e.observacao = 'vídeo de venda') AS plantoes_video,
       (SELECT count(*) FROM public.presenca_plantonista pr WHERE pr.perfil_id = 'd0300000-0000-4000-8000-000000000001'
           AND pr.data >= private.data_atual() - 1) AS checkins;
