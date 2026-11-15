# Backlog comercial, item 2: one-page — diagnóstico da atualização

**Pedido.** Em 15/11/2026, com o pitch deck aprovado (item 3), o RT pediu o próximo item ("Próximo item"). A sugestão registrada era atualizar a one-page e a matriz a partir do texto do deck. Este documento trata da one-page; a matriz (item 7) vem depois.

**Escopo.** Só diagnóstico. Nada muda aqui.

## Como está hoje

A one-page de 08/10/2026 (`produto/docs/comercial/one-page.tpl.html` e o PDF, fora do git):

- **Público:** UPA, pronto-socorro e hospital pequeno.
- **"Pronto e em uso":** oito blocos (recepção e triagem, atendimento no PS, observação e internação, leitos, escala e presença, gestão da porta, farmácia, apoio clínico).
- **Diferenciais:** segurança no banco, segundo fator, auditoria encadeada, LGPD, decisão clínica do profissional, funcionamento sem internet e cadastro sem duplicata.
- **"Em construção", sem data:** dupla checagem e aprazamento, interação medicamentosa, AIH/BPA/produção SUS, RNDS e assinatura ICP-Brasil, regulação e rede, UBS e faturamento.
- **Investimento e contato:** em modelo, para preencher.

**Do que estava "em construção", hoje está pronto:** aprazamento e checagem; interações críticas; contas, BPA, AIH, APAC e glosas; regulação com Central e mapa de vagas; UBS (agenda, Hiperdia, pré-natal, puericultura); a Central com 232 ferramentas revistas; e a IA com fonte. Seguem fora: o envio à RNDS (espera a implantação) e a assinatura ICP-Brasil.

## Decisões para o RT

**O1. Público.**
- **A (recomendada):** o mesmo do deck, a secretaria municipal e o gestor de rede: "Prontuário e gestão para a rede pública de saúde: da porta à alta, da UPA à UBS".
- **B:** manter "UPA, pronto-socorro e hospital pequeno".

**O2. Formato e onde fica.**
- **A (recomendada):** a mesma página A4, refeita em HTML no repositório (`docs/comercial/one-page/`, revisada por PR). O PDF é gerado pelo navegador e entregue a você; o PDF não vai para o git.
- **B:** seguir em `produto/`, fora do git.

**O3. "Em construção".**
- **A (recomendada):** manter o bloco, curto e honesto: "Fora da oferta atual, sem data: envio à RNDS e assinatura digital ICP-Brasil". Responde à pergunta antes que ela venha, como a de outubro fazia.
- **B:** tirar o bloco, como no deck.

**O4. Investimento e contato.**
- **A (recomendada):** tirar o bloco de preço (ele vai na proposta de piloto, item 5) e pôr o contato real: `contato@chefecoruja.com.br` e `chefecoruja.com.br`, com o convite para a demonstração.
- **B:** manter o modelo de preço para preencher.

**O5. Imagem.**
- **A (recomendada):** o mascote no topo e uma tela real (a Porta) em tamanho pequeno, com o selo de dados fictícios.
- **B:** só o mascote, como em outubro.

**Decisão do RT, 15/11/2026:** O1 a O5 = A ("Todas A").

## Regras do conteúdo

As mesmas do deck: nenhuma promessa de RNDS, certificação ou assinatura como pronta; sem número de clientes, depoimento ou métrica inventada; sem dose; sem concorrente pelo nome. Cada bloco "pronto" tem de existir na produção hoje.

## Depois

Com a one-page feita, a matriz competitiva (item 7) é atualizada a partir dela, e depois vêm a proposta de piloto (5) e o roteiro de objeções (6).
