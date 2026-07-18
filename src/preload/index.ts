import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannels } from '@shared/ipcContracts'
import type {
  AuthCallbackPayload,
  AuthOpenExternalRequest,
  AuthOpenExternalResponse,
  DialogSaveFileRequest,
  DialogSaveFileResponse,
  ExportWriteXlsxRequest,
  ExportWriteXlsxResponse,
  AppGetVersionResponse,
  PreloadApi
} from '@shared/ipcContracts'

const api: PreloadApi = {
  authOpenExternal: (req: AuthOpenExternalRequest): Promise<AuthOpenExternalResponse> =>
    ipcRenderer.invoke(IpcChannels.authOpenExternal, req),

  onAuthCallback: (cb: (payload: AuthCallbackPayload) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: AuthCallbackPayload): void =>
      cb(payload)
    ipcRenderer.on(IpcChannels.authCallback, listener)
    return () => ipcRenderer.removeListener(IpcChannels.authCallback, listener)
  },

  dialogSaveFile: (req: DialogSaveFileRequest): Promise<DialogSaveFileResponse> =>
    ipcRenderer.invoke(IpcChannels.dialogSaveFile, req),

  exportWriteXlsx: (req: ExportWriteXlsxRequest): Promise<ExportWriteXlsxResponse> =>
    ipcRenderer.invoke(IpcChannels.exportWriteXlsx, req),

  appGetVersion: (): Promise<AppGetVersionResponse> => ipcRenderer.invoke(IpcChannels.appGetVersion)
}

contextBridge.exposeInMainWorld('api', api)
