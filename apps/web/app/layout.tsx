import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import "./globals.css"
import { StorageModeProvider } from "@/lib/store/storage-mode"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider } from "@/components/theme/ThemeProvider"
import { Toaster } from "sonner"

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "MoMoney — Personal Finance",
  description:
    "Privacy-first personal finance. Import statements, track spending, and understand your money.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider>
          <StorageModeProvider>
            <TooltipProvider>
              {children}
            </TooltipProvider>
          </StorageModeProvider>
          <Toaster
            richColors
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: "bg-card border border-border text-card-foreground",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  )
}
