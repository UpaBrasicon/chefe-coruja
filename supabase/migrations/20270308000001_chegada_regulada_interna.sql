-- ════════════════════════════════════════════════════════════════════════════
-- Achado P1-1 do A01 (teste da rede, 06/11/2026): unidade sem porta não
-- recebia o paciente regulado; a chegada só mudava o status. Decisão do RT em
-- 07/11/2026: A em R1 a R6 (docs/teste-rede/CORRECOES-A01-DIAGNOSTICO.md).
--
-- Vale para regulação de leito ou transferência com destino na rede.
-- Consulta, exame e destino de fora da rede não mudam.
--
-- R1. "Paciente chegou" faz, numa operação: acha ou cria o cadastro no
--     destino, abre o episódio já em "internacao" e interna no leito, com
--     origem_admissao = 'outra_unidade'. A regulação fica ligada ao cadastro,
--     ao episódio e à internação do destino. Sem conta de porta: só a de
--     internação (o gatilho da conta do episódio pula o episódio da chegada).
-- R2. Cadastro: procura no destino pelo Cartão SUS ou pelo CPF; achou, usa.
--     Não achou, cria com a identificação da origem (nome, nome social,
--     nascimento, sexo, nome da mãe, CNS, CPF) e traz as alergias ativas da
--     origem, marcadas "informada pela origem, regulação nº X". Provável
--     duplicata (mesmo nome e nascimento, sem documento igual): para e pede a
--     escolha (CHEGADA_DUPLICATA_PROVAVEL:<id>), como registrar_ficha; a tela
--     responde com p_paciente_destino (usar o existente) ou p_cadastro_novo.
-- R3. Leito: o reservado pela regulação; sem reserva, ou com ela vencida,
--     quem marca a chegada escolhe um leito livre (p_leito).
-- R4. O leito reservado pela regulação é só do paciente dela: some de
--     leitos_para_ocupar para os outros e o gatilho da ocupação recusa outro
--     paciente, até a chegada, a falta, o cancelamento ou o vencimento.
-- R5. Marca a chegada quem marcava (médico e gestor do destino, NIR do
--     destino) e também o enfermeiro escalado no setor do leito. Autor = login.
-- R6. Vale também para unidade com porta.
--
-- A regra da origem (S1 a S6, 20270307000006) continua: com a origem ainda
-- aberta, a regulação fica em trânsito com a marca; o paciente fica com
-- internação ativa nas duas unidades até a alta por transferência na origem.
--
-- regulacao_marcar_chegada ganha três parâmetros com padrão (p_leito,
-- p_paciente_destino, p_cadastro_novo): a função é trocada (DROP + CREATE com
-- os mesmos três primeiros parâmetros e os grants de antes); a chamada de
-- hoje (p_id, p_chegou, p_observacao) continua valendo.
--
-- ROLLBACK (em homologação antes; as colunas podem ficar):
--   recriar public.regulacao_marcar_chegada(uuid, boolean, text) com o corpo
--   de 20270307000006 (o mesmo desta, sem o bloco "R1"); desfazer as trocas
--   marcadas "R4" em regulacao_destino_aceitar, private.reserva_na_ocupacao e
--   leitos_para_ocupar, e "R1" em private.trg_conta_do_episodio;
--   DROP FUNCTION private.regulacao_cadastro_destino, private.regulacao_internar_chegada.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.regulacao_solicitacoes ADD COLUMN IF NOT EXISTS destino_paciente_id uuid REFERENCES public.pacientes(id);
ALTER TABLE public.regulacao_solicitacoes ADD COLUMN IF NOT EXISTS destino_episodio_id uuid REFERENCES public.episodios(id);
ALTER TABLE public.regulacao_solicitacoes ADD COLUMN IF NOT EXISTS destino_internacao_id uuid REFERENCES public.internacoes(id);
ALTER TABLE public.reservas_leito ADD COLUMN IF NOT EXISTS regulacao_id uuid REFERENCES public.regulacao_solicitacoes(id);
ALTER TABLE public.episodios ADD COLUMN IF NOT EXISTS regulacao_id uuid REFERENCES public.regulacao_solicitacoes(id);
ALTER TABLE public.alergias_paciente ADD COLUMN IF NOT EXISTS fonte text;
COMMENT ON COLUMN public.regulacao_solicitacoes.destino_paciente_id IS 'Cadastro do paciente no destino, achado ou criado na chegada (R1/R2).';
COMMENT ON COLUMN public.reservas_leito.regulacao_id IS 'Reserva feita pelo aceite da regulação: o leito é só do paciente dela (R4).';
COMMENT ON COLUMN public.episodios.regulacao_id IS 'Episódio aberto pela chegada regulada (R1): nasce em internação, sem conta de porta.';
COMMENT ON COLUMN public.alergias_paciente.fonte IS 'De onde veio o registro, quando não foi a equipe da unidade (ex.: informada pela origem, regulação nº X).';
CREATE INDEX IF NOT EXISTS reservas_leito_regulacao ON public.reservas_leito (regulacao_id) WHERE regulacao_id IS NOT NULL;

-- ── R2: cadastro no destino ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.regulacao_cadastro_destino(s public.regulacao_solicitacoes, p_paciente_destino uuid, p_cadastro_novo boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  o public.pacientes; v_id uuid; v_dup uuid; a record; v_criado boolean := false;
  v_fonte text := 'Informada pela origem, regulação nº ' || s.numero;
BEGIN
  SELECT * INTO o FROM public.pacientes WHERE id = s.paciente_id;
  IF p_paciente_destino IS NOT NULL THEN
    SELECT id INTO v_id FROM public.pacientes WHERE id = p_paciente_destino AND unidade_id = s.destino_unidade_id AND ativo;
    IF v_id IS NULL THEN RAISE EXCEPTION 'O cadastro escolhido não é desta unidade.'; END IF;
  ELSE
    -- documentos: Cartão SUS ou CPF
    SELECT id INTO v_id FROM public.pacientes
     WHERE unidade_id = s.destino_unidade_id AND ativo
       AND ((nullif(o.cns, '') IS NOT NULL AND cns = o.cns) OR (nullif(o.cpf, '') IS NOT NULL AND cpf = o.cpf))
     ORDER BY created_at LIMIT 1;
    IF v_id IS NULL THEN
      IF NOT coalesce(p_cadastro_novo, false) AND o.data_nascimento IS NOT NULL THEN
        SELECT id INTO v_dup FROM public.pacientes
         WHERE unidade_id = s.destino_unidade_id AND ativo AND data_nascimento = o.data_nascimento
           AND private.nome_comparavel(nome) = private.nome_comparavel(o.nome)
         LIMIT 1;
        IF v_dup IS NOT NULL THEN
          RAISE EXCEPTION 'CHEGADA_DUPLICATA_PROVAVEL:% Já existe cadastro com o mesmo nome e nascimento nesta unidade.', v_dup;
        END IF;
      END IF;
      INSERT INTO public.pacientes (unidade_id, nome, nome_social, data_nascimento, data_nascimento_estimada, sexo, nome_mae, cns, cpf,
                                    prontuario, sem_documento)
      VALUES (s.destino_unidade_id, coalesce(nullif(btrim(o.nome), ''), 'Paciente da regulação nº ' || s.numero), o.nome_social,
              o.data_nascimento, o.data_nascimento_estimada, o.sexo, o.nome_mae, nullif(o.cns, ''), nullif(o.cpf, ''),
              private.gerar_prontuario(s.destino_unidade_id), o.sem_documento)
      RETURNING id INTO v_id;
      v_criado := true;
      PERFORM private.registrar_auditoria('criar', 'pacientes', v_id, s.destino_unidade_id,
        jsonb_build_object('origem', 'chegada_regulada', 'regulacao', s.numero));
    END IF;
  END IF;
  -- alergias ativas da origem que o destino ainda não tem
  IF o.id IS NOT NULL THEN
    FOR a IN SELECT * FROM public.alergias_paciente x
              WHERE x.paciente_id = o.id AND x.inativada_em IS NULL
                AND NOT EXISTS (SELECT 1 FROM public.alergias_paciente y
                                 WHERE y.paciente_id = v_id AND y.substancia_norm = x.substancia_norm AND y.inativada_em IS NULL) LOOP
      INSERT INTO public.alergias_paciente (unidade_id, paciente_id, substancia, substancia_norm, reacao, registrado_por, tipo, gravidade,
                                            medicamento_id, fonte)
      VALUES (s.destino_unidade_id, v_id, a.substancia, a.substancia_norm,
              btrim(coalesce(a.reacao || ' ', '') || '(' || lower(left(v_fonte, 1)) || substr(v_fonte, 2) || ')'),
              private.meu_perfil_id(), a.tipo, a.gravidade, a.medicamento_id, v_fonte);
    END LOOP;
  END IF;
  RETURN v_id;
END $$;

-- ── R1/R3: episódio e internação no destino ─────────────────────────────────
CREATE OR REPLACE FUNCTION private.regulacao_internar_chegada(s public.regulacao_solicitacoes, p_paciente uuid, p_leito uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_org uuid; v_setor uuid; v_status_leito public.status_leito; v_epi uuid; v_int uuid; v_estado jsonb;
  v_motivo text := 'Chegada regulada (regulação nº ' || s.numero || ')';
BEGIN
  SELECT organizacao_id INTO v_org FROM public.unidades WHERE id = s.destino_unidade_id;
  SELECT l.setor_id, l.status INTO v_setor, v_status_leito FROM public.leitos l JOIN public.setores st ON st.id = l.setor_id
   WHERE l.id = p_leito AND st.unidade_id = s.destino_unidade_id AND l.ativo AND st.ativo;
  IF v_setor IS NULL THEN RAISE EXCEPTION 'Leito não encontrado nesta unidade.'; END IF;
  IF EXISTS (SELECT 1 FROM public.internacoes WHERE paciente_id = p_paciente AND status IN ('admitido', 'em_observacao', 'internado')) THEN
    RAISE EXCEPTION 'O paciente já tem internação ativa nesta unidade.';
  END IF;
  -- o cadastro do destino antes da ocupação: o gatilho da reserva (R4) confere por ele
  UPDATE public.regulacao_solicitacoes SET destino_paciente_id = p_paciente WHERE id = s.id;
  INSERT INTO public.episodios (unidade_id, paciente_id, setor_id, queixa, aberto_por, etapa, chegada_em,
                                desfecho, desfecho_em, desfecho_por, desfecho_detalhes, regulacao_id)
  VALUES (s.destino_unidade_id, p_paciente, v_setor, v_motivo, v_perfil, 'internacao', now(),
          'internacao', now(), v_perfil, jsonb_build_object('regulacao_id', s.id, 'origem', 'chegada_regulada'), s.id)
  RETURNING id INTO v_epi;
  v_estado := jsonb_build_object('status', 'internado', 'setor', v_setor, 'leito', p_leito, 'tipo_internacao', 'urgencia',
                                 'origem', 'outra_unidade', 'episodio', v_epi, 'regulacao', s.numero);
  INSERT INTO public.internacoes (organizacao_id, unidade_id, paciente_id, episodio_id, tipo_internacao, origem_admissao,
                                  status, leito_atual_id, setor_atual_id, data_entrada_setor)
  VALUES (v_org, s.destino_unidade_id, p_paciente, v_epi, 'urgencia', 'outra_unidade', 'internado', p_leito, v_setor, now())
  RETURNING id INTO v_int;   -- o gatilho da reserva consome a reserva da regulação (R4)
  INSERT INTO public.eventos_adt (seq, organizacao_id, unidade_id, internacao_id, paciente_id, tipo_evento,
    estado_antes, estado_depois, setor_destino_id, leito_destino_id, autor_id, motivo, hash_previo, hash_conteudo)
  VALUES (1, v_org, s.destino_unidade_id, v_int, p_paciente, 'admissao', NULL, v_estado, v_setor, p_leito, v_perfil,
          v_motivo, NULL, private.hash_evento(1, 'admissao', v_estado, v_perfil, v_motivo, NULL));
  UPDATE public.leitos SET status = 'ocupado' WHERE id = p_leito;
  INSERT INTO public.eventos_leito (leito_id, unidade_id, tipo_evento, status_antes, status_depois, internacao_id, autor_id, motivo)
  VALUES (p_leito, s.destino_unidade_id, 'ocupacao', v_status_leito, 'ocupado', v_int, v_perfil, v_motivo);
  UPDATE public.pacientes SET setor_id = v_setor, updated_at = now() WHERE id = p_paciente;
  UPDATE public.regulacao_solicitacoes
     SET destino_paciente_id = p_paciente, destino_episodio_id = v_epi, destino_internacao_id = v_int
   WHERE id = s.id;
  PERFORM private.registrar_auditoria('chegada_regulada_internacao', 'internacoes', v_int, s.destino_unidade_id,
    jsonb_build_object('regulacao', s.numero, 'leito', p_leito, 'episodio', v_epi));
  RETURN v_int;
END $$;

REVOKE ALL ON FUNCTION private.regulacao_cadastro_destino(public.regulacao_solicitacoes, uuid, boolean),
                       private.regulacao_internar_chegada(public.regulacao_solicitacoes, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- ── R1/R3/R5: a chegada ─────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.regulacao_marcar_chegada(uuid, boolean, text);
CREATE FUNCTION public.regulacao_marcar_chegada(p_id uuid, p_chegou boolean, p_observacao text DEFAULT NULL::text,
  p_leito uuid DEFAULT NULL::uuid, p_paciente_destino uuid DEFAULT NULL::uuid, p_cadastro_novo boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  s public.regulacao_solicitacoes; v_obs text := nullif(btrim(coalesce(p_observacao, '')), '');
  v_interna boolean; v_leito uuid; v_setor uuid; v_pac uuid; r public.reservas_leito;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  -- R1: leito ou transferência da rede interna no destino
  v_interna := p_chegou AND s.destino_tipo = 'rede' AND private.regulacao_leva_paciente(s);
  IF v_interna THEN
    -- R3: o leito reservado; sem reserva (ou vencida), o leito escolhido
    SELECT * INTO r FROM public.reservas_leito WHERE id = s.reserva_id AND situacao = 'ativa' AND expira_em > now();
    v_leito := coalesce(r.leito_id, p_leito);
    SELECT l.setor_id INTO v_setor FROM public.leitos l WHERE l.id = v_leito;
  END IF;
  -- R5: quem confirmava, e o enfermeiro escalado no setor do leito
  IF NOT ((s.destino_tipo = 'rede' AND (private.regulacao_sou_destino(s) OR private.sou_nir(s.destino_unidade_id)
            OR (v_setor IS NOT NULL AND private.tenho_papel(s.destino_unidade_id, 'enfermeiro') IS TRUE
                AND v_setor IN (SELECT private.setores_na_escala_agora()))))
          OR (s.destino_tipo = 'externo' AND private.tenho_papel(s.central_id, 'regulador'))) THEN
    RAISE EXCEPTION 'Marca a chegada a unidade destino (ou a central, se o destino é de fora da rede).' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF s.status NOT IN ('autorizada', 'agendada', 'em_transito') THEN RAISE EXCEPTION 'Este pedido não está esperando a chegada do paciente.'; END IF;
  IF s.chegada_em IS NOT NULL THEN RAISE EXCEPTION 'A chegada deste paciente já foi registrada.'; END IF;
  IF NOT p_chegou AND length(coalesce(v_obs, '')) < 10 THEN RAISE EXCEPTION 'Escreva o que aconteceu (mínimo de 10 letras).'; END IF;
  IF p_chegou THEN
    -- R1 (chegada regulada interna): cadastro, episódio e internação no destino
    IF v_interna THEN
      IF v_leito IS NULL THEN RAISE EXCEPTION 'Sem leito reservado: escolha um leito livre do setor.'; END IF;
      IF r.id IS NULL AND NOT EXISTS (
           SELECT 1 FROM public.leitos l LEFT JOIN public.reservas_leito rv ON rv.leito_id = l.id AND rv.situacao = 'ativa'
            WHERE l.id = v_leito AND l.ativo
              AND (l.status = 'livre' OR (l.status = 'reservado' AND (rv.expira_em <= now() OR rv.regulacao_id = s.id)))) THEN
        RAISE EXCEPTION 'O leito escolhido não está livre.';
      END IF;
      v_pac := private.regulacao_cadastro_destino(s, p_paciente_destino, p_cadastro_novo);
      PERFORM private.regulacao_internar_chegada(s, v_pac, v_leito);
      SELECT * INTO s FROM public.regulacao_solicitacoes WHERE id = s.id;
    END IF;
    -- fim R1
    -- S1/S2 (origem encerrada): realizada só com a origem encerrada
    IF private.regulacao_leva_paciente(s) AND NOT private.regulacao_origem_encerrada(s) THEN
      UPDATE public.regulacao_solicitacoes SET status = 'em_transito', chegada_em = now(), chegada_por = private.meu_perfil_id(),
             chegada_observacao = v_obs WHERE id = s.id RETURNING * INTO s;
      PERFORM private.regulacao_estender_reserva(s, 8);   -- pronta para ocupar o leito
      PERFORM private.regulacao_evento(s.id, 'chegou', jsonb_build_object('observacao', v_obs, 'origem_aberta', true,
        'internacao_destino', s.destino_internacao_id));
      PERFORM private.regulacao_avisar(s, 'reg_chegou_origem_aberta', 'Regulação nº ' || s.numero
        || ': o paciente chegou ao destino e segue sem alta por transferência na origem. Dê a alta por transferência.');
    ELSE
      UPDATE public.regulacao_solicitacoes SET status = 'realizada', realizada_em = now(), chegada_em = now(),
             origem_encerrada_em = CASE WHEN private.regulacao_leva_paciente(s) THEN coalesce(origem_encerrada_em, now()) END,
             chegada_por = private.meu_perfil_id(), chegada_observacao = v_obs WHERE id = s.id RETURNING * INTO s;
      PERFORM private.regulacao_estender_reserva(s, 8);   -- pronta para ocupar o leito
      PERFORM private.regulacao_evento(s.id, 'chegou', jsonb_build_object('observacao', v_obs, 'internacao_destino', s.destino_internacao_id));
    END IF;
    -- fim S1/S2
  ELSE
    UPDATE public.regulacao_solicitacoes SET status = 'falta', falta_em = now(), chegada_por = private.meu_perfil_id(),
           chegada_observacao = v_obs WHERE id = s.id RETURNING * INTO s;
    PERFORM private.regulacao_liberar_reserva(s, 'Regulação nº ' || s.numero || ': paciente não chegou');
    PERFORM private.regulacao_evento(s.id, 'nao_chegou', jsonb_build_object('observacao', v_obs));
    PERFORM private.regulacao_avisar(s, 'reg_nao_chegou', 'Regulação nº ' || s.numero || ': o destino registrou que o paciente não chegou — ' || v_obs);
  END IF;
  PERFORM private.registrar_auditoria('regulacao_chegada', 'regulacao_solicitacoes', s.id, coalesce(s.destino_unidade_id, s.central_id),
    jsonb_build_object('status', s.status, 'internacao_destino', s.destino_internacao_id));
  RETURN private.regulacao_json(s);
END $function$;
REVOKE ALL ON FUNCTION public.regulacao_marcar_chegada(uuid, boolean, text, uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regulacao_marcar_chegada(uuid, boolean, text, uuid, uuid, boolean) TO authenticated, service_role;

-- ── trocas de texto ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION pg_temp.trocar_uma_vez(p_fn regprocedure, p_antigo text, p_novo text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text; v_antigo text := replace(p_antigo, E'\r', ''); v_novo text := replace(p_novo, E'\r', '');
BEGIN
  -- sem \r: o corpo gravado e este arquivo podem ter fim de linha do Windows
  def := replace(pg_get_functiondef(p_fn), E'\r', '');
  IF position(v_novo IN def) > 0 THEN RETURN; END IF;
  IF position(v_antigo IN def) = 0 THEN RAISE EXCEPTION '% mudou: trecho "%" não encontrado', p_fn, v_antigo; END IF;
  EXECUTE replace(def, v_antigo, v_novo);
END $$;

-- R4: o aceite marca a reserva com a regulação
SELECT pg_temp.trocar_uma_vez('public.regulacao_destino_aceitar(uuid, uuid, text)'::regprocedure,
  $old$    INSERT INTO public.reservas_leito (leito_id, unidade_id, paciente_id, motivo, reservado_por, expira_em)
    VALUES (p_leito, s.destino_unidade_id, NULL,$old$,
  $new$    INSERT INTO public.reservas_leito (regulacao_id, leito_id, unidade_id, paciente_id, motivo, reservado_por, expira_em)
    VALUES (s.id, p_leito, s.destino_unidade_id, NULL,$new$);

-- R4: só o paciente da regulação ocupa o leito reservado por ela
SELECT pg_temp.trocar_uma_vez('private.reserva_na_ocupacao()'::regprocedure,
  $old$  IF r.expira_em > now() AND r.paciente_id IS NOT NULL AND r.paciente_id <> NEW.paciente_id THEN$old$,
  $new$  IF r.expira_em > now() AND ((r.paciente_id IS NOT NULL AND r.paciente_id <> NEW.paciente_id)
     -- R4 (chegada regulada): a reserva da regulação é do paciente dela
     OR (r.regulacao_id IS NOT NULL AND NEW.paciente_id IS DISTINCT FROM
           (SELECT x.destino_paciente_id FROM public.regulacao_solicitacoes x WHERE x.id = r.regulacao_id))) THEN$new$);

-- R4: o leito reservado pela regulação não aparece para outro paciente
SELECT pg_temp.trocar_uma_vez('public.leitos_para_ocupar(uuid, uuid)'::regprocedure,
  $old$          OR (l.status = 'reservado' AND (rv.paciente_id IS NULL OR rv.paciente_id = p_paciente OR rv.expira_em <= now())))$old$,
  $new$          OR (l.status = 'reservado' AND (rv.expira_em <= now()
                OR (rv.regulacao_id IS NULL AND (rv.paciente_id IS NULL OR rv.paciente_id = p_paciente))
                -- R4 (chegada regulada): a reserva da regulação só para o paciente dela
                OR (rv.regulacao_id IS NOT NULL AND p_paciente IS NOT NULL AND p_paciente =
                      (SELECT x.destino_paciente_id FROM public.regulacao_solicitacoes x WHERE x.id = rv.regulacao_id)))))$new$);

-- R3: o NIR do destino, que marca a chegada, também vê os leitos livres para escolher
SELECT pg_temp.trocar_uma_vez('public.regulacao_leitos_destino(uuid)'::regprocedure,
  $old$  IF NOT FOUND OR NOT private.regulacao_sou_destino(s) THEN$old$,
  $new$  IF NOT FOUND OR NOT (private.regulacao_sou_destino(s) OR private.sou_nir(s.destino_unidade_id)) THEN$new$);

-- R1: o episódio da chegada regulada não abre conta de porta
SELECT pg_temp.trocar_uma_vez('private.trg_conta_do_episodio()'::regprocedure,
  $old$  IF NOT EXISTS (SELECT 1 FROM public.contas WHERE episodio_id = NEW.id AND tipo = 'ambulatorial') THEN$old$,
  $new$  -- R1 (chegada regulada): sem conta de porta; só a de internação
  IF NEW.regulacao_id IS NULL AND NOT EXISTS (SELECT 1 FROM public.contas WHERE episodio_id = NEW.id AND tipo = 'ambulatorial') THEN$new$);

-- reservas já ativas de regulação: passam a ter a marca (mesma regra para as abertas)
UPDATE public.reservas_leito r SET regulacao_id = s.id
  FROM public.regulacao_solicitacoes s
 WHERE s.reserva_id = r.id AND r.regulacao_id IS NULL AND r.situacao = 'ativa';
