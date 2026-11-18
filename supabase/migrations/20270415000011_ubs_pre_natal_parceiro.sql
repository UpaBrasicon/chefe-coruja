-- ════════════════════════════════════════════════════════════════════════════
-- Percurso da UBS, U6, decisão E3: pré-natal do parceiro.
-- Diagnóstico e decisões em docs/ubs/U6-PRE-NATAL-PARCEIRO.md (#919; PP1–PP4 = A
-- do RT em 18/11/2026). Fonte: Ministério da Saúde/SAPS, Guia do pré-natal do
-- parceiro para profissionais de saúde (2023), p. 33–48, e PCDT de Prevenção da
-- Transmissão Vertical de HIV, Sífilis e Hepatites Virais (p. 28 e 144).
--
-- 1. Tipo de atendimento da UBS "pre_natal_parceiro" (CHECK e lista). A consulta é
--    da parceria, com ficha própria. Para a exportação ao SISAB (U15), este tipo é
--    a Consulta Pré-Natal do Parceiro, SIGTAP 03.01.01.023-4 (CID Z76.8 / CIAP A29
--    sem queixa).
-- 2. public.pre_natal_parcerias: a ficha da parceria ligada à gestação (RPC só).
-- 3. registrar_ficha: com o tipo novo, pede a gestante (p_dados.gestante_id), que
--    precisa ter pré-natal ativo na UBS, e grava a ligação.
-- 4. Exames da parceria: a lista do enfermeiro ganha a linha "parceria" (lista do
--    guia de 2023, p. 47–48). Na ficha da parceria o enfermeiro pede só dessa
--    linha; nas outras fichas, pré-natal e hiperdia, como antes.
-- 5. Pré-natal: o registro da gestação mostra a parceria, as consultas dela e a
--    situação dos exames e testes rápidos (nunca o resultado: é da parceria).
--
-- Idempotente. Teste: supabase/tests/ubs_pre_natal_parceiro.sql
--
-- Rollback (na ordem):
--   trocas 3 e 5 invertidas (os trechos estão abaixo);
--   recriar private.ubs_exames_enfermagem() e private.exame_consulta_enfermagem()
--     de 20270415000010_ubs_exames_enfermeiro.sql;
--   DROP FUNCTION private.pre_natal_parceria(uuid), private.ligar_parceria_pre_natal(uuid, uuid);
--   a tabela e o valor novo do CHECK ficam (expand); para tirá-los, com janela:
--   DROP TABLE public.pre_natal_parcerias; troca 1 invertida e o CHECK antigo
--   (20270211000002_atendimento_ubs.sql), sem fichas do tipo novo.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.u63p_trocar(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    CONTINUE WHEN position(replace(p_pares[k + 1], chr(13), '') IN novo) > 0;
    IF position(p_pares[k] IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, p_pares[k];
    END IF;
    novo := replace(novo, p_pares[k], p_pares[k + 1]);
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

-- ── 1. tipo de atendimento ──────────────────────────────────────────────────
SELECT pg_temp.u63p_trocar('private.lista_aps(text)'::regprocedure,
  $a$'consulta_no_dia', 'atendimento_urgencia']$a$,
  $b$'consulta_no_dia', 'atendimento_urgencia', 'pre_natal_parceiro']$b$);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'episodios_tipo_atendimento_aps_check'
                   AND conrelid = 'public.episodios'::regclass
                   AND pg_get_constraintdef(oid) LIKE '%pre_natal_parceiro%') THEN
    ALTER TABLE public.episodios DROP CONSTRAINT IF EXISTS episodios_tipo_atendimento_aps_check;
    ALTER TABLE public.episodios ADD CONSTRAINT episodios_tipo_atendimento_aps_check CHECK (
      tipo_atendimento_aps IS NULL OR tipo_atendimento_aps IN ('consulta_programada', 'consulta_agendada',
        'escuta_inicial', 'consulta_no_dia', 'atendimento_urgencia', 'pre_natal_parceiro'));
  END IF;
END $$;

-- ── 2. ligação parceria–gestação ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pre_natal_parcerias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES public.unidades(id),
  gestacao_id uuid NOT NULL REFERENCES public.pre_natal_gestacoes(id),
  parceria_id uuid NOT NULL REFERENCES public.pacientes(id),
  episodio_id uuid NOT NULL UNIQUE REFERENCES public.episodios(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  criado_por uuid REFERENCES public.perfis(id)
);
COMMENT ON TABLE public.pre_natal_parcerias IS
  'Pré-natal do parceiro (U6, E3): a ficha da parceria ligada à gestação. Acesso só por RPC.';
CREATE INDEX IF NOT EXISTS pre_natal_parcerias_gestacao ON public.pre_natal_parcerias (gestacao_id);
CREATE INDEX IF NOT EXISTS pre_natal_parcerias_parceria ON public.pre_natal_parcerias (parceria_id);
ALTER TABLE public.pre_natal_parcerias ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.pre_natal_parcerias FROM PUBLIC, anon, authenticated;

-- ── 3. a ficha da parceria pede a gestante ──────────────────────────────────
CREATE OR REPLACE FUNCTION private.ligar_parceria_pre_natal(p_episodio uuid, p_gestante uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.episodios; v_gestacao uuid;
BEGIN
  SELECT * INTO e FROM public.episodios WHERE id = p_episodio;
  IF p_gestante IS NULL THEN RAISE EXCEPTION 'Escolha a gestante do pré-natal do parceiro.'; END IF;
  IF p_gestante = e.paciente_id THEN RAISE EXCEPTION 'A parceria não pode ser a própria gestante.'; END IF;
  SELECT g.id INTO v_gestacao FROM public.pre_natal_gestacoes g
   WHERE g.paciente_id = p_gestante AND g.unidade_id = e.unidade_id
     AND private.pre_natal_ativa(g.saida_em, g.desfecho, g.dum, g.desfecho_em)
   ORDER BY g.entrada_em DESC LIMIT 1;
  IF v_gestacao IS NULL THEN RAISE EXCEPTION 'A gestante não tem pré-natal ativo nesta UBS.'; END IF;
  INSERT INTO public.pre_natal_parcerias (unidade_id, gestacao_id, parceria_id, episodio_id, criado_por)
  VALUES (e.unidade_id, v_gestacao, e.paciente_id, e.id, private.meu_perfil_id());
END $$;
REVOKE ALL ON FUNCTION private.ligar_parceria_pre_natal(uuid, uuid) FROM PUBLIC, anon, authenticated;

SELECT pg_temp.u63p_trocar('public.registrar_ficha(uuid,text,uuid,jsonb,text[],boolean)'::regprocedure,
  $a$  RETURNING id INTO v_epi;$a$,
  $b$  RETURNING id INTO v_epi; IF v_tipo_aps = 'pre_natal_parceiro' THEN PERFORM private.ligar_parceria_pre_natal(v_epi, nullif(p_dados ->> 'gestante_id', '')::uuid); END IF;  -- U6, E3: pré-natal do parceiro$b$);

-- ── 4. exames da parceria ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION private.ubs_exames_enfermagem()
RETURNS TABLE (codigo text, nome text, linhas text[])
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT * FROM (VALUES
    ('0202020380', 'Hemograma completo', ARRAY['pre_natal', 'parceria']),
    ('0202020355', 'Eletroforese de hemoglobina', ARRAY['pre_natal', 'parceria']),
    ('0202120023', 'Grupo ABO', ARRAY['pre_natal', 'parceria']),
    ('0202120082', 'Fator Rh', ARRAY['pre_natal', 'parceria']),
    ('0202120090', 'Coombs indireto', ARRAY['pre_natal']),
    ('0202010473', 'Glicose', ARRAY['pre_natal', 'hiperdia', 'parceria']),
    ('0202010040', 'Curva glicêmica (2 dosagens)', ARRAY['pre_natal']),
    ('0202050017', 'Urina tipo I (EAS)', ARRAY['pre_natal', 'hiperdia']),
    ('0202080080', 'Urocultura', ARRAY['pre_natal']),
    ('0202031179', 'Sífilis (VDRL) em gestante', ARRAY['pre_natal']),
    ('0202031519', 'HIV em gestante', ARRAY['pre_natal']),
    ('0202031454', 'Hepatite B (HBsAg) em gestante', ARRAY['pre_natal']),
    ('0202030768', 'Toxoplasmose IgG', ARRAY['pre_natal']),
    ('0202030873', 'Toxoplasmose IgM', ARRAY['pre_natal']),
    ('0202010503', 'Hemoglobina glicada (HbA1c)', ARRAY['hiperdia']),
    ('0202010317', 'Creatinina', ARRAY['hiperdia']),
    ('0202010600', 'Potássio', ARRAY['hiperdia']),
    ('0202010295', 'Colesterol total', ARRAY['hiperdia', 'parceria']),
    ('0202010279', 'Colesterol HDL', ARRAY['hiperdia', 'parceria']),
    ('0202010678', 'Triglicerídeos', ARRAY['hiperdia', 'parceria']),
    ('0202050092', 'Microalbumina na urina', ARRAY['hiperdia']),
    ('0202031624', 'Sífilis (VDRL) em parceria de gestante', ARRAY['parceria']),
    ('0202031527', 'HIV em parceria de gestante', ARRAY['parceria']),
    ('0202031462', 'Hepatite B (HBsAg) em parceria de gestante', ARRAY['parceria']),
    ('0202031497', 'Hepatite C (anti-HCV) em parceria de gestante', ARRAY['parceria'])
  ) AS t(codigo, nome, linhas)
$$;
REVOKE ALL ON FUNCTION private.ubs_exames_enfermagem() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.exame_consulta_enfermagem()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.episodios; v_linhas text[];
BEGIN
  IF NEW.episodio_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO e FROM public.episodios WHERE id = NEW.episodio_id;
  IF e.destino_aps IS DISTINCT FROM 'enfermagem' OR private.tenho_papel(e.unidade_id, 'plantonista') IS TRUE THEN
    RETURN NEW;
  END IF;
  IF NEW.procedimento IS NULL THEN
    RAISE EXCEPTION 'Na consulta de enfermagem o exame sai da lista do protocolo da atenção básica, sem texto livre.';
  END IF;
  -- na ficha da parceria (pré-natal do parceiro), só a linha da parceria
  v_linhas := CASE WHEN e.tipo_atendimento_aps = 'pre_natal_parceiro' THEN ARRAY['parceria'] ELSE ARRAY['pre_natal', 'hiperdia'] END;
  IF NOT EXISTS (SELECT 1 FROM private.ubs_exames_enfermagem() x WHERE x.codigo = NEW.procedimento AND x.linhas && v_linhas) THEN
    RAISE EXCEPTION 'Exame fora do protocolo de enfermagem da atenção básica: %.', NEW.exame;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.exame_consulta_enfermagem() FROM PUBLIC, anon, authenticated;

-- ── 5. o pré-natal mostra a parceria ────────────────────────────────────────
-- só a situação: o resultado dos exames é da parceria, no prontuário dela
CREATE OR REPLACE FUNCTION private.pre_natal_parceria(p_gestacao uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
           'paciente_id', p.id, 'nome', coalesce(p.nome_social, p.nome),
           'consultas', (SELECT count(*) FROM public.pre_natal_parcerias l2 JOIN public.episodios e ON e.id = l2.episodio_id
                          WHERE l2.gestacao_id = p_gestacao AND l2.parceria_id = p.id AND e.etapa = 'encerrado'),
           'exames', coalesce((SELECT jsonb_agg(jsonb_build_object('nome', x.nome,
                         'situacao', CASE WHEN EXISTS (SELECT 1 FROM public.exame_resultados r WHERE r.exame_id = ep.id AND r.vigente)
                                          THEN 'resultado' ELSE ep.situacao END) ORDER BY x.nome)
                         FROM public.exames_pedidos ep
                         JOIN private.ubs_exames_enfermagem() x ON x.codigo = ep.procedimento AND 'parceria' = ANY (x.linhas)
                        WHERE ep.paciente_id = p.id AND ep.situacao IS DISTINCT FROM 'cancelado'
                          AND ep.pedido_em >= (SELECT min(l3.criado_em) FROM public.pre_natal_parcerias l3 WHERE l3.gestacao_id = p_gestacao)), '[]'::jsonb),
           'testes_rapidos', (SELECT count(*) FROM public.procedimentos_realizados pr
                               WHERE pr.paciente_id = p.id AND pr.cancelado_em IS NULL
                                 AND pr.procedimento IN ('0214010260', '0214010287', '0214010244', '0214010317')
                                 AND pr.realizado_em >= (SELECT min(l4.criado_em) FROM public.pre_natal_parcerias l4 WHERE l4.gestacao_id = p_gestacao)))
    FROM public.pre_natal_parcerias l JOIN public.pacientes p ON p.id = l.parceria_id
   WHERE l.gestacao_id = p_gestacao
   ORDER BY l.criado_em DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION private.pre_natal_parceria(uuid) FROM PUBLIC, anon, authenticated;

SELECT pg_temp.u63p_trocar('private.pre_natal_registros(uuid)'::regprocedure,
  $a$    'id', g.id, 'origem', g.origem, 'entrada_em', g.entrada_em,$a$,
  $b$    'id', g.id, 'origem', g.origem, 'entrada_em', g.entrada_em, 'parceria', private.pre_natal_parceria(g.id),$b$);
