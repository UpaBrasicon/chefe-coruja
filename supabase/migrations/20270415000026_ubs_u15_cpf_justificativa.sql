-- ════════════════════════════════════════════════════════════════════════════
-- Percurso da UBS, U15, vacina, PR 2 (plano docs/ubs/U15-VACINA-PLANO.md; RT,
-- 19/11/2026: VC7 = A): CPF ou a justificativa de não ter CPF.
--
-- As fichas do SISAB (LEDI APS 8.7.0) identificam o cidadão pelo CPF. Sem CPF,
-- vão com o CNS e uma justificativa da lista do LEDI (campo
-- justificativaCidadaoNaoPossuiCpf: FAI 48, Ficha de Procedimentos 21, Ficha de
-- Vacinação 17, no IDL oficial). Até aqui, o paciente só com CNS ia sem
-- justificativa, e o PEC do município pode recusar a ficha.
--
-- 1. terminologia.ledi_justificativa_sem_cpf: os 12 motivos do Dicionário de
--    dados do LEDI APS 8.7.0 (JustificativaNaoPossuiCpf), baixado em 19/11/2026.
-- 2. pacientes.cpf_justificativa: o motivo do paciente sem CPF. CPF válido no
--    cadastro apaga o motivo (gatilho).
-- 3. registrar_ficha grava o motivo que vier (p_dados.cpf_justificativa),
--    conferido na lista. Quem pede o CPF ou o motivo é a tela da recepção da
--    UBS. O banco não trava a ficha: o atendimento não espera documento, e a
--    ficha do SISAB sem CPF e sem motivo fica retida (item 5) até o cadastro
--    ser completado.
-- 4. salvar_endereco_sus e endereco_sus: o motivo também se corrige depois, em
--    "Endereço e dados do SUS".
-- 5. private.ledi_carga_cidadao: CPF válido vai sozinho; sem CPF, a ficha
--    precisa do motivo e do CNS, ou fica retida ("retido: paciente sem CPF e
--    sem justificativa", "retido: paciente sem CPF e sem CNS").
--
-- Idempotente. Teste: supabase/tests/ubs_u15_cpf_justificativa.sql
--
-- Rollback (na ordem):
--   as trocas invertidas em registrar_ficha, salvar_endereco_sus e endereco_sus
--     (os trechos estão abaixo);
--   recriar private.ledi_carga_cidadao da 20270415000022;
--   DROP TRIGGER IF EXISTS trg_pacientes_cpf_justificativa ON public.pacientes;
--   DROP FUNCTION IF EXISTS private.pacientes_cpf_justificativa();
--   ALTER TABLE public.pacientes DROP COLUMN IF EXISTS cpf_justificativa;  -- só este PR usa
--   DROP TABLE IF EXISTS terminologia.ledi_justificativa_sem_cpf;
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION pg_temp.u15c_trocar(p_f regprocedure, VARIADIC p_pares text[])
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  def text := replace(pg_get_functiondef(p_f), chr(13), '');
  novo text := def;
  de text; para text;
BEGIN
  FOR k IN 1 .. array_length(p_pares, 1) BY 2 LOOP
    de := replace(p_pares[k], chr(13), '');
    para := replace(p_pares[k + 1], chr(13), '');
    CONTINUE WHEN position(para IN novo) > 0;
    IF position(de IN novo) = 0 THEN
      RAISE EXCEPTION '% mudou: trecho não encontrado: %', p_f, de;
    END IF;
    novo := replace(novo, de, para);
  END LOOP;
  IF novo <> def THEN EXECUTE novo; END IF;
END $$;

-- ── 1. motivos do LEDI ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS terminologia.ledi_justificativa_sem_cpf (
  codigo integer PRIMARY KEY CHECK (codigo > 0),
  nome   text NOT NULL
);
COMMENT ON TABLE terminologia.ledi_justificativa_sem_cpf IS
  'U15: motivos do cidadão sem CPF nas fichas do SISAB (LEDI APS 8.7.0, JustificativaNaoPossuiCpf).';
ALTER TABLE terminologia.ledi_justificativa_sem_cpf ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ledi_justificativa_sem_cpf_select ON terminologia.ledi_justificativa_sem_cpf;
CREATE POLICY ledi_justificativa_sem_cpf_select ON terminologia.ledi_justificativa_sem_cpf
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ledi_justificativa_sem_cpf_write ON terminologia.ledi_justificativa_sem_cpf;
CREATE POLICY ledi_justificativa_sem_cpf_write ON terminologia.ledi_justificativa_sem_cpf
  FOR ALL TO service_role USING (true) WITH CHECK (true);
REVOKE ALL ON terminologia.ledi_justificativa_sem_cpf FROM anon, authenticated;
GRANT SELECT ON terminologia.ledi_justificativa_sem_cpf TO authenticated;
GRANT ALL ON terminologia.ledi_justificativa_sem_cpf TO service_role;

INSERT INTO terminologia.ledi_justificativa_sem_cpf (codigo, nome) VALUES
  (2, 'Paciente desacordado, sem documentos'),
  (3, 'Recém-nascidos'),
  (4, 'Indígenas sem CPF'),
  (5, 'Pessoa em situação de rua sem documentos'),
  (6, 'Recusa cultural ou religiosa'),
  (7, 'Estrangeiro em trânsito (turista/visitante)'),
  (8, 'Pessoa indocumentada'),
  (9, 'Crianças sem documentação emitida'),
  (10, 'Estrangeiro residente sem CPF'),
  (11, 'Internação compulsória (saúde mental ou ordem judicial)'),
  (12, 'População migrante/refugiada em processo de regularização'),
  (13, 'Situações de calamidade ou desastre')
ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome;

-- ── 2. motivo no cadastro ───────────────────────────────────────────────────
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS cpf_justificativa integer REFERENCES terminologia.ledi_justificativa_sem_cpf(codigo);
COMMENT ON COLUMN public.pacientes.cpf_justificativa IS
  'U15: motivo de não ter CPF, da lista do LEDI APS (vai nas fichas do SISAB com o CNS). CPF válido apaga.';

CREATE OR REPLACE FUNCTION private.pacientes_cpf_justificativa()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF length(private.so_digitos(NEW.cpf)) = 11 THEN NEW.cpf_justificativa := NULL; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.pacientes_cpf_justificativa() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_pacientes_cpf_justificativa ON public.pacientes;
CREATE TRIGGER trg_pacientes_cpf_justificativa
  BEFORE INSERT OR UPDATE OF cpf, cpf_justificativa ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION private.pacientes_cpf_justificativa();

-- ── 3. a ficha grava o motivo ───────────────────────────────────────────────
SELECT pg_temp.u15c_trocar('public.registrar_ficha(uuid,text,uuid,jsonb,text[],boolean)'::regprocedure,
  $a$v_tipo text; v_ubs boolean; v_tipo_aps text;$a$,
  $b$v_tipo text; v_ubs boolean; v_tipo_aps text; v_just integer;$b$,
  $a$  -- documentos: nunca dois cadastros com o mesmo CPF/CNS na unidade$a$,
  $b$  -- U15 (VC7 = A): na UBS, o CPF ou o motivo de não ter CPF (lista do LEDI)
  v_just := nullif(btrim(coalesce(p_dados ->> 'cpf_justificativa', '')), '')::integer;
  IF v_just IS NOT NULL AND NOT EXISTS (SELECT 1 FROM terminologia.ledi_justificativa_sem_cpf WHERE codigo = v_just) THEN
    RAISE EXCEPTION 'Motivo de não ter CPF fora da lista do e-SUS APS.';
  END IF;

  -- documentos: nunca dois cadastros com o mesmo CPF/CNS na unidade$b$,
  $a$  UPDATE public.pacientes SET setor_id = p_setor, updated_at = now(), pre_cadastro = false WHERE id = v_pac.id RETURNING * INTO v_pac;$a$,
  $b$  IF v_just IS NOT NULL THEN UPDATE public.pacientes SET cpf_justificativa = v_just WHERE id = v_pac.id; END IF;  -- U15
  UPDATE public.pacientes SET setor_id = p_setor, updated_at = now(), pre_cadastro = false WHERE id = v_pac.id RETURNING * INTO v_pac;$b$);

-- ── 4. o motivo em "Endereço e dados do SUS" ────────────────────────────────
SELECT pg_temp.u15c_trocar('public.salvar_endereco_sus(uuid,jsonb)'::regprocedure,
  $a$  IF v_cep IS NOT NULL AND length(v_cep) <> 8 THEN RAISE EXCEPTION 'CEP com 8 dígitos.'; END IF;$a$,
  $b$  IF v_cep IS NOT NULL AND length(v_cep) <> 8 THEN RAISE EXCEPTION 'CEP com 8 dígitos.'; END IF;
  IF nullif(btrim(coalesce(d->>'cpf_justificativa', '')), '') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM terminologia.ledi_justificativa_sem_cpf WHERE codigo::text = btrim(d->>'cpf_justificativa')) THEN
    RAISE EXCEPTION 'Motivo de não ter CPF fora da lista do e-SUS APS.';  -- U15
  END IF;$b$,
  $a$    sem_documento   = CASE WHEN d ? 'sem_documento' THEN coalesce((d->>'sem_documento')::boolean, false) ELSE sem_documento END,$a$,
  $b$    sem_documento   = CASE WHEN d ? 'sem_documento' THEN coalesce((d->>'sem_documento')::boolean, false) ELSE sem_documento END,
    cpf_justificativa = CASE WHEN d ? 'cpf_justificativa' THEN nullif(btrim(coalesce(d->>'cpf_justificativa', '')), '')::integer ELSE cpf_justificativa END,$b$);

SELECT pg_temp.u15c_trocar('public.endereco_sus(uuid)'::regprocedure,
  $a$'situacao_rua', pa.situacao_rua, 'sem_documento', pa.sem_documento);$a$,
  $b$'situacao_rua', pa.situacao_rua, 'sem_documento', pa.sem_documento,
    'tem_cpf', coalesce(length(private.so_digitos(pa.cpf)) = 11, false), 'cpf_justificativa', pa.cpf_justificativa);$b$);

-- ── 5. a carga do cidadão para o LEDI ───────────────────────────────────────
CREATE OR REPLACE FUNCTION private.ledi_carga_cidadao(p_paciente uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE pa public.pacientes; v_cns text; v_cpf text;
BEGIN
  SELECT * INTO pa FROM public.pacientes WHERE id = p_paciente;
  IF NOT FOUND THEN RAISE EXCEPTION 'retido: paciente não encontrado'; END IF;
  v_cns := nullif(regexp_replace(coalesce(pa.cns, ''), '\D', '', 'g'), '');
  v_cpf := nullif(regexp_replace(coalesce(pa.cpf, ''), '\D', '', 'g'), '');
  IF length(v_cns) IS DISTINCT FROM 15 THEN v_cns := NULL; END IF;
  IF length(v_cpf) IS DISTINCT FROM 11 THEN v_cpf := NULL; END IF;
  -- U15 (VC7 = A): sem CPF, a ficha leva o CNS e o motivo da lista do LEDI
  IF v_cpf IS NULL AND pa.cpf_justificativa IS NULL THEN RAISE EXCEPTION 'retido: paciente sem CPF e sem justificativa'; END IF;
  IF v_cpf IS NULL AND v_cns IS NULL THEN RAISE EXCEPTION 'retido: paciente sem CPF e sem CNS'; END IF;
  IF pa.data_nascimento IS NULL THEN RAISE EXCEPTION 'retido: paciente sem data de nascimento'; END IF;
  RETURN jsonb_build_object('id', pa.id, 'cns', v_cns, 'cpf', v_cpf,
    'justificativa_sem_cpf', CASE WHEN v_cpf IS NULL THEN pa.cpf_justificativa END,
    'data_nascimento', pa.data_nascimento, 'sexo', pa.sexo);
END;
$$;
