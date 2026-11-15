# Revisão do HCFMUSP, lote 9, Q3: cap. 53 (náuseas e vômitos) e 56 (icterícia)

Em 15/11/2026 o RT decidiu Q1 a Q4 = A no lote 9 e liberou a produção do lote inteiro. Pela Q3, estes capítulos ganham só a nota, ligada ao capítulo do manual, porque não há ficha de adulto na Central. Nenhuma ferramenta nova.

## Fontes

- **Cap. 53, RCEM 2024 de síndrome de hiperêmese canabinoide no PS:** Humphries e Gillings, Emerg Med J 2024;41(5):328–331 (PMID 38448215).
  - Texto integral lido no site da revista, pelo Chrome. A página pediu verificação de navegador; ela passou sozinha na segunda tentativa, sem nenhuma ação minha.
  - A Tabela 2 (doses) só aparece ao abrir a tabela na página; foi lida junto com as notas de rodapé.
  - Níveis de recomendação pela SORT (A a C).
- **Cap. 56, IDSA 2024 de imagem na suspeita de colecistite e colangite agudas:** Bonomo et al., Clin Infect Dis 2024;79(Suppl 3):S104–S108 (PMID 38963820).
  - Texto integral lido no site da revista, pelo Chrome. A verificação de navegador passou sozinha.
  - GRADE. A evidência é de USG feita e laudada por radiologista; o POCUS ficou fora da análise, e a nota diz isso.
- **Manual:** cap. 53, p. 730, 736 e 737; cap. 56, p. 771, 775 e 776.

## O que mudou na Central

- Notas novas, versão 2026-11-15.1, aguardando aprovação:
  - `nota-hcfmusp-cap53-nauseas-vomitos` (4 itens: quando suspeitar, investigação, refratário, alta);
  - `nota-hcfmusp-cap56-ictericia-colangite` (4 itens: primeira imagem, se a USG não resolver, diagnóstico, gestante).
- **Migration:** `20270414000053`.

## Onde a fonte difere do manual

| Tema | Fonte nova | Manual |
|---|---|---|
| Hiperêmese canabinoide | RCEM 2024: considerar no vômito cíclico com uso de cannabis | vômitos cíclicos entre as causas; não cita a cannabis |
| Vômito refratário | haloperidol IM 0,05 mg/kg (máx. 5 mg) ou capsaicina 0,1% no abdome, com ECG antes do haloperidol | haloperidol entre os antidopaminérgicos; não trata da hiperêmese canabinoide |
| Imagem na colangite | USG primeiro; se duvidosa, TC com contraste; depois, ressonância | USG diagnóstica em 90%; CPRE é o exame definitivo |
| Gestante | USG ou ressonância, sem preferência | não trata |

## Antes e depois (15/11/2026)

| Pergunta | Produção, antes | Homologação, depois |
|---|---|---|
| vômitos cíclicos em usuário de maconha | não traz a síndrome | RCEM 2024: pensar em hiperêmese canabinoide |
| hiperêmese canabinoide: tratamento | só canabinoide na quimioterapia | RCEM 2024: haloperidol ou capsaicina, com os cuidados |
| colangite: primeira imagem | "não encontrei" | IDSA 2024: USG de abdome |
| colangite: USG não confirmou | "não encontrei" | IDSA 2024: TC com contraste, depois ressonância |
| gestante com suspeita de colecistite | "não encontrei" | IDSA 2024: USG ou ressonância |

## Homologação

- A migration foi aplicada, e as duas notas estão aguardando aprovação.
- As notas foram ingeridas, e a API foi reiniciada.
- Os testes da nota passam, e o typecheck está limpo.

## Produção do #738, 15/11/2026

- A migration `20270414000053` foi aplicada antes do merge. O #738 foi mesclado com o CI verde.
- Foram ingeridos 2 arquivos, e a API foi reiniciada. O Vercel publicou o master.
- As cinco respostas saíram como na homologação.
