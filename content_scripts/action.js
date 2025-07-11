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
  await tv.setStrategyParams(testResults.shortName, propVal)
  if (bestResult && bestResult.hasOwnProperty(testResults.optParamName))
    await ui.showPopup(`The best found parameters are set for the strategy\n\nThe best ${testResults.isMaximizing ? '(max) ' : '(min)'} ${testResults.optParamName}: ` + bestResult[testResults.optParamName])
  file.saveAs(CSVResults, `${testResults.ticker}:${testResults.timeFrame} ${testResults.shortName} - ${testResults.cycles}_${testResults.isMaximizing ? 'max' : 'min'}_${testResults.optParamName}_${testResults.method}.csv`)
}


action.testStrategy = async (request, isDeepTest = false) => {
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

        getStrategy: async (strategyName = '', isIndicatorSave = false, isDeepTest = false) => {
          throw new Error('tv.js failed to load - getStrategy not available. Please reload the page and ensure all scripts load properly.');
        },

        setStrategyParams: async (strategyName, params, isDeepTest, isIgnoreError) => {
          throw new Error('tv.js failed to load - setStrategyParams not available. Please reload the page and ensure all scripts load properly.');
        },

        getPerformance: async (testResults, isIgnoreError = false) => {
          throw new Error('tv.js failed to load - getPerformance not available. Please reload the page and ensure all scripts load properly.');
        },

        setDeepTest: async (isDeepTest) => {
          throw new Error('tv.js failed to load - setDeepTest not available. Please reload the page and ensure all scripts load properly.');
        },

        checkAndOpenStrategy: async (name, isDeepTest = false) => {
          throw new Error('tv.js failed to load - checkAndOpenStrategy not available. Please reload the page and ensure all scripts load properly.');
        },

        openStrategyTab: async (isDeepTest) => {
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

    const strategyData = await action._getStrategyData(isDeepTest)
    const [allRangeParams, paramRange, cycles] = await action._getRangeParams(strategyData)
    if (allRangeParams !== null) { // click cancel on parameters
      const testParams = await action._getTestParams(request, strategyData, allRangeParams, paramRange, cycles, isDeepTest)
      console.log('Test parameters', testParams)
      action._showStartMsg(testParams.paramSpace, testParams.cycles, testParams.backtestDelay ? ` with delay between tests ${testParams.backtestDelay} sec` : '')
      testParams.isDeepTest = isDeepTest
      await tv.setDeepTest(isDeepTest)

      let testResults = {}
      if (testParams.shouldTestTF) {
        if (!testParams.listOfTF || testParams.listOfTF.length === 0) {
          await ui.showWarningPopup(`You set to test timeframes in options, but timeframes list after correction values is empty: ${testParams.listOfTFSource}\nPlease set correct one with separation by comma. \nFor example: 1m,4h`)
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
            await ui.showWarningPopup(`Did not found any result value after testing`)
          }
        }
      } else {
        testResults = await backtest.testStrategy(testParams, strategyData, allRangeParams)
        await action._saveTestResults(testResults, testParams)
      }
      // if (isDeepTest)
      //   await tv.setDeepTest(!isDeepTest) // Reverse (switch off)
    }
  } catch (err) {
    console.error(err)
    await ui.showErrorPopup(`${err}`)
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

action._getStrategyData = async (isDeepTest) => {
  ui.statusMessage('Get the initial parameters.')
  const strategyData = await tv.getStrategy('', false, isDeepTest)
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

action._getTestParams = async (request, strategyData, allRangeParams, paramRange, cycles, isDeepTest=false) => {
  let testParams = await tv.switchToStrategyTabAndSetObserveForReport(isDeepTest)
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
    // deepStartDate removed - now using "Entire history" automatically
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

action._saveTestResults = async (testResults, testParams, isFinalTest = true) => {
  console.log('testResults', testResults)
  if (!testResults.perfomanceSummary && !testResults.perfomanceSummary.length) {
    await ui.showWarningPopup('There is no testing data for saving. Try to do test again')
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
  if (isFinalTest)
    await tv.setStrategyParams(testResults.shortName, propVal)
  let text = `All done.\n\n`
  text += bestResult && bestResult.hasOwnProperty(testParams.optParamName) ? 'The best ' + (testResults.isMaximizing ? '(max) ' : '(min) ') + testParams.optParamName + ': ' + backtest.convertValue(bestResult[testParams.optParamName]) : ''
  text += (initBestValue !== null && bestResult && bestResult.hasOwnProperty(testParams.optParamName) && initBestValue === bestResult[testParams.optParamName]) ? `\nIt isn't improved from the initial value: ${backtest.convertValue(initBestValue)}` : ''
  ui.statusMessage(text)
  console.log(`All done.\n\n${bestResult && bestResult.hasOwnProperty(testParams.optParamName) ? 'The best ' + (testResults.isMaximizing ? '(max) ' : '(min) ') + testParams.optParamName + ': ' + bestResult[testParams.optParamName] : ''}`)
  if (testParams.shouldSkipWaitingForDownload || !isFinalTest)
    file.saveAs(CSVResults, `${testResults.ticker}:${testResults.timeFrame}${testResults.isDeepTest ? ' deep backtesting' : ''} ${testResults.shortName} - ${testResults.cycles}_${testResults.isMaximizing ? 'max' : 'min'}_${testResults.optParamName}_${testResults.method}.csv`)
  if (isFinalTest) {
    await ui.showPopup(text)
    if (!testParams.shouldSkipWaitingForDownload)
      file.saveAs(CSVResults, `${testResults.ticker}:${testResults.timeFrame}${testResults.isDeepTest ? ' deep backtesting' : ''} ${testResults.shortName} - ${testResults.cycles}_${testResults.isMaximizing ? 'max' : 'min'}_${testResults.optParamName}_${testResults.method}.csv`)
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
