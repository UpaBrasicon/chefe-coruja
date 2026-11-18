# LG11: mapa do módulo clínico

<!-- Gerado por scripts/modulo-clinico.mjs a partir de docs/regulatorio/modulo-clinico/mapa.json. Não edite à mão: edite o JSON e rode `node --experimental-strip-types scripts/modulo-clinico.mjs`. -->

Versão 2026-11-17. Mapa técnico para o consultor regulatório (LG11, decisão C3). Não é parecer: a classe e a fronteira são propostas. Na dúvida, o grupo fica "dentro".

## Classes

- **dentro (SaMD provável):** usa dado de um paciente para orientar diagnóstico ou tratamento dele.
- **zona cinzenta:** o consultor decide.
- **fora:** registro, gestão ou referência igual para todo paciente.

## Resumo

335 fichas: 229 dentro, 104 na zona cinzenta e 2 fora. Mais 10 funções do sistema que não são fichas.

| Grupo | Classe | Revisam (LG13) | Fichas |
|---|---|---|---|
| Escores da Central | dentro (SaMD provável) | medico | 46 |
| Condutas e calculadoras do adulto | dentro (SaMD provável) | medico + farmaceutico | 123 |
| Condutas e calculadoras da pediatria | dentro (SaMD provável) | medico + farmaceutico | 56 |
| Escores que alimentam alertas no prontuário | dentro (SaMD provável) | medico | 4 |
| Apoio à classificação de risco | zona cinzenta | medico + enfermeiro | 5 |
| Escalas e diagnósticos de enfermagem | zona cinzenta | medico + enfermeiro | 3 |
| Apoio clínico, crescimento, paliativo e atalhos | zona cinzenta | medico | 6 |
| Notas de referência do HCFMUSP | zona cinzenta | medico | 90 |
| Carga de trabalho da enfermagem | fora | medico + enfermeiro | 2 |

## Funções do sistema

| Função | Classe | Motivo | Onde |
|---|---|---|---|
| Alerta de sepse do adulto no painel da internação e da observação | dentro (SaMD provável) | Regra (NEWS2, qSOFA e SOFA) sobre os sinais vitais de um paciente gera alerta. | `supabase/migrations/20270405000002_sepse_adulto_alerta.sql`, `src/clinico/escores/sepseAdulto.ts` |
| Aviso "pensar em sepse" no atendimento (F7) | dentro (SaMD provável) | CID infeccioso mais NEWS2 da triagem geram aviso com exames a considerar. | `supabase/migrations/20270416000001_f7_aviso_sepse_atendimento.sql`, `src/components/clinico/AvisoSepseAtendimento.tsx` |
| NEWS2 e PEWS calculados dos sinais vitais do prontuário | dentro (SaMD provável) | Cálculo automático de risco do paciente mostrado na tela. | `supabase/migrations/20260928000002_fase3_vitais_crus_acuidade.sql`, `src/clinico/news2.ts` |
| Phoenix e PELOD-2 na pediatria | dentro (SaMD provável) | Critério de sepse pediátrica calculado com os dados da criança. | `supabase/migrations/20260928000007_fase3_phoenix_pelod2.sql` |
| Interações críticas na prescrição | dentro (SaMD provável) | Alerta sobre a combinação de medicamentos prescritos para um paciente. | `supabase/migrations/20261031000005_interacoes_criticas.sql`, `src/lib/interacoes.ts` |
| Trava por alergia e classe alergênica na prescrição | dentro (SaMD provável) | Bloqueia ou alerta a prescrição conforme a alergia registrada do paciente. | `supabase/migrations/20261003000008_alergia_trava_por_classe.sql` |
| Dupla checagem de medicamento de alta vigilância | zona cinzenta | Exige conferência por lista fixa de medicamentos; não calcula nada para o paciente. | `supabase/migrations/20261101000002_liberacao_farmacia_alta_vigilancia.sql` |
| Sugestão de CID a partir do texto da avaliação | zona cinzenta | Sugere código diagnóstico de um paciente; o médico escolhe (pergunta 4 ao consultor). | `supabase/migrations/20270302000001_cid_sugerido.sql`, `src/lib/cidSugerido.ts` |
| Ferramentas pelo CID, com idade e peso do prontuário | zona cinzenta | Atalho que abre a ferramenta e pode levar idade e peso; a ferramenta aberta segue a classe dela (pergunta 9). | `src/clinico/cidFerramentas.ts`, `src/components/clinico/FerramentasDoCid.tsx`, `src/components/clinico/JanelaFerramenta.tsx` |
| Perguntar à IA e assistentes (Corujinha) | zona cinzenta | Hoje responde da biblioteca com fonte, sem dado do paciente; vira SaMD se responder sobre um caso (decisão R3). | `supabase/functions/clinical-search/index.ts`, `biblioteca/app/main.py` |

## Grupos de fichas

### Escores da Central

`escores` · dentro (SaMD provável) · revisam: medico · 46 fichas

Calcula pontuação e faixa de risco com os dados de um paciente e mostra os próximos passos.

`4at-delirium`, `4t-hit`, `abcd2`, `aims65`, `alvarado`, `bisap`, `cam-icu`, `canadian-ct-head`, `cha2ds2-va`, `child-pugh`, `civd-isth`, `ckd-epi-2021`, `cockcroft-gault`, `crb-65`, `curb-65`, `fast-ed`, `four`, `genebra-revisado`, `glasgow`, `glasgow-blatchford`, `grace`, `has-bled`, `heart`, `iss`, `killip`, `light`, `mcisaac-centor`, `meld-3`, `ottawa-joelho`, `ottawa-tornozelo-pe`, `ped-pram`, `ped-twist`, `psi-port`, `race`, `ranson`, `rass`, `rockall`, `sgarbossa-modificado`, `sincope-canadense`, `sofa-2`, `spesi`, `timi-iamcsst`, `twist`, `wells-tep`, `wells-tvp`, `years`

### Condutas e calculadoras do adulto

`adulto` · dentro (SaMD provável) · revisam: medico + farmaceutico · 123 fichas

Orienta conduta de um paciente; a maior parte calcula dose, volume ou escore pelo peso, pela idade ou pelos exames.

`adulto-abc-score`, `adulto-abstinencia-alcoolica`, `adulto-add-rs`, `adulto-agitacao`, `adulto-anafilaxia`, `adulto-animais-peconhentos`, `adulto-anticoagulacao-plena`, `adulto-ascite-pbe-hepatorrenal`, `adulto-asma-exacerbacao`, `adulto-ats-idsa-pac`, `adulto-bars`, `adulto-bicarbonato`, `adulto-bps`, `adulto-bradicardia`, `adulto-burch-wartofsky`, `adulto-cad-ehh-avaliacao`, `adulto-cad-ehh-tratamento`, `adulto-cairo-bishop`, `adulto-cefaleia`, `adulto-colica-renal`, `adulto-crise-tireotoxica`, `adulto-criterios-vm-sgb`, `adulto-dermatoses-graves`, `adulto-dispneia-abordagem`, `adulto-dor-analgesia`, `adulto-dpoc-exacerbacao`, `adulto-duke-modificado`, `adulto-egos`, `adulto-emergencia-hipertensiva`, `adulto-encefalopatia-hepatites-graves`, `adulto-escala-numerica-dor`, `adulto-escore-ich`, `adulto-escore-mixedema`, `adulto-estado-de-mal-epileptico`, `adulto-estado-mixedematoso`, `adulto-falciforme`, `adulto-fibrilacao-atrial`, `adulto-fibrinoliticos`, `adulto-fisher-hsa`, `adulto-gasometria`, `adulto-gbs-incapacidade`, `adulto-guillain-barre`, `adulto-hemorragia-digestiva`, `adulto-heparina-nao-fracionada`, `adulto-hepatite-b-pos-exposicao`, `adulto-hestia`, `adulto-hints-plus`, `adulto-hipercalcemia`, `adulto-hipernatremia`, `adulto-hipoglicemia`, `adulto-hiponatremia`, `adulto-hipotermia`, `adulto-hsa`, `adulto-hunt-hess`, `adulto-ic-aguda`, `adulto-infusoes`, `adulto-insuficiencia-adrenal`, `adulto-intermacao`, `adulto-intoxicacoes-antidotos`, `adulto-isr`, `adulto-itu`, `adulto-lesao-renal-aguda`, `adulto-lise-tumoral`, `adulto-maddrey`, `adulto-marca-passo-provisorio`, `adulto-mascc`, `adulto-mcmahon-rabdomiolise`, `adulto-meningite`, `adulto-mgap`, `adulto-neutropenia-febril`, `adulto-nexus`, `adulto-nihss`, `adulto-oakland`, `adulto-ottawa-hsa`, `adulto-oxigenacao-irpa`, `adulto-pac-antibiotico`, `adulto-painad`, `adulto-pcr`, `adulto-pep-hiv`, `adulto-perc`, `adulto-pesi`, `adulto-pos-pcr`, `adulto-profilaxia-tev`, `adulto-profilaxia-ulcera-estresse`, `adulto-qtc`, `adulto-queimadura`, `adulto-rabdomiolise`, `adulto-raiva-pos-exposicao`, `adulto-rankin-modificada`, `adulto-regiscar`, `adulto-regra-canadense-coluna`, `adulto-reposicao-calcio`, `adulto-reposicao-fosforo`, `adulto-reposicao-magnesio`, `adulto-reposicao-potassio`, `adulto-ressuscitacao-volemica`, `adulto-reversao-anticoagulacao`, `adulto-sca-inicial`, `adulto-scorten-uti`, `adulto-sedacao-procedimento`, `adulto-sincope-san-francisco`, `adulto-sindrome-aortica`, `adulto-sindrome-toracica-aguda`, `adulto-sintomas-paliativos`, `adulto-smart-cop`, `adulto-szpilman`, `adulto-taquiarritmias`, `adulto-tetano-profilaxia`, `adulto-timi-nstemi`, `adulto-transfusao-hemocomponentes`, `adulto-trauma-inicial`, `adulto-triage-rts`, `adulto-trombolise-avc`, `adulto-vm-ajuste-inicial`, `adulto-vm-cinco-passos`, `adulto-vm-desmame`, `adulto-vm-mecanica`, `adulto-vm-obstruido-grave`, `adulto-vm-sdra`, `adulto-vni-cinco-passos`, `adulto-wfns`, `dengue-classificacao`, `hiperpotassemia`

### Condutas e calculadoras da pediatria

`pediatria` · dentro (SaMD provável) · revisam: medico + farmaceutico · 56 fichas

Calcula dose, volume ou escore pelo peso e pela idade da criança; só com fonte pediátrica.

`ped-acidobase`, `ped-anafilaxia-icr`, `ped-artrite-osteomielite`, `ped-asma-icr`, `ped-bolus`, `ped-bronquiolite`, `ped-cad-ehh`, `ped-choque-icr`, `ped-choque-toxico-partes-moles`, `ped-coma-hic`, `ped-crise-epileptica-icr`, `ped-crise-hipertensiva`, `ped-dengue`, `ped-diarreia-desidratacao`, `ped-dispositivos-fita`, `ped-doses-fita`, `ped-eletrolitos`, `ped-emergencias-oncologicas`, `ped-escorpiao-aranhas`, `ped-falciforme`, `ped-febre-imunodeprimido`, `ped-febre-sem-sinais`, `ped-fita-broselow`, `ped-fluidoterapia-manutencao`, `ped-glasgow-icr`, `ped-glomerulopatias-shu`, `ped-hda-hepatica`, `ped-hemostasia-trombose`, `ped-hemoterapia`, `ped-hipoglicemia`, `ped-ictericia-neonatal`, `ped-infeccao-urinaria`, `ped-infusoes`, `ped-injuria-renal`, `ped-insuficiencia-adrenal`, `ped-insuficiencia-cardiaca`, `ped-intoxicacoes`, `ped-kawasaki`, `ped-meningite`, `ped-pecarn-abdome`, `ped-pecarn-coluna-cervical`, `ped-pecarn-maior2-icr`, `ped-pecarn-menor2-icr`, `ped-pneumonia`, `ped-pops-icr`, `ped-queimadura`, `ped-rcp-icr`, `ped-reanimacao-neonatal`, `ped-sedacao-procedimento`, `ped-sodio`, `ped-tce-icr`, `ped-ten-4-facesp`, `ped-tetano-raiva`, `ped-tfg-schwartz`, `ped-via-aerea`, `ped-vias-aereas-superiores`

### Escores que alimentam alertas no prontuário

`alertas` · dentro (SaMD provável) · revisam: medico · 4 fichas

O sistema calcula sozinho, a partir dos sinais vitais registrados, e mostra o alerta na tela do paciente.

`news2`, `ped-pews-icr`, `ped-phoenix`, `sepse-adulto`

### Apoio à classificação de risco

`classificacao-risco` · zona cinzenta · revisam: medico + enfermeiro · 5 fichas

Sugere fluxograma, dor e idade gestacional; a cor final é sempre da enfermagem (decisão R2 com o consultor).

`triagem-anexos-sinais-vitais`, `triagem-dor-flacc`, `triagem-dor-nips`, `triagem-dor-numerica`, `triagem-gestacao-naegele`

### Escalas e diagnósticos de enfermagem

`enfermagem-risco` · zona cinzenta · revisam: medico + enfermeiro · 3 fichas

Braden, Morse e SAE: risco e diagnóstico de enfermagem a partir do registro do paciente.

`avaliacao-braden`, `avaliacao-morse`, `enfermagem-sae`

### Apoio clínico, crescimento, paliativo e atalhos

`zona-cinzenta-apoio` · zona cinzenta · revisam: medico · 6 fichas

Curva da OMS, rastreio paliativo, sinais vitais por idade, tabelas de acesso e o atalho de ferramentas pelo CID: podem orientar conduta, mas não calculam dose.

`acesso-venoso`, `adulto-acessos-calibres`, `curva-crescimento-oms`, `mapa-cid-ferramentas`, `paliativo-pergunta-surpresa`, `ped-sinais-vitais-icr`

### Notas de referência do HCFMUSP

`notas-referencia` · zona cinzenta · revisam: medico · 90 fichas

Texto de referência resumido do livro, igual para todo paciente; vira SaMD se passar a mudar conforme o paciente.

`nota-hcfmusp-cap10-sedacao`, `nota-hcfmusp-cap100-afogamento`, `nota-hcfmusp-cap102-hipotermia`, `nota-hcfmusp-cap104-paliativos-sintomas`, `nota-hcfmusp-cap105-acessos`, `nota-hcfmusp-cap107-marca-passo`, `nota-hcfmusp-cap108-toracocentese`, `nota-hcfmusp-cap11-anafilaxia`, `nota-hcfmusp-cap12-dor-toracica`, `nota-hcfmusp-cap13-14-sca`, `nota-hcfmusp-cap15-bradiarritmias`, `nota-hcfmusp-cap16-sincope`, `nota-hcfmusp-cap17-fa`, `nota-hcfmusp-cap18-taquiarritmias`, `nota-hcfmusp-cap19-emergencia-hipertensiva`, `nota-hcfmusp-cap2-pcr`, `nota-hcfmusp-cap20-sindrome-aortica`, `nota-hcfmusp-cap21-ic-aguda`, `nota-hcfmusp-cap22-pericardite-miocardite`, `nota-hcfmusp-cap23-endocardite`, `nota-hcfmusp-cap24-oclusao-arterial`, `nota-hcfmusp-cap25-tvp`, `nota-hcfmusp-cap27-irpa`, `nota-hcfmusp-cap29-hemorragia-alveolar`, `nota-hcfmusp-cap3-via-aerea`, `nota-hcfmusp-cap30-asma`, `nota-hcfmusp-cap31-dpoc`, `nota-hcfmusp-cap32-tep`, `nota-hcfmusp-cap33-pac`, `nota-hcfmusp-cap34-pneumotorax`, `nota-hcfmusp-cap35-aspiracao`, `nota-hcfmusp-cap36-derrame-pleural`, `nota-hcfmusp-cap37-vm`, `nota-hcfmusp-cap38-avc`, `nota-hcfmusp-cap39-hic`, `nota-hcfmusp-cap4-7-sepse`, `nota-hcfmusp-cap40-hsa`, `nota-hcfmusp-cap41-cefaleia`, `nota-hcfmusp-cap42-vertigem`, `nota-hcfmusp-cap43-neuroinfeccao`, `nota-hcfmusp-cap44-paralisias-flacidas`, `nota-hcfmusp-cap45-primeira-crise`, `nota-hcfmusp-cap47-trauma`, `nota-hcfmusp-cap48-pre-hospitalar`, `nota-hcfmusp-cap49-dor-abdominal`, `nota-hcfmusp-cap5-rebaixamento`, `nota-hcfmusp-cap50-hda`, `nota-hcfmusp-cap51-hdb`, `nota-hcfmusp-cap53-nauseas-vomitos`, `nota-hcfmusp-cap54-diverticulite`, `nota-hcfmusp-cap55-ascite`, `nota-hcfmusp-cap56-ictericia-colangite`, `nota-hcfmusp-cap57-58-pbe-shr`, `nota-hcfmusp-cap59-encefalopatia`, `nota-hcfmusp-cap6-pos-pcr`, `nota-hcfmusp-cap60-hepatites-graves`, `nota-hcfmusp-cap61-lra`, `nota-hcfmusp-cap62-colica-nefretica`, `nota-hcfmusp-cap63-rabdomiolise`, `nota-hcfmusp-cap64-cad-ehh`, `nota-hcfmusp-cap65-hipoglicemia`, `nota-hcfmusp-cap66-sodio`, `nota-hcfmusp-cap67-hiperpotassemia`, `nota-hcfmusp-cap68-calcio`, `nota-hcfmusp-cap70-tireotoxica`, `nota-hcfmusp-cap71-mixedema`, `nota-hcfmusp-cap72-adrenal`, `nota-hcfmusp-cap74-monoartrite`, `nota-hcfmusp-cap75-reumatologicas`, `nota-hcfmusp-cap76-agitacao`, `nota-hcfmusp-cap78-abstinencia`, `nota-hcfmusp-cap79-hemostasia`, `nota-hcfmusp-cap8-delirium`, `nota-hcfmusp-cap80-falciforme`, `nota-hcfmusp-cap81-neutropenia`, `nota-hcfmusp-cap82-transfusao`, `nota-hcfmusp-cap83-plaquetopenia`, `nota-hcfmusp-cap84-lise-tumoral`, `nota-hcfmusp-cap85-oftalmologia`, `nota-hcfmusp-cap86-otorrino`, `nota-hcfmusp-cap87-covid`, `nota-hcfmusp-cap88-hiv`, `nota-hcfmusp-cap89-itu`, `nota-hcfmusp-cap9-dor`, `nota-hcfmusp-cap90-influenza`, `nota-hcfmusp-cap91-dengue`, `nota-hcfmusp-cap92-chikungunya`, `nota-hcfmusp-cap95-febre-amarela`, `nota-hcfmusp-cap96-dermatoses`, `nota-hcfmusp-cap97-99-intoxicacoes`

### Carga de trabalho da enfermagem

`carga-enfermagem` · fora · revisam: medico + enfermeiro · 2 fichas

Fugulin e Dini classificam a carga de cuidado para dimensionar a equipe, não orientam o tratamento.

`dini-pediatrico`, `fugulin-12-areas`
