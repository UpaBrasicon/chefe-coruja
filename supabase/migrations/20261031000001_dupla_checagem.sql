-- Fase 2, tarefa 1 do BACKLOG.md — dupla checagem para medicamentos de alta vigilância.
--
-- Decisões do RT (08/10/2026):
--   • a lista de alta vigilância é a do ISMP Brasil — "Medicamentos
--     potencialmente perigosos de uso hospitalar — lista atualizada 2019"
--     (Boletim ISMP Brasil, v. 8, n. 1, fev. 2019) —, marcada no cadastro;
--     o farmacêutico (ou o gestor) da unidade marca ou desmarca outros, com
--     motivo — o próprio boletim diz que a dupla checagem deve ser avaliada no
--     contexto de cada instituição;
--   • o SEGUNDO checador é enfermeiro ou farmacêutico, nunca o mesmo usuário do
--     primeiro; sem a segunda conferência a administração não é registrada como
--     "feita".
-- O boletim é material com direitos reservados: aqui ficam só REGRAS de
-- marcação (nome do princípio ativo, via, concentração) com a citação, não o
-- texto da lista. Itens marcados por regra levam o rótulo da classe, para a
-- farmácia conferir. Classes que dependem da via de administração prescrita
-- (epidural/intratecal) ou de catálogo amplo (antineoplásicos) ficam com a
-- farmácia, que marca no cadastro.
-- Só aditiva: colunas e tabelas novas; checar() passa a exigir a dupla
-- conferência quando o medicamento a exige (corpo trocado, mesma assinatura).
--
-- ROLLBACK: reaplicar public.checar de 20261022000016; DROP do gatilho
--   medicamento_marca_alta_vigilancia, das funções e tabelas novas; ALTER TABLE public.medicamento DROP COLUMN alta_vigilancia_regra.

ALTER TABLE public.medicamento ADD COLUMN IF NOT EXISTS alta_vigilancia_regra text;

-- ── regras ISMP Brasil 2019 (marcação, não reprodução da lista) ────────────
CREATE TABLE IF NOT EXISTS private.regras_alta_vigilancia (
  id                 serial PRIMARY KEY,
  rotulo             text NOT NULL UNIQUE,       -- classe ou item, como a farmácia vê
  principio          text NOT NULL,              -- regex sobre principio_ativo_norm
  so_injetavel       boolean NOT NULL DEFAULT false,
  so_oral            boolean NOT NULL DEFAULT false,
  concentracao_min   numeric,                    -- % mínima (ex.: glicose ≥ 20)
  concentracao_maior numeric,                    -- % estritamente maior (ex.: NaCl > 0,9)
  fonte              text NOT NULL DEFAULT 'ISMP Brasil, Boletim v. 8, n. 1, fev. 2019 — Medicamentos potencialmente perigosos de uso hospitalar'
);
REVOKE ALL ON private.regras_alta_vigilancia FROM PUBLIC, anon, authenticated;
INSERT INTO private.regras_alta_vigilancia (rotulo, principio, so_injetavel, so_oral, concentracao_min, concentracao_maior) VALUES
  ('Agonistas adrenérgicos endovenosos', '\m(epinefrina|adrenalina|norepinefrina|noradrenalina|fenilefrina|dopamina|dobutamina|isoprenalina|efedrina|metaraminol)\M', true, false, NULL, NULL),
  ('Analgésicos opioides', '\m(morfina|fentanil|sufentanil|remifentanil|alfentanil|metadona|oxicodona|hidromorfona|petidina|meperidina|tramadol|codeina|buprenorfina|nalbufina|tapentadol)\M', false, false, NULL, NULL),
  ('Anestésicos gerais inalatórios e endovenosos', '\m(propofol|cetamina|escetamina|etomidato|tiopental|sevoflurano|isoflurano|desflurano|halotano)\M', false, false, NULL, NULL),
  ('Antagonistas adrenérgicos endovenosos', '\m(propranolol|metoprolol|esmolol|labetalol)\M', true, false, NULL, NULL),
  ('Antiarrítmicos endovenosos', '\m(amiodarona|lidocaina|procainamida|adenosina)\M', true, false, NULL, NULL),
  ('Antitrombóticos', '\m(varfarina|heparina|enoxaparina|dalteparina|nadroparina|dabigatrana|rivaroxabana|apixabana|edoxabana|fondaparinux|bivalirrudina|abciximabe|tirofibana|eptifibatida|alteplase|tenecteplase|estreptoquinase)\M', false, false, NULL, NULL),
  ('Bloqueadores neuromusculares', '\m(suxametonio|succinilcolina|rocuronio|pancuronio|vecuronio|atracurio|cisatracurio)\M', false, false, NULL, NULL),
  ('Cloreto de sódio hipertônico injetável (> 0,9%)', '\mcloreto de sodio\M', true, false, NULL, 0.9),
  ('Glicose hipertônica (≥ 20%)', '\m(glicose|dextrose)\M', false, false, 20, NULL),
  ('Inotrópicos endovenosos', '\m(milrinona|deslanosideo|levosimendana)\M', true, false, NULL, NULL),
  ('Insulinas (todas)', '\minsulina\M', false, false, NULL, NULL),
  ('Anfotericina B (lipossomal e convencional)', '\manfotericina\M', false, false, NULL, NULL),
  ('Doxorrubicina (lipossomal e convencional)', '\mdoxorrubicina\M', false, false, NULL, NULL),
  ('Sedativos endovenosos de ação moderada', '\m(dexmedetomidina|midazolam|lorazepam)\M', true, false, NULL, NULL),
  ('Sedativos orais para crianças', '\m(hidrato de cloral|midazolam)\M', false, true, NULL, NULL),
  ('Soluções cardioplégicas', 'cardiopleg', false, false, NULL, NULL),
  ('Soluções para diálise', '\mdialise\M', false, false, NULL, NULL),
  ('Nutrição parenteral', 'nutricao parenteral', false, false, NULL, NULL),
  ('Sulfonilureias orais', '\m(clorpropamida|glimepirida|glibenclamida|glipizida|gliclazida)\M', false, true, NULL, NULL),
  ('Cloreto de potássio concentrado injetável', '\mcloreto de potassio\M', true, false, NULL, NULL),
  ('Fosfato de potássio injetável', '\mfosfato de potassio\M', true, false, NULL, NULL),
  ('Metotrexato oral (uso não oncológico)', '\mmetotrexato\M', false, true, NULL, NULL),
  ('Nitroprussiato de sódio injetável', '\mnitroprussiato\M', true, false, NULL, NULL),
  ('Ocitocina endovenosa', '\mocitocina\M', true, false, NULL, NULL),
  ('Prometazina injetável', '\mprometazina\M', true, false, NULL, NULL),
  ('Sulfato de magnésio injetável', '\msulfato de magnesio\M', true, false, NULL, NULL),
  ('Vasopressina endovenosa', '\mvasopressina\M', true, false, NULL, NULL)
ON CONFLICT (rotulo) DO UPDATE SET principio = EXCLUDED.principio, so_injetavel = EXCLUDED.so_injetavel,
  so_oral = EXCLUDED.so_oral, concentracao_min = EXCLUDED.concentracao_min, concentracao_maior = EXCLUDED.concentracao_maior;

-- percentual da concentração ("19,1%" → 19.1); sem % → nulo
CREATE OR REPLACE FUNCTION private.percentual_concentracao(c text)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT replace(substring(coalesce(c, '') from '([0-9]+(?:[.,][0-9]+)?)\s*%'), ',', '.')::numeric;
$$;

-- regra ISMP que marca o medicamento (a primeira que casa), ou nulo
CREATE OR REPLACE FUNCTION private.regra_alta_vigilancia(p_principio_norm text, p_apresentacao text, p_concentracao text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.rotulo FROM private.regras_alta_vigilancia r
   WHERE coalesce(p_principio_norm, '') ~ r.principio
     AND (NOT r.so_injetavel OR lower(coalesce(p_apresentacao, '')) ~ 'injet')
     AND (NOT r.so_oral OR lower(coalesce(p_apresentacao, '')) ~ '(comprimido|capsula|cápsula|solucao oral|solução oral|suspensao oral|suspensão oral|xarope|gotas|oral)')
     AND (r.concentracao_min IS NULL OR private.percentual_concentracao(p_concentracao) >= r.concentracao_min)
     AND (r.concentracao_maior IS NULL OR private.percentual_concentracao(p_concentracao) > r.concentracao_maior)
   ORDER BY r.id LIMIT 1;
$$;
REVOKE ALL ON FUNCTION private.regra_alta_vigilancia(text, text, text) FROM PUBLIC, anon;

-- cadastro novo ou alterado passa pelas mesmas regras (nunca desmarca)
CREATE OR REPLACE FUNCTION private.medicamento_marca_alta_vigilancia() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  NEW.alta_vigilancia_regra := private.regra_alta_vigilancia(NEW.principio_ativo_norm, NEW.apresentacao, NEW.concentracao);
  IF NEW.alta_vigilancia_regra IS NOT NULL THEN NEW.alta_vigilancia := true; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS medicamento_marca_alta_vigilancia ON public.medicamento;
CREATE TRIGGER medicamento_marca_alta_vigilancia BEFORE INSERT OR UPDATE OF principio_ativo_norm, apresentacao, concentracao
  ON public.medicamento FOR EACH ROW EXECUTE FUNCTION private.medicamento_marca_alta_vigilancia();

-- marca o cadastro pelas regras (não desmarca o que a farmácia ou o ETL já marcou)
UPDATE public.medicamento m
   SET alta_vigilancia = true,
       alta_vigilancia_regra = private.regra_alta_vigilancia(m.principio_ativo_norm, m.apresentacao, m.concentracao),
       updated_at = now()
 WHERE private.regra_alta_vigilancia(m.principio_ativo_norm, m.apresentacao, m.concentracao) IS NOT NULL;

-- ── ajuste da unidade (farmacêutico ou gestor), com motivo e histórico ────
CREATE TABLE IF NOT EXISTS public.alta_vigilancia_unidade (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  medicamento_id uuid NOT NULL REFERENCES public.medicamento(id),
  exige          boolean NOT NULL,
  motivo         text NOT NULL CHECK (length(btrim(motivo)) >= 10),
  definido_por   uuid NOT NULL REFERENCES public.perfis(id),
  definido_em    timestamptz NOT NULL DEFAULT now(),
  vigente_ate    timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS alta_vigilancia_unidade_vigente ON public.alta_vigilancia_unidade (unidade_id, medicamento_id) WHERE vigente_ate IS NULL;
ALTER TABLE public.alta_vigilancia_unidade ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.alta_vigilancia_unidade FROM authenticated, anon;
DROP POLICY IF EXISTS alta_vigilancia_unidade_select ON public.alta_vigilancia_unidade;
CREATE POLICY alta_vigilancia_unidade_select ON public.alta_vigilancia_unidade FOR SELECT TO authenticated
  USING (private.membro_da_unidade(unidade_id));

CREATE OR REPLACE FUNCTION private.exige_dupla_checagem(p_unidade uuid, p_medicamento uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(
    (SELECT a.exige FROM public.alta_vigilancia_unidade a
      WHERE a.unidade_id = p_unidade AND a.medicamento_id = p_medicamento AND a.vigente_ate IS NULL),
    (SELECT m.alta_vigilancia FROM public.medicamento m WHERE m.id = p_medicamento),
    false);
$$;
REVOKE ALL ON FUNCTION private.exige_dupla_checagem(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.exige_dupla_checagem(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.definir_alta_vigilancia(p_unidade uuid, p_medicamento uuid, p_exige boolean, p_motivo text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.gestor_da_unidade(p_unidade) OR private.tenho_papel(p_unidade, 'farmaceutico') IS TRUE) THEN
    RAISE EXCEPTION 'Só o farmacêutico ou o gestor da unidade ajusta a lista de alta vigilância.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_exige IS NULL OR NOT EXISTS (SELECT 1 FROM public.medicamento WHERE id = p_medicamento) THEN RAISE EXCEPTION 'Medicamento inválido.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  UPDATE public.alta_vigilancia_unidade SET vigente_ate = now()
   WHERE unidade_id = p_unidade AND medicamento_id = p_medicamento AND vigente_ate IS NULL;
  INSERT INTO public.alta_vigilancia_unidade (unidade_id, medicamento_id, exige, motivo, definido_por)
  VALUES (p_unidade, p_medicamento, p_exige, btrim(p_motivo), private.meu_perfil_id());
  PERFORM private.registrar_auditoria('definir_alta_vigilancia', 'medicamento', p_medicamento, p_unidade,
    jsonb_build_object('exige', p_exige));
END $$;
REVOKE ALL ON FUNCTION public.definir_alta_vigilancia(uuid, uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_alta_vigilancia(uuid, uuid, boolean, text) TO authenticated;

-- lista para a farmácia: o que exige dupla checagem na unidade, de onde veio
CREATE OR REPLACE FUNCTION public.alta_vigilancia_da_unidade(p_unidade uuid, p_busca text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.membro_da_unidade(p_unidade) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', m.id, 'principio_ativo', m.principio_ativo, 'apresentacao', m.apresentacao, 'concentracao', m.concentracao,
             'cadastro', m.alta_vigilancia, 'regra', m.alta_vigilancia_regra,
             'exige', private.exige_dupla_checagem(p_unidade, m.id),
             'ajuste', (SELECT jsonb_build_object('exige', a.exige, 'motivo', a.motivo, 'por', p.nome_completo, 'em', a.definido_em)
                          FROM public.alta_vigilancia_unidade a LEFT JOIN public.perfis p ON p.id = a.definido_por
                         WHERE a.unidade_id = p_unidade AND a.medicamento_id = m.id AND a.vigente_ate IS NULL))
             ORDER BY m.principio_ativo, m.apresentacao)
      FROM public.medicamento m
     WHERE m.ativo
       AND (CASE WHEN nullif(btrim(coalesce(p_busca, '')), '') IS NULL
                 THEN private.exige_dupla_checagem(p_unidade, m.id)
                   OR EXISTS (SELECT 1 FROM public.alta_vigilancia_unidade a WHERE a.unidade_id = p_unidade AND a.medicamento_id = m.id AND a.vigente_ate IS NULL)
                 ELSE m.principio_ativo_norm LIKE '%' || private.nome_comparavel(p_busca) || '%' END)
     LIMIT 400), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.alta_vigilancia_da_unidade(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alta_vigilancia_da_unidade(uuid, text) TO authenticated;

-- ── as duas conferências ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.duplas_checagens (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id          uuid NOT NULL REFERENCES public.prescricao_itens(id),
  paciente_id      uuid NOT NULL REFERENCES public.pacientes(id),
  unidade_id       uuid NOT NULL REFERENCES public.unidades(id),
  horario_previsto text,
  primeiro_por     uuid NOT NULL REFERENCES public.perfis(id),
  primeiro_em      timestamptz NOT NULL DEFAULT now(),
  segundo_por      uuid REFERENCES public.perfis(id),
  segundo_em       timestamptz,
  usada_em         timestamptz,              -- consumida pelo "feito"
  CHECK (segundo_por IS NULL OR segundo_por <> primeiro_por)
);
CREATE INDEX IF NOT EXISTS duplas_checagens_item ON public.duplas_checagens (item_id, primeiro_em DESC);
ALTER TABLE public.duplas_checagens ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.duplas_checagens FROM authenticated, anon;
DROP POLICY IF EXISTS duplas_checagens_select ON public.duplas_checagens;
CREATE POLICY duplas_checagens_select ON public.duplas_checagens FOR SELECT TO authenticated
  USING (private.membro_da_unidade(unidade_id));

-- só se completa uma vez (segundo, depois "usada"); nunca se apaga nem se reescreve
CREATE OR REPLACE FUNCTION private.dupla_checagem_so_completa() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Dupla checagem não se apaga.'; END IF;
  IF NEW.item_id <> OLD.item_id OR NEW.primeiro_por <> OLD.primeiro_por OR NEW.primeiro_em <> OLD.primeiro_em
     OR NEW.horario_previsto IS DISTINCT FROM OLD.horario_previsto
     OR (OLD.segundo_por IS NOT NULL AND NEW.segundo_por IS DISTINCT FROM OLD.segundo_por)
     OR (OLD.usada_em IS NOT NULL AND NEW.usada_em IS DISTINCT FROM OLD.usada_em) THEN
    RAISE EXCEPTION 'Dupla checagem não se reescreve.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS duplas_checagens_so_completa ON public.duplas_checagens;
CREATE TRIGGER duplas_checagens_so_completa BEFORE UPDATE OR DELETE ON public.duplas_checagens
  FOR EACH ROW EXECUTE FUNCTION private.dupla_checagem_so_completa();

-- 1ª conferência: enfermagem de plantão no setor do paciente;
-- 2ª: enfermeiro (de plantão) ou farmacêutico da unidade, outro usuário
CREATE OR REPLACE FUNCTION public.conferir_alta_vigilancia(p_item uuid, p_horario text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  it public.prescricao_itens;
  pr public.prescricoes;
  d  public.duplas_checagens;
  v_eu uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO it FROM public.prescricao_itens WHERE id = p_item;
  IF NOT FOUND OR it.suspenso_em IS NOT NULL THEN RAISE EXCEPTION 'Item não encontrado ou suspenso.'; END IF;
  SELECT * INTO pr FROM public.prescricoes WHERE id = it.prescricao_id;
  IF it.medicamento_id IS NULL OR NOT private.exige_dupla_checagem(pr.unidade_id, it.medicamento_id) THEN
    RAISE EXCEPTION 'Este item não exige dupla checagem.';
  END IF;
  -- conferência em aberto para este horário (não usada, das últimas 2 horas)
  SELECT * INTO d FROM public.duplas_checagens
   WHERE item_id = it.id AND horario_previsto IS NOT DISTINCT FROM p_horario AND usada_em IS NULL
     AND primeiro_em > now() - interval '2 hours'
   ORDER BY primeiro_em DESC LIMIT 1 FOR UPDATE;

  IF d.id IS NULL THEN
    IF NOT private.sou_enfermagem(pr.unidade_id) OR NOT private.paciente_no_meu_plantao(pr.paciente_id) THEN
      RAISE EXCEPTION 'A primeira conferência é da enfermagem de plantão no setor do paciente.' USING ERRCODE = 'insufficient_privilege';
    END IF;
    INSERT INTO public.duplas_checagens (item_id, paciente_id, unidade_id, horario_previsto, primeiro_por)
    VALUES (it.id, pr.paciente_id, pr.unidade_id, p_horario, v_eu);
    PERFORM private.registrar_auditoria('primeira_conferencia', 'prescricao_itens', it.id, pr.unidade_id,
      jsonb_build_object('horario', p_horario));
    RETURN 'primeira';
  END IF;
  IF d.segundo_por IS NOT NULL THEN RAISE EXCEPTION 'As duas conferências já foram feitas: registre a administração.'; END IF;
  IF d.primeiro_por = v_eu THEN
    RAISE EXCEPTION 'A segunda conferência é de outro profissional (enfermeiro ou farmacêutico).';
  END IF;
  IF NOT ((private.tenho_papel(pr.unidade_id, 'enfermeiro') IS TRUE AND private.paciente_no_meu_plantao(pr.paciente_id))
          OR private.tenho_papel(pr.unidade_id, 'farmaceutico') IS TRUE) THEN
    RAISE EXCEPTION 'A segunda conferência é de enfermeiro de plantão ou farmacêutico.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  UPDATE public.duplas_checagens SET segundo_por = v_eu, segundo_em = now() WHERE id = d.id;
  PERFORM private.registrar_auditoria('segunda_conferencia', 'prescricao_itens', it.id, pr.unidade_id,
    jsonb_build_object('horario', p_horario));
  RETURN 'segunda';
END $$;
REVOKE ALL ON FUNCTION public.conferir_alta_vigilancia(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conferir_alta_vigilancia(uuid, text) TO authenticated;

-- ── checar(): "feito" de alta vigilância só com as duas conferências ───────
CREATE OR REPLACE FUNCTION public.checar(p_item uuid, p_situacao text, p_horario text DEFAULT NULL, p_motivo text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE it public.prescricao_itens; pr public.prescricoes; v_id uuid; v_dupla uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO it FROM public.prescricao_itens WHERE id = p_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item não encontrado.'; END IF;
  IF it.suspenso_em IS NOT NULL THEN RAISE EXCEPTION 'Item suspenso: não se checa.'; END IF;
  SELECT * INTO pr FROM public.prescricoes WHERE id = it.prescricao_id;
  IF NOT private.sou_enfermagem(pr.unidade_id) OR NOT private.paciente_no_meu_plantao(pr.paciente_id) THEN
    RAISE EXCEPTION 'A checagem é da enfermagem de plantão no setor do paciente.';
  END IF;
  IF p_situacao NOT IN ('feito', 'nao_feito', 'recusado') THEN RAISE EXCEPTION 'Situação desconhecida.'; END IF;
  IF p_situacao <> 'feito' AND length(btrim(coalesce(p_motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'Diga o motivo (não feito ou recusado).';
  END IF;
  IF p_horario IS NOT NULL AND p_horario !~ '^([01]\d|2[0-3]):[0-5]\d$' THEN RAISE EXCEPTION 'Horário inválido (use HH:MM).'; END IF;
  -- item aprazado (fora do "se necessário"): a checagem diz qual horário está
  -- sendo checado; sem isso a pendência continuaria "atrasada" para sempre
  IF NOT it.se_necessario AND cardinality(coalesce(it.horarios, '{}'::text[])) > 0 THEN
    IF p_horario IS NULL THEN
      RAISE EXCEPTION 'Escolha o horário aprazado que está sendo checado.';
    END IF;
    IF NOT (p_horario = ANY (it.horarios)) THEN
      RAISE EXCEPTION 'O horário % não está no aprazamento deste item (%).', p_horario, array_to_string(it.horarios, ', ');
    END IF;
  END IF;
  -- Fase 2, tarefa 1: alta vigilância só é "feito" depois da dupla conferência
  IF p_situacao = 'feito' AND it.medicamento_id IS NOT NULL AND private.exige_dupla_checagem(pr.unidade_id, it.medicamento_id) THEN
    SELECT id INTO v_dupla FROM public.duplas_checagens
     WHERE item_id = it.id AND horario_previsto IS NOT DISTINCT FROM p_horario AND usada_em IS NULL
       AND segundo_por IS NOT NULL AND primeiro_em > now() - interval '2 hours'
     ORDER BY primeiro_em DESC LIMIT 1 FOR UPDATE;
    IF v_dupla IS NULL THEN
      RAISE EXCEPTION 'Medicamento de alta vigilância: faça a dupla checagem (duas conferências, por profissionais diferentes) antes de registrar como feito.';
    END IF;
    UPDATE public.duplas_checagens SET usada_em = now() WHERE id = v_dupla;
  END IF;
  INSERT INTO public.administracoes (item_id, paciente_id, unidade_id, horario_previsto, situacao, motivo, registrado_por)
  VALUES (it.id, pr.paciente_id, pr.unidade_id, p_horario, p_situacao, nullif(btrim(p_motivo), ''), private.meu_perfil_id())
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- ── leitura para as telas ───────────────────────────────────────────────────
-- Checagem: para os itens na tela, se exigem dupla e as conferências em aberto
CREATE OR REPLACE FUNCTION public.estado_dupla_checagem(p_itens uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'item_id', it.id,
           'regra', coalesce(m.alta_vigilancia_regra, 'Marcado pela farmácia'),
           'abertas', (SELECT coalesce(jsonb_agg(jsonb_build_object(
                         'horario', d.horario_previsto, 'primeiro_por', p1.nome_completo, 'primeiro_em', d.primeiro_em,
                         'segundo_por', p2.nome_completo, 'segundo_em', d.segundo_em, 'sou_o_primeiro', d.primeiro_por = private.meu_perfil_id())
                         ORDER BY d.primeiro_em), '[]'::jsonb)
                         FROM public.duplas_checagens d
                         JOIN public.perfis p1 ON p1.id = d.primeiro_por
                         LEFT JOIN public.perfis p2 ON p2.id = d.segundo_por
                        WHERE d.item_id = it.id AND d.usada_em IS NULL AND d.primeiro_em > now() - interval '2 hours'))), '[]'::jsonb)
    FROM public.prescricao_itens it
    JOIN public.prescricoes pr ON pr.id = it.prescricao_id
    JOIN public.medicamento m ON m.id = it.medicamento_id
   WHERE it.id = ANY (p_itens) AND private.segundo_fator_ok() AND private.membro_da_unidade(pr.unidade_id)
     AND private.exige_dupla_checagem(pr.unidade_id, it.medicamento_id);
$$;
REVOKE ALL ON FUNCTION public.estado_dupla_checagem(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estado_dupla_checagem(uuid[]) TO authenticated;

-- fila do segundo checador: primeiras conferências esperando a segunda
CREATE OR REPLACE FUNCTION public.duplas_pendentes(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.tenho_papel(p_unidade, 'farmaceutico') IS TRUE OR private.tenho_papel(p_unidade, 'enfermeiro') IS TRUE) THEN
    RAISE EXCEPTION 'A segunda conferência é de enfermeiro ou farmacêutico.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'item_id', it.id, 'horario', d.horario_previsto, 'paciente', coalesce(pa.nome_social, pa.nome),
             'local', (SELECT s.nome FROM public.setores s WHERE s.id = pa.setor_id),
             'descricao', it.descricao, 'dose', it.dose, 'via', it.via, 'posologia', it.posologia, 'diluicao', it.diluicao_texto,
             'regra', coalesce(m.alta_vigilancia_regra, 'Marcado pela farmácia'),
             'primeiro_por', p1.nome_completo, 'primeiro_em', d.primeiro_em,
             'sou_o_primeiro', d.primeiro_por = private.meu_perfil_id())
             ORDER BY d.primeiro_em)
      FROM public.duplas_checagens d
      JOIN public.prescricao_itens it ON it.id = d.item_id
      JOIN public.pacientes pa ON pa.id = d.paciente_id
      JOIN public.perfis p1 ON p1.id = d.primeiro_por
      LEFT JOIN public.medicamento m ON m.id = it.medicamento_id
     WHERE d.unidade_id = p_unidade AND d.segundo_por IS NULL AND d.usada_em IS NULL
       AND d.primeiro_em > now() - interval '2 hours' AND it.suspenso_em IS NULL), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.duplas_pendentes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplas_pendentes(uuid) TO authenticated;
