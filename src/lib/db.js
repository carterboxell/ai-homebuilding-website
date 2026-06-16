import { spawnSync } from 'child_process'

// Nearby city groups for Triangle NC area — used for "near X" queries
const CITY_GROUPS = {
  'apex':          ['Apex', 'Cary', 'Holly Springs', 'Fuquay-Varina', 'Morrisville'],
  'cary':          ['Cary', 'Apex', 'Morrisville', 'Holly Springs', 'Raleigh'],
  'holly springs': ['Holly Springs', 'Apex', 'Fuquay-Varina', 'Cary'],
  'fuquay-varina': ['Fuquay-Varina', 'Holly Springs', 'Apex', 'Angier'],
  'fuquay varina': ['Fuquay-Varina', 'Holly Springs', 'Apex', 'Angier'],
  'raleigh':       ['Raleigh', 'Cary', 'Wake Forest', 'Garner', 'Knightdale', 'Wendell'],
  'wake forest':   ['Wake Forest', 'Raleigh', 'Rolesville', 'Youngsville'],
  'morrisville':   ['Morrisville', 'Cary', 'Apex', 'Raleigh'],
  'durham':        ['Durham', 'Chapel Hill', 'Carrboro', 'Pittsboro'],
  'chapel hill':   ['Chapel Hill', 'Durham', 'Carrboro', 'Pittsboro'],
  'garner':        ['Garner', 'Raleigh', 'Clayton'],
  'clayton':       ['Clayton', 'Garner', 'Smithfield'],
  'zebulon':       ['Zebulon', 'Wake Forest', 'Wendell', 'Knightdale'],
  'wendell':       ['Wendell', 'Zebulon', 'Knightdale', 'Raleigh'],
  'rolesville':    ['Rolesville', 'Wake Forest', 'Youngsville'],
  'youngsville':   ['Youngsville', 'Wake Forest', 'Rolesville', 'Franklinton'],
  'selma':         ['Selma', 'Smithfield', 'Benson'],
  'pittsboro':     ['Pittsboro', 'Chapel Hill', 'Sanford'],
  'knightdale':    ['Knightdale', 'Wendell', 'Zebulon', 'Raleigh'],
  'smithfield':    ['Smithfield', 'Selma', 'Clayton'],
  'angier':        ['Angier', 'Fuquay-Varina', 'Lillington'],
}

function runQuery(sql) {
  const result = spawnSync(
    'sqlcmd',
    ['-S', 'localhost\\SQLEXPRESS', '-d', 'WinStarHomes', '-No', '-C', '-h', '-1', '-Q', sql],
    { encoding: 'utf8', timeout: 8000, windowsHide: true }
  )
  if (result.error || result.status !== 0) return ''
  return (result.stdout || '')
    .replace(/\(\d+ rows? affected\)/gi, '')
    .replace(/<[^>]+>/g, '')
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.trim())
    .join('\n')
    .trim()
}

// Extract max price from "under 750k", "below $500,000", "less than 800000"
function parseMaxPrice(text) {
  const q = text.toLowerCase()
  let m = q.match(/(?:under|below|less than|up to|no more than|max(?:imum)?|within)\s*\$?\s*([\d,]+)\s*(k|thousand)?/)
  if (m) {
    let price = parseFloat(m[1].replace(/,/g, ''))
    if (m[2] === 'k' || m[2] === 'thousand') price *= 1000
    else if (price < 5000) price *= 1000
    return price
  }
  m = q.match(/\b([\d,]+)k\b/)
  if (m) return parseFloat(m[1].replace(/,/g, '')) * 1000
  return null
}

// Extract min bedrooms from "at least 3 bedrooms", "3+ bedrooms", "3 or more bedrooms"
function parseMinBeds(text) {
  const q = text.toLowerCase()
  let m = q.match(/(?:at least|minimum|at minimum|min(?:imum)?)\s+(\d+)\s*bed/)
  if (m) return parseInt(m[1])
  m = q.match(/(\d+)\s*(?:\+|or more|plus)\s*bed/)
  if (m) return parseInt(m[1])
  m = q.match(/(\d+)\s*bed(?:room)?s?/)
  if (m) return parseInt(m[1])
  return null
}

// Extract mentioned city and expand to nearby cities
function parseCities(text) {
  const q = text.toLowerCase()
  const match = Object.keys(CITY_GROUPS).find(c => q.includes(c))
  return match ? { name: match, list: CITY_GROUPS[match] } : null
}

// Detect floor plan feature requests and return SQL WHERE conditions
// FirstFloorMaster is int (0/1); BonusRoom is varchar ('Yes','No','Optional')
function parseFloorPlanFeatures(text) {
  const q = text.toLowerCase()
  const conditions = []
  if (/first.?floor.?master|master.?on.?(main|first)|main.?floor.?master/.test(q)) {
    conditions.push('FirstFloorMaster = 1')
  }
  if (/bonus.?room/.test(q)) {
    conditions.push("BonusRoom IN ('Yes', 'Optional')")
  }
  if (/\bstudy\b/.test(q)) {
    conditions.push('Study = 1')
  }
  if (/basement/.test(q)) {
    conditions.push('Basement = 1')
  }
  if (/third.?floor|3rd.?floor/.test(q)) {
    conditions.push('OptionalThirdFloor = 1')
  }
  return conditions
}

function extractKeywords(text) {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'what', 'how', 'when', 'where', 'which', 'who', 'why', 'do', 'does',
    'can', 'could', 'would', 'should', 'will', 'tell', 'me', 'about', 'any',
    'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'that',
    'this', 'have', 'has', 'had', 'you', 'your', 'our', 'we', 'i', 'my',
    'they', 'them', 'their', 'it', 'its', 'from', 'by', 'as', 'into',
    'please', 'give', 'show', 'list', 'get', 'find', 'looking', 'like',
    'near', 'many', 'sale', 'homes', 'home', 'house', 'houses',
    'under', 'least', 'available', 'currently', 'these', 'those', 'some'
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

// Feature columns appended to every floor plan row so Claude can answer follow-up questions
const FP_FEATURE_COLS = `
  CASE WHEN FirstFloorMaster = 1 THEN ' | 1st Floor Master' ELSE '' END +
  CASE WHEN BonusRoom IN ('Yes','Optional') THEN ' | Bonus Room' ELSE '' END +
  CASE WHEN Study = 1 THEN ' | Study' ELSE '' END +
  CASE WHEN Basement = 1 THEN ' | Basement' ELSE '' END`

export async function getRelevantContext(text) {
  const keywords = extractKeywords(text)
  const maxPrice = parseMaxPrice(text)
  const minBeds = parseMinBeds(text)
  const cityMatch = parseCities(text)
  const fpFeatures = parseFloorPlanFeatures(text)
  const hasStructured = cityMatch || maxPrice || minBeds || fpFeatures.length

  if (!keywords.length && !hasStructured) return null

  const contexts = []

  // ---- Structured queries: location + price + bedroom + feature filters ----
  if (hasStructured) {
    const cityList = cityMatch?.list ?? []
    const cityIn = cityList.length
      ? `City IN (${cityList.map(c => `'${c.replace(/'/g, "''")}'`).join(',')})`
      : null

    // Communities: city + price filter
    if (cityMatch || maxPrice) {
      const commWhereParts = [
        cityIn,
        maxPrice ? `(MinPrice <= ${maxPrice} OR MinPrice IS NULL OR MinPrice = 0)` : null
      ].filter(Boolean)
      const commWhere = commWhereParts.length ? `WHERE ${commWhereParts.join(' AND ')}` : ''

      const commCount = runQuery(
        `SET NOCOUNT ON; SELECT CAST(COUNT(*) AS nvarchar) FROM Admin_tblCommunities ${commWhere}`
      )
      const commRows = runQuery(
        `SET NOCOUNT ON; SELECT TOP 10 CAST(
          CommunityName + ' (' + ISNULL(City,'') + ', ' + ISNULL(State,'NC') + ')' +
          ' | From $' + CAST(ISNULL(MinPrice,0) AS nvarchar) +
          CASE WHEN MaxPrice > 0 THEN ' to $' + CAST(MaxPrice AS nvarchar) ELSE '' END
        AS nvarchar(300))
        FROM Admin_tblCommunities ${commWhere} ORDER BY MinPrice`
      )

      if (commRows) {
        const label = [
          cityMatch ? `near ${cityMatch.name.replace(/\b\w/g, c => c.toUpperCase())}` : '',
          maxPrice ? `under $${maxPrice.toLocaleString()}` : ''
        ].filter(Boolean).join(', ')
        const total = commCount ? `(${commCount} total)` : ''
        contexts.push(`Communities ${label} ${total}:\n${commRows}`)
      }
    }

    // Floor plans: bedrooms + price + feature flags
    const fpWhereParts = [
      minBeds ? `(MinBedrooms >= ${minBeds} OR MaxBedrooms >= ${minBeds})` : null,
      maxPrice ? `(MinPrice <= ${maxPrice} OR MinPrice IS NULL OR MinPrice = 0)` : null,
      ...fpFeatures
    ].filter(Boolean)
    const fpWhere = fpWhereParts.length ? `WHERE ${fpWhereParts.join(' AND ')}` : ''

    const fpCount = runQuery(
      `SET NOCOUNT ON; SELECT CAST(COUNT(*) AS nvarchar) FROM Admin_tblFloorplans ${fpWhere}`
    )
    const fpRows = runQuery(
      `SET NOCOUNT ON; SELECT TOP 10 CAST(
        FloorplanName +
        ' | Beds: ' + CAST(ISNULL(MinBedrooms,0) AS nvarchar) +
          CASE WHEN MaxBedrooms > 0 THEN '-' + CAST(MaxBedrooms AS nvarchar) ELSE '+' END +
        ' | Baths: ' + CAST(ISNULL(MinBaths,0) AS nvarchar) +
        ' | SqFt: ' + CAST(ISNULL(MinSquareFeet,0) AS nvarchar) + '-' + CAST(ISNULL(MaxSquareFeet,0) AS nvarchar) +
        CASE WHEN MinPrice > 0 THEN ' | $' + CAST(MinPrice AS nvarchar) + '-$' + CAST(ISNULL(MaxPrice,0) AS nvarchar) ELSE '' END +
        ${FP_FEATURE_COLS}
      AS nvarchar(400))
      FROM Admin_tblFloorplans ${fpWhere} ORDER BY MinBedrooms, MinPrice`
    )

    if (fpRows) {
      const label = [
        minBeds ? `${minBeds}+ bedrooms` : '',
        maxPrice ? `under $${maxPrice.toLocaleString()}` : '',
        fpFeatures.length ? fpFeatures.map(f => f.replace(/\w+\s*=.*|.*IN.*/, m =>
          m.includes('FirstFloor') ? 'first floor master' :
          m.includes('BonusRoom') ? 'bonus room' :
          m.includes('Study') ? 'study' :
          m.includes('Basement') ? 'basement' : 'feature'
        )).join(', ') : ''
      ].filter(Boolean).join(', ')
      const total = fpCount ? `(${fpCount} floor plans total)` : ''
      contexts.push(`Available Floor Plans ${label} ${total}:\n${fpRows}`)
    }
  }

  // ---- Keyword LIKE search for FAQ and text-based queries ----
  if (keywords.length) {
    const faqCond = makeLike(['question', 'answer'], keywords)
    const faqs = runQuery(
      `SET NOCOUNT ON; SELECT TOP 3 CAST('Q: ' + question + CHAR(10) + 'A: ' + answer AS nvarchar(4000)) FROM Admin_tblFAQs WHERE (${faqCond})`
    )
    if (faqs) contexts.push(`FAQ:\n${faqs}`)

    // Keyword community/floorplan search only when structured filters weren't used
    if (!hasStructured) {
      const commCond = makeLike(['CommunityName', 'City', 'State'], keywords)
      const communities = runQuery(
        `SET NOCOUNT ON; SELECT TOP 5 CAST(
          CommunityName + ', ' + ISNULL(City,'') + ', ' + ISNULL(State,'') +
          ' | Price: $' + CAST(ISNULL(MinPrice,0) AS nvarchar) + '-$' + CAST(ISNULL(MaxPrice,0) AS nvarchar)
        AS nvarchar(300)) FROM Admin_tblCommunities WHERE (${commCond})`
      )
      if (communities) contexts.push(`Communities:\n${communities}`)

      const fpCond = makeLike(['FloorplanName', 'Style', 'Features'], keywords)
      const floorplans = runQuery(
        `SET NOCOUNT ON; SELECT TOP 5 CAST(
          FloorplanName + ' | ' + ISNULL(Style,'') +
          ' | Beds: ' + CAST(ISNULL(MinBedrooms,0) AS nvarchar) +
          ' | SqFt: ' + CAST(ISNULL(MinSquareFeet,0) AS nvarchar) + '-' + CAST(ISNULL(MaxSquareFeet,0) AS nvarchar) +
          ${FP_FEATURE_COLS}
        AS nvarchar(400)) FROM Admin_tblFloorplans WHERE (${fpCond})`
      )
      if (floorplans) contexts.push(`Floor Plans:\n${floorplans}`)
    }
  }

  return contexts.length ? contexts.join('\n\n') : null
}
