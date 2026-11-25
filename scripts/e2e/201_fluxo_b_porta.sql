-- ════════════════════════════════════════════════════════════════════════════
-- Teste de fluxo B, fase 1: recepção abre a ficha, enfermagem chama e classifica.
-- Rodar depois de 200_fluxo_b_framework.sql. Grava de verdade (COMMIT no fim).
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;
CREATE TEMP TABLE _r (o serial, txt text) ON COMMIT DROP;

-- caminho errado: o técnico de enfermagem abre ficha? (registro do que o servidor faz; desfeito)
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.1.ficha_pelo_tecnico', 'tec', 'Técnico de enfermagem tenta abrir a ficha na recepção (registro; desfeito)',
  format($q$SELECT (public.registrar_ficha(%L::uuid, %L, NULL, %L::jsonb) ->> 'episodio_id')$q$, '32000000-0000-4000-8000-000000000001', c.queixa,
    jsonb_build_object('nome', c.nome || ' pelo técnico', 'data_nascimento', c.nasc, 'sexo', c.sexo)), 'registrar', NULL, true)
  FROM e2e.fb_coorte c WHERE c.n = 1;

-- 1. recepção: cadastro e ficha no Pronto Socorro
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.1.ficha', 'rec', 'Recepção cadastra e abre a ficha no Pronto Socorro',
  format($q$SELECT (public.registrar_ficha(%L::uuid, %L, NULL, %L::jsonb, %L::text[]) ->> 'episodio_id')$q$, '32000000-0000-4000-8000-000000000001', c.queixa,
    jsonb_build_object('nome', c.nome, 'data_nascimento', c.nasc, 'sexo', c.sexo, 'raca_cor', 'parda', 'cns', e2e.fb_cns(c.n),
      'nome_mae', 'Mãe Fictícia do Teste B' || lpad(c.n::text, 2, '0'), 'endereco', 'Rua do Teste, ' || c.n, 'municipio', 'Goiânia', 'uf', 'GO')
    || CASE WHEN c.publico = 'pediatrico' THEN jsonb_build_object('responsavel_nome', 'Responsável Fictícia do Teste B05', 'responsavel_parentesco', 'mãe') ELSE '{}'::jsonb END,
    c.prioridades), 'ok', 'ep')
  FROM e2e.fb_coorte c ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.1.paciente', 'banco', 'Paciente da ficha, etapa triagem, prioridades legais pela idade',
  format($q$SELECT e.paciente_id::text FROM public.episodios e WHERE e.id = %L AND e.etapa = 'triagem'$q$, e2e.fbu(c.n, 'ep')), 'ok', 'pac', false, 'ep')
  FROM e2e.fb_coorte c ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.1.prioridades', 'banco', 'Prioridade legal: idoso 60+ e 80+ no B07, idoso 60+ no B04 e B09, gestante no B06',
  format($q$SELECT e2e.fb_confere(e.prioridades_legais = %L::text[], 'prioridades ' || e.prioridades_legais::text) FROM public.episodios e WHERE e.id = %L$q$,
    CASE c.n WHEN 7 THEN '{idoso_60,idoso_80}' WHEN 4 THEN '{idoso_60}' WHEN 9 THEN '{idoso_60}' WHEN 6 THEN '{gestante}' ELSE '{}' END, e2e.fbu(c.n, 'ep')), 'ok', NULL, false, 'ep')
  FROM e2e.fb_coorte c ORDER BY c.n;

-- caminhos errados da recepção
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.1.ficha_repetida', 'rec', 'Mesma pessoa de novo (mesmo nome e nascimento): deve avisar duplicata',
  format($q$SELECT (public.registrar_ficha(%L::uuid, %L, NULL, %L::jsonb) ->> 'episodio_id')$q$, '32000000-0000-4000-8000-000000000001', c.queixa,
    jsonb_build_object('nome', c.nome, 'data_nascimento', c.nasc, 'sexo', c.sexo)), 'erro:FICHA_DUPLICATA', NULL, false, 'ep')
  FROM e2e.fb_coorte c WHERE c.n = 1;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.1.ficha_paciente_em_atendimento', 'rec', 'Segunda ficha para o paciente já em atendimento: deve recusar',
  format($q$SELECT (public.registrar_ficha(%L::uuid, 'Voltou ao balcão', %L::uuid, '{}'::jsonb) ->> 'episodio_id')$q$, '32000000-0000-4000-8000-000000000001', e2e.fbu(c.n, 'pac')),
  'erro:FICHA_EPISODIO_ABERTO', NULL, false, 'pac')
  FROM e2e.fb_coorte c WHERE c.n = 2;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.1.recepcao_nao_classifica', 'rec', 'Recepção tenta classificar o risco: deve recusar',
  format($q$SELECT public.classificar_risco(p_episodio => %L::uuid, p_cor => 'azul', p_sinais => %L::jsonb, p_fluxograma => %L::uuid, p_discriminador => 'teste', p_discriminador_livre => true)::text$q$,
    e2e.fbu(c.n, 'ep'), c.sinais, (SELECT fl.id FROM public.protocolo_fluxogramas fl WHERE fl.protocolo_id = '57074ec9-8d8e-4d1f-8b44-b81f2e3215bd' AND fl.nome = c.fluxo AND fl.publico = c.publico)),
  'erro:A classificação de risco é do enfermeiro', NULL, false, 'ep')
  FROM e2e.fb_coorte c WHERE c.n = 1;

-- 2. triagem: chamada e classificação (a cor é a escolha da enfermeira de teste)
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.2.chamar', 'enf', 'Enfermeira chama para a Triagem 1',
  format('SELECT left(public.chamar_paciente(%L::uuid, %L::uuid)::text, 200)', e2e.fbu(c.n, 'ep'), 'b92dc5f6-9ba4-4968-8e7b-eaa997bf36ac'), 'ok', NULL, false, 'ep')
  FROM e2e.fb_coorte c ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.2.tecnico_nao_classifica', 'tec', 'Técnico de enfermagem tenta classificar: deve recusar',
  format($q$SELECT public.classificar_risco(p_episodio => %L::uuid, p_cor => %L, p_sinais => %L::jsonb, p_fluxograma => %L::uuid, p_discriminador => %L, p_discriminador_livre => true)::text$q$,
    e2e.fbu(c.n, 'ep'), c.cor, c.sinais, (SELECT fl.id FROM public.protocolo_fluxogramas fl WHERE fl.protocolo_id = '57074ec9-8d8e-4d1f-8b44-b81f2e3215bd' AND fl.nome = c.fluxo AND fl.publico = c.publico), c.disc_livre),
  'erro:A classificação de risco é do enfermeiro', NULL, false, 'ep')
  FROM e2e.fb_coorte c WHERE c.n IN (1, 5);
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.2.sem_sinal_obrigatorio', 'enf', 'Classificar sem a saturação: deve recusar',
  format($q$SELECT public.classificar_risco(p_episodio => %L::uuid, p_cor => %L, p_sinais => %L::jsonb, p_fluxograma => %L::uuid, p_discriminador => %L, p_discriminador_livre => true)::text$q$,
    e2e.fbu(c.n, 'ep'), c.cor, c.sinais - 'saturacao-o2', (SELECT fl.id FROM public.protocolo_fluxogramas fl WHERE fl.protocolo_id = '57074ec9-8d8e-4d1f-8b44-b81f2e3215bd' AND fl.nome = c.fluxo AND fl.publico = c.publico), c.disc_livre),
  'erro:Sinal vital obrigatório ausente', NULL, false, 'ep')
  FROM e2e.fb_coorte c WHERE c.n = 2;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.2.fluxograma_de_outro_publico', 'enf', 'Criança com fluxograma de adulto: deve recusar',
  format($q$SELECT public.classificar_risco(p_episodio => %L::uuid, p_cor => %L, p_sinais => %L::jsonb, p_fluxograma => %L::uuid, p_discriminador => %L, p_discriminador_livre => true)::text$q$,
    e2e.fbu(c.n, 'ep'), c.cor, c.sinais, (SELECT fl.id FROM public.protocolo_fluxogramas fl WHERE fl.protocolo_id = '57074ec9-8d8e-4d1f-8b44-b81f2e3215bd' AND fl.nome = 'Queixas respiratórias' AND fl.publico = 'adulto'), c.disc_livre),
  'erro:Fluxograma de outro público', NULL, false, 'ep')
  FROM e2e.fb_coorte c WHERE c.n = 5;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.2.classificar', 'enf', 'Enfermeira classifica (' || c.cor || ', fluxograma "' || c.fluxo || '"), sinais crus',
  format($q$SELECT public.classificar_risco(p_episodio => %L::uuid, p_cor => %L, p_sinais => %L::jsonb, p_fluxograma => %L::uuid, p_discriminador => %L, p_queixa => %L, p_discriminador_livre => %L::boolean)::text$q$,
    e2e.fbu(c.n, 'ep'), c.cor, c.sinais, f.id, coalesce(e2e.disc(e2e.fb_upa(), f.id, c.cor), c.disc_livre), c.queixa, e2e.disc(e2e.fb_upa(), f.id, c.cor) IS NULL),
  'ok', 'class', false, 'ep')
  FROM e2e.fb_coorte c
  LEFT JOIN public.protocolo_fluxogramas f ON f.protocolo_id = '57074ec9-8d8e-4d1f-8b44-b81f2e3215bd' AND f.nome = c.fluxo AND f.publico = c.publico
 ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.2.cor_banco', 'banco', 'Cor gravada = a da enfermeira, autora = login, sem campo de sugestão; episódio em atendimento',
  format($q$SELECT e2e.fb_confere(k.cor = %L AND k.autor_id = e2e.fb_login() AND NOT (to_jsonb(k) ?| ARRAY['cor_sugerida', 'sugestao', 'cor_sistema'])
        AND (SELECT e.etapa = 'atendimento' AND e.cor_atual = %L FROM public.episodios e WHERE e.id = k.episodio_id),
      'cor ' || k.cor || ', fluxograma ' || coalesce(k.fluxograma_nome, '?') || ', discriminador ' || coalesce(k.discriminador, '?') || ' (livre ' || k.discriminador_livre || ')')
    FROM public.classificacoes_risco k WHERE k.id = %L$q$, c.cor, c.cor, e2e.fbu(c.n, 'class')), 'ok', NULL, false, 'class')
  FROM e2e.fb_coorte c ORDER BY c.n;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.2.classificar_de_novo', 'enf', 'Ação repetida: classificar de novo sem motivo (vira reclassificação e pede motivo)',
  format($q$SELECT public.classificar_risco(p_episodio => %L::uuid, p_cor => %L, p_sinais => %L::jsonb, p_fluxograma => %L::uuid, p_discriminador => %L, p_discriminador_livre => true)::text$q$,
    e2e.fbu(c.n, 'ep'), c.cor, c.sinais, (SELECT fl.id FROM public.protocolo_fluxogramas fl WHERE fl.protocolo_id = '57074ec9-8d8e-4d1f-8b44-b81f2e3215bd' AND fl.nome = c.fluxo AND fl.publico = c.publico), c.disc_livre),
  'erro:motivo da reclassificação', NULL, false, 'class')
  FROM e2e.fb_coorte c WHERE c.n = 3;
INSERT INTO _r (txt)
SELECT e2e.fb(c.n, 'FB.2.vinculos_de_volta', 'banco', 'Depois dos passos, os vínculos do login estão todos ativos',
  $q$SELECT e2e.fb_confere(count(*) FILTER (WHERE NOT ativo) = 0, count(*) || ' vínculos, ' || count(*) FILTER (WHERE NOT ativo) || ' inativos') FROM public.vinculos WHERE perfil_id = e2e.fb_login()$q$)
  FROM e2e.fb_coorte c WHERE c.n = 1;

SELECT txt FROM _r ORDER BY o;
--FIM
COMMIT;
