import { writeFile } from 'node:fs/promises'
import { ipcMain } from 'electron'
import { IpcChannels } from '@shared/ipcContracts'
import type { ExportWriteXlsxRequest, ExportWriteXlsxResponse } from '@shared/ipcContracts'

export function registerExportIpc(): void {
  ipcMain.handle(
    IpcChannels.exportWriteXlsx,
    async (_event, req: ExportWriteXlsxRequest): Promise<ExportWriteXlsxResponse> => {
      try {
        await writeFile(req.filePath, Buffer.from(req.buffer))
        return { ok: true }
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) }
      }
    }
  )
}
