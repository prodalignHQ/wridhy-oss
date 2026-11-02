import Link from "next/link"
import { Github, ArrowUpRight } from "lucide-react"
import { GITHUB_URL } from "@/lib/utils"

export default function Footer() {
  const currentYear = new Date().getFullYear()

  const links = [
    { label: "Features", href: "#features" },
    { label: "Philosophy", href: "#philosophy" },
    { label: "How it works", href: "#how" },
    { label: "Households", href: "#households" },
    { label: "Privacy", href: "#privacy" },
  ]

  return (
    <footer className="border-t border-border/80 bg-surface/50 text-foreground">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          {/* Brand info */}
          <div className="max-w-sm">
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground shadow-xs">
                ₹
              </span>
              <span className="text-lg font-bold tracking-tight text-foreground">
                Wridhy
              </span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                beta
              </span>
            </Link>

            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              Self-hosted personal and household finance. Made for people who have better things to do than check their bank balance every hour.
            </p>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground font-medium text-foreground"
            >
              <Github size={14} />
              <span>GitHub</span>
              <ArrowUpRight size={12} className="text-muted-foreground" />
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {currentYear} Wridhy. Released under the MIT License.
          </p>
          <p className="text-center sm:text-right">
            Your finances deserve attention. Not obsession.
          </p>
        </div>
      </div>
    </footer>
  )
}
