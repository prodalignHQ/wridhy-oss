import { pathToFileURL } from 'node:url'
import path from 'node:path'

export type EmailMessage = {
  to: string
  subject: string
  text: string
  html?: string
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>
}

export function defineEmailProvider(provider: EmailProvider) {
  return provider
}

const consoleEmailProvider = defineEmailProvider({
  async send(message) {
    console.info(
      [
        '[email:console]',
        `to: ${message.to}`,
        `subject: ${message.subject}`,
        'text:',
        message.text,
        message.html ? `html:\n${message.html}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    )
  },
})

const resendEmailProvider = defineEmailProvider({
  async send(message) {
    const apiKey = process.env['RESEND_API_KEY']
    const from = process.env['EMAIL_FROM']

    if (!apiKey) {
      throw new Error('RESEND_API_KEY is required when EMAIL_PROVIDER=resend')
    }

    if (!from) {
      throw new Error('EMAIL_FROM is required when EMAIL_PROVIDER=resend')
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Resend email failed: ${response.status} ${body}`)
    }
  },
})

let providerPromise: Promise<EmailProvider> | null = null

async function loadCustomEmailProvider() {
  const providerPath = process.env['EMAIL_CUSTOM_PROVIDER_PATH']

  if (!providerPath) {
    throw new Error('EMAIL_CUSTOM_PROVIDER_PATH is required when EMAIL_PROVIDER=custom')
  }

  const resolvedPath = path.isAbsolute(providerPath)
    ? providerPath
    : path.resolve(process.cwd(), providerPath)

  const module = (await import(pathToFileURL(resolvedPath).href)) as {
    default?: EmailProvider
    emailProvider?: EmailProvider
    createEmailProvider?: () => EmailProvider | Promise<EmailProvider>
  }

  if (module.default) {
    return module.default
  }

  if (module.emailProvider) {
    return module.emailProvider
  }

  if (module.createEmailProvider) {
    return module.createEmailProvider()
  }

  throw new Error(
    'Custom email provider module must export `default`, `emailProvider`, or `createEmailProvider`'
  )
}

export async function getEmailProvider() {
  if (!providerPromise) {
    providerPromise = (async () => {
      const provider = process.env['EMAIL_PROVIDER']?.trim().toLowerCase() ?? 'console'

      if (provider === 'console') {
        return consoleEmailProvider
      }

      if (provider === 'resend') {
        return resendEmailProvider
      }

      if (provider === 'custom') {
        return loadCustomEmailProvider()
      }

      throw new Error(`Unsupported EMAIL_PROVIDER "${provider}"`)
    })()
  }

  return providerPromise
}

export async function sendEmail(message: EmailMessage) {
  const provider = await getEmailProvider()
  await provider.send(message)
}
