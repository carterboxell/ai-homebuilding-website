import { spawnSync } from 'child_process'

function runQuery(sql) {
  const result = spawnSync(
    'sqlcmd',
    ['-S', 'localhost\\SQLEXPRESS', '-d', 'WinStarHomes', '-No', '-C', '-h', '-1', '-W', '-Q', sql],
    { encoding: 'utf8', timeout: 8000, windowsHide: true }
  )
  if (result.error || result.status !== 0) return ''
  return (result.stdout || '').replace(/\(\d+ rows? affected\)/gi, '').trim()
}

function extractKeywords(question) {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'what', 'how', 'when', 'where', 'which', 'who', 'why', 'do', 'does',
    'can', 'could', 'would', 'should', 'will', 'tell', 'me', 'about', 'any',
    'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'that',
    'this', 'have', 'has', 'had', 'you', 'your', 'our', 'we', 'i', 'my',
    'they', 'them', 'their', 'it', 'its', 'from', 'by', 'as', 'into',
    'please', 'give', 'show', 'list', 'get', 'find', 'looking', 'like'
  ])
  return question.toLowerCase()
    .split(/\s+/)
    .map(w => w.replace(/[^a-z0-9]/g, ''))
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 6)
}

function makeLike(columns, keywords) {
  return keywords
    .flatMap(kw => columns.map(col => `LOWER(${col}) LIKE '%${kw}%'`))
    .join(' OR ')
}

export async function getRelevantContext(question) {
  const keywords = extractKeywords(question)
  if (!keywords.length) return null

  const contexts = []

  // Search company FAQs
  const faqCond = makeLike(['FAQQuestion', 'FAQAnswer', 'FAQCategory'], keywords)
  const faqs = runQuery(
    `SET NOCOUNT ON; SELECT TOP 3 FAQQuestion, FAQAnswer FROM Admin_tblFAQs WHERE PortalID=38 AND (${faqCond})`
  )
  if (faqs) contexts.push(`Company FAQ:\n${faqs}`)

  // Search communities
  const commCond = makeLike(['CommunityName', 'City', 'State'], keywords)
  const communities = runQuery(
    `SET NOCOUNT ON; SELECT TOP 3 CommunityName, City, State, MinPrice, MaxPrice, Amenities FROM Admin_tblCommunities WHERE (${commCond})`
  )
  if (communities) contexts.push(`Communities:\n${communities}`)

  // Search floor plans
  const fpCond = makeLike(['FloorplanName', 'Style'], keywords)
  const floorplans = runQuery(
    `SET NOCOUNT ON; SELECT TOP 5 FloorplanName, MinSquareFeet, MaxSquareFeet, MinBedrooms, MaxBedrooms, MinBaths, MaxBaths, MinPrice, MaxPrice, Style FROM Admin_tblFloorplans WHERE (${fpCond})`
  )
  if (floorplans) contexts.push(`Floor Plans:\n${floorplans}`)

  return contexts.length ? contexts.join('\n\n') : null
}
