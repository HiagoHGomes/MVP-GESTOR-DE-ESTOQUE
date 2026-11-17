const fs = require('fs/promises')
const path = require('path')
const { randomUUID } = require('crypto')
const { app } = require('electron')

const fileName = 'estoque-local.json'
let queue = Promise.resolve()

function serialize(operation) {
  const result = queue.then(operation)
  queue = result.then(() => undefined, () => undefined)
  return result
}

function getFilePath() {
  return path.join(app.getPath('userData'), fileName)
}

async function readStore() {
  try {
    const contents = await fs.readFile(getFilePath(), 'utf8')
    const store = JSON.parse(contents)
    if (!Array.isArray(store.produtos) || !Array.isArray(store.movimentacoes)) {
      throw new Error('O arquivo local de dados está em um formato inválido.')
    }
    return store
  } catch (error) {
    if (error.code === 'ENOENT') return { produtos: [], movimentacoes: [] }
    if (error instanceof SyntaxError) {
      throw new Error('O arquivo local de dados está corrompido e não pôde ser lido.')
    }
    throw error
  }
}

async function writeStore(store) {
  const filePath = getFilePath()
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(temporaryPath, JSON.stringify(store, null, 2), 'utf8')
  await fs.rename(temporaryPath, filePath)
}

function read() {
  return serialize(readStore)
}

function update(mutator) {
  return serialize(async () => {
    const store = await readStore()
    const result = mutator(store)
    await writeStore(store)
    return result
  })
}

module.exports = { read, update }
