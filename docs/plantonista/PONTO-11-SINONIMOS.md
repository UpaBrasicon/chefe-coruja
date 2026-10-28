# Ponto 11 — lista de sinônimos para a busca de medicamento

**Situação (28/10/2026).**

- O RT aprovou a lista A como está.
- Da lista B, o RT mandou gravar só os nomes que passassem na Anvisa.
- Gravado na homologação pela migration
  `20270203000002_sinonimos_medicamento`: 45 termos da lista A e 21 da lista B.
- Na produção desde 28/10/2026, com o "ok produção" do RT. A mesma migration
  foi aplicada depois do merge do PR #308.

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

**Conferência na Anvisa (28/10/2026).**

- **Fonte.** A consulta pública da Anvisa bloqueia acesso automático. Por isso
  usei os dados abertos de medicamentos registrados, da própria Anvisa
  (`dados.anvisa.gov.br`, arquivo `DADOS_ABERTOS_MEDICAMENTOS.csv`, atualizado
  em 13/10/2026).
- **Regra para passar.** O nome tem registro ativo, e todos os registros
  ativos têm um único princípio ativo, o do cadastro.
- **Registro.** O número do registro fica gravado na coluna `fonte`.

**Passaram 21 nomes.** Ficaram de fora 5:

- **Zofran e Solu-Cortef:** sem registro ativo.
- **Vancocina:** sem registro.
- **Rocefin:** o registro ativo inclui cloridrato de lidocaína junto com a
  ceftriaxona.
- **Tazocin:** é a combinação piperacilina + tazobactam.

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

## Ajuste feito ao gravar

No primeiro teste, "epinefrina" também trazia a Noradrenalina, porque
"norepinefrina" contém "epinefrina". Adrenalina e noradrenalina são um par de
nomes parecidos conhecido.

- Agora o sinônimo só acha pelo **começo de uma palavra**: "epinefrina" acha só
  a Adrenalina, e "norepinefrina" acha só a Noradrenalina.
- No nome do cadastro continua valendo qualquer pedaço: "dip" acha a dipirona.
