# Mapa CID → ferramentas — sem CID e dúvidas para o RT

Mapa inicial da F1 (pedido do RT de 17/11/2026; `src/clinico/cidFerramentasMapa.ts`). As ligações são 247, cobrindo 201 ferramentas. Cada ligação tem o trecho literal do topo da ferramenta que nomeia a condição; o teste confere. Os códigos foram conferidos na CID-10 da homologação. A R65 foi tirada, porque não está na tabela do DATASUS.

O RT aprova o mapa na Revisão Clínica (ficha `mapa-cid-ferramentas`, versão 2026-11-17.1). Mudança no mapa sobe a versão.

## Ferramentas sem CID (28)

- `adulto-isr`: doses da intubação, sem doença
- `adulto-infusoes`: tabela de infusões, sem doença
- `ped-bolus`: doses por peso, sem doença
- `child-pugh`: resumo e quandoUsar vazios no texto
- `four`: mede consciência, sem doença nomeada
- `news2`: sinais vitais, sem doença específica
- `rass`: escala de sedação, sem doença
- `ckd-epi-2021`: estima função renal, sem doença
- `cockcroft-gault`: estima clearance, cirrose é ressalva
- `sofa-2`: disfunção orgânica, sem doença nomeada
- `adulto-anticoagulacao-plena`: doses de anticoagulante, sem doença
- `adulto-sedacao-procedimento`: drogas de sedação, sem doença
- `adulto-transfusao-hemocomponentes`: gatilhos por Hb, sem doença
- `adulto-vm-obstruido-grave`: ajuste ventilatório; doença não nomeada
- `adulto-vm-mecanica`: fórmulas de mecânica, sem doença
- `adulto-vm-desmame`: critérios de desmame, sem doença
- `adulto-acessos-calibres`: calibres de acesso, sem doença
- `adulto-heparina-nao-fracionada`: dose de anticoagulante sem doença
- `acesso-venoso`: escolha de dispositivo, sem doença
- `ped-infusoes`: tabela de infusões sem doença
- `ped-via-aerea`: tubo e sequência rápida, procedimento
- `ped-sinais-vitais-icr`: referência de sinais vitais por idade
- `ped-pops-icr`: escore de triagem sem doença
- `ped-pews-icr`: escore de alerta sem doença
- `ped-fluidoterapia-manutencao`: necessidade hídrica basal, sem doença
- `ped-ictericia-neonatal`: texto não nomeia icterícia/hiperbilirrubinemia
- `ped-sedacao-procedimento`: sedação para procedimento, sem doença
- `ped-tfg-schwartz`: fórmula de TFG sem doença

## Dúvidas (60)

- `child-pugh`: Sem resumo nem quandoUsar no arquivo de entrada; quando o texto existir, provavelmente K70/K74 (cirrose).
- `sepse-adulto`: Choque séptico ligado a R57 (choque NCOP). R65 (SIRS) e R57.2 só existem em atualizações da OMS; conferir se a tabela DATASUS em uso tem R65 antes de acrescentar.
- `killip`: O resumo nomeia "insuficiência cardíaca no infarto"; I50 não foi ligado para o Killip não aparecer em toda IC fora do infarto.
- `mcisaac-centor`: "dor de garganta" é R07.0, mas R07 (3 caracteres) também é dor torácica; R07 não foi ligado para o McIsaac não aparecer na dor no peito. J03 (amigdalite) não é nomeado.
- `ottawa-tornozelo-pe`: S82 inclui fraturas da diáfise da perna além do tornozelo; alternativa mais ampla seria S90-S99 (traumatismos do tornozelo e do pé).
- `four`: quando:1 cita síndrome do encarceramento (G83.5) e herniação (G93.5), mas G83/G93 são categorias amplas; R40 (coma) também não é nomeado. Mantido sem CID; o mesmo vale para R40 no glasgow.
- `sofa-2`: quando:1 fala em "adulto com infecção suspeita", mas não nomeia sepse; A40-A41 não ligado.
- `adulto-hipoglicemia`: O resumo diz "com e sem diabetes"; só E16 foi ligado, E10-E14 não, para não aparecer em todo diabético.
- `adulto-itu`: ITU na sonda vesical também seria T83 (complicação de dispositivo geniturinário); não ligado por ser categoria ampla.
- `adulto-taquiarritmias`: I49 (outras arritmias) não ligado: inclui fibrilação ventricular e extrassístoles, fora de "taquiarritmias com pulso".
- `adulto-cefaleia`: quando:0 nomeia hemorragia subaracnóidea (I60), trombose venosa cerebral e dissecções como causas da cefaleia em thunderclap; não ligados.
- `adulto-anafilaxia`: Choque anafilático por medicamento é T88.6 e por soro T80.5; só T78 foi ligado.
- `adulto-animais-peconhentos`: Só T63; as causas externas X20-X22 (serpente, aranha, escorpião) não foram ligadas.
- `adulto-tetano-profilaxia`: quando:0 lista ferimentos (queimadura, mordedura, fratura exposta etc.); códigos de ferimento são muitos e amplos, não ligados. Só A35 (tétano acidental).
- `adulto-pep-hiv`: Exposição ao HIV ligada a Z20 (Z20.6) e violência sexual a T74 (T74.2); conferir se o RT quer também Y05.
- `4t-hit`: Na CID-10 da OMS/DATASUS a TIH entra em D69 (D69.5 trombocitopenia secundária); D75.82 é só da CID-10-CM americana.
- `meld-3`: Resumo fala em "doença hepática avançada" e quando:2 em "doença hepática terminal"; K72 (insuficiência hepática) não ligado.
- `light`: quando:1 cita insuficiência cardíaca como ressalva da interpretação; I50 não ligado.
- `adulto-raiva-pos-exposicao`: Usei Z20 (Z20.3 contato com raiva) e Z24 (Z24.2 imunização antirrábica) para a profilaxia, e W55 (mordedura de outros mamíferos) só para a frase do animal silvestre. O texto não cita cão nem gato, então W54 ficou de fora, apesar de ser o CID mais comum na UPA. Não liguei A82 (raiva doença), porque a ficha é de profilaxia. Ver se o RT quer W54 e se aceita códigos W (causa externa) na ligação.
- `adulto-hepatite-b-pos-exposicao`: Z20/Z24 (exposição e imunização), não B16/B18: a ficha é profilaxia pós-exposição. A exposição ocupacional a sangue não tem outro código de 3 caracteres no texto.
- `adulto-sintomas-paliativos`: Z51 é a categoria inteira de "outros cuidados médicos" (inclui Z51.1 quimioterapia e Z51.0 radioterapia); o cuidado paliativo é Z51.5. Com a regra de 3 caracteres, a ficha aparece também em sessão de quimio. Avaliar se o RT aceita.
- `adulto-trombolise-avc`: Só I63, porque a frase diz "AVC isquêmico". O I64 (AVC não especificado), muito usado na UPA antes da TC, ficou de fora. Incluir I64?
- `adulto-reversao-anticoagulacao`: D68 (D68.3 hemorragia por anticoagulante circulante) veio da frase "reversão da varfarina... pelo sangramento". A frase do quando:0 lista sangramento intracraniano, retroperitoneal, GI maciço e epistaxe; não liguei K92/R04 para não mostrar a reversão em todo sangramento digestivo ou nasal.
- `adulto-rankin-modificada`: A frase diz só "capítulo de AVC", sem o tipo. Usei I63 e I64; ficaram de fora I61 e I60 (o Rankin também se usa no AVC hemorrágico).
- `adulto-escala-numerica-dor`: Escalas de dor (numérica, PAINAD, BPS) ligadas a R52 (dor não classificada). Se o RT considerar a escala de dor um sinal vital, retirar as três ligações R52.
- `adulto-bps`: Ligada só a R52. Inconsciência (R40) e ventilação mecânica (Z99.1) aparecem no texto como população-alvo, mas não são a condição medida. Ficaram de fora.
- `adulto-transfusao-hemocomponentes`: Ficou sem CID: o texto fala do gatilho de Hb, não de anemia nem de hemorragia como diagnóstico (SCA e sangramento maciço aparecem só como exceções). Se o RT quiser, D62/D64 precisariam de frase no texto da ficha.
- `adulto-vm-obstruido-grave`: "Obstruído grave" sugere asma e DPOC (J44/J45/J46), mas não nomeia a doença. Ficou sem CID.
- `adulto-abc-score`: "Trauma" e "traumatizado" genéricos foram para T07 (traumatismos múltiplos) e T14 (região não especificada), em ABC, MGAP e Triage-RTS. Os S-códigos por região ficaram de fora, então a ficha não aparece com um CID de trauma específico (por exemplo, S36).
- `adulto-ressuscitacao-volemica`: A sepse virou A40-A41, e o choque, R57. O R65 (SIRS/sepse grave) ficou de fora porque não sei se existe na CID-10 do DATASUS (ele não está no sigtap_cid.sql). Confirmar.
- `adulto-vm-ajuste-inicial`: A hipoxemia e a falência ventilatória viraram J96 (insuficiência respiratória). R09 (R09.0 inclui hipoxemia em versões novas da CID) ficou de fora.
- `adulto-emergencia-hipertensiva`: Do quando:1 (lista de DOMH) liguei só encefalopatia hipertensiva (I67, categoria ampla de outras doenças cerebrovasculares), dissecção de aorta (I71) e pré-eclâmpsia/eclâmpsia (O14-O15). Ficaram de fora, para não inundar outros diagnósticos: IAM/angina (I20/I21), EAP (J81), AVE (I63/I64), IRA (N17) e hemólise. I10 segue a decisão "crise hipertensiva = I10".
- `adulto-ic-aguda`: O resumo não nomeia IC; a ligação I50 veio de "IC é improvável com BNP..." (quando:0). O choque cardiogênico foi para R57 (categoria de choque, com R57.0).
- `adulto-ascite-pbe-hepatorrenal`: PBE em K65 (peritonite), síndrome hepatorrenal em K76 (K76.7) e "cirrose com ascite" em K70, K74 e R18. O "estádio ICA-AKI" não foi ligado a N17, que já é da ficha de LRA.
- `adulto-rabdomiolise`: Rabdomiólise não traumática está em M62 (M62.8) e a traumática em T79 (T79.6). T79 é ampla (choque traumático, embolia gordurosa, síndrome compartimental). Manter T79?
- `adulto-cairo-bishop`: A síndrome de lise tumoral é E88.3 na CID-10 da OMS, mas o sigtap_cid.sql só traz E88.0-E88.2/E88.8/E88.9. A ligação usa a categoria E88 (outros distúrbios metabólicos); confirmar se o DATASUS tem E88.3.
- `adulto-mascc`: Neutropenia febril em D70 (agranulocitose/neutropenia). Não liguei R50 (febre): a frase é a entidade "neutropenia febril", e R50 mostraria MASCC em toda febre.
- `adulto-regiscar`: DRESS não tem código próprio na CID-10; usei L27 (erupção por droga de uso interno, L27.0), em RegiSCAR e Dermatoses graves. Alternativa: T88.7. Confirmar com o RT.
- `adulto-smart-cop`: PAC em J12-J18 (inclui J12, pneumonia viral) nas três fichas de PAC. Se o RT quiser só bacteriana, trocar por J13-J18.
- `adulto-hints-plus`: A síndrome vestibular aguda foi para H81 (transtornos da função vestibular) e R42 (tontura). O texto também cita "excluir AVC", mas não liguei I63/I64.
- `adulto-agitacao`: SNM em G21 (G21.0, dentro de parkinsonismo secundário). O delirium foi para F05; F10.4 (abstinência com delirium) ficou de fora porque o texto não cita álcool.
- `adulto-heparina-nao-fracionada`: Texto só cita instabilidade hemodinâmica, disfunção renal etc. como motivo de preferir HNF, não como indicação; TEV/TEP/SCA não aparecem no resumo nem no quandoUsar. Ficou sem CID; se o RT quiser I26/I80-I82, o texto precisa nomear a doença.
- `adulto-qtc`: Ligado a I47 só por "pelo risco de torsades" (a torsades é arritmia, I47). O texto não diz "QT longo" (I45); se disser, I45 entra.
- `ped-sinais-vitais-icr`: O resumo cita "choque séptico" e "anafilaxia" e o q0 cita taquicardia/bradicardia, mas como faixas de referência de sinal vital; ficou sem CID pela regra de referência de sinais vitais. Alternativa: R00 pelo q0.
- `ped-ictericia-neonatal`: Nem o resumo nem o quandoUsar escrevem "icterícia" ou "hiperbilirrubinemia" (só fototerapia, exsanguineotransfusão e bilirrubina). Com essa palavra no texto, ligaria a P59 (e P55 se citar doença hemolítica).
- `ped-reanimacao-neonatal`: Ligado a P28 pela "Apneia" do q1. Asfixia ao nascer (P21) não está escrita no texto, então não entrou.
- `ped-tetano-raiva`: Só o tétano acidental (A35) entrou. A profilaxia antirrábica e a do tétano no ferimento são de exposição (Z20, W54, T14), e o texto não nomeia uma doença para elas.
- `ped-twist`: Só N44 (torção). "dor testicular aguda"/"escroto agudo" seria N50 (N50.8), categoria ampla; não incluído.
- `ped-hipoglicemia`: E15-E16 pela "hipoglicemia da criança". Hipoglicemia neonatal (P70) e a do diabético (E10-E14) não entraram porque o texto não as nomeia.
- `ped-febre-sem-sinais`: Só R50. O lactente de 8 a 28 dias é recém-nascido; a febre do RN poderia ser P81, que o texto não nomeia.
- `ped-crise-hipertensiva`: I10, pela decisão do RT (crise hipertensiva = I10, #817). Na criança a hipertensão é com frequência secundária (I15); não incluído.
- `ped-coma-hic`: Não há código próprio para hipertensão intracraniana secundária na CID-10; usei G93 (G93.2/G93.6 edema cerebral) junto com R40 (coma). Conferir se o RT aceita G93.
- `ped-febre-imunodeprimido`: O texto não escreve "febre". Ligado a D80-D84 por "padrões por tipo de imunodeficiência". O imunodeprimido por remédio (D84.8, ou Z79) entra só em parte.
- `ped-emergencias-oncologicas`: Lise tumoral em E88 (E88.3 pode não existir na tabela do DATASUS; a categoria E88 existe). Hiperviscosidade e síndromes compressivas ficaram sem CID por falta de código preciso.
- `adulto-profilaxia-ulcera-estresse`: É profilaxia: ligado a R57 e D65-D68 por "com coagulopatia ou choque" (indicação do q0). K25 (a úlcera em si) não entrou. Se o RT preferir não ligar profilaxia a choque/coagulopatia, mover para semCid.
- `adulto-profilaxia-tev`: Ligado à sepse (A40-A41, R65) e à exacerbação de DPOC (J44), que são as indicações escritas. TEV (I26/I80-I82) não entrou porque profilaxia não é para quem já tem TEV.
- `ped-hemoterapia`: Ligado só a D62 por "Na anemia aguda". A transfusão maciça não é doença; o choque hemorrágico (R57) não está escrito.
- `adulto-vm-cinco-passos`: Hipoxemia em R09 (R09.0 no índice da CID-10) e falência ventilatória em J96. Hipercapnia isolada não tem código próprio.
- `ped-glomerulopatias-shu`: GNPE (glomerulonefrite pós-estreptocócica) em N00 (síndrome nefrítica aguda), pela sigla do resumo. A SHU entrou em D59.
- `ped-choque-icr`: Vale também para ped-phoenix. Sepse e choque séptico em A40-A41, R57 e R65. R57.2 e R65.1 dependem da versão da tabela do DATASUS; as categorias de 3 caracteres existem.
