import Dexie from 'dexie'

export const db = new Dexie('ryzosheets')

// Request persistent storage — prevents browser from silently evicting data
if (navigator.storage?.persist) {
  navigator.storage.persist().then(granted => {
    console.log("Persistent storage:", granted ? "granted" : "denied")
  })
}

db.version(2).stores({
  sheets: '++id, name, createdAt, updatedAt, status, deletedAt',
  columns: '++id, sheetId, name, type, position',
  rows: '++id, sheetId, createdAt',
  cells: '++id, rowId, columnId, value'
})

// Migrate existing sheets that don't have status field
async function migrateExistingSheets() {
  const all = await db.sheets.toArray()
    for (const sheet of all) {
        if (!sheet.status) {
              await db.sheets.update(sheet.id, {
                      status: 'active',
                              deletedAt: null
                                    })
                                        }
                                          }
                                          }
                                          migrateExistingSheets()

// — SHEET OPERATIONS —

export async function createSheet(name) {
  const now = Date.now()
  const sheetId = await db.sheets.add({
    name, createdAt: now, updatedAt: now,
    status: 'active', deletedAt: null
  })
  return sheetId
}

export async function getSheets() {
  const all = await db.sheets.orderBy('createdAt').reverse().toArray()
  return all.filter(s => s.status === 'active' || !s.status)
}

export async function getBinSheets() {
  const all = await db.sheets.orderBy('deletedAt').reverse().toArray()
  return all.filter(s => s.status === 'deleted')
}

export async function updateSheetName(sheetId, name) {
  await db.sheets.update(sheetId, { name, updatedAt: Date.now() })
}

export async function softDeleteSheet(sheetId) {
  await db.sheets.update(sheetId, {
    status: 'deleted',
    deletedAt: Date.now()
  })
}

export async function restoreSheet(sheetId) {
  await db.sheets.update(sheetId, {
    status: 'active',
    deletedAt: null
  })
}

export async function permanentlyDeleteSheet(sheetId) {
  const rows = await db.rows.where('sheetId').equals(sheetId).toArray()
  const rowIds = rows.map(r => r.id)
  await db.cells.where('rowId').anyOf(rowIds).delete()
  await db.rows.where('sheetId').equals(sheetId).delete()
  await db.columns.where('sheetId').equals(sheetId).delete()
  await db.sheets.delete(sheetId)
}

export async function cleanupExpiredBinSheets() {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000)
  const all = await db.sheets.toArray()
  const expired = all.filter(s => s.status === 'deleted' && s.deletedAt < thirtyDaysAgo)
  for (const sheet of expired) {
    await permanentlyDeleteSheet(sheet.id)
  }
}

// — COLUMN OPERATIONS —

export async function createColumn(sheetId, name, type, position) {
  const colId = await db.columns.add({ sheetId, name, type, position })
  return colId
}

export async function getColumns(sheetId) {
  return await db.columns.where('sheetId').equals(sheetId).sortBy('position')
}

export async function updateColumn(columnId, changes) {
  await db.columns.update(columnId, changes)
}

export async function deleteColumn(columnId, sheetId) {
  await db.cells.where('columnId').equals(columnId).delete()
  await db.columns.delete(columnId)
  const remaining = await db.columns.where('sheetId').equals(sheetId).sortBy('position')
  for (let i = 0; i < remaining.length; i++) {
    await db.columns.update(remaining[i].id, { position: i })
  }
}

// — ROW OPERATIONS —

export async function createRow(sheetId, cellData) {
  const rowId = await db.rows.add({ sheetId, createdAt: Date.now() })
  for (const [columnId, value] of Object.entries(cellData)) {
    if (String(value).trim()) {
      await db.cells.add({ rowId, columnId: Number(columnId), value: String(value) })
    }
  }
  return rowId
}

export async function insertRow(sheetId, afterRowId, beforeRowId) {
  // Insert a blank row between afterRow and beforeRow
  // If afterRowId is null, insert at the very beginning
  // If beforeRowId is null, insert at the very end
  const allRows = await db.rows
    .where('sheetId').equals(sheetId)
    .sortBy('createdAt')

  let newCreatedAt

  if (!afterRowId) {
    // Insert before first row
    const firstRow = allRows[0]
    newCreatedAt = firstRow ? firstRow.createdAt - 1 : Date.now()
  } else if (!beforeRowId) {
    // Insert after last row
    const lastRow = allRows[allRows.length - 1]
    newCreatedAt = lastRow ? lastRow.createdAt + 1 : Date.now()
  } else {
    const afterRow = allRows.find(r => r.id === afterRowId)
    const beforeRow = allRows.find(r => r.id === beforeRowId)
    if (afterRow && beforeRow) {
      newCreatedAt = Math.floor((afterRow.createdAt + beforeRow.createdAt) / 2)
      if (newCreatedAt === afterRow.createdAt || newCreatedAt === beforeRow.createdAt) {
        // No gap — shift all rows from beforeRow onwards
        const idx = allRows.findIndex(r => r.id === beforeRowId)
        for (let i = idx; i < allRows.length; i++) {
          await db.rows.update(allRows[i].id, { createdAt: allRows[i].createdAt + 2 })
        }
        newCreatedAt = afterRow.createdAt + 1
      }
    } else {
      newCreatedAt = Date.now()
    }
  }

  const rowId = await db.rows.add({ sheetId, createdAt: newCreatedAt })
  return rowId
}

export async function getRows(sheetId) {
  const rawRows = await db.rows.where("sheetId").equals(sheetId).toArray()
  const rows = rawRows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
  for (const row of rows) {
    const cells = await db.cells.where('rowId').equals(row.id).toArray()
    row.cells = {}
    for (const cell of cells) {
      row.cells[cell.columnId] = cell.value
    }
  }
  return rows
}

export async function updateCell(rowId, columnId, value) {
  const existing = await db.cells
    .where('rowId').equals(rowId)
    .and(c => c.columnId === columnId)
    .first()
  if (existing) {
    await db.cells.update(existing.id, { value: String(value) })
  } else {
    await db.cells.add({ rowId, columnId, value: String(value) })
  }
}

export async function deleteRow(rowId, sheetId) {
  await db.cells.where('rowId').equals(rowId).delete()
  await db.rows.delete(rowId)
}

export async function duplicateRow(rowId, sheetId) {
    // Get source row to read its createdAt timestamp
      const sourceRow = await db.rows.get(rowId)
        const cells = await db.cells.where('rowId').equals(rowId).toArray()

          // Get all rows sorted by createdAt to find what comes after source row
            const allRows = await db.rows
                .where('sheetId').equals(sheetId)
                    .sortBy('createdAt')
                      
                        const sourceIndex = allRows.findIndex(r => r.id === rowId)
                          const nextRow = allRows[sourceIndex + 1]

                            // Insert new row's createdAt exactly between source row and the next row
                              // If source is last row, just add 1ms after it
                                let newCreatedAt
                                  if (nextRow) {
                                      newCreatedAt = Math.floor((sourceRow.createdAt + nextRow.createdAt) / 2)
                                          // If there's no gap (timestamps are consecutive), shift all subsequent rows
                                              if (newCreatedAt === sourceRow.createdAt || newCreatedAt === nextRow.createdAt) {
                                                    // Shift every row after source by 2ms to make room
                                                          for (let i = sourceIndex + 1; i < allRows.length; i++) {
                                                                  await db.rows.update(allRows[i].id, { createdAt: allRows[i].createdAt + 2 })
                                                                        }
                                                                              newCreatedAt = sourceRow.createdAt + 1
                                                                                  }
                                                                                    } else {
                                                                                        newCreatedAt = sourceRow.createdAt + 1
                                                                                          }

                                                                                            const newRowId = await db.rows.add({ sheetId, createdAt: newCreatedAt })
                                                                                              for (const cell of cells) {
                                                                                                  await db.cells.add({ rowId: newRowId, columnId: cell.columnId, value: cell.value })
                                                                                                    }
                                                                                                      return newRowId
                                                                                                      }

// — FREE TIER LIMIT CHECKS —

export const FREE_LIMITS = {
  sheets: 5,
  rowsPerSheet: 100
}

export async function canCreateSheet() {
    const all = await db.sheets.toArray()
      const activeCount = all.filter(s => s.status === 'active').length
        return activeCount < FREE_LIMITS.sheets
       }

export async function canAddRow(sheetId) {
  const count = await db.rows.where('sheetId').equals(sheetId).count()
  return count < FREE_LIMITS.rowsPerSheet
}
