export const apiClient = {
  fetch: async <T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> => {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
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
      throw new Error(result?.error?.message || 'API Request failed')
    }

    return result.data as T
  },
}
