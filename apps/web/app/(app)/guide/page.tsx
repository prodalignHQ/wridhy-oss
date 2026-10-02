import { GuideTour } from '@/components/guide/GuideTour'
import { GUIDE_STEPS, guideStepIndex } from '@/lib/guide-content'

export const metadata = {
  title: 'Getting Started | MoMoney',
  description: 'Guided tour: add accounts, household members, upload statements, and more.',
}

export default async function GuidePage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>
}) {
  const { step } = await searchParams
  const initialIndex = GUIDE_STEPS.length ? guideStepIndex(step) : 0
  return <GuideTour initialIndex={initialIndex} />
}
