const { contextBridge, ipcRenderer } = require('electron')

function invoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload).then(result => {
    if (!result.ok) throw new Error(result.error)
    return result.data
  })
}

contextBridge.exposeInMainWorld('api', Object.freeze({
  auth: Object.freeze({
    login: (email, password) => invoke('auth:login', { email, password }),
    logout: () => invoke('auth:logout'),
    session: () => invoke('auth:session')
  }),
  dashboard: Object.freeze({
    get: () => invoke('dashboard:get')
  }),
  produtos: Object.freeze({
    list: filters => invoke('produtos:list', filters),
    listAll: filters => invoke('produtos:list-all', filters),
    create: produto => invoke('produtos:create', produto),
    update: (id, produto) => invoke('produtos:update', { id, produto }),
    deactivate: id => invoke('produtos:deactivate', { id })
  }),
  movimentacoes: Object.freeze({
    list: filters => invoke('movimentacoes:list', filters),
    create: movimentacao => invoke('movimentacoes:create', movimentacao)
  })
}))
