import type { Metadata } from 'next'

import { Breadcrumbs } from '@/components/Breadcrumbs'

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  description:
    'Política de Privacidade do Chefe Coruja, em conformidade com a Lei Geral de Proteção de Dados (LGPD), incluindo o tratamento de dados de saúde como dado sensível.',
  alternates: { canonical: '/privacidade' },
}

export default function PrivacidadePage() {
  return (
    <div className="container-site">
      <Breadcrumbs items={[{ name: 'Privacidade', href: '/privacidade' }]} />
      <section className="mx-auto max-w-3xl py-8 md:py-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-slate-500">Última atualização: {/* TODO: data de revisão real */} </p>

        <div className="prose prose-slate mt-8 flex flex-col gap-6 text-sm text-slate-700">
          <section>
            <h2 className="text-lg font-bold text-slate-900">1. Quem somos</h2>
            <p>
              O Chefe Coruja é uma plataforma de gestão hospitalar com sede em Aparecida de Goiânia · GO,
              destinada a hospitais, UPAs e clínicas. Nesta política, &quot;nós&quot; refere-se ao Chefe
              Coruja; &quot;você&quot; refere-se ao usuário da plataforma e aos titulares de dados.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">2. Dados que tratamos</h2>
            <p>
              Tratamos dados cadastrais (nome, e-mail, telefone, unidade e cargo) e, no uso da plataforma,
              <strong> dados de saúde de pacientes</strong>, que a LGPD classifica como{' '}
              <strong>dados pessoais sensíveis</strong> (art. 5º, II e art. 11).
            </p>
            <p className="mt-2">
              Os dados de saúde são tratados exclusivamente para a prestação do serviço de gestão
              assistencial e administrativa da unidade de saúde contratante.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">3. Base legal</h2>
            <p>Tratamos seus dados com base nas seguintes hipóteses da LGPD:</p>
            <ul className="mt-2 list-disc pl-5">
              <li>
                <strong>Dados pessoais (art. 7º):</strong> execução de contrato (inciso V), legítimo
                interesse (inciso IX) e consentimento (inciso I), conforme o caso.
              </li>
              <li>
                <strong>Dados sensíveis de saúde (art. 11):</strong>{' '}
                <em>
                  tutela da saúde, exclusivamente em procedimentos realizados por profissionais de saúde
                  (inciso II, alínea &quot;a&quot;)
                </em>
                , que dispensa o consentimento para o ato assistencial, e demais hipóteses aplicáveis.
              </li>
            </ul>
            <p className="mt-2">
              Registramos as operações de tratamento e disponibilizamos transparência ao titular, conforme
              exige a LGPD. {/* TODO: detalhar controles internos/DPA */}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">4. Finalidade e uso</h2>
            <p>
              Utilizamos os dados para: operar a plataforma (prontuário, leitos, prescrição e escala),
              garantir segurança e trilha de auditoria, cumprir obrigações legais e regulatórias, e manter
              o relacionamento comercial com a unidade contratante.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">5. Compartilhamento</h2>
            <p>
              Não vendemos dados. Podemos compartilhar dados com: operadores essenciais à operação (ex.:
              infraestrutura em nuvem) e autoridades, quando exigido por lei. O acesso a dados de saúde é
              restrito por papel e por escala do dia, conforme as permissões de cada usuário.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">6. Retenção</h2>
            <p>
              Os dados de prontuário são retidos pelo prazo legal de <strong>20 anos</strong> a partir do
              último registro, conforme a legislação de prontuário vigente, e posteriormente descartados de
              forma segura. {/* TODO: alinhar com jurídico o prazo exato */}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">7. Segurança</h2>
            <p>
              Adotamos criptografia em trânsito e em repouso, controle de acesso por papel, trilha de
              auditoria e monitoramento. Nenhum método é 100% seguro; nos comprometemos a notificar
              incidentes conforme a legislação.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">8. Seus direitos</h2>
            <p>
              Você pode exercer os direitos previstos no art. 18 da LGPD: confirmação, acesso, correção,
              anonimização, portabilidade, eliminação e informação sobre compartilhamento. Para exercê-los,
              fale conosco pelos canais abaixo. {/* TODO: informar se há Encarregado (DPO) e contato */}
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-slate-900">9. Contato</h2>
            <p>
              Dúvidas sobre esta política: <strong>contato@chefecoruja.com.br</strong> {/* TODO: e-mail
              real */}.
            </p>
          </section>

          <p className="border-t border-slate-200 pt-6 text-xs text-slate-500">
            Esta política é um modelo e deve ser revisada pelo jurídico antes da publicação. {/* TODO:
            revisão jurídica */}
          </p>
        </div>
      </section>
    </div>
  )
}
