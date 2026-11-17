const path = require('path')
const { app, BrowserWindow, ipcMain } = require('electron')
const { pathToFileURL } = require('url')
const auth = require('./services/auth')
const produtos = require('./services/produtos')
const movimentacoes = require('./services/movimentacoes')
const rendererFile = path.join(__dirname, 'renderer', 'index.html')
const rendererUrl = pathToFileURL(rendererFile).href

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 360,
    minHeight: 560,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== rendererUrl) event.preventDefault()
  })
  win.loadFile(rendererFile)
}

function registerHandler(channel, handler) {
  ipcMain.handle(channel, async (event, payload) => {
    try {
      if (event.senderFrame?.url.split('#')[0] !== rendererUrl) {
        throw new Error('Origem não autorizada para acessar o aplicativo.')
      }
      return { ok: true, data: await handler(payload) }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ocorreu um erro inesperado.'
      console.error(`[IPC ${channel}] ${message}`)
      return { ok: false, error: message }
    }
  })
}

function requireText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`O campo ${field} é obrigatório.`)
  }
  return value.trim()
}

function requireRecord(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Dados inválidos para ${field}.`)
  }
  return value
}

function registerIpcHandlers() {
  registerHandler('auth:login', ({ email, password } = {}) => {
    requireText(email, 'e-mail')
    requireText(password, 'senha')
    return auth.login(email.trim(), password)
  })
  registerHandler('auth:logout', () => auth.logout())
  registerHandler('auth:session', () => auth.getSession())
  registerHandler('dashboard:get', () => movimentacoes.painel())
  registerHandler('produtos:list', filters => produtos.listar(filters || {}))
  registerHandler('produtos:list-all', filters => produtos.listarTodos(filters || {}))
  registerHandler('produtos:create', value => produtos.criar(requireRecord(value, 'produto')))
  registerHandler('produtos:update', ({ id, produto } = {}) => {
    return produtos.atualizar(requireText(id, 'produto'), requireRecord(produto, 'produto'))
  })
  registerHandler('produtos:deactivate', ({ id } = {}) => produtos.desativar(requireText(id, 'produto')))
  registerHandler('movimentacoes:list', filters => movimentacoes.listar(filters || {}))
  registerHandler('movimentacoes:create', value => {
    return movimentacoes.criar(requireRecord(value, 'movimentação'))
  })
}

registerIpcHandlers()
app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})