### 4. Instanciando um servidor com fastify

- Comando de instalação do fastify

```bash
npm i fastify
```

Além da instalação do fastify, criaremos um servidor, a partir de um arquivo `server.ts` na raiz do projeto (`./src/server.ts`).

```ts
import fastify from 'fastify'

const app = fastify();

app.listen({
  port: 3333,
}).then(() => {
  console.log('HTTP Server is running!)
})
```

### 5. Instalando docker

Maneira de criar ambientes isolados reaproveitando o kernel do sistema entre eles, ou seja, o docker a base do sistema operacional é compartilhada entre todos os ambientes, diferente de uma VM que necessita carregar todo o kernel do sistema.

Como alternativas ao docker para esse projeto poderá ser utilizado o neon.tech para um banco de dados com postgres. Já para o redis, poderia ser utilizado o Upstash

#### Criando um arquivo docker-compose

! Prompt de comando para criação do arquivo docker-compose com IA

```bash
Create a docker compose file with two services, one postgres using bitnami postgres image and one redis with bitnami redis, expose ports saved volumes. 

Set redis password as docker
```

#### Subindo o serviço docker

- Para subir o serviço do docker, execute o comando abaixo diretamente no bash.

```bash
docker compose up -d
docker ps 
```

### Criação dos arquivos postgres e redis - Lib

Devemos realizar a criação do diretório `./src/lib/postgres.ts` e `./src/lib/redis.ts`, esses arquivos servirão para separar a conexão referente a cada banco de dados.

- Arquivo postgres.ts:

```ts
import postgres from 'postgres'

export const sql = postgres(
  "postgresql://username:password@localdeexecucao:porta/databasename"
);
```

- Arquivo redis.ts:

```ts
import  { createClient } from 'redis'

export const redis = createClient({
  url: 'redis://:password@localdeexecucao:porta'
});

redis.connect();
```

## Instalação do Postgres e redis

Execute o comando de instalação do postgres e redis com o seguinte comando:

```bash
npm i postgres redis
```

### Porque usar 2 bancos?

- Postgres: O postgres é um banco de dados relacional, assim como SQL Server, MySQL etc.

- Redis: Começou a ser utilizado majoritariamente devido sua arquitetura de cache de dados (Não é um banco de dados relacional).

  - Sistema de enfileiramento;
  - Sistema de ranking

> Cache de dados: É possível salvar o resultado de uma operação para facilitar a busca e fornecimento de dados futuramente para outros usuários.

## Criando o arquivo setup.ts

Neste arquivo iremos aplicar toda a configuração da estrutura do banco de dados. Ao utilizar o postgres, a sintaxe do código é basicamente sintaxe SQL, conforme code abaixo:

```ts
import { sql } from './lib/postgres'

async function setup() {
  await sql/*SQL*/`CREATE TABLE IF NOT EXISTS short_links (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE,
    original_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`

  // Encerra a conexão
  await sql.end()

  console.log('Setup realizado com sucesso.')
} 

setup()
```

## Rotas HTTP

### Métodos HTTP

- GET
- PUT
- DELETE
- POST
- HEAD
- OPTIONS
- PATCH

### Importando o Zod

O Zod trata-se de uma biblioteca utilizada para validação de informações recebidas através de uma requisição.

Para realizar a instalação do zod, basta executar o seguinte comando no bash

```bash
npm i zod
```

### Primeira utilização do Zod - Criação de um Link

```ts
app.get('/links', (request) => {
  const createLinkSchema = z.object({
    code: z.string().min(3),
    url: z.string().url(),
  })
  const { code, url } = createLinkSchema.parse(request.body);
})
```

> SQL Injection: Postgres.js - Template Literals

### Buscando todos os links

```ts
app.get('/links', async() => {
  const result = await sql/*SQL*/`
    SELECT *
    FROM short_links
    ORDER BY created_at DESC
  `
  return result
})
```

### Redirecionando para a URL desejada

A rota abaixo implica no redirecionamento permanente do usuário para o link solicitado (301) caso fosse um redirecionamento temporário, (302).

```ts
app.get('/:code', async (request, reply) => {
  const getLinkSchema = z.object({
    code: z.string().min(3)
  })

  const { code } = getLinkSchema.parse(request.params)

  const result = await sql/*sql*/`
    SELECT id, original_url
    FROM short_links
    WHERE short_links.code = ${code}
  `

  if(result.length === 0) {
    return reply.status(400).send({ message: 'Link not found!' })
  }

  const link = result[0];

  return reply.redirect(301, link.original_url)
})
```

Caso o link não seja encontrado, não exista um link, basta seguir para a seguinte validação:

```ts
  if(result.length === 0) {
    return reply.status(400).send({ message: 'Link not found!' })
  }
```

## Iniciando com o Redis - Analytics

Contabilizando os acessos a partir do redis:

```ts
await redis.zIncrBy('metrics', 1, link.id)
```

Rota para puxar os links mais acessados:

```ts
app.get('/api/metrics', async () => {
  const result = await redis.zRangeByScoreWithScores('metrics', 0, 50)

  return result
})
```

Refinando a rota de métricas para considerar outros termos, por exemplo:

```ts
app.get('/api/metrics', async () => {
  const result = await redis.zRangeByScoreWithScores('metrics', 0, 50)

  const metrics = result
    .sort((a, b) => b.score - a.score) // Organizando por mais acessados primeiro
    .map(item => { // Percorrendo o array e retornando novos valores, onde renomeio o tipo de retorno desejado
      return {
        shortLinkId: Number(item.value),
        clicks: item.score,
      }
    })

  return metrics;
})
```

> Poderia ser usado o postgres para realizar esse ranking de links, porém visando otimizações, o Redis se sai melhor, por ser feito especificamente pra isso.
