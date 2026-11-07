-- ════════════════════════════════════════════════════════════════════════════
-- Prontuário encerrado não abre mais "pela escala" (achado D P1-1 do teste de
-- rede, cenário D10; decisão do RT em 07/11/2026: A em P1 a P4,
-- docs/teste-rede/PRIVACIDADE-ENCERRADO-DIAGNOSTICO.md).
--
-- private.paciente_em_cuidado_no_plantao aceitava o setor gravado no cadastro
-- (pacientes.setor_id). A alta da porta, a evasão, a alta a pedido, o óbito na
-- porta e a consulta da UBS encerrada não limpam esse campo, então quem estava
-- escalado no último setor "cuidava" do paciente para sempre, em qualquer
-- papel, e a janela de 24 h e o pedido de acesso ao gestor ficavam sem efeito.
--
-- Agora "em cuidado no plantão" é o atendimento ABERTO (episodios.encerrado_em
-- IS NULL) ou a internação aberta num setor da minha escala. Quem tem
-- atendimento aberto não muda (na homologação, todo atendimento aberto está no
-- mesmo setor do cadastro). A leitura nas 24 h depois do encerramento continua
-- em private.paciente_no_meu_plantao, sem mudança. Depois disso, só o gestor e
-- o pedido de acesso. Pré-natal, hiperdia e puericultura têm regra própria.
--
-- Só expande (CREATE OR REPLACE da mesma assinatura). Reaplicável.
-- Teste: supabase/tests/fix_privacidade_encerrado.sql.
--
-- ROLLBACK (a definição anterior, de 20261119000001_desfecho_encerra_cuidado):
--   CREATE OR REPLACE FUNCTION private.paciente_em_cuidado_no_plantao(p_paciente uuid)
--   RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
--     SELECT EXISTS (SELECT 1 FROM public.pacientes pa WHERE pa.id = p_paciente
--                       AND pa.setor_id IN (SELECT private.setores_na_escala_agora()))
--         OR EXISTS (SELECT 1 FROM public.internacoes i WHERE i.paciente_id = p_paciente
--                       AND i.data_alta IS NULL AND i.setor_atual_id IN (SELECT private.setores_na_escala_agora()));
--   $$;
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.paciente_em_cuidado_no_plantao(p_paciente uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.episodios e
    WHERE e.paciente_id = p_paciente
      AND e.encerrado_em IS NULL
      AND e.setor_id IN (SELECT private.setores_na_escala_agora())
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
