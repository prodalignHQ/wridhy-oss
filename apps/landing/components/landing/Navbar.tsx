"use client"

import Link from "next/link"
import { useState, useEffect } from "react"
import { Github, Menu, X, ArrowUpRight } from "lucide-react"
import { ThemeToggle } from "@/components/theme/ThemeToggle"
import { GITHUB_URL } from "@/lib/utils"

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Philosophy", href: "#philosophy" },
  { label: "How it works", href: "#how" },
  { label: "Households", href: "#households" },
  { label: "Privacy", href: "#privacy" },
]

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 16)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false)
      }
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-200 ${
        scrolled
          ? "border-b border-border/80 bg-background/92 backdrop-blur-md shadow-xs"
          : "border-b border-border/50 bg-background/80 backdrop-blur-sm"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 transition-opacity hover:opacity-90"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-base font-semibold text-primary-foreground shadow-xs transition-transform group-hover:scale-105">
            ₹
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-bold tracking-tight text-foreground">
              Wridhy
            </span>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              beta
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav
          aria-label="Main Navigation"
          className="hidden items-center gap-1 md:flex"
        >
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-surface/60"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="hidden items-center gap-2.5 md:flex">
          <ThemeToggle isCollapsed />
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-1.5 text-xs font-semibold text-foreground shadow-xs transition-all hover:bg-surface hover:border-foreground/20 hover:-translate-y-0.5"
          >
            <Github size={14} className="opacity-80" />
            <span>GitHub</span>
            <ArrowUpRight size={12} className="text-muted-foreground" />
          </a>
        </div>

        {/* Mobile Hamburger & Theme Toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle isCollapsed />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:bg-surface"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="border-b border-border bg-background px-4 pt-2 pb-6 md:hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex flex-col gap-1 divide-y divide-border/40">
            <div className="flex flex-col gap-1 pb-3">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface"
                >
                  {link.label}
                </a>
              ))}
            </div>
            <div className="pt-3">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-xs transition-transform active:scale-98"
              >
                <Github size={16} />
                <span>Explore on GitHub</span>
                <ArrowUpRight size={14} className="opacity-80" />
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
