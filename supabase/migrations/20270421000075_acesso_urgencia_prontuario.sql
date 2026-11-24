-- ════════════════════════════════════════════════════════════════════════════
-- Ajustes da revisão (RT, 24/11/2026), item 6: acesso de urgência ao
-- prontuário ("quebra de vidro").
--
-- Na tela do pedido de acesso a prontuário fora do plantão, o médico pode abrir
-- na hora, sem esperar o gestor:
--   • justificativa obrigatória, com pelo menos 20 letras;
--   • só leitura, por 2 horas (a mesma leitura do pedido aprovado: todas as
--     leituras que olham acesso_encerrado_vigente são de SELECT);
--   • fica na auditoria (log_auditoria, ação abrir_acesso_urgencia) e cada
--     leitura do prontuário segue em log_acesso_prontuario, como hoje;
--   • o gestor da unidade recebe aviso no sino.
-- Mesma estrutura do pedido que já existe: a linha vai para
-- public.pedidos_acesso_prontuario com status 'urgencia' (sem decisão do
-- gestor, decidido_por nulo, valido_ate = agora + 2 h). Por isso as duas
-- CHECK de status são trocadas por versões que aceitam 'urgencia' (só
-- alargam; nenhuma linha existente muda). Médico = papel plantonista ou
-- telemedicina na unidade do paciente (tenho_papel: vale para conta com
-- vários papéis), e a urgência só vale enquanto ele mantém esse papel.
--
-- Funções:
--   • public.abrir_acesso_urgencia(p_paciente, p_justificativa) — nova;
--   • private.acesso_encerrado_vigente — reescrita: soma a urgência vigente;
--   • public.meus_pedidos_acesso — reescrita: 'vigente' também na urgência.
--
-- ROLLBACK: docs/banco/ROLLBACK-20270421000070-079.sql (corpo anterior das
--   duas funções, DROP da função nova e as CHECK antigas; as linhas de
--   urgência já gravadas passam a 'cancelado' antes de voltar a CHECK).
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. status 'urgencia' no pedido ─────────────────────────────────────────
ALTER TABLE public.pedidos_acesso_prontuario DROP CONSTRAINT IF EXISTS pedidos_acesso_prontuario_status_check;
ALTER TABLE public.pedidos_acesso_prontuario ADD CONSTRAINT pedidos_acesso_prontuario_status_check
  CHECK (status = ANY (ARRAY['pendente', 'aprovado', 'recusado', 'cancelado', 'urgencia'])) NOT VALID;
ALTER TABLE public.pedidos_acesso_prontuario VALIDATE CONSTRAINT pedidos_acesso_prontuario_status_check;

ALTER TABLE public.pedidos_acesso_prontuario DROP CONSTRAINT IF EXISTS pedido_decisao_coerente;
ALTER TABLE public.pedidos_acesso_prontuario ADD CONSTRAINT pedido_decisao_coerente CHECK (
     (status = 'pendente' AND decidido_por IS NULL AND valido_ate IS NULL)
  OR (status = 'aprovado' AND decidido_por IS NOT NULL AND valido_ate IS NOT NULL)
  OR (status = 'recusado' AND decidido_por IS NOT NULL AND length(btrim(coalesce(motivo_decisao, ''))) >= 5)
  OR (status = 'cancelado')
  -- quebra de vidro: sem decisão do gestor, com prazo e justificativa
  OR (status = 'urgencia' AND decidido_por IS NULL AND valido_ate IS NOT NULL AND length(btrim(motivo)) >= 20)
) NOT VALID;
ALTER TABLE public.pedidos_acesso_prontuario VALIDATE CONSTRAINT pedido_decisao_coerente;

-- ── 2. a urgência vigente abre a leitura ───────────────────────────────────
CREATE OR REPLACE FUNCTION private.acesso_encerrado_vigente(p_paciente uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pedidos_acesso_prontuario pd
    WHERE pd.paciente_id IN (SELECT private.familia_paciente(p_paciente))
      AND pd.solicitante_id = private.meu_perfil_id()
      AND pd.status = 'aprovado'
      AND pd.valido_ate > now()
      -- o vínculo precisa continuar ativo na unidade, num papel que pede
      AND private.papel_pode_pedir_acesso(private.papel_na_unidade(pd.unidade_id))
  ) OR EXISTS (
    -- ajustes da revisão, item 6: acesso de urgência (quebra de vidro), 2 h,
    -- enquanto o médico mantém o papel com que abriu
    SELECT 1 FROM public.pedidos_acesso_prontuario pd
    WHERE pd.paciente_id IN (SELECT private.familia_paciente(p_paciente))
      AND pd.solicitante_id = private.meu_perfil_id()
      AND pd.status = 'urgencia'
      AND pd.valido_ate > now()
      AND private.tenho_papel(pd.unidade_id, pd.papel)
  ) OR EXISTS (
    -- Fase 1, tarefa 8: detalhe aberto com motivo por quem cuida do paciente
    SELECT 1 FROM private.acessos_historico ah
    WHERE ah.paciente_id IN (SELECT private.familia_paciente(p_paciente))
      AND ah.perfil_id = private.meu_perfil_id()
      AND ah.valido_ate > now()
      AND private.papel_na_unidade(ah.unidade_id) <> ''
  );
$$;
REVOKE ALL ON FUNCTION private.acesso_encerrado_vigente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.acesso_encerrado_vigente(uuid) TO authenticated;

-- ── 3. meus pedidos: a urgência também fica "vigente" ──────────────────────
CREATE OR REPLACE FUNCTION public.meus_pedidos_acesso(p_unidade uuid)
RETURNS TABLE(id uuid, paciente_id uuid, paciente_nome text, motivo text, status text, criado_em timestamp with time zone,
              decidido_em timestamp with time zone, motivo_decisao text, valido_ate timestamp with time zone, vigente boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pd.id, pd.paciente_id, pa.nome, pd.motivo, pd.status, pd.criado_em, pd.decidido_em, pd.motivo_decisao,
         pd.valido_ate, (pd.status IN ('aprovado', 'urgencia') AND pd.valido_ate > now())
  FROM public.pedidos_acesso_prontuario pd
  JOIN public.pacientes pa ON pa.id = pd.paciente_id
  WHERE pd.solicitante_id = private.meu_perfil_id()
    AND pd.unidade_id = p_unidade
    AND pd.criado_em > now() - interval '30 days'
  ORDER BY pd.criado_em DESC;
$$;

-- ── 4. abrir o acesso de urgência ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.abrir_acesso_urgencia(p_paciente uuid, p_justificativa text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil  uuid := private.meu_perfil_id();
  v_just    text := btrim(coalesce(p_justificativa, ''));
  v_unidade uuid;
  v_papel   text;
  v_id      uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  SELECT pa.unidade_id INTO v_unidade FROM public.pacientes pa WHERE pa.id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  v_papel := CASE WHEN private.tenho_papel(v_unidade, 'plantonista') THEN 'plantonista'
                  WHEN private.tenho_papel(v_unidade, 'telemedicina') THEN 'telemedicina' END;
  IF v_papel IS NULL THEN
    RAISE EXCEPTION 'Acesso negado: o acesso de urgência ao prontuário é do médico da unidade.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(regexp_replace(v_just, '[^[:alpha:]]', '', 'g')) < 20 THEN
    RAISE EXCEPTION 'Escreva a justificativa da urgência (pelo menos 20 letras).';
  END IF;
  IF private.pode_atuar_no_paciente(p_paciente) THEN
    RAISE EXCEPTION 'Você já tem acesso a este paciente pela escala.';
  END IF;
  IF private.acesso_encerrado_vigente(p_paciente) THEN
    RAISE EXCEPTION 'Você já tem acesso vigente a este paciente.';
  END IF;

  INSERT INTO public.pedidos_acesso_prontuario (organizacao_id, unidade_id, paciente_id, solicitante_id, papel, motivo, status, valido_ate)
  VALUES ((SELECT u.organizacao_id FROM public.unidades u WHERE u.id = v_unidade), v_unidade, p_paciente, v_perfil, v_papel,
          v_just, 'urgencia', now() + interval '2 hours')
  RETURNING id INTO v_id;

  PERFORM private.registrar_auditoria('abrir_acesso_urgencia', 'pedidos_acesso_prontuario', v_id, v_unidade,
    jsonb_build_object('papel', v_papel, 'status', 'urgencia'));
  -- aviso ao gestor, sem o nome do paciente (o sino pode ir ao celular)
  PERFORM private.avisar_gestores(v_unidade, NULL, 'acesso_urgencia_' || v_id,
    coalesce((SELECT pf.nome_completo FROM public.perfis pf WHERE pf.id = v_perfil), 'Um médico')
    || ' abriu em urgência o prontuário de um paciente fora do plantão (só leitura, por 2 horas). '
    || 'A justificativa está na Auditoria, em pedidos de acesso.');
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.abrir_acesso_urgencia(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.abrir_acesso_urgencia(uuid, text) TO authenticated;
