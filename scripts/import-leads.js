// Reads all pending lead files from leads/ and upserts them into
// ProspectsRevealed.admin_usermessages via sqlcmd (Windows Auth).
// Successfully imported files are moved to leads/imported/.
//
// Usage: node scripts/import-leads.js
// Prerequisite: ALTER TABLE admin_usermessages ADD phone VARCHAR(50) NULL

const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const LEADS_DIR = path.join(__dirname, '..', 'leads')
const IMPORTED_DIR = path.join(LEADS_DIR, 'imported')

function runSql(sql) {
  const result = spawnSync(
    'sqlcmd',
    ['-S', 'localhost\\SQLEXPRESS', '-d', 'ProspectsRevealed', '-No', '-C', '-h', '-1', '-Q', sql],
    { encoding: 'utf8', timeout: 10000, windowsHide: true }
  )
  if (result.error) throw new Error(`sqlcmd spawn error: ${result.error.message}`)
  if (result.status !== 0) throw new Error(`sqlcmd error: ${result.stderr || result.stdout}`)
}

function parseLeadFile(content) {
  const lead = {}
  for (const line of content.split('\n')) {
    const match = line.match(/^- (\w+):\s*(.*)$/)
    if (match) lead[match[1]] = match[2].trim()
  }
  return lead
}

function esc(v) {
  return (v ?? '').replace(/'/g, "''").substring(0, 499)
}

function toVal(v) {
  const s = (v ?? '').trim()
  return s ? `'${esc(s)}'` : 'NULL'
}

function buildUpsert(lead) {
  const { uniqueID, PRClientID, usertype, ipaddress, email, phone, message, URL, viewed, emailed, valid, guid, modifieddate } = lead
  return `
IF EXISTS (SELECT 1 FROM admin_usermessages WHERE uniqueID = '${esc(uniqueID)}')
  UPDATE admin_usermessages SET
    email        = COALESCE(${toVal(email)}, email),
    phone        = COALESCE(${toVal(phone)}, phone),
    ipaddress    = COALESCE(${toVal(ipaddress)}, ipaddress),
    modifieddate = GETDATE()
  WHERE uniqueID = '${esc(uniqueID)}'
ELSE
  INSERT INTO admin_usermessages
    (uniqueID, PRClientID, usertype, ipaddress, email, phone, message, URL, viewed, emailed, valid, guid, modifieddate)
  VALUES
    (${toVal(uniqueID)}, ${toVal(PRClientID)}, ${toVal(usertype)}, ${toVal(ipaddress)},
     ${toVal(email)}, ${toVal(phone)}, ${toVal(message)},
     ${toVal(URL)}, ${viewed ?? 0}, ${emailed ?? 0}, ${valid ?? 1},
     ${toVal(guid)}, GETDATE())
`
}

function main() {
  if (!fs.existsSync(LEADS_DIR)) {
    console.log('No leads/ directory found — nothing to import.')
    return
  }
  if (!fs.existsSync(IMPORTED_DIR)) fs.mkdirSync(IMPORTED_DIR)

  const files = fs.readdirSync(LEADS_DIR).filter(f => f.endsWith('.md'))

  if (files.length === 0) {
    console.log('No pending lead files found.')
    return
  }

  console.log(`Found ${files.length} lead file(s) to import.\n`)

  let succeeded = 0
  let failed = 0

  for (const file of files) {
    const filePath = path.join(LEADS_DIR, file)
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const lead = parseLeadFile(content)

      if (!lead.uniqueID) {
        console.warn(`  SKIP  ${file} — missing uniqueID`)
        failed++
        continue
      }

      const sql = buildUpsert(lead)
      runSql(sql)

      fs.renameSync(filePath, path.join(IMPORTED_DIR, file))
      console.log(`  OK    ${file}  (${lead.email || lead.phone || 'no contact'})`)
      succeeded++
    } catch (err) {
      console.error(`  FAIL  ${file} — ${err.message}`)
      failed++
    }
  }

  console.log(`\nDone. ${succeeded} imported, ${failed} failed.`)
}

main()
