import Navbar from "@/components/landing/Navbar"
import Hero from "@/components/landing/Hero"
import Features from "@/components/landing/Features"
import HowItWorks from "@/components/landing/HowItWorks"
import Footer from "@/components/landing/Footer"

export const metadata = {
  title: "MoMoney — Your money, your rules",
  description:
    "100% private personal finance. Statements parsed on your device, sealed in an encrypted vault, passkey unlock. Free for everyone.",
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
