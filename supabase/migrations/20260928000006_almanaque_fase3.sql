-- Almanaque: observação, pendências, passagem, alta e pacote de alta (fase 3).
INSERT INTO public.hermes_almanaque (pergunta, palavras, resposta) VALUES
('Como funciona a observação?', 'observação box 6 horas seis horas prazo vencida conduta',
 'Quando o médico registra o desfecho Observação, o paciente vai sozinho para o primeiro box livre e ganha uma pendência de 6 horas contadas da entrada no box. Ela só se resolve com a conduta: alta ou internação. Vencida ou perto de vencer, sobe ao topo do painel de Observação em vermelho.'),
('Como registro uma pendência?', 'pendência pendencia parecer exame reavaliação regulação prazo',
 'No painel, abra o leito do paciente e registre em Pendências: tipo (reavaliação, exame, parecer, regulação ou outro), o que falta e o prazo (1h, 2h, 4h, fim do plantão ou sem prazo). O autor é quem está logado. Parecer sem resposta impede a alta. Concluir tem 8 segundos para desfazer.'),
('Como faço a passagem de plantão?', 'passagem de plantão passar paciente aceite recusar check-out bloqueado',
 'No leito aberto, em Passagem de plantão, escolha o colega da escala do setor (agora ou nas próximas 12 horas) e escreva o resumo. Ele aceita ou recusa com motivo em Meu Plantão. Enquanto houver passagem sua aguardando aceite, o check-out fica bloqueado, inclusive o automático; você pode retirar e reenviar.'),
('O que impede a alta?', 'alta impede impeditivo pendência não consigo dar alta CID retroativa cancelar',
 'Impedem a alta: parecer sem resposta ou pendência marcada como impeditiva, documento do PEP em rascunho e passagem de plantão aguardando aceite. O CID de alta é obrigatório; hora mais de 30 minutos no passado exige justificativa. Cancelar a alta é possível por 24 horas, com justificativa, por quem deu a alta ou pelo gestor.'),
('Como o paciente recebe os documentos da alta?', 'pacote de alta link código documentos celular paciente',
 'Em Pacote de alta, marque as orientações e o retorno e clique em Gerar e imprimir: a folha sai com o link e um código de 6 dígitos (o código não aparece de novo). O paciente abre o link, digita o código a cada acesso e vê orientações, receita, atestado, encaminhamento e pedido de exames por 30 dias. Três códigos errados bloqueiam; gerar outro revoga o anterior.'),
('O que é o escore de acuidade?', 'acuidade news2 pews escore sinais vitais alterado',
 'O leito mostra NEWS2 para adultos (14 anos ou mais) e PEWS para crianças, calculados no servidor a partir das aferições das últimas 24 horas, com a fonte escrita. Vital faltando não trava: o escore sai com asterisco e diz o que faltou. Os sinais vitais ficam crus, sem marca de alterado; a conduta é da equipe.')
ON CONFLICT (pergunta) DO UPDATE SET palavras = EXCLUDED.palavras, resposta = EXCLUDED.resposta, atualizado_em = now();
