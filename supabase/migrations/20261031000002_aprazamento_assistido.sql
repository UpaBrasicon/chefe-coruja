-- Fase 2, tarefa 2 do BACKLOG.md — aprazamento assistido.
--
-- Decisão do RT (08/10/2026): grade de horários configurável por unidade (sem
-- configuração, o dia começa às 06h); a enfermagem ajusta caso a caso, com
-- registro de quem alterou.
--   • a frequência sai da posologia escrita pelo médico ("8/8h", "de 6 em 6
--     horas", "a cada 12 h", "2x ao dia", "1x/dia"); só intervalos que dividem
--     o dia (1, 2, 3, 4, 6, 8, 12, 24 h) têm grade — o resto (48/48h, 5/5h,
--     "agora", "se necessário", "contínuo") fica com o enfermeiro;
--   • a sugestão vem da grade da unidade para aquele intervalo; sem ela, do
--     horário de início da unidade somando o intervalo;
--   • "respeitar o início": a sugestão diz qual é o primeiro horário da grade
--     depois da hora da prescrição;
--   • aprazar() guarda cada aprazamento (sugerido, escolhido, quem, quando e o
--     motivo, quando houver) — nada se apaga.
-- Só aditiva, salvo aprazar(), que ganha o parâmetro p_motivo (DROP e CREATE
-- no mesmo arquivo; o app chama por nome).
--
-- ROLLBACK: reaplicar public.aprazar(uuid, text[]) de 20260929000006; DROP das
--   funções e da tabela novas; DELETE FROM configuracoes_unidade WHERE chave = 'aprazamento_grade'.

-- ── frequência na posologia ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.intervalo_posologia(p text)
RETURNS int LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE t text := lower(coalesce(p, '')); m text[]; n int;
BEGIN
  m := regexp_match(t, '(\d{1,2})\s*/\s*(\d{1,2})\s*(h|hs|hora|horas)\M');
  IF m IS NOT NULL AND m[1] = m[2] THEN n := m[1]::int; END IF;
  IF n IS NULL THEN
    m := regexp_match(t, 'de\s+(\d{1,2})\s+em\s+(\d{1,2})\s*(h|hs|hora|horas)\M');
    IF m IS NOT NULL AND m[1] = m[2] THEN n := m[1]::int; END IF;
  END IF;
  IF n IS NULL THEN
    m := regexp_match(t, 'a\s+cada\s+(\d{1,2})\s*(h|hs|hora|horas)\M');
    IF m IS NOT NULL THEN n := m[1]::int; END IF;
  END IF;
  IF n IS NULL THEN
    m := regexp_match(t, '(\d{1,2})\s*(x|vez|vezes)\s*(ao|por|/|a)?\s*dia');
    IF m IS NOT NULL AND m[1]::int BETWEEN 1 AND 24 AND 24 % m[1]::int = 0 THEN n := 24 / m[1]::int; END IF;
  END IF;
  IF n IS NULL AND t ~ 'uma\s+vez\s+(ao|por)\s+dia' THEN n := 24; END IF;
  IF n IS NULL AND t ~ 'duas\s+vezes\s+(ao|por)\s+dia' THEN n := 12; END IF;
  IF n IS NULL AND t ~ 'tr[eê]s\s+vezes\s+(ao|por)\s+dia' THEN n := 8; END IF;
  IF n IS NULL AND t ~ 'quatro\s+vezes\s+(ao|por)\s+dia' THEN n := 6; END IF;
  RETURN CASE WHEN n IN (1, 2, 3, 4, 6, 8, 12, 24) THEN n END;
END $$;

-- ── grade da unidade ───────────────────────────────────────────────────────
-- configuracoes_unidade.chave = 'aprazamento_grade', valor = JSON
--   {"inicio": "06:00", "grades": {"8": ["07:00","15:00","23:00"], ...}}
CREATE OR REPLACE FUNCTION private.horarios_por_intervalo(p_inicio text, p_intervalo int)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT array_agg(h ORDER BY h) FROM (
    SELECT to_char(time '00:00' + make_interval(mins => (split_part(p_inicio, ':', 1)::int * 60 + split_part(p_inicio, ':', 2)::int
                                                         + k * p_intervalo * 60) % 1440), 'HH24:MI') AS h
      FROM generate_series(0, 24 / p_intervalo - 1) k) x;
$$;

CREATE OR REPLACE FUNCTION private.grade_aprazamento(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE cfg jsonb; v_inicio text := '06:00'; v_grades jsonb := '{}'; i int; g jsonb;
BEGIN
  BEGIN
    SELECT c.valor::jsonb INTO cfg FROM public.configuracoes_unidade c WHERE c.unidade_id = p_unidade AND c.chave = 'aprazamento_grade';
  EXCEPTION WHEN others THEN cfg := NULL;
  END;
  IF cfg ->> 'inicio' ~ '^([01]\d|2[0-3]):[0-5]\d$' THEN v_inicio := cfg ->> 'inicio'; END IF;
  FOREACH i IN ARRAY ARRAY[1, 2, 3, 4, 6, 8, 12, 24] LOOP
    g := cfg -> 'grades' -> i::text;
    IF jsonb_typeof(g) = 'array' AND jsonb_array_length(g) = 24 / i THEN
      v_grades := v_grades || jsonb_build_object(i::text, jsonb_build_object('horarios',
                    (SELECT jsonb_agg(x ORDER BY x) FROM jsonb_array_elements_text(g) x), 'origem', 'grade da unidade'));
    ELSE
      v_grades := v_grades || jsonb_build_object(i::text, jsonb_build_object('horarios',
                    to_jsonb(private.horarios_por_intervalo(v_inicio, i)),
                    'origem', CASE WHEN cfg IS NULL THEN 'padrão (início às 06:00)' ELSE 'início da unidade às ' || v_inicio END));
    END IF;
  END LOOP;
  RETURN jsonb_build_object('inicio', v_inicio, 'configurada', cfg IS NOT NULL, 'grades', v_grades,
    'atualizado_em', (SELECT c.updated_at FROM public.configuracoes_unidade c WHERE c.unidade_id = p_unidade AND c.chave = 'aprazamento_grade'));
END $$;
REVOKE ALL ON FUNCTION private.grade_aprazamento(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.grade_aprazamento_da_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.membro_da_unidade(p_unidade) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  RETURN private.grade_aprazamento(p_unidade);
END $$;
REVOKE ALL ON FUNCTION public.grade_aprazamento_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grade_aprazamento_da_unidade(uuid) TO authenticated;

-- o gestor salva o início do dia e, se quiser, a grade de cada intervalo
CREATE OR REPLACE FUNCTION public.salvar_grade_aprazamento(p_unidade uuid, p_inicio text, p_grades jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE k text; g jsonb; h text; v_grades jsonb := '{}';
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.gestor_da_unidade(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: a grade de aprazamento é do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF coalesce(p_inicio, '') !~ '^([01]\d|2[0-3]):[0-5]\d$' THEN RAISE EXCEPTION 'Início inválido (use HH:MM).'; END IF;
  FOR k, g IN SELECT * FROM jsonb_each(coalesce(p_grades, '{}')) LOOP
    IF k NOT IN ('1', '2', '3', '4', '6', '8', '12', '24') THEN
      RAISE EXCEPTION 'Intervalo % não tem grade (só 1, 2, 3, 4, 6, 8, 12 e 24 h).', k;
    END IF;
    IF jsonb_typeof(g) <> 'array' OR jsonb_array_length(g) <> 24 / k::int THEN
      RAISE EXCEPTION 'A grade de %/% h tem % horários.', k, k, 24 / k::int;
    END IF;
    FOR h IN SELECT jsonb_array_elements_text(g) LOOP
      IF h !~ '^([01]\d|2[0-3]):[0-5]\d$' THEN RAISE EXCEPTION 'Horário inválido na grade de %/% h: % (use HH:MM).', k, k, h; END IF;
    END LOOP;
    IF (SELECT count(DISTINCT x) FROM jsonb_array_elements_text(g) x) <> 24 / k::int THEN
      RAISE EXCEPTION 'A grade de %/% h repete horário.', k, k;
    END IF;
    v_grades := v_grades || jsonb_build_object(k, g);
  END LOOP;
  INSERT INTO public.configuracoes_unidade (unidade_id, chave, valor, descricao)
  VALUES (p_unidade, 'aprazamento_grade', jsonb_build_object('inicio', p_inicio, 'grades', v_grades)::text,
          'Grade de aprazamento da unidade: início do dia e horários por intervalo')
  ON CONFLICT (unidade_id, chave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()
  WHERE public.configuracoes_unidade.valor IS DISTINCT FROM EXCLUDED.valor;
  PERFORM private.registrar_auditoria('salvar_grade_aprazamento', 'configuracoes_unidade', NULL, p_unidade,
    jsonb_build_object('inicio', p_inicio, 'grades', v_grades));
  RETURN private.grade_aprazamento(p_unidade);
END $$;
REVOKE ALL ON FUNCTION public.salvar_grade_aprazamento(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_grade_aprazamento(uuid, text, jsonb) TO authenticated;

-- ── sugestão para um item ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.sugestao_aprazamento(p_item uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE it public.prescricao_itens; pr public.prescricoes; v_int int; g jsonb; v_hora text; v_primeira text;
BEGIN
  SELECT * INTO it FROM public.prescricao_itens WHERE id = p_item;
  IF NOT FOUND OR it.se_necessario THEN RETURN NULL; END IF;
  v_int := private.intervalo_posologia(it.posologia);
  IF v_int IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO pr FROM public.prescricoes WHERE id = it.prescricao_id;
  g := private.grade_aprazamento(pr.unidade_id) -> 'grades' -> v_int::text;
  -- primeiro horário da grade a partir da hora da prescrição (Brasília)
  v_hora := to_char(it.created_at AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
  SELECT coalesce(min(x) FILTER (WHERE x >= v_hora), min(x)) INTO v_primeira FROM jsonb_array_elements_text(g -> 'horarios') x;
  RETURN jsonb_build_object('intervalo_h', v_int, 'horarios', g -> 'horarios', 'origem', g ->> 'origem',
    'primeira', v_primeira, 'prescrito_as', v_hora);
END $$;
REVOKE ALL ON FUNCTION private.sugestao_aprazamento(uuid) FROM PUBLIC, anon;

-- ── histórico de aprazamento ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.aprazamentos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id     uuid NOT NULL REFERENCES public.prescricao_itens(id),
  unidade_id  uuid NOT NULL REFERENCES public.unidades(id),
  horarios    text[] NOT NULL,
  sugeridos   text[],
  ajustado    boolean NOT NULL,          -- escolhido difere da sugestão (ou não havia sugestão)
  motivo      text,
  por         uuid NOT NULL REFERENCES public.perfis(id),
  em          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS aprazamentos_item ON public.aprazamentos (item_id, em DESC);
ALTER TABLE public.aprazamentos ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.aprazamentos FROM authenticated, anon;
DROP POLICY IF EXISTS aprazamentos_select ON public.aprazamentos;
CREATE POLICY aprazamentos_select ON public.aprazamentos FOR SELECT TO authenticated
  USING (private.membro_da_unidade(unidade_id));
CREATE OR REPLACE FUNCTION private.aprazamento_so_insercao() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'Aprazamento é só de inserção: aprazar de novo.'; END $$;
DROP TRIGGER IF EXISTS aprazamentos_so_insercao ON public.aprazamentos;
CREATE TRIGGER aprazamentos_so_insercao BEFORE UPDATE OR DELETE ON public.aprazamentos
  FOR EACH ROW EXECUTE FUNCTION private.aprazamento_so_insercao();

DROP FUNCTION IF EXISTS public.aprazar(uuid, text[]);
CREATE OR REPLACE FUNCTION public.aprazar(p_item uuid, p_horarios text[], p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE it public.prescricao_itens; pr public.prescricoes; h text; v_lista text[]; v_sug text[];
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO it FROM public.prescricao_itens WHERE id = p_item;
  IF NOT FOUND OR it.suspenso_em IS NOT NULL THEN RAISE EXCEPTION 'Item não encontrado ou suspenso.'; END IF;
  SELECT * INTO pr FROM public.prescricoes WHERE id = it.prescricao_id;
  IF private.tenho_papel(pr.unidade_id, 'enfermeiro') IS NOT TRUE OR NOT private.paciente_no_meu_plantao(pr.paciente_id) THEN
    RAISE EXCEPTION 'O aprazamento é do enfermeiro de plantão no setor do paciente.';
  END IF;
  FOREACH h IN ARRAY coalesce(p_horarios, '{}') LOOP
    IF h !~ '^([01]\d|2[0-3]):[0-5]\d$' THEN RAISE EXCEPTION 'Horário inválido: % (use HH:MM).', h; END IF;
  END LOOP;
  v_lista := coalesce((SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest(p_horarios) x), '{}');
  SELECT array_agg(x ORDER BY x) INTO v_sug FROM jsonb_array_elements_text(private.sugestao_aprazamento(it.id) -> 'horarios') x;
  UPDATE public.prescricao_itens SET horarios = v_lista WHERE id = it.id;
  INSERT INTO public.aprazamentos (item_id, unidade_id, horarios, sugeridos, ajustado, motivo, por)
  VALUES (it.id, pr.unidade_id, v_lista, v_sug, v_sug IS DISTINCT FROM v_lista,
          nullif(btrim(coalesce(p_motivo, '')), ''), private.meu_perfil_id());
END $$;
REVOKE ALL ON FUNCTION public.aprazar(uuid, text[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprazar(uuid, text[], text) TO authenticated;

-- ── leitura para a Checagem: sugestão e último aprazamento de cada item ────
CREATE OR REPLACE FUNCTION public.sugestoes_aprazamento(p_itens uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'item_id', it.id,
           'sugestao', private.sugestao_aprazamento(it.id),
           'ultimo', (SELECT jsonb_build_object('horarios', a.horarios, 'sugeridos', a.sugeridos, 'ajustado', a.ajustado,
                                                'motivo', a.motivo, 'por', p.nome_completo, 'em', a.em)
                        FROM public.aprazamentos a LEFT JOIN public.perfis p ON p.id = a.por
                       WHERE a.item_id = it.id ORDER BY a.em DESC LIMIT 1))), '[]'::jsonb)
    FROM public.prescricao_itens it
    JOIN public.prescricoes pr ON pr.id = it.prescricao_id
   WHERE it.id = ANY (p_itens) AND private.segundo_fator_ok() AND private.membro_da_unidade(pr.unidade_id);
$$;
REVOKE ALL ON FUNCTION public.sugestoes_aprazamento(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sugestoes_aprazamento(uuid[]) TO authenticated;
