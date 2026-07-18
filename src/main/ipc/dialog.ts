import { dialog, ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipcContracts'
import type { DialogSaveFileRequest, DialogSaveFileResponse } from '@shared/ipcContracts'
import { getMainWindow } from '../window'

export function registerDialogIpc(): void {
  ipcMain.handle(
    IpcChannels.dialogSaveFile,
    async (_event, req: DialogSaveFileRequest): Promise<DialogSaveFileResponse> => {
      const window = getMainWindow()
      const options = {
        defaultPath: req.defaultFileName,
        filters: req.filters ?? [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
      }
      const result = window
        ? await dialog.showSaveDialog(window, options)
        : await dialog.showSaveDialog(options)
      return { canceled: result.canceled, filePath: result.filePath }
    }
  )
}
