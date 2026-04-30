/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ROOT_URL?: string
  readonly ROOT_URL?: string
  /** 開発時: `vite` が `/api` をこの URL にプロキシする（CORS 回避） */
  readonly VITE_API_PROXY_TARGET?: string
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, any>
  export default component
}
