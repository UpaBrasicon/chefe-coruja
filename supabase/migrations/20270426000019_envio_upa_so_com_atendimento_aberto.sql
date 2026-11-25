-- ════════════════════════════════════════════════════════════════════════════
-- O envio à UPA é sempre depois de o médico abrir o atendimento (decisão do RT
-- em 25/11/2026, terceira rodada do item A-13 do teste de fluxo A: "sempre após
-- o médico abrir atendimento, só assim para encaminhar").
--
-- encaminhar_upa aceitava a ficha ainda na escuta (etapa "triagem") e, nesse
-- caso, encerrava a ficha da UBS. O app nunca teve tela para isso: o "Enviar à
-- UPA" só abre na aba Conduta, com o atendimento aberto. A função passa a
-- recusar o envio sem atendimento médico aberto, e a ficha da UBS encerra
-- sempre pela conduta (registrar_conduta_aps), que já pede o problema (lista,
-- CIAP-2 ou CID-10).
--
-- Com isso saem o encerramento pela escuta (20270216000001, 20270426000012) e
-- os parâmetros p_cid e p_ciap (20270426000017): a função volta à assinatura
-- (uuid, uuid, text). Ficam a recusa da central de regulação como destino
-- (20270426000002) e todo o resto.
--
-- Expand/contract: a função de cinco parâmetros sai e a de três volta na mesma
-- transação; a tela chama com três argumentos nos dois casos. Mesmos GRANTs.
-- Idempotente. As fichas já encerradas pelo envio da escuta não mudam.
--
-- Rollback: reaplicar 20270426000012 e 20270426000017 sobre a função abaixo
-- sem o bloco "só com o atendimento aberto" e com
--   IF e.etapa NOT IN ('triagem', 'atendimento') THEN ... 'A consulta já foi encerrada.'
-- ════════════════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.encaminhar_upa(uuid, uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.encaminhar_upa(p_episodio uuid, p_destino uuid, p_motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.episodios;
  u_origem public.unidades;
  u_destino public.unidades;
  p public.pacientes;
  x public.encaminhamentos_upa;
  v_eu uuid := private.meu_perfil_id();
  v_resumo jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  IF e.tipo_atendimento_aps IS NULL THEN RAISE EXCEPTION 'O envio à UPA é da consulta da UBS.'; END IF;
  IF e.etapa NOT IN ('triagem', 'atendimento') THEN RAISE EXCEPTION 'A consulta já foi encerrada.'; END IF;
  IF e.setor_id NOT IN (SELECT private.setores_na_escala_agora())
     OR private.tenho_papel(e.unidade_id, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: o envio à UPA é do médico de plantão no consultório.';
  END IF;
  -- só com o atendimento aberto (RT, 25/11/2026): da escuta não se envia
  IF e.etapa <> 'atendimento' OR e.atendimento_iniciado_em IS NULL THEN
    RAISE EXCEPTION 'O envio à UPA é feito depois de o médico abrir o atendimento: abra o atendimento do paciente e envie pela aba Conduta.';
  END IF;
  SELECT * INTO u_origem FROM public.unidades WHERE id = e.unidade_id;
  SELECT * INTO u_destino FROM public.unidades WHERE id = p_destino;
  IF NOT FOUND OR u_destino.id = u_origem.id OR u_destino.organizacao_id IS DISTINCT FROM u_origem.organizacao_id
     OR u_destino.tipo::text NOT IN ('upa', 'hospital') OR NOT coalesce(u_destino.ativo, true)
     OR EXISTS (SELECT 1 FROM public.centrais_regulacao c WHERE c.unidade_id = u_destino.id) THEN
    RAISE EXCEPTION 'Escolha uma UPA ou um hospital da rede.';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo do envio (mínimo de 10 letras).'; END IF;
  IF EXISTS (SELECT 1 FROM public.encaminhamentos_upa WHERE episodio_origem_id = e.id AND situacao = 'enviado') THEN
    RAISE EXCEPTION 'Já há um envio à UPA em andamento para esta consulta.';
  END IF;

  SELECT * INTO p FROM public.pacientes WHERE id = e.paciente_id;
  -- fotografia da consulta no envio: o que a UPA precisa para receber
  v_resumo := jsonb_build_object(
    'paciente', jsonb_build_object('nome', p.nome, 'nome_social', p.nome_social, 'data_nascimento', p.data_nascimento,
                                   'sexo', p.sexo, 'cns', p.cns, 'cpf', p.cpf, 'nome_mae', p.nome_mae),
    'queixa', e.queixa,
    'tipo_atendimento', e.tipo_atendimento_aps,
    'prioridades_legais', to_jsonb(e.prioridades_legais),
    'cor_escuta', e.cor_atual,
    'soap', (SELECT jsonb_build_object('subjetivo', r.subjetivo, 'objetivo', r.objetivo, 'avaliacao', r.avaliacao,
                                       'plano', r.plano, 'cid', r.cid, 'em', r.criado_em)
               FROM public.atendimento_registros r WHERE r.episodio_id = e.id ORDER BY r.criado_em DESC LIMIT 1),
    'sinais', (SELECT jsonb_object_agg(c.nome, o.valor_num)
                 FROM public.observacao o JOIN public.conceito c ON c.id = o.conceito_id
                WHERE o.episodio_id = e.id
                  AND o.aferido_em = (SELECT max(aferido_em) FROM public.observacao WHERE episodio_id = e.id)),
    'sinais_em', (SELECT max(aferido_em) FROM public.observacao WHERE episodio_id = e.id));

  INSERT INTO public.encaminhamentos_upa (organizacao_id, unidade_origem_id, episodio_origem_id, paciente_id, unidade_destino_id,
                                          motivo, resumo, enviado_por, prazo_em)
  VALUES (u_origem.organizacao_id, u_origem.id, e.id, e.paciente_id, u_destino.id, btrim(p_motivo), v_resumo, v_eu,
          now() + interval '12 hours')
  RETURNING * INTO x;

  -- a ficha da UBS segue aberta: o médico encerra pela conduta (registrar_conduta_aps)
  PERFORM private.encaminhamento_upa_avisar(x, true, 'ubs_upa',
    'Vindo da ' || u_origem.nome || ': ' || coalesce(nullif(btrim(p.nome_social), ''), p.nome) || ' — ' || btrim(p_motivo));
  PERFORM private.registrar_auditoria('encaminhamento_upa_enviado', 'encaminhamentos_upa', x.id, u_origem.id,
    jsonb_build_object('status', 'enviado', 'unidade_id', u_destino.id));
  RETURN x.id;
END $$;
REVOKE ALL ON FUNCTION public.encaminhar_upa(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encaminhar_upa(uuid, uuid, text) TO authenticated;
