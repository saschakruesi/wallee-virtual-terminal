/** Set at build time via VITE_APP_VERSION (Makefile / CI); `dev` otherwise. */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION || 'dev'
