import { ipcMain, shell } from 'electron'
import { IpcChannels } from '@shared/ipcContracts'
import type { AuthOpenExternalRequest, AuthOpenExternalResponse } from '@shared/ipcContracts'

/** Only allow opening URLs whose origin matches the configured Supabase project,
 *  so this channel can't be used as an arbitrary-URL-open primitive. */
function isAllowedOrigin(url: string): boolean {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  if (!supabaseUrl) return false
  try {
    return new URL(url).origin === new URL(supabaseUrl).origin
  } catch {
    return false
  }
}

export function registerAuthIpc(): void {
  ipcMain.handle(
    IpcChannels.authOpenExternal,
    async (_event, req: AuthOpenExternalRequest): Promise<AuthOpenExternalResponse> => {
      if (!isAllowedOrigin(req.url)) {
        return { ok: false, error: 'URL origin is not the configured Supabase project.' }
      }
      await shell.openExternal(req.url)
      return { ok: true }
    }
  )
}
