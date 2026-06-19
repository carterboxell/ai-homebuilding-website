import { client } from '@/lib/claude'
import { getRelevantContext } from '@/lib/db'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const WEB_SEARCH_TOOL = { type: 'web_search_20260209', name: 'web_search' }

function extractContactInfo(text) {
  const email = text.match(/[\w.+\-]+@[\w\-]+\.[a-z]{2,}/i)?.[0] ?? null
  const phone = text.match(/\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/)?.[0] ?? null
  return { email, phone }
}

export async function POST(req) {
  const { messages, sessionId } = await req.json()

  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? req.headers.get('x-real-ip')
    ?? null

  const userMessages = messages.filter(m => m.role === 'user')
  const isFirstMessage = userMessages.length === 1
  // Current message drives city/location — user saying "show me Youngsville" overrides prior city
  const currentUserText = userMessages.at(-1)?.content ?? ''
  // Last 3 messages combined for price/bedroom/feature context inheritance across follow-ups
  const recentUserText = userMessages.slice(-3).map(m => m.content).join(' ')

  if (sessionId) {
    const { email, phone } = extractContactInfo(currentUserText)
    if (email || phone) {
      try {
        const leadDir = path.join(process.cwd(), 'leads')
        if (!fs.existsSync(leadDir)) fs.mkdirSync(leadDir)
        const leadFile = path.join(leadDir, `${sessionId}.md`)

        let existing = { email: null, phone: null, ipAddress: null }
        if (fs.existsSync(leadFile)) {
          for (const line of fs.readFileSync(leadFile, 'utf8').split('\n')) {
            if (line.startsWith('- email:')) existing.email = line.replace('- email:', '').trim() || null
            if (line.startsWith('- phone:')) existing.phone = line.replace('- phone:', '').trim() || null
            if (line.startsWith('- ipaddress:')) existing.ipAddress = line.replace('- ipaddress:', '').trim() || null
          }
        }

        const merged = {
          email: email ?? existing.email ?? '',
          phone: phone ?? existing.phone ?? '',
          ipAddress: ipAddress ?? existing.ipAddress ?? '',
        }

        fs.writeFileSync(leadFile, [
          `# Lead Record — ${sessionId}`,
          '',
          `- uniqueID: ${sessionId}`,
          `- PRClientID: fe5f5ca2-fbc0-4329-b2a9-7297f5ba0904`,
          `- usertype: chatbot`,
          `- ipaddress: ${merged.ipAddress}`,
          `- email: ${merged.email}`,
          `- phone: ${merged.phone}`,
          `- message: ${sessionId}.md`,
          `- URL: https://kenharveyhomes.com`,
          `- viewed: 0`,
          `- emailed: 0`,
          `- valid: 1`,
          `- guid: ${sessionId}`,
          `- modifieddate: ${new Date().toISOString()}`,
        ].join('\n'))
      } catch {
        // lead write failure should never break the chat response
      }
    }
  }

  const dbContext = await getRelevantContext(currentUserText, recentUserText)

  const formatRules = `FORMATTING RULES (follow strictly):
- Write in plain prose or simple dash bullet points only.
- NEVER use markdown tables or pipe characters (|).
- NEVER use heading syntax (##, ###, ####).
- NEVER use horizontal rules (---).
- NEVER use blockquotes (>).
- NEVER use emojis.
- Format prices with a dollar sign and commas: $290,000.
- When recommending next steps, refer to "Ken Harvey Homes" or "our team".
- NEVER mention databases, systems, or data infrastructure. Never say things like "in our database", "in our system", "not populated in our database", "our records show", or any similar phrase. Speak naturally as a knowledgeable assistant — if information isn't available, say something like "I don't have that detail handy" or "our team would be the best resource for that" without explaining why.
- NEVER invent or estimate HOA fees, community amenities, or any detail not explicitly provided. If asked, say you don't have that detail and direct the user to contact our team.
- If the user asks for a price range (e.g. "between $X and $Y"), note that you can only filter by maximum price and show homes up to the upper bound.
- When discussing any collection (floor plans, communities, active listings), always lead with the total count (e.g. "Ken Harvey Homes offers 54 floor plans" or "We have 17 communities"). Then highlight a sample. Never list items without first stating how many exist in total.
- Data you presented in prior turns of this conversation is accurate. Do not retract, question, or contradict information you already provided.
- When no listings match a price filter, present alternative communities and floor plans as options at our regular price points — do not imply they are in the user's requested price range.
- NEVER use --- as a section divider. Separate sections with a blank line only.
- When a user asks broadly about floor plans, communities, or homes without specifying a budget or size preference, default to showcasing our higher-end offerings: floor plans 2,500 sq ft and larger, and communities or homes priced at $500,000 and above. If the user then expresses a specific budget or preference, adjust accordingly.
- You may offer to collect the user's contact information at most once per conversation. Do not ask again after the first offer, and never ask if they have already provided an email or phone number earlier in this conversation.
- When showing floor plans or specific listings and the user seems interested, end your response with a natural offer to have the team follow up: for example, "If you'd like, drop your email address below and I'll have our team send you these details directly."
- When no listings match the user's criteria, offer a notification: for example, "Want to be notified when something matching your search becomes available? Just leave your email below."
- When the user asks about touring, financing, next steps, or building timelines, offer a call: for example, "Want a quick call with our team to talk through your options? Just leave your phone number or email below."
- When the user provides an email address or phone number, confirm it warmly and do not ask for contact info again.
- The context includes a URL for each floor plan, community, and home listing (marked as "URL: https://..."). When you mention a specific floor plan, community, or home by name, format it as a markdown link using that URL: [Name](url). Use the exact URL from the context — do not guess or construct URLs yourself.
- When asked about schools near a community or address, use web search to find the nearest schools by driving distance from that location — do not rely solely on school district assignments. Always end any school response with this disclaimer on its own line: "Please note that school district assignments are subject to change, and there may be private and non-public school options in the area as well."
- Floor plan pricing varies by community, lot, and selected options. When a user asks about floor plan prices without specifying a community, let them know pricing depends on location and options, and offer to connect them with the team for accurate figures.`

  const firstMessageInstruction = `

FIRST RESPONSE INSTRUCTIONS — this is the user's very first message in this session. Follow these rules instead of the general lead-capture rules above:
- Answer the user's question briefly.
- From the database results, highlight exactly 2 to 3 of the most relevant floor plans or homes as a sample. Do not list more than 3.
- State the total count of matching results before the sample (e.g. "We have 14 floor plans that match your criteria — here are a few highlights:").
- End your response with this offer: "If you'd like the full list as a PDF, just drop your email address below and I'll have our team send it over with complete details on every matching option."
- This email ask counts as your one contact-info offer for this session — do not ask for contact info again later in the conversation.`

  const systemPrompt = dbContext
    ? `${formatRules}\n\nYou are the AI assistant for Ken Harvey Homes, a homebuilder serving North Carolina. Ken Harvey Homes builds new construction homes across the Triangle area and beyond, with active communities in Raleigh, Youngsville, Louisburg, Durham, Selma, and Wendell. You have access to the following information from our database:\n\n${dbContext}\n\nAnswer using this database information when relevant. If the question goes beyond what the database covers, use web search to find accurate, current information.${isFirstMessage ? firstMessageInstruction : ''}`
    : `${formatRules}\n\nYou are the AI assistant for Ken Harvey Homes, a homebuilder serving North Carolina. Ken Harvey Homes builds new construction homes across the Triangle area and beyond. Use web search to find accurate, current information to answer homebuilding and real estate questions.${isFirstMessage ? firstMessageInstruction : ''}`

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
