# Ponto 11 — lista de sinônimos para a busca de medicamento

**Situação: proposta, aguardando a aprovação do RT.** Nada desta lista está
gravado no banco. Ela entra numa migration própria só depois do "aprovo".

## Como a lista funciona

- O sinônimo só ajuda a **achar** o remédio. A linha do resultado mostra
  sempre o nome e a apresentação do cadastro, por exemplo
  "AAS = Ácido acetilsalicílico · comprimido". O sinônimo nunca troca o nome
  do cadastro.
- **Sem dose:** a lista só tem nomes.
- **Pelo princípio ativo:** o sinônimo vale para todas as apresentações
  daquele princípio ativo, inclusive as que o farmacêutico cadastrar depois.
- **Exceção, presa à concentração:** os termos de soro (SF, SG) só valem
  para a concentração indicada.
  - O cadastro tem cloreto de sódio a 0,9 % (bolsa) e a 20 % (ampola), e
    glicose a 5 % (bolsa) e a 50 % (ampola).
  - "Soro fisiológico" não pode trazer a ampola a 20 %, e "soro glicosado"
    não pode trazer a ampola a 50 %.
  - Por isso o banco guarda, além do princípio ativo, a concentração quando
    ela é exigida.
- A base é o cadastro de 65 itens da homologação. A produção tem o próprio
  cadastro. O sinônimo vale lá para o mesmo princípio ativo, e, quando a
  lista exige concentração, só para a mesma concentração.

## A. Siglas e sinônimos (DCB, DCI e uso corrente)

**Origem:**
- **DCB:** Denominação Comum Brasileira.
- **DCI:** nome internacional (OMS).
- **USAN:** nome norte-americano, que aparece em artigos e livros.
- **Sigla:** sigla de uso clínico corrente.

| Medicamento do cadastro | Termos que passam a achar | Origem | Só na concentração |
|---|---|---|---|
| Ácido acetilsalicílico | AAS | sigla | — |
| Adrenalina | epinefrina | DCB | — |
| Noradrenalina | norepinefrina; nora | DCB; sigla | — |
| Dipirona sódica | metamizol | DCI | — |
| Paracetamol | acetaminofeno | USAN | — |
| Salbutamol | albuterol | USAN | — |
| Cetamina | ketamina; quetamina | DCI (grafia inglesa); grafia antiga | — |
| Fentanila | fentanil | uso corrente | — |
| Cloreto de sódio | SF; SF 0,9%; soro fisiológico; salina | sigla; uso corrente | 0,9% |
| Cloreto de sódio | NaCl 20%; sal hipertônico | sigla | 20% |
| Glicose | SG; SG 5%; soro glicosado; dextrose | sigla; USAN | 5% |
| Glicose | glicose hipertônica; G50 | uso corrente; sigla | 50% |
| Ringer com lactato | RL; Ringer lactato | sigla | — |
| Cloreto de potássio | KCl | sigla | — |
| Sulfato de magnésio | MgSO4 | sigla | — |
| Bicarbonato de sódio | bic | sigla | — |
| Gluconato de cálcio | gluconato | uso corrente | — |
| Heparina sódica | HNF; heparina não fracionada | sigla | — |
| Enoxaparina sódica | HBPM | sigla | — |
| Insulina humana regular | insulina R; regular | uso corrente | — |
| Alteplase | rtPA; rt-PA | sigla | — |
| Amoxicilina + clavulanato | amoxiclav; amoxicilina clavulanato | uso corrente | — |
| Piperacilina + tazobactam | pipe tazo; piperacilina tazobactam | uso corrente | — |
| Rifampicina + isoniazida + pirazinamida + etambutol | RHZE; esquema básico | sigla (Ministério da Saúde) | — |
| Tiamina | vitamina B1 | uso corrente | — |
| Soro antibotrópico | SAB | sigla (Ministério da Saúde) | — |
| Brometo de ipratrópio | ipratrópio | DCB (sem o sal) | — |
| Rocurônio | brometo de rocurônio | DCB (com o sal) | — |

## B. Nomes comerciais (só quando o produto tem um único princípio ativo)

**Ainda não conferi nenhum destes no registro da Anvisa.** A lista vem do uso
clínico corrente. Antes de gravar, cada nome precisa ser conferido na
consulta de registros da Anvisa: o produto tem só este princípio ativo e
continua registrado. O nome que não passar fica de fora.

| Medicamento do cadastro | Nome comercial |
|---|---|
| Metoclopramida | Plasil |
| Dipirona sódica | Novalgina |
| Paracetamol | Tylenol |
| Ondansetrona | Zofran |
| Prometazina | Fenergan |
| Ceftriaxona | Rocefin |
| Piperacilina + tazobactam | Tazocin |
| Vancomicina | Vancocina |
| Cefalexina | Keflex |
| Azitromicina | Zitromax |
| Enoxaparina sódica | Clexane |
| Furosemida | Lasix |
| Hidrocortisona | Solu-Cortef |
| Midazolam | Dormonid |
| Diazepam | Valium |
| Haloperidol | Haldol |
| Fenobarbital | Gardenal |
| Amiodarona | Ancoron |
| Propofol | Diprivan |
| Alteplase | Actilyse |
| Rocurônio | Esmeron |
| Tramadol | Tramal |
| Morfina | Dimorf |
| Salbutamol | Aerolin |
| Brometo de ipratrópio | Atrovent |
| Clopidogrel | Plavix |

Ficaram de fora os nomes comerciais de combinações (por exemplo Clavulin),
conforme a decisão do RT.

## Perguntas ao RT

1. Aprova a lista A como está, ou tira ou acrescenta algum termo?
2. Na lista B, confiro cada nome na Anvisa e gravo só os que passarem?
