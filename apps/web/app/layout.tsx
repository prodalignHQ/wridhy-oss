import type { Metadata } from "next"
import { Poppins, Geist_Mono } from "next/font/google"
import "./globals.css"
import { StorageModeProvider } from "@/lib/store/storage-mode"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider } from "@/components/theme/ThemeProvider"
import { Toaster } from "sonner"

const poppins = Poppins({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
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
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var storage = localStorage.getItem('momoney-ui-storage');
                if (storage) {
                  var parsed = JSON.parse(storage);
                  if (parsed && parsed.state && parsed.state.isPrivacyMode) {
                    document.documentElement.setAttribute('data-privacy-mode', 'true');
                    document.documentElement.classList.add('privacy-mode');
                  }
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body
        className={`${poppins.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
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
