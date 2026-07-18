import type { PreloadApi } from '@shared/ipcContracts'

declare global {
  interface Window {
    api: PreloadApi
  }
}

export {}
