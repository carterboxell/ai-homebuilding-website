'use client'

export default function HeroSection() {
  return (
    <section className="relative bg-gradient-to-br from-slate-900 to-slate-700 text-white py-28 px-6 text-center">
      <h1 className="text-5xl font-bold mb-4 leading-tight">
        Build the Home You've Always Imagined
      </h1>
      <p className="text-xl text-slate-300 max-w-2xl mx-auto mb-8">
        AI-powered tools to help you design, price, and visualize your dream home — before breaking ground.
      </p>
      <div className="flex gap-4 justify-center flex-wrap">
        <a
          href="#floor-plans"
          className="bg-amber-500 hover:bg-amber-400 text-white font-semibold px-8 py-3 rounded-lg transition"
        >
          Explore Floor Plans
        </a>
        <a
          href="#estimator"
          className="border border-white hover:bg-white hover:text-slate-900 font-semibold px-8 py-3 rounded-lg transition"
        >
          Get a Cost Estimate
        </a>
      </div>
    </section>
  )
}
