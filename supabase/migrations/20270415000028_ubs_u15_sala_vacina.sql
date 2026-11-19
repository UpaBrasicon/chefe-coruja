-- ════════════════════════════════════════════════════════════════════════════
-- Percurso da UBS, U15, vacina, PR 4 (plano docs/ubs/U15-VACINA-PLANO.md; RT,
-- 19/11/2026: VC1, VC2 e VC4 = A): a sala de vacina e a caderneta.
--
-- Regras do LEDI APS 8.7.0 (Ficha de Vacinação, dicionario-fv; Regras de
-- vacinação; tabelas de referência da migration 20270415000025):
--   - aplicação do dia: imunobiológico, estratégia e dose na relação do LEDI;
--     lote e fabricante; grupo de atendimento; via e local de aplicação (o local
--     conforme a via); estratégia "Especial" pede o CBO do prescritor e o CID-10
--     do motivo;
--   - registro anterior (transcrição da caderneta, VC4): sem lote, fabricante e
--     grupo; estratégia vazia ou "Pesquisa"; com a data da aplicação; "aplicada
--     no exterior" só nas vacinas de COVID-19 da lista do LEDI, e nelas é
--     obrigatória;
--   - condição maternal (nenhuma, gestante, puérpera) obrigatória fora do sexo
--     masculino; comunicante de hanseníase só na BCG, e nela obrigatório.
--
-- 1. public.vacinacoes: cada vacina registrada no paciente. Lê quem cuida do
--    paciente na UBS (gestor, médico, enfermeiro e técnico); grava só pelas
--    funções abaixo.
-- 2. public.vacina_referencias(): as tabelas do LEDI para a tela.
-- 3. public.vacina_aplicar(paciente, dados): o técnico de enfermagem e o
--    enfermeiro de plantão na UBS (VC2), com o lote da UBS na validade
--    (private.vacina_lote_valido, migration 20270415000027).
-- 4. public.vacina_registrar_anterior(paciente, dados): a transcrição.
-- 5. public.vacina_caderneta(paciente): as vacinas do paciente.
-- 6. public.vacina_cancelar(vacinação, motivo): quem registrou, o enfermeiro
--    ou o gestor; o registro fica, marcado como cancelado.
-- Segundo fator e auditoria em todas as que gravam ou leem dado do paciente.
--
-- Os painéis (C2, C3, C6 e C7) e a Ficha de Vacinação do SISAB vêm nos PRs 5 e
-- 6. Idempotente. Teste: supabase/tests/ubs_u15_sala_vacina.sql
--
-- Rollback (na ordem):
--   DROP FUNCTION IF EXISTS public.vacina_cancelar(uuid, text), public.vacina_caderneta(uuid),
--     public.vacina_registrar_anterior(uuid, jsonb), public.vacina_aplicar(uuid, jsonb),
--     public.vacina_referencias(), private.vacina_conferir_paciente(public.pacientes, jsonb, integer),
--     private.vacina_pode_registrar(uuid), private.vacina_pode_ler(uuid);
--   DROP TABLE IF EXISTS public.vacinacoes;
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. tabela ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vacinacoes (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id             uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  paciente_id            uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  episodio_id            uuid REFERENCES public.episodios(id) ON DELETE SET NULL,
  registro_anterior      boolean NOT NULL,
  data_aplicacao         date NOT NULL,
  imunobiologico         integer NOT NULL REFERENCES terminologia.vacina_imunobiologico(codigo),
  estrategia             integer REFERENCES terminologia.vacina_estrategia(codigo),
  dose                   integer NOT NULL REFERENCES terminologia.vacina_dose(codigo),
  lote_id                uuid REFERENCES public.vacina_lotes(id) ON DELETE SET NULL,
  lote                   text,
  fabricante             text REFERENCES terminologia.vacina_fabricante(codigo_rnds),
  grupo_atendimento      integer REFERENCES terminologia.vacina_grupo_atendimento(codigo),
  via                    integer NOT NULL REFERENCES terminologia.vacina_via(codigo),
  local                  integer NOT NULL REFERENCES terminologia.vacina_local(codigo),
  aplicado_exterior      boolean,
  condicao_maternal      smallint CHECK (condicao_maternal IN (1, 2, 3)),
  viajante               boolean NOT NULL DEFAULT false,
  comunicante_hanseniase boolean,
  prescritor_cbo         text CHECK (prescritor_cbo ~ '^[0-9A-Z]{6}$'),
  cid10_motivo           text,
  pesquisa_clinica       boolean NOT NULL DEFAULT false,
  registrado_por         uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em          timestamptz NOT NULL DEFAULT now(),
  cancelado_em           timestamptz,
  cancelado_por          uuid REFERENCES public.perfis(id),
  motivo_cancelamento    text,
  CONSTRAINT vacinacoes_anterior_check CHECK (
    CASE WHEN registro_anterior
      THEN lote_id IS NULL AND lote IS NULL AND fabricante IS NULL AND grupo_atendimento IS NULL
           AND (estrategia IS NULL OR estrategia = 11)
      ELSE lote_id IS NOT NULL AND lote IS NOT NULL AND fabricante IS NOT NULL AND grupo_atendimento IS NOT NULL
           AND estrategia IS NOT NULL AND aplicado_exterior IS NULL
    END),
  CONSTRAINT vacinacoes_cancelamento_check CHECK (
    (cancelado_em IS NULL) = (cancelado_por IS NULL) AND (cancelado_em IS NULL) = (motivo_cancelamento IS NULL))
);
CREATE INDEX IF NOT EXISTS vacinacoes_paciente_idx ON public.vacinacoes (paciente_id, data_aplicacao DESC);
CREATE INDEX IF NOT EXISTS vacinacoes_unidade_data_idx ON public.vacinacoes (unidade_id, data_aplicacao);
CREATE INDEX IF NOT EXISTS vacinacoes_episodio_idx ON public.vacinacoes (episodio_id) WHERE episodio_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS vacinacoes_lote_idx ON public.vacinacoes (lote_id) WHERE lote_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS vacinacoes_registrado_por_idx ON public.vacinacoes (registrado_por);
CREATE INDEX IF NOT EXISTS vacinacoes_cancelado_por_idx ON public.vacinacoes (cancelado_por) WHERE cancelado_por IS NOT NULL;
CREATE INDEX IF NOT EXISTS vacinacoes_imunobiologico_idx ON public.vacinacoes (imunobiologico);
COMMENT ON TABLE public.vacinacoes IS
  'U15 (VC1, VC2, VC4 = A): vacinas do paciente na UBS, aplicadas ou transcritas da caderneta, nos códigos do LEDI APS 8.7.0.';

-- quem lê: gestor, médico, enfermeiro e técnico da unidade (e o super admin)
CREATE OR REPLACE FUNCTION private.vacina_pode_ler(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.eh_super_admin() OR private.tenho_papel(p_unidade, 'gestor') OR private.tenho_papel(p_unidade, 'plantonista')
      OR private.tenho_papel(p_unidade, 'enfermeiro') OR private.tenho_papel(p_unidade, 'tecnico_enfermagem');
$$;
REVOKE ALL ON FUNCTION private.vacina_pode_ler(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.vacina_pode_ler(uuid) TO authenticated;

-- quem registra (VC2 = A): técnico de enfermagem e enfermeiro, de plantão na UBS
CREATE OR REPLACE FUNCTION private.vacina_pode_registrar(p_unidade uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.unidades u WHERE u.id = p_unidade AND u.tipo = 'ubs')
     AND (private.tenho_papel(p_unidade, 'enfermeiro') OR private.tenho_papel(p_unidade, 'tecnico_enfermagem'))
     AND coalesce(private.na_escala_agora(p_unidade), false);
$$;
REVOKE ALL ON FUNCTION private.vacina_pode_registrar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.vacina_pode_registrar(uuid) TO authenticated;

ALTER TABLE public.vacinacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vacinacoes_le ON public.vacinacoes;
CREATE POLICY vacinacoes_le ON public.vacinacoes FOR SELECT TO authenticated
  USING (private.vacina_pode_ler(unidade_id));
REVOKE ALL ON public.vacinacoes FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.vacinacoes FROM authenticated;
GRANT SELECT ON public.vacinacoes TO authenticated;

-- ── 2. tabelas de referência para a tela ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vacina_referencias()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'imunobiologicos', (SELECT jsonb_agg(jsonb_build_object('codigo', i.codigo, 'nome', i.nome, 'sigla', i.sigla,
                          'tem_regra', EXISTS (SELECT 1 FROM terminologia.vacina_regra r WHERE r.imunobiologico = i.codigo)) ORDER BY i.nome)
                          FROM terminologia.vacina_imunobiologico i),
    'estrategias', (SELECT jsonb_agg(jsonb_build_object('codigo', codigo, 'nome', nome) ORDER BY codigo) FROM terminologia.vacina_estrategia),
    'doses', (SELECT jsonb_agg(jsonb_build_object('codigo', codigo, 'nome', nome, 'sigla', sigla) ORDER BY codigo) FROM terminologia.vacina_dose),
    'regras', (SELECT jsonb_agg(jsonb_build_array(imunobiologico, estrategia, dose)) FROM terminologia.vacina_regra),
    'grupos', (SELECT jsonb_agg(jsonb_build_object('codigo', codigo, 'nome', nome) ORDER BY nome) FROM terminologia.vacina_grupo_atendimento WHERE ativo),
    'vias', (SELECT jsonb_agg(jsonb_build_object('codigo', codigo, 'nome', nome) ORDER BY codigo) FROM terminologia.vacina_via),
    'locais', (SELECT jsonb_agg(jsonb_build_object('codigo', codigo, 'nome', nome) ORDER BY codigo) FROM terminologia.vacina_local),
    'via_local', (SELECT jsonb_agg(jsonb_build_array(via, local)) FROM terminologia.vacina_via_local),
    'covid', to_jsonb(ARRAY[85, 86, 87, 88, 89, 95, 96, 97, 98, 99, 102, 103, 105, 112]));
$$;
REVOKE ALL ON FUNCTION public.vacina_referencias() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vacina_referencias() TO authenticated;

-- regras comuns às duas entradas: via x local, condição maternal e hanseníase
CREATE OR REPLACE FUNCTION private.vacina_conferir_paciente(pa public.pacientes, d jsonb, p_imuno integer)
RETURNS void LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  v_via integer := nullif(d ->> 'via', '')::integer;
  v_local integer := nullif(d ->> 'local', '')::integer;
  v_mat integer := nullif(d ->> 'condicao_maternal', '')::integer;
BEGIN
  IF v_via IS NULL OR v_local IS NULL
     OR NOT EXISTS (SELECT 1 FROM terminologia.vacina_via_local WHERE via = v_via AND local = v_local) THEN
    RAISE EXCEPTION 'Escolha a via e um local de aplicação aceito para essa via.';
  END IF;
  IF pa.sexo = 'M' AND v_mat IS NOT NULL THEN
    RAISE EXCEPTION 'Condição maternal só fora do sexo masculino.';
  END IF;
  IF coalesce(pa.sexo, '') <> 'M' AND (v_mat IS NULL OR v_mat NOT IN (1, 2, 3)) THEN
    RAISE EXCEPTION 'Informe a condição maternal: nenhuma, gestante ou puérpera.';
  END IF;
  IF p_imuno = 15 AND (d ->> 'comunicante_hanseniase') IS NULL THEN
    RAISE EXCEPTION 'Na BCG, informe se é comunicante de hanseníase.';
  END IF;
  IF p_imuno <> 15 AND (d ->> 'comunicante_hanseniase') IS NOT NULL THEN
    RAISE EXCEPTION 'Comunicante de hanseníase só na BCG.';
  END IF;
END $$;
REVOKE ALL ON FUNCTION private.vacina_conferir_paciente(public.pacientes, jsonb, integer) FROM PUBLIC, anon, authenticated;

-- ── 3. aplicação do dia ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vacina_aplicar(p_paciente uuid, p_dados jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d jsonb := coalesce(p_dados, '{}'::jsonb);
  pa public.pacientes;
  l public.vacina_lotes;
  v_hoje date := private.data_atual();
  v_imuno integer := nullif(d ->> 'imunobiologico', '')::integer;
  v_estr integer := nullif(d ->> 'estrategia', '')::integer;
  v_dose integer := nullif(d ->> 'dose', '')::integer;
  v_grupo integer := nullif(d ->> 'grupo_atendimento', '')::integer;
  v_lote uuid := nullif(d ->> 'lote_id', '')::uuid;
  v_epi uuid := nullif(d ->> 'episodio_id', '')::uuid;
  v_cbo text := nullif(upper(btrim(coalesce(d ->> 'prescritor_cbo', ''))), '');
  v_cid text := nullif(upper(btrim(coalesce(d ->> 'cid10_motivo', ''))), '');
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente AND ativo;
  IF NOT FOUND OR NOT private.vacina_pode_registrar(pa.unidade_id) THEN
    RAISE EXCEPTION 'Só o técnico de enfermagem e o enfermeiro de plantão na UBS registram vacina.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM terminologia.vacina_regra WHERE imunobiologico = v_imuno AND estrategia = v_estr AND dose = v_dose) THEN
    RAISE EXCEPTION 'Essa combinação de vacina, estratégia e dose não é aceita pelo e-SUS APS.';
  END IF;
  IF v_lote IS NULL OR NOT private.vacina_lote_valido(v_lote, v_imuno, pa.unidade_id, v_hoje) THEN
    RAISE EXCEPTION 'Escolha um lote da UBS, desta vacina, ativo e na validade.';
  END IF;
  SELECT * INTO l FROM public.vacina_lotes WHERE id = v_lote;
  IF NOT EXISTS (SELECT 1 FROM terminologia.vacina_grupo_atendimento WHERE codigo = v_grupo AND ativo) THEN
    RAISE EXCEPTION 'Escolha o grupo de atendimento.';
  END IF;
  PERFORM private.vacina_conferir_paciente(pa, d, v_imuno);
  IF v_estr = 2 THEN
    IF v_cbo IS NULL OR v_cbo !~ '^[0-9A-Z]{6}$' THEN RAISE EXCEPTION 'Estratégia especial: informe o CBO de quem prescreveu.'; END IF;
    IF v_cid IS NULL OR NOT EXISTS (SELECT 1 FROM terminologia.cid10 c
                                     WHERE upper(replace(c.codigo, '.', '')) = replace(v_cid, '.', '')) THEN
      RAISE EXCEPTION 'Estratégia especial: informe o CID-10 do motivo da indicação.';
    END IF;
  ELSE
    v_cbo := NULL; v_cid := NULL;
  END IF;
  IF v_epi IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.episodios WHERE id = v_epi AND paciente_id = pa.id) THEN
    RAISE EXCEPTION 'Atendimento de outro paciente.';
  END IF;
  -- o LEDI não aceita o mesmo imunobiológico duas vezes no mesmo atendimento
  IF EXISTS (SELECT 1 FROM public.vacinacoes WHERE paciente_id = pa.id AND imunobiologico = v_imuno AND data_aplicacao = v_hoje
                AND NOT registro_anterior AND cancelado_em IS NULL) THEN
    RAISE EXCEPTION 'Esta vacina já foi registrada hoje para o paciente.';
  END IF;

  INSERT INTO public.vacinacoes (unidade_id, paciente_id, episodio_id, registro_anterior, data_aplicacao, imunobiologico, estrategia,
    dose, lote_id, lote, fabricante, grupo_atendimento, via, local, condicao_maternal, viajante, comunicante_hanseniase,
    prescritor_cbo, cid10_motivo, registrado_por)
  VALUES (pa.unidade_id, pa.id, v_epi, false, v_hoje, v_imuno, v_estr, v_dose, l.id, l.lote, l.fabricante, v_grupo,
    (d ->> 'via')::integer, (d ->> 'local')::integer, nullif(d ->> 'condicao_maternal', '')::smallint,
    coalesce((d ->> 'viajante')::boolean, false), (d ->> 'comunicante_hanseniase')::boolean, v_cbo, v_cid, private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('vacina_aplicada', 'vacinacoes', v_id, pa.unidade_id,
    jsonb_build_object('paciente_id', pa.id, 'imunobiologico', v_imuno, 'dose', v_dose, 'lote', l.lote));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.vacina_aplicar(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vacina_aplicar(uuid, jsonb) TO authenticated;

-- ── 4. registro anterior (caderneta) ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vacina_registrar_anterior(p_paciente uuid, p_dados jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d jsonb := coalesce(p_dados, '{}'::jsonb);
  pa public.pacientes;
  v_imuno integer := nullif(d ->> 'imunobiologico', '')::integer;
  v_estr integer := nullif(d ->> 'estrategia', '')::integer;
  v_dose integer := nullif(d ->> 'dose', '')::integer;
  v_data date := nullif(d ->> 'data_aplicacao', '')::date;
  v_ext boolean := (d ->> 'aplicado_exterior')::boolean;
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente AND ativo;
  IF NOT FOUND OR NOT private.vacina_pode_registrar(pa.unidade_id) THEN
    RAISE EXCEPTION 'Só o técnico de enfermagem e o enfermeiro de plantão na UBS registram vacina.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM terminologia.vacina_imunobiologico WHERE codigo = v_imuno) THEN
    RAISE EXCEPTION 'Escolha a vacina.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM terminologia.vacina_dose WHERE codigo = v_dose) THEN
    RAISE EXCEPTION 'Escolha a dose.';
  END IF;
  IF v_estr IS NOT NULL AND v_estr <> 11 THEN
    RAISE EXCEPTION 'No registro anterior, a estratégia fica em branco ou é Pesquisa.';
  END IF;
  IF pa.data_nascimento IS NULL THEN RAISE EXCEPTION 'Complete a data de nascimento do paciente antes da caderneta.'; END IF;
  IF v_data IS NULL OR v_data > private.data_atual() OR v_data < pa.data_nascimento THEN
    RAISE EXCEPTION 'A data da vacina vai do nascimento até hoje.';
  END IF;
  IF v_imuno = ANY (ARRAY[85, 86, 87, 88, 89, 95, 96, 97, 98, 99, 102, 103, 105, 112]) THEN
    IF v_ext IS NULL THEN RAISE EXCEPTION 'Vacina de COVID-19: informe se foi aplicada no exterior.'; END IF;
  ELSE
    v_ext := NULL;
  END IF;
  PERFORM private.vacina_conferir_paciente(pa, d, v_imuno);
  IF EXISTS (SELECT 1 FROM public.vacinacoes WHERE paciente_id = pa.id AND imunobiologico = v_imuno AND dose = v_dose
                AND data_aplicacao = v_data AND cancelado_em IS NULL) THEN
    RAISE EXCEPTION 'Esta dose já está na caderneta do paciente.';
  END IF;

  INSERT INTO public.vacinacoes (unidade_id, paciente_id, registro_anterior, data_aplicacao, imunobiologico, estrategia, dose,
    via, local, aplicado_exterior, condicao_maternal, viajante, comunicante_hanseniase, registrado_por)
  VALUES (pa.unidade_id, pa.id, true, v_data, v_imuno, v_estr, v_dose, (d ->> 'via')::integer, (d ->> 'local')::integer, v_ext,
    nullif(d ->> 'condicao_maternal', '')::smallint, coalesce((d ->> 'viajante')::boolean, false),
    (d ->> 'comunicante_hanseniase')::boolean, private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('vacina_transcrita', 'vacinacoes', v_id, pa.unidade_id,
    jsonb_build_object('paciente_id', pa.id, 'imunobiologico', v_imuno, 'dose', v_dose, 'data', v_data));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.vacina_registrar_anterior(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vacina_registrar_anterior(uuid, jsonb) TO authenticated;

-- ── 5. caderneta ────────────────────────────────────────────────────────────
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

-- ── 6. cancelar ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vacina_cancelar(p_vacinacao uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.vacinacoes;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO v FROM public.vacinacoes WHERE id = p_vacinacao;
  IF NOT FOUND OR NOT (v.registrado_por = private.meu_perfil_id() OR private.tenho_papel(v.unidade_id, 'enfermeiro')
                       OR private.tenho_papel(v.unidade_id, 'gestor')) THEN
    RAISE EXCEPTION 'Só quem registrou, o enfermeiro ou o gestor da UBS cancelam o registro de vacina.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v.cancelado_em IS NOT NULL THEN RAISE EXCEPTION 'Este registro já está cancelado.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN RAISE EXCEPTION 'Escreva o motivo do cancelamento.'; END IF;
  UPDATE public.vacinacoes SET cancelado_em = now(), cancelado_por = private.meu_perfil_id(), motivo_cancelamento = btrim(p_motivo)
   WHERE id = p_vacinacao;
  PERFORM private.registrar_auditoria('vacina_cancelada', 'vacinacoes', p_vacinacao, v.unidade_id,
    jsonb_build_object('paciente_id', v.paciente_id, 'motivo', btrim(p_motivo)));
END $$;
REVOKE ALL ON FUNCTION public.vacina_cancelar(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vacina_cancelar(uuid, text) TO authenticated;
