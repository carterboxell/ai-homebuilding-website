import { spawnSync } from 'child_process'

// Nearby city groups for Ken Harvey Homes markets in NC
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
  'louisburg':     ['Louisburg', 'Youngsville', 'Wake Forest', 'Franklinton'],
  'selma':         ['Selma', 'Smithfield', 'Benson'],
  'pittsboro':     ['Pittsboro', 'Chapel Hill', 'Sanford'],
  'knightdale':    ['Knightdale', 'Wendell', 'Zebulon', 'Raleigh'],
  'smithfield':    ['Smithfield', 'Selma', 'Clayton'],
  'angier':        ['Angier', 'Fuquay-Varina', 'Lillington'],
}

function runQuery(sql, db = 'WinStarHomes') {
  const result = spawnSync(
    'sqlcmd',
    ['-S', 'localhost\\SQLEXPRESS', '-d', db, '-No', '-C', '-h', '-1', '-Q', sql],
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

// Extract max price from "under 750k", "below $1.2 million", "between $500k and $800k", etc.
function parseMaxPrice(text) {
  const wordNums = { one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10 }
  // Normalize written-out amounts before regex: "eight hundred thousand" → "800000"
  let q = text.toLowerCase()
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+hundred\s+thousand\b/g,
      m => (wordNums[m.split(' ')[0]] * 100000).toString())
    .replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+million\b/g,
      m => (wordNums[m.split(' ')[0]] * 1000000).toString())

  // "between $X and $Y" — SQL can't filter min price, so use the higher bound as max
  const between = q.match(/between\s*\$?\s*([\d,.]+)\s*(k|thousand|million)?\s*(?:and|to)\s*\$?\s*([\d,.]+)\s*(k|thousand|million)?/)
  if (between) {
    const toNum = (n, unit) => {
      let v = parseFloat(n.replace(/,/g, ''))
      if (unit === 'k' || unit === 'thousand') v *= 1000
      else if (unit === 'million') v *= 1000000
      else if (v < 5000) v *= 1000
      return v
    }
    return Math.max(toNum(between[1], between[2]), toNum(between[3], between[4]))
  }

  // Keyword + amount (supports "million" and decimal like "1.2 million")
  let m = q.match(/(?:under|below|less than|up to|no more than|max(?:imum)?|within)\s*\$?\s*([\d,.]+)\s*(k|thousand|million)?/)
  if (m) {
    let price = parseFloat(m[1].replace(/,/g, ''))
    if (m[2] === 'k' || m[2] === 'thousand') price *= 1000
    else if (m[2] === 'million') price *= 1000000
    else if (price < 5000) price *= 1000
    return price
  }

  // Bare "Nk" shorthand
  m = q.match(/\b([\d,.]+)k\b/)
  if (m) return parseFloat(m[1].replace(/,/g, '')) * 1000
  return null
}

// Extract min bedrooms from "at least 3 bedrooms", "three bedrooms", "3+ bedrooms", etc.
function parseMinBeds(text) {
  const wordNums = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 }
  const q = text.toLowerCase().replace(
    /\b(one|two|three|four|five|six|seven|eight)\b/g,
    w => wordNums[w]
  )
  let m = q.match(/(?:at least|minimum|at minimum|min(?:imum)?)\s+(\d+)\s*bed/)
  if (m) return parseInt(m[1])
  m = q.match(/(\d+)\s*(?:\+|or more|plus)\s*bed/)
  if (m) return parseInt(m[1])
  m = q.match(/(\d+)[-\s]*bed(?:room)?s?/)
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
    'under', 'least', 'available', 'currently', 'these', 'those', 'some',
    'ken', 'harvey'
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

export async function getRelevantContext(currentText, contextText = currentText) {
  const keywords = extractKeywords(currentText)
  const maxPrice = parseMaxPrice(contextText)   // inherit price from prior turns
  const minBeds = parseMinBeds(contextText)     // inherit bed count from prior turns
  const cityMatch = parseCities(currentText)    // city always from current message only
  const fpFeatures = parseFloorPlanFeatures(contextText)
  const hasStructured = cityMatch || maxPrice || minBeds || fpFeatures.length

  // Detect generic browse intent so we can return count + sample even without filters
  const browseFloorPlans = /floor\s*plans?|floorplans?/i.test(currentText)
  const browseCommunities = /\bcommunities\b|\bcommunity\b/i.test(currentText)
  // "how many homes for sale", "what homes are available", "total listings", "show me listings", etc.
  const browseListings =
    /\bhow many\b[^.?]*\b(?:homes?|houses?|listings?|properties?)\b/i.test(currentText) ||
    /\b(?:total|all)\b[^.?]*\bfor sale\b/i.test(currentText) ||
    /\bfor sale\b[^.?]*\b(?:total|all)\b/i.test(currentText) ||
    /\b(?:homes?|houses?|listings?|properties?)\b[^.?]*\b(?:available|for sale)\b/i.test(currentText) ||
    /\b(?:available|for sale)\b[^.?]*\b(?:homes?|houses?|listings?|properties?)\b/i.test(currentText)

  if (!keywords.length && !hasStructured && !browseFloorPlans && !browseCommunities && !browseListings) return null

  const contexts = []

  // ---- Structured queries: location + price + bedroom + feature filters ----
  if (hasStructured) {
    const cityList = cityMatch?.list ?? []
    const cityIn = cityList.length
      ? `City IN (${cityList.map(c => `'${c.replace(/'/g, "''")}'`).join(',')})`
      : null

    // Active Ken Harvey listings from IDXPlus (primary source for individual homes)
    {
      const invWhereParts = [
        `Status IN ('ACT','PEND','Coming Soon')`,
        cityIn,
        maxPrice ? `Price <= ${maxPrice}` : null,
        minBeds  ? `Bedrooms >= ${minBeds}` : null,
      ].filter(Boolean)
      const invWhere = `WHERE ${invWhereParts.join(' AND ')}`

      const invCount = runQuery(
        `SET NOCOUNT ON; SELECT CAST(COUNT(*) AS nvarchar) FROM vwBuilderProperties_TABLE ${invWhere}`,
        'IDXPlus'
      )
      const invRows = runQuery(
        `SET NOCOUNT ON; SELECT TOP 10 CAST(
          ISNULL(Address,'TBD') +
          CASE WHEN City IS NOT NULL THEN ', ' + City ELSE '' END +
          CASE WHEN State IS NOT NULL THEN ', ' + State ELSE '' END +
          ' | $' + CAST(CAST(Price AS int) AS nvarchar) +
          ' | ' + CAST(ISNULL(Bedrooms,0) AS nvarchar) + ' bed / ' + CAST(ISNULL(Bathrooms,0) AS nvarchar) + ' bath' +
          CASE WHEN SquareFeet > 0 THEN ' / ' + CAST(SquareFeet AS nvarchar) + ' sqft' ELSE '' END +
          CASE WHEN CommunityName IS NOT NULL THEN ' | ' + CommunityName ELSE '' END +
          ' | Status: ' + Status +
          CASE WHEN CompletionDate < '2100-01-01' THEN ' | Est. completion: ' + CONVERT(nvarchar,CompletionDate,101) ELSE '' END +
          CASE WHEN SchoolElem IS NOT NULL THEN ' | Schools: ' + SchoolElem + ' / ' + ISNULL(SchoolJunior,'') + ' / ' + ISNULL(SchoolHigh,'') ELSE '' END
        AS nvarchar(500))
        FROM vwBuilderProperties_TABLE ${invWhere} ORDER BY Price`,
        'IDXPlus'
      )

      const label = [
        cityMatch ? `in/near ${cityMatch.name.replace(/\b\w/g, c => c.toUpperCase())}` : '',
        maxPrice ? `under $${maxPrice.toLocaleString()}` : '',
        minBeds  ? `${minBeds}+ beds` : '',
      ].filter(Boolean).join(', ')

      if (invRows) {
        const total = invCount ? `(${invCount} listings)` : ''
        contexts.push(`Ken Harvey Active Listings ${label} ${total}:\n${invRows}`)
      } else {
        contexts.push(`Ken Harvey Active Listings ${label}: None currently available matching these criteria. You may suggest floor plans and communities as alternatives, but make clear that our available homes start at higher price points than the user requested.`)
      }
    }

    // Communities: city + price filter
    if (cityMatch || maxPrice) {
      const commWhereParts = [
        'PortalID = 38',
        cityIn,
        maxPrice ? `(MinPrice <= ${maxPrice} OR MinPrice IS NULL OR MinPrice = 0)` : null
      ].filter(Boolean)
      const commWhere = `WHERE ${commWhereParts.join(' AND ')}`

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
        contexts.push(`Ken Harvey Communities ${label} ${total}:\n${commRows}`)
      }
    }

    // Floor plans: bedrooms + price + feature flags
    const fpWhereParts = [
      'PortalID = 38',
      minBeds ? `(MinBedrooms >= ${minBeds} OR MaxBedrooms >= ${minBeds})` : null,
      maxPrice ? `(MinPrice <= ${maxPrice} OR MinPrice IS NULL OR MinPrice = 0)` : null,
      ...fpFeatures
    ].filter(Boolean)
    const fpWhere = `WHERE ${fpWhereParts.join(' AND ')}`

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
        fpFeatures.length ? fpFeatures.map(f =>
          f.includes('FirstFloor') ? 'first floor master' :
          f.includes('BonusRoom')  ? 'bonus room' :
          f.includes('Study')      ? 'study' :
          f.includes('Basement')   ? 'basement' : 'feature'
        ).join(', ') : ''
      ].filter(Boolean).join(', ')
      const total = fpCount ? `(${fpCount} floor plans total)` : ''
      contexts.push(`Ken Harvey Floor Plans ${label} ${total}:\n${fpRows}`)
    }
  }

  // ---- Keyword LIKE search for FAQ and text-based queries ----
  if (keywords.length) {
    const faqCond = makeLike(['question', 'answer'], keywords)
    const faqs = runQuery(
      `SET NOCOUNT ON; SELECT TOP 3 CAST('Q: ' + question + CHAR(10) + 'A: ' + answer AS nvarchar(4000)) FROM Admin_tblFAQs WHERE portalid = 38 AND (${faqCond})`
    )
    if (faqs) contexts.push(`Ken Harvey Homes FAQ:\n${faqs}`)

    // Keyword community/floorplan search only when structured filters weren't used
    if (!hasStructured) {
      const commCond = makeLike(['CommunityName', 'City', 'State'], keywords)
      const commKwCount = runQuery(
        `SET NOCOUNT ON; SELECT CAST(COUNT(*) AS nvarchar) FROM Admin_tblCommunities WHERE PortalID = 38 AND (${commCond})`
      )
      const communities = runQuery(
        `SET NOCOUNT ON; SELECT TOP 5 CAST(
          CommunityName + ', ' + ISNULL(City,'') + ', ' + ISNULL(State,'') +
          ' | Price: $' + CAST(ISNULL(MinPrice,0) AS nvarchar) + '-$' + CAST(ISNULL(MaxPrice,0) AS nvarchar)
        AS nvarchar(300)) FROM Admin_tblCommunities WHERE PortalID = 38 AND (${commCond})`
      )
      if (communities) {
        const total = commKwCount ? `${commKwCount} total` : ''
        contexts.push(`Ken Harvey Communities (${total}):\n${communities}`)
      }

      // 'Features' is not a column — only search FloorplanName and Style
      const fpCond = makeLike(['FloorplanName', 'Style'], keywords)
      const fpKwCount = runQuery(
        `SET NOCOUNT ON; SELECT CAST(COUNT(*) AS nvarchar) FROM Admin_tblFloorplans WHERE PortalID = 38 AND (${fpCond})`
      )
      const floorplans = runQuery(
        `SET NOCOUNT ON; SELECT TOP 5 CAST(
          FloorplanName + ' | ' + ISNULL(Style,'') +
          ' | Beds: ' + CAST(ISNULL(MinBedrooms,0) AS nvarchar) +
          ' | SqFt: ' + CAST(ISNULL(MinSquareFeet,0) AS nvarchar) + '-' + CAST(ISNULL(MaxSquareFeet,0) AS nvarchar) +
          ${FP_FEATURE_COLS}
        AS nvarchar(400)) FROM Admin_tblFloorplans WHERE PortalID = 38 AND (${fpCond})`
      )
      if (floorplans) {
        const total = fpKwCount ? `${fpKwCount} total` : ''
        contexts.push(`Ken Harvey Floor Plans (${total}):\n${floorplans}`)
      }
    }
  }

  // ---- Generic browse: user asked about floor plans or communities with no other filters ----
  // Fills the gap when hasStructured is false and keyword LIKE returned nothing.
  if (browseFloorPlans && !contexts.some(c => c.includes('Floor Plan'))) {
    const fpBrowseCount = runQuery(
      `SET NOCOUNT ON; SELECT CAST(COUNT(*) AS nvarchar) FROM Admin_tblFloorplans WHERE PortalID = 38`
    )
    const fpBrowseRows = runQuery(
      `SET NOCOUNT ON; SELECT TOP 5 CAST(
        FloorplanName +
        ' | Beds: ' + CAST(ISNULL(MinBedrooms,0) AS nvarchar) +
          CASE WHEN MaxBedrooms > 0 THEN '-' + CAST(MaxBedrooms AS nvarchar) ELSE '+' END +
        ' | Baths: ' + CAST(ISNULL(MinBaths,0) AS nvarchar) +
        ' | SqFt: ' + CAST(ISNULL(MinSquareFeet,0) AS nvarchar) + '-' + CAST(ISNULL(MaxSquareFeet,0) AS nvarchar) +
        ${FP_FEATURE_COLS}
      AS nvarchar(400)) FROM Admin_tblFloorplans WHERE PortalID = 38 ORDER BY MinBedrooms, MinPrice`
    )
    if (fpBrowseRows) {
      const total = fpBrowseCount ? `${fpBrowseCount} total` : ''
      contexts.push(`Ken Harvey Floor Plans (${total} — sample of 5 shown):\n${fpBrowseRows}`)
    }
  }

  if (browseCommunities && !contexts.some(c => c.includes('Communities'))) {
    const commBrowseCount = runQuery(
      `SET NOCOUNT ON; SELECT CAST(COUNT(*) AS nvarchar) FROM Admin_tblCommunities WHERE PortalID = 38`
    )
    const commBrowseRows = runQuery(
      `SET NOCOUNT ON; SELECT TOP 5 CAST(
        CommunityName + ' (' + ISNULL(City,'') + ', ' + ISNULL(State,'NC') + ')' +
        CASE WHEN MinPrice > 0 THEN ' | From $' + CAST(MinPrice AS nvarchar) ELSE ' | Pricing TBD' END +
        CASE WHEN MaxPrice > 0 THEN ' to $' + CAST(MaxPrice AS nvarchar) ELSE '' END
      AS nvarchar(300)) FROM Admin_tblCommunities WHERE PortalID = 38 ORDER BY City`
    )
    if (commBrowseRows) {
      const total = commBrowseCount ? `${commBrowseCount} total` : ''
      contexts.push(`Ken Harvey Communities (${total} — sample of 5 shown):\n${commBrowseRows}`)
    }
  }

  if (browseListings && !contexts.some(c => c.includes('Active Listings'))) {
    const listBrowseCount = runQuery(
      `SET NOCOUNT ON; SELECT CAST(COUNT(*) AS nvarchar) FROM vwBuilderProperties_TABLE WHERE Status IN ('ACT','PEND','Coming Soon')`,
      'IDXPlus'
    )
    const listBrowseRows = runQuery(
      `SET NOCOUNT ON; SELECT TOP 5 CAST(
        ISNULL(Address,'TBD') +
        CASE WHEN City IS NOT NULL THEN ', ' + City ELSE '' END +
        CASE WHEN State IS NOT NULL THEN ', ' + State ELSE '' END +
        ' | $' + CAST(CAST(Price AS int) AS nvarchar) +
        ' | ' + CAST(ISNULL(Bedrooms,0) AS nvarchar) + ' bed / ' + CAST(ISNULL(Bathrooms,0) AS nvarchar) + ' bath' +
        CASE WHEN SquareFeet > 0 THEN ' / ' + CAST(SquareFeet AS nvarchar) + ' sqft' ELSE '' END +
        CASE WHEN CommunityName IS NOT NULL THEN ' | ' + CommunityName ELSE '' END +
        ' | Status: ' + Status
      AS nvarchar(500)) FROM vwBuilderProperties_TABLE WHERE Status IN ('ACT','PEND','Coming Soon') ORDER BY Price`,
      'IDXPlus'
    )
    if (listBrowseRows) {
      const total = listBrowseCount ? `${listBrowseCount} total` : ''
      contexts.push(`Ken Harvey Active Listings (${total} — sample of 5 shown):\n${listBrowseRows}`)
    } else if (listBrowseCount) {
      contexts.push(`Ken Harvey has ${listBrowseCount} active/pending homes for sale.`)
    }
  }

  return contexts.length ? contexts.join('\n\n') : null
}
