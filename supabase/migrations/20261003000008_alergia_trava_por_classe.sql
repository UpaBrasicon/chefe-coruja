-- ════════════════════════════════════════════════════════════════════════════
-- Alergia trava a prescrição também pela CLASSE (decisão do usuário em
-- 29/09/2026: "trava a prescrição se alergia presente").
--
-- Antes a trava comparava só o nome: "Penicilinas" (do catálogo de
-- alergênios) não travava amoxicilina, e nem "penicilina G" por causa do
-- plural. Agora o item de medicamento é recusado quando o paciente tem alergia
-- ativa:
--   1. ao mesmo medicamento do cadastro (alergias_paciente.medicamento_id);
--   2. ao mesmo princípio ativo (a regra de nome de antes, sem mudança);
--   3. à CLASSE do princípio ativo — a alergia registrada com o nome da
--      classe (ou um sinônimo, no singular ou no plural) trava todos os
--      princípios ativos que pertencem a ela.
--
-- As classes e seus membros seguem a Classificação Anatômica Terapêutica
-- Química (ATC) da OMS — WHO Collaborating Centre for Drug Statistics
-- Methodology, ATC/DDD Index (atcddd.fhi.no) —, grupo a grupo, com os nomes
-- pela DCB. É pertencimento à classe farmacológica, não reatividade cruzada
-- entre classes (penicilina × cefalosporina é julgamento clínico e fica com o
-- médico). "Anticonvulsivantes aromáticos" não é grupo ATC: continua travando
-- só por nome até haver fonte aprovada pelo responsável técnico.
--
-- A tabela de classes é referência nacional (sem unidade): leitura para
-- autenticados, escrita só por migration.
--
-- DOWN: reaplicar public.prescrever de 20260929000005; DROP FUNCTION
-- private.alergia_que_trava; DROP TABLE public.classe_alergenica_membro,
-- public.classe_alergenica.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.classe_alergenica (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL UNIQUE,
  atc        text NOT NULL,
  sinonimos  text[] NOT NULL DEFAULT '{}',
  fonte      text NOT NULL DEFAULT 'OMS — WHOCC, Classificação ATC (ATC/DDD Index)'
);
CREATE TABLE IF NOT EXISTS public.classe_alergenica_membro (
  classe_id  uuid NOT NULL REFERENCES public.classe_alergenica(id) ON DELETE CASCADE,
  -- trecho do princípio ativo normalizado (private.norm): pega sais e
  -- associações ("amoxicilina + clavulanato", "cetorolaco de trometamina")
  principio  text NOT NULL,
  PRIMARY KEY (classe_id, principio)
);
ALTER TABLE public.classe_alergenica ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classe_alergenica_membro ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS classe_alergenica_leitura ON public.classe_alergenica;
CREATE POLICY classe_alergenica_leitura ON public.classe_alergenica FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS classe_alergenica_membro_leitura ON public.classe_alergenica_membro;
CREATE POLICY classe_alergenica_membro_leitura ON public.classe_alergenica_membro FOR SELECT TO authenticated USING (true);
REVOKE INSERT, UPDATE, DELETE ON public.classe_alergenica, public.classe_alergenica_membro FROM anon, authenticated;
GRANT SELECT ON public.classe_alergenica, public.classe_alergenica_membro TO authenticated;

-- ── as classes (grupos ATC) e seus membros ─────────────────────────────────
WITH c(nome, atc, sinonimos, membros) AS (VALUES
  ('Penicilinas', 'J01C', ARRAY['penicilina', 'betalactamicos penicilinicos'],
   ARRAY['penicilina', 'amoxicilina', 'ampicilina', 'oxacilina', 'piperacilina', 'dicloxacilina', 'cloxacilina', 'flucloxacilina', 'ticarcilina', 'temocilina']),
  ('Cefalosporinas', 'J01DB–J01DI', ARRAY['cefalosporina'],
   ARRAY['cefalexina', 'cefadroxila', 'cefazolina', 'cefalotina', 'cefuroxima', 'cefoxitina', 'cefaclor', 'ceftriaxona', 'cefotaxima', 'ceftazidima', 'cefepima', 'ceftarolina', 'ceftolozano', 'cefiderocol']),
  ('Carbapenêmicos', 'J01DH', ARRAY['carbapenemico', 'carbapenem', 'carbapenens'],
   ARRAY['meropenem', 'imipenem', 'ertapenem', 'doripenem']),
  ('Sulfonamidas', 'J01E', ARRAY['sulfonamida', 'sulfa', 'sulfas'],
   ARRAY['sulfametoxazol', 'sulfadiazina', 'sulfadoxina']),
  ('Anti-inflamatórios não esteroides', 'M01A e N02BA', ARRAY['anti-inflamatorio nao esteroide', 'aine', 'aines', 'ains'],
   ARRAY['ibuprofeno', 'diclofenaco', 'cetoprofeno', 'naproxeno', 'cetorolaco', 'meloxicam', 'piroxicam', 'tenoxicam', 'nimesulida', 'indometacina', 'celecoxibe', 'etoricoxibe', 'parecoxibe', 'acido mefenamico', 'acido acetilsalicilico']),
  ('Opioides', 'N02A', ARRAY['opioide', 'opiaceos', 'opiaceo'],
   ARRAY['morfina', 'codeina', 'tramadol', 'fentanila', 'fentanil', 'metadona', 'oxicodona', 'hidromorfona', 'petidina', 'meperidina', 'remifentanila', 'sufentanila', 'alfentanila', 'buprenorfina', 'nalbufina', 'tapentadol']),
  ('Macrolídeos', 'J01FA', ARRAY['macrolideo'],
   ARRAY['azitromicina', 'claritromicina', 'eritromicina', 'roxitromicina']),
  ('Quinolonas', 'J01M', ARRAY['quinolona', 'fluoroquinolona', 'fluoroquinolonas'],
   ARRAY['ciprofloxacino', 'levofloxacino', 'moxifloxacino', 'norfloxacino', 'ofloxacino']),
  ('Aminoglicosídeos', 'J01GB', ARRAY['aminoglicosideo'],
   ARRAY['gentamicina', 'amicacina', 'tobramicina', 'estreptomicina', 'neomicina']),
  ('Bloqueadores neuromusculares', 'M03A', ARRAY['bloqueador neuromuscular'],
   ARRAY['suxametonio', 'succinilcolina', 'rocuronio', 'vecuronio', 'atracurio', 'cisatracurio', 'pancuronio']),
  ('Anestésicos locais', 'N01B', ARRAY['anestesico local'],
   ARRAY['lidocaina', 'bupivacaina', 'levobupivacaina', 'ropivacaina', 'mepivacaina', 'prilocaina']),
  ('Contraste iodado', 'V08A', ARRAY['contrastes iodados', 'contraste iodado'],
   ARRAY['iohexol', 'iopamidol', 'ioversol', 'iodixanol', 'iopromida', 'ioxaglato', 'amidotrizoato', 'diatrizoato'])
), ins AS (
  INSERT INTO public.classe_alergenica (nome, atc, sinonimos)
  SELECT nome, atc, sinonimos FROM c
  ON CONFLICT (nome) DO UPDATE SET atc = EXCLUDED.atc, sinonimos = EXCLUDED.sinonimos
  RETURNING id, nome
)
INSERT INTO public.classe_alergenica_membro (classe_id, principio)
SELECT ins.id, unnest(c.membros) FROM ins JOIN c ON c.nome = ins.nome
ON CONFLICT DO NOTHING;

-- ── a regra da trava, num lugar só ──────────────────────────────────────────
-- Devolve a substância registrada que trava o medicamento, ou NULL.
CREATE OR REPLACE FUNCTION private.alergia_que_trava(p_paciente uuid, p_medicamento uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH m AS (SELECT id, principio_ativo_norm AS pa FROM public.medicamento WHERE id = p_medicamento),
  al AS (
    SELECT a.substancia, a.substancia_norm AS sn, a.medicamento_id
    FROM public.alergias_paciente a
    WHERE a.paciente_id = p_paciente AND a.inativada_em IS NULL
  ),
  -- as classes que a alergia nomeia (nome ou sinônimo, com e sem o "s" final)
  classes_da_alergia AS (
    SELECT al.substancia, ca.id AS classe_id
    FROM al JOIN public.classe_alergenica ca
      ON EXISTS (SELECT 1 FROM unnest(array_append(ca.sinonimos, ca.nome)) s(nome)
                 WHERE private.norm(s.nome) IN (al.sn, regexp_replace(al.sn, 's$', ''), al.sn || 's')
                    OR regexp_replace(private.norm(s.nome), 's$', '') = regexp_replace(al.sn, 's$', ''))
  )
  SELECT substancia FROM (
    SELECT al.substancia, 1 AS ordem FROM al, m WHERE al.medicamento_id = m.id
    UNION ALL
    SELECT al.substancia, 2 FROM al, m
     WHERE m.pa LIKE '%' || al.sn || '%' OR al.sn LIKE '%' || m.pa || '%'
        OR m.pa LIKE '%' || regexp_replace(al.sn, 's$', '') || '%'
    UNION ALL
    SELECT cda.substancia, 3 FROM classes_da_alergia cda, m
     WHERE EXISTS (SELECT 1 FROM public.classe_alergenica_membro mb
                   WHERE mb.classe_id = cda.classe_id AND m.pa LIKE '%' || mb.principio || '%')
  ) t
  ORDER BY ordem
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION private.alergia_que_trava(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.alergia_que_trava(uuid, uuid) TO authenticated;

-- Para a tela avisar antes de enviar (a trava que vale é a do servidor).
CREATE OR REPLACE FUNCTION public.alergia_trava_medicamento(p_paciente uuid, p_medicamento uuid)
RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT private.pode_atuar_no_paciente(p_paciente) THEN RETURN NULL; END IF;
  RETURN private.alergia_que_trava(p_paciente, p_medicamento);
END $$;
REVOKE ALL ON FUNCTION public.alergia_trava_medicamento(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alergia_trava_medicamento(uuid, uuid) TO authenticated;

-- ── prescrever: a definição vigente, só com o bloco da alergia trocado ──────
CREATE OR REPLACE FUNCTION public.prescrever(p_paciente uuid, p_item jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_alergia text;
  v_presc uuid; v_unidade uuid; v_nasc date; v_peso numeric; v_desde timestamptz; v_id uuid;
  v_tipo text := coalesce(p_item ->> 'tipo', 'medicamento');
  m public.medicamento; dv record; al record;
  v_dil_id uuid; v_dil_versao int; v_dil_texto text;
  v_via text := upper(nullif(btrim(p_item ->> 'via'), ''));
  v_dil_div text := nullif(btrim(p_item ->> 'diluicao_divergente'), '');
BEGIN
  PERFORM private.exigir_segundo_fator();
  SELECT unidade_id, data_nascimento INTO v_unidade, v_nasc FROM public.pacientes WHERE id = p_paciente;
  IF v_unidade IS NULL THEN RAISE EXCEPTION 'Paciente não encontrado.'; END IF;
  IF NOT private.paciente_no_meu_plantao(p_paciente) OR private.tenho_papel(v_unidade, 'plantonista') IS NOT TRUE THEN
    RAISE EXCEPTION 'A prescrição é do médico de plantão no setor do paciente.';
  END IF;

  IF v_tipo = 'cuidado' THEN
    IF length(btrim(coalesce(p_item ->> 'descricao', ''))) < 3 THEN RAISE EXCEPTION 'Descreva o cuidado.'; END IF;
  ELSIF v_tipo = 'medicamento' THEN
    SELECT * INTO m FROM public.medicamento WHERE id = nullif(p_item ->> 'medicamento_id', '')::uuid AND ativo;
    IF NOT FOUND THEN RAISE EXCEPTION 'Escolha o medicamento do cadastro.'; END IF;
    IF length(btrim(coalesce(p_item ->> 'dose', ''))) = 0 THEN RAISE EXCEPTION 'Informe a dose.'; END IF;
    IF v_via IS NULL THEN RAISE EXCEPTION 'Informe a via.'; END IF;
    IF length(btrim(coalesce(p_item ->> 'posologia', ''))) = 0 THEN RAISE EXCEPTION 'Informe a frequência.'; END IF;
    -- alergia trava o item (e nada a contorna): mesmo medicamento, mesmo
    -- princípio ativo ou a classe (ATC) dele — private.alergia_que_trava
    v_alergia := private.alergia_que_trava(p_paciente, m.id);
    IF v_alergia IS NOT NULL THEN
      RAISE EXCEPTION 'ALERGIA: o paciente tem alergia registrada a "%". Este item não foi prescrito.', v_alergia;
    END IF;
    -- pediatria: peso aferido no episódio
    IF v_nasc IS NOT NULL AND v_nasc > current_date - interval '14 years' THEN
      SELECT coalesce((SELECT chegada_em FROM public.episodios WHERE id = private.episodio_aberto(p_paciente)), now() - interval '24 hours') INTO v_desde;
      SELECT o.valor_num INTO v_peso FROM public.observacao o
        JOIN public.conceito c ON c.id = o.conceito_id AND c.nome = 'peso' AND c.unidade_id IS NULL
       WHERE o.paciente_id = p_paciente AND o.aferido_em >= v_desde AND o.valor_num > 0
       ORDER BY o.aferido_em DESC LIMIT 1;
      IF v_peso IS NULL THEN RAISE EXCEPTION 'Criança: registre o peso aferido neste atendimento antes de prescrever medicamento.'; END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Tipo de item desconhecido.';
  END IF;

  v_presc := private.prescricao_do_paciente(p_paciente, true);
  IF v_presc IS NULL THEN RAISE EXCEPTION 'O paciente não tem episódio aberto nem internação ativa.'; END IF;
  IF v_tipo = 'medicamento' AND EXISTS (
       SELECT 1 FROM public.prescricao_itens WHERE prescricao_id = v_presc AND medicamento_id = m.id AND upper(via) = v_via AND suspenso_em IS NULL) THEN
    RAISE EXCEPTION 'Este medicamento já está prescrito por esta via. Suspenda o anterior para mudar.';
  END IF;

  -- diluição vigente agora (a da unidade tem preferência)
  IF v_tipo = 'medicamento' THEN
    SELECT * INTO dv FROM public.diluicao_vigente(m.id, v_via, now(), v_unidade);
    IF FOUND THEN v_dil_id := dv.id; v_dil_versao := dv.versao; v_dil_texto := dv.texto; END IF;
    IF v_dil_div IS NOT NULL AND length(btrim(coalesce(p_item ->> 'justificativa_divergencia', ''))) < 10 THEN
      RAISE EXCEPTION 'Diluição diferente do padrão só com justificativa (mínimo de 10 letras).';
    END IF;
  END IF;

  INSERT INTO public.prescricao_itens (prescricao_id, medicamento_id, descricao, dose, via, posologia, se_necessario, observacao,
    tipo, peso_kg, diluicao_id, diluicao_versao, diluicao_texto, diluicao_divergente, justificativa_divergencia, autor_id, ordem)
  VALUES (v_presc, m.id,
          CASE WHEN v_tipo = 'cuidado' THEN btrim(p_item ->> 'descricao') ELSE m.principio_ativo || coalesce(' ' || m.apresentacao, '') END,
          nullif(btrim(p_item ->> 'dose'), ''), v_via, nullif(btrim(p_item ->> 'posologia'), ''),
          coalesce((p_item ->> 'se_necessario')::boolean, false), nullif(btrim(p_item ->> 'observacao'), ''),
          v_tipo, v_peso, v_dil_id, v_dil_versao, coalesce(v_dil_div, v_dil_texto), v_dil_div IS NOT NULL,
          CASE WHEN v_dil_div IS NOT NULL THEN btrim(p_item ->> 'justificativa_divergencia') END,
          private.meu_perfil_id(),
          coalesce((SELECT max(ordem) + 1 FROM public.prescricao_itens WHERE prescricao_id = v_presc), 1))
  RETURNING id INTO v_id;
  RETURN v_id;
END $function$;
