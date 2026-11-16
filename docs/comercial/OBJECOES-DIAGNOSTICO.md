# Backlog comercial, item 6: roteiro de objeções — diagnóstico

**Pedido.** Em 15/11/2026, depois da proposta de piloto (item 5) e da auditoria de segurança, o RT pediu o item 6 ("Item 6 objeções"). O item diz: "Roteiro de objeções — MV/Tasy/TOTVS; segurança; assinatura; RNDS; faturamento; offline; 'e se cair?' (responder com contingência + PITR + rollback)", com o critério "Respostas padronizadas".

**Escopo.** Só diagnóstico. Nada é escrito para o cliente antes das decisões.

## O que já existe para apoiar as respostas

- **Matriz competitiva** (`docs/comercial/matriz/`, aprovada em 15/11/2026): critério por critério, cada célula com fonte pública e data. É de uso interno.
- **Pitch deck, one-page e vídeo** (aprovados): a mesma lista de fatos sobre o produto, com as fontes em `docs/comercial/pitch/slides.md`.
- **Proposta de piloto** (`docs/comercial/proposta/`): escopo, etapas, métricas, responsabilidades, segurança e continuidade.
- **Playbook de implantação** (`docs/implantacao/PLAYBOOK.md`): treinamento por papel, virada, operação assistida e plano de contingência em papel (P17).
- **Segurança:**
  - documento de segurança e LGPD de outubro (`produto/docs/seguranca-lgpd.md`, fora do git), com a seção "Limites conhecidos";
  - runbook do segundo fator (`docs/seguranca/ativar-2fa.md`);
  - relatório do pentest Strix (`docs/seguranca/strix-*`);
  - auditoria da Cloudflare de 15/11/2026, com a trilha S0–S10 no BACKLOG.
- **Roteiro da demo** (#741, ainda não mesclado): já manda "Por que não MV, Tasy ou TOTVS?" para este item.

## Objeções propostas (lista do BACKLOG e as que aparecem em reunião de secretaria)

| # | Objeção | De onde vem a resposta |
|---|---|---|
| 1 | "Já temos MV, Tasy ou TOTVS" / "por que trocar?" | Matriz competitiva |
| 2 | "É seguro? E a LGPD?" | Documento de segurança e LGPD, proposta (seção de segurança) |
| 3 | "Tem assinatura digital ICP-Brasil?" | BACKLOG: prova de conceito à espera das credenciais da Valid |
| 4 | "Envia para a RNDS?" | BACKLOG: FHIR gerado, envio à espera da unidade piloto e da credencial do DATASUS |
| 5 | "Fatura SUS? BPA, AIH, APAC?" | BACKLOG: contas, BPA, AIH, APAC e glosas prontos; retorno do SIA/SIH à espera do arquivo da secretaria |
| 6 | "E se a internet cair?" | Modo sem conexão e plano de contingência em papel |
| 7 | "E se o sistema cair?" | Contingência, recuperação ponto a ponto (perda de até 5 min, volta em até 4 h) e reversão |
| 8 | "Tem certificação SBIS/CFM?" | Matriz e BACKLOG: não tem |
| 9 | "A equipe não vai aprender" / "vai atrasar a porta" | Treinamento por papel (1 h a 2 h) e operação assistida de 14 dias |
| 10 | "E os nossos dados antigos?" | Fora do piloto hoje; depende de levantamento |
| 11 | "A IA vai decidir pelo médico?" | A IA responde com fonte e não recebe a identidade do paciente; a decisão é sempre do profissional |
| 12 | "Vocês são pequenos. E o suporte?" | Proposta: responsabilidades e suporte (horário e prazo ainda em branco) |
| 13 | "Quanto custa?" | Campos de valor da proposta (só o RT) |

## Decisões para o RT

**OB1. Formato.**
- **A (recomendada):** documento editável no Claude, igual à proposta, com o texto-base também em `docs/comercial/objecoes/`. Serve para o RT estudar antes da reunião.
- **B:** uma folha de bolso em PDF, uma página por bloco de objeções.
- **C:** um apêndice no pitch deck.

**OB2. Concorrentes pelo nome.** O material é interno: é o RT quem fala, e o cliente não recebe o documento.
- **A (recomendada):** citar MV, Tasy e TOTVS só no roteiro interno, com o fato da matriz e a fonte de cada um. A resposta falada compara critério por critério, sem atacar a marca: "nos critérios X e Y nós temos; em Z, eles têm e nós não". Nada disso vai para material de cliente.
- **B:** sem nomes, nem no interno.

**OB3. Lacunas (ICP-Brasil, RNDS, SBIS, TISS, importação do legado).**
- **A (recomendada):** responder com a verdade em três partes: o que existe hoje, o que falta e de que depende. Sem data prometida.
- **B:** desviar para o que existe, sem nomear a lacuna.

**OB4. Segundo fator na produção.** O deck diz "segundo fator em todo acesso". A memória do projeto registra que o 2FA vem desligado por padrão e que ligá-lo dependia de configurar o e-mail na produção. Tentei ler o valor de `configuracao_plataforma.exigir_segundo_fator` na produção, só leitura e sem dado de paciente, mas a permissão foi negada.
- **A (recomendada):** você me diz se o 2FA está ligado na produção, ou autoriza essa leitura. Se estiver desligado, a resposta da objeção 2 diz "o segundo fator é ligado na implantação, antes do primeiro paciente", e o slide 8 do deck é corrigido.
- **B:** escrever "segundo fator disponível" sem afirmar que está ligado.

**OB5. Formato de cada resposta.**
- **A (recomendada):** a objeção como o cliente fala; uma resposta curta, de duas ou três frases; a prova (uma tela da demo ou um documento); e "o que não prometer".
- **B:** só a resposta curta.

**OB6. Auditorias de segurança.**
- **A (recomendada):** citar que houve pentest externo (Strix, outubro) e revisão contínua, sem detalhar achados. Os itens abertos da trilha S0–S10 ficam fora da fala. Se alguém perguntar diretamente se há algo pendente, a resposta é: "há melhorias em andamento, registradas e priorizadas".
- **B:** não citar auditorias.

**Decisão do RT, 15/11/2026:** OB1 a OB6 = A ("Todas A"). Para a OB4, com essa autorização, li só a configuração na produção, sem dado de paciente: `exigir_segundo_fator` = `true` desde 02/10/2026. O slide 8 do deck está certo e fica como está.

## Regras do conteúdo

- Nenhuma métrica inventada, depoimento ou cliente fictício.
- Nenhuma promessa de RNDS, ICP-Brasil ou SBIS como pronta.
- Preço e condição só com os valores do RT.
- Fatos sobre concorrentes só da matriz, com fonte e data, e "não encontrado" nunca vira "não tem".

## Depois

Com as decisões, escrevo as 13 respostas e trago para aprovação. Com isso, o backlog comercial fica completo, exceto o ensaio da demo (#741).
