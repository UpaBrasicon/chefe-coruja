-- ════════════════════════════════════════════════════════════════════════════
-- Fase 1 — a escala POR SETOR é a única porta do dado clínico (ADR 0003).
--
-- Duas brechas fechadas:
--
-- 1. "Acesso pago fora da escala" (acessos_plantonista) dava leitura e escrita
--    na unidade inteira sem escala. Decisão do produto em 26/09: desligado por
--    ora. A tabela fica; tem_acesso_atendimento() passa a devolver sempre
--    false, o que desliga o atalho em todas as policies e RPCs de uma vez.
--    Quando o acesso pago virar produto, volta com regra própria.
--
-- 2. Paciente, observação, prescrição e documento conferiam só "está na escala
--    em ALGUM setor da unidade". Agora conferem o setor do paciente (ou da
--    internação) contra os setores do plantão em curso.
--
-- Gestor e super admin seguem como antes.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. acesso pago desligado ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.tem_acesso_atendimento(unidade uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  -- Desligado em 26/09/2026: a escala por setor é a única porta.
  SELECT false;
$$;

-- ── 2. setor do paciente ────────────────────────────────────────────────────
-- Verdadeiro se o paciente está (ou está internado) num setor do plantão em
-- curso de quem pergunta. Sem gestor/admin: isso fica em cada regra.
CREATE OR REPLACE FUNCTION private.paciente_no_meu_plantao(p_paciente uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pacientes pa
    WHERE pa.id = p_paciente
      AND pa.setor_id IN (SELECT private.setores_na_escala_agora())
  ) OR EXISTS (
    SELECT 1 FROM public.internacoes i
    WHERE i.paciente_id = p_paciente
      AND i.setor_atual_id IN (SELECT private.setores_na_escala_agora())
  );
$$;
REVOKE ALL ON FUNCTION private.paciente_no_meu_plantao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.paciente_no_meu_plantao(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION private.pode_atuar_no_paciente(p_paciente uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pacientes pa
    WHERE pa.id = p_paciente
      AND (   private.eh_super_admin()
           OR private.papel_na_unidade(pa.unidade_id) = 'gestor'
           OR private.paciente_no_meu_plantao(pa.id))
  );
$$;

-- Documento: sem o atalho "plantonista na unidade". Com internação, vale o
-- setor da internação; sem ela, salvar_documento confere o paciente.
CREATE OR REPLACE FUNCTION private.pode_escrever_documento(p_unidade uuid, p_internacao uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF private.eh_super_admin() THEN RETURN true; END IF;
  IF private.papel_na_unidade(p_unidade) = 'gestor' THEN RETURN true; END IF;
  IF p_internacao IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.internacoes i
    WHERE i.id = p_internacao
      AND i.setor_atual_id IN (SELECT private.setores_na_escala_agora())
  ) THEN RETURN true; END IF;
  RETURN false;
END $$;

-- ── 3. policies ─────────────────────────────────────────────────────────────
-- pacientes: cadastrar exige escolher um setor do próprio plantão.
DROP POLICY IF EXISTS pacientes_insert ON public.pacientes;
CREATE POLICY pacientes_insert ON public.pacientes FOR INSERT TO authenticated
WITH CHECK (
  private.eh_super_admin()
  OR private.papel_na_unidade(unidade_id) = 'gestor'
  OR (private.papel_na_unidade(unidade_id) = 'plantonista'
      AND setor_id IN (SELECT private.setores_na_escala_agora()))
);

-- observacao: o paciente tem de estar no setor do plantão.
DROP POLICY IF EXISTS observacao_insert ON public.observacao;
CREATE POLICY observacao_insert ON public.observacao FOR INSERT TO authenticated
WITH CHECK (
  private.eh_super_admin()
  OR private.papel_na_unidade(unidade_id) = 'gestor'
  OR (private.papel_na_unidade(unidade_id) = 'plantonista'
      AND private.paciente_no_meu_plantao(paciente_id))
);

DROP POLICY IF EXISTS observacao_select ON public.observacao;
CREATE POLICY observacao_select ON public.observacao FOR SELECT TO authenticated
USING (
  private.eh_super_admin()
  OR private.papel_na_unidade(unidade_id) = 'gestor'
  OR private.paciente_no_meu_plantao(paciente_id)
);

-- prescricoes: a do próprio médico, e só de paciente do setor do plantão.
DO $$
DECLARE
  cmd text;
  regra text := $r$(
    private.eh_super_admin()
    OR private.papel_na_unidade(unidade_id) = 'gestor'
    OR (medico_id = private.meu_perfil_id()
        AND private.papel_na_unidade(unidade_id) = 'plantonista'
        AND private.paciente_no_meu_plantao(paciente_id))
  )$r$;
BEGIN
  FOREACH cmd IN ARRAY ARRAY['select', 'insert', 'update', 'delete'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS prescricoes_%s ON public.prescricoes', cmd);
    EXECUTE format(
      'CREATE POLICY prescricoes_%1$s ON public.prescricoes FOR %2$s TO authenticated %3$s',
      cmd, upper(cmd),
      CASE cmd
        WHEN 'insert' THEN 'WITH CHECK ' || regra
        WHEN 'update' THEN 'USING ' || regra || ' WITH CHECK ' || regra
        ELSE 'USING ' || regra
      END);
  END LOOP;
END $$;

-- ── 4. RPCs que conferiam só a unidade ──────────────────────────────────────
-- Mesmo método da 0010: lê a definição atual e troca o trecho exato; se o
-- trecho não estiver lá, falha em vez de seguir em silêncio.
DO $$
DECLARE
  def text;
  f regprocedure;
  velho text := E'    OR private.na_escala_agora(v_unidade)\n    OR private.tem_acesso_atendimento(v_unidade)\n';
  novo  text := E'    OR private.paciente_no_meu_plantao(p_paciente)  -- escala por setor (0011)\n';
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.registrar_prescricao_itens(uuid,text,jsonb)',
    'public.registrar_prescricao_observacao(uuid,text)'
  ]::regprocedure[] LOOP
    def := pg_get_functiondef(f);
    CONTINUE WHEN def LIKE '%paciente_no_meu_plantao%';
    IF position(velho IN def) = 0 THEN
      RAISE EXCEPTION 'escala por setor: trecho esperado não encontrado em %', f;
    END IF;
    EXECUTE replace(replace(def, velho, novo),
      'você não está em plantão nesta unidade.', 'paciente fora dos setores do seu plantão.');
  END LOOP;

  f := 'public.salvar_documento(uuid,uuid,text,text,uuid,text)'::regprocedure;
  def := pg_get_functiondef(f);
  IF def NOT LIKE '%pode_atuar_no_paciente(p_paciente)%' THEN
    IF position('(private.pode_escrever_documento(p_unidade, p_internacao)) IS NOT TRUE' IN def) = 0 THEN
      RAISE EXCEPTION 'escala por setor: checagem de salvar_documento não encontrada';
    END IF;
    EXECUTE replace(def,
      '(private.pode_escrever_documento(p_unidade, p_internacao)) IS NOT TRUE',
      '(private.pode_escrever_documento(p_unidade, p_internacao)
      OR (p_internacao IS NULL AND private.pode_atuar_no_paciente(p_paciente))) IS NOT TRUE');
  END IF;
END $$;
