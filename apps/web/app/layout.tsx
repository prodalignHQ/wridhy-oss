import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"
import "./globals.css"
import { StorageModeProvider } from "@/lib/store/storage-mode"
import { TooltipProvider } from "@/components/ui/tooltip"
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
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <StorageModeProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </StorageModeProvider>
        <Toaster
          theme="dark"
          richColors
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast:
                "bg-zinc-900 border border-zinc-800 text-zinc-50",
            },
          }}
        />
      </body>
    </html>
  )
}
