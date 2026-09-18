/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_VERSION?: string
  readonly VITE_API_BASE?: string
}

declare module '*.svg' {
  const src: string
  export default src
}
