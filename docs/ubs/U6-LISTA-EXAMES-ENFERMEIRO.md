# Exames que o enfermeiro pede na consulta de enfermagem da UBS (proposta, 17/11/2026)

Decisão P1 = A do plano (`docs/ubs/U6-U7-PLANO.md`): o enfermeiro pede só os exames do protocolo da atenção básica, numa lista fixa. Hoje o pedido de exame na consulta de enfermagem está travado. A trava é a migration `20270415000007`, que espera esta lista.

**Decisões do RT (17/11/2026): E1 = A, E2 = A, E3 = A.** A lista vale depois de conferida com os Cadernos. A conferência e a implementação vêm em PRs próprios.

## Base

- Lei 7.498/1986 e Resolução COFEN 195/1997: o enfermeiro pede exames de rotina e complementares dentro de programa de saúde pública e de protocolo da instituição.
- Ministério da Saúde, Cadernos de Atenção Básica:
  - nº 32, *Atenção ao pré-natal de baixo risco* (2012);
  - nº 36, *Diabetes mellitus* (2013);
  - nº 37, *Hipertensão arterial sistêmica* (2013).
- Ministério da Saúde, *Protocolos da Atenção Básica: Saúde das Mulheres* (2016).

Montei a lista de memória, a partir desses documentos. **Não reli os PDFs nesta rodada.** Antes de valer, cada linha precisa ser conferida com o texto, como as fichas clínicas.

Os códigos SIGTAP foram conferidos na tabela da homologação em 17/11/2026.

## Limite do app hoje

**Correção (17/11/2026, ao implementar):** a primeira versão deste documento dizia que o pedido de exame só aceitava o grupo 02.02. Está errado. O `pedir_exames` aceita laboratório (02.02), imagem (02.04 a 02.07) e ECG (02.11), em pedidos separados por grupo. O médico já pede mamografia, ultrassonografia obstétrica e ECG pelo app.

O que fica de fora, para todos, é o citopatológico (02.03). Com isso a decisão E2 se reduz a fazer o pedido aceitar o citopatológico, num PR próprio.

O enfermeiro pede só a lista abaixo, que é toda de laboratório. Imagem, ECG e citopatológico pelo enfermeiro ficam para depois da conferência com o protocolo do município.

## Lista proposta (laboratório, grupo 02.02)

Esta é a proposta de 17/11/2026, antes da conferência. A lista que vale está em "Lista final", no fim do documento.

### Pré-natal (Caderno nº 32)

| Exame | SIGTAP | Observação |
|---|---|---|
| Hemograma completo | 02.02.02.038-0 | |
| Grupo ABO (direta e reversa) | 02.02.12.002-3 | |
| Fator Rh | 02.02.12.008-2 | |
| Coombs indireto (teste indireto de antiglobulina) | 02.02.12.009-0 | gestante Rh negativo |
| Glicose | 02.02.01.047-3 | glicemia de jejum |
| Curva glicêmica (2 dosagens) | 02.02.01.004-0 | TOTG 75 g entre 24 e 28 semanas; conferir o código usado no município |
| Urina tipo I (EAS) | 02.02.05.001-7 | |
| Urocultura (cultura de bactérias) | 02.02.08.008-0 | |
| Sífilis, teste não treponêmico, em gestante | 02.02.03.117-9 | |
| HIV (antígeno ou anticorpo), em gestante | 02.02.03.151-9 | |
| Hepatite B (HBsAg), em gestante | 02.02.03.145-4 | |
| Hepatite C (anti-HCV), em gestante | 02.02.03.148-9 | |
| Toxoplasmose IgG | 02.02.03.076-8 | |
| Toxoplasmose IgM | 02.02.03.087-3 | |
| HIV, hepatite B e hepatite C em parceria de gestante | 02.02.03.152-7, 02.02.03.146-2, 02.02.03.149-7 | a sífilis da parceria não tem código laboratorial próprio na tabela da homologação: vai pelo teste rápido (PR 5) |

### Hipertensão e diabetes (Cadernos nº 36 e 37)

| Exame | SIGTAP | Observação |
|---|---|---|
| Glicose | 02.02.01.047-3 | |
| Hemoglobina glicada (HbA1c) | 02.02.01.050-3 | diabetes; conta no C4 |
| Creatinina | 02.02.01.031-7 | |
| Potássio | 02.02.01.060-0 | |
| Colesterol total | 02.02.01.029-5 | |
| Colesterol HDL | 02.02.01.027-9 | |
| Triglicerídeos | 02.02.01.067-8 | o LDL é calculado |
| Urina tipo I (EAS) | 02.02.05.001-7 | |
| Microalbumina na urina | 02.02.05.009-2 | diabetes |

### Rastreio na população geral

| Exame | SIGTAP |
|---|---|
| Sífilis, teste não treponêmico | 02.02.03.111-0 |
| HIV (antígeno ou anticorpo) | 02.02.03.150-0 |
| Hepatite B (HBsAg) | 02.02.03.144-6 |
| Hepatite C (anti-HCV) | 02.02.03.147-0 |

## Como entraria no app

- O pedido de exame da consulta de enfermagem só aceita estes códigos. Fora deles, o sistema recusa com a mensagem "fora do protocolo de enfermagem".
- O pedido por texto livre fica de fora para o enfermeiro. Texto livre não tem código, e a lista é por código.
- O resto não muda: o resultado, a conferência e os painéis seguem como no pedido do médico.

## Decisões para o RT

**E1. Lista**
- **A:** aprovar a lista acima, depois de conferida com os Cadernos.
- **B:** tirar ou incluir exames. Diga quais.

**E2. Imagem e citopatológico**
- **A:** abrir um PR para o pedido de exame aceitar citopatológico, mamografia de rastreamento, ultrassonografia obstétrica e ECG, para o médico e, pelo protocolo, para o enfermeiro.
- **B:** deixar como está, fora do app.

**E3. Parceria da gestante**
- **A:** manter os exames da parceria na consulta da gestante. O pedido sai em nome da parceria, que precisa estar cadastrada.
- **B:** tirar da lista. A parceria faz pela própria ficha.

## Decisões tomadas

Em 17/11/2026 o RT respondeu "Todas A":
- **E1 = A:** a lista vale depois de conferida com os Cadernos nº 32, 36 e 37 e com o protocolo Saúde das Mulheres.
- **E2 = A:** um PR próprio fará o pedido de exame aceitar o citopatológico. Mamografia, ultrassonografia e ECG o pedido já aceita (ver a correção acima).
- **E3 = A:** os exames da parceria ficam na consulta da gestante.

## Conferência com as fontes (17/11/2026)

Conferi com o texto dos quatro documentos, baixados do bvsms.saude.gov.br. As páginas abaixo são as impressas.

**Quem pede:**
- Pré-natal: o enfermeiro pede, com base explícita.
  - Caderno nº 32, p. 47, atribuições do enfermeiro: "Solicitar exames complementares de acordo com o protocolo local de pré-natal".
  - Saúde das Mulheres, p. 64–65: "Solicitação de exames, conforme o período gestacional"; quem faz: "Enfermeiro(a)/médico(a)".
- Hipertensão e diabetes: os Cadernos nº 36 (p. 37) e nº 37 (p. 42) dizem que o enfermeiro solicita "os exames previstos no protocolo assistencial local".
  - Os quadros de rotina (nº 36, Quadro 5, p. 41; nº 37, Quadro 9, p. 46) ficam na seção da consulta médica, com o título "rotina complementar mínima".
  - Os exames entram como rotina do programa (COFEN 195/1997).

**O que a conferência mudou:**
- Hepatite C em gestante: não é rotina. Caderno nº 32, p. 110, diz que não há evidência suficiente para rastreamento de rotina. O Saúde das Mulheres também não traz o exame.
- Rastreio na população geral: as quatro fontes só pedem sífilis, HIV e hepatites diante de queixa de IST, corrimento ou planejamento da gravidez. A base de rastreio estaria no protocolo de IST do Ministério, que não foi conferido.
- Eletroforese de hemoglobina: o Saúde das Mulheres, p. 79, pede para todas as gestantes na 1ª consulta (Nota Técnica 035/2011).
- Sífilis da parceria: o Saúde das Mulheres, p. 110 (Fluxograma 7), pede VDRL da parceria. A nota da tabela acima ("não tem código laboratorial") está errada. Isso vai para o PR da parceria.

**Decisões do RT (17/11/2026, "Todas A"):**
- **C1 = A:** sai a hepatite C em gestante.
- **C2 = A:** sai o rastreio da população geral por laboratório. O enfermeiro segue com os testes rápidos (PR 5). A volta depende da conferência com o protocolo de IST.
- **C3 = A:** entra a eletroforese de hemoglobina (02.02.02.035-5) no pré-natal.
- **C4 = A:** ficam os exames de hipertensão e diabetes, como rotina do programa.

## Lista final

| Linha | Exames (SIGTAP) |
|---|---|
| Pré-natal | hemograma 02.02.02.038-0; eletroforese de hemoglobina 02.02.02.035-5; grupo ABO 02.02.12.002-3; fator Rh 02.02.12.008-2; Coombs indireto 02.02.12.009-0; glicose 02.02.01.047-3; curva glicêmica 02.02.01.004-0; urina tipo I 02.02.05.001-7; urocultura 02.02.08.008-0; sífilis em gestante 02.02.03.117-9; HIV em gestante 02.02.03.151-9; hepatite B em gestante 02.02.03.145-4; toxoplasmose IgG 02.02.03.076-8 e IgM 02.02.03.087-3 |
| Hipertensão e diabetes | glicose; HbA1c 02.02.01.050-3; creatinina 02.02.01.031-7; potássio 02.02.01.060-0; colesterol total 02.02.01.029-5; HDL 02.02.01.027-9; triglicerídeos 02.02.01.067-8; urina tipo I; microalbumina 02.02.05.009-2 |

## Implementação

- Migration `20270415000010_ubs_exames_enfermeiro.sql`: lista em `private.ubs_exames_enfermagem()`; o gatilho da consulta de enfermagem só deixa passar código da lista e recusa texto livre.
- Tela: na consulta de enfermagem, a aba Exames mostra a lista final por linha de cuidado (pré-natal, hipertensão e diabetes). Sem busca, sem texto livre e sem pedido impresso. Exame fora da lista de exames da unidade aparece desligado.
- Exames da parceria da gestante (E3 = A): PR próprio, porque o pedido sai em nome da parceria cadastrada.

## Citopatológico (E2), implementação (18/11/2026)

- **Migration `20270415000012_ubs_citopatologico.sql`:** o pedido de exame aceita o subgrupo 02.03.01 (citopatologia).
  - Exames 02.03.01 entram no catálogo, na busca, na lista da unidade, no pedido impresso, na porta e na internação.
  - O citopatológico vai em pedido próprio (grupo "citopatologia"), como laboratório, imagem e ECG.
  - O anatomopatológico (02.03.02, biópsia e peça) continua fora: é da atenção especializada.
- **Enfermeiro:** pede o citopatológico de rastreamento (02.03.01.008-6) na linha "Rastreio do câncer do colo do útero".
  - Fonte: Saúde das Mulheres (2016), p. 175, "Exame citopatológico do colo do útero", quem faz "Enfermeiro(a)/médico(a)".
  - O citopatológico diagnóstico (02.03.01.001-9) fica com o médico.
- **Resultado:** entra pelo registro do exame, como imagem e ECG. A porta do laboratório integrado segue só com 02.02.
