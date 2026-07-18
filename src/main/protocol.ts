import { resolve } from 'node:path'
import { app } from 'electron'
import { PROTOCOL_SCHEME, AUTH_CALLBACK_HOST } from '@shared/constants'
import type { AuthCallbackPayload } from '@shared/ipcContracts'
import { IpcChannels } from '@shared/ipcContracts'
import { focusMainWindow, getMainWindow } from './window'

/** Registers the app as the OS handler for `timelistmaker://` links, used for the
 *  Google OAuth deep-link callback (see plan §3). Must be called before app.whenReady(). */
export function registerProtocolClient(): void {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [resolve(process.argv[1])])
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME)
  }
}

function parseDeepLink(rawUrl: string): AuthCallbackPayload | null {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return null
  }

  if (parsed.protocol !== `${PROTOCOL_SCHEME}:` || parsed.hostname !== AUTH_CALLBACK_HOST) {
    return null
  }

  // Supabase returns tokens in the URL fragment: #access_token=...&refresh_token=...
  const fragment = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash
  const params = new URLSearchParams(fragment)

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (!accessToken || !refreshToken) return null

  return {
    accessToken,
    refreshToken,
    expiresIn: Number(params.get('expires_in') ?? '0'),
    tokenType: params.get('token_type') ?? 'bearer',
    providerToken: params.get('provider_token') ?? undefined
  }
}

function dispatchDeepLink(rawUrl: string): void {
  const payload = parseDeepLink(rawUrl)
  if (!payload) return

  focusMainWindow()
  const window = getMainWindow()
  if (!window) return

  const send = (): void => window.webContents.send(IpcChannels.authCallback, payload)
  if (window.webContents.isLoading()) {
    window.webContents.once('did-finish-load', send)
  } else {
    send()
  }
}

function extractUrlFromArgv(argv: string[]): string | undefined {
  return argv.find((arg) => arg.startsWith(`${PROTOCOL_SCHEME}://`))
}

/** Wires up all OS entry points that can deliver a `timelistmaker://` deep link:
 *  macOS `open-url`, Windows/Linux second-instance argv, and cold-start argv. */
export function setupDeepLinkHandling(): void {
  app.on('open-url', (event, url) => {
    event.preventDefault()
    dispatchDeepLink(url)
  })

  app.on('second-instance', (_event, argv) => {
    const url = extractUrlFromArgv(argv)
    if (url) dispatchDeepLink(url)
  })

  app.whenReady().then(() => {
    const url = extractUrlFromArgv(process.argv)
    if (url) dispatchDeepLink(url)
  })
}
