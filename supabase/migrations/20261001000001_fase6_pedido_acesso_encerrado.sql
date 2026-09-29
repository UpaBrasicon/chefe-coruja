-- ════════════════════════════════════════════════════════════════════════════
-- Fase 6 — pedido de acesso ao prontuário encerrado.
--
-- CONTEXT.md, Prontuário: "O encerrado só é lido mediante pedido aprovado pelo
-- gestor, que vale 24 horas." Até aqui não existia caminho: fora da escala o
-- profissional simplesmente não lia.
--
-- Como fica:
--   1. O profissional acha o paciente por identificação exata
--      (buscar_paciente_para_pedido) e pede, com motivo (pedir_acesso_prontuario).
--   2. O gestor da unidade aprova ou recusa (decidir_pedido_acesso). Recusa
--      exige motivo; ninguém decide o próprio pedido.
--   3. Aprovado, vale 24 horas a partir da aprovação e é SÓ LEITURA: entra como
--      policy PERMISSIVA de SELECT nas tabelas clínicas. As regras de escrita
--      (pode_atuar_no_paciente e as RPCs) não mudam.
--   4. A leitura continua passando por abrir_prontuario, que grava o acesso;
--      impressão e exportação ficam fora do pedido.
--
-- Expandir, não contrair: nada existente muda de sentido. O acesso do gestor
-- segue como antes (decisão pendente do usuário, registrada no plano).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.pedidos_acesso_prontuario (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacao_id  uuid NOT NULL REFERENCES public.organizacoes(id),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  paciente_id     uuid NOT NULL REFERENCES public.pacientes(id),
  solicitante_id  uuid NOT NULL REFERENCES public.perfis(id),
  papel           text NOT NULL,
  motivo          text NOT NULL CHECK (length(btrim(motivo)) >= 10),
  status          text NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente', 'aprovado', 'recusado', 'cancelado')),
  criado_em       timestamptz NOT NULL DEFAULT now(),
  decidido_por    uuid REFERENCES public.perfis(id),
  decidido_em     timestamptz,
  motivo_decisao  text,
  valido_ate      timestamptz,
  CONSTRAINT pedido_decisao_coerente CHECK (
    (status = 'pendente'  AND decidido_por IS NULL AND valido_ate IS NULL)
 OR (status = 'aprovado'  AND decidido_por IS NOT NULL AND valido_ate IS NOT NULL)
 OR (status = 'recusado'  AND decidido_por IS NOT NULL AND length(btrim(coalesce(motivo_decisao, ''))) >= 5)
 OR (status = 'cancelado')
  ),
  CONSTRAINT pedido_nao_autodecidido CHECK (decidido_por IS NULL OR decidido_por <> solicitante_id)
);
CREATE INDEX IF NOT EXISTS pedidos_acesso_unidade_status ON public.pedidos_acesso_prontuario (unidade_id, status, criado_em DESC);
CREATE INDEX IF NOT EXISTS pedidos_acesso_solicitante ON public.pedidos_acesso_prontuario (solicitante_id, paciente_id, status);
-- um pedido pendente por pessoa e paciente
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_acesso_um_pendente
  ON public.pedidos_acesso_prontuario (solicitante_id, paciente_id) WHERE status = 'pendente';

ALTER TABLE public.pedidos_acesso_prontuario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pedidos_acesso_select ON public.pedidos_acesso_prontuario;
CREATE POLICY pedidos_acesso_select ON public.pedidos_acesso_prontuario
  FOR SELECT TO authenticated
  USING (solicitante_id = private.meu_perfil_id()
         OR private.eh_super_admin()
         OR private.papel_na_unidade(unidade_id) = 'gestor');
-- Sem INSERT/UPDATE/DELETE por policy: só pelas RPCs abaixo.
REVOKE ALL ON public.pedidos_acesso_prontuario FROM anon;

-- ── o acesso vigente ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.acesso_encerrado_vigente(p_paciente uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pedidos_acesso_prontuario pd
    WHERE pd.paciente_id = p_paciente
      AND pd.solicitante_id = private.meu_perfil_id()
      AND pd.status = 'aprovado'
      AND pd.valido_ate > now()
      -- o vínculo precisa continuar ativo na unidade
      AND private.papel_na_unidade(pd.unidade_id) <> ''
  );
$$;
REVOKE ALL ON FUNCTION private.acesso_encerrado_vigente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.acesso_encerrado_vigente(uuid) TO authenticated;

-- papéis que podem pedir: quem lê prontuário no cuidado. Recepção e
-- administrador não (o administrador só vê agregado, ADR 0002).
CREATE OR REPLACE FUNCTION private.papel_pode_pedir_acesso(p_papel text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_papel IN ('plantonista', 'telemedicina', 'enfermeiro', 'tecnico_enfermagem', 'farmaceutico');
$$;

-- ── busca por identificação exata ───────────────────────────────────────────
-- Quem está fora da escala não lista pacientes. Para pedir, identifica o
-- paciente por número de prontuário, CPF ou CNS exatos, ou por nome (3+
-- letras) junto com a data de nascimento exata. No máximo 10 linhas, e a
-- busca fica na trilha (sem o termo, que é dado pessoal).
CREATE OR REPLACE FUNCTION public.buscar_paciente_para_pedido(
  p_unidade uuid, p_documento text DEFAULT NULL, p_nome text DEFAULT NULL, p_nascimento date DEFAULT NULL)
RETURNS TABLE (paciente_id uuid, nome text, data_nascimento date, prontuario text, ultimo_encerramento timestamptz, tem_acesso boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_doc text := nullif(regexp_replace(coalesce(p_documento, ''), '\s', '', 'g'), '');
  v_nome text := nullif(btrim(coalesce(p_nome, '')), '');
BEGIN
  IF private.meu_perfil_id() IS NULL OR NOT private.papel_pode_pedir_acesso(private.papel_na_unidade(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  IF v_doc IS NULL AND (v_nome IS NULL OR length(v_nome) < 3 OR p_nascimento IS NULL) THEN
    RAISE EXCEPTION 'Informe o prontuário, o CPF ou o CNS exatos, ou o nome com a data de nascimento.';
  END IF;
  RETURN QUERY
  SELECT pa.id, pa.nome, pa.data_nascimento, pa.prontuario,
         (SELECT max(e.encerrado_em) FROM public.episodios e WHERE e.paciente_id = pa.id),
         private.pode_atuar_no_paciente(pa.id) OR private.acesso_encerrado_vigente(pa.id)
  FROM public.pacientes pa
  WHERE pa.unidade_id = p_unidade
    AND (
      (v_doc IS NOT NULL AND (pa.prontuario = v_doc
                              OR regexp_replace(coalesce(pa.cpf, ''), '\D', '', 'g') = regexp_replace(v_doc, '\D', '', 'g') AND length(regexp_replace(v_doc, '\D', '', 'g')) = 11
                              OR pa.cns = v_doc))
      OR (v_doc IS NULL AND pa.data_nascimento = p_nascimento
          AND (pa.nome ILIKE '%' || v_nome || '%' OR pa.nome_social ILIKE '%' || v_nome || '%'))
    )
  ORDER BY pa.nome
  LIMIT 10;
END $$;
REVOKE ALL ON FUNCTION public.buscar_paciente_para_pedido(uuid, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_paciente_para_pedido(uuid, text, text, date) TO authenticated;

-- A busca é STABLE (não grava). A trilha fica no pedido, que grava.

-- ── pedir ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pedir_acesso_prontuario(p_paciente uuid, p_motivo text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade uuid;
  v_papel text;
  v_id uuid;
BEGIN
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  v_papel := private.papel_na_unidade(v_unidade);
  IF NOT private.papel_pode_pedir_acesso(v_papel) THEN
    RAISE EXCEPTION 'Acesso negado: seu papel nesta unidade não pede acesso a prontuário.';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'Escreva o motivo do pedido (pelo menos 10 caracteres).';
  END IF;
  IF private.pode_atuar_no_paciente(p_paciente) THEN
    RAISE EXCEPTION 'Você já tem acesso a este paciente pela escala.';
  END IF;
  IF private.acesso_encerrado_vigente(p_paciente) THEN
    RAISE EXCEPTION 'Você já tem um pedido aprovado e vigente para este paciente.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pedidos_acesso_prontuario
             WHERE solicitante_id = v_perfil AND paciente_id = p_paciente AND status = 'pendente') THEN
    RAISE EXCEPTION 'Já existe um pedido seu aguardando o gestor para este paciente.';
  END IF;

  INSERT INTO public.pedidos_acesso_prontuario (organizacao_id, unidade_id, paciente_id, solicitante_id, papel, motivo)
  VALUES ((SELECT organizacao_id FROM public.unidades WHERE id = v_unidade), v_unidade, p_paciente, v_perfil, v_papel, btrim(p_motivo))
  RETURNING id INTO v_id;

  PERFORM private.registrar_auditoria('pedir_acesso_prontuario', 'pedidos_acesso_prontuario', v_id, v_unidade,
    jsonb_build_object('papel', v_papel, 'status', 'pendente'));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.pedir_acesso_prontuario(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pedir_acesso_prontuario(uuid, text) TO authenticated;

-- ── decidir (gestor da unidade) ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decidir_pedido_acesso(p_pedido uuid, p_aprovar boolean, p_motivo text DEFAULT NULL)
RETURNS public.pedidos_acesso_prontuario
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  r public.pedidos_acesso_prontuario;
BEGIN
  SELECT * INTO r FROM public.pedidos_acesso_prontuario WHERE id = p_pedido FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado.'; END IF;
  IF NOT (private.eh_super_admin() OR private.papel_na_unidade(r.unidade_id) = 'gestor') THEN
    RAISE EXCEPTION 'Acesso negado: só o gestor da unidade decide o pedido.';
  END IF;
  IF r.solicitante_id = v_perfil THEN RAISE EXCEPTION 'Ninguém decide o próprio pedido.'; END IF;
  IF r.status <> 'pendente' THEN RAISE EXCEPTION 'Este pedido já foi decidido.'; END IF;
  IF NOT p_aprovar AND length(btrim(coalesce(p_motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'Para recusar, escreva o motivo.';
  END IF;

  UPDATE public.pedidos_acesso_prontuario
     SET status = CASE WHEN p_aprovar THEN 'aprovado' ELSE 'recusado' END,
         decidido_por = v_perfil,
         decidido_em = now(),
         motivo_decisao = nullif(btrim(coalesce(p_motivo, '')), ''),
         valido_ate = CASE WHEN p_aprovar THEN now() + interval '24 hours' END
   WHERE id = p_pedido
  RETURNING * INTO r;

  PERFORM private.registrar_auditoria('decidir_pedido_acesso', 'pedidos_acesso_prontuario', r.id, r.unidade_id,
    jsonb_build_object('status', r.status, 'perfil_id', r.solicitante_id));
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.decidir_pedido_acesso(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decidir_pedido_acesso(uuid, boolean, text) TO authenticated;

-- ── cancelar (quem pediu, enquanto pendente) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancelar_pedido_acesso(p_pedido uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r public.pedidos_acesso_prontuario;
BEGIN
  UPDATE public.pedidos_acesso_prontuario SET status = 'cancelado'
   WHERE id = p_pedido AND solicitante_id = private.meu_perfil_id() AND status = 'pendente'
  RETURNING * INTO r;
  IF NOT FOUND THEN RAISE EXCEPTION 'Só quem pediu cancela, e só enquanto está pendente.'; END IF;
  PERFORM private.registrar_auditoria('cancelar_pedido_acesso', 'pedidos_acesso_prontuario', r.id, r.unidade_id,
    jsonb_build_object('status', 'cancelado'));
END $$;
REVOKE ALL ON FUNCTION public.cancelar_pedido_acesso(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_pedido_acesso(uuid) TO authenticated;

-- ── listas ──────────────────────────────────────────────────────────────────
-- Para o gestor: pedidos da unidade com nome do paciente e de quem pediu.
CREATE OR REPLACE FUNCTION public.pedidos_acesso_da_unidade(p_unidade uuid, p_dias int DEFAULT 30)
RETURNS TABLE (id uuid, paciente_id uuid, paciente_nome text, paciente_nascimento date, solicitante_id uuid,
               solicitante_nome text, papel text, motivo text, status text, criado_em timestamptz,
               decidido_por_nome text, decidido_em timestamptz, motivo_decisao text, valido_ate timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) = 'gestor') THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  SELECT pd.id, pd.paciente_id, pa.nome, pa.data_nascimento, pd.solicitante_id, ps.nome_completo, pd.papel,
         pd.motivo, pd.status, pd.criado_em, pg.nome_completo, pd.decidido_em, pd.motivo_decisao, pd.valido_ate
  FROM public.pedidos_acesso_prontuario pd
  JOIN public.pacientes pa ON pa.id = pd.paciente_id
  JOIN public.perfis ps ON ps.id = pd.solicitante_id
  LEFT JOIN public.perfis pg ON pg.id = pd.decidido_por
  WHERE pd.unidade_id = p_unidade
    AND (pd.status = 'pendente' OR pd.criado_em > now() - make_interval(days => greatest(1, least(coalesce(p_dias, 30), 365))))
  ORDER BY (pd.status = 'pendente') DESC, pd.criado_em DESC;
END $$;
REVOKE ALL ON FUNCTION public.pedidos_acesso_da_unidade(uuid, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pedidos_acesso_da_unidade(uuid, int) TO authenticated;

-- Para quem pediu: os próprios pedidos, com o nome do paciente que ele mesmo
-- identificou.
CREATE OR REPLACE FUNCTION public.meus_pedidos_acesso(p_unidade uuid)
RETURNS TABLE (id uuid, paciente_id uuid, paciente_nome text, motivo text, status text, criado_em timestamptz,
               decidido_em timestamptz, motivo_decisao text, valido_ate timestamptz, vigente boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pd.id, pd.paciente_id, pa.nome, pd.motivo, pd.status, pd.criado_em, pd.decidido_em, pd.motivo_decisao,
         pd.valido_ate, (pd.status = 'aprovado' AND pd.valido_ate > now())
  FROM public.pedidos_acesso_prontuario pd
  JOIN public.pacientes pa ON pa.id = pd.paciente_id
  WHERE pd.solicitante_id = private.meu_perfil_id()
    AND pd.unidade_id = p_unidade
    AND pd.criado_em > now() - interval '30 days'
  ORDER BY pd.criado_em DESC;
$$;
REVOKE ALL ON FUNCTION public.meus_pedidos_acesso(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.meus_pedidos_acesso(uuid) TO authenticated;

-- ── abrir o prontuário com pedido vigente (só leitura) ──────────────────────
CREATE OR REPLACE FUNCTION private.gravar_acesso(p_paciente uuid, p_internacao uuid, p_tipo text, p_documento uuid, p_documento_tipo text)
 RETURNS public.log_acesso_prontuario
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade uuid;
  r public.log_acesso_prontuario;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = p_paciente;
  -- Fase 6: pedido aprovado e vigente abre para LEITURA (não impressão nem exportação)
  IF v_unidade IS NULL OR NOT (
       private.pode_atuar_no_paciente(p_paciente) IS TRUE
    OR (p_tipo IN ('leitura_prontuario', 'leitura_documento') AND private.acesso_encerrado_vigente(p_paciente))
  ) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
  END IF;
  IF p_internacao IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.internacoes WHERE id = p_internacao AND paciente_id = p_paciente) THEN
    RAISE EXCEPTION 'Internação não pertence ao paciente.';
  END IF;

  INSERT INTO public.log_acesso_prontuario
    (organizacao_id, unidade_id, paciente_id, internacao_id, acessado_por, papel,
     tipo_acesso, documento_id, documento_tipo, ip, user_agent)
  VALUES
    ((SELECT organizacao_id FROM public.unidades WHERE id = v_unidade),
     v_unidade, p_paciente, p_internacao, v_perfil,
     nullif(private.papel_na_unidade(v_unidade), ''), p_tipo, p_documento, p_documento_tipo,
     private.requisicao_ip(), private.requisicao_navegador())
  RETURNING * INTO r;
  RETURN r;
END $function$;

CREATE OR REPLACE FUNCTION public.abrir_prontuario(p_paciente uuid, p_internacao uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.log_acesso_prontuario
    WHERE acessado_por = private.meu_perfil_id()
      AND paciente_id = p_paciente
      AND tipo_acesso = 'leitura_prontuario'
      AND internacao_id IS NOT DISTINCT FROM p_internacao
      AND created_at > now() - interval '5 minutes'
  ) THEN
    -- ainda confere o acesso: sem isso, a janela viraria atalho
    IF private.pode_atuar_no_paciente(p_paciente) IS NOT TRUE
       AND private.acesso_encerrado_vigente(p_paciente) IS NOT TRUE THEN
      RAISE EXCEPTION 'Acesso negado: paciente fora dos setores do seu plantão.';
    END IF;
    RETURN;
  END IF;
  PERFORM private.gravar_acesso(p_paciente, p_internacao, 'leitura_prontuario', NULL, NULL);
END $$;
REVOKE ALL ON FUNCTION public.abrir_prontuario(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abrir_prontuario(uuid, uuid) TO authenticated;

-- ── leitura: policies permissivas extras ────────────────────────────────────
-- Somam-se (OR) às de hoje. As restritivas de "prontuário aberto" continuam
-- valendo, então a leitura exige abrir_prontuario antes, como no plantão.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['administracoes', 'agravos_notificacao', 'alergias_paciente', 'alta_paciente',
    'atendimento_registros', 'checklist_admissao', 'classificacoes_risco', 'documentos_clinicos', 'episodios',
    'eventos_adt', 'exames_pedidos', 'internacoes', 'observacao', 'pacotes_alta', 'pendencias', 'prescricoes',
    'sugestoes_prescricao'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %1$s_pedido_acesso ON public.%1$I', t);
    EXECUTE format(
      'CREATE POLICY %1$s_pedido_acesso ON public.%1$I FOR SELECT TO authenticated
         USING (private.acesso_encerrado_vigente(paciente_id))', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS pacientes_pedido_acesso ON public.pacientes;
CREATE POLICY pacientes_pedido_acesso ON public.pacientes FOR SELECT TO authenticated
  USING (private.acesso_encerrado_vigente(id));

DROP POLICY IF EXISTS prescricao_itens_pedido_acesso ON public.prescricao_itens;
CREATE POLICY prescricao_itens_pedido_acesso ON public.prescricao_itens FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.prescricoes p
                 WHERE p.id = prescricao_itens.prescricao_id
                   AND private.acesso_encerrado_vigente(p.paciente_id)));

COMMENT ON TABLE public.pedidos_acesso_prontuario IS
  'Fase 6: pedido de leitura do prontuário fora da escala. Aprovado pelo gestor da unidade, vale 24 h, só leitura.';
