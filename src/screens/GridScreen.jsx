// GridScreen.jsx — Optimized spreadsheet view

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useTheme } from '../theme'
import BottomSheet from '../components/BottomSheet'
import ConfirmDialog from '../components/ConfirmDialog'
import Paywall from '../components/Paywall'
import Cell from '../components/Cell'
import {
  getColumns, getRows, createColumn, updateColumn,
  deleteColumn, createRow, insertRow, updateCell, deleteRow,
  duplicateRow, updateSheetName, canAddRow, db
} from '../db'
import { exportToCSV, exportToPDF, parseCSV } from '../utils/export'
import { syncToCloud } from '../sync'
import { getLimitMessage } from '../utils/limits'
import { supabase } from '../supabase'

// ── Ryzo design tokens — exact match to landing page
const D = {
  black:        '#080809',
  surface:      '#0f0f11',
  surface2:     '#16161a',
  surface3:     '#1e1e24',
  border:       '#2a2a35',
  white:        '#f8f8fc',
  white60:      'rgba(248,248,252,0.6)',
  white30:      'rgba(248,248,252,0.3)',
  white10:      'rgba(248,248,252,0.08)',
  indigo:       '#6366f1',
  indigoBright: '#818cf8',
  indigoDim:    '#3730a3',
  green:        '#34d399',
  red:          '#f87171',
  redDim:       'rgba(248,113,113,0.1)',
}

const MAX_HISTORY = 50

export default function GridScreen({ sheet, onBack, onUpgrade, user, isPro }) {
  const { isDark } = useTheme()
  const dark = isDark

  const [columns, setColumns] = useState([])
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  const [editingName, setEditingName] = useState(false)
  const [sheetName, setSheetName] = useState(sheet.name)

  const [showAddRow, setShowAddRow] = useState(false)
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [editingColumn, setEditingColumn] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [rowMenu, setRowMenu] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [sortConfig, setSortConfig] = useState(null)

  const [confirm, setConfirm] = useState(null)
  const [paywall, setPaywall] = useState(null)

  const [newColumn, setNewColumn] = useState({ name: '', type: 'text' })
  const [editColData, setEditColData] = useState(null)

  const [history, setHistory] = useState([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const isUndoRedoing = useRef(false)

  const headerRef = useRef(null)
  const bodyRef = useRef(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const [cols, rws] = await Promise.all([
      getColumns(sheet.id),
      getRows(sheet.id)
    ])
    setColumns(cols)
    setRows(rws)
    setLoading(false)
  }

  async function saveSheetName() {
    if (sheetName.trim()) await updateSheetName(sheet.id, sheetName.trim())
    setEditingName(false)
  }

  const handleCellSave = useCallback(async (rowId, colId, value) => {
    const oldValue = rows.find(r => r.id === rowId)?.cells?.[colId] || ''
    setRows(prev => prev.map(row => {
      if (row.id !== rowId) return row
      return { ...row, cells: { ...row.cells, [colId]: value } }
    }))
    try {
      await updateCell(rowId, colId, value)
      if (user) syncToCloud(user.id, db)
      if (!isUndoRedoing.current && value !== oldValue) {
        setHistory(prev => {
          const newHistory = prev.slice(0, historyIndex + 1)
          newHistory.push({ rowId, colId, oldValue, newValue: value })
          if (newHistory.length > MAX_HISTORY) newHistory.shift()
          return newHistory
        })
        setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1))
      }
    } catch (e) { loadData() }
  }, [user, rows, historyIndex])

  async function handleUndo() {
    if (historyIndex < 0) return
    const entry = history[historyIndex]
    isUndoRedoing.current = true
    await updateCell(entry.rowId, entry.colId, entry.oldValue)
    setRows(prev => prev.map(row => {
      if (row.id !== entry.rowId) return row
      return { ...row, cells: { ...row.cells, [entry.colId]: entry.oldValue } }
    }))
    setHistoryIndex(prev => prev - 1)
    if (user) syncToCloud(user.id, db)
    isUndoRedoing.current = false
  }

  async function handleRedo() {
    if (historyIndex >= history.length - 1) return
    const entry = history[historyIndex + 1]
    isUndoRedoing.current = true
    await updateCell(entry.rowId, entry.colId, entry.newValue)
    setRows(prev => prev.map(row => {
      if (row.id !== entry.rowId) return row
      return { ...row, cells: { ...row.cells, [entry.colId]: entry.newValue } }
    }))
    setHistoryIndex(prev => prev + 1)
    if (user) syncToCloud(user.id, db)
    isUndoRedoing.current = false
  }

  async function handleAddRow(formData) {
    const ok = await canAddRow(sheet.id)
    if (!ok) { setShowAddRow(false); setPaywall('rows'); return }
    await createRow(sheet.id, formData)
    if (user) syncToCloud(user.id, db)
    await loadData()
  }

  async function handleDeleteRow(rowId) {
    setConfirm({
      message: 'Delete this row?',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setRows(prev => prev.filter(r => r.id !== rowId))
        setConfirm(null)
        await deleteRow(rowId, sheet.id)
        if (user) syncToCloud(user.id, db)
      },
      onCancel: () => setConfirm(null)
    })
  }

  async function handleDuplicateRow(rowId) {
    const ok = await canAddRow(sheet.id)
    if (!ok) { setPaywall('rows'); return }
    await duplicateRow(rowId, sheet.id)
    if (user) syncToCloud(user.id, db)
    await loadData()
  }

  async function handleInsertRow(rowId, position) {
    const ok = await canAddRow(sheet.id)
    if (!ok) { setPaywall('rows'); return }
    const allRows = [...rows].sort((a, b) => a.createdAt - b.createdAt)
    const idx = allRows.findIndex(r => r.id === rowId)
    if (position === 'above') {
      const afterRowId = idx > 0 ? allRows[idx - 1].id : null
      await insertRow(sheet.id, afterRowId, rowId)
    } else {
      const beforeRowId = idx < allRows.length - 1 ? allRows[idx + 1].id : null
      await insertRow(sheet.id, rowId, beforeRowId)
    }
    if (user) syncToCloud(user.id, db)
    await loadData()
    setRowMenu(null)
  }

  async function handleUpdateColumn() {
    if (!editColData?.name.trim()) return
    await updateColumn(editColData.id, { name: editColData.name, type: editColData.type })
    await loadData()
    setEditingColumn(null)
    setEditColData(null)
  }

  async function handleDeleteColumn(colId) {
    if (columns.length === 1) return
    setConfirm({
      message: `Delete column "${editColData?.name}"? All data in this column will be lost.`,
      confirmLabel: 'Delete Column',
      onConfirm: async () => {
        await deleteColumn(colId, sheet.id)
        await loadData()
        setEditingColumn(null)
        setEditColData(null)
        setConfirm(null)
      },
      onCancel: () => setConfirm(null)
    })
  }

  async function handleInsertColumnLeft() {
    const idx = columns.findIndex(c => c.id === editColData.id)
    for (let i = columns.length - 1; i >= idx; i--) {
      await updateColumn(columns[i].id, { position: i + 1 })
    }
    await createColumn(sheet.id, 'New Column', 'text', idx)
    await loadData()
    setEditingColumn(null)
    setEditColData(null)
  }

  async function handleInsertColumnRight() {
    const idx = columns.findIndex(c => c.id === editColData.id)
    for (let i = columns.length - 1; i > idx; i--) {
      await updateColumn(columns[i].id, { position: i + 1 })
    }
    await createColumn(sheet.id, 'New Column', 'text', idx + 1)
    await loadData()
    setEditingColumn(null)
    setEditColData(null)
  }

  function handleSort(colId) {
    setSortConfig(prev => {
      if (prev?.colId === colId) {
        return prev.dir === 'asc' ? { colId, dir: 'desc' } : null
      }
      return { colId, dir: 'asc' }
    })
  }

  function handleBodyScroll(e) {
    if (headerRef.current) {
      headerRef.current.scrollLeft = e.target.scrollLeft
    }
  }

  async function handleCSVImport(e) {
    const file = e.target.files[0]
    if (!file) return
    const text = await file.text()
    const parsed = parseCSV(text)
    if (!parsed) return
    const { headers, rows: csvRows } = parsed

    if (columns.length === 0 || rows.length === 0) {
      await importFresh(headers, csvRows)
      if (user) syncToCloud(user.id, db)
      await loadData()
      setShowMoreMenu(false)
      return
    }

    const existingNames = columns.map(c => c.name.toLowerCase().trim())
    const csvNames = headers.map(h => h.toLowerCase().trim())
    const headersMatch = csvNames.every(h => existingNames.includes(h))

    if (headersMatch) {
      setConfirm({
        message: `CSV columns match this sheet.\n\nAppend adds rows at the bottom.\nReplace All clears all existing data first.`,
        confirmLabel: 'Append Rows',
        secondaryLabel: 'Replace All',
        onConfirm: async () => {
          setConfirm(null)
          for (const csvRow of csvRows) {
            const cellData = {}
            columns.forEach(col => {
              const match = headers.find(h => h.toLowerCase().trim() === col.name.toLowerCase().trim())
              if (match) cellData[col.id] = csvRow[match] || ''
            })
            await createRow(sheet.id, cellData)
          }
          if (user) syncToCloud(user.id, db)
          await loadData()
          setShowMoreMenu(false)
        },
        onSecondary: async () => {
          setConfirm(null)
          await importFresh(headers, csvRows)
          if (user) syncToCloud(user.id, db)
          await loadData()
          setShowMoreMenu(false)
        },
        onCancel: () => setConfirm(null)
      })
    } else {
      setConfirm({
        message: `CSV columns don't match this sheet.\n\n• "Add as New Columns" keeps your existing data and adds CSV data as new columns.\n• "Replace All" clears all data and imports fresh.\n\nEnter the row number to start populating from:`,
        confirmLabel: 'Add as New Columns',
        secondaryLabel: 'Replace All',
        startRow: 1,
        onConfirm: async (startRow = 1) => {
          setConfirm(null)
          const startIndex = Math.max(0, (parseInt(startRow) || 1) - 1)
          const newColIds = []
          for (let i = 0; i < headers.length; i++) {
            const colId = await createColumn(sheet.id, headers[i], 'text', columns.length + i)
            newColIds.push(colId)
          }
          const allRows = [...rows].sort((a, b) => a.createdAt - b.createdAt)
          for (let i = 0; i < csvRows.length; i++) {
            const cellData = {}
            headers.forEach((header, j) => {
              cellData[newColIds[j]] = csvRows[i][header] || ''
            })
            const targetRowIndex = startIndex + i
            if (targetRowIndex < allRows.length) {
              for (const [colId, value] of Object.entries(cellData)) {
                await updateCell(allRows[targetRowIndex].id, colId, value)
              }
            } else {
              await createRow(sheet.id, cellData)
            }
          }
          if (user) syncToCloud(user.id, db)
          await loadData()
          setShowMoreMenu(false)
        },
        onSecondary: async () => {
          setConfirm(null)
          await importFresh(headers, csvRows)
          if (user) syncToCloud(user.id, db)
          await loadData()
          setShowMoreMenu(false)
        },
        onCancel: () => setConfirm(null)
      })
    }
  }

  async function importFresh(headers, csvRows) {
    for (const col of columns) await deleteColumn(col.id, sheet.id)
    const newColIds = []
    for (let i = 0; i < headers.length; i++) {
      const colId = await createColumn(sheet.id, headers[i], 'text', i)
      newColIds.push(colId)
    }
    for (const csvRow of csvRows) {
      const cellData = {}
      headers.forEach((header, i) => { cellData[newColIds[i]] = csvRow[header] || '' })
      await createRow(sheet.id, cellData)
    }
  }

  async function handleShare() {
    const csvContent = columns.map(c => c.name).join(',') + '\n' +
      rows.map(row =>
        columns.map(col => {
          const val = String(row.cells?.[col.id] || '')
          return val.includes(',') ? `"${val}"` : val
        }).join(',')
      ).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const file = new File([blob], `${sheet.name}.csv`, { type: 'text/csv' })
    if (navigator.share && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ title: sheet.name, files: [file] }) }
      catch (e) { if (e.name !== 'AbortError') exportToCSV(sheet, columns, rows) }
    } else if (navigator.share) {
      try { await navigator.share({ title: sheet.name, text: `${sheet.name} — ${rows.length} rows` }) }
      catch (e) { if (e.name !== 'AbortError') exportToCSV(sheet, columns, rows) }
    } else {
      exportToCSV(sheet, columns, rows)
    }
  }

  const displayRows = useMemo(() => {
    let result = [...rows]
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(row =>
        columns.some(col => String(row.cells?.[col.id] || '').toLowerCase().includes(q))
      )
    }
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a.cells?.[sortConfig.colId] || ''
        const bVal = b.cells?.[sortConfig.colId] || ''
        const aNum = parseFloat(aVal)
        const bNum = parseFloat(bVal)
        const isNumeric = !isNaN(aNum) && !isNaN(bNum)
        if (isNumeric) return sortConfig.dir === 'asc' ? aNum - bNum : bNum - aNum
        return sortConfig.dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      })
    }
    return result
  }, [rows, columns, searchQuery, sortConfig])

  const canUndo = historyIndex >= 0
  const canRedo = historyIndex < history.length - 1

  // Theme-aware values
  const bg =        dark ? D.black    : '#f4f4f8'
  const surface =   dark ? D.surface  : '#ffffff'
  const surface2 =  dark ? D.surface2 : '#f4f4f8'
  const surface3 =  dark ? D.surface3 : '#eaeaef'
  const border =    dark ? D.border   : '#e5e5ea'
  const textPri =   dark ? D.white    : '#111111'
  const textSec =   dark ? D.white60  : '#666666'
  const textDim =   dark ? D.white30  : '#aaaaaa'

  if (loading) {
    return (
      <div style={{ height: '100dvh', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '2rem', opacity: 0.3 }}>◎</div>
      </div>
    )
  }

  return (
    <div style={{ height: '100dvh', background: bg, color: textPri, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: "'DM Sans', sans-serif" }}>

      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={confirm.onCancel}
          onSecondary={confirm.onSecondary}
          confirmLabel={confirm.confirmLabel}
          secondaryLabel={confirm.secondaryLabel}
        >
          {confirm.startRow !== undefined && (
            <input
              type="number"
              min="1"
              max={rows.length}
              defaultValue={1}
              onChange={e => { confirm.startRow = parseInt(e.target.value) || 1 }}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: dark ? D.surface3 : '#f4f4f8',
                border: `1px solid ${border}`,
                borderRadius: '8px',
                padding: '12px',
                fontSize: '1rem',
                color: textPri,
                outline: 'none',
                fontFamily: "'DM Sans', sans-serif"
              }}
              placeholder={`Row number (1 to ${rows.length})`}
            />
          )}
        </ConfirmDialog>
      )}

      {paywall && (
        <Paywall
          message={getLimitMessage(paywall)}
          onClose={() => setPaywall(null)}
          onUpgrade={() => { setPaywall(null); onUpgrade() }}
          userEmail={user?.email}
          userId={user?.id}
        />
      )}

      {/* ── Header */}
      <div style={{
        background: surface,
        borderBottom: `1px solid ${border}`,
        padding: '12px 14px',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>

          {/* Back button */}
          <button
            onPointerDown={onBack}
            style={{
              width: '40px', height: '40px', flexShrink: 0,
              background: surface3,
              border: `1px solid ${border}`,
              borderRadius: '8px',
              color: textPri,
              fontSize: '1.1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontWeight: 700
            }}
          >←</button>

          {/* Sheet name */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {editingName ? (
              <input
                autoFocus
                type="text"
                value={sheetName}
                onChange={e => setSheetName(e.target.value)}
                onBlur={saveSheetName}
                onKeyDown={e => e.key === 'Enter' && saveSheetName()}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: surface3,
                  border: `1px solid ${D.indigo}`,
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '0.95rem',
                  color: textPri,
                  outline: 'none',
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: 600
                }}
              />
            ) : (
              <button
                onPointerDown={() => setEditingName(true)}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  display: 'flex', alignItems: 'center', gap: '6px',
                  cursor: 'pointer', width: '100%', textAlign: 'left'
                }}
              >
                <span style={{ fontWeight: 600, fontSize: '0.95rem', color: textPri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sheetName}
                </span>
                <span style={{ fontSize: '0.65rem', color: D.indigoBright, border: `1px solid rgba(129,140,248,0.3)`, background: 'rgba(99,102,241,0.08)', borderRadius: '4px', padding: '2px 6px', flexShrink: 0 }}>
                  edit
                </span>
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>

            {/* Undo */}
            <HdrBtn dark={dark} disabled={!canUndo} onPointerDown={handleUndo} title="Undo">↩</HdrBtn>

            {/* Redo */}
            <HdrBtn dark={dark} disabled={!canRedo} onPointerDown={handleRedo} title="Redo">↪</HdrBtn>

            {/* Search */}
            <HdrBtn dark={dark} active={showSearch} onPointerDown={() => { setShowSearch(s => !s); setShowMoreMenu(false) }} title="Search">⌕</HdrBtn>

            {/* Share */}
            <HdrBtn dark={dark} onPointerDown={handleShare} title="Share">↗</HdrBtn>

            {/* More */}
            <div style={{ position: 'relative' }}>
              <HdrBtn dark={dark} active={showMoreMenu} onPointerDown={() => { setShowMoreMenu(m => !m); setShowSearch(false) }} title="More">⋯</HdrBtn>

              {showMoreMenu && (
                <div
                  style={{
                    position: 'absolute', right: 0, top: '44px',
                    background: dark ? D.surface2 : '#fff',
                    border: `1px solid ${border}`,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    minWidth: '180px',
                    zIndex: 50
                  }}
                  onPointerDown={e => e.stopPropagation()}
                >
                  {[
                    { label: 'Export CSV', icon: '⬇', action: () => { exportToCSV(sheet, columns, rows); setShowMoreMenu(false) } },
                    { label: 'Export PDF', icon: '⬇', action: () => { exportToPDF(sheet, columns, rows); setShowMoreMenu(false) } },
                    { label: 'Export Excel', icon: '⬇', action: () => { setPaywall('excelExport'); setShowMoreMenu(false) }, pro: true },
                  ].map((item, i) => (
                    <button
                      key={i}
                      onPointerDown={item.action}
                      style={{
                        width: '100%', textAlign: 'left',
                        padding: '13px 16px',
                        background: 'none',
                        border: 'none',
                        borderBottom: i < 2 ? `1px solid ${border}` : 'none',
                        color: textPri,
                        fontSize: '0.85rem',
                        fontFamily: "'DM Sans', sans-serif",
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px'
                      }}
                    >
                      <span>{item.icon} {item.label}</span>
                      {item.pro && (
                        <span style={{ fontSize: '0.65rem', background: D.indigo, color: '#fff', borderRadius: '4px', padding: '2px 6px' }}>Pro</span>
                      )}
                    </button>
                  ))}
                  <label
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '13px 16px',
                      borderTop: `1px solid ${border}`,
                      color: textPri,
                      fontSize: '0.85rem',
                      fontFamily: "'DM Sans', sans-serif",
                      cursor: 'pointer'
                    }}
                  >
                    ⬆ Import CSV
                    <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCSVImport} />
                  </label>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div style={{ marginTop: '10px', position: 'relative' }}>
            <input
              autoFocus
              type="text"
              placeholder="Search in sheet..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: surface3,
                border: `1px solid ${border}`,
                borderRadius: '8px',
                padding: '10px 36px 10px 14px',
                fontSize: '0.85rem',
                color: textPri,
                outline: 'none',
                fontFamily: "'DM Sans', sans-serif"
              }}
            />
            {searchQuery.length > 0 && (
              <button
                onPointerDown={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: textSec, fontSize: '1.1rem', cursor: 'pointer'
                }}
              >×</button>
            )}
          </div>
        )}

        {/* Row count + sort */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
          <span style={{ fontSize: '0.7rem', color: textSec }}>
            {displayRows.length} {searchQuery ? 'results' : 'rows'}
            {rows.length >= 100 && <span style={{ color: D.yellow, marginLeft: '6px' }}>· 100 row limit</span>}
          </span>
          {sortConfig && (
            <button
              onPointerDown={() => setSortConfig(null)}
              style={{ background: 'none', border: 'none', color: D.indigoBright, fontSize: '0.72rem', cursor: 'pointer' }}
            >Clear sort ×</button>
          )}
        </div>
      </div>

      {/* ── Grid */}
      <div
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onPointerDown={() => { setShowMoreMenu(false); setRowMenu(null) }}
      >
        {/* Frozen header */}
        <div ref={headerRef} style={{ background: surface2, flexShrink: 0, overflowX: 'hidden' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: '100%', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '52px', minWidth: '52px' }} />
              {columns.map(col => <col key={col.id} style={{ width: '140px', minWidth: '140px' }} />)}
              <col style={{ width: '64px', minWidth: '64px' }} />
            </colgroup>
            <thead>
              <tr>
                <th style={{
                  padding: '10px 8px', textAlign: 'left',
                  fontSize: '0.68rem', fontWeight: 600,
                  color: textSec,
                  borderBottom: `1px solid ${border}`,
                  background: surface2
                }}>#</th>
                {columns.map((col, colIndex) => (
                  <th key={col.id} style={{
                    padding: '10px 14px', textAlign: 'left',
                    fontSize: '0.72rem', fontWeight: 600,
                    borderLeft: `1px solid ${border}`,
                    borderBottom: `1px solid ${border}`,
                    background: surface2
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <button
                        onPointerDown={() => handleSort(col.id)}
                        style={{
                          background: 'none', border: 'none', padding: 0,
                          display: 'flex', alignItems: 'center', gap: '4px',
                          cursor: 'pointer', flex: 1, textAlign: 'left', overflow: 'hidden'
                        }}
                      >
                        <span style={{ color: textPri, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {String.fromCharCode(65 + colIndex)} — {col.name}
                        </span>
                        <span style={{ color: textDim, flexShrink: 0, fontSize: '0.65rem' }}>
                          {col.type === 'number' ? '#' : col.type === 'date' ? '◷' : 'A'}
                        </span>
                        {sortConfig?.colId === col.id && (
                          <span style={{ color: D.indigoBright, flexShrink: 0 }}>
                            {sortConfig.dir === 'asc' ? '↑' : '↓'}
                          </span>
                        )}
                      </button>
                      <button
                        onPointerDown={() => { setEditingColumn(col); setEditColData({ ...col }) }}
                        style={{
                          background: 'none', border: 'none',
                          color: D.indigoBright, fontSize: '0.75rem',
                          cursor: 'pointer', padding: '2px 4px', flexShrink: 0
                        }}
                      >✎</button>
                    </div>
                  </th>
                ))}
                <th style={{
                  padding: '10px 8px',
                  borderLeft: `1px solid ${border}`,
                  borderBottom: `1px solid ${border}`,
                  background: surface2
                }}>
                  <button
                    onPointerDown={() => setShowAddColumn(true)}
                    style={{
                      background: 'none', border: 'none',
                      color: D.indigoBright, fontSize: '0.72rem', fontWeight: 600,
                      cursor: 'pointer', whiteSpace: 'nowrap'
                    }}
                  >+ Col</button>
                </th>
              </tr>
            </thead>
          </table>
        </div>

        {/* Scrollable body */}
        <div
          ref={bodyRef}
          style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}
          onScroll={handleBodyScroll}
        >
          <table style={{ borderCollapse: 'collapse', minWidth: '100%', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '52px', minWidth: '52px' }} />
              {columns.map(col => <col key={col.id} style={{ width: '140px', minWidth: '140px' }} />)}
              <col style={{ width: '64px', minWidth: '64px' }} />
            </colgroup>
            <tbody>
              {displayRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 2} style={{ textAlign: 'center', padding: '80px 0', color: textSec, fontSize: '0.85rem' }}>
                    {searchQuery ? 'No results found' : 'No rows yet — tap + to add data'}
                  </td>
                </tr>
              )}

              {displayRows.map((row, index) => (
                <tr key={row.id} style={{ borderBottom: `1px solid ${border}` }}>
                  {/* Row number + actions */}
                  <td style={{
                    padding: '8px 4px',
                    background: surface2,
                    position: 'sticky', left: 0, zIndex: 10,
                    borderRight: `1px solid ${border}`
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '0.65rem', color: textDim, fontFamily: "'DM Mono', monospace" }}>
                        {index + 1}
                      </span>
                      <button
                        onPointerDown={e => {
                          e.stopPropagation()
                          setRowMenu(rowMenu?.rowId === row.id ? null : { rowId: row.id, index })
                        }}
                        style={{
                          width: '24px', height: '24px',
                          background: surface3,
                          border: `1px solid ${border}`,
                          borderRadius: '4px',
                          color: textSec, fontSize: '0.8rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >⋮</button>
                    </div>

                    {/* Row menu */}
                    {rowMenu?.rowId === row.id && (
                      <div
                        style={{
                          position: 'absolute', left: '52px', zIndex: 50,
                          background: dark ? D.surface2 : '#fff',
                          border: `1px solid ${border}`,
                          borderRadius: '10px',
                          overflow: 'hidden',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                          minWidth: '160px',
                          top: index < 3 ? '0' : 'auto',
                          bottom: index < 3 ? 'auto' : '0'
                        }}
                        onPointerDown={e => e.stopPropagation()}
                      >
                        {[
                          { label: '↑  Insert Above', action: () => handleInsertRow(row.id, 'above') },
                          { label: '↓  Insert Below', action: () => handleInsertRow(row.id, 'below') },
                          { label: '⧉  Duplicate', action: () => { handleDuplicateRow(row.id); setRowMenu(null) } },
                          { label: '×  Delete Row', action: () => { handleDeleteRow(row.id); setRowMenu(null) }, danger: true },
                        ].map((item, i) => (
                          <button
                            key={i}
                            onPointerDown={item.action}
                            style={{
                              width: '100%', textAlign: 'left',
                              padding: '12px 16px',
                              background: 'none', border: 'none',
                              borderBottom: i < 3 ? `1px solid ${border}` : 'none',
                              color: item.danger ? D.red : textPri,
                              fontSize: '0.82rem',
                              fontFamily: "'DM Sans', sans-serif",
                              cursor: 'pointer'
                            }}
                          >{item.label}</button>
                        ))}
                      </div>
                    )}
                  </td>

                  {columns.map(col => (
                    <Cell
                      key={col.id}
                      row={row}
                      col={col}
                      rows={rows}
                      columns={columns}
                      onSave={handleCellSave}
                      isDark={isDark}
                    />
                  ))}

                  <td style={{ borderLeft: `1px solid ${border}` }} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAB */}
      <button
        onPointerDown={() => setShowAddRow(true)}
        style={{
          position: 'fixed', bottom: '24px', right: '24px',
          width: '52px', height: '52px',
          background: D.indigo,
          border: 'none',
          borderRadius: '50%',
          color: '#fff',
          fontSize: '1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 24px rgba(99,102,241,0.5)`,
          cursor: 'pointer',
          zIndex: 40
        }}
      >+</button>

      {/* Add Row */}
      {showAddRow && (
        <AddRowSheet
          columns={columns}
          dark={dark}
          onClose={() => setShowAddRow(false)}
          onAdd={handleAddRow}
        />
      )}

      {/* Add Column */}
      {showAddColumn && (
        <BottomSheet title="Add Column" onClose={() => setShowAddColumn(false)}>
          <input
            autoFocus
            type="text"
            placeholder="Column name"
            value={newColumn.name}
            onChange={e => setNewColumn({ ...newColumn, name: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && (async () => {
              if (!newColumn.name.trim()) return
              await createColumn(sheet.id, newColumn.name.trim(), newColumn.type, columns.length)
              await loadData()
              setNewColumn({ name: '', type: 'text' })
              setShowAddColumn(false)
            })()}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: dark ? D.surface3 : '#f4f4f8',
              border: `1px solid ${dark ? D.border : '#ddd'}`,
              borderRadius: '10px', padding: '14px 16px',
              fontSize: '1rem', color: dark ? D.white : '#111',
              outline: 'none', fontFamily: "'DM Sans', sans-serif"
            }}
          />
          <select
            value={newColumn.type}
            onChange={e => setNewColumn({ ...newColumn, type: e.target.value })}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: dark ? D.surface3 : '#f4f4f8',
              border: `1px solid ${dark ? D.border : '#ddd'}`,
              borderRadius: '10px', padding: '14px 16px',
              fontSize: '1rem', color: dark ? D.white : '#111',
              outline: 'none', fontFamily: "'DM Sans', sans-serif"
            }}
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
          </select>
          <button
            onPointerDown={async () => {
              if (!newColumn.name.trim()) return
              await createColumn(sheet.id, newColumn.name.trim(), newColumn.type, columns.length)
              await loadData()
              setNewColumn({ name: '', type: 'text' })
              setShowAddColumn(false)
            }}
            style={{
              width: '100%', background: D.indigo, color: '#fff',
              border: 'none', borderRadius: '12px', padding: '16px',
              fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              boxShadow: `0 4px 20px rgba(99,102,241,0.35)`
            }}
          >Add Column</button>
        </BottomSheet>
      )}

      {/* Edit Column */}
      {editingColumn && editColData && (
        <BottomSheet title="Edit Column" onClose={() => { setEditingColumn(null); setEditColData(null) }}>
          <input
            autoFocus
            type="text"
            placeholder="Column name"
            value={editColData.name}
            onChange={e => setEditColData({ ...editColData, name: e.target.value })}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: dark ? D.surface3 : '#f4f4f8',
              border: `1px solid ${dark ? D.border : '#ddd'}`,
              borderRadius: '10px', padding: '14px 16px',
              fontSize: '1rem', color: dark ? D.white : '#111',
              outline: 'none', fontFamily: "'DM Sans', sans-serif"
            }}
          />
          <select
            value={editColData.type}
            onChange={e => setEditColData({ ...editColData, type: e.target.value })}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: dark ? D.surface3 : '#f4f4f8',
              border: `1px solid ${dark ? D.border : '#ddd'}`,
              borderRadius: '10px', padding: '14px 16px',
              fontSize: '1rem', color: dark ? D.white : '#111',
              outline: 'none', fontFamily: "'DM Sans', sans-serif"
            }}
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
          </select>
          {[
            { label: '← Insert Column Left', action: handleInsertColumnLeft },
            { label: 'Insert Column Right →', action: handleInsertColumnRight },
            { label: 'Save Changes', action: handleUpdateColumn, primary: true },
            { label: 'Delete Column', action: () => handleDeleteColumn(editColData.id), danger: true },
          ].map((btn, i) => (
            <button
              key={i}
              onPointerDown={btn.action}
              style={{
                width: '100%',
                background: btn.primary ? D.indigo : btn.danger ? D.redDim : dark ? D.surface3 : '#f4f4f8',
                color: btn.primary ? '#fff' : btn.danger ? D.red : dark ? D.white60 : '#444',
                border: btn.danger ? `1px solid rgba(248,113,113,0.2)` : btn.primary ? 'none' : `1px solid ${dark ? D.border : '#ddd'}`,
                borderRadius: '12px', padding: '14px',
                fontSize: '0.9rem', fontWeight: 600,
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
                boxShadow: btn.primary ? `0 4px 20px rgba(99,102,241,0.35)` : 'none'
              }}
            >{btn.label}</button>
          ))}
        </BottomSheet>
      )}

    </div>
  )
}

// ── Header button component
function HdrBtn({ dark, children, onPointerDown, title, disabled, active }) {
  const D = {
    surface3: '#1e1e24', border: '#2a2a35',
    white60: 'rgba(248,248,252,0.6)', white30: 'rgba(248,248,252,0.3)',
    indigo: '#6366f1'
  }
  return (
    <button
      onPointerDown={disabled ? undefined : onPointerDown}
      title={title}
      style={{
        width: '38px', height: '38px',
        background: active ? 'rgba(99,102,241,0.15)' : dark ? D.surface3 : '#f4f4f8',
        border: `1px solid ${active ? 'rgba(99,102,241,0.4)' : dark ? D.border : '#e5e5ea'}`,
        borderRadius: '8px',
        color: disabled ? (dark ? D.white30 : '#ccc') : dark ? D.white60 : '#555',
        fontSize: '1rem',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        flexShrink: 0,
        opacity: disabled ? 0.4 : 1
      }}
    >{children}</button>
  )
}

// ── Add Row sheet
function AddRowSheet({ columns, dark, onClose, onAdd }) {
  const [formData, setFormData] = useState({})
  const firstInputRef = useRef(null)
  const D = { surface3: '#1e1e24', border: '#2a2a35', white: '#f8f8fc', white60: 'rgba(248,248,252,0.6)', indigo: '#6366f1' }

  async function handleSubmit() {
    const hasData = Object.values(formData).some(v => String(v).trim())
    if (!hasData) return
    await onAdd(formData)
    setFormData({})
    setTimeout(() => firstInputRef.current?.focus(), 50)
  }

  return (
    <BottomSheet title="Add Row" onClose={onClose} tall>
      {columns.map((col, index) => (
        <div key={col.id}>
          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: dark ? D.white60 : '#666', marginBottom: '6px' }}>
            {col.name}
          </div>
          <input
            ref={index === 0 ? firstInputRef : null}
            type={col.type === 'date' ? 'date' : 'text'}
            inputMode={col.type === 'number' ? 'decimal' : 'text'}
            placeholder={col.type === 'number' ? `Enter number or =formula` : `Enter ${col.name.toLowerCase()}`}
            value={formData[col.id] || ''}
            onChange={e => setFormData(prev => ({ ...prev, [col.id]: e.target.value }))}
            autoFocus={index === 0}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: dark ? D.surface3 : '#f4f4f8',
              border: `1px solid ${dark ? D.border : '#ddd'}`,
              borderRadius: '10px', padding: '14px 16px',
              fontSize: '1rem', color: dark ? D.white : '#111',
              outline: 'none', fontFamily: "'DM Sans', sans-serif"
            }}
          />
        </div>
      ))}
      <button
        onPointerDown={handleSubmit}
        style={{
          width: '100%', background: D.indigo, color: '#fff',
          border: 'none', borderRadius: '12px', padding: '16px',
          fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
          fontFamily: "'DM Sans', sans-serif",
          boxShadow: `0 4px 20px rgba(99,102,241,0.35)`
        }}
      >Add &amp; Next</button>
    </BottomSheet>
  )
}
