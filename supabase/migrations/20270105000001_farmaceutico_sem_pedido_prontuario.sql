-- Telas do farmacêutico, ponto 6 (pedido do RT em 27/10/2026, aprovado no mesmo
-- dia; docs/farmacia/REVISAO-FARMACEUTICO-2026-10.md): o farmacêutico não pede
-- acesso ao prontuário. O que ele precisa do paciente chega pela validação e
-- pela dispensação, por funções que não passam pelo pedido.
--
-- Como fica:
--   1. papel_pode_pedir_acesso sem 'farmaceutico': buscar_paciente_para_pedido
--      e pedir_acesso_prontuario passam a recusar o farmacêutico (as duas leem
--      esta função; nenhuma muda de corpo).
--   2. acesso_encerrado_vigente: o pedido aprovado só abre leitura enquanto o
--      papel atual na unidade ainda pode pedir. Um pedido aprovado do
--      farmacêutico, de antes desta migration, deixa de abrir leitura. Para os
--      papéis que pedem, nada muda: '' (sem vínculo) já não podia pedir.
--   3. Pedidos pendentes do farmacêutico são cancelados, com linha na
--      auditoria (ator nulo: foi a migration).
-- Quem tem também papel acima na unidade (por exemplo plantonista) segue pelo
-- papel_na_unidade, como hoje.
--
-- ROLLBACK: reaplicar private.papel_pode_pedir_acesso de 20261001000001 (com
--   'farmaceutico') e private.acesso_encerrado_vigente de 20261030000004. Os
--   pedidos cancelados ficam cancelados (é registro; o farmacêutico pede de
--   novo, se o RT voltar atrás).

CREATE OR REPLACE FUNCTION private.papel_pode_pedir_acesso(p_papel text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_papel IN ('plantonista', 'telemedicina', 'enfermeiro', 'tecnico_enfermagem');
$$;

-- acesso por pedido aprovado ou por motivo vale para a família inteira
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

-- pendentes do farmacêutico: cancelados, com auditoria
DO $$
DECLARE r public.pedidos_acesso_prontuario;
BEGIN
  FOR r IN
    UPDATE public.pedidos_acesso_prontuario SET status = 'cancelado'
     WHERE status = 'pendente' AND papel = 'farmaceutico'
    RETURNING *
  LOOP
    PERFORM private.registrar_auditoria('cancelar_pedido_acesso', 'pedidos_acesso_prontuario', r.id, r.unidade_id,
      jsonb_build_object('status', 'cancelado', 'papel', r.papel));
  END LOOP;
END $$;
