const tv = {
  reportNode: null,
  reportDeepNode: null,
  tickerTextPrev: null,
  timeFrameTextPrev: null,
  isReportChanged: false,
  _settingsMethod: null
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


tv.getStrategy = async (strategyName = '', isIndicatorSave = false, isDeepTest = false) => {
  try {
    await tv.openStrategyTab(isDeepTest)
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

tv.setStrategyParams = async (name, propVal, isDeepTest = false, keepStrategyParamOpen = false) => {

  const indicatorTitleEl = await tv.checkAndOpenStrategy(name, isDeepTest) // In test.name - ordinary strategy name but in strategyData.name short one as in indicator title
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
    await ui.showErrorPopup('There is not strategy param button on the strategy tab. Test stopped. Open correct page please')
    return null
  }
  const stratIndicatorEl = await page.waitForSelector(SEL.indicatorTitle, 2000)
  if (!stratIndicatorEl) {
    await ui.showErrorPopup('There is not strategy parameters popup. If was not opened, probably TV UI changes. ' +
      'Reload page and try again. Test stopped. Open correct page please')
    return null
  }
  const tabInputEl = document.querySelector(SEL.tabInput)
  if (!tabInputEl) {
    await ui.showErrorPopup('There is not strategy parameters input tab. Test stopped. Open correct page please')
    return null
  }
  page.mouseClick(tabInputEl) //tabInputEl.click()

  const tabInputActiveEl = await page.waitForSelector(SEL.tabInputActive)
  if (!tabInputActiveEl) {
    await ui.showErrorPopup('There is not strategy parameters active input tab. Test stopped. Open correct page please')
    return null
  }
  return true
}

// Helper functions for new deep testing UI (2024/2025 TradingView interface changes)
// TradingView changed deep testing from checkbox to date range button + "Entire history" dropdown
tv._findDateRangeButton = async () => {
  // Try primary selector first (dateRangeMenuWrapper)
  let button = document.querySelector(SEL.strategyDeepTestDateRangeButton)
  if (button) {
    console.log('[INFO] Found date range button using primary selector')
    return button
  }

  // Try fallback 1: button in deep-history area
  button = document.querySelector(SEL.strategyDeepTestDateRangeButtonFallback1)
  if (button) {
    console.log('[INFO] Found date range button in deep-history area')
    return button
  }

  // Try fallback 2: button with specific calendar SVG path (avoid :has() for compatibility)
  const allMenuButtons = document.querySelectorAll('button[aria-haspopup="menu"]')
  for (const btn of allMenuButtons) {
    const svg = btn.querySelector('svg')
    if (svg) {
      const path = svg.querySelector('path')
      if (path && path.getAttribute('d') && path.getAttribute('d').includes('M10 6h8V4h1v2h1.5A2.5 2.5 0 0 1 23 8.5v11a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 5 19.5v-11A2.5 2.5 0 0 1 7.5 6H9V4h1z')) {
        console.log('[INFO] Found date range button by calendar SVG path')
        return btn
      }
    }
  }

  // Try fallback 3: button with date range text pattern
  for (const btn of allMenuButtons) {
    const text = btn.textContent || btn.innerText || ''
    if (text.includes('—') || text.includes('–') || /\d{4}.*—.*\d{4}/.test(text)) {
      console.log(`[INFO] Found date range button by text pattern: "${text.substring(0, 50)}..."`)
      return btn
    }
  }

  // Try fallback 4: any button with menu popup in backtesting area
  button = document.querySelector(SEL.strategyDeepTestDateRangeButtonFallback3)
  if (button) {
    console.log('[INFO] Found date range button in backtesting area (fallback)')
    return button
  }

  return null
}

tv._findEntireHistoryOption = async () => {
  // Try primary selector first (exact aria-label match)
  let option = document.querySelector(SEL.strategyDeepTestEntireHistoryOption)
  if (option) {
    console.log('[INFO] Found "Entire history" option using primary selector (aria-label)')
    return option
  }

  // Try fallback: search all menu items by text content
  const allMenuItems = document.querySelectorAll('div[role="menuitemcheckbox"], div[role="menuitem"]')
  console.log(`[DEBUG] Searching through ${allMenuItems.length} menu items for "Entire history"`)

  for (const item of allMenuItems) {
    const text = (item.textContent || item.innerText || '').trim().toLowerCase()
    const ariaLabel = (item.getAttribute('aria-label') || '').toLowerCase()

    // Check both text content and aria-label for various forms of "entire history"
    if (text.includes('entire history') ||
        ariaLabel.includes('entire history') ||
        text === 'entire history' ||
        ariaLabel === 'entire history') {
      console.log(`[INFO] Found "Entire history" option by text/aria-label: "${text}" / "${ariaLabel}"`)
      return item
    }
  }

  // Additional fallback: look for partial matches
  for (const item of allMenuItems) {
    const text = (item.textContent || item.innerText || '').trim().toLowerCase()
    const ariaLabel = (item.getAttribute('aria-label') || '').toLowerCase()

    if ((text.includes('entire') && text.includes('history')) ||
        (ariaLabel.includes('entire') && ariaLabel.includes('history'))) {
      console.log(`[INFO] Found potential "Entire history" option by partial match: "${text}" / "${ariaLabel}"`)
      return item
    }
  }

  console.log('[DEBUG] No "Entire history" option found')
  return null
}

tv._isNewDeepTestUIAvailable = async () => {
  const dateRangeButton = await tv._findDateRangeButton()
  return !!dateRangeButton
}

tv._findAndClickUpdateReportButton = async () => {
  // Check for the "Update report" snackbar notification
  const snackbar = document.querySelector(SEL.strategyDeepTestUpdateReportSnackbar)
  if (!snackbar) {
    return false // No update needed
  }

  console.log('[INFO] Found "Update report" snackbar notification')

  // Try primary selector for the update button
  let updateButton = document.querySelector(SEL.strategyDeepTestUpdateReportButton)
  if (updateButton) {
    console.log('[INFO] Clicking "Update report" button')
    page.mouseClick(updateButton)

    // Wait for success notification instead of fixed timeout
    const success = await tv._waitForUpdateReportSuccess()
    if (success) {
      console.log('[INFO] Update report completed successfully')
      return true
    } else {
      console.log('[WARNING] Update report may not have completed successfully, falling back to timeout')
      await page.waitForTimeout(1000) // Fallback to original behavior
      return true // Return true to maintain backward compatibility
    }
  }

  // Fallback: search for button by text content
  const allButtons = document.querySelectorAll('button')
  for (const button of allButtons) {
    const text = (button.textContent || '').trim().toLowerCase()
    const tooltip = button.getAttribute('data-overflow-tooltip-text') || ''

    if (text.includes('update report') || tooltip.includes('Update report')) {
      console.log('[INFO] Found "Update report" button by text search, clicking...')
      page.mouseClick(button)

      // Wait for success notification instead of fixed timeout
      const success = await tv._waitForUpdateReportSuccess()
      if (success) {
        console.log('[INFO] Update report completed successfully (fallback method)')
        return true
      } else {
        console.log('[WARNING] Update report may not have completed successfully (fallback method), using timeout')
        await page.waitForTimeout(1000) // Fallback to original behavior
        return true // Return true to maintain backward compatibility
      }
    }
  }

  console.log('[WARNING] Found update snackbar but could not find "Update report" button')
  return false
}

tv._waitForUpdateReportSuccess = async (timeout = 10000) => {
  console.log('[INFO] Waiting for "The report has been updated successfully" notification...')

  const startTime = Date.now()
  const tick = 100 // Check every 100ms
  const maxIterations = Math.floor(timeout / tick)

  for (let i = 0; i < maxIterations; i++) {
    try {
      // Check for success message in toast notifications
      const toastElements = document.querySelectorAll(SEL.strategyDeepTestUpdateReportSuccessToast)
      for (const toast of toastElements) {
        const text = (toast.textContent || toast.innerText || '').toLowerCase()
        if (text.includes('report has been updated successfully') ||
            text.includes('report updated successfully') ||
            text.includes('successfully updated')) {
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

      // Fallback: check other potential containers
      const fallbackElements = document.querySelectorAll(SEL.strategyDeepTestUpdateReportSuccessToastFallback)
      for (const element of fallbackElements) {
        const text = (element.textContent || element.innerText || '').toLowerCase()
        if (text.includes('report has been updated successfully') ||
            text.includes('report updated successfully')) {
          const elapsedTime = Date.now() - startTime
          console.log(`[SUCCESS] Found success notification in fallback element after ${elapsedTime}ms`)
          return true
        }
      }

      // Additional check: if original update snackbar has disappeared, it might indicate success
      // But only after some time has passed to avoid false positives
      if (i > 10) { // After 1 second
        const originalSnackbar = document.querySelector(SEL.strategyDeepTestUpdateReportSnackbar)
        if (!originalSnackbar) {
          const elapsedTime = Date.now() - startTime
          console.log(`[INFO] Original update snackbar disappeared after ${elapsedTime}ms, assuming success`)
          return true
        }
      }

      // Log progress every 2 seconds for debugging
      if (i > 0 && i % 20 === 0) { // Every 2 seconds (20 * 100ms)
        const elapsedTime = Date.now() - startTime
        console.log(`[DEBUG] Still waiting for success notification... ${elapsedTime}ms elapsed`)
      }

      // Wait for next iteration
      await page.waitForTimeout(tick)

    } catch (error) {
      console.log(`[WARNING] Error during success notification polling: ${error.message}`)
      await page.waitForTimeout(tick)
    }
  }

  const elapsedTime = Date.now() - startTime
  console.log(`[WARNING] Timeout waiting for success notification after ${elapsedTime}ms`)
  return false
}

// Test function to verify the success notification detection
tv._testUpdateReportSuccessDetection = async () => {
  console.log('[TEST] Testing update report success detection...')

  // Test the selectors
  const toastElements = document.querySelectorAll(SEL.strategyDeepTestUpdateReportSuccessToast)
  const fallbackElements = document.querySelectorAll(SEL.strategyDeepTestUpdateReportSuccessToastFallback)

  console.log(`[TEST] Found ${toastElements.length} toast elements`)
  console.log(`[TEST] Found ${fallbackElements.length} fallback elements`)

  // Test if update snackbar is present
  const updateSnackbar = document.querySelector(SEL.strategyDeepTestUpdateReportSnackbar)
  console.log(`[TEST] Update snackbar present: ${!!updateSnackbar}`)

  return {
    toastCount: toastElements.length,
    fallbackCount: fallbackElements.length,
    updateSnackbarPresent: !!updateSnackbar
  }
}

// Test function for debugging deep testing UI detection
tv._debugDeepTestUI = async () => {
  console.log('[DEBUG] Testing deep test UI detection...')

  // Test date range button detection
  const dateRangeButton = await tv._findDateRangeButton()
  console.log('[DEBUG] Date range button found:', !!dateRangeButton)
  if (dateRangeButton) {
    console.log('[DEBUG] Button text:', dateRangeButton.textContent || dateRangeButton.innerText)
    console.log('[DEBUG] Button attributes:', {
      'aria-haspopup': dateRangeButton.getAttribute('aria-haspopup'),
      'aria-expanded': dateRangeButton.getAttribute('aria-expanded'),
      'disabled': dateRangeButton.disabled,
      'aria-disabled': dateRangeButton.getAttribute('aria-disabled')
    })
  }

  // Test old UI detection
  const oldCheckbox = page.$(SEL.strategyDeepTestCheckbox)
  console.log('[DEBUG] Old checkbox found:', !!oldCheckbox)

  // Test generate button
  const generateBtn = page.$(SEL.strategyDeepTestGenerateBtn)
  console.log('[DEBUG] Generate button found:', !!generateBtn)

  return {
    hasNewUI: !!dateRangeButton,
    hasOldUI: !!oldCheckbox,
    hasGenerateBtn: !!generateBtn
  }
}

// Manual test function for dropdown interaction
tv._testDropdownInteraction = async () => {
  console.log('[DEBUG] Testing dropdown interaction manually...')

  const dateRangeButton = await tv._findDateRangeButton()
  if (!dateRangeButton) {
    console.log('[ERROR] No date range button found')
    return false
  }

  console.log('[DEBUG] Clicking date range button...')
  page.mouseClick(dateRangeButton)

  await page.waitForTimeout(1000)

  console.log('[DEBUG] Looking for dropdown menu items...')
  const allMenuItems = document.querySelectorAll('div[role="menuitemcheckbox"], div[role="menuitem"]')
  console.log(`[DEBUG] Found ${allMenuItems.length} menu items:`)

  for (let i = 0; i < allMenuItems.length; i++) {
    const item = allMenuItems[i]
    const text = (item.textContent || '').trim()
    const ariaLabel = item.getAttribute('aria-label') || ''
    console.log(`[DEBUG] Item ${i}: text="${text}", aria-label="${ariaLabel}"`)
  }

  const entireHistoryOption = await tv._findEntireHistoryOption()
  console.log('[DEBUG] "Entire history" option found:', !!entireHistoryOption)

  // Check for "Update report" snackbar
  const updateSnackbar = document.querySelector(SEL.strategyDeepTestUpdateReportSnackbar)
  console.log('[DEBUG] "Update report" snackbar found:', !!updateSnackbar)

  if (updateSnackbar) {
    const updateButton = document.querySelector(SEL.strategyDeepTestUpdateReportButton)
    console.log('[DEBUG] "Update report" button found:', !!updateButton)
  }

  return !!entireHistoryOption
}

tv.setDeepTest = async (isDeepTest) => {
  function isTurnedOn() {
    return page.$(SEL.strategyDeepTestCheckboxChecked)
  }

  function isTurnedOff() {
    return page.$(SEL.strategyDeepTestCheckboxUnchecked)
  }

  async function turnDeepModeOn() {
    const switchTurnedOffEl = isTurnedOff()
    if (switchTurnedOffEl)
      switchTurnedOffEl.click() // page.mouseClick(switchTurnedOffEl)
    const el = await page.waitForSelector(SEL.strategyDeepTestCheckboxChecked)
    if (!el)
      throw new Error('Can not switch to deep backtesting mode')
  }

  async function turnDeepModeOff() {
    const switchTurnedOnEl = isTurnedOn()
    if (switchTurnedOnEl)
      switchTurnedOnEl.click() //page.mouseClick(switchTurnedOnEl) // // switchTurnedOnEl.click()
    const el = await page.waitForSelector(SEL.strategyDeepTestCheckboxUnchecked)
    if (!el)
      throw new Error('Can not switch off from deep backtesting mode')
  }

  // New deep testing workflow for updated UI
  async function turnNewDeepModeOn() {
    console.log('[INFO] Using new deep testing UI workflow')

    // Step 1: Find and click the date range button
    const dateRangeButton = await tv._findDateRangeButton()
    if (!dateRangeButton) {
      throw new Error('Deep testing date range button not found. The TradingView interface may have changed. Please check if you have Premium subscription and the Strategy Tester is open.')
    }

    console.log('[DEBUG] Found date range button:', {
      id: dateRangeButton.id,
      className: dateRangeButton.className,
      text: (dateRangeButton.textContent || '').substring(0, 100),
      ariaExpanded: dateRangeButton.getAttribute('aria-expanded'),
      ariaHaspopup: dateRangeButton.getAttribute('aria-haspopup')
    })

    // Verify button is clickable
    if (dateRangeButton.disabled || dateRangeButton.getAttribute('aria-disabled') === 'true') {
      throw new Error('Date range button is disabled. Please ensure the Strategy Tester is properly loaded.')
    }

    console.log('[INFO] Clicking date range button')
    page.mouseClick(dateRangeButton)

    // Wait a moment for the dropdown to appear
    await page.waitForTimeout(500)

    // Check if dropdown appeared by looking for aria-expanded change
    const isExpanded = dateRangeButton.getAttribute('aria-expanded') === 'true'
    console.log('[DEBUG] Button aria-expanded after click:', isExpanded)

    // Step 2: Wait for dropdown with retry logic
    let entireHistoryOption = null
    let retryCount = 0
    const maxRetries = 3

    while (!entireHistoryOption && retryCount < maxRetries) {
      await page.waitForTimeout(500) // Give dropdown time to appear

      // Debug: log all menu items found
      const allMenuItems = document.querySelectorAll('div[role="menuitemcheckbox"], div[role="menuitem"]')
      console.log(`[DEBUG] Found ${allMenuItems.length} menu items:`)
      for (let i = 0; i < Math.min(allMenuItems.length, 10); i++) {
        const item = allMenuItems[i]
        console.log(`  ${i}: "${(item.textContent || '').trim()}" (aria-label: "${item.getAttribute('aria-label') || 'none'}")`)
      }

      entireHistoryOption = await tv._findEntireHistoryOption()

      if (!entireHistoryOption) {
        retryCount++
        console.log(`[INFO] "Entire history" option not found, retry ${retryCount}/${maxRetries}`)

        if (retryCount < maxRetries) {
          // Try clicking the button again
          console.log('[INFO] Clicking date range button again...')
          page.mouseClick(dateRangeButton)
          await page.waitForTimeout(300)
        }
      }
    }

    if (!entireHistoryOption) {
      // Final debug attempt - show what we can find
      const allMenuItems = document.querySelectorAll('div[role="menuitemcheckbox"], div[role="menuitem"]')
      const menuTexts = Array.from(allMenuItems).map(item => `"${(item.textContent || '').trim()}"`).join(', ')
      throw new Error(`Could not find "Entire history" option in dropdown after ${maxRetries} attempts. Found menu items: ${menuTexts}. Please try manually clicking the date range button and selecting "Entire history".`)
    }

    // Verify option is clickable
    if (entireHistoryOption.getAttribute('aria-disabled') === 'true') {
      throw new Error('"Entire history" option is disabled. This may indicate insufficient data or subscription limitations.')
    }

    console.log('[INFO] Selecting "Entire history" option')
    page.mouseClick(entireHistoryOption)

    // Wait and verify the selection took effect
    await page.waitForTimeout(1500)

    // Check for "Update report" snackbar and click if present
    const updateClicked = await tv._findAndClickUpdateReportButton()
    if (updateClicked) {
      console.log('[INFO] Update report button clicked and success confirmed')
      // No additional timeout needed - success waiting is handled in _findAndClickUpdateReportButton
    }

    console.log('[INFO] Deep testing mode enabled using new UI')
  }

  if ((typeof selStatus.userDoNotHaveDeepBacktest === 'undefined' || selStatus.userDoNotHaveDeepBacktest) && !isDeepTest)
    return // Do not check if user do not have userDoNotHaveDeepBacktest switch

  if (selStatus.isNewVersion === false) {
    console.log('[INFO] FOR PREVIOUS VERSION (Feb of 2025) DEEP BACKTEST SHOULD BE SET MANUALLY')
    return
  }

  // Check if new UI is available first
  const hasNewUI = await tv._isNewDeepTestUIAvailable()

  if (hasNewUI) {
    console.log('[INFO] Detected new deep testing UI')
    if (!isDeepTest) {
      console.log('[INFO] Deep testing disabled - no action needed for new UI')
      return
    }

    try {
      await turnNewDeepModeOn()
      selStatus.userDoNotHaveDeepBacktest = false

      // Validate that deep testing was actually enabled
      await page.waitForTimeout(1000)
      const generateBtn = page.$(SEL.strategyDeepTestGenerateBtn)
      if (!generateBtn) {
        console.log('[WARNING] Generate button not found after enabling deep testing')
      } else {
        console.log('[SUCCESS] Deep testing enabled successfully using new UI')
      }

      return
    } catch (err) {
      console.error('[ERROR] Failed to use new deep testing UI:', err.message)
      console.log('[INFO] Attempting to fall back to legacy UI...')
      // Fall through to try old UI as backup
    }
  }

  // Fallback to old UI approach
  console.log('[INFO] Using legacy deep testing UI')
  let deepCheckboxEl = await page.waitForSelector(SEL.strategyDeepTestCheckbox, 2000)
  if (!deepCheckboxEl) {
    selStatus.userDoNotHaveDeepBacktest = true
    if (isDeepTest) {
      const errorMsg = hasNewUI
        ? 'Both new and legacy deep testing UI failed. TradingView interface may have changed significantly. Please check if you have Premium subscription and try manually enabling deep testing.'
        : 'Deep Backtesting mode switch not found. Do you have Premium subscription or may be TV UI changed?'
      throw new Error(errorMsg)
    }
    return
  } else {
    selStatus.userDoNotHaveDeepBacktest = false
  }

  if (!isDeepTest) {
    await turnDeepModeOff()
    return
  }
  if (isTurnedOff())
    await turnDeepModeOn()
  // deepStartDate functionality removed - now using "Entire history" automatically
}

tv.checkAndOpenStrategy = async (name, isDeepTest = false) => {
  let indicatorTitleEl = page.$(SEL.indicatorTitle)
  if (!indicatorTitleEl || indicatorTitleEl.innerText !== name) {
    try {
      await tv.openStrategyTab(isDeepTest)
    } catch (err) {
      console.warn('checkAndOpenStrategy error', err)
      return null
    }
    const isOpened = await tv.openStrategyParameters(name)
    if (!isOpened) {
      console.warn('Can able to open current strategy parameters')
      await ui.showErrorPopup('Can able to open current strategy parameters Reload the page, leave one strategy on the chart and try again.')
      return null
    }
    if (name) {
      indicatorTitleEl = page.$(SEL.indicatorTitle)
      if (!indicatorTitleEl || indicatorTitleEl.innerText !== name) {
        await ui.showErrorPopup(`The ${name} strategy parameters could not opened. ${indicatorTitleEl.innerText ? 'Opened "' + indicatorTitleEl.innerText + '".' : ''} Reload the page, leave one strategy on the chart and try again.`)
        return null
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

tv.openStrategyTab = async (isDeepTest = false) => {
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
    await tv.setDeepTest(isDeepTest)
    if (isDeepTest) {
      // Check if we're using the new UI where "Entire history" selection automatically generates the report
      const hasNewUI = await tv._isNewDeepTestUIAvailable()
      if (!hasNewUI) {
        // Only click generate button for old UI
        const generateBtnEl = page.$(SEL.strategyDeepTestGenerateBtn)
        if (generateBtnEl)
          page.mouseClick(generateBtnEl)
      } else {
        console.log('[INFO] New UI detected - report generation handled automatically by "Entire history" selection')
      }
    }
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

tv.switchToStrategyTabAndSetObserveForReport = async (isDeepTest = false) => {
  await tv.openStrategyTab(isDeepTest)

  const testResults = {}
  testResults.ticker = await tvChart.getTicker()
  testResults.timeFrame = await tvChart.getCurrentTimeFrame()
  let strategyCaptionEl = document.querySelector(SEL.strategyCaption)
  testResults.name = strategyCaptionEl.getAttribute('data-strategy-title') //strategyCaptionEl.innerText

  const reportEl = await page.waitForSelector(SEL.strategyReportObserveArea, 10000)
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

  if (isDeepTest) {
    if (!tv.reportDeepNode) {
      tv.reportDeepNode = await page.waitForSelector(SEL.strategyReportDeepTestObserveArea, 5000)
      if (tv.reportDeepNode) {
        const reportObserver = new MutationObserver(() => {
          tv.isReportChanged = true
        });
        reportObserver.observe(tv.reportDeepNode, {
          childList: true,
          subtree: true,
          attributes: false,
          characterData: false
        });
        console.log('[INFO] Observer added to tv.reportDeepNode')
      } else {
        console.error('[INFO] The strategy deep report did not found.')
      }
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

tv._parseRows = (allReportRowsEl, strategyHeaders, report) => {
  function parseNumTypeByRowName(rowName, value) {
    const digitalValues = value.replaceAll(/([\-\d\.\n])|(.)/g, (a, b) => b || '')
    return rowName.toLowerCase().includes('trades') || rowName.toLowerCase().includes('contracts held')
      ? parseInt(digitalValues)
      : parseFloat(digitalValues)
  }

  for (let rowEl of allReportRowsEl) {
    if (rowEl) {
      const allTdEl = rowEl.querySelectorAll('td')
      if (!allTdEl || allTdEl.length < 2 || !allTdEl[0]) {
        continue
      }
      let paramName = allTdEl[0].innerText || ''
      paramName = tv.convertParameterName(paramName)
      let isSingleValue = allTdEl.length === 3 || ['Buy & hold return', 'Max equity run-up', 'Max equity drawdown',
        'Open P&L', 'Sharpe ratio', 'Sortino ratio'
      ].includes(paramName)
      for (let i = 1; i < allTdEl.length; i++) {
        if (isSingleValue && i >= 2)
          continue
        let values = allTdEl[i].innerText
        const isNegative = ['Gross loss', 'Commission paid', 'Max equity run-up', 'Max equity drawdown',
          'Losing trades', 'Avg losing trade', 'Largest losing trade', 'Largest losing trade percent',
          'Avg # bars in losing trades', 'Margin calls'
        ].includes(paramName.toLowerCase())// && allTdEl[i].querySelector('[class^="negativeValue"]')
        if (values && typeof values === 'string' && strategyHeaders[i]) {
          values = values.replaceAll(' ', ' ').replaceAll('−', '-').trim()
          const digitalValues = values.replaceAll(/([\-\d\.\n])|(.)/g, (a, b) => b || '')
          let digitOfValues = digitalValues.match(/-?\d+\.?\d*/)
          const nameDigits = isSingleValue ? paramName : `${paramName}: ${strategyHeaders[i]}`
          const namePercents = isSingleValue ? `${paramName} %` : `${paramName} %: ${strategyHeaders[i]}`
          if ((values.includes('\n') && values.endsWith('%'))) {
            const valuesPair = values.split('\n', 3)
            if (valuesPair && valuesPair.length >= 2) {
              const digitVal0 = valuesPair[0] //.replaceAll(/([\-\d\.])|(.)/g, (a, b) => b || '') //.match(/-?\d+\.?\d*/)
              const digitVal1 = valuesPair[valuesPair.length - 1]//.replaceAll(/([\-\d\.])|(.)/g, (a, b) => b || '') //match(/-?\d+\.?\d*/)

              if (Boolean(digitVal0)) {
                report[nameDigits] = parseNumTypeByRowName(nameDigits, digitVal0)
                if (report[nameDigits] > 0 && isNegative)
                  report[nameDigits] = report[nameDigits] * -1
              } else {
                report[nameDigits] = valuesPair[0]
              }
              if (Boolean(digitVal1)) {
                report[namePercents] = parseNumTypeByRowName(namePercents, digitVal1)
                if (report[namePercents] > 0 && isNegative)
                  report[namePercents] = report[namePercents] * -1
              } else {
                report[namePercents] = valuesPair[1]
              }
            }
          } else if (Boolean(digitOfValues)) {
            report[nameDigits] = parseNumTypeByRowName(namePercents, digitalValues)
            if (report[nameDigits] > 0 && isNegative)
              report[nameDigits] = report[nameDigits] * -1
          } else
            report[nameDigits] = values
        }
      }
    }
  }
  return report
}


tv.parseReportTable = async (isDeepTest) => {
  const selHeader = isDeepTest ? SEL.strategyReportDeepTestHeader : SEL.strategyReportHeader
  const selRow = isDeepTest ? SEL.strategyReportDeepTestRow : SEL.strategyReportRow
  await page.waitForSelector(selHeader, 2500)

  let allHeadersEl = document.querySelectorAll(selHeader)
  if (!allHeadersEl || !(allHeadersEl.length === 4 || allHeadersEl.length === 5)) { // 5 - Extra column for full screen
    if (!tv.isParsed)
      throw new Error('Can\'t get performance headers.' + SUPPORT_TEXT)
    else
      return {}
  }
  let strategyHeaders = []
  for (let headerEl of allHeadersEl) {
    if (headerEl)
      strategyHeaders.push(headerEl.innerText)
  }
  let report = {}
  await page.waitForSelector(selRow, 2500)
  let allReportRowsEl = document.querySelectorAll(selRow)
  if (!allReportRowsEl || allReportRowsEl.length === 0) {
    if (!tv.isParsed)
      throw new Error('Can\'t get performance rows.' + SUPPORT_TEXT)
  } else {
    tv.isParsed = true
  }
  report = tv._parseRows(allReportRowsEl, strategyHeaders, report)
  if (selStatus.isNewVersion) {
    const tabs = [
      [SEL.strategyTradeAnalysisTab, SEL.strategyTradeAnalysisTabActive],
      [SEL.strategyRatiosTab, SEL.strategyRatiosTabActive]]
    for (const sel of tabs) {
      page.mouseClickSelector(sel[0])
      const tabEl = await page.waitForSelector(sel[1], 1000)
      if (tabEl) {
        strategyHeaders = []
        allHeadersEl = document.querySelectorAll(selHeader)
        for (let headerEl of allHeadersEl) {
          if (headerEl)
            strategyHeaders.push(headerEl.innerText)
        }
        await page.waitForSelector(selRow, 2500)
        let allReportRowsEl = document.querySelectorAll(selRow)
        if (allReportRowsEl && allReportRowsEl.length !== 0) {
          report = tv._parseRows(allReportRowsEl, strategyHeaders, report)
        }
      }
    }
    page.mouseClickSelector(SEL.strategyPerformanceTab)
    await page.waitForSelector(SEL.strategyPerformanceTabActive, 1000)
  }
  return report
}

tv.generateDeepTestReport = async () => { //loadingTime = 60000) => {
  // Check if we're using the new UI where "Entire history" selection automatically generates the report
  const hasNewUI = await tv._isNewDeepTestUIAvailable()

  if (hasNewUI) {
    console.log('[INFO] Using new deep testing UI - report should already be generated after "Entire history" selection')

    // Check for "Update report" snackbar first
    const updateClicked = await tv._findAndClickUpdateReportButton()
    if (updateClicked) {
      console.log('[INFO] Update report button clicked and success confirmed')
      // No additional timeout needed - success waiting is handled in _findAndClickUpdateReportButton
    }

    // In the new UI, selecting "Entire history" automatically triggers the deep testing
    // We just need to wait for the report to be ready, no generate button to click

    // Check if report is already ready
    const reportReady = page.$(SEL.strategyReportDeepTestReady)
    if (reportReady) {
      console.log('[INFO] Deep test report is already ready')
      return ''
    }

    // Check if report is in progress
    const reportInProgress = page.$(SEL.strategyReportDeepTestInProcess)
    if (reportInProgress) {
      console.log('[INFO] Deep test report is in progress, waiting...')
      return ''
    }

    // If neither ready nor in progress, the report should have been generated automatically
    console.log('[INFO] Deep test report generation completed automatically with new UI')
    return ''
  }

  // Fallback to old UI logic
  console.log('[INFO] Using legacy deep testing UI with generate button')
  let generateBtnEl = await page.waitForSelector(SEL.strategyDeepTestGenerateBtn, 3000)
  if (generateBtnEl) {
    console.log('[INFO] Found deep test generate button, clicking...')
    generateBtnEl.click()
    await page.waitForSelector(SEL.strategyDeepTestGenerateBtnDisabled, 1000) // Some times is not started
    let progressEl = await page.waitForSelector(SEL.strategyReportDeepTestInProcess, 1000)
    generateBtnEl = await page.$(SEL.strategyDeepTestGenerateBtn)
    if (!progressEl && generateBtnEl) { // Some time button changed, but returned
      console.log('[INFO] Progress not detected, clicking generate button again...')
      generateBtnEl.click()
    }

  } else if (page.$(SEL.strategyDeepTestGenerateBtnDisabled)) {
    return 'Deep backtesting strategy parameters are not changed'
  } else {
    throw new Error('Error for generate deep backtesting report due the button is not exist.' + SUPPORT_TEXT)
  }
  return ''
}


tv.getPerformance = async (testResults, isIgnoreError = false) => {
  let reportData = {}
  let message = ''
  let isProcessError = null
  let selProgress = SEL.strategyReportInProcess
  let selReady = SEL.strategyReportReady
  const dataWaitingTime = testResults.isDeepTest ? testResults.dataLoadingTime * 2000 : testResults.dataLoadingTime * 1000
  if (testResults.isDeepTest) {
    message = await tv.generateDeepTestReport() //testResults.dataLoadingTime * 2000)
    if (message)
      isProcessError = true
    selProgress = SEL.strategyReportDeepTestInProcess
    selReady = SEL.strategyReportDeepTestReady
  }

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

  if (!isProcessError)
    reportData = await tv.parseReportTable(testResults.isDeepTest)
  if (!isProcessError && !isProcessEnd && testResults.perfomanceSummary.length && !testResults.isDeepTest) {
    const lastRes = testResults.perfomanceSummary[testResults.perfomanceSummary.length - 1] // (!) Previous value maybe in testResults.filteredSummary
    if (reportData.hasOwnProperty(testResults.optParamName) && lastRes.hasOwnProperty(testResults.optParamName) &&
      reportData[testResults.optParamName] !== lastRes[testResults.optParamName]) {
      isProcessEnd = true
      isProcessStart = true
    }
  }
  if (reportData['comment'])
    message += '. ' + reportData['comment']
  const comment = message ? message : testResults.isDeepTest ? 'Deep BT. ' : null
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
