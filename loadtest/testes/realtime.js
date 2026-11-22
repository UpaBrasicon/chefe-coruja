// 7. Realtime (chat) — conexões WebSocket ao Realtime do Supabase, cada uma
// assinando o mesmo canal que o front usa (channel('chat-global')).
//
// ⚠️ SCAFFOLD A VALIDAR: o payload exato do phx_join do supabase-js (config de
// postgres_changes + access_token) precisa ser capturado do front (devtools →
// WS) e colado em JOIN. Sem isso o join pode ser recusado. Marcado como TODO.
import ws from 'k6/ws'
import { check } from 'k6'
import { URL, ANON, ALVO } from '../lib/config.js'
import { usuarioDoVU } from '../lib/auth.js'
import exec from 'k6/execution'

export const options = {
  scenarios: {
    realtime: {
      executor: 'ramping-vus',
      startVUs: 50,
      stages: [
        { duration: '3m', target: 200 },
        { duration: '5m', target: 500 }, // até o limite do plano
        { duration: '2m', target: 0 },
      ],
    },
  },
  thresholds: { ws_connecting: ['p(95)<2000'], checks: ['rate>0.95'] },
}

export default function () {
  const vu = exec.vu.idInTest
  const token = usuarioDoVU('plantonista', vu).access_token
  const wsUrl = `${URL.replace('https://', 'wss://')}/realtime/v1/websocket?apikey=${ANON}&vsn=1.0.0`

  const res = ws.connect(wsUrl, {}, (socket) => {
    socket.on('open', () => {
      // TODO: alinhar este join com o que o supabase-js envia para channel('chat-global')
      socket.send(
        JSON.stringify({
          topic: 'realtime:chat-global',
          event: 'phx_join',
          payload: { config: { postgres_changes: [{ event: '*', schema: 'public', table: 'chat_mensagens' }] }, access_token: token },
          ref: '1',
        }),
      )
      // heartbeat phoenix a cada 25 s
      socket.setInterval(() => {
        socket.send(JSON.stringify({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: 'hb' }))
      }, 25000)
      socket.setTimeout(() => socket.close(), 60000)
    })
    socket.on('message', () => {})
  })
  check(res, { 'ws 101': (r) => r && r.status === 101 })
}
