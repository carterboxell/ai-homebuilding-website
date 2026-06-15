'use client'

const features = [
  {
    icon: '🏠',
    title: 'AI Floor Plan Advisor',
    description: 'Answer a few questions about your lifestyle and get personalized floor plan recommendations.',
  },
  {
    icon: '💰',
    title: 'Smart Cost Estimator',
    description: 'Get a real-time AI cost estimate based on square footage, location, and finish level.',
  },
  {
    icon: '🎨',
    title: 'Material & Finish Advisor',
    description: 'Describe your style and receive curated material palettes that match your vision.',
  },
  {
    icon: '💬',
    title: '24/7 AI Chat Support',
    description: 'Get instant answers to your homebuilding questions any time of day.',
  },
]

export default function FeatureGrid() {
  return (
    <section className="py-20 px-6 bg-gray-50">
      <h2 className="text-3xl font-bold text-center mb-12">AI-Powered Tools for Every Step</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
        {features.map((f) => (
          <div key={f.title} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="text-4xl mb-3">{f.icon}</div>
            <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
            <p className="text-gray-600 text-sm">{f.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
