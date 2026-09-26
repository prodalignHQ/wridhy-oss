import Navbar from "@/components/landing/Navbar"
import Hero from "@/components/landing/Hero"
import Features from "@/components/landing/Features"
import HowItWorks from "@/components/landing/HowItWorks"
import Footer from "@/components/landing/Footer"

export const metadata = {
  title: "MoMoney — Your money, your rules",
  description:
    "Privacy-first personal finance. Import statements, auto-categorize, split with family, and grow net worth. Free & open source.",
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
      </main>
      <Footer />
    </div>
  )
}
