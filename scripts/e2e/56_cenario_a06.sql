-- ════════════════════════════════════════════════════════════════════════════
-- Teste ponta a ponta da rede (docs/teste-rede/, tarefa 2): cenário A06.
-- Recém-nascido vinculado à mãe e regulação neonatal com incubadora.
-- Especificação: CENARIOS-A, seção A06.
--
-- UPA: cadastro da mãe → "RN de" pelo cadastro dela → triagem e atendimento do
-- neonato → exames → regulação (incubadora obrigatória) → pendência respondida
-- pelo NIR → autorização → aceite do hospital (leito CM) → saída e chegada →
-- porta do hospital (ficha, classificação, internação no leito reservado) →
-- alta da mãe na UPA. Contas da mãe e do RN independentes.
-- Cada passo roda COMO a conta do papel (RLS ligado); resultado em
-- e2e.resultados (passos 'A06.NN.*', paciente = 6). Nada é corrigido no produto.
-- Sem dose: o neonato só recebe item de cuidado que cita ped-ictericia-neonatal.
-- A cor é a escolha da enfermeira de teste. Leito do hospital: um CM livre que
-- NÃO seja o CM-01 nem o CM-02 (ocupados ou reservados por outros cenários).
--
-- Rodar antes: 41_checkin_fase5.sql.
-- Uso: node scripts/e2e/homolog/preparar.mjs scripts/e2e/56_cenario_a06.sql <saida>.sql
--      npx supabase db query --linked -f <saida>.sql
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on

-- ── apoio do roteiro (mesmo corpo do 50; recriados aqui) ────────────────────
CREATE OR REPLACE FUNCTION e2e.confere(p boolean, p_msg text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p IS NOT TRUE THEN RAISE EXCEPTION 'confere: %', p_msg; END IF;
  RETURN 'ok: ' || p_msg;
END $$;
GRANT EXECUTE ON FUNCTION e2e.confere(boolean, text) TO authenticated;
CREATE OR REPLACE FUNCTION e2e.falhar(p text) RETURNS text LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION '%', p; END $$;
GRANT EXECUTE ON FUNCTION e2e.falhar(text) TO authenticated;
CREATE OR REPLACE FUNCTION e2e.guardar(p_nome text, p_valor text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO e2e.vars VALUES (p_nome, p_valor) ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor
$$;
CREATE OR REPLACE FUNCTION e2e.cns(p_n int) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE base text; s int; d int; k int := 0; i int;
BEGIN
  LOOP
    base := '7' || lpad((90000000000 + p_n * 7 + k)::text, 13, '0');
    s := 0;
    FOR i IN 1..14 LOOP s := s + substr(base, i, 1)::int * (16 - i); END LOOP;
    d := (11 - s % 11) % 11;
    IF d < 10 THEN RETURN base || d; END IF;
    k := k + 1;
  END LOOP;
END $$;

-- ── apoio do bloco A (A02 a A06; mesmo corpo nos scripts 52 a 56) ──────────
-- sinais vitais crus como a tela grava (sincronizar_registros), com o método do peso
CREATE OR REPLACE FUNCTION e2e.ba_sinais(p_pac uuid, p_sinais jsonb, p_internacao uuid DEFAULT NULL, p_metodo text DEFAULT NULL)
RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT format($q$SELECT CASE WHEN bool_and(x ->> 'status' = 'gravado') THEN count(*)::text || ' sinais gravados'
                             ELSE e2e.falhar(string_agg(coalesce(x ->> 'motivo', x::text), '; ')) END
                     FROM jsonb_array_elements(public.sincronizar_registros(%L::jsonb)::jsonb) x$q$,
    (SELECT jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'tipo', 'observacao', 'hora', now(), 'sem_conexao', false,
              'aparelho_id', 'e2e-bloco-a',
              'dados', jsonb_build_object('paciente_id', p_pac, 'internacao_id', p_internacao,
                         'conceito_id', (SELECT c.id FROM public.conceito c WHERE c.nome = k.key AND c.unidade_id IS NULL),
                         'valor_num', k.value, 'origem', 'manual', 'metodo', p_metodo)))
       FROM jsonb_each(p_sinais) k))
$$;
-- conferência no banco, como postgres (o que a tela não mostra)
CREATE OR REPLACE FUNCTION e2e.ba_banco(p_n int, p_passo text, p_descricao text, p_sql text, p_guardar text DEFAULT NULL) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r text; v_sit text; v_det text;
BEGIN
  BEGIN
    EXECUTE p_sql INTO r;
    IF p_guardar IS NOT NULL THEN
      IF r IS NULL THEN RAISE EXCEPTION 'nenhuma linha'; END IF;
      PERFORM e2e.guardar(p_guardar, r);
    END IF;
    v_sit := 'ok'; v_det := left(r, 400);
  EXCEPTION WHEN OTHERS THEN
    v_sit := 'falha'; v_det := SQLSTATE || ': ' || SQLERRM;
  END;
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES (p_passo, p_n, 'banco', NULL, p_descricao, 'ok', v_sit, v_det);
  RETURN v_sit || ' — ' || p_passo || ' — ' || coalesce(v_det, '');
END $$;
-- passo que depende de ids de passos anteriores (lista separada por vírgula):
-- sem algum deles, vira lacuna "bloqueado pelo passo X"
CREATE OR REPLACE FUNCTION e2e.ba(p_n int, p_dep text, p_dep_passo text, p_passo text, p_papel text, p_rota text, p_descricao text,
                                 p_sql text, p_esperado text DEFAULT 'ok', p_guardar text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE d text;
BEGIN
  FOREACH d IN ARRAY string_to_array(coalesce(p_dep, ''), ',') LOOP
    IF btrim(d) <> '' AND e2e.v(btrim(d)) IS NULL THEN
      RETURN e2e.lacuna(p_passo, p_n, p_papel, p_descricao, 'bloqueado pelo passo ' || p_dep_passo || ' (sem ' || btrim(d) || ')');
    END IF;
  END LOOP;
  IF p_papel = 'banco' THEN RETURN e2e.ba_banco(p_n, p_passo, p_descricao, p_sql, p_guardar); END IF;
  RETURN e2e.ba_passo(p_passo, p_n, p_papel, p_rota, p_descricao, p_sql, p_esperado, p_guardar);
END $$;
-- ajuste de ambiente (datas, prazo) que não derruba a rodada se falhar
CREATE OR REPLACE FUNCTION e2e.ba_ajuste(p_n int, p_passo text, p_descricao text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  IF p_sql IS NULL THEN
    RETURN e2e.lacuna(p_passo, p_n, NULL, p_descricao, 'bloqueado: faltou o id de um passo anterior');
  END IF;
  BEGIN
    EXECUTE p_sql;
    INSERT INTO e2e.resultados (passo, paciente, descricao, esperado, situacao, detalhe) VALUES (p_passo, p_n, p_descricao, 'ajuste', 'ajuste', left(p_sql, 400));
    RETURN 'ajuste — ' || p_passo;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO e2e.resultados (passo, paciente, descricao, esperado, situacao, detalhe) VALUES (p_passo, p_n, p_descricao, 'ajuste', 'falha', 'ajuste recusado: ' || SQLERRM);
    RETURN 'falha — ' || p_passo;
  END;
END $$;
-- passo só de registro: roda como o papel, guarda "aceito" ou "recusado" e desfaz o que fez
CREATE OR REPLACE FUNCTION e2e.ba_registra(p_n int, p_passo text, p_papel text, p_rota text, p_descricao text, p_sql text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_det text;
BEGIN
  IF p_sql IS NULL THEN RETURN e2e.lacuna(p_passo, p_n, p_papel, p_descricao, 'bloqueado: faltou o id de um passo anterior'); END IF;
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', e2e.conta_a(p_papel), 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    EXECUTE p_sql;
    PERFORM set_config('role', 'postgres', true);
    RAISE EXCEPTION 'e2e_desfazer';
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('role', 'postgres', true);
    v_det := CASE WHEN SQLERRM = 'e2e_desfazer' THEN 'ACEITO (a ação foi desfeita para não mudar o cenário)' ELSE 'RECUSADO: ' || SQLERRM END;
  END;
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES (p_passo, p_n, p_papel, p_rota, p_descricao, 'registrar', 'ok', v_det);
  RETURN 'registrado — ' || p_passo || ' — ' || v_det;
END $$;
-- SQL que leva um episódio da UBS (e os sinais de agora) para o passado
CREATE OR REPLACE FUNCTION e2e.ba_sql_passado(p_ep uuid, p_pac uuid, p_dias int) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN p_ep IS NULL OR p_pac IS NULL THEN NULL ELSE
    format($q$UPDATE public.episodios SET chegada_em = chegada_em - %1$L::interval,
                     atendimento_iniciado_em = atendimento_iniciado_em - %1$L::interval,
                     classificado_em = classificado_em - %1$L::interval, desfecho_em = desfecho_em - %1$L::interval,
                     encerrado_em = encerrado_em - %1$L::interval WHERE id = %2$L;
                   UPDATE public.observacao SET aferido_em = aferido_em - %1$L::interval
                    WHERE paciente_id = %3$L AND aferido_em >= now() - interval '1 minute'$q$,
           p_dias || ' days', p_ep, p_pac) END
$$;
-- contas do bloco A: as do framework (47) mais as três do 49a
CREATE OR REPLACE FUNCTION e2e.conta_a(p_papel text) RETURNS uuid LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_papel
    WHEN 'f5_med_obsped' THEN 'f5200000-0000-4000-8000-0000000000a1'::uuid
    WHEN 'f5_enf_obsped' THEN 'f5200000-0000-4000-8000-0000000000a2'::uuid
    WHEN 'f5_enf_int'    THEN 'f5200000-0000-4000-8000-0000000000a3'::uuid
    ELSE e2e.conta(p_papel) END
$$;
-- e2e.passo do 04 com as contas do bloco A (e2e.conta_a); o e2e.passo do 04 não é tocado
CREATE OR REPLACE FUNCTION e2e.ba_passo(p_passo text, p_paciente int, p_papel text, p_rota text, p_descricao text,
                                    p_sql text, p_esperado text DEFAULT 'ok', p_guardar text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_resultado text; v_situacao text; v_detalhe text;
BEGIN
  BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', e2e.conta_a(p_papel), 'role', 'authenticated')::text, true);
    PERFORM set_config('role', 'authenticated', true);
    EXECUTE p_sql INTO v_resultado;
    PERFORM set_config('role', 'postgres', true);
    IF p_esperado = 'ok' THEN
      v_situacao := 'ok'; v_detalhe := left(v_resultado, 400);
      IF p_guardar IS NOT NULL THEN
        INSERT INTO e2e.vars VALUES (p_guardar, v_resultado) ON CONFLICT (nome) DO UPDATE SET valor = excluded.valor;
      END IF;
    ELSE
      v_situacao := 'falha'; v_detalhe := 'PASSOU sem erro (deveria ser recusado): ' || left(coalesce(v_resultado, ''), 300);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('role', 'postgres', true);
    IF p_esperado = 'ok' THEN
      v_situacao := 'falha'; v_detalhe := SQLSTATE || ': ' || SQLERRM;
    ELSIF p_esperado = 'erro' OR SQLERRM LIKE substr(p_esperado, 6) || '%' THEN
      v_situacao := 'ok'; v_detalhe := 'recusado: ' || SQLERRM;
    ELSE
      v_situacao := 'falha'; v_detalhe := 'recusado com outra mensagem: ' || SQLERRM;
    END IF;
  END;
  INSERT INTO e2e.resultados (passo, paciente, papel, rota, descricao, esperado, situacao, detalhe)
  VALUES (p_passo, p_paciente, p_papel, p_rota, p_descricao, p_esperado, v_situacao, v_detalhe);
  RETURN v_situacao || ' — ' || p_passo || ' — ' || coalesce(v_detalhe, '');
END $$;

-- ── rodada ──────────────────────────────────────────────────────────────────
SELECT e2e.guardar('a06_rodada', (coalesce(e2e.v('a06_rodada')::int, 0) + 1)::text);
SELECT e2e.guardar('a06_inicio', now()::text);
DELETE FROM e2e.vars WHERE nome LIKE 'a06\_%' AND nome NOT IN ('a06_rodada', 'a06_inicio');
SELECT e2e.guardar('a06_nomeJ', 'Joana A06 Teste' || CASE WHEN e2e.v('a06_rodada')::int > 1 THEN ' ' || chr(64 + e2e.v('a06_rodada')::int) ELSE '' END);
SELECT e2e.guardar('a06_nomeRN', 'RN de ' || e2e.v('a06_nomeJ'));
SELECT e2e.guardar('a06_nascRN', (private.data_atual() - 5)::text);
SELECT e2e.guardar('a06_cadJ', jsonb_build_object('nome', e2e.v('a06_nomeJ'), 'data_nascimento', '2002-03-20', 'sexo', 'F', 'raca_cor', 'parda',
  'cns', e2e.cns(70600 + e2e.v('a06_rodada')::int), 'nome_mae', 'Mãe Fictícia de Joana A06', 'endereco', 'Rua do Teste, 6',
  'municipio', 'Cidade Teste', 'uf', 'SP')::text);
-- cadastro do RN na porta do hospital (cadastro novo na unidade, com o nome da mãe)
SELECT e2e.guardar('a06_cadRN_hosp', jsonb_build_object('nome', e2e.v('a06_nomeRN'), 'data_nascimento', e2e.v('a06_nascRN'), 'sexo', 'M',
  'nome_mae', e2e.v('a06_nomeJ'), 'responsavel_nome', e2e.v('a06_nomeJ'), 'responsavel_parentesco', 'mãe',
  'endereco', 'Rua do Teste, 6', 'municipio', 'Cidade Teste', 'uf', 'SP')::text);

-- ── 1. mãe: cadastro e ficha no PS ──────────────────────────────────────────
SELECT e2e.ba_passo('A06.01.ficha_mae', 6, 'f5_rec_upa', '/recepcao (Nova ficha)', 'Cadastra Joana (CNS válido) e abre a ficha dela no PS (dor mamária, parto há 5 dias fora da rede)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Dor mamária, parto há 5 dias fora da rede', NULL, %L::jsonb) ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', e2e.v('a06_cadJ')), 'ok', 'a06_epJ');
SELECT e2e.ba(6, 'a06_epJ', 'A06.01.ficha_mae', 'A06.01.paciente_mae', 'banco', NULL, 'Cadastro da mãe', format('SELECT paciente_id::text FROM public.episodios WHERE id = %L', e2e.u('a06_epJ')), 'ok', 'a06_pacJ');

-- ── 2 e 3. "RN de Joana" pelo cadastro da mãe, e bordas ─────────────────────
SELECT e2e.ba(6, 'a06_pacJ', 'A06.01.paciente_mae', 'A06.02.cadastrar_rn', 'f5_rec_upa', '/recepcao → FormRn (CadastroRn.tsx)', 'Cadastra o RN pelo cadastro de Joana (hoje − 5 dias, sexo M, parto único)',
  format($q$SELECT (public.cadastrar_rn(%L::uuid, %L::date, 'M', NULL, %L::uuid) ->> 'paciente_id')$q$,
    e2e.u('a06_pacJ'), e2e.v('a06_nascRN'), 'f5300000-0000-4000-8000-000000000011'), 'ok', 'a06_rn');
SELECT e2e.ba(6, 'a06_rn', 'A06.02.cadastrar_rn', 'A06.02.rn_banco', 'banco', NULL, 'RN com nome "RN de Joana…", mae_id, parentesco mãe, nome da mãe, prontuário e auditoria',
  format($q$SELECT e2e.confere(p.nome = %L AND p.mae_id = %L AND p.responsavel_parentesco = 'mãe' AND p.rn_ordem IS NULL AND p.nome_mae = %L AND p.prontuario IS NOT NULL,
      'nome ' || p.nome || ', prontuário ' || coalesce(p.prontuario, '?') || ', nascimento ' || p.data_nascimento || ', auditoria ' ||
      (SELECT count(*) FROM public.log_auditoria a WHERE a.entidade_id = p.id AND a.acao = 'cadastrar_rn'))
    FROM public.pacientes p WHERE p.id = %L$q$, e2e.v('a06_nomeRN'), e2e.v('a06_pacJ'), e2e.v('a06_nomeJ'), e2e.v('a06_rn')));
SELECT e2e.ba(6, 'a06_pacJ', 'A06.01.paciente_mae', 'A06.03.duplicado', 'f5_rec_upa', '/recepcao → FormRn', 'Cadastra de novo o RN de Joana na mesma data, sem ordem de gemelar (deve ser recusado)',
  format($q$SELECT public.cadastrar_rn(%L::uuid, %L::date, 'M', NULL, NULL)::text$q$, e2e.u('a06_pacJ'), e2e.v('a06_nascRN')), 'erro:Já existe recém-nascido de');
SELECT e2e.ba_registra(6, 'A06.B.gemelar_mesmo_parto', 'f5_rec_upa', '/recepcao → FormRn', 'Gemelar 1 no mesmo parto, já havendo um RN sem ordem (registro, desfeito)',
  CASE WHEN e2e.v('a06_pacJ') IS NULL THEN NULL ELSE format($q$SELECT public.cadastrar_rn(%L::uuid, %L::date, 'F', 1::smallint, NULL)$q$, e2e.v('a06_pacJ'), e2e.v('a06_nascRN')) END);
SELECT e2e.ba(6, 'a06_pacJ', 'A06.01.paciente_mae', 'A06.B.rn_28_dias', 'f5_rec_upa', '/recepcao → FormRn', '"RN de" com 28 dias de vida (deve ser recusado)',
  format($q$SELECT public.cadastrar_rn(%L::uuid, %L::date, 'M', NULL, NULL)::text$q$, e2e.u('a06_pacJ'), (private.data_atual() - 28)::text), 'erro:O cadastro "RN de" é só até 27 dias');
SELECT e2e.ba(6, 'a06_pacJ', 'A06.01.paciente_mae', 'A06.B.rn_data_futura', 'f5_rec_upa', '/recepcao → FormRn', 'Data de nascimento futura (deve ser recusado)',
  format($q$SELECT public.cadastrar_rn(%L::uuid, %L::date, 'M', NULL, NULL)::text$q$, e2e.u('a06_pacJ'), (private.data_atual() + 1)::text), 'erro:Informe a data de nascimento do recém-nascido');
SELECT e2e.ba(6, 'a06_rn', 'A06.02.cadastrar_rn', 'A06.B.mae_que_e_rn', 'f5_rec_upa', '/recepcao → FormRn', 'Escolher como mãe um cadastro que é RN (deve ser recusado)',
  format($q$SELECT public.cadastrar_rn(%L::uuid, %L::date, 'M', NULL, NULL)::text$q$, e2e.u('a06_rn'), (private.data_atual() - 1)::text), 'erro:O cadastro escolhido como mãe é de um recém-nascido');
SELECT e2e.ba(6, 'a06_pacJ', 'A06.01.paciente_mae', 'A06.B.fora_da_escala', 'f5_rec_ubs', '/recepcao → FormRn', 'Recepção da UBS (fora da escala da UPA) tenta cadastrar_rn (deve ser recusado)',
  format($q$SELECT public.cadastrar_rn(%L::uuid, %L::date, 'M', 2::smallint, NULL)::text$q$, e2e.u('a06_pacJ'), (private.data_atual() - 3)::text), 'erro:Acesso negado: cadastro de recém-nascido');

-- ── 4. ficha do RN ──────────────────────────────────────────────────────────
SELECT e2e.ba(6, 'a06_rn', 'A06.02.cadastrar_rn', 'A06.04.ficha_rn', 'f5_rec_upa', '/recepcao', 'Abre a ficha do RN no PS: icterícia, mama pouco',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Icterícia, mama pouco', %L::uuid, '{}'::jsonb, '{lactante_crianca_colo}') ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000011', e2e.u('a06_rn')), 'ok', 'a06_epRN');
SELECT e2e.ba(6, 'a06_epRN', 'A06.04.ficha_rn', 'A06.04.conta_rn', 'f5_fat', '/faturamento/contas', 'Conta própria do RN, aberta',
  format($q$SELECT coalesce((SELECT c ->> 'id' FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
      WHERE c -> 'paciente' ->> 'nome' = %L AND c ->> 'tipo' = 'ambulatorial' LIMIT 1), e2e.falhar('conta do RN não achada'))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('a06_nomeRN')), 'ok', 'a06_contaRN');
SELECT e2e.ba(6, 'a06_epJ', 'A06.01.ficha_mae', 'A06.04.conta_mae', 'f5_fat', '/faturamento/contas', 'Conta da mãe, separada',
  format($q$SELECT coalesce((SELECT c ->> 'id' FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c
      WHERE c -> 'paciente' ->> 'nome' = %L AND c ->> 'tipo' = 'ambulatorial' LIMIT 1), e2e.falhar('conta da mãe não achada'))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('a06_nomeJ')), 'ok', 'a06_contaJ');

-- ── 5. triagem: RN (laranja) e a mãe ────────────────────────────────────────
SELECT e2e.ba(6, 'a06_epRN', 'A06.04.ficha_rn', 'A06.05.chamar_rn', 'f5_enf_upa', '/triagem (Fila)', 'Chama o RN', format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('a06_epRN'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.ba(6, 'a06_epRN', 'A06.04.ficha_rn', 'A06.05.classificar_rn', 'f5_enf_upa', '/triagem (Classificar)',
  'Grupo pediátrico; sinais crus (temperatura, FC, FR, SpO2, glicemia); a enfermeira de teste classifica laranja',
  format($q$SELECT public.classificar_risco(%L::uuid, 'laranja', '{"temperatura":36.9,"frequencia-cardiaca":150,"frequencia-respiratoria":48,"saturacao-o2":97,"glicemia-capilar":70,"escala-dor":2}'::jsonb,
    %L::uuid, %L, '{}'::jsonb, NULL, NULL, NULL, 'Recém-nascido de 5 dias, ictérico, mamando pouco', false, %L::boolean)::text$q$,
    e2e.u('a06_epRN'), '4ce34c91-b2b0-4ffe-a2be-4a6e13f72297',
    coalesce(e2e.disc('f5100000-0000-4000-8000-000000000002', '4ce34c91-b2b0-4ffe-a2be-4a6e13f72297', 'laranja'), 'Icterícia em recém-nascido que mama pouco (livre, teste A06)'),
    (e2e.disc('f5100000-0000-4000-8000-000000000002', '4ce34c91-b2b0-4ffe-a2be-4a6e13f72297', 'laranja') IS NULL)::text), 'ok', 'a06_classRN');
SELECT e2e.ba(6, 'a06_classRN', 'A06.05.classificar_rn', 'A06.05.cor_rn', 'banco', NULL, 'Cor da enfermeira; grupo pediátrico',
  format($q$SELECT e2e.confere(cor = 'laranja' AND publico = 'pediatrico', 'cor ' || cor || ', público ' || publico) FROM public.classificacoes_risco WHERE id = %L$q$, e2e.u('a06_classRN')));
SELECT e2e.ba(6, 'a06_epJ', 'A06.01.ficha_mae', 'A06.05.chamar_mae', 'f5_enf_upa', '/triagem (Fila)', 'Chama Joana', format('SELECT public.chamar_paciente(%L::uuid, %L::uuid)::text', e2e.u('a06_epJ'), '167a0658-f599-450c-85fc-f246f68f0d51'));
SELECT e2e.ba(6, 'a06_epJ', 'A06.01.ficha_mae', 'A06.05.classificar_mae', 'f5_enf_upa', '/triagem (Classificar)', 'Joana: fluxograma adulto "Mal-estar geral"; a enfermeira de teste classifica verde',
  format($q$SELECT public.classificar_risco(%L::uuid, 'verde', '{"temperatura":37.6,"frequencia-cardiaca":88,"frequencia-respiratoria":18,"saturacao-o2":98,"pressao-arterial-sistolica":118,"pressao-arterial-diastolica":76,"escala-dor":4}'::jsonb,
    %L::uuid, %L, '{}'::jsonb, NULL, NULL, NULL, 'Dor mamária no puerpério', false, %L::boolean)::text$q$,
    e2e.u('a06_epJ'), '5b981a47-948c-46e2-838f-403c7d27da81',
    coalesce(e2e.disc('f5100000-0000-4000-8000-000000000002', '5b981a47-948c-46e2-838f-403c7d27da81', 'verde'), 'Dor leve no puerpério (livre, teste A06)'),
    (e2e.disc('f5100000-0000-4000-8000-000000000002', '5b981a47-948c-46e2-838f-403c7d27da81', 'verde') IS NULL)::text));

-- ── 6 a 8. médico: RN, exames, cuidado ──────────────────────────────────────
SELECT e2e.ba(6, 'a06_epRN', 'A06.04.ficha_rn', 'A06.06.iniciar_rn', 'f5_med_upa', '/atendimento', 'Médico assume o RN', format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('a06_epRN')));
SELECT e2e.ba(6, 'a06_rn', 'A06.02.cadastrar_rn', 'A06.06.peso_rn', 'f5_med_upa', '/atendimento (peso)', 'Peso aferido do RN', e2e.ba_sinais(e2e.u('a06_rn'), '{"peso":3.1}', NULL, 'aferido'));
SELECT e2e.ba(6, 'a06_epRN', 'A06.04.ficha_rn', 'A06.06.soap_rn', 'f5_med_upa', '/atendimento', 'SOAP com CID de icterícia neonatal (P59.9); ferramenta ped-ictericia-neonatal na tela',
  format($q$SELECT public.registrar_soap(%L::uuid, 'RN de termo, 5 dias de vida, ictérico e mamando pouco (teste A06)', 'Icterícia até abdome; peso aferido 3,1 kg; 120 h de vida', 'Icterícia neonatal', 'Conduta pela ferramenta ped-ictericia-neonatal (teste de fluxo)', 'P59.9')::text$q$, e2e.u('a06_epRN')));
SELECT e2e.ba(6, 'a06_epRN', 'A06.04.ficha_rn', 'A06.07.exames', 'f5_med_upa', '/atendimento (Exames)', 'Pede bilirrubinas (SIGTAP 0202010201) e tipagem conforme a ferramenta',
  format($q$SELECT public.pedir_exames(%L::uuid, '[{"procedimento":"0202010201"},{"nome":"Tipagem sanguínea ABO e Rh do recém-nascido"}]'::jsonb, 'urgente', 'Icterícia neonatal (teste A06)')::text$q$, e2e.u('a06_epRN')));
SELECT e2e.ba(6, 'a06_epRN', 'A06.04.ficha_rn', 'A06.07.exame_bili', 'banco', NULL, 'Pedido da bilirrubina',
  format($q$SELECT id::text FROM public.exames_pedidos WHERE episodio_id = %L AND procedimento = '0202010201' LIMIT 1$q$, e2e.v('a06_epRN')), 'ok', 'a06_exBili');
SELECT e2e.ba(6, 'a06_exBili', 'A06.07.exame_bili', 'A06.07.resultado', 'f5_med_upa', '/exames', 'Resultado da bilirrubina registrado (texto fictício)',
  format($q$SELECT public.resolver_exame(%L::uuid, 'Bilirrubina total e frações: valor fictício de teste A06', NULL)::text$q$, e2e.u('a06_exBili')));
SELECT e2e.ba(6, 'a06_rn', 'A06.02.cadastrar_rn', 'A06.08.cuidado', 'f5_med_upa', '/atendimento (Prescrição)',
  'Cuidado conforme ped-ictericia-neonatal; fototerapia não existe na UPA F5 (motivo da transferência)',
  format('SELECT public.prescrever(%L::uuid, %L::jsonb)::text', e2e.u('a06_rn'),
    jsonb_build_object('tipo', 'cuidado', 'descricao', 'Manter aleitamento e observar sinais de escalonamento conforme ped-ictericia-neonatal; fototerapia indisponível na UPA F5 (teste de fluxo)')),
  'ok', 'a06_item_rn');

-- ── 9 e 10. regulação: incubadora obrigatória ───────────────────────────────
SELECT e2e.guardar('a06_reg_dados', jsonb_build_object('tipo', 'transferencia', 'procedimento', '0303080108', 'cid', 'P59.9', 'carater', 'urgencia', 'prioridade', 'urgencia',
  'destino_tipo', 'a_definir', 'tipo_leito', 'pediatrico', 'transporte', 'ambulancia_avancada', 'vulnerabilidades', jsonb_build_array('crianca'),
  'episodio_id', e2e.v('a06_epRN'), 'quadro_clinico', 'Recém-nascido de termo com 5 dias, icterícia progressiva e sucção fraca; precisa de fototerapia, que a UPA não tem. Teste A06.',
  'tempo_evolucao', '2 dias', 'hipotese', 'Icterícia neonatal', 'exames', 'Bilirrubina total e frações (resultado fictício anexado)', 'telefone_contato', '(11) 0000-0000')::text);
SELECT e2e.ba(6, 'a06_rn,a06_epRN', 'A06.04.ficha_rn', 'A06.09.sem_incubadora', 'f5_med_upa', '/regulacao (NovaSolicitacao)', 'Transferência do neonato sem responder a incubadora (deve ser recusado)',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> 'id')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('a06_rn'), e2e.v('a06_reg_dados')),
  'erro:Recém-nascido: informe se a transferência precisa de incubadora');
SELECT e2e.ba(6, 'a06_rn,a06_epRN', 'A06.04.ficha_rn', 'A06.10.solicitar', 'f5_med_upa', '/regulacao (NovaSolicitacao)', 'Repete com incubadora = sim',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb || '{"incubadora":true}'::jsonb) ->> 'id')$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.u('a06_rn'), e2e.v('a06_reg_dados')), 'ok', 'a06_reg');
SELECT e2e.ba(6, 'a06_reg', 'A06.10.solicitar', 'A06.10.enviada', 'banco', NULL, 'enviada; o RN conta como identificado pelo documento da mãe; incubadora gravada',
  format($q$SELECT e2e.confere(status = 'enviada' AND NOT paciente_nao_identificado AND incubadora, 'nº ' || numero || ', status ' || status || ', não identificado ' || paciente_nao_identificado || ', incubadora ' || incubadora || ', tipo de leito ' || coalesce(tipo_leito, '?'))
    FROM public.regulacao_solicitacoes WHERE id = %L$q$, e2e.v('a06_reg')));
SELECT e2e.ba(6, 'a06_rn', 'A06.02.cadastrar_rn', 'A06.10.vinculos', 'f5_med_upa', '/regulacao (vínculos)', 'regulacao_vinculos_paciente traz a mãe e o documento dela',
  format($q$SELECT e2e.confere((v ->> 'tem_documento')::boolean AND v -> 'mae' ->> 'nome' = %L AND v -> 'mae' ->> 'cns' IS NOT NULL, 'tem documento ' || (v ->> 'tem_documento') || ', mãe ' || coalesce(v -> 'mae' ->> 'nome', 'nenhuma'))
    FROM (SELECT public.regulacao_vinculos_paciente(%L::uuid) v) x$q$, e2e.v('a06_nomeJ'), e2e.v('a06_rn')));

-- ── 11 e 12. regulador pergunta; o NIR responde ─────────────────────────────
SELECT e2e.ba(6, 'a06_reg', 'A06.10.solicitar', 'A06.11.fila', 'f5_regulador', '/regulacao (Fila)', 'O pedido está na fila da central',
  format($q$SELECT e2e.confere(public.regulacao_fila(%L::uuid, '{}'::jsonb)::text LIKE '%%' || %L || '%%', 'na fila')$q$, 'f5100000-0000-4000-8000-000000000009', e2e.v('a06_reg')));
SELECT e2e.ba(6, 'a06_reg', 'A06.10.solicitar', 'A06.11.assumir', 'f5_regulador', '/regulacao (Detalhe)', 'Regulador assume', format('SELECT left(public.regulacao_assumir(%L::uuid)::text, 120)', e2e.u('a06_reg')));
SELECT e2e.ba(6, 'a06_reg', 'A06.10.solicitar', 'A06.11.pendencia', 'f5_regulador', '/regulacao (PainelDecisao)', 'Abre pendência pedindo o resultado da bilirrubina',
  format($q$SELECT left(public.regulacao_pendencia(%L::uuid, 'Qual o valor da bilirrubina total e a idade em horas? (teste A06)')::text, 120)$q$, e2e.u('a06_reg')));
SELECT e2e.ba(6, 'a06_reg', 'A06.10.solicitar', 'A06.11.prazo', 'banco', NULL, 'Status pendencia e o evento gravado',
  format($q$SELECT e2e.confere(s.status = 'pendencia' AND EXISTS (SELECT 1 FROM public.regulacao_eventos e WHERE e.solicitacao_id = s.id AND e.evento = 'pendencia'),
      'status ' || s.status || ', pendência em ' || coalesce(s.pendencia_em::text, '?')) FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$, e2e.v('a06_reg')));
SELECT e2e.ba(6, 'a06_reg', 'A06.10.solicitar', 'A06.12.nir_ve', 'f5_nir', '/nir', 'NIR da UPA vê a pendência da regulação (o catálogo pede; o produto só lista depois do prazo de 3 h)',
  format($q$SELECT e2e.confere(public.nir_pendencias(%L::uuid)::text LIKE '%%' || %L || '%%', coalesce((SELECT left(i::text, 250) FROM jsonb_array_elements(public.nir_pendencias(%L::uuid) -> 'itens') i WHERE i::text LIKE '%%' || %L || '%%' LIMIT 1), 'não achada'))$q$,
    'f5100000-0000-4000-8000-000000000002', e2e.v('a06_reg'), 'f5100000-0000-4000-8000-000000000002', e2e.v('a06_reg')));
SELECT e2e.ba(6, 'a06_rn,a06_epRN', 'A06.04.ficha_rn', 'A06.12.documento', 'f5_med_upa', '/atendimento (Evolução)', 'Médico registra a evolução com o resultado (para anexar)',
  format($q$SELECT (public.emitir_documento(%L::uuid, 'evolucao', 'Bilirrubina total: valor fictício de teste A06; 120 h de vida', %L::uuid) ->> 'id')$q$, e2e.u('a06_rn'), e2e.u('a06_epRN')), 'ok', 'a06_doc');
SELECT e2e.ba(6, 'a06_reg,a06_doc', 'A06.12.documento', 'A06.12.anexar', 'f5_nir', '/nir (anexo)', 'NIR anexa o documento do prontuário à solicitação',
  format('SELECT public.regulacao_anexar_documento(%L::uuid, %L::uuid)::text', e2e.u('a06_reg'), e2e.u('a06_doc')));
SELECT e2e.ba(6, 'a06_reg', 'A06.10.solicitar', 'A06.12.responder', 'f5_nir', '/nir', 'NIR responde a pendência',
  format($q$SELECT public.regulacao_responder_pendencia(%L::uuid, 'Resultado anexado: bilirrubina fictícia, 120 h de vida (teste A06)')::text$q$, e2e.u('a06_reg')));
SELECT e2e.ba(6, 'a06_reg', 'A06.10.solicitar', 'A06.12.volta_fila', 'banco', NULL, 'Volta à análise (em_analise), com a resposta e o anexo',
  format($q$SELECT e2e.confere(s.status = 'em_analise' AND s.pendencia_resposta IS NOT NULL, 'status ' || s.status || ', anexos ' || (SELECT count(*) FROM public.regulacao_anexos a WHERE a.solicitacao_id = s.id AND a.retirado_em IS NULL)
      || ', criada em ' || s.criada_em) FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$, e2e.v('a06_reg')));

-- ── 13 e 14. autorização e aceite do hospital ───────────────────────────────
SELECT e2e.ba(6, 'a06_reg', 'A06.10.solicitar', 'A06.13.autorizar', 'f5_regulador', '/regulacao (PainelDecisao)', 'Autoriza com destino Hospital F5',
  format($q$SELECT left(public.regulacao_autorizar(%L::uuid, 'rede', %L::uuid, NULL, 'ambulancia_avancada', NULL, 'Destino Hospital F5 com incubadora (teste A06)')::text, 120)$q$,
    e2e.u('a06_reg'), 'f5100000-0000-4000-8000-000000000003'));
SELECT e2e.guardar('a06_leito', (SELECT l.id::text FROM public.leitos l WHERE l.setor_id = 'f5300000-0000-4000-8000-000000000021' AND l.status = 'livre' AND l.ativo
                                  AND l.identificador NOT IN ('CM-01', 'CM-02') ORDER BY l.identificador DESC LIMIT 1));
SELECT e2e.guardar('a06_leito_nome', (SELECT identificador FROM public.leitos WHERE id::text = e2e.v('a06_leito')));
SELECT e2e.ba(6, 'a06_reg,a06_leito', 'A06.10.solicitar', 'A06.14.leitos', 'f5_med_hosp', '/regulacao (destino)', 'Leitos livres do destino: nenhum do tipo pediátrico; o CM aparece como "outro tipo"',
  format($q$SELECT e2e.confere(public.regulacao_leitos_destino(%L::uuid)::text LIKE '%%' || %L || '%%',
      coalesce((SELECT string_agg((l ->> 'leito') || ' ' || (l ->> 'setor') || ' do_tipo ' || (l ->> 'do_tipo'), '; ') FROM jsonb_array_elements(public.regulacao_leitos_destino(%L::uuid)) l), 'nenhum'))$q$,
    e2e.u('a06_reg'), e2e.v('a06_leito'), e2e.u('a06_reg')));
SELECT e2e.ba(6, 'a06_reg,a06_leito', 'A06.10.solicitar', 'A06.14.aceitar', 'f5_med_hosp', '/regulacao (destino)', 'Médico do hospital aceita e reserva o leito CM (' || coalesce(e2e.v('a06_leito_nome'), '?') || ')',
  format($q$SELECT left(public.regulacao_destino_aceitar(%L::uuid, %L::uuid, 'Leito CM reservado para o RN (teste A06)')::text, 120)$q$, e2e.u('a06_reg'), e2e.u('a06_leito')));
SELECT e2e.ba(6, 'a06_reg', 'A06.10.solicitar', 'A06.14.reserva', 'banco', NULL, 'autorizada e reserva de leito',
  format($q$SELECT e2e.confere(s.status = 'autorizada', 'status ' || s.status || ', leito ' || coalesce((SELECT l.identificador FROM public.leitos l WHERE l.id = r.leito_id), '?') || ', reserva até ' || coalesce(r.expira_em::text, '?'))
    FROM public.regulacao_solicitacoes s LEFT JOIN public.reservas_leito r ON r.id = s.reserva_id WHERE s.id = %L$q$, e2e.v('a06_reg')));

-- ── 15. gestor da UPA ───────────────────────────────────────────────────────
SELECT e2e.ba(6, 'a06_rn', 'A06.02.cadastrar_rn', 'A06.15.historico', 'f5_ges_upa', '/regulacao (origem)', 'Histórico do RN na regulação, eventos com autor',
  format($q$SELECT e2e.confere(public.regulacao_historico_paciente(%L::uuid)::text LIKE '%%' || %L || '%%', left(public.regulacao_historico_paciente(%L::uuid)::text, 250))$q$,
    e2e.u('a06_rn'), e2e.v('a06_reg'), e2e.u('a06_rn')));
SELECT e2e.ba_passo('A06.15.sla', 6, 'f5_ges_upa', '/regulacao (SLA)', 'Painel de SLA da origem',
  format($q$SELECT left(public.regulacao_sla_painel(%L::uuid, '{}'::jsonb)::text, 300)$q$, 'f5100000-0000-4000-8000-000000000002'));

-- ── 16 e 17. desfecho do RN e saída ─────────────────────────────────────────
SELECT e2e.ba(6, 'a06_epRN,a06_rn', 'A06.04.ficha_rn', 'A06.16.doc_transferencia', 'f5_med_upa', '/atendimento (Desfecho)', 'Médico emite o documento de transferência (lacuna 7: sem ele a transferência externa é recusada)',
  format($q$SELECT left(public.emitir_documento_transferencia(%L::uuid, jsonb_build_object('resumo_clinico', 'Resumo clínico de teste (A06, dado fictício).', 'condutas', 'Condutas de teste conforme o roteiro (A06, dado fictício).', 'motivo', 'Leito no Hospital F5 pela regulação, com incubadora (teste A06).'))::text, 120)$q$, e2e.u('a06_rn')));
SELECT e2e.ba(6, 'a06_epRN', 'A06.04.ficha_rn', 'A06.16.desfecho_rn', 'f5_med_upa', '/atendimento (Desfecho)', 'Desfecho transferência do RN, com relato',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'transferencia', 'Transferido ao Hospital F5 pela regulação, com incubadora (teste A06)', '{"destino":"Hospital Fase 5"}'::jsonb)::text$q$, e2e.u('a06_epRN')), 'ok', 'a06_rn_encerrado');
SELECT e2e.ba(6, 'a06_rn_encerrado', 'A06.16.desfecho_rn', 'A06.16.sem_contrarreferencia', 'banco', NULL, 'Episódio do RN encerrado, sem contrarreferência (não veio de UBS)',
  format($q$SELECT e2e.confere(e.etapa = 'encerrado' AND NOT EXISTS (SELECT 1 FROM public.contrarreferencias c WHERE c.episodio_id = e.id OR c.paciente_origem_id = e.paciente_id), 'etapa ' || e.etapa || ', desfecho ' || coalesce(e.desfecho, '?'))
    FROM public.episodios e WHERE e.id = %L$q$, e2e.v('a06_epRN')));
SELECT e2e.ba(6, 'a06_reg', 'A06.10.solicitar', 'A06.17.saida', 'f5_nir', '/nir', 'NIR marca a saída (a mãe acompanha)', format('SELECT left(public.regulacao_marcar_saida(%L::uuid)::text, 120)', e2e.u('a06_reg')));

-- ── 18. hospital: chegada, porta e internação ───────────────────────────────
SELECT e2e.ba(6, 'a06_reg', 'A06.10.solicitar', 'A06.18.chegada', 'f5_med_hosp', '/regulacao (destino)', 'Médico do hospital marca a chegada (realizada)',
  format('SELECT left(public.regulacao_marcar_chegada(%L::uuid, true, NULL)::text, 120)', e2e.u('a06_reg')));
SELECT e2e.ba(6, 'a06_reg', 'A06.10.solicitar', 'A06.18.sem_internacao', 'banco', NULL, 'A chegada regulada não cria internação no hospital',
  format($q$SELECT e2e.confere(NOT EXISTS (SELECT 1 FROM public.internacoes i JOIN public.pacientes p ON p.id = i.paciente_id
      WHERE i.unidade_id = 'f5100000-0000-4000-8000-000000000003' AND p.nome = %L), 'nenhuma internação no hospital')$q$, e2e.v('a06_nomeRN')));
SELECT e2e.ba_passo('A06.18.ficha_hosp', 6, 'f5_rec_hosp', '/recepcao (Porta do Hospital)', 'Recepção do hospital abre a ficha do RN (cadastro novo na unidade, com o nome da mãe)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'RN transferido pela regulação (icterícia neonatal)', NULL, %L::jsonb, '{lactante_crianca_colo}') ->> 'episodio_id')$q$,
    'f5300000-0000-4000-8000-000000000024', e2e.v('a06_cadRN_hosp')), 'ok', 'a06_epH');
SELECT e2e.ba(6, 'a06_epH', 'A06.18.ficha_hosp', 'A06.18.paciente_hosp', 'banco', NULL, 'Cadastro do RN no hospital: nome da mãe, sem mae_id (o vínculo é por unidade)',
  format($q$SELECT p.id::text FROM public.episodios e JOIN public.pacientes p ON p.id = e.paciente_id WHERE e.id = %L$q$, e2e.v('a06_epH')), 'ok', 'a06_pacH');
SELECT e2e.ba(6, 'a06_pacH', 'A06.18.paciente_hosp', 'A06.18.vinculo_mae_hosp', 'banco', NULL, 'mae_id no cadastro do hospital (o catálogo prevê vazio, pois Joana não é cadastrada lá)',
  format($q$SELECT e2e.confere(mae_id IS NULL AND nome_mae = %L, 'mae_id ' || coalesce(mae_id::text, 'vazio') || ', nome_mae ' || coalesce(nome_mae, '?')) FROM public.pacientes WHERE id = %L$q$, e2e.v('a06_nomeJ'), e2e.v('a06_pacH')));
SELECT e2e.ba(6, 'a06_epH', 'A06.18.ficha_hosp', 'A06.18.classificar_hosp', 'f5_enf_hosp', '/triagem (Porta do Hospital)', 'Enfermeira do hospital classifica o RN; a enfermeira de teste escolhe laranja',
  format($q$SELECT public.classificar_risco(%L::uuid, 'laranja', '{"temperatura":36.8,"frequencia-cardiaca":148,"frequencia-respiratoria":46,"saturacao-o2":97,"escala-dor":2}'::jsonb,
    %L::uuid, %L, '{}'::jsonb, NULL, NULL, NULL, 'RN ictérico transferido para fototerapia', false, %L::boolean)::text$q$,
    e2e.u('a06_epH'), '4ce34c91-b2b0-4ffe-a2be-4a6e13f72297',
    coalesce(e2e.disc('f5100000-0000-4000-8000-000000000003', '4ce34c91-b2b0-4ffe-a2be-4a6e13f72297', 'laranja'), 'Icterícia em recém-nascido (livre, teste A06)'),
    (e2e.disc('f5100000-0000-4000-8000-000000000003', '4ce34c91-b2b0-4ffe-a2be-4a6e13f72297', 'laranja') IS NULL)::text));
SELECT e2e.ba(6, 'a06_epH', 'A06.18.ficha_hosp', 'A06.18.iniciar_hosp', 'f5_med_porta_hosp', '/atendimento (Porta do Hospital)', 'Médico da porta assume', format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('a06_epH')));
SELECT e2e.ba(6, 'a06_epH', 'A06.18.ficha_hosp', 'A06.18.soap_hosp', 'f5_med_porta_hosp', '/atendimento', 'SOAP de chegada (P59.9)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'RN transferido da UPA F5 para fototerapia (teste A06)', 'Ictérico, ativo; incubadora no transporte', 'Icterícia neonatal', 'Internação para fototerapia (teste de fluxo)', 'P59.9')::text$q$, e2e.u('a06_epH')));
SELECT e2e.ba(6, 'a06_pacH,a06_leito', 'A06.18.paciente_hosp', 'A06.18.leitos_para_ocupar', 'f5_med_porta_hosp', '/atendimento (Desfecho)', 'leitos_para_ocupar oferece o leito reservado pela regulação',
  format($q$SELECT e2e.confere(EXISTS (SELECT 1 FROM public.leitos_para_ocupar(%L::uuid, %L::uuid) l WHERE l.id = %L::uuid AND l.reservado),
      coalesce((SELECT string_agg(identificador || CASE WHEN reservado THEN ' (reservado)' ELSE '' END, ', ') FROM public.leitos_para_ocupar(%L::uuid, %L::uuid)), 'nenhum'))$q$,
    'f5300000-0000-4000-8000-000000000021', e2e.u('a06_pacH'), e2e.u('a06_leito'), 'f5300000-0000-4000-8000-000000000021', e2e.u('a06_pacH')));
SELECT e2e.ba(6, 'a06_epH,a06_leito', 'A06.18.ficha_hosp', 'A06.18.internar', 'f5_med_porta_hosp', '/atendimento (Desfecho)', 'Interna o RN no leito CM reservado',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'internacao', 'Internação para fototerapia (teste A06)', jsonb_build_object('setor_id', %L, 'leito_id', %L))::text$q$,
    e2e.u('a06_epH'), 'f5300000-0000-4000-8000-000000000021', e2e.v('a06_leito')));
SELECT e2e.ba(6, 'a06_epH', 'A06.18.ficha_hosp', 'A06.18.internacao', 'banco', NULL, 'Internação no hospital e a reserva consumida',
  format($q$SELECT e2e.confere(e.etapa = 'internacao' AND l.status = 'ocupado', 'internação ' || i.id || ', leito ' || l.identificador || ' ' || l.status || ', reserva ' ||
      coalesce((SELECT r.situacao FROM public.reservas_leito r JOIN public.regulacao_solicitacoes s ON s.reserva_id = r.id WHERE s.id = %L), '?'))
    FROM public.episodios e JOIN public.internacoes i ON i.id = (e.desfecho_detalhes ->> 'internacao_id')::uuid JOIN public.leitos l ON l.id = i.leito_atual_id WHERE e.id = %L$q$,
    e2e.v('a06_reg'), e2e.v('a06_epH')), 'ok', 'a06_int_hosp');
SELECT e2e.ba(6, 'a06_int_hosp', 'A06.18.internacao', 'A06.18.conta_internacao', 'f5_fat', '/faturamento/contas (Hospital)', 'Conta de internação do RN aberta no hospital (sem AIH: R$ 0,00)',
  format($q$SELECT coalesce((SELECT (c ->> 'id') || ' ' || (c ->> 'tipo') || ' — total ' || coalesce(public.conta_detalhe((c ->> 'id')::uuid) ->> 'total_referencia', 'nulo')
      FROM jsonb_array_elements(public.contas_da_unidade(%L::uuid, NULL, NULL) -> 'contas') c WHERE c -> 'paciente' ->> 'nome' = %L AND c ->> 'tipo' = 'internacao' LIMIT 1), e2e.falhar('conta de internação não achada'))$q$,
    'f5100000-0000-4000-8000-000000000003', e2e.v('a06_nomeRN')));

-- ── 19. alta da mãe na UPA ──────────────────────────────────────────────────
SELECT e2e.ba(6, 'a06_epJ', 'A06.01.ficha_mae', 'A06.19.iniciar_mae', 'f5_med_upa', '/atendimento (Joana)', 'Médico assume Joana', format('SELECT public.iniciar_atendimento(%L::uuid)::text', e2e.u('a06_epJ')));
SELECT e2e.ba(6, 'a06_epJ', 'A06.01.ficha_mae', 'A06.19.soap_mae', 'f5_med_upa', '/atendimento (Joana)', 'SOAP de Joana (O91.2)',
  format($q$SELECT public.registrar_soap(%L::uuid, 'Dor mamária no 5º dia de puerpério (teste A06)', 'Mama com área dolorosa, sem flutuação', 'Mastite não purulenta associada ao parto', 'Orientações e retorno à UBS (teste de fluxo)', 'O91.2')::text$q$, e2e.u('a06_epJ')));
SELECT e2e.ba(6, 'a06_epJ', 'A06.01.ficha_mae', 'A06.19.alta_mae', 'f5_med_upa', '/atendimento (Desfecho)', 'Alta de Joana com orientações',
  format($q$SELECT public.registrar_desfecho(%L::uuid, 'alta', 'Alta com orientações; acompanha o RN ao hospital (teste A06)', '{}'::jsonb)::text$q$, e2e.u('a06_epJ')));
SELECT e2e.ba(6, 'a06_contaJ,a06_contaRN', 'A06.04.conta_mae', 'A06.19.contas', 'f5_fat', '/faturamento/contas', 'Contas de Joana e do RN independentes, cada uma com a sua classificação e consulta',
  format($q$SELECT string_agg(k.nome || ': ' || coalesce((SELECT string_agg((i ->> 'procedimento') || ' qt ' || coalesce(i ->> 'quantidade', '?') || ' = ' || coalesce(i ->> 'valor_total', 'nulo'), ', ')
      FROM jsonb_array_elements(public.conta_detalhe(k.id) -> 'itens') i), 'sem itens') || ', total ' || coalesce(public.conta_detalhe(k.id) ->> 'total_referencia', 'nulo'), ' | ')
    FROM (VALUES ('Joana', %L::uuid), ('RN', %L::uuid)) k(nome, id)$q$, e2e.v('a06_contaJ'), e2e.v('a06_contaRN')));
SELECT e2e.ba(6, 'a06_reg', 'A06.10.solicitar', 'A06.99.eventos_regulacao', 'banco', NULL, 'Um evento por transição em regulacao_eventos, autor = login',
  format($q$SELECT e2e.confere(count(*) >= 7, string_agg(ev.evento || ' por ' || coalesce(right(ev.por::text, 2), '?'), ' → ' ORDER BY ev.em))
    FROM public.regulacao_eventos ev WHERE ev.solicitacao_id = %L$q$, e2e.v('a06_reg')));

SELECT situacao, count(*) FROM e2e.resultados WHERE passo LIKE 'A06.%' AND em >= e2e.v('a06_inicio')::timestamptz GROUP BY 1 ORDER BY 1;
