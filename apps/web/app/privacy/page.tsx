import type { Metadata } from "next"
import Navbar from "@/components/landing/Navbar"
import Footer from "@/components/landing/Footer"
import PrivacyTabs from "@/components/landing/PrivacyTabs"

export const metadata: Metadata = {
  title: "MoMoney — 100% Private by Design",
  description:
    "How MoMoney keeps your money data private: on-device parsing, encrypted vaults, passkey unlock. Plain-English and technical explanations.",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background font-sans text-foreground">
      <Navbar />
      <main>
        <PrivacyTabs />
      </main>
      <Footer />
    </div>
  )
}
