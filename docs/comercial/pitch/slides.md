# Pitch deck — texto dos slides

*Backlog comercial, item 3. Decisões do RT em 15/11/2026: P1 a P6 = A (`docs/comercial/PITCH-DECK-DIAGNOSTICO.md`). A apresentação está no tipo "Slides" do Claude (link privado do RT, que se baixa em PPTX ou PDF). Este arquivo guarda o texto e a fonte de cada fato, para revisão por PR.*

**Público:** secretaria municipal de saúde e gestor de rede. **Visual:** azul-marinho e claro, ciano e azul-petróleo; Space Grotesk nos títulos e Inter no texto. **Imagens:** telas reais da rede de demonstração (pacientes e equipe fictícios), o mascote e um quadro do clipe 6130553 do Pexels.

| Nº | Slide | Texto | Fonte do fato |
|---|---|---|---|
| 1 | Capa | Chefe Coruja. Prontuário e gestão para a rede pública de saúde: da porta à alta, da UPA à UBS. chefecoruja.com.br · contato@chefecoruja.com.br | Site e e-mail de contato em produção |
| 2 | O problema | Plantão lotado, informação espalhada: fila na porta sem tempo à vista; escala e presença no papel; pedido de vaga sem resposta; gestão por planilha | Dores descritas sem números (nenhuma métrica inventada) |
| 3 | A solução | Um sistema só, da porta à alta, da UPA à UBS. Porta e leitos; gestão ao vivo; a rede (regulação com prazo, UBS e faturamento SUS); apoio clínico. "Só entra quem está na escala" | Fases 1 a 5 no BACKLOG; landing |
| 4 | O fluxo do paciente | Recepção → triagem → atendimento → prescrição → checagem → alta. A cor é da enfermagem; a hipótese sugere o CID e quem escolhe é o médico; checagem com nome e hora, recusa pede motivo; o sistema não sugere dose e avisa sem alergia registrada ou sem peso | Telas gravadas em 15/11/2026 (triagem, CID R51, checagem, prescrição) |
| 5 | A gestão | O gestor vê a unidade agora: gargalo apontado, espera por cor, indicadores com filtros, pergunta em português respondida sem nome de paciente | Telas Porta, Indicadores e Painel |
| 6 | A rede | Regulação (consulta, exame, leito e transferência para a Central; prioridade, prazo e alerta de destino sem resposta; mapa de vagas) e UBS (agenda, escuta inicial, encaminhados; Hiperdia nas regras C5 e C4; pré-natal e puericultura) | Telas Regulação e Hiperdia; `scripts/demo/04_ubs_regulacao.sql` |
| 7 | O apoio clínico | 232 ferramentas clínicas, revistas contra as diretrizes mais recentes e aprovadas pelo responsável técnico. Pergunte à IA: a resposta só vem com fonte; diretriz nova e manual lado a lado | Central do Plantonista; revisões do PubMed e do HCFMUSP no BACKLOG |
| 8 | Segurança e LGPD | Segundo fator em todo acesso; tela bloqueia depois de 10 minutos; trilha de auditoria encadeada; dados em São Paulo, cópia diária cifrada guardada por 20 anos (Lei 13.787/2018); IA sem identidade de paciente; modo sem conexão com plano de contingência; documento de segurança e LGPD para a TI | `produto/docs/seguranca-lgpd.md`; seção de segurança da landing |
| 9 | Implantação | Em etapas, uma unidade de cada vez: rede e unidades; equipe e escala; protocolos (classificação, medicamentos, CID); treinamento por papel; piloto. Prazo, escopo e condições vão na proposta de piloto | P4 = A: sem preço nem prazo |
| 10 | Próximos passos | Veja em 3 minutos (vídeo anexo). Demonstração ao vivo em 15 minutos; proposta de piloto; implantação na primeira unidade. contato@chefecoruja.com.br · chefecoruja.com.br | Item 1 (roteiro da demo) e item 8 (vídeo) do backlog comercial |

## O que o deck não diz

- Nenhuma promessa de RNDS ou e-SUS integrados, de certificação SBIS/CFM ou de assinatura ICP-Brasil. A nota do slide 8 orienta não prometer data se perguntarem.
- Sem números de clientes, depoimentos ou métricas inventadas.
- Sem dose de medicamento.
- Sem concorrente citado pelo nome.

## Conferência

- Prévia local de todos os slides, com as imagens enviadas.
- Três recortes refeitos por estarem ilegíveis: o CID, a regulação e a IA.
- O recorte do CID deixa de fora a sugestão "O80.0 Parto espontâneo cefálico", que aparece para "Cefaleia" (achado guardado).

**Aprovação:** o RT aprovou o deck em 15/11/2026 ("Aprovado").
