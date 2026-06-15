import { spawnSync } from 'child_process'

function runQuery(sql) {
  const result = spawnSync(
    'sqlcmd',
    ['-S', 'localhost\\SQLEXPRESS', '-d', 'WinStarHomes', '-No', '-C', '-h', '-1', '-Q', sql],
    { encoding: 'utf8', timeout: 8000, windowsHide: true }
  )
  if (result.error || result.status !== 0) return ''
  return (result.stdout || '')
    .replace(/\(\d+ rows? affected\)/gi, '')
    .replace(/<[^>]+>/g, '')       // strip HTML tags
    .split('\n')
    .map(line => line.trimEnd())   // remove padding spaces per line
    .filter(line => line.trim())   // drop blank lines
    .join('\n')
    .trim()
}

function extractKeywords(text) {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'what', 'how', 'when', 'where', 'which', 'who', 'why', 'do', 'does',
    'can', 'could', 'would', 'should', 'will', 'tell', 'me', 'about', 'any',
    'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'that',
    'this', 'have', 'has', 'had', 'you', 'your', 'our', 'we', 'i', 'my',
    'they', 'them', 'their', 'it', 'its', 'from', 'by', 'as', 'into',
    'please', 'give', 'show', 'list', 'get', 'find', 'looking', 'like'
  ])
  return text.toLowerCase()
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

  // FAQ table uses lowercase column names: question, answer
  const faqCond = makeLike(['question', 'answer'], keywords)
  const faqs = runQuery(
    `SET NOCOUNT ON; SELECT TOP 3 CAST('Q: ' + question + CHAR(10) + 'A: ' + answer AS nvarchar(4000)) FROM Admin_tblFAQs WHERE portalid=38 AND (${faqCond})`
  )
  if (faqs) contexts.push(`Company FAQ:\n${faqs}`)

  // Communities
  const commCond = makeLike(['CommunityName', 'City', 'State'], keywords)
  const communities = runQuery(
    `SET NOCOUNT ON; SELECT TOP 3 CAST(CommunityName + ', ' + City + ', ' + State + ' | Price: $' + CAST(ISNULL(MinPrice,0) AS nvarchar) + '-$' + CAST(ISNULL(MaxPrice,0) AS nvarchar) + ' | Amenities: ' + ISNULL(Amenities,'') AS nvarchar(4000)) FROM Admin_tblCommunities WHERE (${commCond})`
  )
  if (communities) contexts.push(`Communities:\n${communities}`)

  // Floor plans
  const fpCond = makeLike(['FloorplanName', 'Style', 'Features'], keywords)
  const floorplans = runQuery(
    `SET NOCOUNT ON; SELECT TOP 5 CAST(FloorplanName + ' | ' + ISNULL(Style,'') + ' | Beds: ' + CAST(ISNULL(MinBedrooms,0) AS nvarchar) + '-' + CAST(ISNULL(MaxBedrooms,0) AS nvarchar) + ' | Baths: ' + CAST(ISNULL(MinBaths,0) AS nvarchar) + '-' + CAST(ISNULL(MaxBaths,0) AS nvarchar) + ' | SqFt: ' + CAST(ISNULL(MinSquareFeet,0) AS nvarchar) + '-' + CAST(ISNULL(MaxSquareFeet,0) AS nvarchar) + ' | Price: $' + CAST(ISNULL(MinPrice,0) AS nvarchar) + '-$' + CAST(ISNULL(MaxPrice,0) AS nvarchar) AS nvarchar(4000)) FROM Admin_tblFloorplans WHERE (${fpCond})`
  )
  if (floorplans) contexts.push(`Floor Plans:\n${floorplans}`)

  return contexts.length ? contexts.join('\n\n') : null
}
