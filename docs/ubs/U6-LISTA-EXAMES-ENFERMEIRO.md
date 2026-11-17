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

O pedido de exame (`pedir_exames`) só aceita o grupo 02.02 do SIGTAP, que é laboratório clínico. Hoje ninguém pede pelo app, nem o médico:
- citopatológico (02.03);
- mamografia (02.04);
- ultrassonografia obstétrica (02.05);
- eletrocardiograma (02.11).

Esses exames ficam fora desta lista. Para entrarem, o pedido de exame precisa aceitar imagem e citopatologia, o que é um PR à parte (decisão E2 abaixo).

## Lista proposta (laboratório, grupo 02.02)

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
- **E2 = A:** um PR próprio fará o pedido de exame aceitar citopatológico, mamografia, ultrassonografia obstétrica e ECG.
- **E3 = A:** os exames da parceria ficam na consulta da gestante.
