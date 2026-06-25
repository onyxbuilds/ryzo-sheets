// ── FREE TIER LIMITS ──────────────────────────────────────
// Single source of truth for all freemium restrictions
// When a user upgrades, isPro becomes true and all gates open

export const FREE_LIMITS = {
  sheets: 5,
  rowsPerSheet: 100
}

export const PRO_FEATURES = {
  excelExport: true,
  csvImport: true,
  unlimitedSheets: true,
  unlimitedRows: true,
  crossDeviceSync: true,
  advancedFormulas: true
}

// Check if user has exceeded sheet limit
export function hasReachedSheetLimit(sheetCount, isPro) {
  if (isPro) return false
  return sheetCount >= FREE_LIMITS.sheets
}

// Check if user has exceeded row limit for a sheet
export function hasReachedRowLimit(rowCount, isPro) {
  if (isPro) return false
  return rowCount >= FREE_LIMITS.rowsPerSheet
}

// Check if a pro feature is accessible
export function canAccessFeature(feature, isPro) {
  if (isPro) return true
  return !(PRO_FEATURES[feature] ?? true)
}

// Get a friendly message when limit is hit
export function getLimitMessage(type) {
  switch (type) {
    case 'sheets':
      return `You've reached the free limit of ${FREE_LIMITS.sheets} sheets. Upgrade to Pro for unlimited sheets.`
    case 'rows':
      return `You've reached the free limit of ${FREE_LIMITS.rowsPerSheet} rows per sheet. Upgrade to Pro for unlimited rows.`
    case 'excelExport':
      return 'Excel export is a Pro feature. Upgrade to export in Excel format.'
    case 'csvImport':
      return 'CSV import is a Pro feature. Upgrade to import your existing data.'
    case 'sync':
      return 'Cross-device sync is a Pro feature. Upgrade to access your sheets everywhere.'
    default:
      return 'This feature is available on the Pro plan.'
  }
}