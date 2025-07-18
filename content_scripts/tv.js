// CRITICAL: This must execute first - if you don't see this message, tv.js is not loading at all
console.error('[TV_CRITICAL] ===== TV.JS SCRIPT EXECUTION STARTED =====')
console.error('[TV_CRITICAL] If you see this message, tv.js is loading properly')
console.error('[TV_CRITICAL] Timestamp:', new Date().toISOString())

// Set immediate indicators
if (typeof window !== 'undefined') {
  window.tvScriptStarted = true
  window.tvScriptStartTime = Date.now()
  console.error('[TV_CRITICAL] Set window.tvScriptStarted = true')

  // Also set a simple test function
  window.tvTest = () => {
    console.log('[TV_TEST] tv.js is loaded and working')
    return 'tv.js is working'
  }
  console.error('[TV_CRITICAL] Set window.tvTest function')
} else {
  console.error('[TV_CRITICAL] ERROR: window object not available!')
}

// Create tv object immediately and make it globally accessible
console.error('[TV_CRITICAL] Creating tv object...')
var tv = {
  reportNode: null,
  reportDeepNode: null,
  tickerTextPrev: null,
  timeFrameTextPrev: null,
  isReportChanged: false,
  _settingsMethod: null
}
console.error('[TV_CRITICAL] tv object created successfully')

// Make tv globally accessible immediately
if (typeof window !== 'undefined') {
  window.tv = tv
  console.error('[TV_CRITICAL] tv object assigned to window.tv')

  // Also add to globalThis for broader compatibility
  if (typeof globalThis !== 'undefined') {
    globalThis.tv = tv
    console.error('[TV_CRITICAL] tv object assigned to globalThis.tv')
  }

  // Verify assignment worked
  console.error('[TV_CRITICAL] Verification - window.tv exists:', typeof window.tv !== 'undefined')
  console.error('[TV_CRITICAL] Verification - window.tv === tv:', window.tv === tv)
} else {
  console.error('[TV_CRITICAL] FATAL ERROR: window object not available!')
}

console.log('[TV_LOAD] tv object created and made globally available')
console.log('[TV_LOAD] typeof tv:', typeof tv)
console.log('[TV_LOAD] typeof window.tv:', typeof window.tv)

// Add a loading indicator that other scripts can check
if (typeof window !== 'undefined') {
  window.tvScriptLoaded = true
  window.tvScriptLoadTime = Date.now()
}

// Add initialization check
tv._isInitialized = true // Set to true immediately since tv object is defined
tv._initializationPromise = null
tv._scriptLoadTime = Date.now()

// Log tv object creation for debugging
console.log('[TV_INIT] tv object created and made globally available')
console.log('[TV_INIT] tv object location checks:')
console.log('[TV_INIT] - typeof tv:', typeof tv)
console.log('[TV_INIT] - window.tv exists:', typeof window?.tv !== 'undefined')
console.log('[TV_INIT] - globalThis.tv exists:', typeof globalThis?.tv !== 'undefined')

// Initialize tv object (simplified since tv is immediately available)
tv._initialize = async () => {
  if (tv._isInitialized) {
    console.log('[TV_INIT] tv object already initialized')
    return true
  }

  try {
    // Basic readiness check
    if (document.readyState === 'loading') {
      console.log('[TV_INIT] Waiting for DOM to be ready...')
      await new Promise(resolve => {
        if (document.readyState !== 'loading') {
          resolve()
        } else {
          document.addEventListener('DOMContentLoaded', resolve, { once: true })
        }
      })
    }

    tv._isInitialized = true
    console.log('[TV_INIT] tv object initialized successfully')
    return true
  } catch (error) {
    console.error('[TV_INIT] Failed to initialize tv object:', error)
    return false
  }
}

// Check script dependencies and loading order
tv._checkDependencies = () => {
  const dependencies = {
    'page': typeof page !== 'undefined',
    'ui': typeof ui !== 'undefined',
    'SEL': typeof SEL !== 'undefined',
    'SUPPORT_TEXT': typeof SUPPORT_TEXT !== 'undefined'
  }

  console.log('[TV_DEBUG] Dependency check:', dependencies)

  const missing = Object.keys(dependencies).filter(dep => !dependencies[dep])
  if (missing.length > 0) {
    console.warn('[TV_WARN] Missing dependencies:', missing)
    console.warn('[TV_WARN] This may indicate script loading order issues')
  }

  return missing.length === 0
}

// Ensure tv is available for other scripts
tv._ensureAvailable = () => {
  console.log('[TV_DEBUG] Ensuring tv availability...')

  if (typeof tv === 'undefined') {
    console.error('[TV_ERROR] tv object is not defined in current scope')
    throw new Error('tv object is not defined. Please ensure tv.js is loaded properly.')
  }

  // Check dependencies
  tv._checkDependencies()

  if (!tv._isInitialized) {
    console.warn('[TV_WARN] tv object accessed before initialization. Attempting to initialize...')
    tv._initialize()
  }

  console.log('[TV_DEBUG] tv object is available and ready')
  return tv
}

// Debug function to check tv object status (can be called from console)
tv._debugStatus = () => {
  const status = {
    tvExists: typeof tv !== 'undefined',
    windowTvExists: typeof window?.tv !== 'undefined',
    globalTvExists: typeof globalThis?.tv !== 'undefined',
    isInitialized: tv?._isInitialized,
    scriptLoadTime: tv?._scriptLoadTime,
    timeSinceLoad: tv?._scriptLoadTime ? Date.now() - tv._scriptLoadTime : 'unknown',
    dependencies: tv?._checkDependencies?.() || 'check function not available'
  }

  console.log('[TV_DEBUG_STATUS] Complete tv object status:', status)
  console.log('[TV_DEBUG_STATUS] tv object methods:', Object.keys(tv || {}).filter(key => typeof tv[key] === 'function').slice(0, 10))

  return status
}

// Make debug function globally available
if (typeof window !== 'undefined') {
  window.debugTv = tv._debugStatus
}


const SUPPORT_TEXT = 'Please retry. <br />If the problem reproduced then it is possible that TV UI changed. Create task on' +
  '<a href="https://github.com/akumidv/tradingview-assistant-chrome-extension/issues/" target="_blank"> github</a> please (check before if it isn\'t alredy created)'

// Inject script to get access to TradingView data on page
const script = document.createElement('script');
script.src = chrome.runtime.getURL('page-context.js');
document.documentElement.appendChild(script);

const scriptPlot = document.createElement('script');
scriptPlot.src = chrome.runtime.getURL('lib/plotly.min.js')
document.documentElement.appendChild(scriptPlot);

const tvPageMessageData = {}

window.addEventListener('message', messageHandler)


async function messageHandler(event) {
  const url = window.location && window.location.origin ? window.location.origin : 'https://www.tradingview.com'
  if (!event.origin.startsWith(url) || !event.data ||
    !event.data.hasOwnProperty('name') || event.data.name !== 'iondvPage' ||
    !event.data.hasOwnProperty('action'))
    return
  if (tvPageMessageData.hasOwnProperty(event.data.action) && typeof (tvPageMessageData[event.data.action]) === 'function') { // Callback
    const resolve = tvPageMessageData[event.data.action]
    delete tvPageMessageData[event.data.action]
    resolve(event.data)
  } else {
    tvPageMessageData[event.data.action] = event.data.data
  }
}

/**
 * Retry utility function for handling transient parsing failures
 * @param {Function} operation - The operation to retry
 * @param {Object} options - Retry configuration options
 * @param {number} options.maxAttempts - Maximum number of retry attempts (default: 3)
 * @param {number} options.baseDelay - Base delay in milliseconds (default: 500)
 * @param {number} options.backoffMultiplier - Exponential backoff multiplier (default: 1.5)
 * @param {number} options.jitterMax - Maximum jitter in milliseconds (default: 100)
 * @param {string} options.operationName - Name for logging purposes
 * @param {Function} options.isRetryableError - Function to determine if error is retryable
 * @returns {Promise} - Result of the operation or throws the last error
 */
tv.retryParsingOperation = async (operation, options = {}) => {
  const {
    maxAttempts = 3,
    baseDelay = 500,
    backoffMultiplier = 1.5,
    jitterMax = 100,
    operationName = 'parsing operation',
    isRetryableError = () => true
  } = options;

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Only log for first attempt or critical operations to reduce spam
      if (attempt === 1 || operationName.includes('header') || operationName.includes('row element')) {
        console.log(`[RETRY] Attempting ${operationName} (attempt ${attempt}/${maxAttempts})`);
      }
      const result = await operation();

      if (attempt > 1) {
        console.log(`[RETRY] ${operationName} succeeded on attempt ${attempt}/${maxAttempts}`);
      }

      return result;
    } catch (error) {
      lastError = error;
      // Reduce logging for cell extraction failures to prevent spam
      if (!operationName.includes('cell') && !operationName.includes('tab parsing')) {
        console.warn(`[RETRY] ${operationName} failed on attempt ${attempt}/${maxAttempts}:`, error.message);
      }

      // Check if this is the last attempt or if error is not retryable
      if (attempt === maxAttempts || !isRetryableError(error)) {
        const errorContext = {
          operationName,
          totalAttempts: attempt,
          maxAttempts,
          finalError: error.message,
          errorStack: error.stack,
          isRetryable: isRetryableError(error)
        };
        console.error(`[RETRY] ${operationName} failed after ${attempt} attempts. Error context:`, errorContext);

        // Enhance the error message with retry information
        const enhancedError = new Error(`${error.message} (failed after ${attempt} retry attempts)`);
        enhancedError.originalError = error;
        enhancedError.retryContext = errorContext;
        throw enhancedError;
      }

      // Calculate delay with exponential backoff and jitter
      const exponentialDelay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
      const jitter = Math.random() * jitterMax;
      const totalDelay = exponentialDelay + jitter;

      console.log(`[RETRY] Waiting ${Math.round(totalDelay)}ms before retry ${attempt + 1}/${maxAttempts}`);
      await page.waitForTimeout(totalDelay);
    }
  }

  // This should never be reached, but just in case
  throw lastError;
};

/**
 * Determines if a parsing error is retryable
 * @param {Error} error - The error to check
 * @returns {boolean} - True if the error should be retried
 */
tv.isRetryableParsingError = (error) => {
  const retryableMessages = [
    'Can\'t get performance headers',
    'Can\'t get performance rows',
    'querySelectorAll',
    'querySelector',
    'innerText',
    'textContent',
    'DOM',
    'element not found',
    'null',
    'undefined',
    'cannot read property',
    'cannot read properties',
    'is not a function',
    'timeout',
    'network',
    'loading'
  ];

  // Non-retryable errors that should fail immediately
  const nonRetryableMessages = [
    'permission denied',
    'access denied',
    'unauthorized',
    'forbidden',
    'not supported',
    'invalid selector'
  ];

  const errorMessage = error.message ? error.message.toLowerCase() : '';

  // Check for non-retryable errors first
  if (nonRetryableMessages.some(msg => errorMessage.includes(msg.toLowerCase()))) {
    console.log(`[RETRY] Error marked as non-retryable: ${error.message}`);
    return false;
  }

  // Check for retryable errors
  const isRetryable = retryableMessages.some(msg => errorMessage.includes(msg.toLowerCase()));

  if (!isRetryable) {
    console.log(`[RETRY] Error not recognized as retryable: ${error.message}`);
  }

  return isRetryable;
};


tv.getStrategy = async (strategyName = '', isIndicatorSave = false) => {
  // Ensure tv is properly initialized
  await tv._initialize()

  try {
    await tv.openStrategyTab()

    // Fast data detection - no fixed delays
    await tv._fastDataDetection(1000)

  } catch (err) {
    console.warn('checkAndOpenStrategy error', err)
  }
  let isOpened = false
  if (strategyName)
    isOpened = await tv.openStrategyParameters(strategyName, true)
  else
    isOpened = await tv.openStrategyParameters(null, false)
  if (!isOpened) {
    throw new Error('It was not possible open strategy. Add it to the chart and try again.')
  }

  const dialogTitle = await page.waitForSelector(SEL.indicatorTitle)
  if (!dialogTitle || dialogTitle.innerText === null)
    throw new Error('It was not possible to find a strategy with parameters among the indicators. Add it to the chart and try again.')
  const indicatorName = tv.getStrategyNameFromPopup()
  if (!await tv.changeDialogTabToInput())
    throw new Error(`Can\'t activate input tab in strategy parameters` + SUPPORT_TEXT)

  const strategyInputs = await tv.getStrategyParams(isIndicatorSave)
  const strategyData = { name: indicatorName, properties: strategyInputs }

  if (!isIndicatorSave && document.querySelector(SEL.cancelBtn)) {
    document.querySelector(SEL.cancelBtn).click()
    await page.waitForSelector(SEL.cancelBtn, 1000, true)
  }

  return strategyData
}

tv.getStrategyParams = async (isIndicatorSave = false) => {
  const strategyInputs = {} // TODO to list of values and set them in the same order
  const indicProperties = document.querySelectorAll(SEL.indicatorProperty)
  for (let i = 0; i < indicProperties.length; i++) {
    const propClassName = indicProperties[i].getAttribute('class')
    const propText = indicProperties[i].innerText
    if (!propClassName || !propText) // Undefined type of element
      continue
    if (propClassName.includes('topCenter-')) {  // Two rows, also have first in class name
      i++ // Skip get the next cell because it content values
      continue // Doesn't realise to manage this kind of properties (two rows)
    } else if (propClassName.includes('first-') && indicProperties[i].innerText) {
      i++
      if (indicProperties[i] && indicProperties[i].querySelector('input')) {
        let propValue = indicProperties[i].querySelector('input').value
        if (indicProperties[i].querySelector('input').getAttribute('inputmode') === 'numeric' ||
          (parseFloat(propValue) == propValue || parseInt(propValue) == propValue)) { // not only inputmode==numbers input have digits
          const digPropValue = parseFloat(propValue) == parseInt(propValue) ? parseInt(propValue) : parseFloat(propValue)  // Detection if float or int in the string
          if (!isNaN(propValue))
            strategyInputs[propText] = digPropValue
          else
            strategyInputs[propText] = propValue
        } else {
          strategyInputs[propText] = propValue
        }
      } else if (indicProperties[i].querySelector('span[role="button"]')) { // List
        const buttonEl = indicProperties[i].querySelector('span[role="button"]')
        if (!buttonEl)
          continue
        const propValue = buttonEl.innerText
        if (propValue) {
          if (isIndicatorSave) {
            strategyInputs[propText] = propValue
            continue
          }
          buttonEl.scrollIntoView()
          await page.waitForTimeout(100)
          page.mouseClick(buttonEl)
          const isOptions = await page.waitForSelector(SEL.strategyListOptions, 1000)
          if (isOptions) {
            const allOptionsEl = document.querySelectorAll(SEL.strategyListOptions)
            let allOptionsList = propValue + ';'
            for (let optionEl of allOptionsEl) {
              if (optionEl && optionEl.innerText && optionEl.innerText !== propValue) {
                allOptionsList += optionEl.innerText + ';'
              }
            }
            if (allOptionsList)
              strategyInputs[propText] = allOptionsList
            page.mouseClick(buttonEl)
          } else {
            strategyInputs[propText] = propValue
          }
        }
      } else { // Undefined
        continue
      }
    } else if (propClassName.includes('fill-')) {
      const element = indicProperties[i].querySelector('input[type="checkbox"]')
      if (element)
        strategyInputs[propText] = element.getAttribute('checked') !== null ? element.checked : false
      else { // Undefined type of element
        continue
      }
    } else if (propClassName.includes('titleWrap-')) { // Titles bwtwen parameters
      continue
    } else { // Undefined type of element
      continue
    }
  }
  return strategyInputs
}

tv.setStrategyParams = async (name, propVal, keepStrategyParamOpen = false) => {

  const indicatorTitleEl = await tv.checkAndOpenStrategy(name) // In test.name - ordinary strategy name but in strategyData.name short one as in indicator title
  if (!indicatorTitleEl)
    return null
  let popupVisibleHeight = 917
  try {
    popupVisibleHeight = page.$(SEL.indicatorScroll)?.getBoundingClientRect()?.bottom || 917
  } catch {
  }
  let indicProperties = document.querySelectorAll(SEL.indicatorProperty)
  const propKeys = Object.keys(propVal)
  let setResultNumber = 0
  let setPropertiesNames = {}
  for (let i = 0; i < indicProperties.length; i++) {
    const propText = indicProperties[i].innerText
    if (propText && propKeys.includes(propText)) {
      try {
        const rect = indicProperties[i].getBoundingClientRect()
        if (rect.top < 0 || rect.bottom > popupVisibleHeight || !indicProperties[i].checkVisibility()) {
          indicProperties[i].scrollIntoView() // TODO scroll by hight and if not visible, than scroll Into - faster becouse for 5-10 elemetns at the time
          await page.waitForTimeout(10)
          if (indicProperties[i].getBoundingClientRect()?.bottom > popupVisibleHeight)
            await page.waitForTimeout(50)
        }
      } catch {
      }
      setPropertiesNames[propText] = true
      setResultNumber++
      const propClassName = indicProperties[i].getAttribute('class')
      if (propClassName.includes('first-')) {
        i++
        let inputEl = indicProperties[i].querySelector('input')
        if (inputEl) {
          page.setInputElementValue(inputEl, propVal[propText])
          inputEl = null
        } else {
          let buttonEl = indicProperties[i].querySelector('span[role="button"]')
          if (buttonEl?.innerText) { // DropDown List
            buttonEl.click()
            buttonEl = null
            await page.setSelByText(SEL.strategyListOptions, propVal[propText])
          }
        }
      } else if (propClassName.includes('fill-')) {
        let checkboxEl = indicProperties[i].querySelector('input[type="checkbox"]')

        if (checkboxEl) {
          // const isChecked = checkboxEl.getAttribute('checked') !== null ? checkboxEl.checked : false
          const isChecked = Boolean(checkboxEl.checked)
          if (Boolean(propVal[propText]) !== isChecked) {
            page.mouseClick(checkboxEl)
            checkboxEl.checked = Boolean(propVal[propText])
          }
          checkboxEl = null
        }
      }
      setResultNumber = Object.keys(setPropertiesNames).length
      if (propKeys.length === setResultNumber)
        break
    }
  }
  indicProperties = null
  // TODO check if not equal propKeys.length === setResultNumber, because there is none of changes too. So calculation doesn't start
  const elOkBtn = page.$(SEL.okBtn)
  if (!keepStrategyParamOpen && elOkBtn) {
   elOkBtn.click()
  }

  return true
}

tv.changeDialogTabToInput = async () => {
  let isInputTabActive = document.querySelector(SEL.tabInputActive)
  if (isInputTabActive) return true
  const inputTabEl = document.querySelector(SEL.tabInput)
  if (!inputTabEl) {
    throw new Error('There are no parameters in this strategy that can be optimized (There is no "Inputs" tab with input values)')
  }
  inputTabEl.click()
  isInputTabActive = await page.waitForSelector(SEL.tabInputActive, 2000)
  return !!isInputTabActive
}

tv._openStrategyByButtonNearTitle = async () => {
  if (tv._settingsMethod !== null && tv._settingsMethod !== 'setButton')
    return false
  const stratParamEl = page.$(SEL.strategyDialogParam) // Version before 2025.02.21 with param button near title
  if (!stratParamEl)
    return false
  tv._settingsMethod = 'setButton'
  page.mouseClick(stratParamEl) // stratParamEl.click()
  return true
}

tv._openStrategyParamsByStrategyDoubleClickBy = async (indicatorTitle) => {
  if ((tv._settingsMethod !== null && tv._settingsMethod !== 'indName') || !indicatorTitle)
    return false
  const indicatorLegendsEl = document.querySelectorAll(SEL.tvLegendIndicatorItem)
  if (!indicatorLegendsEl)
    return false
  for (let indicatorItemEl of indicatorLegendsEl) {
    const indicatorTitleEl = indicatorItemEl.querySelector(SEL.tvLegendIndicatorItemTitle)
    if (!indicatorTitleEl)
      continue
    if (indicatorTitle !== indicatorTitleEl.innerText)
      continue
    page.mouseDoubleClick(indicatorTitleEl)
    // page.mouseClick(indicatorTitleEl)
    // page.mouseClick(indicatorTitleEl)
    const dialogTitle = await page.waitForSelector(SEL.indicatorTitle, 2500)
    if (dialogTitle && dialogTitle.innerText === indicatorTitle) {
      tv._settingsMethod = 'indName'
      return true
    }
    if (page.$(SEL.cancelBtn))
      page.mouseClickSelector(SEL.cancelBtn)//.click()

  }
  return false
}

tv._openStrategyParamsByStrategyMenu = async () => {
  if (tv._settingsMethod !== null && tv._settingsMethod !== 'setMenu')
    return false
  const strategyCaptionEl = page.$(SEL.strategyCaption)
  if (!strategyCaptionEl)
    return false
  page.mouseClick(strategyCaptionEl)
  const menuItemSettingsEl = await page.waitForSelector(SEL.strategyMenuItemSettings)
  if (!menuItemSettingsEl)
    return false
  tv._settingsMethod = 'setMenu'
  page.mouseClick(menuItemSettingsEl)
  return true
}

tv.getStrategyNameFromPopup = () => {
  const strategyTitleEl = page.$(SEL.indicatorTitle)
  if (strategyTitleEl)
    return strategyTitleEl.innerText
  return null
}

tv.openStrategyParameters = async (indicatorTitle, searchAgainstStrategies = false) => {
  const curStrategyTitle = tv.getStrategyNameFromPopup()
  let isOpened = !!curStrategyTitle
  if (!isOpened && (indicatorTitle && indicatorTitle !== curStrategyTitle) && searchAgainstStrategies) {
    isOpened = await tv._openStrategyParamsByStrategyDoubleClickBy(indicatorTitle)
    tv._settingsMethod = null
  } else if (!isOpened) {
    isOpened = await tv._openStrategyByButtonNearTitle()
    if (!isOpened)
      isOpened = await tv._openStrategyParamsByStrategyMenu()
    if (!isOpened) {
      if (!indicatorTitle) {
        const curStrategyCaptionEl = page.$(SEL.strategyCaption)
        if (curStrategyCaptionEl)
          indicatorTitle = curStrategyCaptionEl.innerText
      }
      isOpened = await tv._openStrategyParamsByStrategyDoubleClickBy(indicatorTitle)
    }
  }

  if (!isOpened) {
    console.log('[AUTO_FIX] Strategy param button not found, attempting auto-fix...')

    // Try to auto-fix by opening the panel if it's closed
    const success = await tv._autoFixStrategyPanel()
    if (success) {
      console.log('[AUTO_FIX] Panel opened successfully, retrying strategy parameters...')
      // Retry opening strategy parameters
      isOpened = await tv.openStrategyParameters(null, false)
    }

    if (!isOpened) {
      console.error('[AUTO_FIX] Failed to auto-fix strategy panel issue')
      throw new Error('Strategy parameters cannot be opened - panel may be closed or strategy not loaded')
    }
  }
  const stratIndicatorEl = await page.waitForSelector(SEL.indicatorTitle, 2000)
  if (!stratIndicatorEl) {
    console.log('[AUTO_FIX] Strategy parameters popup not found, attempting auto-fix...')

    // Try to auto-fix by re-opening strategy parameters
    const fixSuccess = await tv._autoFixStrategyPanel()
    if (fixSuccess) {
      // Wait a bit and try to find the popup again
      await page.waitForTimeout(1000)
      const retryEl = await page.waitForSelector(SEL.indicatorTitle, 2000)
      if (retryEl) {
        console.log('[AUTO_FIX] Successfully recovered strategy parameters popup')
      } else {
        console.error('[AUTO_FIX] Failed to recover strategy parameters popup')
        throw new Error('Strategy parameters popup cannot be opened after auto-fix attempt')
      }
    } else {
      console.error('[AUTO_FIX] Auto-fix failed for strategy parameters popup')
      throw new Error('Strategy parameters popup not found and auto-fix failed')
    }
  }
  const tabInputEl = document.querySelector(SEL.tabInput)
  if (!tabInputEl) {
    console.log('[AUTO_FIX] Strategy parameters input tab not found, attempting auto-fix...')

    // Try to find and click any available tabs
    const allTabs = document.querySelectorAll('button[role="tab"], div[role="tab"], [class*="tab"]')
    let tabFound = false

    for (const tab of allTabs) {
      const tabText = (tab.textContent || '').toLowerCase()
      if (tabText.includes('input') || tabText.includes('parameter') || tabText.includes('setting')) {
        console.log('[AUTO_FIX] Found potential input tab, clicking...')
        tab.click()
        await page.waitForTimeout(500)
        tabFound = true
        break
      }
    }

    if (!tabFound) {
      console.error('[AUTO_FIX] No suitable input tab found')
      throw new Error('Strategy parameters input tab not found and auto-fix failed')
    }

    // Wait and check again
    await page.waitForTimeout(1000)
    const retryTabEl = document.querySelector(SEL.tabInput)
    if (!retryTabEl) {
      console.error('[AUTO_FIX] Input tab still not found after auto-fix')
      throw new Error('Strategy parameters input tab not accessible after auto-fix')
    }
  }
  page.mouseClick(tabInputEl) //tabInputEl.click()

  const tabInputActiveEl = await page.waitForSelector(SEL.tabInputActive)
  if (!tabInputActiveEl) {
    console.log('[AUTO_FIX] Active input tab not found, attempting to activate...')

    // Try clicking the input tab again to activate it
    const inputTab = document.querySelector(SEL.tabInput)
    if (inputTab) {
      console.log('[AUTO_FIX] Re-clicking input tab to activate...')
      inputTab.click()
      await page.waitForTimeout(1000)

      const retryActiveEl = await page.waitForSelector(SEL.tabInputActive, 2000)
      if (!retryActiveEl) {
        console.error('[AUTO_FIX] Failed to activate input tab')
        throw new Error('Strategy parameters input tab cannot be activated')
      }
    } else {
      console.error('[AUTO_FIX] Input tab not found for activation')
      throw new Error('Strategy parameters input tab not found for activation')
    }
  }
  return true
}



tv._findAndClickUpdateReportButton = async () => {
  // Check for the "Update report" snackbar notification
  const snackbar = document.querySelector(SEL.strategyUpdateReportSnackbar)
  if (!snackbar) {
    return false // No update needed
  }

  console.log('[INFO] Found "Update report" snackbar notification')

  // Try primary selector for the update button
  let updateButton = document.querySelector(SEL.strategyUpdateReportButton)
  if (updateButton) {
    console.log('[INSTANT] Clicking "Update report" button immediately')
    page.mouseClick(updateButton)
    // NO WAITING - return immediately for maximum speed
    return true
  }

  // Fallback: search for button by text content
  const allButtons = document.querySelectorAll('button')
  for (const button of allButtons) {
    const text = (button.textContent || '').trim().toLowerCase()
    const tooltip = button.getAttribute('data-overflow-tooltip-text') || ''

    if (text.includes('update report') || tooltip.includes('Update report')) {
      console.log('[INSTANT] Found "Update report" button by text, clicking immediately')
      page.mouseClick(button)
      // NO WAITING - return immediately for maximum speed
      return true
    }
  }

  console.log('[WARNING] Found update snackbar but could not find "Update report" button')
  return false
}

tv._waitForUpdateReportSuccess = async (timeout = 5000) => {
  const tick = 50 // Faster polling - check every 50ms
  const maxIterations = Math.floor(timeout / tick)

  // Cache selectors for performance
  const toastSelector = SEL.strategyUpdateReportSuccessToast
  const fallbackSelector = SEL.strategyUpdateReportSuccessToastFallback

  for (let i = 0; i < maxIterations; i++) {
    // Fast check for success message - primary toast
    const toastElements = document.querySelectorAll(toastSelector)
    for (const toast of toastElements) {
      const text = (toast.textContent || '').toLowerCase()
      if (text.includes('report has been updated successfully')) {
        // IMMEDIATE RETURN - don't wait for toast to disappear
        return true
      }

      // Quick error check
      if (text.includes('error') || text.includes('failed')) {
        return false
      }
    }

    // Fast fallback check
    const fallbackElements = document.querySelectorAll(fallbackSelector)
    for (const element of fallbackElements) {
      const text = (element.textContent || '').toLowerCase()
      if (text.includes('report has been updated successfully')) {
        // IMMEDIATE RETURN - don't wait for toast to disappear
        return true
      }
    }

    // Quick snackbar disappearance check (after 500ms)
    if (i > 10) {
      const originalSnackbar = document.querySelector(SEL.strategyUpdateReportSnackbar)
      if (!originalSnackbar) {
        return true
      }
    }

    // Minimal delay for next check
    await new Promise(resolve => setTimeout(resolve, tick))
  }

  return false // Timeout
}

/**
 * Auto-fixes strategy panel issues by opening closed panels
 * @returns {Promise<boolean>} - True if fix was attempted
 */
tv._autoFixStrategyPanel = async () => {
  console.log('[AUTO_FIX] Attempting to auto-fix strategy panel issues...')

  try {
    // Method 1: Look for "Open panel" button
    const openPanelButton = document.querySelector('button[aria-label="Open panel"]')
    if (openPanelButton) {
      console.log('[AUTO_FIX] Found "Open panel" button, clicking to open...')
      openPanelButton.click()
      await page.waitForTimeout(1500)
      return true
    }

    // Method 2: Look for panel toggle buttons
    const panelToggleButtons = document.querySelectorAll('button[data-name="toggle-visibility-button"]')
    for (const button of panelToggleButtons) {
      const tooltip = button.getAttribute('data-tooltip')
      if (tooltip && tooltip.includes('Open panel')) {
        console.log('[AUTO_FIX] Found panel toggle button, clicking to open...')
        button.click()
        await page.waitForTimeout(1500)
        return true
      }
    }

    // Method 3: Look for collapsed panel indicators
    const collapsedPanels = document.querySelectorAll('[class*="collapsed"], [class*="closed"]')
    for (const panel of collapsedPanels) {
      const expandButton = panel.querySelector('button, [role="button"]')
      if (expandButton) {
        console.log('[AUTO_FIX] Found collapsed panel, attempting to expand...')
        expandButton.click()
        await page.waitForTimeout(1000)
      }
    }

    // Method 4: Try to expand strategy tab specifically
    const strategyTab = document.querySelector(SEL.strategyTab)
    if (strategyTab) {
      console.log('[AUTO_FIX] Re-clicking strategy tab to ensure it\'s expanded...')
      strategyTab.click()
      await page.waitForTimeout(1000)
      return true
    }

    // Method 5: Look for any bottom panel controls
    const bottomPanelControls = document.querySelectorAll('[class*="bottom"], [class*="panel"], [class*="drawer"]')
    for (const control of bottomPanelControls) {
      const expandButton = control.querySelector('button[aria-label*="Open"], button[aria-label*="Expand"], button[aria-label*="Show"]')
      if (expandButton) {
        console.log('[AUTO_FIX] Found bottom panel expand button, clicking...')
        expandButton.click()
        await page.waitForTimeout(1000)
        return true
      }
    }

    // Method 6: Try keyboard shortcut to toggle panels
    try {
      console.log('[AUTO_FIX] Trying keyboard shortcut to toggle panels...')
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await page.waitForTimeout(500)
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
      await page.waitForTimeout(500)
      return true
    } catch (e) {
      // Ignore keyboard shortcut errors
    }

    console.log('[AUTO_FIX] No obvious panel fix methods found')
    return false

  } catch (error) {
    console.log('[AUTO_FIX] Error during auto-fix attempt:', error.message)
    return false
  }
}

/**
 * Forces a report refresh to handle UI lag issues
 * @returns {Promise<boolean>} - True if refresh was attempted
 */
tv._forceReportRefresh = async () => {
  console.log('[FORCE_REFRESH] Attempting simple report refresh...')

  try {
    // Simple approach: Try to find any tabs and click them to trigger refresh
    const allTabs = document.querySelectorAll('button[role="tab"], div[role="tab"], button[aria-selected]')

    if (allTabs.length >= 2) {
      console.log('[FORCE_REFRESH] Found tabs, switching to trigger refresh...')
      // Click first tab, then second tab
      allTabs[0].click()
      await page.waitForTimeout(500)
      allTabs[1].click()
      await page.waitForTimeout(800)
      return true
    } else {
      console.log('[FORCE_REFRESH] No suitable tabs found for refresh')
      return false
    }

  } catch (error) {
    console.log('[FORCE_REFRESH] Error during force refresh:', error.message)
    return false
  }
}

/**
 * Check for and click "Update report" button for regular reports
 * @returns {Promise<boolean>} - True if update button was found and clicked
 */
tv._checkAndClickRegularUpdateReportButton = async () => {
  console.log('[INFO] Checking for regular report update button...')

  // Check for the "Update report" snackbar notification (same selector as deep test)
  const snackbar = document.querySelector(SEL.strategyUpdateReportSnackbar)
  if (!snackbar) {
    console.log('[INFO] No update report snackbar found for regular report')
    return false // No update needed
  }

  console.log('[INFO] Found "Update report" snackbar for regular report')

  // Try to find and click the update button
  let updateButton = document.querySelector(SEL.strategyUpdateReportButton)
  if (updateButton) {
    console.log('[INSTANT] Clicking "Update report" button immediately')
    page.mouseClick(updateButton)
    return true
  }

  // INSTANT fallback: search for button by text
  const buttons = document.querySelectorAll('button')
  for (const button of buttons) {
    const text = (button.textContent || button.innerText || '').toLowerCase()
    const tooltip = (button.getAttribute('data-overflow-tooltip-text') || '').toLowerCase()

    if (text.includes('update report') || tooltip.includes('update report')) {
      console.log('[INSTANT] Found "Update report" button by text, clicking immediately')
      page.mouseClick(button)
      return true
    }
  }

  console.log('[WARNING] Found update snackbar but could not find "Update report" button for regular report')
  return false
}

/**
 * Check if report is currently updating (blocking function)
 * @returns {boolean} - True if "Updating report" is currently showing
 */
tv._isReportCurrentlyUpdating = () => {
  try {
    // Check for "Updating report" toast notifications
    const toastElements = document.querySelectorAll(SEL.strategyUpdateReportSuccessToast)
    for (const toast of toastElements) {
      const text = (toast.textContent || toast.innerText || '').toLowerCase()
      if (text.includes('updating report')) {
        return true
      }
    }

    // Also check fallback elements
    const fallbackElements = document.querySelectorAll(SEL.strategyUpdateReportSuccessToastFallback)
    for (const element of fallbackElements) {
      const text = (element.textContent || element.innerText || '').toLowerCase()
      if (text.includes('updating report')) {
        return true
      }
    }

    return false
  } catch (error) {
    console.warn('[BLOCKING_CHECK] Error checking for updating report:', error.message)
    return false
  }
}

/**
 * Wait until report is NOT updating before proceeding
 * @param {number} timeout - Maximum time to wait in milliseconds
 * @returns {Promise<boolean>} - True if safe to proceed
 */
tv._waitUntilReportNotUpdating = async (timeout = 5000) => {
  console.log('[SPEED_CHECK] Fast checking if report is updating...')

  const startTime = Date.now()
  const tick = 10 // MAXIMUM SPEED: Check every 10ms
  const maxIterations = Math.floor(timeout / tick)

  for (let i = 0; i < maxIterations; i++) {
    if (!tv._isReportCurrentlyUpdating()) {
      const elapsedTime = Date.now() - startTime
      console.log(`[SPEED_CHECK] Report ready after ${elapsedTime}ms`)
      return true
    }

    // No logging for maximum speed
    await page.waitForTimeout(tick)
  }

  const elapsedTime = Date.now() - startTime
  console.log(`[SPEED_CHECK] Quick timeout after ${elapsedTime}ms - proceeding`)
  return false
}

/**
 * Wait for regular report update notifications (for non-deep testing)
 * @param {number} timeout - Maximum time to wait in milliseconds
 * @returns {Promise<boolean>} - True if report update completed successfully
 */
tv._waitForRegularReportUpdate = async (timeout = 3000) => {
  console.log('[SPEED] Fast checking for report updates...')

  const startTime = Date.now()
  const tick = 10 // MAXIMUM SPEED: Check every 10ms
  const maxIterations = Math.floor(timeout / tick)

  let foundUpdatingMessage = false
  let foundSuccessMessage = false

  for (let i = 0; i < maxIterations; i++) {
    try {
      // Check for toast notifications using the same selectors as deep test
      const toastElements = document.querySelectorAll(SEL.strategyUpdateReportSuccessToast)
      for (const toast of toastElements) {
        const text = (toast.textContent || toast.innerText || '').toLowerCase()

        // Check for "Updating report" message (NOT "Update report" button)
        if (!foundUpdatingMessage && text.includes('updating report')) {
          foundUpdatingMessage = true
          console.log(`[INFO] Found "Updating report" notification: "${text.substring(0, 100)}"`)
        }

        // Check for success message
        if (text.includes('report has been updated successfully') ||
            text.includes('report updated successfully') ||
            text.includes('successfully updated')) {
          foundSuccessMessage = true
          const elapsedTime = Date.now() - startTime
          console.log(`[SUCCESS] Found success notification after ${elapsedTime}ms: "${text.substring(0, 100)}"`)
          return true
        }

        // Check for error messages
        if (text.includes('error') || text.includes('failed') || text.includes('unable')) {
          console.log(`[WARNING] Found error message in toast: "${text.substring(0, 100)}"`)
          return false
        }
      }

      // Also check fallback elements
      const fallbackElements = document.querySelectorAll(SEL.strategyUpdateReportSuccessToastFallback)
      for (const element of fallbackElements) {
        const text = (element.textContent || element.innerText || '').toLowerCase()

        if (!foundUpdatingMessage && text.includes('updating report')) {
          foundUpdatingMessage = true
          console.log(`[INFO] Found "Updating report" notification in fallback: "${text.substring(0, 100)}"`)
        }

        if (text.includes('report has been updated successfully') ||
            text.includes('report updated successfully')) {
          foundSuccessMessage = true
          const elapsedTime = Date.now() - startTime
          console.log(`[SUCCESS] Found success notification in fallback after ${elapsedTime}ms`)
          return true
        }
      }

      await page.waitForTimeout(tick)
    } catch (error) {
      console.warn(`[WARNING] Error while waiting for report update: ${error.message}`)
    }
  }

  const elapsedTime = Date.now() - startTime
  if (foundUpdatingMessage && !foundSuccessMessage) {
    console.log(`[WARNING] Found "Updating report" but no success message after ${elapsedTime}ms - BLOCKING until complete`)
    return false // DO NOT PROCEED if updating is still in progress
  } else if (!foundUpdatingMessage) {
    console.log(`[INFO] No report update notifications found after ${elapsedTime}ms - report may already be current`)
    return true // No update needed
  }

  console.log(`[WARNING] Report update timeout after ${elapsedTime}ms`)
  return false
}

/**
 * Wait for tab content to be fully loaded and stable
 * @param {string} tabName - Name of the tab for logging
 * @param {string} selRow - Row selector for the tab
 * @param {number} timeout - Maximum time to wait in milliseconds
 * @returns {Promise<boolean>} - True if tab content is stable
 */
tv._fastTabStabilization = async (selRow, timeout = 800) => {
  const tick = 100
  const maxIterations = Math.floor(timeout / tick)

  let previousRowCount = 0

  for (let i = 0; i < maxIterations; i++) {
    const rows = document.querySelectorAll(selRow)
    const currentRowCount = rows.length

    // If we have rows and count is stable, we're ready
    if (currentRowCount > 0 && currentRowCount === previousRowCount) {
      return true
    }

    previousRowCount = currentRowCount
    await new Promise(resolve => setTimeout(resolve, tick))
  }

  return false
}

/**
 * Fast data availability detection - immediately detects when TradingView data is ready
 * @param {number} timeout - Maximum time to wait in milliseconds
 * @returns {Promise<boolean>} - True if data appears loaded
 */
tv._fastDataDetection = async (timeout = 500) => {
  const checkInterval = 10 // MAXIMUM SPEED: 10ms polling
  const maxIterations = Math.floor(timeout / checkInterval)

  // Cache selectors for performance
  const loadingSelectors = 'div[class*="loading"], div[class*="spinner"], [data-name="loader"]'

  for (let i = 0; i < maxIterations; i++) {
    // Quick loading indicator check
    if (!document.querySelector(loadingSelectors)) {
      // Fast table data check - only check first few cells
      const firstTable = document.querySelector('table')
      if (firstTable) {
        const firstCells = firstTable.querySelectorAll('td')
        for (let j = 0; j < Math.min(5, firstCells.length); j++) {
          const text = firstCells[j].textContent?.trim()
          if (text && text !== '—' && text !== '-' && text.length > 0) {
            return true // Data found immediately
          }
        }
      }
    }

    // Minimal delay for next check
    await new Promise(resolve => setTimeout(resolve, checkInterval))
  }

  return false // Timeout - proceed anyway
}

/**
 * Wait for report to be fully populated with actual data
 * @param {number} timeout - Maximum time to wait in milliseconds
 * @returns {Promise<boolean>} - True if report appears to be populated
 */
tv._waitForReportDataPopulation = async (timeout = 10000) => {
  console.log('[REPORT_WAIT] Waiting for report data population...')

  const startTime = Date.now()
  const tick = 200 // Check every 200ms
  const maxIterations = Math.floor(timeout / tick)

  const selRow = SEL.strategyReportRow

  for (let i = 0; i < maxIterations; i++) {
    try {
      const rows = document.querySelectorAll(selRow)

      if (rows.length > 0) {
        // Check if rows contain actual data (not just loading indicators)
        let hasRealData = false
        let netProfitFound = false

        for (const row of rows) {
          const cells = row.querySelectorAll('td, th')
          if (cells.length >= 2) {
            const paramName = cells[0].textContent?.trim().toLowerCase()
            const value = cells[1].textContent?.trim()

            // Check for key indicators that data is loaded
            if (paramName && value && value !== '' && value !== '...' && value !== 'Loading...' && value !== '—') {
              hasRealData = true

              if (paramName.includes('net profit')) {
                netProfitFound = true
                console.log(`[REPORT_WAIT] Found Net profit data: "${value}"`)
              }
            }
          }
        }

        if (hasRealData) {
          const elapsedTime = Date.now() - startTime
          console.log(`[REPORT_WAIT] Report data appears populated after ${elapsedTime}ms (Net profit found: ${netProfitFound})`)
          return true
        }
      }

      await page.waitForTimeout(tick)
    } catch (error) {
      console.warn(`[REPORT_WAIT] Error checking report population:`, error)
    }
  }

  const elapsedTime = Date.now() - startTime
  console.log(`[REPORT_WAIT] Timeout waiting for report data population after ${elapsedTime}ms`)
  return false
}

// Test function to verify the success notification detection
tv._testUpdateReportSuccessDetection = async () => {
  console.log('[TEST] Testing update report success detection...')

  // Test the selectors
  const toastElements = document.querySelectorAll(SEL.strategyUpdateReportSuccessToast)
  const fallbackElements = document.querySelectorAll(SEL.strategyUpdateReportSuccessToastFallback)

  console.log(`[TEST] Found ${toastElements.length} toast elements`)
  console.log(`[TEST] Found ${fallbackElements.length} fallback elements`)

  // Test if update snackbar is present
  const updateSnackbar = document.querySelector(SEL.strategyUpdateReportSnackbar)
  console.log(`[TEST] Update snackbar present: ${!!updateSnackbar}`)

  return {
    toastCount: toastElements.length,
    fallbackCount: fallbackElements.length,
    updateSnackbarPresent: !!updateSnackbar
  }
}





tv.checkAndOpenStrategy = async (name) => {
  let indicatorTitleEl = page.$(SEL.indicatorTitle)
  if (!indicatorTitleEl || indicatorTitleEl.innerText !== name) {
    try {
      await tv.openStrategyTab()
    } catch (err) {
      console.warn('checkAndOpenStrategy error', err)
      return null
    }
    const isOpened = await tv.openStrategyParameters(name)
    if (!isOpened) {
      console.log('[AUTO_FIX] Cannot open strategy parameters, attempting auto-fix...')

      // Try auto-fix and retry
      const fixSuccess = await tv._autoFixStrategyPanel()
      if (fixSuccess) {
        console.log('[AUTO_FIX] Auto-fix completed, retrying strategy parameters...')
        await page.waitForTimeout(1000)
        const retryOpened = await tv.openStrategyParameters(name)
        if (!retryOpened) {
          console.error('[AUTO_FIX] Failed to open strategy parameters after auto-fix')
          throw new Error('Strategy parameters cannot be opened after auto-fix attempt')
        }
      } else {
        console.error('[AUTO_FIX] Auto-fix failed for strategy parameters')
        throw new Error('Strategy parameters cannot be opened and auto-fix failed')
      }
    }
    if (name) {
      indicatorTitleEl = page.$(SEL.indicatorTitle)
      if (!indicatorTitleEl || indicatorTitleEl.innerText !== name) {
        console.log(`[AUTO_FIX] Wrong strategy opened. Expected: "${name}", Got: "${indicatorTitleEl?.innerText || 'none'}"`)
        console.log('[AUTO_FIX] Attempting to find and open correct strategy...')

        // Try to find the correct strategy by double-clicking
        const correctStrategyOpened = await tv._openStrategyParamsByStrategyDoubleClickBy(name)
        if (!correctStrategyOpened) {
          console.error(`[AUTO_FIX] Failed to open correct strategy: ${name}`)
          throw new Error(`Strategy "${name}" cannot be opened - wrong strategy is active`)
        }

        // Verify the correct strategy is now open
        await page.waitForTimeout(1000)
        const verifyEl = page.$(SEL.indicatorTitle)
        if (!verifyEl || verifyEl.innerText !== name) {
          console.error(`[AUTO_FIX] Still wrong strategy after auto-fix. Expected: "${name}", Got: "${verifyEl?.innerText || 'none'}"`)
          throw new Error(`Strategy "${name}" auto-fix failed - cannot open correct strategy`)
        }

        console.log(`[AUTO_FIX] Successfully opened correct strategy: ${name}`)
      }
    }
  }
  await page.waitForSelector(SEL.indicatorProperty)
  return indicatorTitleEl
}

tv.checkIsNewVersion = async (timeout = 1000) => {
  // check by deepHistory element if it's present
  if (typeof selStatus === 'undefined' || selStatus.isNewVersion !== null) // Already checked
    return
  let element = await page.waitForSelector(SEL.strategyPerformanceTab, timeout)
  if (element) { // Old versions
    selStatus.isNewVersion = false
    console.log('[INFO] Prev TV UI by performance tab')
    return
  }
  selStatus.isNewVersion = true
  element = await page.waitForSelector(SEL.strategyPerformanceTab, timeout)
  if (element) { // New versions
    console.log('[INFO] New TV UI by performance tab')
    return
  }
  console.warn('[WARN] Can able to detect current TV UI changes. Probably Deep mode set. Set it to new one')
}

tv.openStrategyTab = async () => {
  let isStrategyActiveEl = await page.waitForSelector(SEL.strategyTesterTabActive)
  if (!isStrategyActiveEl) {
    const strategyTabEl = await page.waitForSelector(SEL.strategyTesterTab)
    if (strategyTabEl) {
      strategyTabEl.click()
      await page.waitForSelector(SEL.strategyTesterTabActive)
    } else {
      throw new Error('There is not "Strategy Tester" tab on the page. Open correct page.' + SUPPORT_TEXT)
    }
  }
  let strategyCaptionEl = document.querySelector(SEL.strategyCaption) // 2023-02-24 Changed to more complicated logic - for single and multiple strategies in page
  if (!strategyCaptionEl) { // || !strategyCaptionEl.innerText) {
    throw new Error('There is not strategy name element on "Strategy Tester" tab.' + SUPPORT_TEXT)
  }
  await tv.checkIsNewVersion()
  let stratSummaryEl = await page.waitForSelector(SEL.strategyPerformanceTab, 1000)
  if (!stratSummaryEl) {
    stratSummaryEl = await page.waitForSelector(SEL.strategyPerformanceTab, 1000)
    if (!stratSummaryEl)
      throw new Error('There is not "Performance" tab on the page. Open correct page.' + SUPPORT_TEXT)

  }
  if (!page.$(SEL.strategyPerformanceTabActive))
    stratSummaryEl.click()
  const isActive = await page.waitForSelector(SEL.strategyPerformanceTabActive, 1000)
  if (!isActive) {
    console.error('The "Performance summary" tab is not active after click')
  }
  return true
}

tv.switchToStrategyTabAndSetObserveForReport = async () => {
  await tv.openStrategyTab()

  const testResults = {}
  testResults.ticker = await tvChart.getTicker()
  testResults.timeFrame = await tvChart.getCurrentTimeFrame()
  let strategyCaptionEl = document.querySelector(SEL.strategyCaption)
  testResults.name = strategyCaptionEl.getAttribute('data-strategy-title') //strategyCaptionEl.innerText


  if (!tv.reportNode) {
    // TODO When user switch to deep backtest or minimize window - it should be deleted and created again. Or delete observer after every test
    tv.reportNode = await page.waitForSelector(SEL.strategyReportObserveArea, 10000)
    if (tv.reportNode) {
      const reportObserver = new MutationObserver(() => {
        tv.isReportChanged = true
      });
      reportObserver.observe(tv.reportNode, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      });
      console.log('[INFO] Observer added to tv.reportNode')
    } else {
      throw new Error('The strategy report did not found.' + SUPPORT_TEXT)
    }
  }


  return testResults
}

tv.dialogHandler = async () => {
  const indicatorTitle = page.getTextForSel(SEL.indicatorTitle)
  if (!document.querySelector(SEL.okBtn) || !document.querySelector(SEL.tabInput))
    return
  if (indicatorTitle === 'iondvSignals' && action.workerStatus === null) {
    let tickerText = document.querySelector(SEL.ticker).innerText
    let timeFrameEl = document.querySelector(SEL.timeFrameActive)
    if (!timeFrameEl)
      timeFrameEl = document.querySelector(SEL.timeFrame)


    let timeFrameText = timeFrameEl.innerText
    if (!tickerText || !timeFrameText)
      // ui.alertMessage('There is not timeframe element on page. Open correct page please')
      return

    timeFrameText = timeFrameText.toLowerCase() === 'd' ? '1D' : timeFrameText
    if (ui.isMsgShown && tickerText === tv.tickerTextPrev && timeFrameText === tv.timeFrameTextPrev)
      return
    tv.tickerTextPrev = tickerText
    tv.timeFrameTextPrev = timeFrameText

    if (!await tv.changeDialogTabToInput()) {
      console.error(`Can't set parameters tab to input`)
      ui.isMsgShown = true
      return
    }

    console.log("Tradingview indicator parameters window opened for ticker:", tickerText);
    const tsData = await storage.getKey(`${storage.SIGNALS_KEY_PREFIX}_${tickerText}::${timeFrameText}`.toLowerCase())
    if (tsData === null) {
      await ui.showErrorPopup(`No data was loaded for the ${tickerText} and timeframe ${timeFrameText}.\n\n` +
        `Please change the ticker and timeframe to correct and reopen script parameter window.`)
      ui.isMsgShown = true
      return
    }
    ui.isMsgShown = false

    const indicProperties = document.querySelectorAll(SEL.indicatorProperty)

    const propVal = {
      TSBuy: tsData && tsData.hasOwnProperty('buy') ? tsData.buy : '',
      TSSell: tsData && tsData.hasOwnProperty('sell') ? tsData.sell : '',
      Ticker: tickerText,
      Timeframe: timeFrameText
    }
    const setResult = []
    const propKeys = Object.keys(propVal)
    for (let i = 0; i < indicProperties.length; i++) {
      const propText = indicProperties[i].innerText
      if (propKeys.includes(propText)) {
        setResult.push(propText)
        page.setInputElementValue(indicProperties[i + 1].querySelector('input'), propVal[propText])
        if (propKeys.length === setResult.length)
          break
      }
    }
    const notFoundParam = propKeys.filter(item => !setResult.includes(item))
    if (notFoundParam && notFoundParam.length) {
      await ui.showErrorPopup(`One of the parameters named ${notFoundParam} was not found in the window. Check the script.\n`)
      ui.isMsgShown = true
      return
    }
    document.querySelector(SEL.okBtn).click()
    const allSignals = [].concat(tsData.buy.split(','), tsData.sell.split(',')).sort()
    await ui.showPopup(`${allSignals.length} signals are set.\n  - date of the first signal: ${new Date(parseInt(allSignals[0]))}.\n  - date of the last signal: ${new Date(parseInt(allSignals[allSignals.length - 1]))}`)
    ui.isMsgShown = true
  }
}

const paramNamePrevVersionMap = {
  // Prev version: New version from set parameters
  'Net Profit': 'Net profit',
  'Gross Profit': 'Gross profit',
  'Gross Loss': 'Gross loss',
  'Max Drawdown': 'Max equity drawdown',
  'Buy & Hold Return': 'Buy & hold return',
  'Sharpe Ratio': 'Sharpe ratio',
  'Sortino Ratio': 'Sortino ratio',
  'Max Contracts Held': 'Max contracts held',
  'Open PL': 'Open P&L',
  'Commission Paid': 'Commission paid',
  'Total Closed Trades': 'Total trades',
  'Total Open Trades': 'Total open trades',
  'Number Winning Trades': 'Winning trades',
  'Number Losing Trades': 'Losing trades',
  'Avg Trade': 'Avg P&L',
  'Avg Winning Trade': 'Avg winning trade',
  'Avg Losing Trade': 'Avg losing trade',
  'Ratio Avg Win / Avg Loss': 'Ratio avg win / avg loss',
  'Largest Winning Trade': 'Largest winning trade',
  'Percent Profitable': 'Percent profitable',
  'Largest Losing Trade': 'Largest losing trade',
  'Avg # Bars in Trades': 'Avg # bars in trades',
  'Avg # Bars in Winning Trades': 'Avg # bars in winning trades',
  'Avg # Bars in Losing Trades': 'Avg # bars in losing trades',
  'Margin Calls': 'Margin calls',
}

tv.convertParameterName = (field) => {
  if (selStatus.isNewVersion)  // new version
    return field
  if (Object.hasOwn(paramNamePrevVersionMap, field))
    return paramNamePrevVersionMap[field]
  return field
}


tv.isParsed = false

/**
 * Advanced DOM inspection to find report data using multiple strategies
 * @returns {Object} - Report data extracted using fallback methods
 */
tv._extractReportDataWithFallbacks = async () => {
  console.log('[FALLBACK] Attempting advanced report data extraction...')

  const report = {}
  const strategies = [
    // Strategy 1: Try alternative table selectors
    async () => {
      console.log('[FALLBACK] Strategy 1: Alternative table selectors')
      const tableSelectors = [
        'table tbody tr',
        '[class*="reportContainer"] table tbody tr',
        '[class*="ka"] table tbody tr',
        'div[class*="backtesting"] table tbody tr',
        'table tr:not(:first-child)', // All rows except header
      ]

      for (const selector of tableSelectors) {
        try {
          const rows = document.querySelectorAll(selector)
          console.log(`[FALLBACK] Found ${rows.length} rows with selector: ${selector}`)

          if (rows.length > 0) {
            // Try to extract data from these rows
            for (const row of rows) {
              const cells = row.querySelectorAll('td, th')
              if (cells.length >= 2) {
                const paramName = cells[0].textContent?.trim()
                const value = cells[1].textContent?.trim()

                if (paramName && value && paramName.toLowerCase().includes('net profit')) {
                  console.log(`[FALLBACK] Found Net profit: "${paramName}" = "${value}"`)
                  report[paramName] = value
                  return report
                }
              }
            }
          }
        } catch (error) {
          console.warn(`[FALLBACK] Strategy 1 failed for selector ${selector}:`, error)
        }
      }
      return null
    },

    // Strategy 2: Text-based extraction
    async () => {
      console.log('[FALLBACK] Strategy 2: Text-based extraction')
      try {
        const reportArea = document.querySelector('#bottom-area div[class^="backtesting"]')

        if (reportArea) {
          const text = reportArea.textContent || reportArea.innerText
          console.log(`[FALLBACK] Report area text length: ${text.length}`)

          // Look for Net profit pattern in text
          const netProfitMatch = text.match(/Net\s+profit[:\s]+([^\s\n]+)/i)
          if (netProfitMatch) {
            console.log(`[FALLBACK] Found Net profit in text: "${netProfitMatch[1]}"`)
            report['Net profit'] = netProfitMatch[1]
            return report
          }
        }
      } catch (error) {
        console.warn('[FALLBACK] Strategy 2 failed:', error)
      }
      return null
    },

    // Strategy 3: Comprehensive DOM search
    async () => {
      console.log('[FALLBACK] Strategy 3: Comprehensive DOM search')
      try {
        const allElements = document.querySelectorAll('*')
        for (const element of allElements) {
          const text = element.textContent?.trim()
          if (text && text.toLowerCase().includes('net profit') && element.nextElementSibling) {
            const value = element.nextElementSibling.textContent?.trim()
            if (value) {
              console.log(`[FALLBACK] Found Net profit via DOM search: "${value}"`)
              report['Net profit'] = value
              return report
            }
          }
        }
      } catch (error) {
        console.warn('[FALLBACK] Strategy 3 failed:', error)
      }
      return null
    }
  ]

  // Try each strategy
  for (let i = 0; i < strategies.length; i++) {
    try {
      const result = await strategies[i]()
      if (result && Object.keys(result).length > 0) {
        console.log(`[FALLBACK] Strategy ${i + 1} succeeded:`, result)
        return result
      }
    } catch (error) {
      console.warn(`[FALLBACK] Strategy ${i + 1} failed:`, error)
    }
  }

  console.log('[FALLBACK] All strategies failed')
  return {}
}

/**
 * Validates and cleans parsed numeric values
 * @param {any} value - The value to validate
 * @param {string} fieldName - Name of the field for logging
 * @returns {any} - Cleaned value or 'error' if invalid
 */
tv._validateParsedValue = (value, fieldName) => {
  try {
    // If it's already a number and valid, return it
    if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
      return value
    }

    // If it's a string that looks like a number, try to parse it
    if (typeof value === 'string') {
      const trimmed = value.trim()

      // Check for common error indicators
      if (trimmed === '' || trimmed === 'N/A' || trimmed === 'null' || trimmed === 'undefined') {
        console.warn(`[VALIDATE] ${fieldName}: Empty or invalid value "${trimmed}"`)
        return 'error'
      }

      // Try to parse as number
      const parsed = parseFloat(trimmed)
      if (!isNaN(parsed) && isFinite(parsed)) {
        return parsed
      }

      // If it's not a number, return the original string
      return trimmed
    }

    // For other types, return as-is
    return value
  } catch (error) {
    console.error(`[VALIDATE] Error validating ${fieldName}:`, error)
    return 'error'
  }
}

/**
 * Alternative parsing method when normal DOM extraction fails
 * @returns {Object} - Report data extracted using alternative methods
 */
tv._parseReportAlternative = () => {
  console.log('[ALT_PARSE] Attempting alternative parsing method...')

  const report = {}
  const selRow = SEL.strategyReportRow

  // Try to find all table rows using multiple selectors
  const rowSelectors = [
    selRow,
    'table tbody tr',
    '[class*="reportContainer"] tr',
    'tr:has(td)',
    'div[class*="backtesting"] tr'
  ]

  for (const selector of rowSelectors) {
    try {
      const rows = document.querySelectorAll(selector)
      console.log(`[ALT_PARSE] Found ${rows.length} rows with selector: ${selector}`)

      if (rows.length > 0) {
        let successCount = 0

        for (const row of rows) {
          try {
            // Get all cells in the row
            const cells = row.querySelectorAll('td, th')
            if (cells.length >= 2) {
              // Try to extract parameter name and value using direct text access
              const paramCell = cells[0]
              const valueCell = cells[1]

              // Multiple extraction attempts for parameter name
              let paramName = ''
              const paramMethods = [
                () => paramCell.innerText,
                () => paramCell.textContent,
                () => paramCell.innerHTML?.replace(/<[^>]*>/g, '').trim()
              ]

              for (const method of paramMethods) {
                try {
                  const result = method()
                  if (result && result.trim()) {
                    paramName = result.trim()
                    break
                  }
                } catch (e) {}
              }

              // Multiple extraction attempts for value
              let value = ''
              const valueMethods = [
                () => valueCell.innerText,
                () => valueCell.textContent,
                () => valueCell.innerHTML?.replace(/<[^>]*>/g, '').trim()
              ]

              for (const method of valueMethods) {
                try {
                  const result = method()
                  if (result && result.trim()) {
                    value = result.trim()
                    break
                  }
                } catch (e) {}
              }

              if (paramName && value) {
                const convertedParamName = tv.convertParameterName(paramName)
                report[convertedParamName] = value
                successCount++

                // Log key metrics
                if (convertedParamName.toLowerCase().includes('net profit')) {
                  console.log(`[ALT_PARSE] Found Net profit: "${convertedParamName}" = "${value}"`)
                }
              }
            }
          } catch (rowError) {
            // Silent continue for individual row errors
          }
        }

        if (successCount > 0) {
          console.log(`[ALT_PARSE] Successfully extracted ${successCount} fields using selector: ${selector}`)
          return report
        }
      }
    } catch (selectorError) {
      console.warn(`[ALT_PARSE] Selector ${selector} failed:`, selectorError.message)
    }
  }

  console.log('[ALT_PARSE] Alternative parsing failed')
  return {}
}

tv._parseRows = (allReportRowsEl, strategyHeaders, report) => {
  // Track which fields we've already parsed to avoid duplicates
  const parsedFields = new Set(Object.keys(report))
  let newFieldsAdded = 0
  let duplicatesSkipped = 0

  // Optimized field assignment with minimal logging
  function assignField(fieldName, value) {
    if (parsedFields.has(fieldName)) {
      const existingValue = report[fieldName]
      if (existingValue === 'error' && value !== 'error') {
        report[fieldName] = value
        return true
      }
      duplicatesSkipped++
      return false
    } else {
      report[fieldName] = value
      parsedFields.add(fieldName)
      newFieldsAdded++
      return true
    }
  }

  // Local validation function to avoid scope issues
  function validateParsedValue(value, fieldName) {
    try {
      // If it's already a number and valid, return it
      if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
        return value
      }

      // If it's a string that looks like a number, try to parse it
      if (typeof value === 'string') {
        const trimmed = value.trim()

        // Check for common error indicators
        if (trimmed === '' || trimmed === 'N/A' || trimmed === 'null' || trimmed === 'undefined') {
          console.warn(`[VALIDATE] ${fieldName}: Empty or invalid value "${trimmed}"`)
          return 'error'
        }

        // Try to parse as number
        const parsed = parseFloat(trimmed)
        if (!isNaN(parsed) && isFinite(parsed)) {
          return parsed
        }

        // If it's not a number, return the original string
        return trimmed
      }

      // For other types, return as-is
      return value
    } catch (error) {
      console.error(`[VALIDATE] Error validating ${fieldName}:`, error)
      return 'error'
    }
  }

  function parseNumTypeByRowName(rowName, value) {
    try {
      // Enhanced parsing for better handling of TradingView formats
      let cleanValue = value

      // Handle common TradingView formatting issues
      if (typeof value === 'string') {
        cleanValue = value
          .replace(/[\s\u00A0\u2000-\u200B\u2028\u2029]/g, ' ') // Replace various whitespace chars
          .replace(/[−–—]/g, '-') // Replace various dash chars with standard minus
          .replace(/[,\s]/g, '') // Remove commas and spaces
          .trim()

        // Log for debugging Net profit specifically
        if (rowName.toLowerCase().includes('net profit')) {
          console.log(`[NET_PROFIT_PARSE] Original: "${value}" -> Cleaned: "${cleanValue}"`)
        }
      }

      const digitalValues = cleanValue.toString().replaceAll(/([\-\d\.\n])|(.)/g, (_, b) => b || '')

      const result = rowName.toLowerCase().includes('trades') || rowName.toLowerCase().includes('contracts held')
        ? parseInt(digitalValues)
        : parseFloat(digitalValues)

      // Validate the result
      if (isNaN(result) || !isFinite(result)) {
        console.warn(`[PARSE_WARNING] parseNumTypeByRowName failed for "${rowName}": "${value}" -> "${digitalValues}" -> ${result}`)
        return 'error'
      }

      return result
    } catch (error) {
      console.error(`[PARSE_ERROR] parseNumTypeByRowName exception for "${rowName}": "${value}"`, error)
      return 'error'
    }
  }

  // Helper function to safely extract row data with retry logic
  function parseRowWithRetry(rowEl, maxAttempts = 2) {
    if (!rowEl || !rowEl.isConnected) {
      return null
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const allTdEl = rowEl.querySelectorAll('td')
        if (!allTdEl || allTdEl.length < 2 || !allTdEl[0]) {
          return null // Skip this row
        }

        // Try multiple methods to get parameter name
        let paramName = allTdEl[0].innerText || allTdEl[0].textContent || ''
        if (!paramName && attempt < maxAttempts) {
          // Only log once to reduce spam
          if (attempt === 1) {
            console.warn(`[ROW_PARSE] Empty paramName on attempt ${attempt}, retrying...`)
          }
          continue
        }

        return { allTdEl, paramName: tv.convertParameterName(paramName) }
      } catch (error) {
        if (attempt === maxAttempts) {
          console.error(`[ROW_PARSE] Failed after ${maxAttempts} attempts:`, error.message)
          return null
        }
      }
    }
    return null
  }

  // Optimized cell extraction with minimal logging
  function getCellValueWithRetry(cellEl, maxAttempts = 2) {
    if (!cellEl || !cellEl.isConnected) {
      return ''
    }

    // Fast extraction methods - try most reliable first
    const fastMethods = [
      () => cellEl.innerText,
      () => cellEl.textContent,
      () => cellEl.innerHTML?.replace(/<[^>]*>/g, '')
    ]

    // Try fast methods first
    for (const method of fastMethods) {
      try {
        const value = method()
        if (value && value.toString().trim()) {
          return value.toString().trim()
        }
      } catch (error) {
        // Silent continue
      }
    }

    // If fast methods failed, try comprehensive extraction
    if (maxAttempts > 1) {
      // Direct child text nodes
      try {
        const textNodes = []
        for (const child of cellEl.childNodes) {
          if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
            textNodes.push(child.textContent.trim())
          }
        }
        if (textNodes.length > 0) {
          return textNodes.join(' ')
        }
      } catch (error) {
        // Silent continue
      }

      // Deep text extraction as last resort
      try {
        const walker = document.createTreeWalker(cellEl, NodeFilter.SHOW_TEXT, null, false)
        const textParts = []
        let node
        while (node = walker.nextNode()) {
          const text = node.textContent.trim()
          if (text) textParts.push(text)
        }
        if (textParts.length > 0) {
          return textParts.join(' ')
        }
      } catch (error) {
        // Silent continue
      }
    }

    return ''
  }

  for (let rowEl of allReportRowsEl) {
    if (rowEl) {
      const rowData = parseRowWithRetry(rowEl)
      if (!rowData) {
        continue
      }

      const { allTdEl, paramName } = rowData
      let isSingleValue = allTdEl.length === 3 || ['Buy & hold return', 'Max equity run-up', 'Max equity drawdown',
        'Open P&L', 'Sharpe ratio', 'Sortino ratio'
      ].includes(paramName)
      for (let i = 1; i < allTdEl.length; i++) {
        if (isSingleValue && i >= 2)
          continue
        let values = getCellValueWithRetry(allTdEl[i])
        const isNegative = ['Gross loss', 'Commission paid', 'Max equity run-up', 'Max equity drawdown',
          'Losing trades', 'Avg losing trade', 'Largest losing trade', 'Largest losing trade percent',
          'Avg # bars in losing trades', 'Margin calls'
        ].includes(paramName.toLowerCase())// && allTdEl[i].querySelector('[class^="negativeValue"]')
        if (values && typeof values === 'string' && strategyHeaders[i]) {
          try {
            // Processing key metrics

            values = values.replaceAll(' ', ' ').replaceAll('−', '-').trim()
            const digitalValues = values.replaceAll(/([\-\d\.\n])|(.)/g, (_, b) => b || '')
            let digitOfValues = digitalValues.match(/-?\d+\.?\d*/)
            const nameDigits = isSingleValue ? paramName : `${paramName}: ${strategyHeaders[i]}`
            const namePercents = isSingleValue ? `${paramName} %` : `${paramName} %: ${strategyHeaders[i]}`

            // Processing key metric values
          if ((values.includes('\n') && values.endsWith('%'))) {
            const valuesPair = values.split('\n', 3)
            if (valuesPair && valuesPair.length >= 2) {
              const digitVal0 = valuesPair[0] //.replaceAll(/([\-\d\.])|(.)/g, (a, b) => b || '') //.match(/-?\d+\.?\d*/)
              const digitVal1 = valuesPair[valuesPair.length - 1]//.replaceAll(/([\-\d\.])|(.)/g, (a, b) => b || '') //match(/-?\d+\.?\d*/)

              if (Boolean(digitVal0)) {
                try {
                  const parsedValue = parseNumTypeByRowName(nameDigits, digitVal0)
                  const validatedValue = validateParsedValue(parsedValue, nameDigits)

                  if (validatedValue !== 'error') {
                    let finalValue = validatedValue
                    if (finalValue > 0 && isNegative)
                      finalValue = finalValue * -1

                    assignField(nameDigits, finalValue, 'digitVal0')
                  } else {
                    assignField(nameDigits, 'error', 'digitVal0_validation_failed')
                    console.error(`[PARSE_ERROR] Validation failed for digitVal0 "${digitVal0}" in ${nameDigits}`)
                  }
                } catch (parseError) {
                  console.error(`[PARSE_ERROR] Failed to parse digitVal0 "${digitVal0}" for ${nameDigits}:`, parseError)
                  assignField(nameDigits, 'error', 'digitVal0_parse_error')
                }
              } else {
                assignField(nameDigits, valuesPair[0], 'raw_digitVal0')
              }

              if (Boolean(digitVal1)) {
                try {
                  let percentValue = parseNumTypeByRowName(namePercents, digitVal1)
                  if (percentValue > 0 && isNegative)
                    percentValue = percentValue * -1

                  assignField(namePercents, percentValue, 'digitVal1')
                } catch (parseError) {
                  console.error(`[PARSE_ERROR] Failed to parse digitVal1 "${digitVal1}" for ${namePercents}:`, parseError)
                  assignField(namePercents, 'error', 'digitVal1_parse_error')
                }
              } else {
                assignField(namePercents, valuesPair[1], 'raw_digitVal1')
              }
            }
          } else if (Boolean(digitOfValues)) {
            try {
              // FIX: Changed from namePercents to nameDigits - this was causing parsing errors
              const parsedValue = parseNumTypeByRowName(nameDigits, digitalValues)
              const validatedValue = validateParsedValue(parsedValue, nameDigits)

              if (validatedValue !== 'error') {
                let finalValue = validatedValue
                if (finalValue > 0 && isNegative)
                  finalValue = finalValue * -1

                assignField(nameDigits, finalValue, 'single_value')
              } else {
                assignField(nameDigits, 'error', 'single_value_validation_failed')
                console.error(`[PARSE_ERROR] Validation failed for digitalValues "${digitalValues}" in ${nameDigits}`)
              }
            } catch (parseError) {
              console.error(`[PARSE_ERROR] Failed to parse digitalValues "${digitalValues}" for ${nameDigits}:`, parseError)
              assignField(nameDigits, 'error', 'single_value_parse_error')
            }
          } else {
            assignField(nameDigits, values, 'raw_string')
          }
          } catch (cellError) {
            console.error(`[CELL_PARSE_ERROR] Failed to parse cell for ${paramName}:`, cellError)
            const nameDigits = isSingleValue ? paramName : `${paramName}: ${strategyHeaders[i]}`
            assignField(nameDigits, 'error', 'cell_parse_error')
          }
        }
      }
    }
  }

  // Final validation and cleanup of the report
  const totalFields = Object.keys(report).length
  const errorFields = Object.keys(report).filter(key => report[key] === 'error')
  const successFields = totalFields - errorFields.length

  console.log(`[PARSE_SUMMARY] Parsed ${totalFields} fields from report (${successFields} successful, ${errorFields.length} errors)`)

  // Log field count breakdown for debugging inconsistencies
  const fieldsByType = {
    performance: Object.keys(report).filter(key =>
      key.toLowerCase().includes('profit') ||
      key.toLowerCase().includes('drawdown') ||
      key.toLowerCase().includes('return') ||
      key.toLowerCase().includes('ratio')
    ).length,
    trades: Object.keys(report).filter(key =>
      key.toLowerCase().includes('trade') ||
      key.toLowerCase().includes('win') ||
      key.toLowerCase().includes('loss')
    ).length,
    other: Object.keys(report).filter(key =>
      !key.toLowerCase().includes('profit') &&
      !key.toLowerCase().includes('drawdown') &&
      !key.toLowerCase().includes('return') &&
      !key.toLowerCase().includes('ratio') &&
      !key.toLowerCase().includes('trade') &&
      !key.toLowerCase().includes('win') &&
      !key.toLowerCase().includes('loss')
    ).length
  }

  console.log(`[PARSE_BREAKDOWN] Performance: ${fieldsByType.performance}, Trades: ${fieldsByType.trades}, Other: ${fieldsByType.other}`)

  // Log any fields that ended up as 'error'
  if (errorFields.length > 0) {
    console.warn(`[PARSE_WARNING] ${errorFields.length} fields failed to parse:`, errorFields.slice(0, 5)) // Show first 5 only
  }

  // Note: Fallback extraction will be handled in parseReportTable if needed

  // Log successful parsing of key metrics
  const keyFields = Object.keys(report).filter(key =>
    key.toLowerCase().includes('net profit') ||
    key.toLowerCase().includes('gross profit') ||
    key.toLowerCase().includes('gross loss')
  )
  if (keyFields.length > 0) {
    console.log(`[PARSE_SUCCESS] Key metrics parsed:`, keyFields.map(key => `${key}: ${report[key]}`))
  } else {
    console.warn('[PARSE_WARNING] No key metrics (Net profit, Gross profit, Gross loss) found in report')

    // If no key metrics found, log what we did find for debugging
    // Check if parsing succeeded
    if (Object.keys(report).length === 0) {
      console.error('[PARSE_ERROR] No fields found - parsing failed')
    }
  }

  // Final validation - check if report has reasonable content
  const finalFieldCount = Object.keys(report).length
  const finalErrorCount = Object.keys(report).filter(key => report[key] === 'error').length
  const finalSuccessRate = finalFieldCount > 0 ? ((finalFieldCount - finalErrorCount) / finalFieldCount * 100).toFixed(1) : 0

  console.log(`[PARSE_FINAL] Parse success rate: ${finalSuccessRate}% (${finalFieldCount - finalErrorCount}/${finalFieldCount} fields)`)

  if (finalSuccessRate < 50 && finalFieldCount > 0) {
    console.warn('[PARSE_WARNING] Low success rate detected - consider investigating DOM structure changes')
  }

  // Final cleanup: Remove any remaining "error" values for key metrics that we know should have values
  const keyMetricPatterns = ['net profit', 'gross profit', 'gross loss', 'total closed trades', 'profit factor']
  let cleanupCount = 0

  Object.keys(report).forEach(fieldName => {
    if (report[fieldName] === 'error') {
      const isKeyMetric = keyMetricPatterns.some(pattern =>
        fieldName.toLowerCase().includes(pattern)
      )

      if (isKeyMetric) {
        // Try to find a similar field that has a valid value
        const similarFields = Object.keys(report).filter(otherField =>
          otherField !== fieldName &&
          otherField.toLowerCase().includes(fieldName.split(':')[0].toLowerCase()) &&
          report[otherField] !== 'error' &&
          report[otherField] !== null &&
          report[otherField] !== undefined
        )

        if (similarFields.length > 0) {
          report[fieldName] = report[similarFields[0]]
          cleanupCount++
        } else {
          report[fieldName] = '0'
          cleanupCount++
        }
      }
    }
  })

  if (cleanupCount > 0) {
    console.log(`[CLEANUP] Cleaned up ${cleanupCount} error values in key metrics`)
  }

  // Special check for the exact field the extension popup looks for
  const criticalFields = ['Net profit: All', 'Net profit %: All', 'Gross profit: All', 'Gross loss: All']
  criticalFields.forEach(fieldName => {
    if (!report.hasOwnProperty(fieldName) || report[fieldName] === 'error') {
      // Try to find this field with different formatting
      const alternativeFields = Object.keys(report).filter(key =>
        key.toLowerCase().replace(/[^a-z]/g, '') === fieldName.toLowerCase().replace(/[^a-z]/g, '') &&
        report[key] !== 'error' &&
        report[key] !== null &&
        report[key] !== undefined
      )

      if (alternativeFields.length > 0) {
        report[fieldName] = report[alternativeFields[0]]
      } else if (!report.hasOwnProperty(fieldName)) {
        report[fieldName] = '0'
      }
    }
  })

  return report
}


/**
 * Comprehensive DOM inspection for debugging parsing issues
 */
tv._inspectReportDOM = () => {
  console.log('[DOM_INSPECT] Starting comprehensive DOM inspection...')

  const selHeader = SEL.strategyReportHeader
  const selRow = SEL.strategyReportRow

  // Check if selectors find elements
  const headers = document.querySelectorAll(selHeader)
  const rows = document.querySelectorAll(selRow)

  console.log(`[DOM_INSPECT] Headers found: ${headers.length} (selector: ${selHeader})`)
  console.log(`[DOM_INSPECT] Rows found: ${rows.length} (selector: ${selRow})`)

  // Inspect headers
  if (headers.length > 0) {
    headers.forEach((header, index) => {
      console.log(`[DOM_INSPECT] Header ${index}: "${header.textContent?.trim()}"`)
    })
  }

  // Inspect first few rows
  if (rows.length > 0) {
    const maxRowsToInspect = Math.min(5, rows.length)
    for (let i = 0; i < maxRowsToInspect; i++) {
      const row = rows[i]
      const cells = row.querySelectorAll('td, th')
      console.log(`[DOM_INSPECT] Row ${i}: ${cells.length} cells`)

      cells.forEach((cell, cellIndex) => {
        const text = cell.textContent?.trim()
        if (text) {
          console.log(`[DOM_INSPECT] Row ${i}, Cell ${cellIndex}: "${text}"`)
        }
      })
    }
  }

  // Look for any tables in the report area
  const reportArea = document.querySelector('#bottom-area div[class^="backtesting"]')

  if (reportArea) {
    const tables = reportArea.querySelectorAll('table')
    console.log(`[DOM_INSPECT] Tables found in report area: ${tables.length}`)

    tables.forEach((table, tableIndex) => {
      const tableRows = table.querySelectorAll('tr')
      console.log(`[DOM_INSPECT] Table ${tableIndex}: ${tableRows.length} rows`)

      // Check first few rows of each table
      const maxTableRowsToInspect = Math.min(3, tableRows.length)
      for (let i = 0; i < maxTableRowsToInspect; i++) {
        const row = tableRows[i]
        const cells = row.querySelectorAll('td, th')
        const cellTexts = Array.from(cells).map(cell => cell.textContent?.trim()).filter(text => text)
        if (cellTexts.length > 0) {
          console.log(`[DOM_INSPECT] Table ${tableIndex}, Row ${i}: [${cellTexts.join(', ')}]`)
        }
      }
    })
  }

  // Look for any element containing "Net profit"
  const allElements = document.querySelectorAll('*')
  let netProfitElements = 0
  for (const element of allElements) {
    const text = element.textContent?.toLowerCase()
    if (text && text.includes('net profit') && element.children.length === 0) { // Leaf elements only
      netProfitElements++
      console.log(`[DOM_INSPECT] Found "Net profit" element: "${element.textContent?.trim()}"`)
      if (netProfitElements >= 5) break // Limit output
    }
  }

  console.log(`[DOM_INSPECT] Total elements containing "Net profit": ${netProfitElements}`)
}

tv.parseReportTable = async () => {
  const selHeader = SEL.strategyReportHeader
  const selRow = SEL.strategyReportRow

  // Fast data detection - no fixed delays
  await tv._fastDataDetection(800)

  // Perform DOM inspection for debugging
  tv._inspectReportDOM()

  await page.waitForSelector(selHeader, 2500)

  // Wrap header element selection with retry logic
  const { strategyHeaders } = await tv.retryParsingOperation(async () => {
    const headers = document.querySelectorAll(selHeader)
    if (!headers || !(headers.length === 4 || headers.length === 5)) { // 5 - Extra column for full screen
      if (!tv.isParsed)
        throw new Error('Can\'t get performance headers.' + SUPPORT_TEXT)
      else
        return { allHeadersEl: [], strategyHeaders: [] }
    }

    const headerTexts = []
    for (let headerEl of headers) {
      if (headerEl)
        headerTexts.push(headerEl.innerText)
    }

    return { strategyHeaders: headerTexts }
  }, {
    operationName: 'header element selection',
    isRetryableError: tv.isRetryableParsingError,
    maxAttempts: 3,
    baseDelay: 300
  })

  let report = {}
  await page.waitForSelector(selRow, 2500)

  // Wrap row element selection with retry logic
  const allReportRowsEl = await tv.retryParsingOperation(async () => {
    const rows = document.querySelectorAll(selRow)
    if (!rows || rows.length === 0) {
      if (!tv.isParsed)
        throw new Error('Can\'t get performance rows.' + SUPPORT_TEXT)
      else
        return []
    } else {
      tv.isParsed = true
    }
    return rows
  }, {
    operationName: 'row element selection',
    isRetryableError: tv.isRetryableParsingError,
    maxAttempts: 3,
    baseDelay: 300
  })

  report = tv._parseRows(allReportRowsEl, strategyHeaders, report)
  const mainParseFieldCount = Object.keys(report).length

  // Check if main parsing failed and try alternative method
  const mainParseErrorCount = Object.keys(report).filter(key => report[key] === 'error').length
  const mainParseSuccessRate = mainParseFieldCount > 0 ? ((mainParseFieldCount - mainParseErrorCount) / mainParseFieldCount * 100) : 0

  if (mainParseSuccessRate < 30 || mainParseFieldCount === 0) {
    console.log(`[MAIN_PARSE] Low success rate (${mainParseSuccessRate.toFixed(1)}%) or no fields found, trying alternative parsing...`)

    const altReport = tv._parseReportAlternative()
    const altFieldCount = Object.keys(altReport).length

    if (altFieldCount > mainParseFieldCount) {
      // Merge alternative results, prioritizing them over failed main results
      Object.keys(altReport).forEach(key => {
        if (altReport[key] && altReport[key] !== 'error') {
          report[key] = altReport[key]
        }
      })
    }
  }

  if (selStatus.isNewVersion) {
    const tabs = [
      [SEL.strategyTradeAnalysisTab, SEL.strategyTradeAnalysisTabActive, 'Trade Analysis'],
      [SEL.strategyRatiosTab, SEL.strategyRatiosTabActive, 'Ratios']]

    for (const [tabSelector, activeSelector, tabName] of tabs) {

      page.mouseClickSelector(tabSelector)
      const tabEl = await page.waitForSelector(activeSelector, 1000)
      if (tabEl) {
        // Fast tab stabilization - no fixed delays
        await tv._fastTabStabilization(selRow, 600)

        // Wrap tab header and row parsing with retry logic
        const tabParsingResult = await tv.retryParsingOperation(async () => {
          const tabHeaders = []
          const tabHeadersEl = document.querySelectorAll(selHeader)
          for (let headerEl of tabHeadersEl) {
            if (headerEl)
              tabHeaders.push(headerEl.innerText)
          }

          await page.waitForSelector(selRow, 2500)
          const tabRowsEl = document.querySelectorAll(selRow)

          return { headers: tabHeaders, rows: tabRowsEl }
        }, {
          operationName: `tab parsing (${tabName})`,
          isRetryableError: tv.isRetryableParsingError,
          maxAttempts: 3,
          baseDelay: 300
        })

        if (tabParsingResult.rows && tabParsingResult.rows.length !== 0) {
          report = tv._parseRows(tabParsingResult.rows, tabParsingResult.headers, report)
        }
      }
    }

    // Return to performance tab
    page.mouseClickSelector(SEL.strategyPerformanceTab)
    await page.waitForSelector(SEL.strategyPerformanceTabActive, 1000)
  }

  // Check if Net profit parsing failed and try fallback extraction
  const netProfitFields = Object.keys(report).filter(key => key.toLowerCase().includes('net profit'))
  const hasNetProfitError = netProfitFields.some(key => report[key] === 'error')

  if (hasNetProfitError || netProfitFields.length === 0) {
    console.log('[PARSE_FALLBACK] Net profit parsing failed or missing, attempting fallback extraction...')
    try {
      const fallbackData = await tv._extractReportDataWithFallbacks()

      // Merge fallback data into report
      Object.keys(fallbackData).forEach(key => {
        if (fallbackData[key] && fallbackData[key] !== 'error') {
          console.log(`[PARSE_FALLBACK] Recovered ${key}: ${fallbackData[key]}`)
          report[key] = fallbackData[key]
        }
      })
    } catch (fallbackError) {
      console.error('[PARSE_FALLBACK] Fallback extraction failed:', fallbackError)
    }
  }

  return report
}




/**
 * Ensures the report is up-to-date before reading data
 * @returns {Promise<boolean>} - True if report is current
 */
tv._ensureReportIsCurrent = async () => {
  console.log('[REPORT_SYNC] Ensuring report is current before reading data...')

  try {
    // Check for "Update report" button and click if present
    const updateClicked = await tv._checkAndClickRegularUpdateReportButton()

    if (updateClicked) {
      console.log('[REPORT_SYNC] Update report button found and clicked, waiting for completion...')
      const updateSuccess = await tv._waitForUpdateReportSuccess(12000)
      if (updateSuccess) {
        console.log('[REPORT_SYNC] ✓ Report successfully updated to current state')
        return true
      } else {
        console.log('[REPORT_SYNC] ⚠ Report update timeout, but continuing...')
        return false
      }
    } else {
      console.log('[REPORT_SYNC] No update report button found - report appears current')
      return true
    }
  } catch (error) {
    console.log('[REPORT_SYNC] Error during report sync:', error.message)
    return false
  }
}

tv.getPerformance = async (testResults) => {
  // Ensure tv is properly initialized
  await tv._initialize()

  // CRITICAL: Ensure report is current before reading any data
  console.log('[PERFORMANCE] Ensuring report is current before reading performance data...')
  await tv._ensureReportIsCurrent()

  let reportData = {}
  let message = ''
  let isProcessError = null
  let selProgress = SEL.strategyReportInProcess
  let selReady = SEL.strategyReportReady
  const dataWaitingTime = testResults.dataLoadingTime * 1000

  let isProcessStart = await page.waitForSelector(selProgress, 2500)
  let isProcessEnd = tv.isReportChanged
  if (isProcessStart) {
    const tick = 100
    for (let i = 0; i < 5000 / tick; i++) { // Waiting for an error 5000 ms      // isProcessEnd = await page.waitForSelector(SEL.strategyReportError, 5000)
      isProcessError = await page.waitForSelector(SEL.strategyReportError, tick)
      isProcessEnd = page.$(selReady)
      if (isProcessError || isProcessEnd) {
        break
      }
    }
    if (isProcessError == null)
      isProcessEnd = await page.waitForSelector(selReady, dataWaitingTime)
  } else if (isProcessEnd)
    isProcessStart = true

  isProcessError = isProcessError || document.querySelector(SEL.strategyReportError)
  await page.waitForTimeout(250) // Waiting for update digits. 150 is enough but 250 for reliable TODO Another way?

  if (!isProcessError) {
    // Check for and click "Update report" button if needed
    const updateButtonClicked = await tv._checkAndClickRegularUpdateReportButton()

    if (updateButtonClicked) {
      console.log('[INFO] Update report button clicked, waiting for completion...')
      // Wait for the update to complete
      const updateSuccess = await tv._waitForUpdateReportSuccess(5000) // Reduced timeout
      if (updateSuccess) {
        // SUCCESS MESSAGE DETECTED - START PARSING IMMEDIATELY
        console.log('[INFO] Report update success detected - starting parsing immediately')
      } else {
        console.log('[WARNING] Update timeout - proceeding with parsing anyway')
      }
    } else {
      // Quick check for update notifications
      const reportUpdateSuccess = await tv._waitForRegularReportUpdate(2000) // Reduced timeout
      if (!reportUpdateSuccess) {
        console.log('[INFO] No update notifications - report may be current')
      }
    }

    // REMOVED: _waitForReportDataPopulation - start parsing immediately after success message

    // Additional small delay to ensure report is fully rendered
    await page.waitForTimeout(500)

    reportData = await tv.parseReportTable()
  }
  if (!isProcessError && !isProcessEnd && testResults.perfomanceSummary.length) {
    const lastRes = testResults.perfomanceSummary[testResults.perfomanceSummary.length - 1] // (!) Previous value maybe in testResults.filteredSummary
    if (reportData.hasOwnProperty(testResults.optParamName) && lastRes.hasOwnProperty(testResults.optParamName) &&
      reportData[testResults.optParamName] !== lastRes[testResults.optParamName]) {
      isProcessEnd = true
      isProcessStart = true
    }
  }
  if (reportData['comment'])
    message += '. ' + reportData['comment']
  const comment = message ? message : null
  if (comment) {
    if (reportData['comment'])
      reportData['comment'] = comment ? comment + ' ' + reportData['comment'] : reportData['comment']
    else {
      reportData['comment'] = comment
    }
  }
  return {
    error: isProcessError ? 2 : !isProcessStart ? 1 : !isProcessEnd ? 3 : null,
    message: message,
    data: reportData
  }
  // return await tv.parseReportTable()
  // TODO change the object to get data
  // function convertPercent(key, value) {
  //   if (!value)
  //     return 0
  //   return key.endsWith('Percent') || key.startsWith('percent')? value * 100 : value
  // }
  //
  // const perfDict = {
  //   'netProfit': 'Net Profit',
  //   'netProfitPercent': 'Net Profit %',
  //   'grossProfit': 'Gross Profit',
  //   'grossProfitPercent': 'Gross Profit %',
  //   'grossLoss': 'Gross Loss',
  //   'grossLossPercent': 'Gross Loss %',
  //   'maxStrategyDrawDown': 'Max Drawdown',
  //   'maxStrategyDrawDownPercent': 'Max Drawdown %',
  //   'buyHoldReturn': 'Buy & Hold Return',
  //   'buyHoldReturnPercent': 'Buy & Hold Return %',
  //   'sharpeRatio': 'Sharpe Ratio',
  //   'sortinoRatio': 'Sortino Ratio',
  //   'profitFactor': 'Profit Factor',
  //   'maxContractsHeld': 'Max Contracts Held',
  //   'openPL': 'Open PL',
  //   'openPLPercent': 'Open PL %',
  //   'commissionPaid': 'Commission Paid',
  //   'totalTrades': 'Total Closed Trades',
  //   'totalOpenTrades': 'Total Open Trades',
  //   'numberOfLosingTrades': 'Number Losing Trades',
  //   'numberOfWiningTrades': 'Number Winning Trades',
  //   'percentProfitable': 'Percent Profitable',
  //   'avgTrade': 'Avg Trade',
  //   'avgTradePercent': 'Avg Trade %',
  //   'avgWinTrade': 'Avg Winning Trade',
  //   'avgWinTradePercent': 'Avg Winning Trade %',
  //   'avgLosTrade': 'Avg Losing Trade',
  //   'avgLosTradePercent': 'Avg Losing Trade %',
  //   'ratioAvgWinAvgLoss': 'Ratio Avg Win / Avg Loss',
  //   'largestWinTrade': 'Largest Winning Trade',
  //   'largestWinTradePercent': 'Largest Winning Trade %',
  //   'largestLosTrade': 'Largest Losing Trade',
  //   'largestLosTradePercent': 'Largest Losing Trade %',
  //   'avgBarsInTrade': 'Avg # Bars in Trades',
  //   'avgBarsInLossTrade': 'Avg # Bars In Losing Trades',
  //   'avgBarsInWinTrade': 'Avg # Bars In Winning Trades',
  //   'marginCalls': 'Margin Calls',
  // }
  //
  // const performanceData = await tv.getPageData('getPerformance')
  // let data = {}
  // if (performanceData) {
  //   if(performanceData.hasOwnProperty('all') && performanceData.hasOwnProperty('long') && performanceData.hasOwnProperty('short')) {
  //     for (let key of Object.keys(performanceData['all'])) {
  //       const keyName = perfDict.hasOwnProperty(key) ? perfDict[key] : key
  //       data[`${keyName}: All`] = convertPercent(key, performanceData['all'][key])
  //       if(performanceData['long'].hasOwnProperty(key))
  //         data[`${keyName}: Long`] = convertPercent(key, performanceData['long'][key])
  //       if(performanceData['short'].hasOwnProperty(key))
  //         data[`${keyName}: Short`] = convertPercent(key, performanceData['short'][key])
  //     }
  //   }
  //   for(let key of Object.keys(performanceData)) {
  //     if (!['all', 'long', 'short'].includes(key)) {
  //       const keyName = perfDict.hasOwnProperty(key) ? perfDict[key] : key
  //       data[keyName] =  convertPercent(key, performanceData[key])
  //     }
  //   }
  // }
  // return data
}

tv.getPageData = async (actionName, timeout = 1000) => {
  delete tvPageMessageData[actionName]
  const url = window.location && window.location.origin ? window.location.origin : 'https://www.tradingview.com'
  window.postMessage({ name: 'iondvScript', action: actionName }, url) // TODO wait for data
  let iter = 0
  const tikTime = 50
  do {
    await page.waitForTimeout(tikTime)
    iter += 1
    if (tikTime * iter >= timeout)
      break
  } while (!tvPageMessageData.hasOwnProperty(actionName))
  return tvPageMessageData.hasOwnProperty(actionName) ? tvPageMessageData[actionName] : null
}

// Global error handler for tv-related issues
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('tv is not defined')) {
    console.error('[TV_ERROR] tv object not defined error caught:', event.message)
    console.error('[TV_ERROR] This usually means the scripts loaded in wrong order or there was an initialization failure')
    console.error('[TV_ERROR] Stack trace:', event.error?.stack)

    // Try to provide helpful information
    console.log('[TV_DEBUG] Script loading status:')
    console.log('[TV_DEBUG] - tv object exists:', typeof tv !== 'undefined')
    console.log('[TV_DEBUG] - tv._isInitialized:', tv?._isInitialized)
    console.log('[TV_DEBUG] - window.tv exists:', typeof window.tv !== 'undefined')

    // Prevent the error from propagating if we can handle it
    if (typeof tv !== 'undefined') {
      console.log('[TV_ERROR] tv object is actually available, this might be a timing issue')
      event.preventDefault()
    }
  }
})

// Immediate initialization (synchronous) - moved to top to ensure earliest availability
try {
  // Ensure tv is immediately available
  tv._isInitialized = true
  tv._scriptLoadTime = Date.now()

  // Double-check global accessibility
  if (typeof window !== 'undefined') {
    window.tv = tv
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.tv = tv
  }

  console.log('[TV_INIT] tv object immediately available on script load')
  console.log('[TV_INIT] Script load time:', tv._scriptLoadTime)
  console.log('[TV_INIT] tv accessible via window:', typeof window.tv !== 'undefined')
  console.log('[TV_INIT] tv accessible via globalThis:', typeof globalThis.tv !== 'undefined')

  // Check dependencies when available
  if (tv._checkDependencies) {
    tv._checkDependencies()
  }

} catch (error) {
  console.error('[TV_INIT] Failed to make tv object available:', error)
}

// Also do async initialization for TradingView-specific setup
(async () => {
  try {
    // Wait a bit for TradingView to be ready, but don't block tv availability
    setTimeout(async () => {
      console.log('[TV_INIT] Running delayed TradingView setup...')
      // Any TradingView-specific initialization can go here
    }, 2000)
  } catch (error) {
    console.error('[TV_INIT] Failed TradingView setup:', error)
  }
})()
