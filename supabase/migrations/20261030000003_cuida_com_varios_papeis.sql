-- Fase 1, tarefa 8 — correção do teste do RT (08/10/2026): quem tem mais de um
-- papel na unidade (ex.: médico que também é gestor) não aparecia como "quem
-- cuida", porque papel_na_unidade devolve só o papel de maior hierarquia
-- (gestor antes de plantonista) — o botão "Ver detalhe (com motivo)" sumia.
-- Agora basta ter o vínculo ATIVO de plantonista na unidade.
-- Só troca o corpo da função (mesma assinatura).
--
-- ROLLBACK: reaplicar private.cuida_do_paciente_agora de 20261030000002.
CREATE OR REPLACE FUNCTION private.cuida_do_paciente_agora(p_paciente uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pacientes pa
     WHERE pa.id = p_paciente
       AND EXISTS (SELECT 1 FROM public.vinculos v
                    WHERE v.perfil_id = private.meu_perfil_id() AND v.unidade_id = pa.unidade_id
                      AND v.ativo AND v.papel = 'plantonista')
       AND private.paciente_no_meu_plantao(pa.id))
  OR coalesce(private.teleinterconsulta_vigente(p_paciente), false);
$$;
