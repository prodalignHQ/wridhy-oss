"use client"
import Link from "next/link"
import { useState } from "react"
import { Menu, X } from "lucide-react"
import { ThemeToggle } from "@/components/theme/ThemeToggle"

const links = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Privacy", href: "#privacy" },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-lg font-bold text-white shadow-sm">
            ₹
          </span>
          <span className="text-xl font-semibold tracking-tight">MoMoney</span>
          <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline">
            beta
          </span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle isCollapsed />
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-foreground/70 hover:bg-muted"
          >
            Log in
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5"
          >
            Open app →
          </Link>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle isCollapsed />
          <button
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
            className="rounded-lg border border-border p-2"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-border bg-background px-4 pb-5 pt-3 md:hidden">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-[15px] font-medium hover:bg-muted"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2">
              <Link
                href="/login"
                className="flex-1 rounded-lg border border-border px-4 py-2.5 text-center text-sm font-semibold"
              >
                Log in
              </Link>
              <Link
                href="/dashboard"
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white"
              >
                Open app →
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
