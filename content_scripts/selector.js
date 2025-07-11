const selStatus = {
  isNewVersion: null,
  userDoNotHaveDeepBacktest: null
}


const SEL = {
  tvLegendIndicatorItem: 'div[data-name="legend"] div[class^="sourcesWrapper"] div[class^="sources"] div[data-name="legend-source-item"]',
  tvLegendIndicatorItemTitle: 'div[data-name="legend-source-title"]',
  tvDialogRoot: '#overlap-manager-root',
  indicatorTitle: '#overlap-manager-root div[data-name="indicator-properties-dialog"] [class^="container"] div[class^="title"]',
  tabInput: '#overlap-manager-root div[data-name="indicator-properties-dialog"] [class^="tab"] button#inputs',
  tabInputActive: '#overlap-manager-root div[data-name="indicator-properties-dialog"] [class^="tab"] button#inputs[class*="selected"]',
  tabProperties: '#overlap-manager-root div[data-name="indicator-properties-dialog"] [class^="tab"] button#properties',
  ticker: '#header-toolbar-symbol-search > div[class*="text-"]',
  timeFrame: '#header-toolbar-intervals div[data-role^="button"]',
  timeFrameActive: '#header-toolbar-intervals div[data-role^="button"][class*="isActive"]',
  indicatorScroll: 'div[data-name="indicator-properties-dialog"] div[class^="scrollable-"]',
  indicatorProperty: 'div[data-name="indicator-properties-dialog"] div[class^="content-"] div[class^="cell-"]',
  okBtn: 'div[data-name="indicator-properties-dialog"] div[class^="footer-"] button[name="submit"]',
  cancelBtn: 'div[data-name="indicator-properties-dialog"] span[data-name="close"][data-role="button"]',
  strategyTesterTab: '[data-name="backtesting"]', // 2023-10-19 #footer-chart-panel  or #bottom-area
  strategyTesterTabActive: '[data-name="backtesting"][data-active="true"]', // 2023-10-19 #footer-chart-panel  or #bottom-area
  strategyCaption: '#bottom-area  [class^="strategyGroup"] [data-strategy-title]',
  strategyMenuItemSettings: '[role="menu"] [role="menuitem"][aria-label^="Settings"]',
  strategyDialogParam: '#bottom-area div[class^="backtesting"]  [class^="strategyGroup"]  > div:nth-child(2) > button:nth-child(1)',
  // strategySummary: selStatus.isNewVersion ?  '[id="Performance"]' : '[id="Performance Summary"]',
  // strategySummaryActive: selStatus.isNewVersion ? '[id="Performance"][class*="selected"]' : '[id="Performance Summary"][class*="selected"]',
  get strategyPerformanceTab() {
    return selStatus.isNewVersion ? '[id="Performance"]' : '[id="Performance Summary"]'
  },
  goproPopupCloseButton: '[data-dialog-name="gopro"][class^="dialog"] button[class*="close"]',
  get strategyPerformanceTabActive() {
    return selStatus.isNewVersion ? '[id="Performance"][class*="selected"]' : '[id="Performance Summary"][class*="selected"]'
  },
    get strategyTradeAnalysisTab() {
    return selStatus.isNewVersion ? '[id="Trades Analysis"]' : '[id="Trade Analysis"]'
  },
    get strategyTradeAnalysisTabActive() {
    return selStatus.isNewVersion ? '[id="Trades Analysis"][class*="selected"]' : '[id="Trade Analysis"][class*="selected"]'
  },
      get strategyRatiosTab() {
    return selStatus.isNewVersion ? '[id="Ratios"]' : '[id="Ratios"]'
  },
    get strategyRatiosTabActive() {
    return selStatus.isNewVersion ? '[id="Ratios"][class*="selected"]' : '[id="Ratios"][class*="selected"]'
  },
  get strategyReportObserveArea() {
    return selStatus.isNewVersion ?
      '[class="backtesting deep-history"] div[class^="wrapper"]' :
      '#bottom-area div[class^="backtesting"] div[class^="widgetContainer"]'
  },
  get strategyReportInProcess() {
    return selStatus.isNewVersion ?
      '[class="backtesting deep-history"] div[class^="wrapper"] div[role="progressbar"]' :
      '#bottom-area div[class^="backtesting"] div[class^="widgetContainer"]  div[role="progressbar"]'
  },
  get strategyReportReady() {
    return selStatus.isNewVersion ?
      '[class="backtesting deep-history"] > div:nth-child(1) > div[class^="wrapper"] div[class^="ka root"]' :
      '#bottom-area div[class^="backtesting"] div[class^="widgetContainer"] div[class^="reportContainer"] [class*="root"]'
  },
  // strategyReportTransitionReady: '#bottom-area div.backtesting-content-wrapper > div:not(.opacity-transition).reports-content',
  get strategyReportError() {
    return selStatus.isNewVersion ?
      '[class="backtesting deep-history"] div[class^="wrapper"] [class*=emptyStateIcon]' :
      '#bottom-area div[class^="backtesting"] div[class^="container"] [class*=emptyStateIcon]'
  },
  get strategyReportHeader() {
    return selStatus.isNewVersion ?
      '[class="backtesting deep-history"] > div:nth-child(1) > div[class^="wrapper"] div[class^="ka root"] table thead > tr > th' :
      '#bottom-area div[class^="backtesting"] div[class^="widgetContainer"] div[class^="reportContainer"] table thead > tr > th'
  },
  get strategyReportRow() {
    return selStatus.isNewVersion ?
      '[class="backtesting deep-history"] > div:nth-child(1) > div[class^="wrapper"] div[class^="ka root"] table tbody > tr' :
      '#bottom-area  div[class^="backtesting"] div[class^="widgetContainer"] div[class^="reportContainer"] table tbody > tr'
  },



  get strategyUpdateReportSnackbar() {
    // Snackbar notification for outdated report
    return '[data-qa-id="backtesting-updated-report-snackbar"]'
  },

  get strategyUpdateReportButton() {
    // "Update report" button in the snackbar
    return '[data-qa-id="backtesting-updated-report-snackbar"] button'
  },

  get strategyUpdateReportButtonFallback() {
    // Fallback: any button with "Update report" tooltip (will check text programmatically)
    return 'button[data-overflow-tooltip-text="Update report"]'
  },

  get strategyUpdateReportSuccessToast() {
    // Success toast notification after report update
    return '[class*="toast"], [class*="snackbar"], [class*="notification"], [role="alert"], [role="status"]'
  },

  get strategyUpdateReportSuccessToastFallback() {
    // Fallback: any element that might contain success message
    return 'div[class*="message"], div[class*="alert"], div[class*="banner"]'
  },

  strategyListOptions: 'div[role="listbox"] div[data-name="menu-inner"] div[role="option"] span[class^="label-"]',
  strategyDefaultElement: '#property-actions',

  strategyImportExport: '#iondvImportExport',

  chartTicker: '#header-toolbar-symbol-search > div[class*="text-"]',
  chartTimeframeFavorite: '#header-toolbar-intervals button[data-value]',
  chartTimeframeActive: '#header-toolbar-intervals button[data-value][aria-checked="true"]',
  chartTimeframeMenuOrSingle: '#header-toolbar-intervals button[class^="menu"]',


  // chartTimeframeFavorite: '#header-toolbar-intervals div[data-role="button"][data-value]',
  // chartTimeframeActive: '#header-toolbar-intervals div[data-role="button"][data-value][class*="isActive"]',
  // chartTimeframeMenuOrSingle: '#header-toolbar-intervals div[data-role="button"][class^="menu"]',
  chartTimeframeMenuItem: "#overlap-manager-root div[data-name=\"menu-inner\"] div[class^=\"dropdown\"] div[data-value]",
  chartTimeframeMenuInput: "#overlap-manager-root div[data-name=\"menu-inner\"] div[class^=\"dropdown\"] div[class^=\"form\"] > input",
  chartTimeframeMenuType: "#overlap-manager-root div[data-name=\"menu-inner\"] div[class^=\"dropdown\"] div[class^=\"form\"] > div[class^=\"menu\"]",
  chartTimeframeMenuAdd: "#overlap-manager-root div[data-name=\"menu-inner\"] div[class^=\"dropdown\"] div[class^=\"form\"] > div[class^=\"add\"]",
  chartTimeframeMenuTypeItems: "#overlap-manager-root div[data-name=\"menu-inner\"] > div[class^=\"item\"]",
  chartTimeframeMenuTypeItemsMin: "#overlap-manager-root div[data-name=\"menu-inner\"] > div[class^=\"item\"]:nth-child(1)",
  chartTimeframeMenuTypeItemsHours: "#overlap-manager-root div[data-name=\"menu-inner\"] > div[class^=\"item\"]:nth-child(2)",
  chartTimeframeMenuTypeItemsDays: "#overlap-manager-root div[data-name=\"menu-inner\"] > div[class^=\"item\"]:nth-child(3)",
  chartTimeframeMenuTypeItemsWeeks: "#overlap-manager-root div[data-name=\"menu-inner\"] > div[class^=\"item\"]:nth-child(4)",
  chartTimeframeMenuTypeItemsMonth: "#overlap-manager-root div[data-name=\"menu-inner\"] > div[class^=\"item\"]:nth-child(5)",
  chartTimeframeMenuTypeItemsRange: "#overlap-manager-root div[data-name=\"menu-inner\"] > div[class^=\"item\"]:nth-child(6)",

}
