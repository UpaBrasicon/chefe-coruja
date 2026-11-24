-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK das migrations 20270421000070 a 20270421000079 (ajustes da revisão
-- do RT, 24/11/2026). Rodar na ordem inversa (do item mais alto ao 070), numa
-- transação, primeiro na homologação.
--
-- As funções trocadas por texto voltam pela troca inversa (o mesmo
-- trocar_uma_vez das migrations), o que devolve o corpo anterior exato. As
-- funções reescritas inteiras voltam com o corpo anterior completo, copiado do
-- banco da homologação em 24/11/2026 (igual ao do master).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.trocar_uma_vez(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text; v_antigo text := replace(p_antigo, E'\r', ''); v_novo text := replace(p_novo, E'\r', '');
BEGIN
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(v_novo IN def) > 0 THEN RETURN; END IF;
  IF position(v_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, v_antigo; END IF;
  EXECUTE replace(def, v_antigo, v_novo);
END $$;

-- 076 a 079: não usadas.

-- ── 075: acesso de urgência ao prontuário ───────────────────────────────────
DROP FUNCTION IF EXISTS public.abrir_acesso_urgencia(uuid, text);

-- corpo anterior (20270105000001)
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

-- corpo anterior (20261001000001)
CREATE OR REPLACE FUNCTION public.meus_pedidos_acesso(p_unidade uuid)
RETURNS TABLE(id uuid, paciente_id uuid, paciente_nome text, motivo text, status text, criado_em timestamp with time zone,
              decidido_em timestamp with time zone, motivo_decisao text, valido_ate timestamp with time zone, vigente boolean)
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

-- as urgências já gravadas viram 'cancelado' (fica o registro; o DELETE é
-- barrado pela guarda), com linha na auditoria; depois voltam as CHECK antigas
DO $$
DECLARE r public.pedidos_acesso_prontuario;
BEGIN
  FOR r IN
    UPDATE public.pedidos_acesso_prontuario SET status = 'cancelado' WHERE status = 'urgencia' RETURNING *
  LOOP
    PERFORM private.registrar_auditoria('cancelar_pedido_acesso', 'pedidos_acesso_prontuario', r.id, r.unidade_id,
      jsonb_build_object('status', 'cancelado', 'papel', r.papel));
  END LOOP;
END $$;
ALTER TABLE public.pedidos_acesso_prontuario DROP CONSTRAINT IF EXISTS pedido_decisao_coerente;
ALTER TABLE public.pedidos_acesso_prontuario ADD CONSTRAINT pedido_decisao_coerente CHECK (
     (status = 'pendente' AND decidido_por IS NULL AND valido_ate IS NULL)
  OR (status = 'aprovado' AND decidido_por IS NOT NULL AND valido_ate IS NOT NULL)
  OR (status = 'recusado' AND decidido_por IS NOT NULL AND length(btrim(coalesce(motivo_decisao, ''))) >= 5)
  OR (status = 'cancelado'));
ALTER TABLE public.pedidos_acesso_prontuario DROP CONSTRAINT IF EXISTS pedidos_acesso_prontuario_status_check;
ALTER TABLE public.pedidos_acesso_prontuario ADD CONSTRAINT pedidos_acesso_prontuario_status_check
  CHECK (status = ANY (ARRAY['pendente', 'aprovado', 'recusado', 'cancelado']));

-- ── 074: tabela e funções novas, sem corpo anterior (o teto definido se perde)
DROP FUNCTION IF EXISTS public.definir_ia_teto_mensal(numeric);
DROP FUNCTION IF EXISTS public.ia_teto_mensal();
DROP TABLE IF EXISTS private.ia_teto_mensal;

-- ── 073: materiais voltam a ser do faturamento e do gestor ──────────────────
SELECT pg_temp.trocar_uma_vez('public.material_salvar(uuid, uuid, text, text, text, boolean)'::regprocedure,
  $new$  IF NOT private.pode_cadastrar_material(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: o cadastro de materiais é da farmácia e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';$new$,
  $old$  IF NOT private.pode_ver_contas(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: os materiais são do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';$old$);
SELECT pg_temp.trocar_uma_vez('public.materiais_da_unidade(uuid)'::regprocedure,
  $new$  IF NOT (private.pode_ver_contas(p_unidade) OR private.pode_cadastrar_material(p_unidade)) THEN
    RAISE EXCEPTION 'Acesso negado: os materiais são da farmácia, do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';$new$,
  $old$  IF NOT private.pode_ver_contas(p_unidade) THEN
    RAISE EXCEPTION 'Acesso negado: os materiais são do faturamento e do gestor da unidade.' USING ERRCODE = 'insufficient_privilege';$old$);
DROP FUNCTION IF EXISTS private.pode_cadastrar_material(uuid);

-- ── 072: função nova, sem corpo anterior ─────────────────────────────────────
DROP FUNCTION IF EXISTS public.contingencia_atendimentos(uuid);

-- ── 071: regulacao_mapa_vagas volta a recusar o médico e o NIR ──────────────
SELECT pg_temp.trocar_uma_vez('public.regulacao_mapa_vagas(uuid)'::regprocedure,
  $new$    'agora', now(),
    'so_consulta', v_consulta);$new$,
  $old$    'agora', now());$old$);
SELECT pg_temp.trocar_uma_vez('public.regulacao_mapa_vagas(uuid)'::regprocedure,
  $new$          OR (p_unidade = v_central AND private.tenho_papel(p_unidade, 'regulador'))) THEN
    -- médico e NIR da unidade: só consulta, sem dado de paciente (RT, 24/11/2026)
    IF private.tenho_papel(p_unidade, 'plantonista') IS TRUE OR private.tenho_papel(p_unidade, 'nir') IS TRUE THEN
      v_consulta := true;
    ELSE
      RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;$new$,
  $old$          OR (p_unidade = v_central AND private.tenho_papel(p_unidade, 'regulador'))) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;$old$);
SELECT pg_temp.trocar_uma_vez('public.regulacao_mapa_vagas(uuid)'::regprocedure,
  -- com o BEGIN junto: a linha antiga é começo da nova
  $new$DECLARE v_org uuid; v_central uuid; v_rede boolean := false; v_consulta boolean := false;
BEGIN$new$,
  $old$DECLARE v_org uuid; v_central uuid; v_rede boolean := false;
BEGIN$old$);

-- ── 070: painel_observacao volta a decidir o gestor por papel_na_unidade ─────
SELECT pg_temp.trocar_uma_vez('public.painel_observacao(uuid)'::regprocedure,
  $new$  -- conta com vários papéis (admin e gestor, por exemplo): vale o papel gestor (RT, 24/11/2026)
  v_gestor boolean := coalesce(private.eh_super_admin(), false) OR private.tenho_papel(p_unidade, 'gestor') IS TRUE;$new$,
  $old$  v_gestor boolean := private.papel_na_unidade(p_unidade) = 'gestor';$old$);

COMMIT;
