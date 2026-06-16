import { client } from '@/lib/claude'
import { getRelevantContext } from '@/lib/db'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const WEB_SEARCH_TOOL = { type: 'web_search_20260209', name: 'web_search' }

export async function POST(req) {
  const { messages, sessionId } = await req.json()

  // Combine the last 3 user messages so follow-up questions ("do any of these have...")
  // inherit city/price/bedroom context from the prior turn
  const recentUserText = messages
    .filter(m => m.role === 'user')
    .slice(-3)
    .map(m => m.content)
    .join(' ')

  const dbContext = await getRelevantContext(recentUserText)

  const formatRules = `FORMATTING RULES (follow strictly):
- Write in plain prose or simple dash bullet points only.
- NEVER use markdown tables or pipe characters (|).
- NEVER use heading syntax (##, ###, ####).
- NEVER use horizontal rules (---).
- NEVER use blockquotes (>).
- NEVER use emojis.
- Format prices with a dollar sign and commas: $290,000.
- When recommending next steps, refer to "Ken Harvey Homes" or "our team".`

  const systemPrompt = dbContext
    ? `${formatRules}\n\nYou are the AI assistant for Ken Harvey Homes, a homebuilder serving North Carolina. Ken Harvey Homes builds new construction homes across the Triangle area and beyond, with active communities in Raleigh, Youngsville, Louisburg, Durham, Selma, and Wendell. You have access to the following information from our database:\n\n${dbContext}\n\nAnswer using this database information when relevant. If the question goes beyond what the database covers, use web search to find accurate, current information.`
    : `${formatRules}\n\nYou are the AI assistant for Ken Harvey Homes, a homebuilder serving North Carolina. Ken Harvey Homes builds new construction homes across the Triangle area and beyond. Use web search to find accurate, current information to answer homebuilding and real estate questions.`

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
    .join(' ')

  if (sessionId) {
    try {
      const logDir = path.join(process.cwd(), 'chat-logs')
      if (!fs.existsSync(logDir)) fs.mkdirSync(logDir)

      const logFile = path.join(logDir, `${sessionId}.md`)
      const userMessage = messages[messages.length - 1]

      if (!fs.existsSync(logFile)) {
        const ts = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
        fs.writeFileSync(logFile, `# Chat Session — ${ts}\n\n`)
      }

      fs.appendFileSync(logFile, `**User:** ${userMessage.content}\n\n**Assistant:** ${reply}\n\n---\n\n`)
    } catch {
      // logging failure should never break the chat response
    }
  }

  return NextResponse.json({ reply })
}
