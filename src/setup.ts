import { sql } from './lib/postgres'

async function setup() {
  await sql/*SQL*/`CREATE TABLE IF NOT EXISTS short_links (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE,
    original_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
  `

  // Encerra a conexão
  await sql.end()

  console.log('Setup realizado com sucesso.')
} 

setup();