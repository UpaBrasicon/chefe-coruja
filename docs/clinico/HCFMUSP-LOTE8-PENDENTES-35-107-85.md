# Revisão do HCFMUSP, lote 8, pendentes: cap. 35 (aspiração), 107 (marca-passo) e a AAO 2026 no cap. 85

Em 14/11/2026 o RT decidiu Q1 a Q4 = A e liberou a produção do lote 8 inteiro. Os cap. 35 e 107 ficaram parados porque os sites das fontes pediam verificação de navegador. Em 15/11/2026 o RT passou a verificação no Chrome dele, nas três abas, e os textos integrais puderam ser lidos. A verificação não foi contornada por mim.

## Fontes

- **Cap. 35, declaração da BTS 2023 sobre pneumonia aspirativa:** Simpson et al., Thorax 2023;78(Suppl 1):s3–s21 (PMID 36863772).
  - Texto integral lido no site da revista. São pontos de prática clínica, sem graduação.
  - Cada trecho da nota foi conferido no texto: o resumo dos pontos de prática, a seção de microbiologia e a de antibiótico.
  - A declaração trata da pneumonia por microaspiração. A pneumonite química por aspiração de grande volume fica fora do escopo dela.
- **Cap. 107, diretriz CCS/CHRS 2026 de dispositivos cardíacos implantáveis:** Can J Cardiol 2026;42(1):1–68 (PMID 41539743).
  - Texto integral lido no site da revista. Usa GRADE.
  - Entraram só as recomendações 95 a 97, de infecção do dispositivo, que tocam o PS. O resto trata de indicação, implante e seguimento.
  - A diretriz não traz orientação sobre o uso do ímã. O manual traz (cap. 107, p. 1459) e continua valendo.
- **Cap. 85, AAO 2026 de doença por fechamento angular primário:** Gedde et al., Ophthalmology 2026;133(4):P153–P201 (PMID 41665581).
  - Texto integral lido no site da revista. Não encontrei graduação nas frases usadas.
  - Entraram a conduta na crise aguda e o olho contralateral.
- **Manual:** conferido no PDF. Cap. 35, p. 474 e 479; cap. 85, Tabela 11, p. 1133.

## O que mudou na Central

- **Nota nova `nota-hcfmusp-cap35-aspiracao`:** 4 itens (diagnóstico, anaeróbio, antibiótico e duração, cuidados gerais).
- **Nota nova `nota-hcfmusp-cap107-marca-passo`:** 2 itens (suspeita de infecção do dispositivo; infecção confirmada ou bacteremia persistente).
  - Pela Q2 o cap. 107 teria lista na ficha `adulto-marca-passo-provisorio`. A ficha trata do marca-passo provisório, e a CCS/CHRS 2026 trata do dispositivo implantado. Por isso ficou só a nota, sem mexer na ficha.
- **Nota `nota-hcfmusp-cap85-oftalmologia`, versão 2026-11-15.1:** ganhou 2 itens de glaucoma agudo e a AAO 2026 como segunda fonte. O item da oclusão da artéria central da retina não mudou.
- **Migration:** `20270414000050`.

## Onde a fonte difere do manual

| Tema | Fonte nova | Manual |
|---|---|---|
| Anaeróbio na pneumonia aspirativa | BTS 2023: não cobrir de rotina; cobrir no risco alto (doença periodontal evidente, escarro pútrido, abscesso ou empiema) | esquemas com cobertura para anaeróbio; sem fator de risco, quinolona respiratória ou ceftriaxona |
| Duração | BTS 2023: 5 dias bastam, salvo se não melhorar | 5 a 7 dias com boa evolução; mais na necrotizante, no abscesso e no empiema |
| Radiografia | BTS 2023: não mostra a pneumonia aspirativa em até 25% dos casos, comparada à TC | infiltrado na radiografia ou na TC |
| Infecção de marca-passo ou CDI | CCS/CHRS 2026: hemoculturas antes do antibiótico, ETE antes da extração, retirar todo o sistema na infecção definida | não trata |
| Glaucoma agudo | AAO 2026: baixar a pressão logo; depois, iridotomia, iridectomia ou extração do cristalino | Tabela 11: acetazolamida, manitol e colírios |
| Olho contralateral | AAO 2026: iridotomia a laser logo, no olho fácico | não trata |

## Antes e depois (15/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| pneumonia aspirativa: cobrir anaeróbio? | só no alto risco, por uma nota da Central e pelo manual | BTS 2023: não de rotina; cobrir no risco alto; o manual ao lado |
| pneumonia aspirativa: quantos dias? | "apenas de forma indireta, pelo manual de 2022": 5 a 7 dias | BTS 2023: 5 dias; o manual ao lado |
| suspeita de infecção de marca-passo | "não encontrei" | CCS/CHRS 2026: culturas, ETE e retirada do sistema |
| glaucoma agudo: tratamento | só o manual | AAO 2026 com a Tabela 11 do manual ao lado |
| glaucoma agudo: o outro olho | "não trazem orientação" | AAO 2026: iridotomia a laser logo |

## Homologação

- A migration foi aplicada. As notas dos cap. 35 e 107 e a versão nova da nota do cap. 85 estão aguardando aprovação.
- As três notas foram ingeridas, e a API foi reiniciada.
- Os testes da nota passam, e o typecheck está limpo.

## Produção do #734, 15/11/2026

- A migration `20270414000050` foi aplicada antes do merge. O #734 foi mesclado com o CI verde.
- Foram ingeridos 3 arquivos, e a API foi reiniciada. O Vercel publicou o master.
- As cinco respostas saíram como na homologação.
