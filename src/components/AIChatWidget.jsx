'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'

const mdComponents = {
  p:      ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  ul:     ({ children }) => <ul className="list-disc ml-4 mb-2 space-y-1">{children}</ul>,
  ol:     ({ children }) => <ol className="list-decimal ml-4 mb-2 space-y-1">{children}</ol>,
  li:     ({ children }) => <li>{children}</li>,
  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
  em:     ({ children }) => <em className="italic">{children}</em>,
  a:      ({ href, children }) => <a href={href} className="underline" target="_blank" rel="noreferrer">{children}</a>,
  hr:     () => <hr className="my-2 border-gray-200" />,
  // Flatten tables into a readable list rather than rendering raw pipes
  table:  ({ children }) => <div className="mb-2">{children}</div>,
  thead:  () => null,
  tbody:  ({ children }) => <ul className="list-disc ml-4 space-y-1">{children}</ul>,
  tr:     ({ children }) => <li>{children}</li>,
  td:     ({ children }) => <span className="after:content-['_·_'] last:after:content-['']">{children}</span>,
  th:     () => null,
}

export default function AIChatWidget() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! I\'m the Ken Harvey Homes AI assistant. I can help you explore available homes, floor plans, and communities. What can I help you with today?' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const sessionId = useRef(null)
  useEffect(() => {
    if (!sessionId.current) sessionId.current = crypto.randomUUID()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = { role: 'user', content: input.trim() }
    const history = [...messages, userMessage]
    setMessages(history)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, sessionId: sessionId.current }),
      })
      const data = await res.json()
      setMessages([...history, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages([...history, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="py-20 px-6 bg-white">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-8">Ask Our AI Assistant</h2>
        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-md">
          <div className="h-96 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-amber-500 text-white rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                  }`}
                >
                  {msg.role === 'assistant'
                    ? <ReactMarkdown components={mdComponents}>{msg.content}</ReactMarkdown>
                    : msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 px-4 py-2 rounded-2xl rounded-bl-sm text-gray-400 text-sm">
                  Thinking…
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={sendMessage} className="flex border-t border-gray-200 bg-white">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about Ken Harvey homes, floor plans, communities…"
              className="flex-1 px-4 py-3 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white font-semibold text-sm transition"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
