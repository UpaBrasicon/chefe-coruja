-- ════════════════════════════════════════════════════════════════════════════
-- Ajuste da 20270306000001_encerrado_sem_escala (achado D P1-1; CI do #484).
--
-- A 20270306000001 trocou o setor do cadastro pelo atendimento aberto. Só que,
-- quando a porta vira observação ou internação, o atendimento da porta continua
-- aberto no setor da porta. Assim a equipe do PS (até a recepção) passou a
-- "cuidar" do paciente que já estava na observação ou na internação, o que o
-- setor do cadastro impedia (ele mudava para o setor da internação). Visto no
-- teste porte_evolucao: "recepção de outro setor não lê o histórico".
--
-- Agora vale onde o paciente ESTÁ, como o setor do cadastro queria dizer:
--   • internação aberta → o setor atual da internação;
--   • sem internação aberta → o setor do atendimento aberto.
-- O encerrado continua fora (nada aberto = nada pela escala).
--
-- Só expande (CREATE OR REPLACE da mesma assinatura, mesmas permissões).
-- Teste: supabase/tests/fix_privacidade_encerrado.sql (seção 4).
--
-- ROLLBACK: a definição da 20270306000001 (atendimento aberto sem a condição
-- da internação), ou a de 20261119000001 para voltar ao setor do cadastro.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.paciente_em_cuidado_no_plantao(p_paciente uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.internacoes i
    WHERE i.paciente_id = p_paciente
      AND i.data_alta IS NULL
      AND i.setor_atual_id IN (SELECT private.setores_na_escala_agora())
  ) OR (
    NOT EXISTS (SELECT 1 FROM public.internacoes i WHERE i.paciente_id = p_paciente AND i.data_alta IS NULL)
    AND EXISTS (
      SELECT 1 FROM public.episodios e
      WHERE e.paciente_id = p_paciente
        AND e.encerrado_em IS NULL
        AND e.setor_id IN (SELECT private.setores_na_escala_agora()))
  );
$$;
-- mesmas permissões de antes (as políticas de RLS a chamam como authenticated)
REVOKE ALL ON FUNCTION private.paciente_em_cuidado_no_plantao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.paciente_em_cuidado_no_plantao(uuid) TO authenticated;
