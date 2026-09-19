/** Set at build time via VITE_APP_VERSION (Makefile / CI); `dev` otherwise. */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION || 'dev'

/** GitHub releases page for the manual "check for a new version" link; empty = link hidden. */
export const RELEASES_URL: string = import.meta.env.VITE_RELEASES_URL || ''
