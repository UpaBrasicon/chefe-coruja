-- ════════════════════════════════════════════════════════════════════════════
-- Pedido 7 do RT (17/11/2026), "Meu plantão": anotações pessoais do médico.
-- Decisões do RT em 23/11/2026 ("Sim, todas A";
-- docs/plantonista/ANOTACOES-MEDICO-DIAGNOSTICO.md):
--   AN1 = A: só lembretes do médico, sem dado de paciente. A tela avisa e
--            pede confirmação quando o texto parece ter CPF, Cartão SUS ou
--            data de nascimento; o do paciente vai para as pendências.
--   AN2 = A: no banco, por pessoa; só o dono lê (nem gestor, nem admin).
--   AN3 = A: apagam sozinhas 30 dias depois da última mudança (rotina diária).
--   AN4 = A: lista de notas curtas (até 1.000 letras), com feito e fixar.
--
-- • public.anotacoes_medico: uma linha por nota; leitura só do dono (RLS);
--   escrita só pelas funções abaixo.
-- • salvar_anotacao (nova ou editada), marcar_anotacao (feita, fixada) e
--   apagar_anotacao: só quem é médico (plantonista ou telemedicina) em alguma
--   unidade; no máximo 200 notas por pessoa.
-- • private.apagar_anotacoes_vencidas: diária, 04:20 de Brasília (07:20 UTC).
--
-- Expand: uma tabela, quatro funções e um agendamento. Idempotente.
-- Volta: supabase/snippets/anotacoes_medico_rollback.sql
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.anotacoes_medico (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_id   uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  texto       text NOT NULL CHECK (length(btrim(texto)) BETWEEN 1 AND 1000),
  feita       boolean NOT NULL DEFAULT false,
  fixada      boolean NOT NULL DEFAULT false,
  criada_em   timestamptz NOT NULL DEFAULT now(),
  alterada_em timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.anotacoes_medico IS
  'Lembretes pessoais do médico (pedido 7; AN1 a AN4 = A), sem dado de paciente. Só o dono lê; apagam 30 dias depois da última mudança.';
CREATE INDEX IF NOT EXISTS anotacoes_medico_perfil ON public.anotacoes_medico (perfil_id, alterada_em DESC);
CREATE INDEX IF NOT EXISTS anotacoes_medico_alterada ON public.anotacoes_medico (alterada_em);

ALTER TABLE public.anotacoes_medico ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.anotacoes_medico FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.anotacoes_medico TO authenticated;
DROP POLICY IF EXISTS anotacoes_medico_dono ON public.anotacoes_medico;
CREATE POLICY anotacoes_medico_dono ON public.anotacoes_medico
  FOR SELECT TO authenticated
  USING (perfil_id = private.meu_perfil_id());

CREATE OR REPLACE FUNCTION private.sou_medico()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.vinculos v
                  WHERE v.perfil_id = private.meu_perfil_id() AND v.ativo
                    AND v.papel IN ('plantonista', 'telemedicina'))
$$;
REVOKE ALL ON FUNCTION private.sou_medico() FROM PUBLIC, anon, authenticated;

-- nova (p_id nulo) ou editada (p_id da própria nota)
CREATE OR REPLACE FUNCTION public.salvar_anotacao(p_id uuid, p_texto text)
RETURNS uuid
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_eu uuid := private.meu_perfil_id();
  v_texto text := btrim(coalesce(p_texto, ''));
  v_id uuid;
BEGIN
  IF v_eu IS NULL OR NOT private.sou_medico() THEN
    RAISE EXCEPTION 'Acesso negado: as anotações pessoais são do médico.' USING ERRCODE = '42501';
  END IF;
  IF length(v_texto) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Escreva a anotação (até 1.000 letras).';
  END IF;
  IF p_id IS NULL THEN
    IF (SELECT count(*) FROM public.anotacoes_medico WHERE perfil_id = v_eu) >= 200 THEN
      RAISE EXCEPTION 'Você já tem 200 anotações. Apague as que não usa mais.';
    END IF;
    INSERT INTO public.anotacoes_medico (perfil_id, texto) VALUES (v_eu, v_texto) RETURNING id INTO v_id;
  ELSE
    UPDATE public.anotacoes_medico SET texto = v_texto, alterada_em = now()
     WHERE id = p_id AND perfil_id = v_eu
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'Anotação não encontrada.'; END IF;
  END IF;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.marcar_anotacao(p_id uuid, p_feita boolean DEFAULT NULL, p_fixada boolean DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.meu_perfil_id() IS NULL OR NOT private.sou_medico() THEN
    RAISE EXCEPTION 'Acesso negado: as anotações pessoais são do médico.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.anotacoes_medico
     SET feita = coalesce(p_feita, feita), fixada = coalesce(p_fixada, fixada), alterada_em = now()
   WHERE id = p_id AND perfil_id = private.meu_perfil_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'Anotação não encontrada.'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.apagar_anotacao(p_id uuid)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF private.meu_perfil_id() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado.' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.anotacoes_medico WHERE id = p_id AND perfil_id = private.meu_perfil_id();
  IF NOT FOUND THEN RAISE EXCEPTION 'Anotação não encontrada.'; END IF;
END $$;

-- AN3: o que passou 30 dias sem mudança some
CREATE OR REPLACE FUNCTION private.apagar_anotacoes_vencidas()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int;
BEGIN
  DELETE FROM public.anotacoes_medico WHERE alterada_em < now() - interval '30 days';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION private.apagar_anotacoes_vencidas() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.salvar_anotacao(uuid, text), public.marcar_anotacao(uuid, boolean, boolean),
  public.apagar_anotacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_anotacao(uuid, text), public.marcar_anotacao(uuid, boolean, boolean),
  public.apagar_anotacao(uuid) TO authenticated;

-- idempotente: o pg_cron atualiza o agendamento de mesmo nome
SELECT cron.schedule('anotacoes-medico-30-dias', '20 7 * * *', 'SELECT private.apagar_anotacoes_vencidas();');
