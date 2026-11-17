-- Percurso da UBS, U8, U9 e D2 (RT, 17/11/2026, decisões A).
--
-- 1. U8 (D4): sem enfermeiro de plantão no consultório, a ficha de "escuta
--    inicial" vai direto para a fila do médico (etapa atendimento), em vez de
--    ficar parada na fila da enfermagem. A registrar_ficha devolve a etapa, e a
--    recepção avisa.
-- 2. U8 (G2): a escuta inicial registra a DUM (opcional). Ela vai para
--    classificacoes_risco.gestacao, de onde o pré-natal já lê a DUM quando o
--    médico fecha a consulta com gestação (pre_natal_na_consulta).
-- 3. D2: só o médico envia à UPA. O enfermeiro não envia da escuta; o
--    vermelho vai à fila do médico como imediato.
-- 4. U9: a chegada na UPA é registrada sozinha quando a recepção da UPA abre a
--    ficha do paciente enviado (mesmo CNS ou CPF; sem documento, mesmo nome e
--    nascimento), com o envio ainda esperando. A UBS é avisada como antes.
--    Com mais de um envio possível, nada é marcado: a recepção escolhe no
--    painel "Vindo da UBS", como sempre.
--
-- Idempotente. Teste: supabase/tests/ubs_escuta_envio_chegada.sql
--
-- Rollback (na ordem):
--   DROP TRIGGER trg_encaminhamento_upa_chegada_pela_ficha ON public.episodios;
--   DROP FUNCTION private.encaminhamento_upa_chegada_pela_ficha();
--   as trocas 3 e 1 invertidas (os trechos estão abaixo);
--   recriar public.registrar_escuta_aps(uuid, text, text, text, jsonb, text, text)
--     de 20270213000001_escuta_inicial_ubs.sql e
--     DROP FUNCTION public.registrar_escuta_aps(uuid, text, text, text, jsonb, text, text, date);
--   DROP FUNCTION private.enfermeiro_de_plantao(uuid);

CREATE OR REPLACE FUNCTION pg_temp.u8_trocar(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    CONTINUE WHEN position(p_pares[k + 1] IN novo) > 0;
    IF position(p_pares[k] IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, p_pares[k];
    END IF;
    novo := replace(novo, p_pares[k], p_pares[k + 1]);
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

-- ── 1. enfermeiro de plantão no consultório ─────────────────────────────────
-- alguém com papel de enfermeiro na escala daquele setor, dentro da janela do
-- plantão e sem check-out feito
CREATE OR REPLACE FUNCTION private.enfermeiro_de_plantao(p_setor uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.escala_plantao e
     WHERE e.setor_id = p_setor AND e.ativo
       AND now() >= e.inicio AND now() < e.inicio + make_interval(mins => e.duracao_min)
       AND (e.papel::text = 'enfermeiro'
            OR (e.papel IS NULL AND EXISTS (SELECT 1 FROM public.vinculos v
                                             WHERE v.perfil_id = e.perfil_id AND v.unidade_id = e.unidade_id
                                               AND v.ativo AND v.papel::text = 'enfermeiro')))
       AND private.checkout_do_plantao(e.id) IS NULL)
$$;
REVOKE ALL ON FUNCTION private.enfermeiro_de_plantao(uuid) FROM PUBLIC, anon, authenticated;

SELECT pg_temp.u8_trocar('public.registrar_ficha(uuid, text, uuid, jsonb, text[], boolean)',
  -- a etapa da ficha (aparece duas vezes: no INSERT e na auditoria)
  'CASE WHEN v_ubs AND v_tipo_aps IS DISTINCT FROM ''escuta_inicial'' THEN ''atendimento'' ELSE ''triagem'' END, v_tipo_aps)',
  'CASE WHEN v_ubs AND (v_tipo_aps IS DISTINCT FROM ''escuta_inicial'' OR NOT private.enfermeiro_de_plantao(p_setor)) THEN ''atendimento'' ELSE ''triagem'' END, v_tipo_aps)',
  '''status'', CASE WHEN v_ubs AND v_tipo_aps IS DISTINCT FROM ''escuta_inicial'' THEN ''atendimento'' ELSE ''triagem'' END));',
  '''status'', (SELECT etapa FROM public.episodios WHERE id = v_epi)));',
  '''prioridades_legais'', to_jsonb(v_prio));',
  '''prioridades_legais'', to_jsonb(v_prio), ''etapa'', (SELECT etapa FROM public.episodios WHERE id = v_epi));');

-- ── 2. escuta com DUM ───────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.registrar_escuta_aps(uuid, text, text, text, jsonb, text, text);
CREATE OR REPLACE FUNCTION public.registrar_escuta_aps(
  p_episodio uuid, p_cor text, p_saida text, p_queixa text DEFAULT NULL, p_sinais jsonb DEFAULT '{}',
  p_publico text DEFAULT NULL, p_obs text DEFAULT NULL, p_dum date DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.episodios;
  v_eu uuid := private.meu_perfil_id();
  v_nasc date;
  v_sexo text;
  v_pub_idade text;
  v_publico text;
  v_obs text := nullif(btrim(p_obs), '');
  v_conceito uuid;
  v_id uuid;
  v_hoje date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  k text;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Episódio não encontrado.'; END IF;
  IF e.tipo_atendimento_aps IS NULL THEN RAISE EXCEPTION 'A escuta inicial do CAB 28 é só da UBS.'; END IF;
  IF e.setor_id NOT IN (SELECT private.setores_na_escala_agora()) THEN
    RAISE EXCEPTION 'Acesso negado: você não está de plantão neste consultório.';
  END IF;
  IF private.tenho_papel(e.unidade_id, 'enfermeiro') IS NOT TRUE THEN
    RAISE EXCEPTION 'A escuta inicial e a classificação são do enfermeiro.';
  END IF;
  IF e.etapa <> 'triagem' THEN RAISE EXCEPTION 'Este paciente não está aguardando a escuta inicial.'; END IF;
  IF p_cor IS NULL OR p_cor NOT IN ('vermelho', 'amarelo', 'verde', 'azul') THEN
    RAISE EXCEPTION 'Escolha a classificação do CAB 28 (vermelho, amarelo, verde ou azul).';
  END IF;
  IF p_cor = 'azul' AND p_saida IS DISTINCT FROM 'orientacao' AND p_saida IS DISTINCT FROM 'agendamento' THEN
    RAISE EXCEPTION 'Situação não aguda (azul): orientação ou agendamento.';
  END IF;
  IF p_cor <> 'azul' AND p_saida IS DISTINCT FROM 'consulta' THEN
    RAISE EXCEPTION 'Situação aguda (vermelho, amarelo ou verde) vai para a consulta.';
  END IF;
  IF p_cor = 'azul' AND length(coalesce(v_obs, '')) < 10 THEN
    RAISE EXCEPTION 'Escreva a orientação dada ou o agendamento (mínimo de 10 letras).';
  END IF;

  SELECT data_nascimento, sexo INTO v_nasc, v_sexo FROM public.pacientes WHERE id = e.paciente_id;
  -- DUM (U8): só de quem pode gestar, não no futuro e com até 48 semanas
  IF p_dum IS NOT NULL THEN
    IF coalesce(v_sexo, '') ~* '^m' THEN RAISE EXCEPTION 'DUM: o cadastro do paciente é do sexo masculino.'; END IF;
    IF p_dum > v_hoje THEN RAISE EXCEPTION 'DUM no futuro.'; END IF;
    IF v_hoje - p_dum > 336 THEN RAISE EXCEPTION 'DUM com mais de 48 semanas: confira a data.'; END IF;
  END IF;

  -- grupo pela idade (pediatria até 13a 11m 29d); sem data de nascimento,
  -- vale o informado
  IF v_nasc IS NOT NULL THEN
    v_pub_idade := CASE WHEN private.pediatrico_em(v_nasc, (e.chegada_em AT TIME ZONE 'America/Sao_Paulo')::date)
                        THEN 'pediatrico' ELSE 'adulto' END;
  END IF;
  v_publico := coalesce(v_pub_idade, p_publico, e.publico);
  IF v_publico IS NULL OR v_publico NOT IN ('adulto', 'pediatrico') THEN
    RAISE EXCEPTION 'Sem data de nascimento: informe se é adulto ou pediatria.';
  END IF;

  -- sinais vitais opcionais (decisão do RT): os que vierem, numéricos e
  -- conhecidos, ficam como aferidos agora por quem escutou
  FOR k IN SELECT jsonb_object_keys(coalesce(p_sinais, '{}')) LOOP
    IF jsonb_typeof(p_sinais -> k) <> 'number' THEN RAISE EXCEPTION 'Sinal vital sem número: %.', replace(k, '-', ' '); END IF;
    SELECT id INTO v_conceito FROM public.conceito WHERE nome = k AND (unidade_id IS NULL OR unidade_id = e.unidade_id) LIMIT 1;
    IF v_conceito IS NULL THEN RAISE EXCEPTION 'Sinal vital desconhecido: %.', k; END IF;
    INSERT INTO public.observacao (unidade_id, paciente_id, episodio_id, conceito_id, aferido_em, registrado_por, valor_num, origem)
    VALUES (e.unidade_id, e.paciente_id, e.id, v_conceito, now(), v_eu, (p_sinais ->> k)::numeric, 'manual');
  END LOOP;

  INSERT INTO public.classificacoes_risco
    (episodio_id, unidade_id, paciente_id, cor, publico, avaliacao, reclassificacao, motivo, autor_id, autor_papel,
     queixa, publico_pela_idade, protocolo, saida_escuta, gestacao)
  VALUES
    (e.id, e.unidade_id, e.paciente_id, p_cor, v_publico, '{}', false, v_obs, v_eu, 'enfermeiro',
     coalesce(nullif(btrim(p_queixa), ''), e.queixa), v_pub_idade, 'cab28', p_saida,
     CASE WHEN p_dum IS NOT NULL THEN jsonb_build_object('dum', p_dum, 'origem', 'escuta_aps') END)
  RETURNING id INTO v_id;

  IF p_cor = 'azul' THEN
    -- não aguda: a escuta resolve (orientação) ou deixa o agendamento escrito;
    -- o episódio encerra sem desfecho da porta e sem conduta médica
    UPDATE public.episodios
       SET cor_atual = p_cor, publico = v_publico, classificado_em = now(), etapa = 'encerrado',
           desfecho_motivo = v_obs, desfecho_em = now(), desfecho_por = v_eu, encerrado_em = now(), encerrado_por = v_eu,
           updated_at = now()
     WHERE id = e.id;
  ELSE
    UPDATE public.episodios
       SET cor_atual = p_cor, publico = v_publico, classificado_em = now(), etapa = 'atendimento', updated_at = now()
     WHERE id = e.id;
  END IF;

  PERFORM private.registrar_auditoria('escuta_aps_registrada', 'episodios', e.id, e.unidade_id,
    jsonb_build_object('cor', p_cor, 'status', p_saida, 'escala', 'cab28', 'dum', p_dum IS NOT NULL));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_escuta_aps(uuid, text, text, text, jsonb, text, text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_escuta_aps(uuid, text, text, text, jsonb, text, text, date) TO authenticated;

-- ── 3. só o médico envia à UPA (D2) ─────────────────────────────────────────
-- (trechos de uma linha só: o fim de linha do arquivo não entra na comparação)
SELECT pg_temp.u8_trocar('public.encaminhar_upa(uuid, uuid, text)',
  'OR NOT (private.tenho_papel(e.unidade_id, ''plantonista'') IS TRUE OR private.tenho_papel(e.unidade_id, ''enfermeiro'') IS TRUE) THEN',
  'OR private.tenho_papel(e.unidade_id, ''plantonista'') IS NOT TRUE THEN',
  'RAISE EXCEPTION ''Acesso negado: envia o médico ou o enfermeiro de plantão no consultório.'';',
  'RAISE EXCEPTION ''Acesso negado: o envio à UPA é do médico de plantão no consultório.'';');

-- ── 4. chegada na UPA pela ficha da recepção (U9) ───────────────────────────
CREATE OR REPLACE FUNCTION private.encaminhamento_upa_chegada_pela_ficha()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  p public.pacientes;
  v_ids uuid[];
  x public.encaminhamentos_upa;
  v_nome text;
BEGIN
  IF NEW.tipo_atendimento_aps IS NOT NULL THEN RETURN NULL; END IF;  -- só a ficha da UPA ou do hospital
  BEGIN
    SELECT * INTO p FROM public.pacientes WHERE id = NEW.paciente_id;
    SELECT array_agg(u.id) INTO v_ids
      FROM public.encaminhamentos_upa u
     WHERE u.unidade_destino_id = NEW.unidade_id
       AND (u.situacao = 'enviado' OR (u.situacao = 'nao_chegou' AND u.chegada_por IS NULL))
       AND u.enviado_em > now() - interval '24 hours'
       AND (   (nullif(btrim(p.cns), '') IS NOT NULL AND btrim(p.cns) = btrim(coalesce(u.resumo -> 'paciente' ->> 'cns', '')))
            OR (nullif(btrim(p.cpf), '') IS NOT NULL
                AND regexp_replace(p.cpf, '\D', '', 'g') = regexp_replace(coalesce(u.resumo -> 'paciente' ->> 'cpf', ''), '\D', '', 'g'))
            OR (p.data_nascimento IS NOT NULL
                AND p.data_nascimento::text = u.resumo -> 'paciente' ->> 'data_nascimento'
                AND lower(btrim(p.nome)) = lower(btrim(coalesce(u.resumo -> 'paciente' ->> 'nome', '')))));
    -- um envio só: com dois ou mais, a recepção escolhe no painel
    IF coalesce(array_length(v_ids, 1), 0) <> 1 THEN RETURN NULL; END IF;

    UPDATE public.encaminhamentos_upa
       SET situacao = 'chegou', chegada_em = now(), chegada_por = NEW.aberto_por, episodio_destino_id = NEW.id,
           observacao_chegada = 'Chegada registrada pela ficha da recepção.'
     WHERE id = v_ids[1]
    RETURNING * INTO x;
    v_nome := coalesce(nullif(btrim(x.resumo -> 'paciente' ->> 'nome_social'), ''), x.resumo -> 'paciente' ->> 'nome');
    PERFORM private.encaminhamento_upa_avisar(x, false, 'ubs_upa',
      v_nome || ' chegou à ' || (SELECT nome FROM public.unidades WHERE id = x.unidade_destino_id) || '.');
    PERFORM private.registrar_auditoria('encaminhamento_upa_chegada', 'encaminhamentos_upa', x.id, x.unidade_destino_id,
      jsonb_build_object('status', 'chegou', 'episodio_id', NEW.id, 'automatico', true));
  EXCEPTION WHEN others THEN
    -- a ficha nunca trava pela chegada: a recepção ainda marca no painel
    RAISE WARNING 'chegada pela ficha: episódio % não ligado: %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION private.encaminhamento_upa_chegada_pela_ficha() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_encaminhamento_upa_chegada_pela_ficha ON public.episodios;
CREATE TRIGGER trg_encaminhamento_upa_chegada_pela_ficha AFTER INSERT ON public.episodios
  FOR EACH ROW EXECUTE FUNCTION private.encaminhamento_upa_chegada_pela_ficha();

DROP FUNCTION pg_temp.u8_trocar(regprocedure, text[]);
