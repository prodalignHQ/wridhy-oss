import Navbar from "@/components/landing/Navbar"
import Hero from "@/components/landing/Hero"
import Philosophy from "@/components/landing/Philosophy"
import Features from "@/components/landing/Features"
import HowItWorks from "@/components/landing/HowItWorks"
import HouseholdSection from "@/components/landing/HouseholdSection"
import PrivacySection from "@/components/landing/PrivacySection"
import ClosingReminder from "@/components/landing/ClosingReminder"
import Footer from "@/components/landing/Footer"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground antialiased selection:bg-primary/15 selection:text-foreground">
      {/* SECTION 01: Navigation */}
      <Navbar />

      <main id="main-content">
        {/* SECTION 02: Hero */}
        <Hero />

        {/* SECTION 03: The Philosophy */}
        <Philosophy />

        {/* SECTION 04: Everything you can do */}
        <Features />

        {/* SECTION 05: How it works */}
        <HowItWorks />

        {/* SECTION 06: Built for households */}
        <HouseholdSection />

        {/* SECTION 07: Privacy & Ownership */}
        <PrivacySection />

        {/* SECTION 08: A gentle monthly reminder */}
        <ClosingReminder />
      </main>

      {/* SECTION 09: Footer */}
      <Footer />
    </div>
  )
}
