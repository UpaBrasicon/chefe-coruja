-- ════════════════════════════════════════════════════════════════════════════
-- Ajuste da 20270306000001_encerrado_sem_escala (achado D P1-1; CI do #484).
--
-- A 20270306000001 trocou o setor do cadastro pelo atendimento aberto. Só que,
-- quando a porta vira observação ou internação, o atendimento da porta continua
-- aberto no setor da porta, e a equipe do PS (até a recepção) passou a "cuidar"
-- do paciente que já estava na observação ou na internação. O setor do cadastro
-- impedia isso, porque ele muda com o paciente (teste porte_evolucao: "recepção
-- de outro setor não lê o histórico"). E a regra B do RT (28/10/2026, ponto 9:
-- o médico de plantão no setor do CADASTRO evolui e lê a internação) depende do
-- setor do cadastro (teste evolucao_motivo).
--
-- Então volta a definição de antes (setor do cadastro OU internação aberta no
-- setor da escala), com UMA condição a mais: o setor do cadastro só vale
-- enquanto o paciente tem atendimento ou internação ABERTA. Encerrado, o
-- cadastro não dá mais nada pela escala: fica a leitura de 24 h
-- (paciente_no_meu_plantao), o gestor e o pedido de acesso.
--
-- Só expande (CREATE OR REPLACE da mesma assinatura, mesmas permissões).
-- Teste: supabase/tests/fix_privacidade_encerrado.sql.
--
-- ROLLBACK: a definição da 20270306000001 ou, para voltar ao comportamento de
-- antes do achado, a de 20261119000001_desfecho_encerra_cuidado.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.paciente_em_cuidado_no_plantao(p_paciente uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pacientes pa
    WHERE pa.id = p_paciente
      AND pa.setor_id IN (SELECT private.setores_na_escala_agora())
      AND (   EXISTS (SELECT 1 FROM public.episodios e WHERE e.paciente_id = pa.id AND e.encerrado_em IS NULL)
           OR EXISTS (SELECT 1 FROM public.internacoes i WHERE i.paciente_id = pa.id AND i.data_alta IS NULL))
  ) OR EXISTS (
    SELECT 1 FROM public.internacoes i
    WHERE i.paciente_id = p_paciente
      AND i.data_alta IS NULL
      AND i.setor_atual_id IN (SELECT private.setores_na_escala_agora())
  );
$$;
-- mesmas permissões de antes (as políticas de RLS a chamam como authenticated)
REVOKE ALL ON FUNCTION private.paciente_em_cuidado_no_plantao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.paciente_em_cuidado_no_plantao(uuid) TO authenticated;
