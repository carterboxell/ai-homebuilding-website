import { client } from '@/lib/claude'
import { getRelevantContext } from '@/lib/db'
import { NextResponse } from 'next/server'

const WEB_SEARCH_TOOL = { type: 'web_search_20260209', name: 'web_search' }

export async function POST(req) {
  const { messages } = await req.json()

  // Combine the last 3 user messages so follow-up questions ("do any of these have...")
  // inherit city/price/bedroom context from the prior turn
  const recentUserText = messages
    .filter(m => m.role === 'user')
    .slice(-3)
    .map(m => m.content)
    .join(' ')

  const dbContext = await getRelevantContext(recentUserText)

  const formatGuide = `Write clear, conversational responses. Use plain prose paragraphs. When listing items, use simple bullet points (dashes). Do not use markdown tables, pipe characters (|), horizontal rules, heading syntax (##, ###), or blockquotes. Do not use emojis. Format all prices with dollar signs and commas (e.g., $290,000 not 290000).`

  const systemPrompt = dbContext
    ? `You are a helpful AI assistant for a homebuilding platform serving North Carolina. Our database includes communities and floor plans from multiple homebuilders across the Triangle area and beyond. You have access to the following information from the database:\n\n${dbContext}\n\nAnswer using this database information when relevant. If the question goes beyond what the database covers, use web search to find accurate, current information.\n\n${formatGuide}`
    : `You are a helpful AI assistant for a homebuilding platform serving North Carolina, with communities and floor plans from multiple builders. Use web search to find accurate, current information to answer homebuilding questions.\n\n${formatGuide}`

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
