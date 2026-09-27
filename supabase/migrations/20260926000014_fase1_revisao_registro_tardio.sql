-- ════════════════════════════════════════════════════════════════════════════
-- Fase 1 — registro sem conexão que chega tarde (fecha o "em aberto" do
-- ADR 0009; decisão do produto em 26/09/2026).
--
-- Até 24 h entre o fato e a chegada: entra no prontuário, marcado "sem
-- conexão" (como já era). Depois disso NÃO entra sozinho: passa pelas
-- mesmas conferências e vai para a revisão do gestor da unidade, que aceita
-- ou descarta, sempre com motivo. Nada se perde; a decisão é única e fica
-- com autor e hora.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION private.limite_chegada_direta() RETURNS interval
LANGUAGE sql IMMUTABLE AS $$ SELECT interval '24 hours' $$;

CREATE TABLE IF NOT EXISTS public.sincronizacao_revisao (
  id            uuid PRIMARY KEY,           -- o id gerado no aparelho
  unidade_id    uuid NOT NULL REFERENCES public.unidades(id) ON DELETE CASCADE,
  paciente_id   uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  autor_id      uuid NOT NULL REFERENCES public.perfis(id),
  tipo          text NOT NULL,
  hora_fato     timestamptz NOT NULL,
  aparelho_id   text,
  dados         jsonb NOT NULL,
  recebido_em   timestamptz NOT NULL DEFAULT now(),
  decisao       text CHECK (decisao IN ('aceito', 'descartado')),
  decidido_por  uuid REFERENCES public.perfis(id),
  decidido_em   timestamptz,
  motivo        text,
  CHECK ((decisao IS NULL) = (decidido_por IS NULL) AND (decisao IS NULL) = (decidido_em IS NULL)),
  CHECK (decisao IS NULL OR length(btrim(motivo)) >= 5)
);
CREATE INDEX IF NOT EXISTS sincronizacao_revisao_pendente
  ON public.sincronizacao_revisao (unidade_id, recebido_em) WHERE decisao IS NULL;

ALTER TABLE public.sincronizacao_revisao ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sincronizacao_revisao FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.sincronizacao_revisao FROM authenticated;

DROP POLICY IF EXISTS sincronizacao_revisao_select ON public.sincronizacao_revisao;
CREATE POLICY sincronizacao_revisao_select ON public.sincronizacao_revisao FOR SELECT TO authenticated
USING (
  private.eh_super_admin()
  OR private.papel_na_unidade(unidade_id) = 'gestor'
  OR autor_id = private.meu_perfil_id()
);
DROP POLICY IF EXISTS sincronizacao_revisao_segundo_fator ON public.sincronizacao_revisao;
CREATE POLICY sincronizacao_revisao_segundo_fator ON public.sincronizacao_revisao
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (private.segundo_fator_ok()) WITH CHECK (private.segundo_fator_ok());

-- Decisão é única: depois de decidida, a linha não muda mais.
CREATE OR REPLACE FUNCTION private.revisao_decisao_unica()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Revisão não se apaga.'; END IF;
  IF OLD.decisao IS NOT NULL THEN RAISE EXCEPTION 'Revisão já decidida.'; END IF;
  IF (NEW.id, NEW.unidade_id, NEW.paciente_id, NEW.autor_id, NEW.tipo, NEW.hora_fato, NEW.dados, NEW.recebido_em)
     IS DISTINCT FROM
     (OLD.id, OLD.unidade_id, OLD.paciente_id, OLD.autor_id, OLD.tipo, OLD.hora_fato, OLD.dados, OLD.recebido_em) THEN
    RAISE EXCEPTION 'Só a decisão pode ser registrada na revisão.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_revisao_decisao_unica ON public.sincronizacao_revisao;
CREATE TRIGGER trg_revisao_decisao_unica BEFORE UPDATE OR DELETE ON public.sincronizacao_revisao
  FOR EACH ROW EXECUTE FUNCTION private.revisao_decisao_unica();

-- ── observação: gravar direto ou mandar para revisão ────────────────────────
DROP FUNCTION IF EXISTS private.sincronizar_observacao(uuid, timestamptz, boolean, text, jsonb);
CREATE OR REPLACE FUNCTION private.sincronizar_observacao(
  p_id uuid, p_hora timestamptz, p_sem_conexao boolean, p_aparelho text, d jsonb, p_revisao boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_perfil uuid := private.meu_perfil_id();
  v_paciente uuid := (d ->> 'paciente_id')::uuid;
  v_internacao uuid := nullif(d ->> 'internacao_id', '')::uuid;
  v_unidade uuid;
  v_dono uuid;
BEGIN
  SELECT registrado_por INTO v_dono FROM public.observacao WHERE id = p_id;
  IF NOT FOUND THEN
    SELECT autor_id INTO v_dono FROM public.sincronizacao_revisao WHERE id = p_id;
  END IF;
  IF FOUND THEN
    IF v_dono IS DISTINCT FROM v_perfil THEN
      RAISE EXCEPTION 'SYNC_ID_EM_USO: identificador já usado por outro registro.';
    END IF;
    RETURN CASE WHEN EXISTS (SELECT 1 FROM public.observacao WHERE id = p_id) THEN 'ja_recebido' ELSE 'em_revisao' END;
  END IF;

  SELECT unidade_id INTO v_unidade FROM public.pacientes WHERE id = v_paciente;
  IF v_unidade IS NULL THEN
    RAISE EXCEPTION 'SYNC_PACIENTE: paciente não encontrado.';
  END IF;
  IF private.podia_atuar_no_paciente_em(v_paciente, p_hora) IS NOT TRUE THEN
    RAISE EXCEPTION 'SYNC_FORA_DO_PLANTAO: na hora do registro você não estava em plantão no setor deste paciente.';
  END IF;
  IF v_internacao IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.internacoes WHERE id = v_internacao AND paciente_id = v_paciente) THEN
    RAISE EXCEPTION 'SYNC_INTERNACAO: internação não pertence ao paciente.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conceito WHERE id = (d ->> 'conceito_id')::uuid) THEN
    RAISE EXCEPTION 'SYNC_CONCEITO: conceito não encontrado.';
  END IF;

  IF p_revisao THEN
    INSERT INTO public.sincronizacao_revisao (id, unidade_id, paciente_id, autor_id, tipo, hora_fato, aparelho_id, dados)
    VALUES (p_id, v_unidade, v_paciente, v_perfil, 'observacao', p_hora, left(p_aparelho, 64), d);
    RETURN 'em_revisao';
  END IF;

  PERFORM private.inserir_observacao_sincronizada(p_id, v_unidade, v_perfil, p_hora, p_sem_conexao, p_aparelho, d);
  RETURN 'gravado';
END $$;
REVOKE ALL ON FUNCTION private.sincronizar_observacao(uuid, timestamptz, boolean, text, jsonb, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.inserir_observacao_sincronizada(
  p_id uuid, p_unidade uuid, p_autor uuid, p_hora timestamptz, p_sem_conexao boolean, p_aparelho text, d jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.observacao
    (id, unidade_id, internacao_id, paciente_id, conceito_id, aferido_em, registrado_por,
     valor_num, valor_texto, valor_conceito_id, unidade, origem, sem_conexao, aparelho_id)
  VALUES
    (p_id, p_unidade, nullif(d ->> 'internacao_id', '')::uuid, (d ->> 'paciente_id')::uuid, (d ->> 'conceito_id')::uuid,
     p_hora, p_autor, (d ->> 'valor_num')::numeric, d ->> 'valor_texto', nullif(d ->> 'valor_conceito_id', '')::uuid,
     d ->> 'unidade', coalesce(d ->> 'origem', 'manual'), p_sem_conexao, left(p_aparelho, 64));
$$;
REVOKE ALL ON FUNCTION private.inserir_observacao_sincronizada(uuid, uuid, uuid, timestamptz, boolean, text, jsonb) FROM PUBLIC, anon, authenticated;

-- ── a porta passa a decidir entre direto e revisão ─────────────────────────
CREATE OR REPLACE FUNCTION public.sincronizar_registros(p_itens jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item jsonb;
  v_id uuid;
  v_hora timestamptz;
  v_contato timestamptz;
  v_sem boolean;
  v_status text;
  saida jsonb := '[]'::jsonb;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF private.meu_perfil_id() IS NULL THEN RAISE EXCEPTION 'Acesso negado.'; END IF;
  IF jsonb_typeof(p_itens) IS DISTINCT FROM 'array' OR jsonb_array_length(p_itens) > 200 THEN
    RAISE EXCEPTION 'Envie de 1 a 200 registros por vez.';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(p_itens) LOOP
    v_id := NULL;
    BEGIN
      v_id := (item ->> 'id')::uuid;
      v_hora := (item ->> 'hora')::timestamptz;
      v_sem := coalesce((item ->> 'sem_conexao')::boolean, false);
      v_contato := (item ->> 'ultimo_contato')::timestamptz;
      IF v_id IS NULL OR v_hora IS NULL THEN
        RAISE EXCEPTION 'SYNC_INVALIDO: id e hora são obrigatórios.';
      END IF;
      IF v_hora > now() + interval '1 minute' THEN
        RAISE EXCEPTION 'SYNC_HORA_FUTURA: hora do registro no futuro.';
      END IF;
      IF v_sem THEN
        IF v_contato IS NULL OR v_contato > now() OR v_contato > v_hora + interval '1 minute' THEN
          RAISE EXCEPTION 'SYNC_CONTATO: último contato com o servidor ausente ou inconsistente.';
        END IF;
        IF v_hora - v_contato > private.limite_sem_conexao() THEN
          RAISE EXCEPTION 'SYNC_LIMITE: registro feito depois de 2 h sem conexão.';
        END IF;
      ELSIF v_hora < now() - interval '5 minutes' THEN
        RAISE EXCEPTION 'SYNC_HORA: registro com conexão precisa ter a hora atual.';
      END IF;

      CASE item ->> 'tipo'
        WHEN 'observacao' THEN
          v_status := private.sincronizar_observacao(v_id, v_hora, v_sem, item ->> 'aparelho_id', item -> 'dados',
                                                     v_sem AND now() - v_hora > private.limite_chegada_direta());
        ELSE
          RAISE EXCEPTION 'SYNC_TIPO: tipo de registro não aceito (%).', item ->> 'tipo';
      END CASE;
      saida := saida || jsonb_build_object('id', v_id, 'status', v_status);
    EXCEPTION WHEN others THEN
      saida := saida || jsonb_build_object('id', coalesce(v_id::text, item ->> 'id'), 'status', 'recusado', 'motivo', SQLERRM);
    END;
  END LOOP;
  RETURN saida;
END $$;

-- ── decisão do gestor ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decidir_revisao_sincronizacao(p_id uuid, p_aceitar boolean, p_motivo text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE r public.sincronizacao_revisao;
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  SELECT * INTO r FROM public.sincronizacao_revisao WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Registro em revisão não encontrado.'; END IF;
  IF (private.eh_super_admin() OR private.papel_na_unidade(r.unidade_id) = 'gestor') IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado: só o gestor da unidade decide a revisão.';
  END IF;
  IF r.decisao IS NOT NULL THEN RAISE EXCEPTION 'Revisão já decidida.'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 5 THEN
    RAISE EXCEPTION 'Explique o motivo da decisão (mínimo de 5 letras).';
  END IF;

  IF p_aceitar THEN
    -- entra com o autor e a hora do fato; a chegada é agora
    PERFORM private.inserir_observacao_sincronizada(r.id, r.unidade_id, r.autor_id, r.hora_fato, true, r.aparelho_id, r.dados);
  END IF;
  UPDATE public.sincronizacao_revisao
     SET decisao = CASE WHEN p_aceitar THEN 'aceito' ELSE 'descartado' END,
         decidido_por = private.meu_perfil_id(), decidido_em = now(), motivo = btrim(p_motivo)
   WHERE id = p_id;
END $$;
REVOKE ALL ON FUNCTION public.decidir_revisao_sincronizacao(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decidir_revisao_sincronizacao(uuid, boolean, text) TO authenticated;

GRANT SELECT ON public.sincronizacao_revisao TO authenticated;

-- Lista para o gestor, com o nome do autor e de quem decidiu (a policy de
-- perfis não abre nomes ao gestor; aqui só sai o nome, para quem decide).
CREATE OR REPLACE FUNCTION public.revisoes_sem_conexao(p_unidade uuid)
RETURNS TABLE (id uuid, paciente_nome text, autor_nome text, tipo text, hora_fato timestamptz,
               recebido_em timestamptz, dados jsonb, decisao text, decidido_por_nome text,
               decidido_em timestamptz, motivo text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM private.exigir_segundo_fator();  -- ADR 0010
  IF (private.eh_super_admin() OR private.papel_na_unidade(p_unidade) = 'gestor') IS NOT TRUE THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  RETURN QUERY
  SELECT r.id, pa.nome, a.nome_completo, r.tipo, r.hora_fato, r.recebido_em, r.dados, r.decisao,
         d.nome_completo, r.decidido_em, r.motivo
  FROM public.sincronizacao_revisao r
  JOIN public.pacientes pa ON pa.id = r.paciente_id
  JOIN public.perfis a ON a.id = r.autor_id
  LEFT JOIN public.perfis d ON d.id = r.decidido_por
  WHERE r.unidade_id = p_unidade
  ORDER BY r.decisao IS NOT NULL, r.recebido_em DESC
  LIMIT 100;
END $$;
REVOKE ALL ON FUNCTION public.revisoes_sem_conexao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revisoes_sem_conexao(uuid) TO authenticated;
