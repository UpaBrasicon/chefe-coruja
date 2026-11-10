-- ════════════════════════════════════════════════════════════════════════════
-- Lacuna 3 do Portão de 11/10/2026: medicação controlada (Portaria 344).
-- Diagnóstico e decisão do RT (10/11/2026, A em C1 a C6):
--   docs/farmacia/LACUNA-03-CONTROLADOS-DIAGNOSTICO.md
-- Conferência linha a linha das substâncias com a RDC:
--   docs/farmacia/LACUNA-03-SUBSTANCIAS-CONFERENCIA.md
--
-- Fontes:
--   - Portaria SVS/MS nº 344, de 12/05/1998 (texto na BVS, conferido em
--     10/11/2026):
--       Art. 35 §6º: o internado não precisa de Notificação de Receita; basta a
--         prescrição diária do estabelecimento;
--       Arts. 51 e 56: listas A, B, C2 e C3 (Art. 51) e C1 e C5 (Art. 56) ao
--         internado pela receita privativa do estabelecimento; ao paciente
--         ambulatorial, Notificação de Receita (A e B) ou Receita de Controle
--         Especial em 2 vias (C1 e C5);
--       Arts. 40, 45, 49 e 50: Notificação A amarela, B azul, C3 e C2 brancas.
--   - RDC ANVISA nº 1.036, de 09/07/2026 (DOU de 13/07/2026), "Atualização
--     N. 101" do Anexo I da Portaria 344 (listas vigentes). Texto em
--     anvisalegis.datalegis.net, lido em 10/11/2026.
--
-- O que faz:
--   C2  public.substancias_controladas: as substâncias da RDC que existem no
--       catálogo da rede (25 linhas), com a lista, o item e a receita que a
--       lista exige para casa. Os sais, éteres, ésteres e isômeros também
--       ficam sob controle (adendo 1 de cada lista): a marca casa pelo nome
--       do princípio ativo como palavra inteira ("decanoato de haloperidol"
--       casa com "haloperidol"). Escrita só pelo super admin, pelas RPCs
--       definir_substancia_controlada e retirar_substancia_controlada, com
--       auditoria; a linha retirada fica (histórico).
--       public.medicamento ganha controlado_lista, controlado_substancia e
--       controlado_receita, calculados por gatilho a cada gravação (como a
--       alta vigilância): ninguém marca nem desmarca à mão, e a unidade não
--       desmarca (obrigação legal). O cadastro local de medicamentos
--       (20270106000001) passa pelo mesmo gatilho.
--   C5  private.exige_liberacao_farmacia = alta vigilância da unidade OU
--       controlado. checar() passa a usar essa regra: sem liberação da
--       farmácia, o "feito" do controlado pede justificativa e entra na lista
--       do farmacêutico, como na alta vigilância. Controlado de alta
--       vigilância (midazolam EV) passa por uma liberação só: a liberação é do
--       item (liberado_pela_farmacia), não da regra.
--       liberacao_farmacia() devolve também os controlados (com
--       'alta_vigilancia', 'controlado' e 'controlado_receita'); fila_validacao() põe o controlado
--       na frente, junto com a alta vigilância (mesma assinatura e colunas).
--   Telas  public.controle_dos_itens(p_itens): a lista de cada item, para o
--       selo "Controlado · B1" nas telas que só têm o item.
--   C6  nada muda no saldo (pode ficar negativo); o painel da farmácia
--       destaca o controlado com saldo negativo (frontend).
--
-- checar, liberacao_farmacia e fila_validacao são trocadas pelo texto atual
-- (pg_get_functiondef), trecho a trecho, como em 20270321000002: trecho que
-- não existe mais para a migration com erro; trecho já trocado é pulado
-- (reaplicável). Conferido em 10/11/2026 na homologação.
--
-- Só expande: tabela, colunas, funções e gatilho novos; três funções com o
-- corpo trocado e a mesma assinatura.
--
-- Rollback (testado na homologação, em transação desfeita):
--   reaplicar public.checar de 20270301000001_frequencia_prescricao_ps.sql e
--   public.liberacao_farmacia e public.fila_validacao de
--   20261101000002_liberacao_farmacia_alta_vigilancia.sql; depois
--     DROP TRIGGER IF EXISTS medicamento_marca_controlado ON public.medicamento;
--     DROP FUNCTION IF EXISTS public.controle_dos_itens(uuid[]),
--       public.definir_substancia_controlada(text, text, integer, text, text[], text, text),
--       public.retirar_substancia_controlada(uuid, text, text),
--       private.exige_liberacao_farmacia(uuid, uuid), private.remarcar_controlados(),
--       private.medicamento_marca_controlado(), private.substancia_controlada_do_nome(text),
--       private.nome_para_controle(text, text), private.receita_da_lista(text);
--     DROP TABLE IF EXISTS public.substancias_controladas;
--     DROP FUNCTION IF EXISTS private.substancia_controlada_so_retira();
--   As colunas controlado_* de public.medicamento ficam sem uso até uma
--   janela declarada (contract).
-- ════════════════════════════════════════════════════════════════════════════

-- ── colunas no catálogo ─────────────────────────────────────────────────────
ALTER TABLE public.medicamento
  ADD COLUMN IF NOT EXISTS controlado_lista text,
  ADD COLUMN IF NOT EXISTS controlado_substancia text,
  ADD COLUMN IF NOT EXISTS controlado_receita text;
COMMENT ON COLUMN public.medicamento.controlado_lista IS 'Lista da Portaria 344 (A1, B1, C1...). Calculada pelo gatilho medicamento_marca_controlado a partir de public.substancias_controladas; não se grava à mão.';
COMMENT ON COLUMN public.medicamento.controlado_substancia IS 'Substância da RDC que marcou o item (nome como está na RDC).';
COMMENT ON COLUMN public.medicamento.controlado_receita IS 'Receita que o item exige para casa (notificacao_a, notificacao_b, notificacao_b2, controle_especial, notificacao_c2, notificacao_c3, so_estabelecimento).';

-- ── a tabela das substâncias (C2) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.substancias_controladas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  substancia      text NOT NULL CHECK (length(btrim(substancia)) >= 3),   -- como está na RDC
  chave           text NOT NULL CHECK (chave ~ '^[a-z0-9]+( [a-z0-9]+)*$'), -- nome comparável
  grafias         text[] NOT NULL DEFAULT '{}',                         -- outras grafias comparáveis do catálogo
  lista           text NOT NULL CHECK (lista IN ('A1', 'A2', 'A3', 'B1', 'B2', 'C1', 'C2', 'C3', 'C5')),
  item            integer NOT NULL CHECK (item > 0),
  receita         text NOT NULL CHECK (receita IN ('notificacao_a', 'notificacao_b', 'notificacao_b2', 'controle_especial',
                                                  'notificacao_c2', 'notificacao_c3', 'so_estabelecimento')),
  adendo          text,                                                 -- adendo da lista que muda a receita
  rdc             text NOT NULL CHECK (length(btrim(rdc)) >= 10),
  vigente         boolean NOT NULL DEFAULT true,
  definida_por    uuid REFERENCES public.perfis(id),                    -- nulo = esta migration
  definida_em     timestamptz NOT NULL DEFAULT now(),
  retirada_por    uuid REFERENCES public.perfis(id),
  retirada_em     timestamptz,
  retirada_rdc    text,
  retirada_motivo text,
  CHECK (vigente = (retirada_em IS NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS substancias_controladas_vigente ON public.substancias_controladas (chave) WHERE vigente;
ALTER TABLE public.substancias_controladas ENABLE ROW LEVEL SECURITY;
-- só leitura para quem está logado; a escrita é das funções do super admin
REVOKE ALL ON public.substancias_controladas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.substancias_controladas TO authenticated;
DROP POLICY IF EXISTS substancias_controladas_select ON public.substancias_controladas;
CREATE POLICY substancias_controladas_select ON public.substancias_controladas FOR SELECT TO authenticated USING (true);
COMMENT ON TABLE public.substancias_controladas IS 'Substâncias da Portaria 344 que existem no catálogo da rede, digitadas da RDC vigente (lacuna 3). Escrita só pelas RPCs do super admin.';

-- a linha não se apaga nem se reescreve: só se retira, uma vez
CREATE OR REPLACE FUNCTION private.substancia_controlada_so_retira() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Substância controlada não se apaga: retire com a RDC.'; END IF;
  IF NOT OLD.vigente OR NEW.vigente
     OR (NEW.substancia, NEW.chave, NEW.grafias, NEW.lista, NEW.item, NEW.receita, NEW.adendo, NEW.rdc, NEW.definida_por, NEW.definida_em)
        IS DISTINCT FROM
        (OLD.substancia, OLD.chave, OLD.grafias, OLD.lista, OLD.item, OLD.receita, OLD.adendo, OLD.rdc, OLD.definida_por, OLD.definida_em) THEN
    RAISE EXCEPTION 'Substância controlada não se reescreve: retire a linha e defina de novo.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS substancias_controladas_so_retira ON public.substancias_controladas;
CREATE TRIGGER substancias_controladas_so_retira BEFORE UPDATE OR DELETE ON public.substancias_controladas
  FOR EACH ROW EXECUTE FUNCTION private.substancia_controlada_so_retira();

-- receita para casa que a lista exige (Portaria 344, Arts. 35, 40, 45, 49, 50, 52 e 56)
CREATE OR REPLACE FUNCTION private.receita_da_lista(p_lista text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_lista
           WHEN 'A1' THEN 'notificacao_a' WHEN 'A2' THEN 'notificacao_a' WHEN 'A3' THEN 'notificacao_a'
           WHEN 'B1' THEN 'notificacao_b' WHEN 'B2' THEN 'notificacao_b2'
           WHEN 'C1' THEN 'controle_especial' WHEN 'C5' THEN 'controle_especial'
           WHEN 'C2' THEN 'notificacao_c2' WHEN 'C3' THEN 'notificacao_c3' END
$$;
REVOKE ALL ON FUNCTION private.receita_da_lista(text) FROM PUBLIC, anon;

-- As 25 linhas, conferidas no texto da RDC 1.036/2026 (ver o documento de
-- conferência). Só entra o que existe no catálogo da rede. Reaplicar não
-- duplica nem devolve linha que o super admin retirou.
INSERT INTO public.substancias_controladas (substancia, chave, grafias, lista, item, receita, adendo, rdc)
SELECT v.substancia, v.chave, v.grafias, v.lista, v.item, v.receita, v.adendo,
       'RDC ANVISA nº 1.036, de 09/07/2026 (DOU de 13/07/2026), Atualização N. 101 do Anexo I da Portaria SVS/MS nº 344/1998'
FROM (VALUES
  ('Fentanila',          'fentanila',          ARRAY['fentanil']::text[],           'A1',  42, 'notificacao_a', NULL::text),
  ('Morfina',            'morfina',            ARRAY[]::text[],                     'A1',  65, 'notificacao_a', NULL),
  -- codeína: o adendo 2 da A2 só leva à Receita de Controle Especial a preparação com até 100 mg por
  -- unidade e até 2,5% nas formas indivisíveis; a do catálogo (ampola de 30 mg/mL = 3%) passa do
  -- limite, e o app não confere a apresentação: fica a regra mais restrita, Notificação A.
  ('Codeína',            'codeina',            ARRAY[]::text[],                     'A2',   2, 'notificacao_a',
     'Lista A2, Notificação de Receita A. Exceção do adendo 2 (Receita de Controle Especial em 2 vias): só a preparação com até 100 mg de codeína por unidade posológica e até 2,5% nas formas indivisíveis; a ampola de 30 mg/mL (3%) não entra.'),
  ('Tramadol',           'tramadol',           ARRAY[]::text[],                     'A2',  13, 'controle_especial',
     'Adendo 3 da lista A2: preparação com até 100 mg de tramadol por unidade posológica vai na Receita de Controle Especial em 2 vias. Acima disso, Notificação de Receita A.'),
  ('Cetamina',           'cetamina',           ARRAY[]::text[],                     'B1',  17, 'so_estabelecimento',
     'Adendo 14 da lista B1: a dispensação e o uso da cetamina só são permitidos em estabelecimentos de saúde.'),
  ('Clonazepam',         'clonazepam',         ARRAY[]::text[],                     'B1',  21, 'notificacao_b', NULL),
  ('Diazepam',           'diazepam',           ARRAY[]::text[],                     'B1',  31, 'notificacao_b', NULL),
  ('Fenobarbital',       'fenobarbital',       ARRAY[]::text[],                     'B1',  41, 'controle_especial',
     'Adendo 2 da lista B1: medicamento com fenobarbital vai na Receita de Controle Especial em 2 vias.'),
  ('Lorazepam',          'lorazepam',          ARRAY[]::text[],                     'B1',  57, 'notificacao_b', NULL),
  ('Midazolam',          'midazolam',          ARRAY[]::text[],                     'B1',  64, 'notificacao_b', NULL),
  ('Ácido valpróico',    'acido valproico',    ARRAY[]::text[],                     'C1',   2, 'controle_especial', NULL),
  ('Amantadina',         'amantadina',         ARRAY[]::text[],                     'C1',   4, 'controle_especial', NULL),
  ('Carbamazepina',      'carbamazepina',      ARRAY[]::text[],                     'C1',  27, 'controle_especial', NULL),
  ('Etomidato',          'etomidato',          ARRAY[]::text[],                     'C1',  67, 'controle_especial', NULL),
  ('Fenitoina',          'fenitoina',          ARRAY[]::text[],                     'C1',  75, 'controle_especial', NULL),
  ('Flumazenil',         'flumazenil',         ARRAY[]::text[],                     'C1',  77, 'controle_especial', NULL),
  ('Fluoxetina',         'fluoxetina',         ARRAY[]::text[],                     'C1',  78, 'controle_especial', NULL),
  ('Haloperidol',        'haloperidol',        ARRAY[]::text[],                     'C1',  83, 'controle_especial', NULL),
  ('Levetiracetam',      'levetiracetam',      ARRAY[]::text[],                     'C1',  99, 'controle_especial', NULL),
  ('Misoprostol',        'misoprostol',        ARRAY[]::text[],                     'C1', 127, 'so_estabelecimento',
     'Adendo 4 da lista C1: a compra e o uso do misoprostol só são permitidos em estabelecimentos hospitalares cadastrados na autoridade sanitária.'),
  ('Naloxona',           'naloxona',           ARRAY[]::text[],                     'C1', 131, 'controle_especial', NULL),
  ('Propofol',           'propofol',           ARRAY[]::text[],                     'C1', 164, 'controle_especial', NULL),
  ('Selegilina',         'selegilina',         ARRAY[]::text[],                     'C1', 180, 'controle_especial', NULL),
  ('Sertralina',         'sertralina',         ARRAY[]::text[],                     'C1', 181, 'controle_especial', NULL),
  ('Valproato sódico',   'valproato sodico',   ARRAY['valproato de sodio']::text[], 'C1', 205, 'controle_especial', NULL)
) AS v(substancia, chave, grafias, lista, item, receita, adendo)
WHERE NOT EXISTS (SELECT 1 FROM public.substancias_controladas s WHERE s.chave = v.chave);

-- ── a marca no catálogo ─────────────────────────────────────────────────────
-- texto do item para comparar: o nome e o nome normalizado, sem acento
CREATE OR REPLACE FUNCTION private.nome_para_controle(p_principio text, p_norm text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT btrim(coalesce(private.norm_medicamento(p_principio), '') || ' ' || coalesce(private.norm_medicamento(p_norm), ''))
$$;
REVOKE ALL ON FUNCTION private.nome_para_controle(text, text) FROM PUBLIC, anon;

-- a substância vigente que casa com o nome (palavra inteira); a lista mais
-- restrita primeiro (A antes de B antes de C), depois o item
CREATE OR REPLACE FUNCTION private.substancia_controlada_do_nome(p_nome text)
RETURNS public.substancias_controladas LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT s.* FROM public.substancias_controladas s
   WHERE s.vigente
     AND EXISTS (SELECT 1 FROM unnest(array_prepend(s.chave, s.grafias)) g
                  WHERE g <> '' AND (' ' || coalesce(p_nome, '') || ' ') LIKE ('% ' || g || ' %'))
   ORDER BY s.lista, s.item
   LIMIT 1
$$;
REVOKE ALL ON FUNCTION private.substancia_controlada_do_nome(text) FROM PUBLIC, anon;

-- cadastro novo ou alterado: a marca é sempre recalculada (ninguém grava à mão)
CREATE OR REPLACE FUNCTION private.medicamento_marca_controlado() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.substancias_controladas;
BEGIN
  SELECT * INTO s FROM private.substancia_controlada_do_nome(private.nome_para_controle(NEW.principio_ativo, NEW.principio_ativo_norm));
  NEW.controlado_lista := s.lista;
  NEW.controlado_substancia := s.substancia;
  NEW.controlado_receita := s.receita;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS medicamento_marca_controlado ON public.medicamento;
CREATE TRIGGER medicamento_marca_controlado BEFORE INSERT OR UPDATE ON public.medicamento
  FOR EACH ROW EXECUTE FUNCTION private.medicamento_marca_controlado();

-- remarca o catálogo inteiro (backfill e mudança da tabela); devolve quantos mudaram
CREATE OR REPLACE FUNCTION private.remarcar_controlados() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n integer;
BEGIN
  WITH calc AS (
    SELECT m.id, s.lista, s.substancia, s.receita
      FROM public.medicamento m
      LEFT JOIN LATERAL private.substancia_controlada_do_nome(private.nome_para_controle(m.principio_ativo, m.principio_ativo_norm)) s ON true)
  UPDATE public.medicamento m
     SET controlado_lista = c.lista, controlado_substancia = c.substancia, controlado_receita = c.receita
    FROM calc c
   WHERE c.id = m.id
     AND (m.controlado_lista IS DISTINCT FROM c.lista OR m.controlado_substancia IS DISTINCT FROM c.substancia
          OR m.controlado_receita IS DISTINCT FROM c.receita);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION private.remarcar_controlados() FROM PUBLIC, anon, authenticated;

SELECT private.remarcar_controlados();

-- ── atualização pelo super admin (nova RDC) ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.definir_substancia_controlada(p_substancia text, p_lista text, p_item integer, p_rdc text,
  p_grafias text[] DEFAULT NULL, p_receita text DEFAULT NULL, p_adendo text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_nome text := nullif(btrim(regexp_replace(coalesce(p_substancia, ''), '\s+', ' ', 'g')), '');
  v_chave text := private.norm_medicamento(p_substancia);
  v_grafias text[];
  v_receita text := coalesce(nullif(btrim(coalesce(p_receita, '')), ''), private.receita_da_lista(p_lista));
  v_id uuid;
  v_n integer;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Só o super admin atualiza a tabela de substâncias controladas.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF length(coalesce(v_nome, '')) < 3 OR v_chave IS NULL THEN RAISE EXCEPTION 'Escreva a substância como está na RDC.'; END IF;
  IF p_lista IS NULL OR p_lista NOT IN ('A1', 'A2', 'A3', 'B1', 'B2', 'C1', 'C2', 'C3', 'C5') THEN
    RAISE EXCEPTION 'Lista inválida (A1, A2, A3, B1, B2, C1, C2, C3 ou C5).';
  END IF;
  IF p_item IS NULL OR p_item < 1 THEN RAISE EXCEPTION 'Informe o número do item na lista.'; END IF;
  IF length(btrim(coalesce(p_rdc, ''))) < 10 THEN RAISE EXCEPTION 'Informe a RDC (número e data).'; END IF;
  IF v_receita NOT IN ('notificacao_a', 'notificacao_b', 'notificacao_b2', 'controle_especial', 'notificacao_c2', 'notificacao_c3', 'so_estabelecimento') THEN
    RAISE EXCEPTION 'Receita inválida.';
  END IF;
  SELECT coalesce(array_agg(DISTINCT g ORDER BY g), '{}') INTO v_grafias
    FROM (SELECT private.norm_medicamento(x) AS g FROM unnest(coalesce(p_grafias, '{}'::text[])) x) q
   WHERE g IS NOT NULL AND length(g) >= 3 AND g <> v_chave;

  -- a linha vigente da mesma substância é substituída (fica no histórico)
  UPDATE public.substancias_controladas
     SET vigente = false, retirada_em = now(), retirada_por = private.meu_perfil_id(),
         retirada_rdc = btrim(p_rdc), retirada_motivo = 'Substituída por nova definição'
   WHERE chave = v_chave AND vigente;
  INSERT INTO public.substancias_controladas (substancia, chave, grafias, lista, item, receita, adendo, rdc, definida_por)
  VALUES (v_nome, v_chave, v_grafias, p_lista, p_item, v_receita, nullif(btrim(coalesce(p_adendo, '')), ''), btrim(p_rdc), private.meu_perfil_id())
  RETURNING id INTO v_id;
  v_n := private.remarcar_controlados();
  PERFORM private.registrar_auditoria('definir_substancia_controlada', 'substancias_controladas', v_id, NULL,
    jsonb_build_object('tipo', p_lista, 'quantidade', v_n, 'situacao', 'vigente'));
  RETURN jsonb_build_object('id', v_id, 'remarcados', v_n);
END $$;
REVOKE ALL ON FUNCTION public.definir_substancia_controlada(text, text, integer, text, text[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.definir_substancia_controlada(text, text, integer, text, text[], text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.retirar_substancia_controlada(p_substancia uuid, p_rdc text, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE s public.substancias_controladas; v_n integer;
BEGIN
  PERFORM private.exigir_segundo_fator();
  IF NOT private.eh_super_admin() THEN
    RAISE EXCEPTION 'Só o super admin atualiza a tabela de substâncias controladas.' USING ERRCODE = 'insufficient_privilege';
  END IF;
  SELECT * INTO s FROM public.substancias_controladas WHERE id = p_substancia FOR UPDATE;
  IF s.id IS NULL OR NOT s.vigente THEN RAISE EXCEPTION 'Substância não encontrada ou já retirada.'; END IF;
  IF length(btrim(coalesce(p_rdc, ''))) < 10 THEN RAISE EXCEPTION 'Informe a RDC que retirou a substância (número e data).'; END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN RAISE EXCEPTION 'Escreva o motivo (mínimo de 10 letras).'; END IF;
  UPDATE public.substancias_controladas
     SET vigente = false, retirada_em = now(), retirada_por = private.meu_perfil_id(),
         retirada_rdc = btrim(p_rdc), retirada_motivo = btrim(p_motivo)
   WHERE id = s.id;
  v_n := private.remarcar_controlados();
  PERFORM private.registrar_auditoria('retirar_substancia_controlada', 'substancias_controladas', s.id, NULL,
    jsonb_build_object('tipo', s.lista, 'quantidade', v_n, 'situacao', 'retirada'));
  RETURN jsonb_build_object('id', s.id, 'remarcados', v_n);
END $$;
REVOKE ALL ON FUNCTION public.retirar_substancia_controlada(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.retirar_substancia_controlada(uuid, text, text) TO authenticated;

-- ── C5: liberação da farmácia ───────────────────────────────────────────────
-- alta vigilância da unidade (ISMP + ajustes) OU controlado (a unidade não desmarca)
CREATE OR REPLACE FUNCTION private.exige_liberacao_farmacia(p_unidade uuid, p_medicamento uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT private.exige_dupla_checagem(p_unidade, p_medicamento)
      OR coalesce((SELECT m.controlado_lista IS NOT NULL FROM public.medicamento m WHERE m.id = p_medicamento), false)
$$;
REVOKE ALL ON FUNCTION private.exige_liberacao_farmacia(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.exige_liberacao_farmacia(uuid, uuid) TO authenticated;

-- troca de trecho: pula o que já foi trocado; trecho que sumiu para com erro
CREATE OR REPLACE FUNCTION pg_temp.trocar_controlados(f regprocedure, trechos text[]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE def text := replace(pg_get_functiondef(f), E'\r', ''); i int; mudou boolean := false;
BEGIN
  FOR i IN 1 .. array_length(trechos, 1) BY 2 LOOP
    IF position(trechos[i + 1] IN def) > 0 THEN CONTINUE; END IF;
    IF position(trechos[i] IN def) = 0 THEN
      RAISE EXCEPTION '%: trecho não encontrado: %', f, trechos[i];
    END IF;
    def := replace(def, trechos[i], trechos[i + 1]);
    mudou := true;
  END LOOP;
  IF mudou THEN EXECUTE def; END IF;
END $$;

-- checar: o controlado sem liberação também pede justificativa
SELECT pg_temp.trocar_controlados('public.checar(uuid, text, text, text)'::regprocedure, ARRAY[
  $a$IF p_situacao = 'feito' AND it.medicamento_id IS NOT NULL AND private.exige_dupla_checagem(pr.unidade_id, it.medicamento_id)$a$,
  $b$IF p_situacao = 'feito' AND it.medicamento_id IS NOT NULL AND private.exige_liberacao_farmacia(pr.unidade_id, it.medicamento_id)$b$,
  $a$RAISE EXCEPTION 'Alta vigilância sem liberação da farmácia: escreva a justificativa (mínimo de 10 letras). O farmacêutico confere depois.';$a$,
  $b$IF NOT private.exige_dupla_checagem(pr.unidade_id, it.medicamento_id) THEN
        RAISE EXCEPTION 'Medicamento controlado sem liberação da farmácia: escreva a justificativa (mínimo de 10 letras). O farmacêutico confere depois.';
      END IF;
      RAISE EXCEPTION 'Alta vigilância sem liberação da farmácia: escreva a justificativa (mínimo de 10 letras). O farmacêutico confere depois.';$b$]);

-- liberacao_farmacia: devolve também o controlado, com a lista
SELECT pg_temp.trocar_controlados('public.liberacao_farmacia(uuid[])'::regprocedure, ARRAY[
  $a$'regra', coalesce(m.alta_vigilancia_regra, 'Marcado pela farmácia'),$a$,
  $b$'regra', CASE WHEN private.exige_dupla_checagem(pr.unidade_id, it.medicamento_id) THEN coalesce(m.alta_vigilancia_regra, 'Marcado pela farmácia')
                       ELSE 'Medicamento controlado, lista ' || m.controlado_lista || ' (Portaria 344)' END,
           'alta_vigilancia', private.exige_dupla_checagem(pr.unidade_id, it.medicamento_id),
           'controlado', m.controlado_lista, 'controlado_receita', m.controlado_receita,$b$,
  $a$AND private.exige_dupla_checagem(pr.unidade_id, it.medicamento_id);$a$,
  $b$AND private.exige_liberacao_farmacia(pr.unidade_id, it.medicamento_id);$b$]);

-- fila_validacao: o controlado vem na frente, como a alta vigilância
SELECT pg_temp.trocar_controlados('public.fila_validacao(uuid)'::regprocedure, ARRAY[
  $a$(CASE WHEN it.medicamento_id IS NULL THEN false ELSE private.exige_dupla_checagem(pr.unidade_id, it.medicamento_id) END) DESC,$a$,
  $b$(CASE WHEN it.medicamento_id IS NULL THEN false ELSE private.exige_liberacao_farmacia(pr.unidade_id, it.medicamento_id) END) DESC,$b$]);

DROP FUNCTION pg_temp.trocar_controlados(regprocedure, text[]);

-- ── leitura para as telas: a lista de cada item ─────────────────────────────
-- Mesmo acesso de horarios_dos_itens (segundo fator e membro da unidade).
CREATE OR REPLACE FUNCTION public.controle_dos_itens(p_itens uuid[])
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('item_id', it.id, 'medicamento_id', m.id, 'lista', m.controlado_lista,
           'substancia', m.controlado_substancia, 'receita', m.controlado_receita)), '[]'::jsonb)
    FROM public.prescricao_itens it
    JOIN public.prescricoes pr ON pr.id = it.prescricao_id
    JOIN public.medicamento m ON m.id = it.medicamento_id
   WHERE it.id = ANY (p_itens) AND m.controlado_lista IS NOT NULL
     AND private.segundo_fator_ok() AND private.membro_da_unidade(pr.unidade_id);
$$;
REVOKE ALL ON FUNCTION public.controle_dos_itens(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.controle_dos_itens(uuid[]) TO authenticated;
