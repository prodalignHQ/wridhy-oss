import { defineEmailProvider } from '@momoney/db/email'

export default defineEmailProvider({
  async send(message) {
    console.info('Replace this example with your own email delivery logic.', message)
  },
})
