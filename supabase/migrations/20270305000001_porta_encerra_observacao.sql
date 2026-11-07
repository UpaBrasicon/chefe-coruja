-- ════════════════════════════════════════════════════════════════════════════
-- O médico da porta encerra a observação que ele abriu (achado P1-2 do teste de
-- rede A01, passo A01R.24.porta_finaliza; decisão do RT em 06/11/2026: "Sim,
-- deve poder").
--
-- Antes: finalizar_observacao passava por private.observacao_para_mim, e
-- dar_alta e registrar_evento_adt (chamados por ela) pela escala do setor
-- (private.cuido_da_internacao / setores_na_escala_agora). O médico da porta
-- que pôs o paciente em observação, sem escala no setor da observação, recebia
-- "Acesso negado: você não está de plantão no setor deste paciente."
--
-- Quem passa a poder: só no encerramento da observação, quem atende TODAS:
--   1. é o autor da decisão de observar (abaixo);
--   2. tem o papel plantonista na unidade da internação (tenho_papel);
--   3. está de plantão agora na mesma unidade, em qualquer setor (a mesma
--      regra da escala: private.setores_na_escala_agora, que vem de
--      plantoes_agora, com check-in, tolerância e liberação do gestor);
--   4. o paciente está de fato na observação: status 'em_observacao' e setor
--      de observação (private.setor_de_observacao), como observacao_para_mim.
--
-- O registro do autor: public.episodios.desfecho_por do episódio da porta com
-- desfecho = 'observacao' e desfecho_detalhes ->> 'internacao_id' = a
-- internação. Por quê:
--   - é gravado por public.registrar_desfecho com private.meu_perfil_id() (o
--     login), na mesma transação que cria a internação de observação
--     (private.internar_do_episodio) e só depois de private.medico_na_porta
--     (plantonista de plantão na porta): é literalmente quem decidiu observar;
--   - o cliente não escreve em episodios (só SELECT para authenticated) e
--     registrar_desfecho exige etapa 'atendimento', então o desfecho
--     'observacao' não é refeito; nenhuma função troca desfecho_por depois (a
--     20261126000001 só preenche quando está vazio; internacao_conduz_episodio
--     mexe na etapa e no encerramento, não no desfecho);
--   - o vínculo é duplo (internacoes.episodio_id e o internacao_id gravado no
--     desfecho), então outra internação do mesmo episódio não herda o autor.
--   Descartados: episodios.atendimento_medico_id (é quem ABRIU o atendimento,
--   pode não ser quem decidiu o desfecho); o evento ADT 'admissao' de
--   internar_do_episodio (mesmo autor, mas a tabela eventos_adt tem grant de
--   escrita para authenticated, barrado só pela RLS; episodios nem isso tem).
--
-- Desenho (nada além do encerramento ganha acesso):
--   - private.abriu_a_observacao(i): as quatro condições acima;
--   - private.observacao_para_encerrar(p_internacao): o autor que atende
--     abriu_a_observacao passa; os outros caem em observacao_para_mim, como
--     antes. Marca a transação com cc.encerra_observacao = id da internação
--     (o mesmo padrão de cc.reserva_nova e cc.leito_retorno);
--   - private.encerrando_observacao_que_abri(i): a marca é desta internação E
--     abriu_a_observacao(i) continua verdadeira (a marca sozinha não abre nada);
--   - finalizar_observacao: troca observacao_para_mim pela observacao_para_encerrar
--     e limpa a marca ao terminar;
--   - dar_alta: cuido_da_internacao(i) OR encerrando_observacao_que_abri(i);
--   - registrar_evento_adt: mais um OR com encerrando_observacao_que_abri(v_ep).
--   private.cuido_da_internacao e private.observacao_para_mim NÃO mudam:
--   prescrever, evoluir, checar, atender, reavaliar, protocolo, passagem e
--   dar_alta/registrar_evento_adt chamados fora do encerramento seguem pela
--   escala do setor. Depois do encerramento o paciente sai da observação
--   (alta ou 'internado'), e abriu_a_observacao fica falsa.
--   A auditoria não muda: alta_por, eventos_adt.autor_id, alta_paciente e
--   log_auditoria continuam com private.meu_perfil_id() (o login).
--
-- Definições copiadas (as mais recentes, conferidas na homologação com
-- pg_get_functiondef em 06/11/2026):
--   - public.finalizar_observacao: 20261119000001_desfecho_encerra_cuidado.sql
--   - public.dar_alta: 20261119000003_cid_existente.sql
--   - public.registrar_evento_adt: 20260926000001_fase0_endurecer_rpcs.sql com a
--     linha do segundo fator posta por 20260926000010_fase1_segundo_fator_rpcs.sql
--
-- Só expande: três funções novas e CREATE OR REPLACE das três. Grants das
-- existentes ficam; as novas são privadas (sem EXECUTE para o cliente).
-- Reaplicável. Teste: supabase/tests/fix_porta_encerra_observacao.sql.
--
-- ROLLBACK (desfaz só esta migration; testado na homologação em transação):
--   DO $$
--   DECLARE f record; v text;
--   BEGIN
--     FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--               WHERE n.nspname = 'public' AND p.proname IN ('finalizar_observacao', 'dar_alta', 'registrar_evento_adt')
--     LOOP
--       v := replace(pg_get_functiondef(f.oid), chr(13), '');  -- aplicada de checkout CRLF
--       v := replace(v, 'i := private.observacao_para_encerrar(p_internacao);',
--                       'i := private.observacao_para_mim(p_internacao, true);');
--       v := replace(v, E'    PERFORM set_config(''cc.encerra_observacao'', '''', true);\n', '');
--       v := replace(v, E'  PERFORM set_config(''cc.encerra_observacao'', '''', true);\n', '');
--       v := replace(v, 'IF NOT (private.cuido_da_internacao(i) OR private.encerrando_observacao_que_abri(i)) THEN',
--                       'IF NOT private.cuido_da_internacao(i) THEN');
--       v := replace(v, E'          OR private.encerrando_observacao_que_abri(v_ep)\n', '');
--       EXECUTE v;
--     END LOOP;
--   END $$;
--   DROP FUNCTION IF EXISTS private.observacao_para_encerrar(uuid);
--   DROP FUNCTION IF EXISTS private.encerrando_observacao_que_abri(public.internacoes);
--   DROP FUNCTION IF EXISTS private.abriu_a_observacao(public.internacoes);
-- ════════════════════════════════════════════════════════════════════════════

-- ── quem abriu a observação, de plantão na unidade ──────────────────────────
CREATE OR REPLACE FUNCTION private.abriu_a_observacao(i public.internacoes)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(
       i.status = 'em_observacao'
   AND private.setor_de_observacao(i.setor_atual_id)
   AND private.tenho_papel(i.unidade_id, 'plantonista') IS TRUE
   AND EXISTS (SELECT 1 FROM public.setores s
                WHERE s.unidade_id = i.unidade_id
                  AND s.id IN (SELECT private.setores_na_escala_agora()))
   AND EXISTS (SELECT 1 FROM public.episodios e
                WHERE e.id = i.episodio_id
                  AND e.unidade_id = i.unidade_id
                  AND e.paciente_id = i.paciente_id
                  AND e.desfecho = 'observacao'
                  AND e.desfecho_detalhes ->> 'internacao_id' = i.id::text
                  AND e.desfecho_por = private.meu_perfil_id()),
    false)
$$;
REVOKE ALL ON FUNCTION private.abriu_a_observacao(public.internacoes) FROM PUBLIC, anon, authenticated;

-- ── a observação que vou encerrar: o autor pela porta, os outros pela escala ─
CREATE OR REPLACE FUNCTION private.observacao_para_encerrar(p_internacao uuid)
RETURNS public.internacoes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE i public.internacoes;
BEGIN
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF private.abriu_a_observacao(i) IS NOT TRUE THEN
    i := private.observacao_para_mim(p_internacao, true);
  END IF;
  -- dar_alta e registrar_evento_adt, chamados pelo encerramento, reconhecem a marca
  PERFORM set_config('cc.encerra_observacao', i.id::text, true);
  RETURN i;
END $$;
REVOKE ALL ON FUNCTION private.observacao_para_encerrar(uuid) FROM PUBLIC, anon, authenticated;

-- ── estou encerrando a observação que abri (a marca sozinha não basta) ──────
CREATE OR REPLACE FUNCTION private.encerrando_observacao_que_abri(i public.internacoes)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(nullif(current_setting('cc.encerra_observacao', true), '') = i.id::text, false)
     AND private.abriu_a_observacao(i)
$$;
REVOKE ALL ON FUNCTION private.encerrando_observacao_que_abri(public.internacoes) FROM PUBLIC, anon, authenticated;

-- ── finalizar_observacao (de 20261119000001) ────────────────────────────────
CREATE OR REPLACE FUNCTION public.finalizar_observacao(p_internacao uuid, p_desfecho text, p_cid text DEFAULT NULL::text, p_relato text DEFAULT NULL::text, p_detalhes jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  i public.internacoes;
  d jsonb := coalesce(p_detalhes, '{}'::jsonb);
  v_relato text := nullif(btrim(coalesce(p_relato, '')), '');
  v_tipo text;
  v_setor uuid;
  v_leito uuid;
  v_hora timestamptz;
BEGIN
  PERFORM private.exigir_segundo_fator();
  PERFORM 1 FROM public.internacoes WHERE id = p_internacao FOR UPDATE;
  i := private.observacao_para_encerrar(p_internacao);
  IF p_desfecho NOT IN ('alta_medica', 'alta_apos_medicacao', 'internacao', 'transferencia', 'evasao', 'alta_a_pedido', 'obito') THEN
    RAISE EXCEPTION 'Desfecho desconhecido.';
  END IF;
  -- no óbito e na transferência a passagem é retirada junto com o desfecho (dar_alta)
  IF p_desfecho NOT IN ('obito', 'transferencia')
     AND EXISTS (SELECT 1 FROM public.passagens_plantao WHERE internacao_id = i.id AND situacao = 'aguardando') THEN
    RAISE EXCEPTION 'Há passagem de plantão aguardando aceite. Retire a passagem antes de finalizar.';
  END IF;
  IF p_desfecho IN ('evasao', 'alta_a_pedido', 'obito') AND length(coalesce(v_relato, '')) < 15 THEN
    RAISE EXCEPTION '%', CASE p_desfecho
      WHEN 'evasao' THEN 'Como e quando foi percebida a evasão: escreva ao menos 15 letras.'
      WHEN 'alta_a_pedido' THEN 'Riscos explicados e termo assinado: escreva ao menos 15 letras.'
      ELSE 'Circunstâncias do óbito e medidas realizadas: escreva ao menos 15 letras.' END;
  END IF;
  d := d || jsonb_build_object('desfecho_observacao', p_desfecho);

  -- quem sai da observação sai do protocolo junto
  UPDATE public.observacao_protocolos
     SET encerrado_em = now(), encerrado_por = private.meu_perfil_id(),
         motivo_encerramento = 'Encerrado com o desfecho da observação'
   WHERE internacao_id = i.id AND encerrado_em IS NULL;

  IF p_desfecho = 'internacao' THEN
    v_setor := nullif(d ->> 'setor_id', '')::uuid;
    v_leito := nullif(d ->> 'leito_id', '')::uuid;
    IF v_setor IS NULL OR NOT EXISTS (SELECT 1 FROM public.setores WHERE id = v_setor AND unidade_id = i.unidade_id
                                        AND ativo AND (tipo IN ('internacao', 'uti', 'isolamento')
                                          OR (tipo = 'observacao' AND position('verm' in lower(nome)) > 0))) THEN
      RAISE EXCEPTION 'Escolha o setor de internação.';
    END IF;
    IF v_leito IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.leitos WHERE id = v_leito AND setor_id = v_setor AND ativo AND status IN ('livre', 'reservado')) THEN
      RAISE EXCEPTION 'O leito escolhido não está livre neste setor.';
    END IF;
    PERFORM public.registrar_evento_adt(i.id, 'internacao', v_setor, v_leito, coalesce(v_relato, 'Desfecho da observação'), d);
    UPDATE public.pacientes SET setor_id = v_setor, updated_at = now() WHERE id = i.paciente_id;
    PERFORM set_config('cc.encerra_observacao', '', true);
    RETURN;
  END IF;

  v_tipo := CASE p_desfecho
    WHEN 'alta_medica' THEN 'alta_melhorada'
    WHEN 'alta_apos_medicacao' THEN 'alta_melhorada'
    WHEN 'transferencia' THEN 'transferencia_externa'
    WHEN 'evasao' THEN 'alta_evasao'
    WHEN 'alta_a_pedido' THEN 'alta_pedido'
    ELSE 'obito' END;
  IF p_desfecho = 'transferencia' AND length(btrim(coalesce(d ->> 'destino', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o serviço de destino.';
  END IF;
  IF p_desfecho = 'obito' THEN
    v_hora := nullif(d ->> 'hora_obito', '')::timestamptz;
    IF v_hora IS NULL THEN RAISE EXCEPTION 'Informe a hora do óbito.'; END IF;
    IF v_hora > now() + interval '1 minute' THEN RAISE EXCEPTION 'Hora do óbito no futuro.'; END IF;
    IF v_hora < i.data_admissao THEN RAISE EXCEPTION 'Hora do óbito antes da entrada.'; END IF;
  END IF;
  -- a alta é registrada agora; a hora do óbito vai nos detalhes, como na porta
  PERFORM public.dar_alta(i.id, v_tipo, p_cid, NULL, NULL, v_relato, d);
  PERFORM set_config('cc.encerra_observacao', '', true);
END $function$;

-- ── dar_alta (de 20261119000003) ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.dar_alta(p_internacao uuid, p_tipo text, p_cid text, p_quando timestamp with time zone DEFAULT NULL::timestamp with time zone, p_justificativa text DEFAULT NULL::text, p_observacoes text DEFAULT NULL::text, p_detalhes jsonb DEFAULT '{}'::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  i public.internacoes;
  v_perfil uuid := private.meu_perfil_id();
  v_quando timestamptz := coalesce(p_quando, now());
  v_cid text := upper(btrim(coalesce(p_cid, '')));
  d jsonb := coalesce(p_detalhes, '{}'::jsonb);
  v_imp jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN RAISE EXCEPTION 'Internação já encerrada.'; END IF;
  IF NOT (private.cuido_da_internacao(i) OR private.encerrando_observacao_que_abri(i)) THEN RAISE EXCEPTION 'Acesso negado: você não está de plantão no setor deste paciente.'; END IF;
  IF private.tenho_papel(i.unidade_id, 'plantonista') IS NOT TRUE THEN RAISE EXCEPTION 'A alta é do médico.'; END IF;
  IF p_tipo NOT IN ('alta_melhorada', 'alta_pedido', 'alta_evasao', 'transferencia_externa', 'obito') THEN
    RAISE EXCEPTION 'Tipo de alta inválido.';
  END IF;
  -- evasão: o paciente saiu sem avaliação final, então o CID é opcional
  -- (decisão do RT, 29/09/2026 — a mesma regra da porta); se vier, vale o formato
  IF v_cid = '' AND p_tipo = 'alta_evasao' THEN
    v_cid := NULL;
  ELSIF v_cid !~ '^[A-Z][0-9]{2}(\.?[0-9A-Z]{1,2})?$' THEN
    RAISE EXCEPTION 'Informe o CID de alta.';
  END IF;
  -- o código tem de existir na CID-10 (tarefa 3 do portão)
  IF v_cid IS NOT NULL THEN v_cid := private.cid_existente(v_cid); END IF;
  IF v_quando > now() + interval '1 minute' THEN RAISE EXCEPTION 'Hora da alta no futuro.'; END IF;
  IF v_quando < i.data_admissao THEN RAISE EXCEPTION 'Hora da alta antes da admissão.'; END IF;
  IF v_quando < now() - interval '30 minutes' AND length(btrim(coalesce(p_justificativa, ''))) < 10 THEN
    RAISE EXCEPTION 'Alta retroativa (mais de 30 minutos atrás): justifique (mínimo de 10 letras).';
  END IF;
  IF p_tipo IN ('alta_pedido', 'alta_evasao') AND length(btrim(coalesce(p_observacoes, ''))) < 15 THEN
    RAISE EXCEPTION 'Descreva o ocorrido (mínimo de 15 letras).';
  END IF;
  IF p_tipo = 'transferencia_externa' AND length(btrim(coalesce(d ->> 'destino', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o destino da transferência.';
  END IF;
  IF p_tipo = 'obito' AND length(btrim(coalesce(d ->> 'numero_do', ''))) < 3 THEN
    RAISE EXCEPTION 'Informe o número da Declaração de Óbito.';
  END IF;

  -- óbito e transferência externa não esperam o que ficou aberto (RT, 11/10/2026);
  -- só o agravo suspeito sem notificação continua impedindo
  IF p_tipo IN ('obito', 'transferencia_externa') THEN
    PERFORM private.encerrar_abertos_da_internacao(i, CASE p_tipo WHEN 'obito' THEN 'Óbito' ELSE 'Transferência externa' END);
  END IF;
  v_imp := private.impeditivos_alta(i.id);
  IF p_tipo IN ('obito', 'transferencia_externa') THEN
    SELECT coalesce(jsonb_agg(x), '[]'::jsonb) INTO v_imp FROM jsonb_array_elements(v_imp) x WHERE x ->> 'tipo' <> 'documento';
  END IF;
  IF jsonb_array_length(v_imp) > 0 THEN
    RAISE EXCEPTION 'Existe(m) pendência(s) em aberto: %',
      (SELECT string_agg(x ->> 'descricao', '; ') FROM jsonb_array_elements(v_imp) x);
  END IF;

  PERFORM public.registrar_evento_adt(i.id, p_tipo, NULL, NULL, nullif(btrim(p_observacoes), ''),
    jsonb_build_object('cid', v_cid, 'quando', v_quando) || d);
  UPDATE public.internacoes
     SET data_alta = v_quando, cid_alta = v_cid, alta_por = v_perfil, alta_registrada_em = now(),
         alta_justificativa_retroativa = nullif(btrim(p_justificativa), ''),
         alta_observacoes = nullif(btrim(p_observacoes), ''),
         alta_detalhes = CASE WHEN d = '{}'::jsonb THEN NULL ELSE d END
   WHERE id = i.id;
  UPDATE public.episodios SET encerrado_em = v_quando WHERE id = i.episodio_id;
  -- o paciente saiu: a prescrição para de valer e sai da checagem
  PERFORM private.encerrar_prescricoes(i.id, i.episodio_id, 'Encerrada com a alta da internação (' || p_tipo || ').');
  UPDATE public.pacientes SET setor_id = NULL, updated_at = now() WHERE id = i.paciente_id;
  INSERT INTO public.alta_paciente (paciente_id, unidade_id, status, criterios, justificativa, liberou_leito, criado_por)
  VALUES (i.paciente_id, i.unidade_id, 'concluida', jsonb_build_object('tipo', p_tipo, 'cid', v_cid, 'internacao_id', i.id),
          nullif(btrim(p_observacoes), ''), i.leito_atual_id IS NOT NULL, v_perfil);
END $function$;

-- ── registrar_evento_adt (de 20260926000001 + segundo fator de 20260926000010)
CREATE OR REPLACE FUNCTION public.registrar_evento_adt(p_internacao uuid, p_tipo_evento text, p_setor_destino uuid DEFAULT NULL::uuid, p_leito_destino uuid DEFAULT NULL::uuid, p_motivo text DEFAULT NULL::text, p_payload jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_ep public.internacoes%ROWTYPE;
  v_seq integer;
  v_hash_previo text;
  v_hash text;
  v_estado_antes jsonb;
  v_estado_depois jsonb;
  v_status_novo text;
  v_leito_origem uuid;
  v_setor_origem uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF v_perfil IS NULL THEN RAISE EXCEPTION 'Perfil não encontrado'; END IF;

  SELECT * INTO v_ep FROM public.internacoes WHERE id = p_internacao;
  IF v_ep.id IS NULL THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;

  IF (   private.eh_super_admin()
          OR private.papel_na_unidade(v_ep.unidade_id) = 'gestor'
          OR private.tem_acesso_atendimento(v_ep.unidade_id)
          OR v_ep.setor_atual_id IN (SELECT private.setores_na_escala_agora())
          OR private.encerrando_observacao_que_abri(v_ep)
          OR EXISTS (SELECT 1 FROM public.pacientes pa
                     WHERE pa.id = v_ep.paciente_id
                       AND pa.setor_id IN (SELECT private.setores_na_escala_agora()))
          OR (v_ep.setor_atual_id IS NULL
              AND private.papel_na_unidade(v_ep.unidade_id) = 'plantonista'
              AND private.na_escala_agora(v_ep.unidade_id))) IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: você não está na escala deste paciente.';
  END IF;
  IF p_setor_destino IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.setores WHERE id = p_setor_destino AND unidade_id = v_ep.unidade_id) THEN
    RAISE EXCEPTION 'Setor de destino não pertence à unidade do episódio.';
  END IF;
  IF p_leito_destino IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.leitos l JOIN public.setores s ON s.id = l.setor_id
       WHERE l.id = p_leito_destino AND s.unidade_id = v_ep.unidade_id) THEN
    RAISE EXCEPTION 'Leito de destino não pertence à unidade do episódio.';
  END IF;

  v_status_novo := CASE p_tipo_evento
    WHEN 'alta_melhorada' THEN 'alta_melhorada'
    WHEN 'alta_pedido' THEN 'alta_pedido'
    WHEN 'alta_evasao' THEN 'alta_evasao'
    WHEN 'transferencia_externa' THEN 'transferencia_externa'
    WHEN 'obito' THEN 'obito'
    WHEN 'internacao' THEN 'internado'
    WHEN 'entrada_observacao' THEN 'em_observacao'
    ELSE v_ep.status
  END;

  IF p_tipo_evento IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito') THEN
    IF v_ep.status NOT IN ('admitido','em_observacao','internado') THEN
      RAISE EXCEPTION 'Internação já encerrada.';
    END IF;
  END IF;

  SELECT max(seq) INTO v_seq FROM public.eventos_adt WHERE internacao_id = p_internacao;
  v_seq := coalesce(v_seq, 0) + 1;

  SELECT hash_conteudo INTO v_hash_previo FROM public.eventos_adt
    WHERE internacao_id = p_internacao AND seq = v_seq - 1 ORDER BY seq DESC LIMIT 1;

  v_leito_origem := v_ep.leito_atual_id;
  v_setor_origem := v_ep.setor_atual_id;
  v_estado_antes := jsonb_build_object(
    'status', v_ep.status, 'setor', v_setor_origem, 'leito', v_leito_origem);
  v_estado_depois := jsonb_build_object(
    'status', v_status_novo,
    'setor', coalesce(p_setor_destino, v_setor_origem),
    'leito', coalesce(p_leito_destino, v_leito_origem));

  v_hash := private.hash_evento(v_seq, p_tipo_evento, v_estado_depois, v_perfil, p_motivo, v_hash_previo);

  INSERT INTO public.eventos_adt
    (seq, organizacao_id, unidade_id, internacao_id, paciente_id, tipo_evento,
     estado_antes, estado_depois,
     leito_origem_id, leito_destino_id, setor_origem_id, setor_destino_id,
     autor_id, motivo, payload, hash_previo, hash_conteudo)
  VALUES
    (v_seq, v_ep.organizacao_id, v_ep.unidade_id, v_ep.id, v_ep.paciente_id, p_tipo_evento,
     v_estado_antes, v_estado_depois,
     v_leito_origem, p_leito_destino, v_setor_origem, p_setor_destino,
     v_perfil, p_motivo, p_payload, v_hash_previo, v_hash);

  UPDATE public.internacoes
    SET status = v_status_novo,
        setor_atual_id = coalesce(p_setor_destino, setor_atual_id),
        leito_atual_id = CASE
                          WHEN p_tipo_evento IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito') THEN NULL
                          ELSE coalesce(p_leito_destino, leito_atual_id)
                         END,
        data_entrada_setor = CASE WHEN p_setor_destino IS NOT NULL AND p_setor_destino <> setor_atual_id THEN now() ELSE data_entrada_setor END,
        data_alta = CASE
                      WHEN p_tipo_evento IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito') THEN now()
                      ELSE data_alta
                    END,
        updated_at = now()
    WHERE id = p_internacao;

  IF p_tipo_evento IN ('alta_melhorada','alta_pedido','alta_evasao','transferencia_externa','obito')
     AND v_leito_origem IS NOT NULL THEN
    UPDATE public.leitos SET status = 'higienizacao' WHERE id = v_leito_origem;
    INSERT INTO public.eventos_leito
      (leito_id, unidade_id, tipo_evento, status_antes, status_depois, internacao_id, autor_id, motivo)
    VALUES (v_leito_origem, v_ep.unidade_id, 'liberacao', 'ocupado', 'higienizacao', p_internacao, v_perfil, 'Alta/óbito liberou leito');
  END IF;

  IF p_leito_destino IS NOT NULL AND p_leito_destino IS DISTINCT FROM v_leito_origem THEN
    UPDATE public.leitos SET status = 'ocupado' WHERE id = p_leito_destino;
    INSERT INTO public.eventos_leito
      (leito_id, unidade_id, tipo_evento, status_antes, status_depois, internacao_id, autor_id, motivo)
    VALUES (p_leito_destino, v_ep.unidade_id, 'ocupacao', 'livre', 'ocupado', p_internacao, v_perfil, 'Transferência de leito');
  END IF;
END; $function$;
