-- Rollback da migration 20270421000040_regulacao_conversa_nir.sql
-- (regulação dentro do paciente, conversa com a central, NIR e cobrança).
--
-- Ordem: devolve as duas funções que a migration trocou (aviso da regulação e
-- cobrança do NIR) ao corpo anterior, tira as RPCs novas e, por último, as
-- tabelas novas. Antes de apagar as tabelas, guarde as mensagens se houver
-- alguma em uso (são registro clínico do pedido):
--   COPY (SELECT * FROM public.regulacao_mensagens) TO STDOUT WITH CSV HEADER;
-- Testado na homologação em transação desfeita (BEGIN … ROLLBACK).

BEGIN;

-- ── aviso da regulação: só solicitante e médico assistente (20261110000001) ─
CREATE OR REPLACE FUNCTION private.regulacao_avisar(s public.regulacao_solicitacoes, p_tipo text, p_mensagem text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT DISTINCT q, s.unidade_origem_id, current_date, p_tipo || '_' || s.numero, p_mensagem
    FROM unnest(ARRAY[s.solicitante_id, s.medico_assistente_id]) q
   WHERE q IS NOT NULL
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE
    SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now()
$$;
REVOKE ALL ON FUNCTION private.regulacao_avisar(public.regulacao_solicitacoes, text, text) FROM PUBLIC, anon, authenticated;

-- ── cobrança do NIR: só o responsável (20261117000002) ─────────────────────
CREATE OR REPLACE FUNCTION public.nir_cobrar(p_unidade uuid, p_tipo text, p_ref uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE it record; v_tipo_aviso text; v_n integer;
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM private.nir_exigir(p_unidade);
  SELECT * INTO it FROM private.nir_itens(p_unidade) x WHERE x.tipo = p_tipo AND x.ref_id = p_ref LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Esta pendência não está mais em aberto.'; END IF;
  IF cardinality(it.responsaveis) = 0 THEN RAISE EXCEPTION 'Não há responsável para cobrar nesta pendência.'; END IF;
  v_tipo_aviso := CASE it.grupo
    WHEN 'regulacao' THEN 'reg_cobranca_' || (SELECT numero FROM public.regulacao_solicitacoes WHERE id = p_ref)
    WHEN 'aih' THEN 'nir_aih_' || left(p_ref::text, 8)
    ELSE 'nir_apac_' || left(p_ref::text, 8) END;
  INSERT INTO public.notificacoes_plantonista (perfil_id, unidade_id, data, tipo, mensagem)
  SELECT DISTINCT q, p_unidade, current_date, v_tipo_aviso,
         'NIR: ' || it.titulo || coalesce(' — ' || (SELECT coalesce(pa.nome_social, pa.nome) FROM public.pacientes pa WHERE pa.id = it.paciente_id), '')
         || '. Parado desde ' || to_char(it.desde AT TIME ZONE 'America/Sao_Paulo', 'DD/MM HH24:MI') || '.'
    FROM unnest(it.responsaveis) q
  ON CONFLICT (perfil_id, unidade_id, data, tipo) DO UPDATE SET mensagem = excluded.mensagem, lida_em = NULL, created_at = now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  INSERT INTO public.nir_cobrancas (unidade_id, tipo, ref_id, destinatarios, por)
  VALUES (p_unidade, p_tipo, p_ref, it.responsaveis, private.meu_perfil_id());
  PERFORM private.registrar_auditoria('nir_cobranca', 'nir_cobrancas', p_ref, p_unidade, jsonb_build_object('tipo', p_tipo, 'quantidade', v_n));
  RETURN v_n;
END $$;
REVOKE ALL ON FUNCTION public.nir_cobrar(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nir_cobrar(uuid, text, uuid) TO authenticated;

-- ── RPCs e apoio novos ──────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.regulacao_do_paciente(uuid, uuid);
DROP FUNCTION IF EXISTS public.regulacao_pacientes(uuid);
DROP FUNCTION IF EXISTS private.regulacao_exigir_unidade(uuid);
DROP FUNCTION IF EXISTS public.regulacao_conversa_enviar(uuid, text, text);
DROP FUNCTION IF EXISTS public.regulacao_conversa(uuid);
DROP FUNCTION IF EXISTS private.regulacao_avisar_pessoas(uuid[], uuid, text, text);
DROP FUNCTION IF EXISTS private.regulacao_resumo(public.regulacao_solicitacoes);
DROP FUNCTION IF EXISTS private.regulacao_conversa_estado(public.regulacao_solicitacoes);
DROP FUNCTION IF EXISTS private.regulacao_meu_lado(public.regulacao_solicitacoes);
DROP FUNCTION IF EXISTS private.regulacao_em_aberto(text);
DROP FUNCTION IF EXISTS private.escalados_no_dia(uuid, text[]);

-- ── tabelas novas (as políticas caem junto) ─────────────────────────────────
DROP TABLE IF EXISTS public.regulacao_conversa_leitura;
DROP TABLE IF EXISTS public.regulacao_mensagens;
DROP FUNCTION IF EXISTS private.regulacao_pode_ver_id(uuid);

COMMIT;
