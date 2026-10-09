-- Fase 1, tarefa 12 do BACKLOG.md — modo de contingência (papel) e reentrada.
--
-- Decisões do RT (08/10/2026), no plano produto/docs/contingencia/:
--   • a contingência em papel é acionada com 15 min sem conseguir registrar o
--     que o modo sem internet não cobre; quem aciona e encerra é o
--     COORDENADOR do plantão (médico ou enfermeiro), que avisa o gestor;
--   • na volta, as folhas são ANEXADAS ao prontuário (anexos já existentes) e
--     só o ESSENCIAL é digitado (classificação, prescrição vigente, desfecho),
--     com a marca "reentrada de contingência".
-- Aqui: o registro do PERÍODO de contingência da unidade (feito depois que o
-- sistema volta) e a MARCA de reentrada no atendimento — quem marcou, quando e
-- a descrição do que veio do papel. Os dois só por RPC e só inserção (a trilha
-- não se edita); tudo na auditoria.
-- Só aditiva.
--
-- ROLLBACK: DROP FUNCTION das RPCs abaixo; DROP TABLE public.reentradas_contingencia,
--   public.contingencias.

CREATE TABLE IF NOT EXISTS public.contingencias (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id),
  inicio        timestamptz NOT NULL,
  fim           timestamptz NOT NULL,
  motivo        text NOT NULL CHECK (length(btrim(motivo)) >= 10),
  registrado_por uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (fim > inicio)
);
CREATE INDEX IF NOT EXISTS contingencias_unidade ON public.contingencias (unidade_id, inicio DESC);

CREATE TABLE IF NOT EXISTS public.reentradas_contingencia (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contingencia_id uuid NOT NULL REFERENCES public.contingencias(id),
  unidade_id      uuid NOT NULL REFERENCES public.unidades(id),
  episodio_id     uuid NOT NULL REFERENCES public.episodios(id),
  paciente_id     uuid NOT NULL REFERENCES public.pacientes(id),
  descricao       text NOT NULL CHECK (length(btrim(descricao)) >= 10),
  registrado_por  uuid NOT NULL REFERENCES public.perfis(id),
  registrado_em   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reentradas_contingencia_episodio ON public.reentradas_contingencia (episodio_id);

ALTER TABLE public.contingencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reentradas_contingencia ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.contingencias, public.reentradas_contingencia FROM authenticated, anon;
DROP POLICY IF EXISTS contingencias_select ON public.contingencias;
CREATE POLICY contingencias_select ON public.contingencias FOR SELECT TO authenticated
  USING (private.membro_da_unidade(unidade_id));
DROP POLICY IF EXISTS reentradas_contingencia_select ON public.reentradas_contingencia;
CREATE POLICY reentradas_contingencia_select ON public.reentradas_contingencia FOR SELECT TO authenticated
  USING (private.gestor_da_unidade(unidade_id) OR private.pode_atuar_no_paciente(paciente_id)
         OR private.acesso_encerrado_vigente(paciente_id));

-- só inserção: a trilha da contingência não se edita nem se apaga
CREATE OR REPLACE FUNCTION private.contingencia_so_insercao() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  RAISE EXCEPTION 'Registro de contingência não se altera nem se apaga.';
END $$;
DROP TRIGGER IF EXISTS contingencias_so_insercao ON public.contingencias;
CREATE TRIGGER contingencias_so_insercao BEFORE UPDATE OR DELETE ON public.contingencias
  FOR EACH ROW EXECUTE FUNCTION private.contingencia_so_insercao();
DROP TRIGGER IF EXISTS reentradas_so_insercao ON public.reentradas_contingencia;
CREATE TRIGGER reentradas_so_insercao BEFORE UPDATE OR DELETE ON public.reentradas_contingencia
  FOR EACH ROW EXECUTE FUNCTION private.contingencia_so_insercao();

-- quem registra o período: o coordenador (médico ou enfermeiro de plantão na unidade) ou o gestor
CREATE OR REPLACE FUNCTION public.registrar_contingencia(p_unidade uuid, p_inicio timestamptz, p_fim timestamptz, p_motivo text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT (private.gestor_da_unidade(p_unidade) OR (
            private.na_escala_agora(p_unidade) AND EXISTS (
              SELECT 1 FROM public.vinculos v
               WHERE v.perfil_id = private.meu_perfil_id() AND v.unidade_id = p_unidade AND v.ativo
                 AND v.papel IN ('plantonista', 'enfermeiro')))) THEN
    RAISE EXCEPTION 'Só o coordenador de plantão (médico ou enfermeiro na escala) ou o gestor registra a contingência.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim <= p_inicio THEN RAISE EXCEPTION 'O fim precisa ser depois do início.'; END IF;
  IF p_fim > now() + interval '5 minutes' THEN RAISE EXCEPTION 'Registre a contingência depois que ela terminou (fim no passado).'; END IF;
  IF p_inicio < now() - interval '7 days' THEN RAISE EXCEPTION 'Contingência com mais de 7 dias: registre com o gestor.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Descreva o motivo (mínimo de 10 letras).'; END IF;
  IF EXISTS (SELECT 1 FROM public.contingencias c WHERE c.unidade_id = p_unidade
              AND tstzrange(c.inicio, c.fim) && tstzrange(p_inicio, p_fim)) THEN
    RAISE EXCEPTION 'Já existe contingência registrada neste período.';
  END IF;
  INSERT INTO public.contingencias (unidade_id, inicio, fim, motivo, registrado_por)
  VALUES (p_unidade, p_inicio, p_fim, btrim(p_motivo), private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('registrar_contingencia', 'contingencias', v_id, p_unidade,
    jsonb_build_object('inicio', p_inicio, 'fim', p_fim));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.registrar_contingencia(uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_contingencia(uuid, timestamptz, timestamptz, text) TO authenticated;

-- marca de reentrada: quem pode atuar no paciente (ou o gestor), em contingência da mesma unidade
CREATE OR REPLACE FUNCTION public.marcar_reentrada_contingencia(p_episodio uuid, p_contingencia uuid, p_descricao text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.episodios;
  c public.contingencias;
  v_id uuid;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio;
  SELECT * INTO c FROM public.contingencias WHERE id = p_contingencia;
  IF e.id IS NULL OR c.id IS NULL OR c.unidade_id <> e.unidade_id THEN
    RAISE EXCEPTION 'Atendimento e contingência precisam ser da mesma unidade.';
  END IF;
  IF NOT (private.gestor_da_unidade(e.unidade_id) OR private.pode_atuar_no_paciente(e.paciente_id)) THEN
    RAISE EXCEPTION 'Acesso negado: paciente fora do seu plantão.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF e.chegada_em > c.fim + interval '30 minutes' THEN
    RAISE EXCEPTION 'Este atendimento começou depois da contingência: não há registro em papel dela.';
  END IF;
  IF length(btrim(coalesce(p_descricao, ''))) < 10 THEN
    RAISE EXCEPTION 'Descreva o que veio do papel (mínimo de 10 letras), com a hora real.';
  END IF;
  INSERT INTO public.reentradas_contingencia (contingencia_id, unidade_id, episodio_id, paciente_id, descricao, registrado_por)
  VALUES (c.id, e.unidade_id, e.id, e.paciente_id, btrim(p_descricao), private.meu_perfil_id())
  RETURNING id INTO v_id;
  PERFORM private.registrar_auditoria('marcar_reentrada_contingencia', 'episodios', e.id, e.unidade_id,
    jsonb_build_object('contingencia', c.id));
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.marcar_reentrada_contingencia(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_reentrada_contingencia(uuid, uuid, text) TO authenticated;

-- listas
CREATE OR REPLACE FUNCTION public.contingencias_da_unidade(p_unidade uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF private.membro_da_unidade(p_unidade) IS NOT TRUE THEN RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege'; END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', c.id, 'inicio', c.inicio, 'fim', c.fim, 'motivo', c.motivo,
             'registrado_por', p.nome_completo, 'registrado_em', c.registrado_em,
             'reentradas', (SELECT count(*) FROM public.reentradas_contingencia r WHERE r.contingencia_id = c.id),
             'atendimentos_no_periodo', (SELECT count(*) FROM public.episodios e
                                          WHERE e.unidade_id = c.unidade_id AND e.chegada_em <= c.fim
                                            AND coalesce(e.encerrado_em, now()) >= c.inicio))
             ORDER BY c.inicio DESC)
      FROM public.contingencias c LEFT JOIN public.perfis p ON p.id = c.registrado_por
     WHERE c.unidade_id = p_unidade
     LIMIT 100), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.contingencias_da_unidade(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contingencias_da_unidade(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.reentradas_do_episodio(p_episodio uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.episodios;
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio;
  IF e.id IS NULL OR NOT (private.gestor_da_unidade(e.unidade_id) OR private.pode_atuar_no_paciente(e.paciente_id)
                          OR private.acesso_encerrado_vigente(e.paciente_id)) THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
             'id', r.id, 'descricao', r.descricao, 'registrado_em', r.registrado_em, 'registrado_por', p.nome_completo,
             'inicio', c.inicio, 'fim', c.fim) ORDER BY r.registrado_em)
      FROM public.reentradas_contingencia r
      JOIN public.contingencias c ON c.id = r.contingencia_id
      LEFT JOIN public.perfis p ON p.id = r.registrado_por
     WHERE r.episodio_id = p_episodio), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.reentradas_do_episodio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reentradas_do_episodio(uuid) TO authenticated;
