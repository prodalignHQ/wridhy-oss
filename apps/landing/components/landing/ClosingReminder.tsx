import { Github, ArrowRight } from "lucide-react"
import { GITHUB_URL } from "@/lib/utils"

export default function ClosingReminder() {
  return (
    <section className="relative overflow-hidden py-24 sm:py-32 lg:py-36">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border bg-card p-8 sm:p-14 lg:p-16 shadow-xs relative">
          <span className="text-xs font-bold uppercase tracking-widest text-primary/80 dark:text-sky-300">
            A Monthly Ritual
          </span>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            An hour with your money.
            <br />
            <span className="text-primary font-serif italic font-normal dark:text-sky-300">
              The rest of the month to yourself.
            </span>
          </h2>

          <div className="mx-auto mt-6 max-w-xl space-y-2 text-base sm:text-lg leading-relaxed text-muted-foreground">
            <p>
              Review the month. Understand your spending. Check your progress. Make a plan for the next one.
            </p>
            <p className="font-semibold text-foreground">
              And then close the tab. Go live your life.
            </p>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/95 hover:-translate-y-0.5 active:translate-y-0"
            >
              <Github size={17} />
              <span>Give Wridhy a try</span>
              <ArrowRight size={15} className="opacity-80" />
            </a>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Open-source · Self-hosted · MIT Licensed · Free forever
          </p>
        </div>
      </div>
    </section>
  )
}
