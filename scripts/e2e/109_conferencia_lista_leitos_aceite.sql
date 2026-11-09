-- Conferência das telas de 08/11/2026 (noite): pedido de leito nº 197 do paciente do 108, autorizado para o
-- Hospital F5, para conferir a lista de leitos no aceite (item 13: sem os leitos da porta). Rodar depois do 108.
SELECT e2e.bpasso('ob8_pac', 'OB8.07.solicitar', 'f5_med_upa', '/regulacao (NovaSolicitacao)', 'Pedido de leito clínico (para conferir a lista de leitos no aceite)',
  format($q$SELECT (public.regulacao_solicitar(%L::uuid, %L::uuid, %L::jsonb) ->> 'id')$q$, 'f5100000-0000-4000-8000-000000000002', e2e.u('ob8_pac'),
    jsonb_build_object('tipo', 'leito', 'tipo_leito', 'clinico', 'procedimento', '0303060190', 'cid', 'R10.4',
      'carater', 'urgencia', 'prioridade', 'urgencia', 'destino_tipo', 'a_definir', 'episodio_id', e2e.v('ob8_ep'),
      'quadro_clinico', 'Dor abdominal a esclarecer (dado fictício, conferência da lista de leitos).', 'telefone_contato', '(11) 0000-0011')), 'ok', 'ob8_reg');
SELECT e2e.bpasso('ob8_reg', 'OB8.08.assumir', 'f5_regulador', '/regulacao (Fila)', 'Regulador assume',
  format('SELECT left(public.regulacao_assumir(%L::uuid)::text, 40)', e2e.u('ob8_reg')));
SELECT e2e.bpasso('ob8_reg', 'OB8.08.autorizar', 'f5_regulador', '/regulacao (PainelDecisao)', 'Autoriza para o Hospital F5',
  format($q$SELECT left(public.regulacao_autorizar(%L::uuid, 'rede', %L::uuid, NULL, NULL, now() + interval '2 hours', 'conferência da lista de leitos')::text, 40)$q$,
    e2e.u('ob8_reg'), 'f5100000-0000-4000-8000-000000000003'));
SELECT passo, situacao, left(coalesce(detalhe, ''), 100), (SELECT numero::text || ' ' || status FROM public.regulacao_solicitacoes WHERE id = e2e.v('ob8_reg')::uuid)
  FROM e2e.resultados WHERE passo LIKE 'OB8.0%' AND passo >= 'OB8.07' AND em >= e2e.v('ob8_inicio')::timestamptz ORDER BY id;
