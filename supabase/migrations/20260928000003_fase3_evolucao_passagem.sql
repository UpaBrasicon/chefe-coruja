-- Fase 3.4 e 3.5 — admissão e evolução com correção só do autor; passagem de
-- plantão paciente a paciente com aceite, bloqueando o check-out.

-- ── admissão e evolução ─────────────────────────────────────────────────────
-- Cada evolução é um documento próprio (não uma versão da anterior). A
-- admissão é uma por internação. Corrigir = nova versão do MESMO documento,
-- só pelo autor, com justificativa; a versão anterior fica como retificada.
CREATE OR REPLACE FUNCTION public.registrar_evolucao(p_internacao uuid, p_tipo text, p_conteudo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  i public.internacoes;
  v_perfil uuid := private.meu_perfil_id();
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN RAISE EXCEPTION 'Internação encerrada.'; END IF;
  IF NOT private.cuido_da_internacao(i) THEN RAISE EXCEPTION 'Acesso negado: você não está de plantão no setor deste paciente.'; END IF;
  IF p_tipo NOT IN ('admissao_anamnese', 'evolucao') THEN RAISE EXCEPTION 'Tipo desconhecido.'; END IF;
  IF length(btrim(coalesce(p_conteudo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o registro.'; END IF;
  IF p_tipo = 'admissao_anamnese' AND EXISTS (
       SELECT 1 FROM public.documentos_clinicos WHERE internacao_id = i.id AND tipo_documento = 'admissao_anamnese') THEN
    RAISE EXCEPTION 'A admissão desta internação já foi registrada. Para mudar, corrija a admissão.';
  END IF;
  v_id := gen_random_uuid();
  INSERT INTO public.documentos_clinicos (id, documento_raiz_id, versao, organizacao_id, unidade_id, paciente_id, internacao_id,
    episodio_id, tipo_documento, conteudo, conteudo_hash, autor_id, estado)
  VALUES (v_id, v_id, 1, i.organizacao_id, i.unidade_id, i.paciente_id, i.id, i.episodio_id, p_tipo, p_conteudo,
          encode(sha256(convert_to(p_conteudo, 'UTF8')), 'hex'), v_perfil, 'ativo');
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.corrigir_evolucao(p_documento uuid, p_conteudo text, p_justificativa text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  d public.documentos_clinicos;
  v_autor uuid;
  v_perfil uuid := private.meu_perfil_id();
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO d FROM public.documentos_clinicos WHERE id = p_documento FOR UPDATE;
  IF NOT FOUND OR d.tipo_documento NOT IN ('admissao_anamnese', 'evolucao') THEN RAISE EXCEPTION 'Registro não encontrado.'; END IF;
  IF d.estado <> 'ativo' THEN RAISE EXCEPTION 'Corrija a versão mais recente.'; END IF;
  SELECT autor_id INTO v_autor FROM public.documentos_clinicos WHERE documento_raiz_id = d.documento_raiz_id AND versao = 1;
  IF v_autor IS DISTINCT FROM v_perfil THEN
    RAISE EXCEPTION 'Só o autor corrige o próprio registro. Registre uma nova evolução.';
  END IF;
  IF length(btrim(coalesce(p_justificativa, ''))) < 10 THEN RAISE EXCEPTION 'Justifique a correção (mínimo de 10 letras).'; END IF;
  IF length(btrim(coalesce(p_conteudo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o registro.'; END IF;
  IF encode(sha256(convert_to(p_conteudo, 'UTF8')), 'hex') = d.conteudo_hash THEN RAISE EXCEPTION 'Nada mudou no texto.'; END IF;
  INSERT INTO public.documentos_clinicos (documento_raiz_id, versao, organizacao_id, unidade_id, paciente_id, internacao_id,
    episodio_id, tipo_documento, conteudo, conteudo_hash, autor_id, estado, retificacao_de, motivo_retificacao)
  VALUES (d.documento_raiz_id, d.versao + 1, d.organizacao_id, d.unidade_id, d.paciente_id, d.internacao_id, d.episodio_id,
          d.tipo_documento, p_conteudo, encode(sha256(convert_to(p_conteudo, 'UTF8')), 'hex'), v_perfil, 'ativo',
          d.id, btrim(p_justificativa))
  RETURNING id INTO v_id;
  UPDATE public.documentos_clinicos SET estado = 'retificado', updated_at = now() WHERE id = d.id;
  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.registrar_evolucao(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.corrigir_evolucao(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_evolucao(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.corrigir_evolucao(uuid, text, text) TO authenticated;

-- ── passagem de plantão ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.passagens_plantao (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id     uuid NOT NULL REFERENCES public.unidades(id),
  setor_id       uuid NOT NULL REFERENCES public.setores(id),
  internacao_id  uuid NOT NULL REFERENCES public.internacoes(id),
  paciente_id    uuid NOT NULL REFERENCES public.pacientes(id),
  de_perfil      uuid NOT NULL REFERENCES public.perfis(id),
  para_perfil    uuid NOT NULL REFERENCES public.perfis(id),
  resumo         text NOT NULL,
  situacao       text NOT NULL DEFAULT 'aguardando' CHECK (situacao IN ('aguardando', 'aceita', 'recusada', 'retirada')),
  enviada_em     timestamptz NOT NULL DEFAULT now(),
  respondida_em  timestamptz,
  motivo_recusa  text
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_passagem_aguardando ON public.passagens_plantao (internacao_id) WHERE situacao = 'aguardando';
CREATE INDEX IF NOT EXISTS passagens_de ON public.passagens_plantao (de_perfil, situacao);
CREATE INDEX IF NOT EXISTS passagens_para ON public.passagens_plantao (para_perfil, situacao);

ALTER TABLE public.passagens_plantao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS passagens_select ON public.passagens_plantao;
CREATE POLICY passagens_select ON public.passagens_plantao FOR SELECT TO authenticated
  USING (de_perfil = private.meu_perfil_id() OR para_perfil = private.meu_perfil_id()
         OR private.papel_na_unidade(unidade_id) = 'gestor');
DROP POLICY IF EXISTS passagens_segundo_fator ON public.passagens_plantao;
CREATE POLICY passagens_segundo_fator ON public.passagens_plantao AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok());
REVOKE INSERT, UPDATE, DELETE ON public.passagens_plantao FROM anon, authenticated;
GRANT SELECT ON public.passagens_plantao TO authenticated;

-- Quem pode receber: vínculo ativo na unidade e escala no mesmo setor em curso
-- ou começando nas próximas 12 horas.
CREATE OR REPLACE FUNCTION public.colegas_para_passagem(p_internacao uuid)
RETURNS TABLE (perfil_id uuid, nome text, inicio timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.internacoes;
BEGIN
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND OR NOT private.cuido_da_internacao(i) THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  RETURN QUERY
  SELECT DISTINCT ON (e.perfil_id) e.perfil_id, p.nome_completo, e.inicio
  FROM public.escala_plantao e
  JOIN public.perfis p ON p.id = e.perfil_id
  WHERE e.setor_id = i.setor_atual_id AND e.ativo AND e.perfil_id <> private.meu_perfil_id()
    AND e.inicio + make_interval(mins => e.duracao_min) > now()
    AND e.inicio < now() + interval '12 hours'
    AND EXISTS (SELECT 1 FROM public.vinculos v WHERE v.perfil_id = e.perfil_id AND v.unidade_id = i.unidade_id AND v.ativo)
  ORDER BY e.perfil_id, e.inicio;
END $$;

CREATE OR REPLACE FUNCTION public.enviar_passagem(p_internacao uuid, p_para uuid, p_resumo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE i public.internacoes; v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO i FROM public.internacoes WHERE id = p_internacao;
  IF NOT FOUND THEN RAISE EXCEPTION 'Internação não encontrada.'; END IF;
  IF i.status NOT IN ('admitido', 'em_observacao', 'internado') THEN RAISE EXCEPTION 'Internação encerrada.'; END IF;
  IF NOT private.cuido_da_internacao(i) THEN RAISE EXCEPTION 'Acesso negado: você não está de plantão no setor deste paciente.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.colegas_para_passagem(p_internacao) c WHERE c.perfil_id = p_para) THEN
    RAISE EXCEPTION 'O colega escolhido não está na escala deste setor agora nem nas próximas 12 horas.';
  END IF;
  IF length(btrim(coalesce(p_resumo, ''))) < 15 THEN RAISE EXCEPTION 'Escreva o resumo da passagem (mínimo de 15 letras).'; END IF;
  IF EXISTS (SELECT 1 FROM public.passagens_plantao WHERE internacao_id = i.id AND situacao = 'aguardando') THEN
    RAISE EXCEPTION 'Já existe passagem aguardando aceite para este paciente. Retire-a para reenviar.';
  END IF;
  INSERT INTO public.passagens_plantao (unidade_id, setor_id, internacao_id, paciente_id, de_perfil, para_perfil, resumo)
  VALUES (i.unidade_id, i.setor_atual_id, i.id, i.paciente_id, private.meu_perfil_id(), p_para, btrim(p_resumo))
  RETURNING id INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.responder_passagem(p_passagem uuid, p_aceitar boolean, p_motivo text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pp public.passagens_plantao;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pp FROM public.passagens_plantao WHERE id = p_passagem FOR UPDATE;
  IF NOT FOUND OR pp.para_perfil IS DISTINCT FROM private.meu_perfil_id() THEN RAISE EXCEPTION 'Passagem não encontrada.'; END IF;
  IF pp.situacao <> 'aguardando' THEN RAISE EXCEPTION 'Esta passagem já foi respondida ou retirada.'; END IF;
  IF NOT p_aceitar AND length(btrim(coalesce(p_motivo, ''))) < 15 THEN
    RAISE EXCEPTION 'Diga por que recusa (mínimo de 15 letras).';
  END IF;
  UPDATE public.passagens_plantao
     SET situacao = CASE WHEN p_aceitar THEN 'aceita' ELSE 'recusada' END,
         respondida_em = now(), motivo_recusa = CASE WHEN p_aceitar THEN NULL ELSE btrim(p_motivo) END
   WHERE id = pp.id;
END $$;

CREATE OR REPLACE FUNCTION public.retirar_passagem(p_passagem uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pp public.passagens_plantao;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO pp FROM public.passagens_plantao WHERE id = p_passagem FOR UPDATE;
  IF NOT FOUND OR pp.de_perfil IS DISTINCT FROM private.meu_perfil_id() THEN RAISE EXCEPTION 'Passagem não encontrada.'; END IF;
  IF pp.situacao <> 'aguardando' THEN RAISE EXCEPTION 'Só se retira passagem que ainda aguarda aceite.'; END IF;
  UPDATE public.passagens_plantao SET situacao = 'retirada', respondida_em = now() WHERE id = pp.id;
END $$;

REVOKE ALL ON FUNCTION public.colegas_para_passagem(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.enviar_passagem(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.responder_passagem(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.retirar_passagem(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.colegas_para_passagem(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enviar_passagem(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.responder_passagem(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.retirar_passagem(uuid) TO authenticated;

-- ── check-out bloqueado com passagem aguardando aceite ──────────────────────
CREATE OR REPLACE FUNCTION public.registrar_checkout(p_registro uuid, p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_unidade public.unidades%ROWTYPE;
  v_reg public.presenca_plantonista%ROWTYPE;
  v_dentro boolean;
  v_pendentes int;
BEGIN
  SELECT * INTO v_reg FROM public.presenca_plantonista WHERE id = p_registro;
  IF v_reg.id IS NULL THEN RAISE EXCEPTION 'Registro de presença não encontrado'; END IF;
  IF v_reg.perfil_id IS DISTINCT FROM v_perfil THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF v_reg.checkout_em IS NOT NULL THEN RAISE EXCEPTION 'Check-out já realizado'; END IF;
  SELECT count(*) INTO v_pendentes FROM public.passagens_plantao WHERE de_perfil = v_perfil AND situacao = 'aguardando';
  IF v_pendentes > 0 THEN
    RAISE EXCEPTION 'Check-out bloqueado: % passagem(ns) de plantão aguardando aceite. Aguarde o aceite ou retire a passagem.', v_pendentes;
  END IF;

  SELECT * INTO v_unidade FROM public.unidades WHERE id = v_reg.unidade_id;
  IF v_unidade.latitude IS NOT NULL AND v_unidade.longitude IS NOT NULL AND p_lat IS NOT NULL AND p_lng IS NOT NULL THEN
    v_dentro := private.distancia_km(v_unidade.latitude, v_unidade.longitude, p_lat, p_lng) <= (v_unidade.raio_metros / 1000.0);
  END IF;

  UPDATE public.presenca_plantonista
    SET checkout_em = now(), checkout_lat = p_lat, checkout_lng = p_lng, checkout_dentro = v_dentro
    WHERE id = p_registro;
END; $$;
REVOKE EXECUTE ON FUNCTION public.registrar_checkout(uuid, double precision, double precision) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.registrar_checkout(uuid, double precision, double precision) TO authenticated;

-- O check-out automático também espera: quem tem passagem aguardando aceite
-- segue responsável pelo paciente até o aceite ou a retirada.
CREATE OR REPLACE FUNCTION private.fechar_presencas_vencidas()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n integer;
BEGIN
  UPDATE public.presenca_plantonista p
  SET checkout_em = e.inicio + make_interval(mins => e.duracao_min),
      checkout_automatico = true,
      updated_at = now()
  FROM public.escala_plantao e
  WHERE p.escala_plantao_id = e.id
    AND p.checkin_em IS NOT NULL
    AND p.checkout_em IS NULL
    AND now() >= e.inicio + make_interval(mins => e.duracao_min)
    AND NOT EXISTS (SELECT 1 FROM public.passagens_plantao pp WHERE pp.de_perfil = p.perfil_id AND pp.situacao = 'aguardando');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END; $$;
