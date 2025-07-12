const csvAnalyzer = {}

// Main function to handle CSV file upload and analysis
csvAnalyzer.uploadAndAnalyzeCSV = async () => {
  try {
    await file.upload(csvAnalyzer.handleCSVFile, '', false)
  } catch (error) {
    console.error('CSV upload error:', error)
    await ui.showErrorPopup(`CSV upload failed: ${error.message}`)
  }
}

// Handle uploaded CSV file
csvAnalyzer.handleCSVFile = async (fileData) => {
  try {
    const csvData = await file.parseCSV(fileData)
    if (!csvData || csvData.length === 0) {
      return `File ${fileData.name}: No data found in CSV file.`
    }

    // Validate CSV structure
    const headers = Object.keys(csvData[0])
    if (headers.length === 0) {
      return `File ${fileData.name}: Invalid CSV structure - no headers found.`
    }

    // Check if this looks like a backtest results CSV
    const hasParameterColumns = headers.some(header => header.startsWith('__'))
    if (!hasParameterColumns) {
      return `File ${fileData.name}: This doesn't appear to be a backtest results CSV. No parameter columns found.`
    }

    // Open the CSV analyzer window
    csvAnalyzer.openAnalyzerWindow(csvData, fileData.name)
    return `File ${fileData.name}: CSV loaded successfully with ${csvData.length} rows.`
    
  } catch (error) {
    console.error('CSV processing error:', error)
    return `File ${fileData.name}: Error processing CSV - ${error.message}`
  }
}

// Extract parameter columns from CSV data
csvAnalyzer.extractParameters = (csvData) => {
  if (!csvData || csvData.length === 0) return []
  
  const headers = Object.keys(csvData[0])
  return headers.filter(header => header.startsWith('__'))
}

// Extract performance metrics columns
csvAnalyzer.extractMetrics = (csvData) => {
  if (!csvData || csvData.length === 0) return []
  
  const headers = Object.keys(csvData[0])
  const excludeColumns = ['comment', '_setTime_', '_parseTime_', '_duration_']
  return headers.filter(header => 
    !header.startsWith('__') && 
    !excludeColumns.includes(header)
  )
}

// Sort CSV data by column
csvAnalyzer.sortData = (data, column, ascending = true) => {
  return [...data].sort((a, b) => {
    let aVal = a[column]
    let bVal = b[column]
    
    // Handle numeric values
    if (typeof aVal === 'string' && !isNaN(parseFloat(aVal))) {
      aVal = parseFloat(aVal)
    }
    if (typeof bVal === 'string' && !isNaN(parseFloat(bVal))) {
      bVal = parseFloat(bVal)
    }
    
    // Handle null/undefined values
    if (aVal == null && bVal == null) return 0
    if (aVal == null) return ascending ? 1 : -1
    if (bVal == null) return ascending ? -1 : 1
    
    // Compare values
    if (aVal < bVal) return ascending ? -1 : 1
    if (aVal > bVal) return ascending ? 1 : -1
    return 0
  })
}

// Apply parameters from a CSV row to the current strategy
csvAnalyzer.applyParameters = async (rowData, parameterColumns) => {
  try {
    // Extract parameter values from the row
    const paramValues = {}
    parameterColumns.forEach(paramCol => {
      if (rowData.hasOwnProperty(paramCol)) {
        // Remove the '__' prefix to get the actual parameter name
        const paramName = paramCol.substring(2)
        paramValues[paramName] = rowData[paramCol]
      }
    })

    if (Object.keys(paramValues).length === 0) {
      await ui.showWarningPopup('No parameters found in this row to apply.')
      return false
    }

    console.log('[CSV_ANALYZER] Extracted parameters to apply:', paramValues)

    // Get current strategy data to determine strategy name and available parameters
    const strategyData = await tv.getStrategy()
    if (!strategyData || !strategyData.name) {
      await ui.showErrorPopup('Could not determine current strategy name. Please ensure a strategy is loaded.')
      return false
    }

    console.log('[CSV_ANALYZER] Current strategy data:', strategyData)
    console.log('[CSV_ANALYZER] Available strategy parameters:', Object.keys(strategyData.properties || {}))

    // Check if the parameters from CSV match the strategy parameters (case-insensitive)
    const availableParams = Object.keys(strategyData.properties || {})
    const csvParams = Object.keys(paramValues)

    // Create a mapping from lowercase to actual parameter names
    const paramMapping = {}
    availableParams.forEach(param => {
      paramMapping[param.toLowerCase()] = param
    })

    console.log('[CSV_ANALYZER] Parameter mapping:', paramMapping)

    const matchingParams = []
    const missingParams = []

    csvParams.forEach(csvParam => {
      const lowerCsvParam = csvParam.toLowerCase()
      if (paramMapping[lowerCsvParam]) {
        matchingParams.push(csvParam)
      } else {
        missingParams.push(csvParam)
      }
    })

    console.log('[CSV_ANALYZER] Matching parameters:', matchingParams)
    console.log('[CSV_ANALYZER] Missing parameters:', missingParams)

    if (matchingParams.length === 0) {
      await ui.showErrorPopup(`No matching parameters found!\n\nCSV parameters: ${csvParams.join(', ')}\nStrategy parameters: ${availableParams.join(', ')}`)
      return false
    }

    // Create filtered parameters with correct case
    const filteredParamValues = {}
    matchingParams.forEach(csvParam => {
      const correctParamName = paramMapping[csvParam.toLowerCase()]
      filteredParamValues[correctParamName] = paramValues[csvParam]
    })

    console.log('[CSV_ANALYZER] Final parameters to apply:', filteredParamValues)

    // Apply parameters to the strategy with more detailed logging
    console.log('[CSV_ANALYZER] Setting parameters:', filteredParamValues)
    console.log('[CSV_ANALYZER] Strategy name:', strategyData.name)

    // Use the existing proven tv.setStrategyParams function
    const success = await tv.setStrategyParams(strategyData.name, filteredParamValues, false)

    if (success) {
      console.log('[CSV_ANALYZER] Parameters set successfully, waiting for TradingView to process changes...')

      // Wait for TradingView to process the parameter changes
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Use the existing report update functionality from tv.js
      const updateSuccess = await tv._checkAndClickRegularUpdateReportButton()

      if (updateSuccess) {
        console.log('[CSV_ANALYZER] Update report button clicked, waiting for completion...')
        await tv._waitForUpdateReportSuccess(10000)
        console.log('[CSV_ANALYZER] Report update completed')
      } else {
        console.log('[CSV_ANALYZER] No update button found, report may already be current')
        // Give some time for automatic updates
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      const paramList = Object.entries(paramValues)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n')
      await ui.showPopup(`Parameters applied successfully:\n\n${paramList}\n\nPlease verify the TradingView strategy settings and report.`)
      return true
    } else {
      await ui.showErrorPopup('Failed to apply parameters. Please check that the strategy is compatible.')
      return false
    }

  } catch (error) {
    console.error('Parameter application error:', error)
    await ui.showErrorPopup(`Error applying parameters: ${error.message}`)
    return false
  }
}

// Create and display the CSV analyzer window
csvAnalyzer.openAnalyzerWindow = (csvData, fileName) => {
  // Remove existing window if present
  csvAnalyzer.closeAnalyzerWindow()

  const parameterColumns = csvAnalyzer.extractParameters(csvData)
  const metricColumns = csvAnalyzer.extractMetrics(csvData)

  // Create window container
  const windowEl = document.createElement('div')
  windowEl.id = 'csvAnalyzerWindow'
  windowEl.setAttribute('style', ui.styleValWindowShadow)
  windowEl.style.height = document.documentElement.scrollHeight + 'px'

  // Add styles
  const styleEl = windowEl.appendChild(document.createElement('style'))
  styleEl.innerHTML = csvAnalyzer.getWindowStyles()

  // Create window content
  const contentEl = windowEl.appendChild(document.createElement('div'))
  contentEl.className = 'csv-analyzer-content'

  // Create header
  const headerEl = contentEl.appendChild(document.createElement('div'))
  headerEl.className = 'csv-analyzer-header'
  headerEl.innerHTML = `
    <h2>CSV Backtest Results Analyzer</h2>
    <p>File: ${fileName} | Rows: ${csvData.length} | Parameters: ${parameterColumns.length}</p>
    <button id="csvAnalyzerClose" class="csv-analyzer-btn csv-analyzer-btn-close">Close</button>
  `

  // Create table container
  const tableContainer = contentEl.appendChild(document.createElement('div'))
  tableContainer.className = 'csv-analyzer-table-container'

  // Create and populate table
  csvAnalyzer.createTable(tableContainer, csvData, parameterColumns, metricColumns)

  // Add to DOM
  const tvDialog = document.getElementById('overlap-manager-root')
  if (tvDialog) {
    document.body.insertBefore(windowEl, tvDialog)
  } else {
    document.body.appendChild(windowEl)
  }

  // Add event listeners
  csvAnalyzer.setupEventListeners(csvData, parameterColumns, metricColumns)
}

// Create the data table
csvAnalyzer.createTable = (container, data, parameterColumns, metricColumns) => {
  const table = document.createElement('table')
  table.id = 'csvAnalyzerTable'
  table.className = 'csv-analyzer-table'

  // Create header
  const thead = table.appendChild(document.createElement('thead'))
  const headerRow = thead.appendChild(document.createElement('tr'))

  // Add Apply column
  const applyHeader = headerRow.appendChild(document.createElement('th'))
  applyHeader.textContent = 'Apply'
  applyHeader.className = 'csv-analyzer-apply-col'

  // Add sortable metric columns
  metricColumns.forEach(column => {
    const th = headerRow.appendChild(document.createElement('th'))
    th.textContent = column
    th.className = 'csv-analyzer-sortable'
    th.dataset.column = column
    th.innerHTML = `${column} <span class="csv-analyzer-sort-indicator">⇅</span>`
  })

  // Add parameter columns (non-sortable, for reference)
  parameterColumns.forEach(column => {
    const th = headerRow.appendChild(document.createElement('th'))
    th.textContent = column.substring(2) // Remove '__' prefix
    th.className = 'csv-analyzer-param-col'
  })

  // Create body
  const tbody = table.appendChild(document.createElement('tbody'))
  tbody.id = 'csvAnalyzerTableBody'

  // Populate table with data
  csvAnalyzer.populateTableBody(tbody, data, parameterColumns, metricColumns)

  container.appendChild(table)
}

// Populate table body with data
csvAnalyzer.populateTableBody = (tbody, data, parameterColumns, metricColumns) => {
  tbody.innerHTML = '' // Clear existing content

  data.forEach((row, index) => {
    const tr = tbody.appendChild(document.createElement('tr'))
    tr.dataset.rowIndex = index

    // Add Apply button
    const applyCell = tr.appendChild(document.createElement('td'))
    const applyBtn = applyCell.appendChild(document.createElement('button'))
    applyBtn.textContent = 'Apply'
    applyBtn.className = 'csv-analyzer-btn csv-analyzer-btn-apply'
    // Store the actual row data in the button element for direct access
    applyBtn.rowData = row
    applyBtn.dataset.rowIndex = index

    // Add metric columns
    metricColumns.forEach(column => {
      const td = tr.appendChild(document.createElement('td'))
      const value = row[column]
      td.textContent = csvAnalyzer.formatCellValue(value)
      td.className = 'csv-analyzer-metric-cell'
    })

    // Add parameter columns
    parameterColumns.forEach(column => {
      const td = tr.appendChild(document.createElement('td'))
      const value = row[column]
      td.textContent = csvAnalyzer.formatCellValue(value)
      td.className = 'csv-analyzer-param-cell'
    })
  })
}

// Format cell values for display
csvAnalyzer.formatCellValue = (value) => {
  if (value == null || value === '') return ''
  if (typeof value === 'number') {
    return value % 1 === 0 ? value.toString() : value.toFixed(4)
  }
  return value.toString()
}

// Setup event listeners for the analyzer window
csvAnalyzer.setupEventListeners = (csvData, parameterColumns, metricColumns) => {
  let currentData = [...csvData]
  let sortState = {} // Track sort direction for each column

  // Close button
  const closeBtn = document.getElementById('csvAnalyzerClose')
  if (closeBtn) {
    closeBtn.onclick = csvAnalyzer.closeAnalyzerWindow
  }

  // Column sorting
  const sortableHeaders = document.querySelectorAll('.csv-analyzer-sortable')
  sortableHeaders.forEach(header => {
    header.onclick = () => {
      const column = header.dataset.column
      const ascending = !sortState[column] // Toggle sort direction
      sortState[column] = ascending

      // Update sort indicators
      sortableHeaders.forEach(h => {
        const indicator = h.querySelector('.csv-analyzer-sort-indicator')
        if (h === header) {
          indicator.textContent = ascending ? '↑' : '↓'
        } else {
          indicator.textContent = '⇅'
        }
      })

      // Sort data and refresh table
      currentData = csvAnalyzer.sortData(currentData, column, ascending)
      const tbody = document.getElementById('csvAnalyzerTableBody')
      csvAnalyzer.populateTableBody(tbody, currentData, parameterColumns, metricColumns)

      // Re-attach apply button listeners
      csvAnalyzer.attachApplyListeners(currentData, parameterColumns)
    }
  })

  // Apply button listeners
  csvAnalyzer.attachApplyListeners(currentData, parameterColumns)
}

// Attach event listeners to apply buttons
csvAnalyzer.attachApplyListeners = (data, parameterColumns) => {
  const applyButtons = document.querySelectorAll('.csv-analyzer-btn-apply')
  applyButtons.forEach(btn => {
    btn.onclick = async () => {
      // Use the row data stored directly in the button element
      // This ensures we always get the correct row data regardless of sorting
      const rowData = btn.rowData

      if (rowData) {
        // Disable button during processing
        btn.disabled = true
        btn.textContent = 'Setting...'

        try {
          // Extract parameter values for display and logging
          const paramValues = {}
          parameterColumns.forEach(paramCol => {
            if (rowData.hasOwnProperty(paramCol)) {
              const paramName = paramCol.substring(2)
              paramValues[paramName] = rowData[paramCol]
            }
          })

          console.log('[CSV_ANALYZER] Applying parameters:', paramValues)
          console.log('[CSV_ANALYZER] Full row data:', rowData)

          // Show progress
          btn.textContent = 'Updating...'

          const success = await csvAnalyzer.applyParameters(rowData, parameterColumns)

          if (success) {
            // Temporarily show success state
            btn.textContent = 'Applied!'
            btn.style.backgroundColor = '#4CAF50'
            setTimeout(() => {
              btn.textContent = 'Apply'
              btn.style.backgroundColor = ''
            }, 2000)
          }
        } catch (error) {
          console.error('[CSV_ANALYZER] Error applying parameters:', error)
          // Show error state
          btn.textContent = 'Error'
          btn.style.backgroundColor = '#f44336'
          setTimeout(() => {
            btn.textContent = 'Apply'
            btn.style.backgroundColor = ''
          }, 2000)
        } finally {
          // Re-enable button
          btn.disabled = false
        }
      } else {
        console.error('[CSV_ANALYZER] No row data found for button')
      }
    }
  })
}





// Close the analyzer window
csvAnalyzer.closeAnalyzerWindow = () => {
  const windowEl = document.getElementById('csvAnalyzerWindow')
  if (windowEl) {
    windowEl.parentNode.removeChild(windowEl)
  }
}

// Get CSS styles for the analyzer window
csvAnalyzer.getWindowStyles = () => {
  return `
    .csv-analyzer-content {
      background-color: white;
      color: black;
      width: 95%;
      max-width: 1200px;
      height: 90%;
      max-height: 800px;
      position: fixed;
      top: 5%;
      left: 50%;
      transform: translateX(-50%);
      border: 2px solid #008CBA;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .csv-analyzer-header {
      background-color: #008CBA;
      color: white;
      padding: 15px 20px;
      border-bottom: 1px solid #ddd;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }

    .csv-analyzer-header h2 {
      margin: 0;
      font-size: 18px;
    }

    .csv-analyzer-header p {
      margin: 5px 0 0 0;
      font-size: 14px;
      opacity: 0.9;
    }

    .csv-analyzer-table-container {
      flex: 1;
      overflow: auto;
      padding: 10px;
    }

    .csv-analyzer-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    .csv-analyzer-table th,
    .csv-analyzer-table td {
      border: 1px solid #ddd;
      padding: 6px 8px;
      text-align: left;
    }

    .csv-analyzer-table th {
      background-color: #f5f5f5;
      font-weight: bold;
      position: sticky;
      top: 0;
      z-index: 1;
    }

    .csv-analyzer-sortable {
      cursor: pointer;
      user-select: none;
    }

    .csv-analyzer-sortable:hover {
      background-color: #e0e0e0;
    }

    .csv-analyzer-sort-indicator {
      font-size: 10px;
      margin-left: 5px;
    }

    .csv-analyzer-apply-col {
      width: 80px;
      text-align: center;
    }

    .csv-analyzer-param-col {
      background-color: #f0f8ff;
      font-size: 11px;
    }

    .csv-analyzer-metric-cell {
      font-family: monospace;
    }

    .csv-analyzer-param-cell {
      background-color: #f9f9f9;
      font-family: monospace;
      font-size: 11px;
    }

    .csv-analyzer-btn {
      border: none;
      padding: 4px 8px;
      cursor: pointer;
      border-radius: 3px;
      font-size: 11px;
      transition: background-color 0.2s;
    }

    .csv-analyzer-btn-apply {
      background-color: #4CAF50;
      color: white;
    }

    .csv-analyzer-btn-apply:hover:not(:disabled) {
      background-color: #45a049;
    }

    .csv-analyzer-btn-apply:disabled {
      background-color: #cccccc;
      cursor: not-allowed;
    }

    .csv-analyzer-btn-close {
      background-color: #f44336;
      color: white;
      padding: 8px 16px;
      font-size: 14px;
    }

    .csv-analyzer-btn-close:hover {
      background-color: #da190b;
    }
  `
}
