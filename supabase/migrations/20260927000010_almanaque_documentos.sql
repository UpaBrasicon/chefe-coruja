-- Almanaque: documentos do episódio e folha provisória (fase 2.5).
INSERT INTO public.hermes_almanaque (pergunta, palavras, resposta) VALUES
('Como funcionam os documentos do atendimento?', 'documento receita atestado encaminhamento pedido de exames número retificar retificação',
 'Receita, atestado, encaminhamento e pedido de exames são gravados no episódio antes de ir para o papel, cada um com número próprio da unidade (ex.: 2026/000123). Emitir de novo gera outro documento; corrigir um já emitido é retificação, com motivo. No Atendimento, a seção Documentos do episódio lista tudo e tem atalhos para emitir.'),
('Posso imprimir sem internet?', 'imprimir sem internet offline folha provisória sem conexão assinar à mão',
 'Pode, se você já estava em plantão no aparelho: sai a FOLHA PROVISÓRIA, sem número, para assinar à mão. O documento fica guardado no aparelho e, quando a conexão volta, recebe o número definitivo e a impressão é registrada.')
ON CONFLICT (pergunta) DO UPDATE SET palavras = EXCLUDED.palavras, resposta = EXCLUDED.resposta, atualizado_em = now();
