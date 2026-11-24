-- ════════════════════════════════════════════════════════════════════════════
-- Pedido 8 do RT (17/11/2026), "Meu plantão": dividir o descanso dos médicos.
-- Decisões do RT em 23/11/2026 (docs/plantonista/PASSOMETRO-DIAGNOSTICO.md):
--   PS4: o app divide igual entre os médicos, com quatro dados digitados por
--        quem divide: quais médicos (os da escala do turno vêm marcados e a
--        lista se ajusta se alguém faltou ou chegou outro), a hora de início,
--        a hora de fim e o mínimo de médicos ACORDADOS em cada horário.
--        Cada médico descansa o mesmo tempo: (fim - início) x (N - mínimo) / N.
--   PS5 = A: a enfermagem e o gestor veem, só para leitura, quem está
--        descansando agora e quem está acordado.
--
-- Divisão igual (regra de McNaughton): os descansos são enfileirados em
-- N - mínimo "faixas" do tamanho da janela; quem cai na virada de uma faixa
-- descansa no fim da janela e no começo dela. Assim, em nenhum minuto há mais
-- de N - mínimo médicos descansando, e todos descansam o mesmo tanto.
--
-- • public.descanso_divisoes: uma divisão por janela, com os blocos de cada
--   médico (nome copiado na hora). Refazer guarda a anterior (substituida_em).
-- • public.medicos_para_descanso(unidade): os médicos da unidade, marcando
--   quem está na escala agora.
-- • public.dividir_descanso(...): só o médico de plantão na unidade agora.
-- • public.descanso_do_plantao(unidade): a divisão em curso ou a próxima,
--   com quem descansa e quem está acordado agora; para médico, enfermagem e
--   gestor da unidade.
--
-- Expand: uma tabela e quatro funções. Idempotente.
-- Volta: supabase/snippets/descanso_plantao_rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.descanso_divisoes (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id       uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  inicio           timestamptz NOT NULL,
  fim              timestamptz NOT NULL,
  minimo_acordados integer NOT NULL CHECK (minimo_acordados >= 1),
  medicos          uuid[] NOT NULL,
  blocos           jsonb NOT NULL CHECK (jsonb_typeof(blocos) = 'array'),
  criada_por       uuid NOT NULL REFERENCES public.perfis(id),
  criada_em        timestamptz NOT NULL DEFAULT now(),
  substituida_em   timestamptz,
  CONSTRAINT descanso_janela CHECK (fim > inicio AND fim <= inicio + interval '14 hours'),
  CONSTRAINT descanso_minimo CHECK (minimo_acordados < cardinality(medicos))
);
COMMENT ON TABLE public.descanso_divisoes IS
  'Divisão do descanso dos médicos de plantão (pedido 8; PS4 e PS5). Escrita só por dividir_descanso; leitura por descanso_do_plantao.';
CREATE INDEX IF NOT EXISTS descanso_divisoes_unidade_fim ON public.descanso_divisoes (unidade_id, fim) WHERE substituida_em IS NULL;

ALTER TABLE public.descanso_divisoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.descanso_divisoes FROM PUBLIC, anon, authenticated;

-- ── os blocos da divisão igual ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.blocos_descanso(p_inicio timestamptz, p_fim timestamptz, p_minimo int, p_medicos uuid[])
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  n int := cardinality(p_medicos);
  t int := floor(extract(epoch FROM p_fim - p_inicio) / 60)::int;
  r int := n - p_minimo;
  l int;
  pos int := 0;
  off int;
  i int;
  saida jsonb := '[]'::jsonb;
BEGIN
  l := (t * r) / n;   -- minutos de descanso de cada um (para baixo)
  FOR i IN 1 .. n LOOP
    off := pos % t;
    IF off + l <= t THEN
      saida := saida || jsonb_build_array(jsonb_build_object('perfil_id', p_medicos[i],
        'inicio', p_inicio + make_interval(mins => off), 'fim', p_inicio + make_interval(mins => off + l)));
    ELSE
      saida := saida
        || jsonb_build_array(jsonb_build_object('perfil_id', p_medicos[i],
             'inicio', p_inicio + make_interval(mins => off), 'fim', p_inicio + make_interval(mins => t)))
        || jsonb_build_array(jsonb_build_object('perfil_id', p_medicos[i],
             'inicio', p_inicio, 'fim', p_inicio + make_interval(mins => off + l - t)));
    END IF;
    pos := pos + l;
  END LOOP;
  RETURN saida;
END $$;
REVOKE ALL ON FUNCTION private.blocos_descanso(timestamptz, timestamptz, int, uuid[]) FROM PUBLIC, anon, authenticated;

-- ── quem pode entrar na divisão ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.medicos_para_descanso(p_unidade uuid)
RETURNS TABLE (perfil_id uuid, nome text, na_escala boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_unidade IS NULL OR NOT private.tenho_papel(p_unidade, 'plantonista') THEN
    RAISE EXCEPTION 'Acesso negado: a divisão do descanso é dos médicos de plantão.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT p.id, p.nome_completo,
           EXISTS (SELECT 1 FROM public.escala_plantao e
                    WHERE e.unidade_id = p_unidade AND e.perfil_id = p.id AND e.ativo
                      AND e.inicio <= now() + interval '2 hours'
                      AND now() < e.inicio + make_interval(mins => e.duracao_min))
      FROM public.vinculos v
      JOIN public.perfis p ON p.id = v.perfil_id
     WHERE v.unidade_id = p_unidade AND v.ativo AND v.papel = 'plantonista'
     ORDER BY 3 DESC, 2;
END $$;

-- ── dividir (ou refazer) ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dividir_descanso(p_unidade uuid, p_inicio timestamptz, p_fim timestamptz,
                                                   p_minimo integer, p_medicos uuid[])
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_eu uuid := private.meu_perfil_id();
  v_medicos uuid[];
  v_blocos jsonb;
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF p_unidade IS NULL OR NOT private.tenho_papel(p_unidade, 'plantonista') THEN
    RAISE EXCEPTION 'Acesso negado: a divisão do descanso é dos médicos de plantão.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM private.plantoes_agora() x WHERE x.unidade_id = p_unidade) THEN
    RAISE EXCEPTION 'Só quem está de plantão nesta unidade agora divide o descanso.';
  END IF;
  SELECT array_agg(m ORDER BY o) INTO v_medicos
    FROM (SELECT DISTINCT ON (m) m, o FROM unnest(p_medicos) WITH ORDINALITY AS u(m, o) WHERE m IS NOT NULL ORDER BY m, o) d;
  IF coalesce(cardinality(v_medicos), 0) < 2 THEN
    RAISE EXCEPTION 'Escolha pelo menos dois médicos para dividir o descanso.';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_medicos) m
              WHERE NOT EXISTS (SELECT 1 FROM public.vinculos v
                                 WHERE v.perfil_id = m AND v.unidade_id = p_unidade AND v.ativo AND v.papel = 'plantonista')) THEN
    RAISE EXCEPTION 'Há na lista quem não é médico desta unidade.';
  END IF;
  IF p_minimo IS NULL OR p_minimo < 1 OR p_minimo >= cardinality(v_medicos) THEN
    RAISE EXCEPTION 'O mínimo acordado vai de 1 até um a menos que o número de médicos.';
  END IF;
  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim <= p_inicio OR p_fim > p_inicio + interval '14 hours' THEN
    RAISE EXCEPTION 'A divisão termina depois de começar, em no máximo 14 horas.';
  END IF;
  IF p_fim < now() OR p_inicio > now() + interval '24 hours' THEN
    RAISE EXCEPTION 'A divisão é deste plantão: não pode ter terminado nem começar daqui a mais de 24 horas.';
  END IF;

  SELECT jsonb_agg(b || jsonb_build_object('nome', p.nome_completo) ORDER BY (b->>'inicio'))
    INTO v_blocos
    FROM jsonb_array_elements(private.blocos_descanso(p_inicio, p_fim, p_minimo, v_medicos)) b
    JOIN public.perfis p ON p.id = (b->>'perfil_id')::uuid;

  -- refazer: a divisão que cruza esta janela fica guardada como substituída
  UPDATE public.descanso_divisoes d SET substituida_em = now()
   WHERE d.unidade_id = p_unidade AND d.substituida_em IS NULL
     AND d.inicio < p_fim AND p_inicio < d.fim;

  INSERT INTO public.descanso_divisoes (unidade_id, inicio, fim, minimo_acordados, medicos, blocos, criada_por)
  VALUES (p_unidade, p_inicio, p_fim, p_minimo, v_medicos, v_blocos, v_eu)
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('dividir_descanso', 'descanso_divisoes', v_id, NULL,
    jsonb_build_object('unidade_id', p_unidade, 'inicio', p_inicio, 'fim', p_fim, 'minimo', p_minimo, 'medicos', cardinality(v_medicos)));
  RETURN jsonb_build_object('id', v_id, 'blocos', v_blocos);
END $$;

-- ── a divisão em curso (ou a próxima) e quem está acordado agora ────────────
CREATE OR REPLACE FUNCTION public.descanso_do_plantao(p_unidade uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE d public.descanso_divisoes;
BEGIN
  IF p_unidade IS NULL OR NOT (private.tenho_papel(p_unidade, 'plantonista') OR private.tenho_papel(p_unidade, 'enfermeiro')
       OR private.tenho_papel(p_unidade, 'tecnico_enfermagem') OR private.tenho_papel(p_unidade, 'gestor')) THEN
    RAISE EXCEPTION 'Acesso negado: o descanso é visto pelos médicos, pela enfermagem e pelo gestor da unidade.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO d FROM public.descanso_divisoes x
   WHERE x.unidade_id = p_unidade AND x.substituida_em IS NULL
     AND x.fim > now() AND x.inicio < now() + interval '18 hours'
   ORDER BY x.inicio LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'id', d.id, 'inicio', d.inicio, 'fim', d.fim, 'minimo_acordados', d.minimo_acordados,
    'criada_em', d.criada_em,
    'criada_por', (SELECT p.nome_completo FROM public.perfis p WHERE p.id = d.criada_por),
    'blocos', d.blocos,
    'medicos', (SELECT jsonb_agg(jsonb_build_object('perfil_id', m, 'nome', p.nome_completo,
                  'descansando', EXISTS (SELECT 1 FROM jsonb_array_elements(d.blocos) b
                                          WHERE (b->>'perfil_id')::uuid = m
                                            AND (b->>'inicio')::timestamptz <= now() AND now() < (b->>'fim')::timestamptz))
                  ORDER BY o)
                  FROM unnest(d.medicos) WITH ORDINALITY AS u(m, o)
                  JOIN public.perfis p ON p.id = m));
END $$;

REVOKE ALL ON FUNCTION public.medicos_para_descanso(uuid), public.dividir_descanso(uuid, timestamptz, timestamptz, integer, uuid[]),
  public.descanso_do_plantao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.medicos_para_descanso(uuid), public.dividir_descanso(uuid, timestamptz, timestamptz, integer, uuid[]),
  public.descanso_do_plantao(uuid) TO authenticated;
