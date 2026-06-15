import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const HOMEBUILDING_SYSTEM_PROMPT = `You are a knowledgeable assistant for a homebuilding company.
You help prospective buyers with questions about floor plans, construction timelines, materials,
finishes, pricing, and the homebuilding process. Be concise, friendly, and accurate.
When you don't know a specific detail, direct the user to contact the sales team.`

export async function streamChatResponse(messages) {
  return client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: HOMEBUILDING_SYSTEM_PROMPT,
    messages,
  })
}

export async function getFloorPlanRecommendations(preferences) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Based on these buyer preferences, recommend 3 floor plan styles with a brief rationale for each.
Preferences: ${JSON.stringify(preferences)}
Respond as a JSON array with fields: name, sqft_range, bedrooms, bathrooms, highlights (array), rationale.`,
      },
    ],
  })

  return JSON.parse(response.content[0].text)
}

export async function estimateBuildCost({ sqft, location, finishLevel, features }) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Estimate the residential construction cost for:
- Square footage: ${sqft}
- Location: ${location}
- Finish level: ${finishLevel} (standard / upgraded / luxury)
- Special features: ${features.join(', ')}

Respond as JSON with: low_estimate, high_estimate, currency ("USD"), cost_per_sqft_range, notes.`,
      },
    ],
  })

  return JSON.parse(response.content[0].text)
}
