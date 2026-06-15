import { streamChatResponse } from '@/lib/claude'
import { NextResponse } from 'next/server'

export async function POST(req) {
  const { messages } = await req.json()

  const stream = await streamChatResponse(messages)
  const finalMessage = await stream.finalMessage()
  const reply = finalMessage.content[0].text

  return NextResponse.json({ reply })
}
