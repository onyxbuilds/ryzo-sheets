import { supabase } from './supabase'

// Convert integer ID to stable UUID format
function intToUUID(id) {
  const hex = id.toString(16).padStart(12, '0')
  return `00000000-0000-4000-8000-${hex}`
}

// Convert UUID back to integer for Dexie
function uuidToInt(uuid) {
  if (!uuid) return Date.now()
  // Use 13 hex chars (52 bits) — max safe integer range, lower collision risk than 12
  const hex = uuid.replace(/-/g, '').slice(-13)
  return parseInt(hex, 16) || Date.now()
}

// Push local Dexie data to Supabase — batched for speed
export async function syncToCloud(userId, db) {
  try {
    const sheets = await db.sheets.toArray()
    if (!sheets.length) return

    // Batch upsert all sheets at once
    const sheetRows = sheets.map(sheet => ({
      id: intToUUID(sheet.id),
      user_id: userId,
      name: sheet.name,
      created_at: sheet.createdAt,
      updated_at: sheet.updatedAt,
      status: sheet.status || 'active',
      deleted_at: sheet.deletedAt || null
    }))

    const { error: sheetsError } = await supabase.from('sheets').upsert(sheetRows)
    if (sheetsError) { console.error('Sheets sync error:', sheetsError); return }

    // Batch upsert all columns at once
    const allColumns = await db.columns.toArray()
    if (allColumns.length) {
      const columnRows = allColumns.map(col => ({
        id: intToUUID(col.id),
        sheet_id: intToUUID(col.sheetId),
        name: col.name,
        type: col.type,
        position: col.position
      }))
      const { error: colsError } = await supabase.from('columns').upsert(columnRows)
      if (colsError) { console.error('Columns sync error:', colsError); return }
    }

    // Batch upsert all rows at once
    const allRows = await db.rows.toArray()
    if (allRows.length) {
      const rowRows = allRows.map(row => ({
        id: intToUUID(row.id),
        sheet_id: intToUUID(row.sheetId),
        created_at: row.createdAt
      }))
      const { error: rowsError } = await supabase.from('rows').upsert(rowRows)
      if (rowsError) { console.error('Rows sync error:', rowsError); return }
    }

    // Batch upsert all cells at once
    const allCells = await db.cells.toArray()
    if (allCells.length) {
      const cellRows = allCells.map(cell => ({
        id: intToUUID(cell.id),
        row_id: intToUUID(cell.rowId),
        column_id: intToUUID(cell.columnId),
        value: cell.value
      }))
      // Split into chunks of 500 to avoid payload limits
      const chunkSize = 500
      for (let i = 0; i < cellRows.length; i += chunkSize) {
        const chunk = cellRows.slice(i, i + chunkSize)
        const { error: cellsError } = await supabase.from('cells').upsert(chunk)
        if (cellsError) console.error('Cells sync error:', cellsError)
      }
    }

    console.log('Sync complete —', sheets.length, 'sheets,', allRows.length, 'rows,', allCells.length, 'cells')
  } catch (e) {
    console.error('Sync failed:', e)
  }
}

// Pull data from Supabase into local Dexie
export async function syncFromCloud(userId, db) {
  try {
    const { data: sheets, error } = await supabase
      .from('sheets')
      .select('*')
      .eq('user_id', userId)

    if (error) { console.error('Sync error:', error); return false }
    if (!sheets?.length) {
      const localSheets = await db.sheets.toArray()
      if (localSheets.length > 0) await syncToCloud(userId, db)
      return false
    }

    const sheetIds = sheets.map(s => s.id)

    // Fetch all data in parallel — one call per table, not per sheet
    const [
      { data: columns, error: colsError },
      { data: rows, error: rowsError }
    ] = await Promise.all([
      supabase.from('columns').select('*').in('sheet_id', sheetIds),
      supabase.from('rows').select('*').in('sheet_id', sheetIds)
    ])

    if (colsError || rowsError) {
      console.error('Sync error fetching data:', colsError || rowsError)
      return false
    }

    const rowIds = (rows || []).map(r => r.id)

    // Fetch cells in chunks to avoid URL length limits
    let cells = []
    const chunkSize = 100
    for (let i = 0; i < rowIds.length; i += chunkSize) {
      const chunk = rowIds.slice(i, i + chunkSize)
      const { data } = await supabase.from('cells').select('*').in('row_id', chunk)
      if (data) cells = cells.concat(data)
    }

    await db.transaction('rw', [db.sheets, db.columns, db.rows, db.cells], async () => {
      await db.sheets.clear()
      await db.columns.clear()
      await db.rows.clear()
      await db.cells.clear()

      await db.sheets.bulkAdd(sheets.map(s => ({
        id: uuidToInt(s.id),
        name: s.name,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        status: s.status || 'active',
        deletedAt: s.deleted_at || null
      })))

      if (columns?.length) {
        await db.columns.bulkAdd(columns.map(c => ({
          id: uuidToInt(c.id),
          sheetId: uuidToInt(c.sheet_id),
          name: c.name,
          type: c.type,
          position: c.position
        })))
      }

      if (rows?.length) {
        await db.rows.bulkAdd(rows.map(r => ({
          id: uuidToInt(r.id),
          sheetId: uuidToInt(r.sheet_id),
          createdAt: r.created_at
        })))
      }

      if (cells.length) {
        await db.cells.bulkAdd(cells.map(c => ({
          id: uuidToInt(c.id),
          rowId: uuidToInt(c.row_id),
          columnId: uuidToInt(c.column_id),
          value: c.value
        })))
      }
    })

    return true
  } catch (e) {
    console.error('syncFromCloud failed:', e)
    return false
  }
}
