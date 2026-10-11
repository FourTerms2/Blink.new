import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: import.meta.env.VITE_BLINK_PROJECT_ID || 'minecraft-pride-capes-693uf7oo',
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY || 'blnk_pk_fbllhwwXEdJrEHLIZR76XGbUOgJM4sH9',
  authRequired: false,
  auth: { mode: 'managed' },
})
