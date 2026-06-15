import HeroSection from '@/components/HeroSection'
import FeatureGrid from '@/components/FeatureGrid'
import AIChatWidget from '@/components/AIChatWidget'
import FloorPlanRecommender from '@/components/FloorPlanRecommender'
import CostEstimator from '@/components/CostEstimator'

export default function HomePage() {
  return (
    <main>
      <HeroSection />
      <FeatureGrid />
      <FloorPlanRecommender />
      <CostEstimator />
      <AIChatWidget />
    </main>
  )
}
