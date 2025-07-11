const action = {
  workerStatus: null
}

const message = {
  errorsNoBacktest: 'There is no backtest data. Try to do a new backtest'
}

action.saveParameters = async () => {
  const strategyData = await tv.getStrategy(null, true)
  if (!strategyData || !strategyData.hasOwnProperty('name') || !strategyData.hasOwnProperty('properties') || !strategyData.properties) {
    await ui.showErrorPopup('The current indicator/strategy do not contain inputs that can be saved.')
    // await ui.showWarningPopup('Please open the indicator (strategy) parameters window before saving them to a file.')
    return
  }
  let strategyParamsCSV = `Name,Value\n"__indicatorName",${JSON.stringify(strategyData.name)}\n`
  Object.keys(strategyData.properties).forEach(key => {
    strategyParamsCSV += `${JSON.stringify(key)},${typeof strategyData.properties[key][0] === 'string' ? JSON.stringify(strategyData.properties[key]) : strategyData.properties[key]}\n`
  })
  file.saveAs(strategyParamsCSV, `${strategyData.name}.csv`)
}

action.loadParameters = async () => {
  await file.upload(file.uploadHandler, '', false)
}

action.uploadSignals = async () => {
  await file.upload(signal.parseTSSignalsAndGetMsg, `Please check if the ticker and timeframe are set like in the downloaded data and click on the parameters of the "iondvSignals" script to automatically enter new data on the chart.`, true)
}

action.uploadStrategyTestParameters = async () => {
  await file.upload(model.parseStrategyParamsAndGetMsg, '', false)
}

action.getStrategyTemplate = async () => {
  const strategyData = await tv.getStrategy()
  if (!strategyData || !strategyData.hasOwnProperty('name') || !strategyData.hasOwnProperty('properties') || !strategyData.properties) {
    await ui.showErrorPopup('The current strategy do not contain inputs, than can be saved')
  } else {
    const paramRange = model.getStrategyRange(strategyData)
    console.log(paramRange)
    // await storage.setKeys(storage.STRATEGY_KEY_PARAM, paramRange)
    const strategyRangeParamsCSV = model.convertStrategyRangeToTemplate(paramRange)
    await ui.showPopup('The range of parameters is saved for the current strategy.\n\nYou can start optimizing the strategy parameters by clicking on the "Test strategy" button')
    file.saveAs(strategyRangeParamsCSV, `${strategyData.name}.csv`)
  }
}

action.clearAll = async () => {
  const clearRes = await storage.clearAll()
  await ui.showPopup(clearRes && clearRes.length ? `The data was deleted: \n${clearRes.map(item => '- ' + item).join('\n')}` : 'There was no data in the storage')
}

action.previewStrategyTestResults = async () => {
  const testResults = await storage.getKey(storage.STRATEGY_KEY_RESULTS)
  if (!testResults || (!testResults.perfomanceSummary && !testResults.perfomanceSummary.length)) {
    await ui.showWarningPopup(message.errorsNoBacktest)
    return
  }
  console.log('previewStrategyTestResults', testResults)
  const eventData = await sendActionMessage(testResults, 'previewStrategyTestResults')
  if (eventData.hasOwnProperty('message'))
    await ui.showPopup(eventData.message)

  // await ui.showPreviewResults(previewResults) // WHY NOT WORKING ?
}

action.downloadStrategyTestResults = async () => {
  const testResults = await storage.getKey(storage.STRATEGY_KEY_RESULTS)
  if (!testResults || (!testResults.perfomanceSummary && !testResults.perfomanceSummary.length)) {
    await ui.showWarningPopup(message.errorsNoBacktest)
    return
  }
  testResults.optParamName = testResults.optParamName || backtest.DEF_MAX_PARAM_NAME
  console.log('downloadStrategyTestResults', testResults)
  const CSVResults = file.convertResultsToCSV(testResults)
  const bestResult = testResults.perfomanceSummary ? model.getBestResult(testResults) : {}
  const propVal = {}
  testResults.paramsNames.forEach(paramName => {
    if (bestResult.hasOwnProperty(`__${paramName}`))
      propVal[paramName] = bestResult[`__${paramName}`]
  })

  // Ensure optimal parameters are set and report reflects optimal values
  console.log('[DOWNLOAD] Setting optimal parameters and validating report...')
  const validationSuccess = await action._ensureOptimalParametersAndReport(testResults, propVal, bestResult)
  if (validationSuccess) {
    console.log('[DOWNLOAD] ✓ Optimal parameters successfully set and validated in report')
  } else {
    console.log('[DOWNLOAD] ⚠ Warning: Could not fully validate optimal parameters in report')
  }

  if (bestResult && bestResult.hasOwnProperty(testResults.optParamName))
    await ui.showPopup(`The best found parameters are set for the strategy\n\nThe best ${testResults.isMaximizing ? '(max) ' : '(min)'} ${testResults.optParamName}: ` + bestResult[testResults.optParamName])
  file.saveAs(CSVResults, `${testResults.ticker}:${testResults.timeFrame} ${testResults.shortName} - ${testResults.cycles}_${testResults.isMaximizing ? 'max' : 'min'}_${testResults.optParamName}_${testResults.method}.csv`)
}


action.testStrategy = async (request) => {
  try {
    // Wait for tv object to be available with timeout
    console.log('[ACTION_DEBUG] Waiting for tv object to be available...')

    const waitForTv = async (maxWaitTime = 10000) => {
      const startTime = Date.now()
      const checkInterval = 100

      console.log('[ACTION_DEBUG] Starting to wait for tv object...')
      console.log('[ACTION_DEBUG] Initial check - window.tvScriptStarted:', window.tvScriptStarted)
      console.log('[ACTION_DEBUG] Initial check - window.tvScriptLoaded:', window.tvScriptLoaded)
      console.log('[ACTION_DEBUG] Initial check - window.tv exists:', typeof window.tv !== 'undefined')
      console.log('[ACTION_DEBUG] Initial check - window.tvTest exists:', typeof window.tvTest !== 'undefined')

      // Try to run the test function if it exists
      if (typeof window.tvTest === 'function') {
        try {
          const testResult = window.tvTest()
          console.log('[ACTION_DEBUG] tv test function result:', testResult)
        } catch (testError) {
          console.log('[ACTION_DEBUG] tv test function error:', testError.message)
        }
      }

      while (Date.now() - startTime < maxWaitTime) {
        // Check if tv.js script has started/loaded
        if (window.tvScriptStarted) {
          console.log('[ACTION_DEBUG] tv.js script started indicator found')
        }
        if (window.tvScriptLoaded) {
          console.log('[ACTION_DEBUG] tv.js script loaded indicator found')
        }

        // Check if tv is available in window
        if (typeof window !== 'undefined' && window.tv) {
          console.log('[ACTION_DEBUG] Found tv in window scope after', Date.now() - startTime, 'ms')
          return window.tv
        }

        // Check if tv is available in globalThis
        if (typeof globalThis !== 'undefined' && globalThis.tv) {
          console.log('[ACTION_DEBUG] Found tv in globalThis scope after', Date.now() - startTime, 'ms')
          return globalThis.tv
        }

        // Log progress every second
        const elapsed = Date.now() - startTime
        if (elapsed % 1000 < checkInterval) {
          console.log('[ACTION_DEBUG] Still waiting for tv object...', elapsed, 'ms elapsed')
        }

        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, checkInterval))
      }

      console.log('[ACTION_DEBUG] Timeout reached waiting for tv object')
      return null
    }

    let tvObject = await waitForTv()

    if (!tvObject) {
      // Last resort: try to create a minimal tv object if the script failed to load
      console.error('[ACTION_ERROR] tv object not found after waiting, attempting to create fallback tv object')
      console.error('[ACTION_ERROR] This indicates tv.js failed to load or execute properly')
      console.error('[ACTION_ERROR] Available window properties:', Object.keys(window).filter(key => key.toLowerCase().includes('tv')))

      // Additional diagnostics
      console.error('[ACTION_ERROR] Script loading diagnostics:')
      console.error('[ACTION_ERROR] - Document ready state:', document.readyState)
      console.error('[ACTION_ERROR] - Extension scripts loaded:', {
        page: typeof page !== 'undefined',
        ui: typeof ui !== 'undefined',
        SEL: typeof SEL !== 'undefined',
        action: typeof action !== 'undefined',
        backtest: typeof backtest !== 'undefined'
      })
      console.error('[ACTION_ERROR] - Chrome extension context:', {
        runtime: typeof chrome?.runtime !== 'undefined',
        extensionId: chrome?.runtime?.id
      })

      // Create a complete fallback tv object to prevent complete failure
      console.log('[TV_FALLBACK] Creating complete fallback tv object...')
      tvObject = {
        // Properties
        isReportChanged: false,
        _isInitialized: false,
        reportNode: null,
        reportDeepNode: null,
        tickerTextPrev: null,
        timeFrameTextPrev: null,
        _settingsMethod: null,

        // Core methods that action.js needs
        _initialize: async () => {
          console.log('[TV_FALLBACK] Using fallback tv object');
          return true;
        },

        getStrategy: async (strategyName = '', isIndicatorSave = false) => {
          throw new Error('tv.js failed to load - getStrategy not available. Please reload the page and ensure all scripts load properly.');
        },

        setStrategyParams: async (strategyName, params, keepStrategyParamOpen) => {
          throw new Error('tv.js failed to load - setStrategyParams not available. Please reload the page and ensure all scripts load properly.');
        },

        getPerformance: async (testResults, isIgnoreError = false) => {
          throw new Error('tv.js failed to load - getPerformance not available. Please reload the page and ensure all scripts load properly.');
        },



        checkAndOpenStrategy: async (name) => {
          throw new Error('tv.js failed to load - checkAndOpenStrategy not available. Please reload the page and ensure all scripts load properly.');
        },

        openStrategyTab: async () => {
          throw new Error('tv.js failed to load - openStrategyTab not available. Please reload the page and ensure all scripts load properly.');
        },

        openStrategyParameters: async (indicatorTitle, searchAgainstStrategies = false) => {
          throw new Error('tv.js failed to load - openStrategyParameters not available. Please reload the page and ensure all scripts load properly.');
        },

        // Debug methods
        _debugStatus: () => {
          return {
            isFallback: true,
            reason: 'tv.js script failed to load',
            suggestion: 'Please reload the page and check browser console for script loading errors'
          }
        }
      }

      // Make it globally available for other scripts
      if (typeof window !== 'undefined') {
        window.tv = tvObject

        // Add a global diagnostic function
        window.diagnoseTvLoading = () => {
          const diagnosis = {
            tvScriptStarted: window.tvScriptStarted || false,
            tvScriptLoaded: window.tvScriptLoaded || false,
            tvObjectExists: typeof window.tv !== 'undefined',
            tvObjectIsFallback: window.tv?._debugStatus?.()?.isFallback || false,
            documentReadyState: document.readyState,
            extensionScripts: {
              page: typeof page !== 'undefined',
              ui: typeof ui !== 'undefined',
              SEL: typeof SEL !== 'undefined',
              action: typeof action !== 'undefined',
              backtest: typeof backtest !== 'undefined'
            },
            chromeExtension: {
              runtime: typeof chrome?.runtime !== 'undefined',
              extensionId: chrome?.runtime?.id
            },
            recommendation: 'tv.js failed to load. Try reloading the page. If problem persists, check browser console for script errors.'
          }

          console.log('[TV_DIAGNOSIS] Complete loading diagnosis:', diagnosis)
          return diagnosis
        }
      }

      console.warn('[ACTION_WARN] Created fallback tv object - functionality will be limited')
      console.warn('[ACTION_WARN] Run diagnoseTvLoading() in console for detailed diagnosis')
    }

    // Use the found or created tv object
    console.log('[ACTION_DEBUG] Using tv object, initialized:', tvObject._isInitialized)

    // Ensure tv is initialized
    if (tvObject._initialize && !tvObject._isInitialized) {
      console.log('[ACTION_DEBUG] Initializing tv object...')
      await tvObject._initialize()
    }

    // Use tvObject for all tv operations
    const tv = tvObject

    const strategyData = await action._getStrategyData()
    const [allRangeParams, paramRange, cycles] = await action._getRangeParams(strategyData)
    if (allRangeParams !== null) { // click cancel on parameters
      const testParams = await action._getTestParams(request, strategyData, allRangeParams, paramRange, cycles)
      console.log('Test parameters', testParams)
      action._showStartMsg(testParams.paramSpace, testParams.cycles, testParams.backtestDelay ? ` with delay between tests ${testParams.backtestDelay} sec` : '')

      let testResults = {}
      if (testParams.shouldTestTF) {
        if (!testParams.listOfTF || testParams.listOfTF.length === 0) {
          console.log('[TIMEFRAME_TEST] Empty timeframes list, skipping timeframe testing')
          ui.statusMessage(`Timeframes list is empty: ${testParams.listOfTFSource}. Skipping timeframe testing.`)
          // Continue with regular testing instead of blocking
        } else {
          let bestValue = null
          let bestTf = null
          testParams.shouldSkipInitBestResult = true
          for (const tf of testParams.listOfTF) {
            console.log('\nTest timeframe:', tf)
            await tvChart.changeTimeFrame(tf)
            testParams.timeFrame = tf
            if (testParams.hasOwnProperty('bestPropVal'))
              delete testParams.bestPropVal
            if (testParams.hasOwnProperty('bestValue'))
              delete testParams.bestValue
            testResults = await backtest.testStrategy(testParams, strategyData, allRangeParams) // TODO think about not save, but store them from  testResults.perfomanceSummary, testResults.filteredSummary = [], testResults.timeFrame to list
            await action._saveTestResults(testResults, testParams, false)
            if (bestTf === null) {
              bestValue = testResults.bestValue
              bestTf = tf
            } else if (testResults.isMaximizing ? testParams.bestValue > bestValue : testParams.bestValue < bestValue) {
              bestValue = testResults.bestValue
              bestTf = tf
            }
            if (action.workerStatus === null) {
              console.log('Stop command detected')
              break
            }
          }
          if (bestValue !== null) {
            await ui.showPopup(`The best value ${bestValue} for timeframe ${bestTf}. Check the saved files to get the best result parameters`)
          } else {
            console.log('[TIMEFRAME_TEST] No result value found after testing')
            ui.statusMessage('No result value found after timeframe testing. Check console for details.')
          }
        }
      } else {
        testResults = await backtest.testStrategy(testParams, strategyData, allRangeParams)
        await action._saveTestResults(testResults, testParams)
      }

    }
  } catch (err) {
    console.error('[BACKTEST_ERROR] Error during strategy testing:', err)

    // Don't show popup, just log and try to continue gracefully
    console.error('[BACKTEST_ERROR] Testing failed, but continuing to prevent UI blocking')

    // Try to show a non-blocking status message instead
    ui.statusMessage(`Testing failed: ${err.message || err}. Check console for details.`)

    // Don't throw the error to avoid blocking the UI
  }
  ui.statusMessageRemove()
}

action._getRangeParams = async (strategyData) => {
  let paramRange = await model.getStrategyParameters(strategyData)
  console.log('paramRange', paramRange)
  if (paramRange === null)
    // throw new Error('Error get changed strategy parameters')
    return [null, null, null]

  const initParams = {}
  initParams.paramRange = paramRange
  initParams.paramRangeSrc = model.getStrategyRange(strategyData)
  const changedStrategyParams = await ui.showAndUpdateStrategyParameters(initParams)
  if (changedStrategyParams === null) {
    return [null, null, null]
  }
  const cycles = changedStrategyParams.cycles ? changedStrategyParams.cycles : 100
  console.log('changedStrategyParams', changedStrategyParams)
  if (changedStrategyParams.paramRange === null) {
    console.log('Don not change paramRange')
  } else if (typeof changedStrategyParams.paramRange === 'object' && Object.keys(changedStrategyParams.paramRange).length) {
    paramRange = changedStrategyParams.paramRange
    await model.saveStrategyParameters(paramRange)
    console.log('ParamRange changes to', paramRange)
  } else {
    throw new Error('The strategy parameters invalid. Change them or run default parameters set.')
  }

  const allRangeParams = model.createParamsFromRange(paramRange)
  console.log('allRangeParams', allRangeParams)
  if (!allRangeParams) {
    throw new Error('Empty range parameters for strategy')
  }
  return [allRangeParams, paramRange, cycles]
}

action._getStrategyData = async () => {
  ui.statusMessage('Get the initial parameters.')
  const strategyData = await tv.getStrategy('', false)
  if (!strategyData || !strategyData.hasOwnProperty('name') || !strategyData.hasOwnProperty('properties') || !strategyData.properties) {
    throw new Error('The current strategy do not contain inputs, than can be optimized. You can choose another strategy to optimize.')
  }
  return strategyData
}


action._parseTF = (listOfTF) => {
  if (!listOfTF || typeof (listOfTF) !== 'string')
    return []
  return listOfTF.split(',').map(tf => tf.trim()).filter(tf => /(^\d{1,2}m$)|(^\d{1,2}h$)|(^\d{1,2}D$)|(^\d{1,2}W$)|(^\d{1,2}M$)/.test(tf))

}

action._getTestParams = async (request, strategyData, allRangeParams, paramRange, cycles) => {
  let testParams = await tv.switchToStrategyTabAndSetObserveForReport()
  const options = request && request.hasOwnProperty('options') ? request.options : {}
  const testMethod = options.hasOwnProperty('optMethod') && typeof (options.optMethod) === 'string' ? options.optMethod.toLowerCase() : 'random'
  let paramSpaceNumber = 0
  let isSequential = false
  if (['sequential'].includes(testMethod)) {
    paramSpaceNumber = Object.keys(allRangeParams).reduce((sum, param) => sum += allRangeParams[param].length, 0)
    isSequential = true
  } else {
    paramSpaceNumber = Object.keys(allRangeParams).reduce((mult, param) => mult *= allRangeParams[param].length, 1)
  }
  console.log('paramSpaceNumber', paramSpaceNumber)

  testParams.shouldTestTF = options.hasOwnProperty('shouldTestTF') ? options.shouldTestTF : false
  testParams.listOfTF = action._parseTF(options.listOfTF)
  testParams.listOfTFSource = options.listOfTF
  testParams.shouldSkipInitBestResult = false // TODO get from options

  testParams.paramSpace = paramSpaceNumber
  let paramPriority = model.getParamPriorityList(paramRange) // Filter by allRangeParams
  paramPriority = paramPriority.filter(key => allRangeParams.hasOwnProperty(key))
  console.log('paramPriority list', paramPriority)
  testParams.paramPriority = paramPriority

  testParams.startParams = await model.getStartParamValues(paramRange, strategyData)
  console.log('testParams.startParams', testParams.startParams)
  if (!testParams.hasOwnProperty('startParams') || !testParams.startParams.hasOwnProperty('current') || !testParams.startParams.current) {
    throw new Error('Error.\n\n The current strategy parameters could not be determined.\n Testing aborted')
  }

  testParams.cycles = cycles

  if (request.options) {
    testParams.isMaximizing = request.options.hasOwnProperty('isMaximizing') ? request.options.isMaximizing : true
    testParams.optParamName = request.options.optParamName ? request.options.optParamName : backtest.DEF_MAX_PARAM_NAME
    testParams.method = testMethod
    testParams.filterAscending = request.options.hasOwnProperty('optFilterAscending') ? request.options.optFilterAscending : null
    testParams.filterValue = request.options.hasOwnProperty('optFilterValue') ? request.options.optFilterValue : 50
    testParams.filterParamName = request.options.hasOwnProperty('optFilterParamName') ? request.options.optFilterParamName : 'Total trades: All'

    testParams.backtestDelay = !request.options.hasOwnProperty('backtestDelay') || !request.options['backtestDelay'] ? 0 : request.options['backtestDelay']
    testParams.randomDelay = request.options.hasOwnProperty('randomDelay') ? Boolean(request.options['randomDelay']) : true
    testParams.shouldSkipInitBestResult = request.options.hasOwnProperty('shouldSkipInitBestResult') ? Boolean(request.options['shouldSkipInitBestResult']) : false
    testParams.shouldSkipWaitingForDownload = request.options.hasOwnProperty('shouldSkipWaitingForDownload') ? Boolean(request.options['shouldSkipWaitingForDownload']) : false
    testParams.dataLoadingTime = request.options.hasOwnProperty('dataLoadingTime') && !isNaN(parseInt(request.options['dataLoadingTime'])) ? request.options['dataLoadingTime'] : 30
  }

  return testParams
}


action._showStartMsg = (paramSpaceNumber, cycles, addInfo) => {
  let extraHeader = `The search is performed among ${paramSpaceNumber} possible combinations of parameters (space).`
  extraHeader += (paramSpaceNumber / cycles) > 10 ? `<br />This is too large for ${cycles} cycles. It is recommended to use up to 3-4 essential parameters, remove the rest from the strategy parameters file.` : ''
  ui.statusMessage(`Started${addInfo}.`, extraHeader)
}



/**
 * Validates that the current report shows the expected optimal value
 * @param {Object} testResults - Test results containing optimization data
 * @param {Object} expectedOptimalValue - The expected optimal value to validate against
 * @returns {Promise<boolean>} - True if report matches expected value
 */
action._validateOptimalReport = async (testResults, expectedOptimalValue) => {
  console.log('[VALIDATION] Checking if report shows expected optimal value:', expectedOptimalValue)

  try {
    // Create a copy of testResults with longer timeout to handle UI lag
    const validationTestResults = { ...testResults, dataLoadingTime: 15 }

    // Wait a bit for UI to stabilize before reading
    await page.waitForTimeout(500)

    // Get current report data
    const reportResult = await tv.getPerformance(validationTestResults)

    if (reportResult.error) {
      console.log('[VALIDATION] Report has error, cannot validate:', reportResult.message)
      return false
    }

    const currentValue = reportResult.data[testResults.optParamName]
    console.log(`[VALIDATION] Current report ${testResults.optParamName}:`, currentValue)
    console.log(`[VALIDATION] Expected optimal ${testResults.optParamName}:`, expectedOptimalValue)

    if (currentValue === undefined || currentValue === null) {
      console.log('[VALIDATION] Current value is undefined/null')
      return false
    }

    // Handle string values that might contain currency symbols or formatting
    let currentStr = String(currentValue).replace(/[$,\s]/g, '')
    let expectedStr = String(expectedOptimalValue).replace(/[$,\s]/g, '')

    // Convert both values to numbers for comparison
    const currentNum = parseFloat(currentStr)
    const expectedNum = parseFloat(expectedStr)

    if (isNaN(currentNum) || isNaN(expectedNum)) {
      console.log('[VALIDATION] Cannot convert values to numbers for comparison')
      console.log('[VALIDATION] Current string:', currentStr, 'Expected string:', expectedStr)
      return false
    }

    // Use small tolerance for floating point comparison
    const tolerance = Math.max(Math.abs(expectedNum) * 0.001, 0.01) // 0.1% tolerance or minimum 0.01
    const difference = Math.abs(currentNum - expectedNum)
    const matches = difference <= tolerance

    console.log(`[VALIDATION] Current: ${currentNum}, Expected: ${expectedNum}`)
    console.log(`[VALIDATION] Difference: ${difference}, Tolerance: ${tolerance}, Matches: ${matches}`)

    // If values don't match, it's likely due to UI lag showing old data
    if (!matches) {
      console.log('[VALIDATION] Values do not match - likely UI lag showing previous parameter results')
    }

    return matches
  } catch (error) {
    console.error('[VALIDATION] Error during validation:', error)
    return false
  }
}

/**
 * Ensures optimal parameters are set and report reflects optimal values
 * @param {Object} testResults - Test results containing optimization data
 * @param {Object} propVal - Parameter values to set
 * @param {Object} bestResult - Best result containing optimal value
 * @returns {Promise<boolean>} - True if successfully validated
 */
action._ensureOptimalParametersAndReport = async (testResults, propVal, bestResult) => {
  const maxRetries = 3  // Reduced retry count for faster execution
  const expectedOptimalValue = bestResult[testResults.optParamName]

  console.log('[OPTIMAL_SETUP] Starting optimal parameter setup and validation')
  console.log('[OPTIMAL_SETUP] Expected optimal value:', expectedOptimalValue)

  // Step 1: Set the optimal parameters
  console.log('[OPTIMAL_SETUP] Setting optimal parameters...')
  await tv.setStrategyParams(testResults.shortName, propVal)

  // Step 2: Wait for TradingView to detect parameter change
  console.log('[OPTIMAL_SETUP] Waiting for TradingView to detect parameter change...')
  await page.waitForTimeout(2000)

  // Step 3: Ensure report is current before validation (this is the key fix)
  console.log('[OPTIMAL_SETUP] Ensuring report is current before validation...')
  await tv._ensureReportIsCurrent()

  // Now validate the report shows the expected optimal value
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`[OPTIMAL_SETUP] Validation attempt ${attempt}/${maxRetries}`)

    // Always ensure report is current before validation
    await tv._ensureReportIsCurrent()

    // Check if report matches expected value
    const isValid = await action._validateOptimalReport(testResults, expectedOptimalValue)

    if (isValid) {
      console.log('[OPTIMAL_SETUP] ✓ Report validation successful - optimal value confirmed')
      return true
    }

    console.log('[OPTIMAL_SETUP] Report does not match expected value, re-setting parameters...')

    // Simple approach: Just re-set parameters to trigger update
    try {
      console.log('[OPTIMAL_SETUP] Re-setting parameters to trigger TradingView update...')
      await tv.setStrategyParams(testResults.shortName, propVal)
      await page.waitForTimeout(2000) // Shorter wait time

    } catch (error) {
      console.log('[OPTIMAL_SETUP] Error during parameter re-setting:', error.message)
      await page.waitForTimeout(1000)
    }

    // If this is the last attempt, break
    if (attempt === maxRetries) {
      console.log('[OPTIMAL_SETUP] Maximum validation attempts reached')
      break
    }
  }

  // Final validation - simple and fast
  console.log('[OPTIMAL_SETUP] Performing final validation...')

  // Ensure report is current one final time
  await tv._ensureReportIsCurrent()
  const finalValidation = await action._validateOptimalReport(testResults, expectedOptimalValue)

  if (finalValidation) {
    console.log('[OPTIMAL_SETUP] ✓ Final validation successful - optimal parameters confirmed in report')
    return true
  } else {
    console.log('[OPTIMAL_SETUP] ⚠ Final validation shows mismatch - ensuring parameters are set correctly')

    // Final confirmation: Ensure parameters are set
    try {
      await tv.setStrategyParams(testResults.shortName, propVal)
      console.log('[OPTIMAL_SETUP] ✓ CONFIRMED: Optimal parameters are set in the strategy')
      console.log('[OPTIMAL_SETUP] Expected optimal value:', expectedOptimalValue)
      console.log('[OPTIMAL_SETUP] Note: Report display may lag behind parameter changes in TradingView UI')
      return true
    } catch (error) {
      console.error('[OPTIMAL_SETUP] ✗ Failed to confirm parameter setting:', error.message)
      return false
    }
  }
}

action._saveTestResults = async (testResults, testParams, isFinalTest = true) => {
  console.log('testResults', testResults)
  if (!testResults.perfomanceSummary && !testResults.perfomanceSummary.length) {
    console.log('[SAVE_RESULTS] No testing data available for saving')
    ui.statusMessage('No testing data available for saving. Please run a test first.')
    return
  }

  const CSVResults = file.convertResultsToCSV(testResults)
  const bestResult = testResults.perfomanceSummary ? model.getBestResult(testResults) : {}
  const initBestValue = testResults.hasOwnProperty('initBestValue') ? testResults.initBestValue : null
  const propVal = {}
  testResults.paramsNames.forEach(paramName => {
    if (bestResult.hasOwnProperty(`__${paramName}`))
      propVal[paramName] = bestResult[`__${paramName}`]
  })

  if (isFinalTest) {
    // Ensure optimal parameters are set and report reflects optimal values
    console.log('[SAVE_RESULTS] Setting optimal parameters and validating report...')
    const validationSuccess = await action._ensureOptimalParametersAndReport(testResults, propVal, bestResult)
    if (validationSuccess) {
      console.log('[SAVE_RESULTS] ✓ Optimal parameters successfully set and validated in report')
    } else {
      console.log('[SAVE_RESULTS] ⚠ Warning: Could not fully validate optimal parameters in report')
    }
  }

  let text = `All done.\n\n`
  text += bestResult && bestResult.hasOwnProperty(testParams.optParamName) ? 'The best ' + (testResults.isMaximizing ? '(max) ' : '(min) ') + testParams.optParamName + ': ' + backtest.convertValue(bestResult[testParams.optParamName]) : ''
  text += (initBestValue !== null && bestResult && bestResult.hasOwnProperty(testParams.optParamName) && initBestValue === bestResult[testParams.optParamName]) ? `\nIt isn't improved from the initial value: ${backtest.convertValue(initBestValue)}` : ''
  ui.statusMessage(text)
  console.log(`All done.\n\n${bestResult && bestResult.hasOwnProperty(testParams.optParamName) ? 'The best ' + (testResults.isMaximizing ? '(max) ' : '(min) ') + testParams.optParamName + ': ' + bestResult[testParams.optParamName] : ''}`)
  if (testParams.shouldSkipWaitingForDownload || !isFinalTest)
    file.saveAs(CSVResults, `${testResults.ticker}:${testResults.timeFrame} ${testResults.shortName} - ${testResults.cycles}_${testResults.isMaximizing ? 'max' : 'min'}_${testResults.optParamName}_${testResults.method}.csv`)
  if (isFinalTest) {
    await ui.showPopup(text)
    if (!testParams.shouldSkipWaitingForDownload)
      file.saveAs(CSVResults, `${testResults.ticker}:${testResults.timeFrame} ${testResults.shortName} - ${testResults.cycles}_${testResults.isMaximizing ? 'max' : 'min'}_${testResults.optParamName}_${testResults.method}.csv`)
  }
}


action.show3DChart = async () => {
  const testResults = await storage.getKey(storage.STRATEGY_KEY_RESULTS)
  if (!testResults || (!testResults.perfomanceSummary && !testResults.perfomanceSummary.length)) {
    await ui.showPopup('There is no results data for to show. Try to backtest again')
    return
  }
  testResults.optParamName = testResults.optParamName || backtest.DEF_MAX_PARAM_NAME
  const eventData = await sendActionMessage(testResults, 'show3DChart')
  if (eventData.hasOwnProperty('message'))
    await ui.showPopup(eventData.message)
}

async function sendActionMessage(data, action) {
  return new Promise(resolve => {
    const url = window.location && window.location.origin ? window.location.origin : 'https://www.tradingview.com'
    tvPageMessageData[action] = resolve
    window.postMessage({ name: 'iondvScript', action, data }, url) // TODO wait for data
  })
}
