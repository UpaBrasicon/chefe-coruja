-- Teste de fluxo B, decisões do RT de 25/11 (B-03 e B-04): isolamentos se somam e
-- seguem o paciente até o destino; só o médico retira, com motivo.
-- SÓ EM TRANSAÇÃO DESFEITA (ensaio): os passos da segunda parte não se desfazem um a um,
-- porque um depende do outro (o B09 vai até a chegada no Hospital de Referência);
-- a transação inteira é desfeita no fim. Ver 205 para _r, e2e.fb_ler e e2e.fb_seq.

-- ── B-04: somar ─────────────────────────────────────────────────────────────
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.24.pedido_soma_' || x.tipo, 'med', 'B-04: paciente marcado em gotícula, pedido novo com "' || x.tipo || '": ficam ' || x.espera,
  format('SELECT e2e.fb_seq(%L, %L)', format($q$SELECT public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb)$q$, e2e.fb_upa(), e2e.fbu(9, 'pac'),
      jsonb_build_object('tipo', 'leito', 'tipo_leito', 'clinico', 'procedimento', '0303140046', 'cid', 'J44.1', 'carater', 'urgencia', 'prioridade', 'urgencia', 'destino_tipo', 'a_definir',
        'quadro_clinico', 'Segundo pedido de teste para conferir os isolamentos somados.', 'isolamento', x.tipo <> 'nenhum', 'isolamento_tipo', nullif(x.tipo, 'nenhum'))),
    format($q$SELECT e2e.fb_confere(s.isolamento_tipos = %L::text[] AND s.isolamento, 'principal ' || s.isolamento_tipo || '; todos ' || s.isolamento_tipos::text) FROM public.regulacao_solicitacoes s WHERE s.paciente_id = %L ORDER BY s.criada_em DESC LIMIT 1$q$, x.espera, e2e.fbu(9, 'pac'))),
  'ok', NULL, true)
  FROM (VALUES ('reverso', '{goticula,reverso}'), ('contato', '{goticula,contato}'), ('contato_aerossol', '{aerossol,goticula,contato}'), ('aerossol', '{aerossol,goticula}'), ('nenhum', '{goticula}')) x(tipo, espera);
INSERT INTO _r (txt)
SELECT e2e.fb(1, 'FB.24.pedido_sem_marca', 'banco', 'B-04: pedidos antigos ficaram com os tipos do próprio pedido (B02 aerossol, B03 contato + aerossol, B04 reverso)',
  format($q$SELECT e2e.fb_confere(count(*) FILTER (WHERE s.isolamento_tipos = CASE s.isolamento_tipo WHEN 'contato_aerossol' THEN ARRAY['aerossol','contato'] ELSE ARRAY[s.isolamento_tipo] END) = count(*),
      string_agg(s.numero || '=' || s.isolamento_tipos::text, ', ' ORDER BY s.numero)) FROM public.regulacao_solicitacoes s WHERE s.id = ANY (%L::uuid[]) AND s.isolamento$q$,
    ARRAY[e2e.fbu(2, 'reg'), e2e.fbu(3, 'reg'), e2e.fbu(4, 'reg'), e2e.fbu(8, 'reg')]));
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.24.marca_tipo_invalido', 'med', 'B-04: marcar tipo que não existe: deve recusar',
  format($q$SELECT public.marcar_isolamento(%L::uuid, 'respiratorio', 'teste de tipo inválido')::text$q$, e2e.fbu(9, 'pac')), 'erro:Escolha o tipo de isolamento', NULL, true);

-- ── o B09 soma reverso e vai até o destino (passos encadeados; tudo desfeito no fim) ──
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.24.marca_reverso', 'med', 'B-04: médico marca "reverso" no paciente que já está em gotícula: as duas marcas ficam ativas',
  format('SELECT e2e.fb_seq(%L, %L)', format($q$SELECT public.marcar_isolamento(%L::uuid, 'reverso', 'Neutropenia depois do corticoide (teste B-04)')$q$, e2e.fbu(9, 'pac')),
    format($q$SELECT e2e.fb_confere(count(*) = 2, string_agg(tipo, ' + ' ORDER BY tipo)) FROM public.isolamentos_paciente WHERE paciente_id = %L AND retirado_em IS NULL$q$, e2e.fbu(9, 'pac'))));
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.24.marca_reverso_de_novo', 'med', 'B-04: marcar reverso de novo: deve recusar (já está)',
  format($q$SELECT public.marcar_isolamento(%L::uuid, 'reverso', 'de novo (teste)')::text$q$, e2e.fbu(9, 'pac')), 'erro:já está em isolamento');
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.24.pedido_atualiza_tipos', 'med', 'B-04: o médico confirma o isolamento do pedido nº 414: o pedido fica com gotícula e reverso',
  format('SELECT e2e.fb_seq(%L, %L)', format($q$SELECT public.regulacao_definir_isolamento(%L::uuid, 'goticula', 'suspeito', 'Influenza a confirmar')$q$, e2e.fbu(9, 'reg')),
    format($q$SELECT e2e.fb_confere(s.isolamento_tipos = '{goticula,reverso}', s.isolamento_tipos::text) FROM public.regulacao_solicitacoes s WHERE s.id = %L$q$, e2e.fbu(9, 'reg'))));
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.24.detalhe_mostra_todos', 'med', 'B-04: o detalhe do pedido (o que a tela lê) traz isolamento_tipos com os dois',
  format($q$SELECT e2e.fb_confere((d -> 'isolamento_tipos') = '["goticula","reverso"]'::jsonb, (d -> 'isolamento_tipos')::text) FROM (SELECT public.regulacao_detalhe(%L::uuid) d) z$q$, e2e.fbu(9, 'reg')));
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.24.tirar_de_paciente_marcado', 'med', 'B-04: tirar o isolamento do pedido com o paciente marcado: segue recusado',
  format('SELECT public.regulacao_definir_isolamento(%L::uuid, NULL, NULL, NULL)::text', e2e.fbu(9, 'reg')), 'erro:a regulação não pode tirar o isolamento');
-- retirar na origem: só o médico, com motivo
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.25.retirar_' || x.passo, x.papel, 'B-03: ' || x.descricao,
  format('SELECT public.retirar_isolamento(%L::uuid, %L)::text', (SELECT id FROM public.isolamentos_paciente WHERE paciente_id = e2e.fbu(9, 'pac') AND tipo = 'goticula' AND retirado_em IS NULL), x.motivo), x.esperado, NULL, true)
  FROM (VALUES
    (1, 'enfermeiro', 'enf', 'enfermeiro tenta retirar o isolamento: deve recusar', 'Influenza negativa (teste)', 'erro:O isolamento é retirado pelo médico'),
    (2, 'tecnico', 'tec', 'técnico tenta retirar: deve recusar', 'Influenza negativa (teste)', 'erro:O isolamento é retirado pelo médico'),
    (3, 'nir', 'nir', 'NIR tenta retirar: deve recusar', 'Influenza negativa (teste)', 'erro:O isolamento é retirado pelo médico'),
    (4, 'gestor', 'ges', 'gestor tenta retirar: deve recusar', 'Influenza negativa (teste)', 'erro:O isolamento é retirado pelo médico'),
    (5, 'medico_sem_motivo', 'med', 'médico tenta retirar sem dizer o porquê: deve recusar', '', 'erro:Diga por que o isolamento sai'),
    (6, 'medico', 'med', 'médico retira dizendo o porquê (desfeito)', 'Painel viral negativo para influenza (teste B-03)', 'ok')
  ) x(o, passo, papel, descricao, motivo, esperado) ORDER BY x.o;
-- preparo só do ensaio: o login fica de plantão na UTI do Hospital de Referência (para retirar lá)
ALTER TABLE public.escala_plantao DISABLE TRIGGER trg_escala_sem_sobreposicao;
INSERT INTO public.escala_plantao (unidade_id, setor_id, perfil_id, data, turno, observacao, criado_por)
SELECT e2e.fb_hosp(), '32000000-0000-4000-8000-0000000000d1', e2e.fb_login(), DATE '2026-11-25', t, 'Ensaio B-03 (desfeito)', e2e.fb_login() FROM unnest(ARRAY['manha', 'tarde', 'noite']) t;
ALTER TABLE public.escala_plantao ENABLE TRIGGER trg_escala_sem_sobreposicao;
INSERT INTO public.presenca_plantonista (unidade_id, escala_plantao_id, perfil_id, data, turno, checkin_em, checkin_dentro, criado_por)
SELECT e.unidade_id, e.id, e.perfil_id, e.data, e.turno, e.inicio, true, e.perfil_id FROM public.escala_plantao e WHERE e.unidade_id = e2e.fb_hosp() AND e.perfil_id = e2e.fb_login() AND e.data = DATE '2026-11-25';
-- o B09 segue: central autoriza, destino aceita em leito de isolamento, origem transfere, destino recebe
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.25.' || x.passo, x.papel, 'B-03: ' || x.descricao, x.sql, 'ok')
  FROM (VALUES
    (1, 'responder', 'med', 'médico responde a pendência', format($q$SELECT public.regulacao_responder_pendencia(%L::uuid, 'Evolução atualizada (teste B-03)')::text || 'ok'$q$, e2e.fbu(9, 'reg'))),
    (2, 'autorizar', 'reg', 'regulador autoriza para o Hospital de Referência', format($q$SELECT (public.regulacao_autorizar(%L::uuid, 'rede', %L::uuid, NULL, 'ambulancia_avancada', now() + interval '1 hour', 'teste B-03') ->> 'status')$q$, e2e.fbu(9, 'reg'), e2e.fb_hosp())),
    (3, 'aceitar', 'dmed', 'hospital aceita no leito de isolamento UTI-ISO-1', format($q$SELECT (public.regulacao_destino_aceitar(%L::uuid, %L::uuid, NULL) ->> 'status')$q$, e2e.fbu(9, 'reg'), (SELECT id FROM public.leitos WHERE setor_id = '32000000-0000-4000-8000-0000000000d1' AND identificador = 'UTI-ISO-1'))),
    (4, 'documento', 'med', 'médico emite o documento de transferência', format($q$SELECT (public.emitir_documento_transferencia(%L::uuid, '{"resumo_clinico":"DPOC exacerbado com retenção de CO2 (teste B-03)","condutas":"Conforme a prescrição do leito (teste)","motivo":"Necessidade de UTI adulto (teste B-03)"}'::jsonb) ->> 'id')$q$, e2e.fbu(9, 'pac'))),
    (5, 'alta', 'med', 'médico dá a alta por transferência (as marcas da origem encerram com a alta)', format($q$SELECT public.dar_alta(%L::uuid, 'transferencia_externa', 'J44.1', now(), NULL, 'Transferido pela regulação (teste B-03)', '{"destino":"Hospital de Referência (homologação)"}'::jsonb)::text || 'alta'$q$, e2e.fbu(9, 'int'))),
    (6, 'chegada', 'dmed', 'hospital registra a chegada (cadastro novo, leito reservado)', format($q$SELECT (public.regulacao_marcar_chegada(p_id => %L::uuid, p_chegou => true, p_observacao => 'Chegou (teste B-03)', p_cadastro_novo => true) ->> 'status')$q$, e2e.fbu(9, 'reg')))
  ) x(o, passo, papel, descricao, sql) ORDER BY x.o;
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.25.marcas_no_destino', 'banco', 'B-03: no destino o paciente tem as DUAS marcas (gotícula e reverso), com situação, agente, unidade de origem, autor e hora originais e o pedido',
  format($q$SELECT e2e.fb_confere(count(*) = 2 AND bool_and(ip.unidade_id = e2e.fb_hosp() AND ip.origem_unidade_id = e2e.fb_upa() AND ip.origem_marcado_por = e2e.fb_login() AND ip.origem_marcado_em IS NOT NULL
        AND ip.regulacao_id = s.id AND ip.situacao = 'suspeito' AND ip.agente = 'Influenza a confirmar' AND ip.internacao_id = s.destino_internacao_id AND ip.retirado_em IS NULL),
      string_agg(ip.tipo || ' (' || coalesce(ip.situacao, '-') || '; ' || left(ip.motivo, 90) || '; origem marcada às ' || to_char(ip.origem_marcado_em AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ')', ' | ' ORDER BY ip.tipo))
    FROM public.regulacao_solicitacoes s JOIN public.isolamentos_paciente ip ON ip.paciente_id = s.destino_paciente_id WHERE s.id = %L$q$, e2e.fbu(9, 'reg')));
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.25.origem_encerrada', 'banco', 'B-03: na origem as marcas encerraram com a alta (pelo sistema, sem autor)',
  format($q$SELECT e2e.fb_confere(count(*) = 2 AND bool_and(ip.retirado_em IS NOT NULL), string_agg(ip.tipo || ': ' || coalesce(ip.motivo_retirada, 'ativa'), ' | ')) FROM public.isolamentos_paciente ip WHERE ip.paciente_id = %L$q$, e2e.fbu(9, 'pac')));
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.25.destino_mapa', 'dmed', 'B-03: o isolamento ativo do paciente no destino (o que as telas leem)',
  format($q$SELECT e2e.fb_confere(private.isolamento_ativo(s.destino_paciente_id) = '{goticula,reverso}', private.isolamento_ativo(s.destino_paciente_id)::text) FROM (SELECT (public.regulacao_detalhe(%L::uuid) ->> 'id')::uuid AS id) d JOIN LATERAL (SELECT %L::uuid AS destino_paciente_id) s ON true$q$,
    e2e.fbu(9, 'reg'), (SELECT destino_paciente_id FROM public.regulacao_solicitacoes WHERE id = e2e.fbu(9, 'reg'))), 'registrar');
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.25.destino_retirar_' || x.passo, x.papel, 'B-03, no destino: ' || x.descricao,
  format('SELECT e2e.fb_seq(%L, %L)', format('SELECT public.retirar_isolamento(%L::uuid, %L)', i.id, x.motivo),
    format($q$SELECT e2e.fb_confere(ip.retirado_em IS NOT NULL AND ip.retirado_por = e2e.fb_login() AND ip.motivo_retirada = %L, 'retirado às ' || to_char(ip.retirado_em AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI') || ' pelo login: ' || ip.motivo_retirada) FROM public.isolamentos_paciente ip WHERE ip.id = %L$q$, x.motivo, i.id)),
  x.esperado, NULL, true)
  FROM (VALUES
    (1, 'gestor', 'dges', 'gestor do hospital tenta retirar: deve recusar', 'Sem critério (teste)', 'erro:O isolamento é retirado pelo médico'),
    (2, 'origem', 'med', 'médico da ORIGEM tenta retirar a marca do destino: deve recusar', 'Sem critério (teste)', 'erro'),
    (3, 'medico_sem_motivo', 'dmed', 'médico do hospital sem motivo: deve recusar', 'x', 'erro:Diga por que o isolamento sai'),
    (4, 'medico', 'dmed', 'médico do hospital retira dizendo o porquê: autor e hora gravados', 'Neutrófilos recuperados, sem critério de ambiente protetor (teste B-03)', 'ok')
  ) x(o, passo, papel, descricao, motivo, esperado)
  CROSS JOIN (SELECT ip.id FROM public.isolamentos_paciente ip JOIN public.regulacao_solicitacoes s ON s.destino_paciente_id = ip.paciente_id WHERE s.id = e2e.fbu(9, 'reg') AND ip.tipo = 'reverso') i
 ORDER BY x.o;
INSERT INTO _r (txt)
SELECT e2e.fb(9, 'FB.25.destino_segue_goticula', 'banco', 'B-03: sem retirada, a marca de gotícula continua ativa no destino',
  format($q$SELECT e2e.fb_confere(count(*) FILTER (WHERE ip.retirado_em IS NULL) = 2, count(*) FILTER (WHERE ip.retirado_em IS NULL) || ' marcas ativas no destino') FROM public.isolamentos_paciente ip JOIN public.regulacao_solicitacoes s ON s.destino_paciente_id = ip.paciente_id WHERE s.id = %L$q$, e2e.fbu(9, 'reg')));
