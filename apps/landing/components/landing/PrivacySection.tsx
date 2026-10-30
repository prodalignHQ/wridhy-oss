"use client"

import { useState } from "react"
import {
  Copy,
  Check,
  Github,
  Laptop,
  Container,
  Code2,
} from "lucide-react"
import { GITHUB_URL } from "@/lib/utils"

export default function PrivacySection() {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<"binary" | "docker" | "source">("binary")

  const installModes = {
    binary: {
      title: "1. Download & Run",
      description: "Single standalone executable with embedded SQLite. Zero setup, zero dependencies.",
      command: `# Download the single executable for macOS, Linux, or Windows\n./wridhy\n# Opens automatically at http://localhost:3000`,
    },
    docker: {
      title: "2. Docker Compose",
      description: "Run containerized with PostgreSQL or SQLite on your home server or homelab.",
      command: `git clone https://github.com/prodalignHQ/nuffmoney.git\ncd nuffmoney\ndocker compose up -d\n# Running at http://localhost:3000`,
    },
    source: {
      title: "3. Clone the Source",
      description: "Full TypeScript source code with pnpm, Next.js, and Hono. Fully inspectable.",
      command: `git clone https://github.com/prodalignHQ/nuffmoney.git\ncd nuffmoney\npnpm install\npnpm dev`,
    },
  }

  const currentCommand = installModes[activeTab].command

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCommand)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const pillars = [
    {
      title: "100% Self-Hosted",
      desc: "Every byte of your data lives on your local hard drive or private server. Nothing ever pings our servers.",
    },
    {
      title: "Works Completely Offline",
      desc: "You can disconnect your Wi-Fi, import PDF bank statements, and run Wridhy entirely in airplane mode.",
    },
    {
      title: "No Bank Logins",
      desc: "We never ask for your net banking credentials, OTPs, or third-party screen-scraping permissions.",
    },
    {
      title: "Zero Trackers or Telemetry",
      desc: "No Google Analytics, no Facebook Pixels, no Mixpanel, and no analytics SDKs bundled into the binaries.",
    },
    {
      title: "No Subscriptions Ever",
      desc: "Free and open source. No premium tiers, locked features, paywalls, or artificial monthly statement limits.",
    },
    {
      title: "Fully Inspectable Code",
      desc: "Every line of code is open source on GitHub. Audit our bank statement parsers and database queries yourself.",
    },
  ]

  return (
    <section id="privacy" className="scroll-mt-16 border-t border-border/70 bg-surface/30 py-20 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto max-w-3xl text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-primary/80 dark:text-sky-300">
            Privacy &amp; Architecture
          </span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Your financial data. Your machine. Your rules.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
            Your bank statements contain some of your most personal information. They deserve better than being uploaded to yet another company&apos;s cloud.
          </p>
        </div>

        {/* 6 Privacy Pillars */}
        <div className="mt-14 sm:mt-18 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((pillar) => (
            <div
              key={pillar.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-2xs transition-all hover:border-foreground/20"
            >
              <h3 className="text-base font-bold text-foreground">
                {pillar.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {pillar.desc}
              </p>
            </div>
          ))}
        </div>

        {/* 3 Installation Modes & Terminal Preview */}
        <div className="mt-16 sm:mt-20 rounded-2xl border border-border bg-card p-6 sm:p-10 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/70">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary dark:text-sky-300">
                Installation Choices
              </span>
              <h3 className="text-xl font-bold text-foreground mt-0.5">
                Three ways to run Wridhy
              </h3>
            </div>

            {/* Install Tabs */}
            <div className="inline-flex rounded-xl border border-border bg-surface p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab("binary")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                  activeTab === "binary"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Laptop size={13} />
                <span>Binary</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("docker")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                  activeTab === "docker"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Container size={13} />
                <span>Docker</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("source")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all ${
                  activeTab === "source"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Code2 size={13} />
                <span>Source</span>
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-12 md:items-center">
            {/* Left description */}
            <div className="md:col-span-5">
              <h4 className="text-lg font-bold text-foreground">
                {installModes[activeTab].title}
              </h4>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {installModes[activeTab].description}
              </p>

              <div className="mt-6">
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-xs transition-all hover:bg-primary/95 hover:-translate-y-0.5"
                >
                  <Github size={14} />
                  <span>View source on GitHub</span>
                </a>
              </div>
            </div>

            {/* Right Terminal Block */}
            <div className="md:col-span-7">
              <div className="rounded-xl border border-zinc-700/80 bg-zinc-950 text-zinc-100 p-4 font-mono text-xs shadow-md">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-[11px] text-zinc-400">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500/80" />
                    <span className="ml-2 text-zinc-400">bash / zsh</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1 rounded bg-zinc-800 px-2 py-0.5 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check size={12} className="text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="mt-3 overflow-x-auto text-[12px] leading-relaxed text-zinc-200">
                  <code>{currentCommand}</code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
