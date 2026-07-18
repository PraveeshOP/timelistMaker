import { app, BrowserWindow, ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipcContracts'
import { registerAuthIpc } from './ipc/auth'
import { registerDialogIpc } from './ipc/dialog'
import { registerExportIpc } from './ipc/export'
import { registerProtocolClient, setupDeepLinkHandling } from './protocol'
import { createMainWindow } from './window'

registerProtocolClient()

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
} else {
  setupDeepLinkHandling()

  app.whenReady().then(() => {
    registerAuthIpc()
    registerDialogIpc()
    registerExportIpc()
    ipcMain.handle(IpcChannels.appGetVersion, () => ({ version: app.getVersion() }))

    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
