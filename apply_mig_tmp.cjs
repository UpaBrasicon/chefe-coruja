const { Client } = require('pg')
const fs = require('fs')

async function main() {
  const file = process.argv[2]
  const SQL = fs.readFileSync(file, 'utf8')
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  })
  await client.connect()
  try {
    await client.query(SQL)
    console.log('MIGRATION OK')
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('ERRO:', e.message)
  process.exit(1)
})
