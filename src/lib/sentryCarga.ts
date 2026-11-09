// Item 21 do kit de desempenho: só o que o app usa do Sentry. O sentry.ts
// importa este módulo de forma dinâmica, depois da primeira pintura; com os
// nomes explícitos, o build leva só essas funções (um import dinâmico de
// '@sentry/react' inteiro levaria a biblioteca toda, cinco vezes maior).
export { captureMessage, init, withScope } from '@sentry/react'
