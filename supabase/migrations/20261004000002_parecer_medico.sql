-- ════════════════════════════════════════════════════════════════════════════
-- Porte do frontend, onda 4 — parecer médico (protótipo, etapa 7: manual 3.8
-- e 3.9).
--
-- Fluxo: o médico que está com o paciente pede o parecer de uma especialidade
-- (prioridade, prestador opcional, pergunta com 15+ letras). O especialista vê
-- a fila da unidade filtrada pelas especialidades que declarou, inicia a
-- análise (fica o nome e a hora; "outro já analisa" para os demais), lê o
-- resumo do paciente, salva rascunho e conclui. Solicitado → Em análise →
-- Realizado, ou Cancelado (com motivo).
--
-- Registro nos dois lados, como a teleinterconsulta (fase 7): a solicitação,
-- a resposta e o cancelamento viram documentos numerados no prontuário, tipo
-- 'parecer', autor quem fez.
--
-- Quem pode responder (decisão mínima, o app não tinha especialidade):
--   * médico com vínculo ativo na unidade do paciente como plantonista ou
--     telemedicina, E
--   * que declarou a especialidade em especialidades_perfil (ele mesmo
--     declara, pela tela Pareceres; a declaração fica na auditoria), E
--   * que não é quem pediu.
--   Não exige estar escalado: especialista costuma ser de sobreaviso.
--   A leitura do paciente vale só enquanto ele analisa e até 24 h depois de
--   concluir, e passa por parecer_dados_paciente (log de acesso gravado).
--
-- Parecer sem resposta (solicitado ou em análise) impede a alta da internação
-- (private.impeditivos_alta ganha mais um ramo; o que já existia fica).
--
-- Reaplicável. A CHECK de tipo de documento, a lista de tipos de
-- private.gravar_documento_episodio e private.impeditivos_alta são LIDAS do
-- banco e acrescidas (não reescritas), para não desfazer o que outras
-- migrations acrescentaram.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. tipo de documento 'parecer' (acrescenta sem desfazer) ────────────────
DO $$
DECLARE v_def text; v_tipos text[];
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def FROM pg_constraint
   WHERE conrelid = 'public.documentos_clinicos'::regclass AND conname = 'documentos_clinicos_tipo_documento_check';
  IF v_def IS NULL THEN RAISE EXCEPTION 'CHECK de tipo de documento não encontrada.'; END IF;
  IF v_def NOT LIKE '%''parecer''::text%' THEN
    SELECT array_agg(m[1] ORDER BY n) INTO v_tipos
      FROM regexp_matches(v_def, '''([a-z_0-9]+)''::text', 'g') WITH ORDINALITY AS r(m, n);
    v_tipos := array_append(v_tipos, 'parecer');
    EXECUTE 'ALTER TABLE public.documentos_clinicos DROP CONSTRAINT documentos_clinicos_tipo_documento_check';
    EXECUTE format('ALTER TABLE public.documentos_clinicos ADD CONSTRAINT documentos_clinicos_tipo_documento_check CHECK (tipo_documento IN (%s))',
      (SELECT string_agg(quote_literal(t), ', ') FROM unnest(v_tipos) t));
  END IF;
END $$;

DO $$
DECLARE v_def text; v_novo text;
BEGIN
  v_def := pg_get_functiondef('private.gravar_documento_episodio(uuid, uuid, text, text, uuid, uuid, text, uuid, timestamp with time zone, boolean, text)'::regprocedure);
  IF v_def NOT LIKE '%''parecer''%' THEN
    v_novo := regexp_replace(v_def, 'p_tipo NOT IN \(', 'p_tipo NOT IN (''parecer'', ');
    IF v_novo = v_def THEN RAISE EXCEPTION 'Lista de tipos de gravar_documento_episodio não encontrada.'; END IF;
    EXECUTE v_novo;
  END IF;
END $$;

-- ── 2. especialidades (lista do protótipo, ESPECIALIDADES) ──────────────────
CREATE TABLE IF NOT EXISTS public.especialidades_parecer (
  nome  text PRIMARY KEY CHECK (length(btrim(nome)) >= 3),
  ordem int NOT NULL
);
INSERT INTO public.especialidades_parecer (nome, ordem)
SELECT e, n FROM unnest(ARRAY[
  'Anestesiologia', 'Angiologia', 'Cardiologia', 'Cirurgia cardiovascular', 'Cirurgia geral', 'Cirurgia pediátrica',
  'Cirurgia plástica', 'Cirurgia torácica', 'Cirurgia vascular', 'Clínica médica', 'Coloproctologia', 'Dermatologia',
  'Endocrinologia', 'Gastroenterologia', 'Geriatria', 'Ginecologia e obstetrícia', 'Hematologia', 'Infectologia',
  'Medicina intensiva', 'Nefrologia', 'Neurocirurgia', 'Neurologia', 'Nutrologia', 'Oftalmologia', 'Oncologia',
  'Ortopedia e traumatologia', 'Otorrinolaringologia', 'Pediatria', 'Pneumologia', 'Psiquiatria', 'Reumatologia',
  'Urologia', 'Cuidados paliativos', 'Fisioterapia', 'Fonoaudiologia', 'Nutrição', 'Psicologia', 'Serviço social'
]) WITH ORDINALITY AS t(e, n)
ON CONFLICT (nome) DO UPDATE SET ordem = EXCLUDED.ordem;

ALTER TABLE public.especialidades_parecer ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS especialidades_parecer_select ON public.especialidades_parecer;
CREATE POLICY especialidades_parecer_select ON public.especialidades_parecer FOR SELECT TO authenticated USING (true);
REVOKE ALL ON public.especialidades_parecer FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.especialidades_parecer FROM authenticated;

-- especialidades que o médico declara responder
CREATE TABLE IF NOT EXISTS public.especialidades_perfil (
  perfil_id     uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  especialidade text NOT NULL REFERENCES public.especialidades_parecer(nome),
  declarada_em  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (perfil_id, especialidade)
);
ALTER TABLE public.especialidades_perfil ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS especialidades_perfil_select ON public.especialidades_perfil;
CREATE POLICY especialidades_perfil_select ON public.especialidades_perfil FOR SELECT TO authenticated
  USING (perfil_id = private.meu_perfil_id() OR private.eh_super_admin()
         OR EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = especialidades_perfil.perfil_id AND v.ativo
                    AND private.papel_na_unidade(v.unidade_id) = 'gestor'));
REVOKE ALL ON public.especialidades_perfil FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.especialidades_perfil FROM authenticated;

CREATE OR REPLACE FUNCTION public.definir_minhas_especialidades(p_especialidades text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_lista text[] := ARRAY(SELECT DISTINCT btrim(e) FROM unnest(coalesce(p_especialidades, '{}')) e WHERE btrim(e) <> '');
  v_antes text[];
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF v_perfil IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.vinculos v WHERE v.perfil_id = v_perfil AND v.ativo AND v.papel::text IN ('plantonista', 'telemedicina')) THEN
    RAISE EXCEPTION 'Acesso negado: só médico (plantonista ou telemedicina) declara especialidade.';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(v_lista) e WHERE NOT EXISTS (SELECT 1 FROM public.especialidades_parecer s WHERE s.nome = e)) THEN
    RAISE EXCEPTION 'Especialidade fora da lista.';
  END IF;
  v_antes := ARRAY(SELECT especialidade FROM public.especialidades_perfil WHERE perfil_id = v_perfil ORDER BY 1);
  DELETE FROM public.especialidades_perfil WHERE perfil_id = v_perfil AND NOT (especialidade = ANY (v_lista));
  INSERT INTO public.especialidades_perfil (perfil_id, especialidade)
  SELECT v_perfil, e FROM unnest(v_lista) e ON CONFLICT DO NOTHING;
  PERFORM private.registrar_auditoria('definir_especialidades', 'especialidades_perfil', v_perfil, NULL,
    jsonb_build_object('antes', to_jsonb(v_antes), 'depois', to_jsonb(ARRAY(SELECT unnest(v_lista) ORDER BY 1))));
END $$;
REVOKE ALL ON FUNCTION public.definir_minhas_especialidades(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_minhas_especialidades(text[]) TO authenticated;

-- ── 3. o parecer ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pareceres_medicos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id      uuid NOT NULL REFERENCES public.organizacoes(id),
  unidade_id          uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id         uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id         uuid REFERENCES public.episodios(id),
  internacao_id       uuid REFERENCES public.internacoes(id),
  especialidade       text NOT NULL REFERENCES public.especialidades_parecer(nome),
  prestador           text CHECK (prestador IS NULL OR length(btrim(prestador)) BETWEEN 3 AND 120),
  prioridade          text NOT NULL DEFAULT 'normal' CHECK (prioridade IN ('normal', 'urgencia_relativa', 'urgencia', 'emergencia')),
  pergunta            text NOT NULL CHECK (length(btrim(pergunta)) >= 15),
  status              text NOT NULL DEFAULT 'solicitado' CHECK (status IN ('solicitado', 'em_analise', 'realizado', 'cancelado')),
  solicitante_id      uuid NOT NULL REFERENCES public.perfis(id),
  solicitado_em       timestamptz NOT NULL DEFAULT now(),
  analista_id         uuid REFERENCES public.perfis(id),
  analise_iniciada_em timestamptz,
  rascunho            text,
  rascunho_salvo_em   timestamptz,
  resposta            text,
  respondido_em       timestamptz,
  cancelado_em        timestamptz,
  cancelado_por       uuid REFERENCES public.perfis(id),
  motivo_cancelamento text,
  documento_solicitacao_id  uuid REFERENCES public.documentos_clinicos(id),
  documento_resposta_id     uuid REFERENCES public.documentos_clinicos(id),
  documento_cancelamento_id uuid REFERENCES public.documentos_clinicos(id),
  CONSTRAINT parecer_coerente CHECK (
    (status = 'solicitado' AND analista_id IS NULL AND resposta IS NULL)
 OR (status = 'em_analise' AND analista_id IS NOT NULL AND analise_iniciada_em IS NOT NULL AND resposta IS NULL)
 OR (status = 'realizado' AND analista_id IS NOT NULL AND respondido_em IS NOT NULL AND length(btrim(coalesce(resposta, ''))) >= 10)
 OR (status = 'cancelado' AND cancelado_em IS NOT NULL AND cancelado_por IS NOT NULL AND length(btrim(coalesce(motivo_cancelamento, ''))) >= 10)
  ),
  CONSTRAINT parecer_analista_nao_solicitante CHECK (analista_id IS NULL OR analista_id <> solicitante_id)
);
CREATE INDEX IF NOT EXISTS pareceres_medicos_unidade_status ON public.pareceres_medicos (unidade_id, status, solicitado_em DESC);
CREATE INDEX IF NOT EXISTS pareceres_medicos_paciente ON public.pareceres_medicos (paciente_id, solicitado_em DESC);
CREATE INDEX IF NOT EXISTS pareceres_medicos_internacao ON public.pareceres_medicos (internacao_id) WHERE status IN ('solicitado', 'em_analise');

ALTER TABLE public.pareceres_medicos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pareceres_medicos_select ON public.pareceres_medicos;
CREATE POLICY pareceres_medicos_select ON public.pareceres_medicos FOR SELECT TO authenticated
  USING (solicitante_id = private.meu_perfil_id() OR analista_id = private.meu_perfil_id()
         OR private.eh_super_admin() OR private.papel_na_unidade(unidade_id) = 'gestor'
         OR private.pode_atuar_no_paciente(paciente_id));
REVOKE ALL ON public.pareceres_medicos FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.pareceres_medicos FROM authenticated;

-- registro clínico: não se apaga (guarda de 20 anos, fase 8)
DROP TRIGGER IF EXISTS trg_guarda_sem_delete ON public.pareceres_medicos;
CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.pareceres_medicos
  FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica();

COMMENT ON TABLE public.pareceres_medicos IS
  'Parecer médico (porte, onda 4): pedido de uma especialidade sobre o paciente. Solicitação, resposta e cancelamento viram documentos numerados (tipo parecer). Sem resposta impede a alta.';

-- ── 4. auxiliares ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.rotulo_prioridade_parecer(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p WHEN 'normal' THEN 'Normal' WHEN 'urgencia_relativa' THEN 'Urgência relativa'
                WHEN 'urgencia' THEN 'Urgência' WHEN 'emergencia' THEN 'Emergência' END;
$$;

CREATE OR REPLACE FUNCTION private.hora_brasilia(p timestamptz)
RETURNS text LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT to_char(p AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI');
$$;

-- médico da unidade com a especialidade declarada
CREATE OR REPLACE FUNCTION private.sou_parecerista(p_unidade uuid, p_especialidade text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.vinculos v
                  WHERE v.perfil_id = private.meu_perfil_id() AND v.unidade_id = p_unidade AND v.ativo
                    AND v.papel::text IN ('plantonista', 'telemedicina'))
     AND EXISTS (SELECT 1 FROM public.especialidades_perfil e
                  WHERE e.perfil_id = private.meu_perfil_id() AND e.especialidade = p_especialidade);
$$;
REVOKE ALL ON FUNCTION private.sou_parecerista(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.sou_parecerista(uuid, text) TO authenticated;

-- leitura do parecerista: em análise por ele, ou concluído por ele há menos de 24 h
CREATE OR REPLACE FUNCTION private.parecer_vigente(p_parecer uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pareceres_medicos pm
     WHERE pm.id = p_parecer AND pm.analista_id = private.meu_perfil_id()
       AND (pm.status = 'em_analise' OR (pm.status = 'realizado' AND pm.respondido_em > now() - interval '24 hours'))
       AND private.papel_na_unidade(pm.unidade_id) <> ''
  );
$$;
REVOKE ALL ON FUNCTION private.parecer_vigente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.parecer_vigente(uuid) TO authenticated;

-- ── 5. solicitar (quem está com o paciente) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.solicitar_parecer(
  p_paciente uuid, p_especialidade text, p_pergunta text, p_prioridade text DEFAULT 'normal',
  p_prestador text DEFAULT NULL, p_episodio uuid DEFAULT NULL, p_internacao uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade uuid; v_org uuid; v_int uuid := p_internacao;
  v_id uuid := gen_random_uuid();
  v_prest text := nullif(btrim(coalesce(p_prestador, '')), '');
  v_prio text := coalesce(p_prioridade, 'normal');
  d public.documentos_clinicos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT p.unidade_id, u.organizacao_id INTO v_unidade, v_org
    FROM public.pacientes p JOIN public.unidades u ON u.id = p.unidade_id WHERE p.id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF v_perfil IS NULL OR private.papel_na_unidade(v_unidade) NOT IN ('plantonista', 'gestor')
     OR private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: só o médico que está com o paciente pede parecer.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.especialidades_parecer WHERE nome = p_especialidade) THEN
    RAISE EXCEPTION 'Escolha a especialidade na lista.';
  END IF;
  IF v_prio NOT IN ('normal', 'urgencia_relativa', 'urgencia', 'emergencia') THEN RAISE EXCEPTION 'Prioridade desconhecida.'; END IF;
  IF length(btrim(coalesce(p_pergunta, ''))) < 15 THEN
    RAISE EXCEPTION 'Escreva a pergunta ao especialista (pelo menos 15 caracteres).';
  END IF;
  IF v_prest IS NOT NULL AND length(v_prest) < 3 THEN RAISE EXCEPTION 'Nome do prestador curto demais.'; END IF;
  IF v_int IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.internacoes WHERE id = v_int AND paciente_id = p_paciente) THEN
      RAISE EXCEPTION 'Internação não é deste paciente.';
    END IF;
  ELSE
    SELECT i.id INTO v_int FROM public.internacoes i
     WHERE i.paciente_id = p_paciente AND i.status IN ('admitido', 'em_observacao', 'internado') LIMIT 1;
  END IF;

  d := private.gravar_documento_episodio(NULL, p_paciente, 'parecer',
    'SOLICITAÇÃO DE PARECER MÉDICO' || E'\n' ||
    'Unidade: ' || (SELECT nome FROM public.unidades WHERE id = v_unidade) || E'\n' ||
    'Especialidade: ' || p_especialidade || coalesce(E'\n' || 'Prestador solicitado: ' || v_prest, '') || E'\n' ||
    'Prioridade: ' || private.rotulo_prioridade_parecer(v_prio) || E'\n' ||
    'Solicitante: ' || private.identificacao_medico(v_perfil) || E'\n' ||
    'Data e hora: ' || private.hora_brasilia(now()) || ' (Brasília)' || E'\n\n' ||
    'Pergunta ao especialista:' || E'\n' || btrim(p_pergunta),
    p_episodio, NULL, NULL, v_perfil, now(), false, NULL);

  INSERT INTO public.pareceres_medicos (id, organizacao_id, unidade_id, paciente_id, episodio_id, internacao_id, especialidade,
                                        prestador, prioridade, pergunta, solicitante_id, documento_solicitacao_id)
  VALUES (v_id, v_org, v_unidade, p_paciente, d.episodio_id, coalesce(v_int, d.internacao_id), p_especialidade,
          v_prest, v_prio, btrim(p_pergunta), v_perfil, d.id);

  PERFORM private.registrar_auditoria('solicitar_parecer', 'pareceres_medicos', v_id, v_unidade,
    jsonb_build_object('status', 'solicitado', 'especialidade', p_especialidade, 'prioridade', v_prio));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.solicitar_parecer(uuid, text, text, text, text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_parecer(uuid, text, text, text, text, uuid, uuid) TO authenticated;

-- ── 6. iniciar análise (especialista) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.iniciar_analise_parecer(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE pm public.pareceres_medicos; v_perfil uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pm FROM public.pareceres_medicos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parecer não encontrado.'; END IF;
  IF private.sou_parecerista(pm.unidade_id, pm.especialidade) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: declare a especialidade % (tela Pareceres) para responder.', pm.especialidade;
  END IF;
  IF pm.solicitante_id = v_perfil THEN RAISE EXCEPTION 'Quem pediu não responde o próprio parecer.'; END IF;
  IF pm.status = 'em_analise' AND pm.analista_id <> v_perfil THEN
    RAISE EXCEPTION '% já está analisando este parecer desde %.',
      (SELECT nome_completo FROM public.perfis WHERE id = pm.analista_id), private.hora_brasilia(pm.analise_iniciada_em);
  END IF;
  IF pm.status = 'em_analise' THEN RETURN; END IF;  -- já é meu
  IF pm.status <> 'solicitado' THEN RAISE EXCEPTION 'Este parecer já foi respondido ou cancelado.'; END IF;
  UPDATE public.pareceres_medicos SET status = 'em_analise', analista_id = v_perfil, analise_iniciada_em = now() WHERE id = p_id;
  PERFORM private.registrar_auditoria('iniciar_analise_parecer', 'pareceres_medicos', p_id, pm.unidade_id,
    jsonb_build_object('status', 'em_analise'));
END $$;
REVOKE ALL ON FUNCTION public.iniciar_analise_parecer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.iniciar_analise_parecer(uuid) TO authenticated;

-- ── 7. cancelar análise (volta para a fila; rascunho descartado) ────────────
CREATE OR REPLACE FUNCTION public.cancelar_analise_parecer(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE pm public.pareceres_medicos;
BEGIN
  PERFORM private.exigir_segundo_fator();
  UPDATE public.pareceres_medicos
     SET status = 'solicitado', analista_id = NULL, analise_iniciada_em = NULL, rascunho = NULL, rascunho_salvo_em = NULL
   WHERE id = p_id AND analista_id = private.meu_perfil_id() AND status = 'em_analise'
  RETURNING * INTO pm;
  IF NOT FOUND THEN RAISE EXCEPTION 'Só quem está analisando cancela a análise.'; END IF;
  PERFORM private.registrar_auditoria('cancelar_analise_parecer', 'pareceres_medicos', p_id, pm.unidade_id,
    jsonb_build_object('status', 'solicitado'));
END $$;
REVOKE ALL ON FUNCTION public.cancelar_analise_parecer(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_analise_parecer(uuid) TO authenticated;

-- ── 8. salvar rascunho ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.salvar_rascunho_parecer(p_id uuid, p_texto text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  UPDATE public.pareceres_medicos SET rascunho = nullif(p_texto, ''), rascunho_salvo_em = now()
   WHERE id = p_id AND analista_id = private.meu_perfil_id() AND status = 'em_analise';
  IF NOT FOUND THEN RAISE EXCEPTION 'Só quem está analisando salva o rascunho.'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.salvar_rascunho_parecer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_rascunho_parecer(uuid, text) TO authenticated;

-- ── 9. concluir (a resposta vira documento do especialista) ─────────────────
CREATE OR REPLACE FUNCTION public.concluir_parecer(p_id uuid, p_resposta text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pm public.pareceres_medicos;
  d public.documentos_clinicos;
  v_perfil uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pm FROM public.pareceres_medicos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parecer não encontrado.'; END IF;
  IF pm.analista_id IS DISTINCT FROM v_perfil OR pm.status <> 'em_analise' THEN
    RAISE EXCEPTION 'Só quem iniciou a análise conclui, e só enquanto está em análise.';
  END IF;
  IF length(btrim(coalesce(p_resposta, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o parecer (pelo menos 10 caracteres).'; END IF;

  d := private.gravar_documento_episodio(NULL, pm.paciente_id, 'parecer',
    'PARECER MÉDICO — ' || upper(pm.especialidade) || E'\n' ||
    'Unidade: ' || (SELECT nome FROM public.unidades WHERE id = pm.unidade_id) || E'\n' ||
    'Parecerista: ' || private.identificacao_medico(v_perfil) || E'\n' ||
    'Em resposta a: ' || private.identificacao_medico(pm.solicitante_id) ||
      coalesce(' — solicitação nº ' || (SELECT numero FROM public.documentos_clinicos WHERE id = pm.documento_solicitacao_id), '') || E'\n' ||
    'Prioridade: ' || private.rotulo_prioridade_parecer(pm.prioridade) || E'\n' ||
    'Solicitado em: ' || private.hora_brasilia(pm.solicitado_em) ||
    ' · análise iniciada em: ' || private.hora_brasilia(pm.analise_iniciada_em) ||
    ' · respondido em: ' || private.hora_brasilia(now()) || ' (Brasília)' || E'\n\n' ||
    'Pergunta:' || E'\n' || pm.pergunta || E'\n\n' ||
    'Parecer:' || E'\n' || btrim(p_resposta),
    pm.episodio_id, NULL, NULL, v_perfil, now(), false, NULL);

  UPDATE public.pareceres_medicos
     SET status = 'realizado', resposta = btrim(p_resposta), respondido_em = now(), documento_resposta_id = d.id,
         rascunho = NULL, rascunho_salvo_em = NULL
   WHERE id = p_id;
  PERFORM private.registrar_auditoria('concluir_parecer', 'pareceres_medicos', p_id, pm.unidade_id,
    jsonb_build_object('status', 'realizado'));
  RETURN d.id;
END $$;
REVOKE ALL ON FUNCTION public.concluir_parecer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.concluir_parecer(uuid, text) TO authenticated;

-- ── 10. cancelar o pedido (com motivo) ──────────────────────────────────────
-- Quem pediu, quem está com o paciente agora (o plantão seguinte) ou o
-- gestor. Vale enquanto não foi respondido. O cancelamento também entra no
-- prontuário.
CREATE OR REPLACE FUNCTION public.cancelar_parecer(p_id uuid, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pm public.pareceres_medicos;
  d public.documentos_clinicos;
  v_perfil uuid := private.meu_perfil_id();
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pm FROM public.pareceres_medicos WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Parecer não encontrado.'; END IF;
  IF v_perfil IS NULL OR NOT (
       pm.solicitante_id = v_perfil
    OR (private.papel_na_unidade(pm.unidade_id) IN ('plantonista', 'gestor') AND private.pode_atuar_no_paciente(pm.paciente_id) IS TRUE)
  ) THEN
    RAISE EXCEPTION 'Acesso negado: cancela quem pediu ou quem está com o paciente.';
  END IF;
  IF pm.status NOT IN ('solicitado', 'em_analise') THEN RAISE EXCEPTION 'Este parecer já foi respondido ou cancelado.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Informe o motivo do cancelamento (pelo menos 10 caracteres).'; END IF;

  d := private.gravar_documento_episodio(NULL, pm.paciente_id, 'parecer',
    'CANCELAMENTO DE SOLICITAÇÃO DE PARECER MÉDICO' || E'\n' ||
    'Especialidade: ' || pm.especialidade ||
      coalesce(' — solicitação nº ' || (SELECT numero FROM public.documentos_clinicos WHERE id = pm.documento_solicitacao_id), '') || E'\n' ||
    'Cancelado por: ' || private.identificacao_medico(v_perfil) || E'\n' ||
    'Data e hora: ' || private.hora_brasilia(now()) || ' (Brasília)' || E'\n' ||
    CASE WHEN pm.status = 'em_analise' THEN 'Estava em análise por: ' || private.identificacao_medico(pm.analista_id) || E'\n' ELSE '' END ||
    E'\n' || 'Motivo:' || E'\n' || btrim(p_motivo),
    pm.episodio_id, NULL, NULL, v_perfil, now(), false, NULL);

  UPDATE public.pareceres_medicos
     SET status = 'cancelado', cancelado_em = now(), cancelado_por = v_perfil, motivo_cancelamento = btrim(p_motivo),
         documento_cancelamento_id = d.id, rascunho = NULL, rascunho_salvo_em = NULL
   WHERE id = p_id;
  PERFORM private.registrar_auditoria('cancelar_parecer', 'pareceres_medicos', p_id, pm.unidade_id,
    jsonb_build_object('status', 'cancelado', 'status_anterior', pm.status));
END $$;
REVOKE ALL ON FUNCTION public.cancelar_parecer(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_parecer(uuid, text) TO authenticated;

-- ── 11. listas ──────────────────────────────────────────────────────────────
-- Histórico do paciente (aba Parecer): quem pode atuar nele, o gestor, e quem
-- pediu ou respondeu algum parecer dele.
CREATE OR REPLACE FUNCTION public.pareceres_do_paciente(p_paciente uuid)
RETURNS TABLE (id uuid, especialidade text, prestador text, prioridade text, pergunta text, status text,
               solicitante_nome text, solicitado_em timestamptz, analista_nome text, analise_iniciada_em timestamptz,
               resposta text, respondido_em timestamptz, cancelado_nome text, cancelado_em timestamptz,
               motivo_cancelamento text, documento_solicitacao_numero text, documento_resposta_numero text,
               episodio_id uuid, internacao_id uuid, meu_pedido boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_perfil uuid := private.meu_perfil_id(); v_unidade uuid;
BEGIN
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE pacientes.id = p_paciente;
  IF v_perfil IS NULL OR v_unidade IS NULL OR NOT (
       private.pode_atuar_no_paciente(p_paciente) IS TRUE
    OR private.papel_na_unidade(v_unidade) = 'gestor'
    OR EXISTS (SELECT 1 FROM public.pareceres_medicos x WHERE x.paciente_id = p_paciente
                AND (x.solicitante_id = v_perfil OR x.analista_id = v_perfil))
  ) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  SELECT pm.id, pm.especialidade, pm.prestador, pm.prioridade, pm.pergunta, pm.status,
         ps.nome_completo, pm.solicitado_em, pa.nome_completo, pm.analise_iniciada_em,
         pm.resposta, pm.respondido_em, pc.nome_completo, pm.cancelado_em, pm.motivo_cancelamento,
         ds.numero, dr.numero, pm.episodio_id, pm.internacao_id, pm.solicitante_id = v_perfil
  FROM public.pareceres_medicos pm
  JOIN public.perfis ps ON ps.id = pm.solicitante_id
  LEFT JOIN public.perfis pa ON pa.id = pm.analista_id
  LEFT JOIN public.perfis pc ON pc.id = pm.cancelado_por
  LEFT JOIN public.documentos_clinicos ds ON ds.id = pm.documento_solicitacao_id
  LEFT JOIN public.documentos_clinicos dr ON dr.id = pm.documento_resposta_id
  WHERE pm.paciente_id = p_paciente
  ORDER BY pm.solicitado_em DESC;
END $$;
REVOKE ALL ON FUNCTION public.pareceres_do_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pareceres_do_paciente(uuid) TO authenticated;

-- Fila do especialista (tela Pareceres): pedidos abertos da unidade nas
-- especialidades que declarei, os que analiso, e os que concluí nos últimos
-- p_dias. O gestor vê todos da unidade. Só o mínimo para decidir; o resumo do
-- paciente abre depois de iniciar a análise (parecer_dados_paciente).
CREATE OR REPLACE FUNCTION public.pareceres_fila(p_unidade uuid, p_dias int DEFAULT 7)
RETURNS TABLE (id uuid, paciente_id uuid, paciente_nome text, paciente_nascimento date, local text,
               especialidade text, prestador text, prioridade text, pergunta text, status text,
               solicitante_nome text, solicitado_em timestamptz, analista_nome text, analise_iniciada_em timestamptz,
               rascunho text, rascunho_salvo_em timestamptz, resposta text, respondido_em timestamptz,
               documento_solicitacao_numero text, documento_resposta_numero text, minha boolean, posso_analisar boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_gestor boolean := private.papel_na_unidade(p_unidade) = 'gestor';
  v_medico boolean := EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = private.meu_perfil_id()
                               AND v.unidade_id = p_unidade AND v.ativo AND v.papel::text IN ('plantonista', 'telemedicina'));
BEGIN
  IF v_perfil IS NULL OR NOT (v_gestor OR v_medico) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN QUERY
  SELECT pm.id, pm.paciente_id, pa.nome, pa.data_nascimento,
         nullif(concat_ws(' · ', coalesce(si.nome, se.nome, sp.nome), CASE WHEN l.identificador IS NOT NULL THEN 'Leito ' || l.identificador END), ''),
         pm.especialidade, pm.prestador, pm.prioridade, pm.pergunta, pm.status,
         ps.nome_completo, pm.solicitado_em, pan.nome_completo, pm.analise_iniciada_em,
         CASE WHEN pm.analista_id = v_perfil THEN pm.rascunho END,
         CASE WHEN pm.analista_id = v_perfil THEN pm.rascunho_salvo_em END,
         pm.resposta, pm.respondido_em, ds.numero, dr.numero,
         pm.analista_id = v_perfil,
         (pm.status = 'solicitado' AND pm.solicitante_id <> v_perfil AND private.sou_parecerista(p_unidade, pm.especialidade))
  FROM public.pareceres_medicos pm
  JOIN public.pacientes pa ON pa.id = pm.paciente_id
  LEFT JOIN public.internacoes i ON i.id = pm.internacao_id
  LEFT JOIN public.setores si ON si.id = i.setor_atual_id
  LEFT JOIN public.leitos l ON l.id = i.leito_atual_id
  LEFT JOIN public.episodios e ON e.id = pm.episodio_id
  LEFT JOIN public.setores se ON se.id = e.setor_id
  LEFT JOIN public.setores sp ON sp.id = pa.setor_id
  JOIN public.perfis ps ON ps.id = pm.solicitante_id
  LEFT JOIN public.perfis pan ON pan.id = pm.analista_id
  LEFT JOIN public.documentos_clinicos ds ON ds.id = pm.documento_solicitacao_id
  LEFT JOIN public.documentos_clinicos dr ON dr.id = pm.documento_resposta_id
  WHERE pm.unidade_id = p_unidade
    AND (
      (pm.status IN ('solicitado', 'em_analise')
        AND (v_gestor OR pm.analista_id = v_perfil
             OR EXISTS (SELECT 1 FROM public.especialidades_perfil ep WHERE ep.perfil_id = v_perfil AND ep.especialidade = pm.especialidade)))
      OR (pm.status = 'realizado' AND (pm.analista_id = v_perfil OR v_gestor)
          AND pm.respondido_em > now() - make_interval(days => greatest(1, least(coalesce(p_dias, 7), 90))))
    )
  ORDER BY (pm.status = 'realizado'), array_position(ARRAY['emergencia', 'urgencia', 'urgencia_relativa', 'normal'], pm.prioridade),
           pm.solicitado_em;
END $$;
REVOKE ALL ON FUNCTION public.pareceres_fila(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pareceres_fila(uuid, int) TO authenticated;

-- Resumo do paciente para o parecerista (leitura temporária, como a
-- teleinterconsulta): identificação, alergias ativas, exames e os últimos
-- documentos clínicos. Grava o acesso no log do prontuário (uma vez a cada 5 min).
CREATE OR REPLACE FUNCTION public.parecer_dados_paciente(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pm public.pareceres_medicos;
  v_perfil uuid := private.meu_perfil_id();
  r jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pm FROM public.pareceres_medicos WHERE id = p_id;
  IF NOT FOUND OR private.parecer_vigente(p_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: o resumo do paciente abre para quem analisa o parecer (até 24 h depois de concluir).';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.log_acesso_prontuario
                  WHERE acessado_por = v_perfil AND paciente_id = pm.paciente_id AND tipo_acesso = 'leitura_prontuario'
                    AND created_at > now() - interval '5 minutes') THEN
    INSERT INTO public.log_acesso_prontuario
      (organizacao_id, unidade_id, paciente_id, internacao_id, acessado_por, papel, tipo_acesso, documento_id, documento_tipo, ip, user_agent)
    VALUES (pm.organizacao_id, pm.unidade_id, pm.paciente_id, pm.internacao_id, v_perfil,
            nullif(private.papel_na_unidade(pm.unidade_id), ''), 'leitura_prontuario', pm.documento_solicitacao_id, 'parecer',
            private.requisicao_ip(), private.requisicao_navegador());
  END IF;

  SELECT jsonb_build_object(
    'paciente', (SELECT jsonb_build_object('nome', pa.nome, 'nome_social', pa.nome_social, 'nascimento', pa.data_nascimento,
                                           'sexo', pa.sexo, 'prontuario', pa.prontuario)
                   FROM public.pacientes pa WHERE pa.id = pm.paciente_id),
    'alergias', coalesce((SELECT jsonb_agg(jsonb_build_object('substancia', a.substancia, 'reacao', a.reacao, 'gravidade', a.gravidade)
                                           ORDER BY a.registrado_em)
                            FROM public.alergias_paciente a WHERE a.paciente_id = pm.paciente_id AND a.inativada_em IS NULL), '[]'::jsonb),
    'exames', coalesce((SELECT jsonb_agg(jsonb_build_object('exame', x.exame, 'situacao', x.situacao, 'pedido_em', x.pedido_em,
                                                           'resultado', x.resultado, 'resolvido_em', x.resolvido_em)
                                         ORDER BY x.pedido_em DESC)
                          FROM public.exames_pedidos x WHERE x.paciente_id = pm.paciente_id AND x.situacao <> 'cancelado'), '[]'::jsonb),
    'documentos', coalesce((SELECT jsonb_agg(z ORDER BY z ->> 'emitido_em' DESC) FROM (
                              SELECT jsonb_build_object('tipo', dc.tipo_documento, 'numero', dc.numero, 'emitido_em', dc.emitido_em,
                                                        'autor', pf.nome_completo, 'conteudo', dc.conteudo) z
                                FROM public.documentos_clinicos dc LEFT JOIN public.perfis pf ON pf.id = dc.autor_id
                               WHERE dc.paciente_id = pm.paciente_id AND dc.estado = 'ativo'
                                 AND dc.tipo_documento IN ('admissao_anamnese', 'evolucao', 'boletim_emergencia', 'parecer', 'teleinterconsulta')
                               ORDER BY dc.emitido_em DESC NULLS LAST LIMIT 12) q), '[]'::jsonb)
  ) INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.parecer_dados_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.parecer_dados_paciente(uuid) TO authenticated;

-- ── 12. parecer sem resposta impede a alta (acrescenta um ramo) ─────────────
DO $$
DECLARE v_def text; v_novo text;
BEGIN
  v_def := pg_get_functiondef('private.impeditivos_alta(uuid)'::regprocedure);
  IF v_def NOT LIKE '%pareceres_medicos%' THEN
    v_novo := regexp_replace(v_def, '\)\s*s\s*\$function\$',
      'UNION ALL
    SELECT jsonb_build_object(''tipo'', ''parecer'', ''id'', pm.id,
                              ''descricao'', ''Parecer sem resposta: '' || pm.especialidade
                                || CASE pm.status WHEN ''em_analise'' THEN '' (em análise)'' ELSE '' (solicitado)'' END)
      FROM public.pareceres_medicos pm JOIN public.internacoes i ON i.id = p_internacao
     WHERE pm.paciente_id = i.paciente_id AND pm.status IN (''solicitado'', ''em_analise'')
       AND (pm.internacao_id = i.id OR (i.episodio_id IS NOT NULL AND pm.episodio_id = i.episodio_id))
  ) s
$function$');
    IF v_novo = v_def THEN RAISE EXCEPTION 'Fim de private.impeditivos_alta não reconhecido.'; END IF;
    EXECUTE v_novo;
  END IF;
END $$;

-- IMPRESSÃO (onda 6, folhas no servidor): a folha do parecer (cabeçalho e
-- rodapé por página, especialidade, prestador, prioridade, solicitante,
-- pergunta, parecer ou linhas em branco, assinaturas do solicitante e do
-- parecerista — protótipo, montarParecerHtml) e o histórico do paciente saem
-- de pareceres_do_paciente quando as folhas vierem para o servidor.
