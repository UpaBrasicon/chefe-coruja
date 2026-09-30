-- ════════════════════════════════════════════════════════════════════════════
-- Porte do frontend, onda 6 — folha 08: "Atendimentos notificáveis".
--
-- Relatório da UNIDADE (não de um paciente), por isso fora de folha_relatorio
-- (20261005000001). Lê a mesma lista da tela de notificação compulsória
-- (notificacao_compulsoria_periodo, que confere quem pode ver: equipe de
-- plantão da unidade e gestão) e devolve os dados no formato que
-- src/lib/folhas.ts › relNotificaveis lê, com o cabeçalho da unidade.
--
-- A folha traz nomes de pacientes: a impressão fica registrada no prontuário
-- de CADA paciente listado (log_acesso_prontuario, tipo 'impressao'), todas com
-- o mesmo protocolo IMP-…, que sai no rodapé.
--
-- SECURITY DEFINER com search_path vazio; segundo fator; REVOKE de PUBLIC e
-- anon. Reaplicável.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.folha_notificaveis(
  p_unidade uuid, p_de date DEFAULT NULL, p_ate date DEFAULT NULL, p_cids text[] DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  u public.unidades;
  v_linhas jsonb;
  v_ids uuid[];
  v_lote uuid := gen_random_uuid();
  v_protocolo text := 'IMP-' || upper(left(replace(gen_random_uuid()::text, '-', ''), 10));
  v_em timestamptz := now();
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  SELECT * INTO u FROM public.unidades WHERE id = p_unidade;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unidade não encontrada.'; END IF;

  -- a mesma lista da tela (a RPC confere o acesso e o período)
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'data', (n.atendimento_em AT TIME ZONE 'America/Sao_Paulo')::date,
           'paciente', n.paciente_nome, 'local', n.local, 'cid', n.cid, 'cid_nome', n.cid_descricao,
           -- os rótulos da tela (src/pages/notificacao/dados.ts › ROTULO_SITUACAO)
           'status', CASE n.situacao
             WHEN 'notificado' THEN 'Notificado' || coalesce(' · SINAN ' || nullif(btrim(n.numero_sinan), ''), '')
             WHEN 'descartado' THEN 'Descartado'
             WHEN 'reaberto' THEN 'Reaberto'
             WHEN 'a_registrar' THEN 'A registrar'
             ELSE 'Sugerido pelo CID' END
             || CASE WHEN n.imediata AND n.situacao NOT IN ('notificado', 'descartado') THEN ' · imediata' ELSE '' END)
           ORDER BY n.atendimento_em), '[]'::jsonb),
         array_agg(DISTINCT n.paciente_id) FILTER (WHERE n.paciente_id IS NOT NULL)
    INTO v_linhas, v_ids
    FROM public.notificacao_compulsoria_periodo(p_unidade, p_de, p_ate, p_cids) n;

  INSERT INTO public.log_acesso_prontuario
    (organizacao_id, unidade_id, paciente_id, acessado_por, papel, tipo_acesso, documento_tipo, ip, user_agent, created_at)
  SELECT u.organizacao_id, p_unidade, x, v_perfil, nullif(private.papel_na_unidade(p_unidade), ''), 'impressao',
         'Atendimentos notificáveis ' || v_protocolo, private.requisicao_ip(), private.requisicao_navegador(), v_em
    FROM unnest(coalesce(v_ids, '{}'::uuid[])) x;

  RETURN jsonb_build_object(
    'tipo', 'notificaveis',
    'dados', jsonb_build_object(
      'filtro', jsonb_strip_nulls(jsonb_build_object('de', p_de, 'ate', coalesce(p_ate, private.data_atual()), 'cids', to_jsonb(p_cids))),
      'linhas', v_linhas),
    'cabecalho', jsonb_build_object(
      'unidade', jsonb_strip_nulls(jsonb_build_object('nome', u.nome, 'cnes', u.cnes, 'municipio', u.municipio, 'uf', u.uf))),
    'autor', (SELECT nome_completo FROM public.perfis WHERE id = v_perfil),
    'autor_registro', private.folha_registro(v_perfil),
    'protocolo', v_protocolo,
    'impresso_em', v_em);
END $$;

REVOKE ALL ON FUNCTION public.folha_notificaveis(uuid, date, date, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.folha_notificaveis(uuid, date, date, text[]) TO authenticated;
