export const apiClient = {
  fetch: async <T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    let baseURL = process.env.NEXT_PUBLIC_API_URL
    if (baseURL === undefined) {
      baseURL = typeof window !== 'undefined' ? '' : 'http://localhost:3001'
    }
    const url = `${baseURL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`

    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      // Important: include credentials so Better Auth session cookies are sent
      credentials: 'include',
    })

    const result = await response.json()

    if (!response.ok || !result.success) {
      const error = new Error(result?.error?.message || 'API Request failed') as Error & {
        code?: string
        status?: number
      }

      error.code = result?.error?.code
      error.status = response.status

      if (
        typeof window !== 'undefined' &&
        response.status === 403 &&
        error.code === 'EMAIL_NOT_VERIFIED' &&
        window.location.pathname !== '/dashboard'
      ) {
        window.location.replace('/dashboard?verification=required')
      }

      throw error
    }

    return result.data as T
  },
}
