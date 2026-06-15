import { client } from '@/lib/claude'
import { getRelevantContext } from '@/lib/db'
import { NextResponse } from 'next/server'

const WEB_SEARCH_TOOL = { type: 'web_search_20260209', name: 'web_search' }

export async function POST(req) {
  const { messages } = await req.json()
  const lastMessage = messages.at(-1)?.content ?? ''

  const dbContext = await getRelevantContext(lastMessage)

  const systemPrompt = dbContext
    ? `You are a helpful AI assistant for Ken Harvey Homes, a homebuilder in the Triangle area of North Carolina (Raleigh, Wake Forest, Rolesville, Youngsville, Wendell, Selma). You have access to the following information from our company database:\n\n${dbContext}\n\nAnswer using this database information when relevant. If the question goes beyond what the database covers, use web search to find accurate, current information.`
    : `You are a helpful AI assistant for Ken Harvey Homes, a homebuilder in the Triangle area of North Carolina. Use web search to find accurate, current information to answer the user's homebuilding questions.`

  const apiMessages = messages.map(m => ({ role: m.role, content: m.content }))

  let response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    tools: [WEB_SEARCH_TOOL],
    messages: apiMessages,
  })

  // Server-side web search may hit its iteration limit; re-send to continue
  while (response.stop_reason === 'pause_turn') {
    apiMessages.push({ role: 'assistant', content: response.content })
    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      tools: [WEB_SEARCH_TOOL],
      messages: apiMessages,
    })
  }

  const reply = response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('')

  return NextResponse.json({ reply })
}
