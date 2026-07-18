export const IpcChannels = {
  authOpenExternal: 'auth:open-external',
  authCallback: 'auth:callback',
  dialogSaveFile: 'dialog:save-file',
  exportWriteXlsx: 'export:write-xlsx',
  appGetVersion: 'app:get-version'
} as const

export interface AuthOpenExternalRequest {
  url: string
}
export interface AuthOpenExternalResponse {
  ok: boolean
  error?: string
}

export interface AuthCallbackPayload {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: string
  providerToken?: string
}

export interface DialogSaveFileRequest {
  defaultFileName: string
  filters?: Array<{ name: string; extensions: string[] }>
}
export interface DialogSaveFileResponse {
  canceled: boolean
  filePath?: string
}

export interface ExportWriteXlsxRequest {
  filePath: string
  buffer: ArrayBuffer
}
export interface ExportWriteXlsxResponse {
  ok: boolean
  error?: string
}

export interface AppGetVersionResponse {
  version: string
}

/** Typed surface exposed on `window.api` by the preload script. */
export interface PreloadApi {
  authOpenExternal: (req: AuthOpenExternalRequest) => Promise<AuthOpenExternalResponse>
  onAuthCallback: (cb: (payload: AuthCallbackPayload) => void) => () => void
  dialogSaveFile: (req: DialogSaveFileRequest) => Promise<DialogSaveFileResponse>
  exportWriteXlsx: (req: ExportWriteXlsxRequest) => Promise<ExportWriteXlsxResponse>
  appGetVersion: () => Promise<AppGetVersionResponse>
}
