import { estimateBuildCost } from '@/lib/claude'
import { NextResponse } from 'next/server'

export async function POST(req) {
  const body = await req.json()
  const estimate = await estimateBuildCost(body)
  return NextResponse.json(estimate)
}
