-- ════════════════════════════════════════════════════════════════════════════
-- Fase 8 — guarda de 20 anos (Lei 13.787/2018, art. 6º).
--
-- "Passado o prazo mínimo de 20 anos a partir do último registro, os
-- prontuários podem ser eliminados" (art. 6º), com a destinação final
-- REGISTRADA (§4º), inclusive os nascidos em meio eletrônico (§5º). Pesquisa
-- em produto/docs/pesquisa/fontes-primarias-arquitetura.md, seção 6.
--
-- O que muda:
--   1. Registro clínico não se apaga por DELETE: gatilho em todas as tabelas
--      clínicas. Exceções: prescrição ainda em rascunho (e os itens dela), e a
--      execução de uma eliminação aprovada (variável de sessão só ligada pela
--      função que executa). Apagar a unidade ou a organização em cascata
--      também esbarra no gatilho.
--   2. Anexos do prontuário (bucket "atendimento"): só o super admin apaga.
--   3. Último registro por paciente (private.ultimo_registro_paciente) e o
--      retrato da guarda por unidade (guarda_prontuarios).
--   4. Fluxo registrado de destinação final: o gestor solicita (eliminação ou
--      devolução ao paciente), só depois de 20 anos do último registro; o
--      responsável técnico médico, outra pessoa, aprova. O registro fica em
--      destinacoes_prontuario, que é só inserção e atualização de estado.
--      A EXECUÇÃO (apagar ou entregar) fica para quando houver o primeiro
--      prontuário elegível (a partir de 2046): o procedimento está descrito no
--      passo a passo e não roda sozinho.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. nada clínico sai por DELETE ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.bloquear_exclusao_clinica()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_setting('chefe_coruja.destinacao_autorizada', true) = 'sim' THEN
    RETURN OLD;
  END IF;
  -- rascunho de prescrição ainda não é registro (campos lidos como JSON: o
  -- mesmo gatilho serve tabelas sem essas colunas)
  IF TG_TABLE_NAME = 'prescricoes' AND to_jsonb(OLD) ->> 'status' = 'rascunho' THEN
    RETURN OLD;
  END IF;
  IF TG_TABLE_NAME = 'prescricao_itens' THEN
    -- a prescrição-mãe é rascunho, ou já saiu nesta mesma exclusão em cascata
    IF NOT EXISTS (SELECT 1 FROM public.prescricoes p WHERE p.id = (to_jsonb(OLD) ->> 'prescricao_id')::uuid AND p.status <> 'rascunho') THEN
      RETURN OLD;
    END IF;
  END IF;
  RAISE EXCEPTION 'Registro clínico não se apaga: a guarda é de 20 anos a partir do último registro (Lei 13.787/2018, art. 6º). Use a retificação ou o fluxo de destinação final.'
    USING ERRCODE = '42501';
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pacientes', 'episodios', 'internacoes', 'documentos_clinicos', 'observacao', 'prescricoes',
    'prescricao_itens', 'classificacoes_risco', 'atendimento_registros', 'alergias_paciente', 'administracoes',
    'exames_pedidos', 'agravos_notificacao', 'alta_paciente', 'checklist_admissao', 'pacotes_alta', 'pendencias',
    'eventos_adt', 'sugestoes_prescricao', 'teleinterconsultas', 'pedidos_acesso_prontuario', 'passagens_plantao',
    'transferencias_paciente', 'sincronizacao_revisao'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS trg_guarda_sem_delete ON public.%I', t);
      EXECUTE format('CREATE TRIGGER trg_guarda_sem_delete BEFORE DELETE ON public.%I
                        FOR EACH ROW EXECUTE FUNCTION private.bloquear_exclusao_clinica()', t);
    END IF;
  END LOOP;
END $$;

-- ── 2. anexos do prontuário ─────────────────────────────────────────────────
DROP POLICY IF EXISTS atendimento_delete ON storage.objects;
CREATE POLICY atendimento_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'atendimento' AND private.eh_super_admin());

-- ── 3. último registro ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.ultimo_registro_paciente(p_paciente uuid)
RETURNS timestamptz
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT greatest(
    (SELECT max(created_at) FROM public.pacientes WHERE id = p_paciente),
    (SELECT max(greatest(chegada_em, coalesce(encerrado_em, chegada_em))) FROM public.episodios WHERE paciente_id = p_paciente),
    (SELECT max(greatest(data_admissao, coalesce(data_alta, data_admissao))) FROM public.internacoes WHERE paciente_id = p_paciente),
    (SELECT max(created_at) FROM public.documentos_clinicos WHERE paciente_id = p_paciente),
    (SELECT max(greatest(created_at, aferido_em)) FROM public.observacao WHERE paciente_id = p_paciente),
    (SELECT max(created_at) FROM public.prescricoes WHERE paciente_id = p_paciente),
    (SELECT max(criado_em) FROM public.classificacoes_risco WHERE paciente_id = p_paciente)
  );
$$;
REVOKE ALL ON FUNCTION private.ultimo_registro_paciente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.ultimo_registro_paciente(uuid) TO authenticated;

-- Retrato da guarda da unidade, para o gestor: quantos prontuários, o último
-- registro mais antigo e quantos já passaram dos 20 anos. Sem nomes.
CREATE OR REPLACE FUNCTION public.guarda_prontuarios(p_unidade uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v jsonb;
BEGIN
  IF NOT (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) = 'gestor') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  WITH u AS (
    SELECT private.ultimo_registro_paciente(p.id) AS ultimo FROM public.pacientes p WHERE p.unidade_id = p_unidade
  )
  SELECT jsonb_build_object(
    'prontuarios', count(*),
    'ultimo_registro_mais_antigo', min(ultimo),
    'primeira_elegibilidade', min(ultimo) + interval '20 years',
    'elegiveis', count(*) FILTER (WHERE ultimo < now() - interval '20 years'),
    'destinacoes_registradas', (SELECT count(*) FROM public.destinacoes_prontuario d WHERE d.unidade_id = p_unidade)
  ) INTO v FROM u;
  RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.guarda_prontuarios(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guarda_prontuarios(uuid) TO authenticated;

-- ── 4. destinação final registrada ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.destinacoes_prontuario (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id          uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id         uuid NOT NULL,                 -- sem FK: o registro sobrevive à eliminação
  prontuario_numero   text,
  identificacao_hash  text NOT NULL,                 -- sha256 de nome + nascimento: prova sem guardar o nome
  ultimo_registro_em  timestamptz NOT NULL,
  destinacao          text NOT NULL CHECK (destinacao IN ('eliminacao', 'devolucao_paciente')),
  motivo              text NOT NULL CHECK (length(btrim(motivo)) >= 10),
  solicitado_por      uuid NOT NULL REFERENCES public.perfis(id),
  solicitado_em       timestamptz NOT NULL DEFAULT now(),
  status              text NOT NULL DEFAULT 'solicitada' CHECK (status IN ('solicitada', 'aprovada', 'recusada', 'executada')),
  aprovado_por        uuid REFERENCES public.perfis(id),
  aprovado_em         timestamptz,
  motivo_decisao      text,
  executado_em        timestamptz,
  CONSTRAINT destinacao_20_anos CHECK (ultimo_registro_em <= solicitado_em - interval '20 years'),
  CONSTRAINT destinacao_duas_pessoas CHECK (aprovado_por IS NULL OR aprovado_por <> solicitado_por)
);
ALTER TABLE public.destinacoes_prontuario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS destinacoes_select ON public.destinacoes_prontuario;
CREATE POLICY destinacoes_select ON public.destinacoes_prontuario FOR SELECT TO authenticated
  USING (private.eh_super_admin() OR private.papel_na_unidade(unidade_id) = 'gestor'
         OR private.responsavel_tecnico('medico') IS NOT NULL);
REVOKE ALL ON public.destinacoes_prontuario FROM anon;
DROP TRIGGER IF EXISTS trg_destinacao_sem_delete ON public.destinacoes_prontuario;
CREATE TRIGGER trg_destinacao_sem_delete BEFORE DELETE ON public.destinacoes_prontuario
  FOR EACH ROW EXECUTE FUNCTION private.so_insercao();

CREATE OR REPLACE FUNCTION public.solicitar_destinacao_prontuario(p_paciente uuid, p_destinacao text, p_motivo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pa public.pacientes;
  v_ultimo timestamptz;
  v_id uuid;
BEGIN
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF NOT (private.eh_super_admin() OR private.papel_na_unidade(pa.unidade_id) = 'gestor') THEN
    RAISE EXCEPTION 'Acesso negado: só o gestor da unidade solicita a destinação final.';
  END IF;
  v_ultimo := private.ultimo_registro_paciente(p_paciente);
  IF v_ultimo > now() - interval '20 years' THEN
    RAISE EXCEPTION 'Prontuário dentro da guarda: o último registro é de %, e a destinação só é possível a partir de % (Lei 13.787/2018, art. 6º).',
      to_char(v_ultimo AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY'),
      to_char((v_ultimo + interval '20 years') AT TIME ZONE 'America/Sao_Paulo', 'DD/MM/YYYY');
  END IF;
  IF p_destinacao NOT IN ('eliminacao', 'devolucao_paciente') THEN RAISE EXCEPTION 'Destinação desconhecida.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (pelo menos 10 caracteres).'; END IF;
  INSERT INTO public.destinacoes_prontuario (unidade_id, paciente_id, prontuario_numero, identificacao_hash, ultimo_registro_em,
                                             destinacao, motivo, solicitado_por)
  VALUES (pa.unidade_id, pa.id, pa.prontuario,
          encode(extensions.digest(convert_to(lower(pa.nome) || '|' || coalesce(pa.data_nascimento::text, ''), 'UTF8'), 'sha256'), 'hex'),
          v_ultimo, p_destinacao, btrim(p_motivo), private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('solicitar_destinacao_prontuario', 'destinacoes_prontuario', v_id, pa.unidade_id,
    jsonb_build_object('tipo', p_destinacao, 'status', 'solicitada'));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.solicitar_destinacao_prontuario(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_destinacao_prontuario(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.decidir_destinacao_prontuario(p_id uuid, p_aprovar boolean, p_motivo text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE d public.destinacoes_prontuario;
BEGIN
  SELECT * INTO d FROM public.destinacoes_prontuario WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Destinação não encontrada.'; END IF;
  IF private.responsavel_tecnico('medico') IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: só o responsável técnico médico decide a destinação final.';
  END IF;
  IF d.solicitado_por = private.meu_perfil_id() THEN RAISE EXCEPTION 'Quem solicitou não decide.'; END IF;
  IF d.status <> 'solicitada' THEN RAISE EXCEPTION 'Esta destinação já foi decidida.'; END IF;
  IF NOT p_aprovar AND length(btrim(coalesce(p_motivo, ''))) < 5 THEN RAISE EXCEPTION 'Para recusar, escreva o motivo.'; END IF;
  UPDATE public.destinacoes_prontuario
     SET status = CASE WHEN p_aprovar THEN 'aprovada' ELSE 'recusada' END,
         aprovado_por = private.meu_perfil_id(), aprovado_em = now(), motivo_decisao = nullif(btrim(coalesce(p_motivo, '')), '')
   WHERE id = p_id;
  PERFORM private.registrar_auditoria('decidir_destinacao_prontuario', 'destinacoes_prontuario', p_id, d.unidade_id,
    jsonb_build_object('status', CASE WHEN p_aprovar THEN 'aprovada' ELSE 'recusada' END));
END $$;
REVOKE ALL ON FUNCTION public.decidir_destinacao_prontuario(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decidir_destinacao_prontuario(uuid, boolean, text) TO authenticated;

COMMENT ON TABLE public.destinacoes_prontuario IS
  'Fase 8: registro da destinação final do prontuário (Lei 13.787/2018, art. 6º, §4º). Só depois de 20 anos do último registro; gestor solicita, RT médico aprova. A execução é procedimento assistido (docs).';
