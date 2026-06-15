import { getFloorPlanRecommendations } from '@/lib/claude'
import { NextResponse } from 'next/server'

export async function POST(req) {
  const preferences = await req.json()
  const recommendations = await getFloorPlanRecommendations(preferences)
  return NextResponse.json({ recommendations })
}
