import { Fragment } from "react"
import { Users, Shield, Database, Lock } from "lucide-react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { SetUpVaultCard } from "@/components/tour/SetUpVaultCard"

export default function SettingsPage() {
  const sections = [
    {
      title: "Household",
      description: "Manage people and shared accounts for transaction splitting.",
      icon: Users,
      href: "/settings/owners",
      status: "Available"
    },
    {
      title: "Category Rules",
      description: "Manage automatic categorization rules.",
      icon: Shield,
      href: "/rules",
      status: "Available"
    },
    {
      title: "Encrypted Vault",
      description: "On-device encryption, passkey unlock, and encrypted sync.",
      icon: Lock,
      href: "/settings/vault",
      status: "Available"
    },
    {
      title: "Data & Storage",
      description: "Cloud vs Local SQLite, Export/Import data.",
      icon: Database,
      href: "#",
      status: "Coming soon"
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sections.map((section) => (
          <Fragment key={section.title}>
            <Link href={section.href} className={section.status === "Coming soon" ? "cursor-not-allowed" : ""}>
              <Card className="p-6 bg-card border-border hover:border-primary/50 transition-colors h-full flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <section.icon size={20} />
                  </div>
                  <h2 className="font-semibold text-foreground">{section.title}</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4 flex-1">
                  {section.description}
                </p>
                <div className="mt-auto">
                  <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded ${
                    section.status === "Available" ? "bg-emerald-500/10 text-emerald-500" : "bg-card text-muted-foreground"
                  }`}>
                    {section.status}
                  </span>
                </div>
              </Card>
            </Link>
            {/* Sits directly under the Vault card, and only until there is a
                vault to manage. */}
            {section.href === "/settings/vault" && <SetUpVaultCard />}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
