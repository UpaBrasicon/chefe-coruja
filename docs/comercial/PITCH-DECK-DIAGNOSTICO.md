# Backlog comercial, item 3: pitch deck — diagnóstico

**Pedido.** Em 15/11/2026, com o vídeo de venda aprovado (item 8), o RT pediu o próximo item do backlog comercial ("Próximo item"). Pela ordem, é o item 3: "Pitch deck — 8-10 slides; problema; solução; demo; segurança; implantação; próximos passos", com o critério "Deck pronto para reunião".

**Escopo.** Este documento é só diagnóstico. Nada é criado aqui.

## Como está hoje

- **Não existe deck.** Os materiais comerciais de outubro ficam em `produto/docs/comercial/`, fora do git: a one-page (A4), a matriz competitiva interna e a pesquisa de concorrentes. O documento de segurança e LGPD está em `produto/docs/seguranca-lgpd.md`.
- **A one-page de 08/10/2026** fala de "UPA, pronto-socorro e hospital pequeno" e lista os 8 módulos daquela data. Depois dela vieram a regulação (Fase 4), a UBS e o faturamento (Fase 5), a Central do Plantonista com 232 ferramentas revistas e a IA com fonte citada.
- **Material pronto para o deck:**
  - telas reais da rede de demonstração, sem nome de teste: Porta, Painel, CID sugerido, checagem, regulação, UBS, Hiperdia, pré-natal, Central, resposta da IA e faturamento;
  - os gráficos e os textos do vídeo de venda;
  - o vídeo de venda aprovado (2:58).
- **Formato disponível:** o tipo de apresentação "Slides" do Claude. É privado até alguém compartilhar, abre na tela para apresentar e baixa em PPTX ou PDF.

## Decisões para o RT

**P1. Público.**
- **A (recomendada):** secretaria municipal de saúde e gestor de rede. O produto hoje cobre a UPA, a UBS e a regulação, e quem compra a rede é a secretaria.
- **B:** diretor de UPA ou de hospital, só a urgência, como na one-page de outubro.

**P2. Formato.**
- **A (recomendada):** apresentação no tipo "Slides", em 16:9, para apresentar na tela e baixar em PPTX ou PDF. O texto de cada slide fica também no repositório, em `docs/comercial/pitch/`, para revisão por PR.
- **B:** só um arquivo PPTX.

**P3. Estrutura (10 slides).**
- **A (recomendada):**
  1. capa;
  2. o problema da rede;
  3. a solução: da porta à alta, da UPA à UBS;
  4. o fluxo do paciente;
  5. a gestão: porta, indicadores e "Perguntar";
  6. a rede: regulação e UBS;
  7. o apoio clínico: Central e IA com fonte;
  8. segurança e LGPD;
  9. implantação;
  10. próximos passos e contato.
- **B:** a ordem literal do backlog (problema, solução, demo, segurança, implantação, próximos passos), com 6 a 8 slides.

**P4. Preço e prazo.**
- **A (recomendada):** o deck não traz preço nem prazo fechado; isso vai na proposta de piloto (item 5). O slide de implantação mostra só as etapas que o produto já tem (tela Implantação, cadastro de unidade, setores e leitos, escala, contas e treinamento), sem data.
- **B:** incluir faixa de preço e prazo.

**P5. Vídeo dentro do deck.**
- **A (recomendada):** um slide "Veja em 3 minutos", com uma tela do vídeo e o aviso de que ele vai anexo. O vídeo não está publicado em lugar nenhum.
- **B:** publicar o vídeo como não listado no YouTube (pela sua conta) e pôr o link no deck.

**P6. Contato.** `contato@chefecoruja.com.br` e o site `chefecoruja.com.br`, os mesmos do formulário "Agendar demonstração".

**Decisão do RT, 15/11/2026:** P1 a P6 = A ("Todas A").

## Regras do conteúdo

- **Nenhuma promessa** de RNDS ou e-SUS integrados, de certificação SBIS/CFM ou de assinatura ICP-Brasil.
- **Sem números de clientes, depoimentos ou métricas inventadas.** Os números nas telas são da rede de demonstração, com o selo "Pacientes e equipe fictícios".
- **Sem dose de medicamento.**
- **A matriz competitiva fica de uso interno** (decisão de 08/10/2026): o deck não cita concorrente pelo nome.

## Subtarefas (com A em tudo)

1. Texto de cada slide em `docs/comercial/pitch/slides.md`.
2. Imagens: telas da rede de demonstração, já gravadas para o vídeo, recortadas por slide.
3. Apresentação no tipo "Slides", com a paleta do produto: azul-marinho, ciano e o mascote.
4. Conferência: cada fato do deck com a fonte (tela, documento ou BACKLOG); nenhum nome de teste.
5. Registro no `BACKLOG.md`.

## Depois do deck

A one-page (item 2) e a matriz (item 7) são de antes das Fases 2 a 5. Com o deck pronto, a sugestão é atualizar as duas a partir do mesmo texto, antes da proposta de piloto (item 5) e do roteiro de objeções (item 6).
