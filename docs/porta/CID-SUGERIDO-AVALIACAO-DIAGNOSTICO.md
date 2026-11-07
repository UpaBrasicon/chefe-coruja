# CID sugerido a partir da Avaliação: diagnóstico

Este é o achado guardado de 07/10/2026, do ensaio da demo, aberto pelo RT em 06/11/2026 como item 4 da frente "Achados guardados". A ideia é que o texto da hipótese diagnóstica (ex.: "pneumonia") mostre CIDs de referência ao lado do campo CID-10 (ex.: J18.9). A escolha continua sempre do médico.

## O que acontece hoje
- **Porta, que vale também para a consulta da UBS** (`AbaAtendimento.tsx`):
  - "Avaliação · hipótese diagnóstica" e o campo CID-10 (`CampoCid`) ficam na mesma linha.
  - A busca de CID só funciona com o que se digita no próprio campo CID.
  - A Avaliação vai para `registrar_soap`, e o CID do atendimento vira o CID padrão da alta.
- **Internação:** o CID fica na subaba Diagnóstico (`Diagnostico.tsx`). A evolução não tem campo de CID.
- **Busca** (`terminologia.buscar`, tabela `terminologia.cid10`, cerca de 14,5 mil códigos):
  - toda palavra digitada precisa casar (busca com E);
  - não existem sinônimos nem siglas, então PAC, IAM, AVC, ITU e DPOC não acham nada;
  - uma frase inteira ("PAC grave em idoso com DPOC") não retorna resultado;
  - "pneumonia" sozinha traz B01.2 e B05.2 antes de J18.9, porque a ordem cai no código.
- **Precedentes que o RT já aprovou:**
  - **CIAP-2 → CID na UBS** (`AbaConduta.tsx`): o botão "CID-10 relacionada (tabela do e-SUS APS, só referência)" só entra quando o médico clica.
  - **Sinônimos de medicamento** (`medicamento_sinonimo`): lista curada carregada por migration, com a fonte de cada termo.
- **Princípio escrito nas telas:** "Nada aqui sugere… CID" (`AbaAtendimento.tsx`, `AbaConduta.tsx`). Mudar esse texto é decisão do RT.
- **Por que o cuidado:** o CID vai para o BPA, a AIH, a APAC, a RNDS, a notificação compulsória (LNNC/SINAN), o atestado e os programas da UBS. A escolha explícita do médico protege tudo isso.

## Decisões para o RT

**Decisão do RT em 06/11/2026: A em C1 a C7 ("Sim, todas A").**

| # | Decisão | A (recomendada) | B |
|---|---|---|---|
| C1 | Como sugerir | Determinístico, dentro do banco: uma tabela curada de termos e siglas (no padrão dos sinônimos de medicamento) mais a busca de texto. Nada sai do banco, a resposta é sempre igual e testável, e todo código sugerido existe na CID-10 | Por IA (LLM), via o gateway do Hermes, com desidentificação; o provedor atual fica fora do Brasil |
| C2 | O princípio "nada aqui sugere CID" | Passa a "o sistema mostra CIDs de referência a partir do texto; a escolha é do médico", como o botão CIAP→CID da UBS | Mantém o princípio e não faz a sugestão |
| C3 | Em quais telas | Porta e consulta da UBS (é o mesmo campo) e a subaba Diagnóstico da internação | Só a porta |
| C4 | Lista inicial de termos | Siglas e termos comuns do PS (PAC, IAM, AVC, ITU, DPOC, ICC, TEP, TVP, HAS, DM, IVAS, crise asmática e outros), propostas no PR para o RT revisar antes da produção, mais os pares CIAP→CID como referência mais fraca | Só os pares CIAP→CID |
| C5 | Código de cada termo | Cada termo traz um código preferido, o "não especificado" do grupo (ex.: pneumonia → J18.9), mais até 4 alternativas da busca | Só a lista da busca, sem preferido |
| C6 | Negação ("descartado IAM", "afastado TEP", "sem pneumonia") | Termo precedido de negação não gera sugestão | Ignorar a negação |
| C7 | Quem mantém a lista | O RT, por migration, como os sinônimos de medicamento; tela de cadastro numa tarefa futura | Tela de cadastro agora |

## Plano com A em tudo
1. **Migration (expand).**
   - Cria a tabela `public.cid_termo`: `termo`, `termo_norm`, `cid`, `tipo` (sigla, popular ou preferido), `fonte` e `peso`. O `cid` referencia `terminologia.cid10`. A tabela é só de leitura pela API.
   - Carrega a lista da C4.
   - Cria a RPC `cid_sugerir_do_texto(p_texto)`:
     - quebra a Avaliação em trechos;
     - descarta os termos negados;
     - procura primeiro nos termos curados e depois na busca de texto com OU;
     - devolve até 5 códigos, cada um com o motivo ("sigla PAC", "texto").
   - Teste de banco e rollback na homologação; o "ok produção" fica com o RT.
2. **Telas.** Os chips "CIDs de referência (só referência; a escolha é sua)" aparecem ao lado do campo CID na porta e na UBS e na subaba Diagnóstico. O clique só preenche o campo CID. Os textos "Nada aqui sugere CID" são reescritos.
3. **Testes antes:**
   - SQL: siglas, frase com dois diagnósticos, negação, código preferido, código inexistente nunca devolvido;
   - unidade: quebra de frases e negação no cliente, se houver.
4. **Homologação:** conferir no Chrome com o médico de teste.

## Riscos
- **Lista curada incompleta:** um termo sem cobertura cai na busca de texto, ou simplesmente não gera sugestão. A sugestão nunca é obrigatória.
- **CID errado por clique apressado:** o chip só preenche o campo. A validação do CID e a escolha continuam com o médico, e o texto deixa claro que é só referência.
