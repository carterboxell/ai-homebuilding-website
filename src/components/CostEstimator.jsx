'use client'

import { useState } from 'react'

const featureOptions = ['Finished basement', 'Three-car garage', 'Pool', 'Solar panels', 'Smart home wiring', 'Cathedral ceilings']

export default function CostEstimator() {
  const [form, setForm] = useState({ sqft: '', location: '', finishLevel: 'standard', features: [] })
  const [estimate, setEstimate] = useState(null)
  const [loading, setLoading] = useState(false)

  function toggleFeature(f) {
    setForm((prev) => ({
      ...prev,
      features: prev.features.includes(f) ? prev.features.filter((x) => x !== f) : [...prev.features, f],
    }))
  }

  async function getEstimate(e) {
    e.preventDefault()
    setLoading(true)
    setEstimate(null)
    try {
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      setEstimate(data)
    } finally {
      setLoading(false)
    }
  }

  const fmt = (n) => n?.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  return (
    <section id="estimator" className="py-20 px-6 bg-white">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-2">AI Cost Estimator</h2>
        <p className="text-center text-gray-500 mb-10">Get a ballpark build cost based on your specs — powered by AI.</p>

        <form onSubmit={getEstimate} className="bg-gray-50 rounded-xl p-6 border border-gray-100 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Square Footage</label>
              <input
                type="number"
                required
                min={500}
                value={form.sqft}
                onChange={(e) => setForm({ ...form, sqft: e.target.value })}
                placeholder="e.g. 2400"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Location (City, State)</label>
              <input
                type="text"
                required
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Austin, TX"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Finish Level</label>
            <div className="flex gap-3">
              {['standard', 'upgraded', 'luxury'].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setForm({ ...form, finishLevel: level })}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border capitalize transition ${
                    form.finishLevel === level
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Special Features</label>
            <div className="flex flex-wrap gap-2">
              {featureOptions.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => toggleFeature(f)}
                  className={`px-3 py-1 rounded-full text-sm border transition ${
                    form.features.includes(f)
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
          >
            {loading ? 'Calculating…' : 'Estimate My Build Cost'}
          </button>
        </form>

        {estimate && (
          <div className="mt-8 bg-slate-900 text-white rounded-xl p-6 space-y-3">
            <h3 className="font-semibold text-lg">Estimated Build Cost</h3>
            <div className="flex justify-between text-2xl font-bold text-amber-400">
              <span>{fmt(estimate.low_estimate)}</span>
              <span>–</span>
              <span>{fmt(estimate.high_estimate)}</span>
            </div>
            <p className="text-slate-400 text-sm">{estimate.cost_per_sqft_range} per sq ft · {estimate.currency}</p>
            {estimate.notes && <p className="text-slate-300 text-sm border-t border-slate-700 pt-3">{estimate.notes}</p>}
          </div>
        )}
      </div>
    </section>
  )
}
