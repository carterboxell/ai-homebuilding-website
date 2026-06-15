'use client'

import { useState } from 'react'

const defaultPrefs = {
  bedrooms: '3',
  bathrooms: '2',
  lifestyle: '',
  priorities: [],
}

const priorityOptions = ['Open kitchen', 'Home office', 'Large primary suite', 'Mudroom', 'Bonus room', 'Outdoor living']

export default function FloorPlanRecommender() {
  const [prefs, setPrefs] = useState(defaultPrefs)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)

  function togglePriority(p) {
    setPrefs((prev) => ({
      ...prev,
      priorities: prev.priorities.includes(p)
        ? prev.priorities.filter((x) => x !== p)
        : [...prev.priorities, p],
    }))
  }

  async function getRecommendations(e) {
    e.preventDefault()
    setLoading(true)
    setResults(null)
    try {
      const res = await fetch('/api/floor-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      const data = await res.json()
      setResults(data.recommendations)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="floor-plans" className="py-20 px-6 bg-slate-50">
      <div className="max-w-3xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-2">AI Floor Plan Recommender</h2>
        <p className="text-center text-gray-500 mb-10">Tell us about your lifestyle and we'll suggest the best floor plan styles for you.</p>

        <form onSubmit={getRecommendations} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Bedrooms</label>
              <select
                value={prefs.bedrooms}
                onChange={(e) => setPrefs({ ...prefs, bedrooms: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {['2', '3', '4', '5+'].map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Bathrooms</label>
              <select
                value={prefs.bathrooms}
                onChange={(e) => setPrefs({ ...prefs, bathrooms: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              >
                {['1', '2', '2.5', '3', '4+'].map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Describe your lifestyle</label>
            <textarea
              value={prefs.lifestyle}
              onChange={(e) => setPrefs({ ...prefs, lifestyle: e.target.value })}
              placeholder="e.g. We work from home, have two kids and a dog, love to entertain…"
              rows={3}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Top priorities (select all that apply)</label>
            <div className="flex flex-wrap gap-2">
              {priorityOptions.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePriority(p)}
                  className={`px-3 py-1 rounded-full text-sm border transition ${
                    prefs.priorities.includes(p)
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-amber-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
          >
            {loading ? 'Finding your matches…' : 'Get My Floor Plan Recommendations'}
          </button>
        </form>

        {results && (
          <div className="mt-8 space-y-4">
            {results.map((plan, i) => (
              <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-lg">{plan.name}</h3>
                  <span className="text-sm text-gray-500">{plan.sqft_range} sq ft · {plan.bedrooms}bd / {plan.bathrooms}ba</span>
                </div>
                <p className="text-gray-600 text-sm mb-3">{plan.rationale}</p>
                <div className="flex flex-wrap gap-2">
                  {plan.highlights.map((h) => (
                    <span key={h} className="bg-amber-50 text-amber-700 text-xs px-2 py-1 rounded-full">{h}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
