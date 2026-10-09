-- Fase 2, tarefa 5 do BACKLOG.md — Fugulin (classificação de pacientes), 12 áreas.
--
-- Decisão do RT (08 e 09/10/2026): enfermeiro, uma vez por dia, na internação,
-- com fonte e histórico; versão de 12 áreas (Fugulin et al. 2005 + Santos et
-- al. 2007), intensivo acima de 34; na tela só um resumo de cada graduação
-- (src/clinico/enfermagem/fugulin.ts), sem o texto dos artigos.
--   • instrumento do adulto: criança (até 13 anos, 11 meses e 29 dias) não se
--     classifica pelo Fugulin (nada se converte do adulto);
--   • uma classificação vigente por internação por dia (Brasília). Corrigir
--     no mesmo dia é retificar: pede motivo, a anterior fica guardada;
--   • o servidor refaz a soma e a categoria.
-- Só aditiva.
--
-- ROLLBACK: DROP FUNCTION public.registrar_fugulin, public.fugulin_da_internacao,
--   public.fugulin_de_hoje, private.fugulin_definicao; DROP TABLE public.classificacoes_fugulin.

CREATE OR REPLACE FUNCTION private.fugulin_definicao()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT '{"versao":"2026-10-09.1",
    "areas":["estado_mental","oxigenacao","sinais_vitais","motilidade","deambulacao","alimentacao",
             "cuidado_corporal","eliminacao","terapeutica","integridade_pele","curativo","tempo_curativo"],
    "faixas":[[12,"Cuidados mínimos (12 a 17)"],[18,"Cuidados intermediários (18 a 22)"],[23,"Alta dependência (23 a 28)"],
              [29,"Cuidados semi-intensivos (29 a 34)"],[35,"Cuidados intensivos (acima de 34)"]]}'::jsonb
$$;
REVOKE ALL ON FUNCTION private.fugulin_definicao() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.classificacoes_fugulin (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id    uuid NOT NULL REFERENCES public.pacientes(id),
  internacao_id  uuid NOT NULL REFERENCES public.internacoes(id),
  dia            date NOT NULL,
  versao         text NOT NULL,
  respostas      jsonb NOT NULL,
  total          int NOT NULL CHECK (total BETWEEN 12 AND 48),
  categoria      text NOT NULL,
  retifica_id    uuid REFERENCES public.classificacoes_fugulin(id),
  motivo         text,
  registrado_por uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS classificacoes_fugulin_internacao ON public.classificacoes_fugulin (internacao_id, dia DESC, registrado_em DESC);
ALTER TABLE public.classificacoes_fugulin ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.classificacoes_fugulin FROM authenticated, anon;
DROP POLICY IF EXISTS classificacoes_fugulin_select ON public.classificacoes_fugulin;
CREATE POLICY classificacoes_fugulin_select ON public.classificacoes_fugulin FOR SELECT TO authenticated
  USING (private.membro_da_unidade(unidade_id));
CREATE OR REPLACE FUNCTION private.fugulin_so_insercao() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'Classificação Fugulin é só de inserção: para corrigir, retifique.'; END $$;
DROP TRIGGER IF EXISTS classificacoes_fugulin_so_insercao ON public.classificacoes_fugulin;
CREATE TRIGGER classificacoes_fugulin_so_insercao BEFORE UPDATE OR DELETE ON public.classificacoes_fugulin
  FOR EACH ROW EXECUTE FUNCTION private.fugulin_so_insercao();

CREATE OR REPLACE FUNCTION public.registrar_fugulin(p_internacao uuid, p_respostas jsonb, p_motivo text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d jsonb := private.fugulin_definicao();
  i public.internacoes; pa public.pacientes;
  k text; v_total int := 0; v_cat text; f jsonb; v_dia date := private.data_atual();
  v_ant uuid; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF i.id IS NULL THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.data_alta IS NOT NULL OR i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN RAISE EXCEPTION 'A internação não está ativa.'; END IF;
  IF private.tenho_papel(i.unidade_id, 'enfermeiro') IS NOT TRUE OR NOT private.paciente_no_meu_plantao(i.paciente_id) THEN
    RAISE EXCEPTION 'O Fugulin é do enfermeiro de plantão no setor do paciente.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO pa FROM public.pacientes WHERE id = i.paciente_id;
  IF pa.data_nascimento IS NOT NULL AND age(v_dia, pa.data_nascimento) < interval '14 years' THEN
    RAISE EXCEPTION 'Fugulin é instrumento do adulto: na criança não se usa (nada se converte do adulto).';
  END IF;
  IF p_respostas IS NULL OR jsonb_typeof(p_respostas) <> 'object' THEN RAISE EXCEPTION 'Responda as 12 áreas.'; END IF;
  FOR k IN SELECT jsonb_object_keys(p_respostas) LOOP
    IF NOT (d -> 'areas' ? k) THEN RAISE EXCEPTION 'Área que não é do Fugulin: %.', k; END IF;
  END LOOP;
  FOR k IN SELECT jsonb_array_elements_text(d -> 'areas') LOOP
    IF NOT (p_respostas ? k) OR jsonb_typeof(p_respostas -> k) <> 'number' OR (p_respostas ->> k)::numeric NOT IN (1, 2, 3, 4) THEN
      RAISE EXCEPTION 'Responda as 12 áreas com graduação de 1 a 4 (falta ou inválida: %).', k;
    END IF;
    v_total := v_total + (p_respostas ->> k)::int;
  END LOOP;
  FOR f IN SELECT * FROM jsonb_array_elements(d -> 'faixas') LOOP
    IF v_total >= (f ->> 0)::int THEN v_cat := f ->> 1; END IF;
  END LOOP;
  -- uma vigente por dia: a segunda do dia é retificação
  SELECT c.id INTO v_ant FROM public.classificacoes_fugulin c
   WHERE c.internacao_id = i.id AND c.dia = v_dia
     AND NOT EXISTS (SELECT 1 FROM public.classificacoes_fugulin r WHERE r.retifica_id = c.id)
   ORDER BY c.registrado_em DESC LIMIT 1;
  IF v_ant IS NOT NULL AND length(btrim(coalesce(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'O Fugulin de hoje já foi feito: para corrigir, diga o motivo (mínimo de 10 letras).';
  END IF;
  INSERT INTO public.classificacoes_fugulin (unidade_id, paciente_id, internacao_id, dia, versao, respostas, total, categoria,
                                             retifica_id, motivo, registrado_por)
  VALUES (i.unidade_id, i.paciente_id, i.id, v_dia, d ->> 'versao', p_respostas, v_total, v_cat,
          v_ant, CASE WHEN v_ant IS NOT NULL THEN btrim(p_motivo) END, private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_fugulin(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_fugulin(uuid, jsonb, text) TO authenticated;

-- histórico da internação (as retificadas aparecem marcadas)
CREATE OR REPLACE FUNCTION public.fugulin_da_internacao(p_internacao uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.internacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF i.id IS NULL OR NOT (private.pode_atuar_no_paciente(i.paciente_id) OR private.gestor_da_unidade(i.unidade_id)
                          OR private.acesso_encerrado_vigente(i.paciente_id)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
           'id', c.id, 'dia', c.dia, 'total', c.total, 'categoria', c.categoria, 'respostas', c.respostas, 'versao', c.versao,
           'por', p.nome_completo, 'em', c.registrado_em, 'motivo', c.motivo, 'retifica_id', c.retifica_id,
           'retificada', EXISTS (SELECT 1 FROM public.classificacoes_fugulin r WHERE r.retifica_id = c.id))
           ORDER BY c.dia DESC, c.registrado_em DESC,
                    EXISTS (SELECT 1 FROM public.classificacoes_fugulin r WHERE r.retifica_id = c.id))
      FROM public.classificacoes_fugulin c LEFT JOIN public.perfis p ON p.id = c.registrado_por
     WHERE c.internacao_id = i.id), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.fugulin_da_internacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fugulin_da_internacao(uuid) TO authenticated;

-- para a lista da enfermagem: o Fugulin de hoje de cada internação (ou nulo = pendente)
CREATE OR REPLACE FUNCTION public.fugulin_de_hoje(p_internacoes uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_object_agg(i.id, (
           SELECT jsonb_build_object('total', c.total, 'categoria', c.categoria)
             FROM public.classificacoes_fugulin c
            WHERE c.internacao_id = i.id AND c.dia = private.data_atual()
              AND NOT EXISTS (SELECT 1 FROM public.classificacoes_fugulin r WHERE r.retifica_id = c.id)
            ORDER BY c.registrado_em DESC LIMIT 1)), '{}'::jsonb)
    FROM public.internacoes i
   WHERE i.id = ANY (p_internacoes) AND private.segundo_fator_ok() AND private.membro_da_unidade(i.unidade_id);
$$;
REVOKE ALL ON FUNCTION public.fugulin_de_hoje(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fugulin_de_hoje(uuid[]) TO authenticated;
