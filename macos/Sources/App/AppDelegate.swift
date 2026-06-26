import AppKit

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
  let appModel = AppModel()

  private let hotKeyManager = HotKeyManager()
  private let floatingPillController = FloatingPillController()
  private lazy var appWindowController = AppWindowController(appModel: appModel)
  private var didConfigure = false

  func applicationDidFinishLaunching(_ notification: Notification) {
    NSApp.setActivationPolicy(.accessory)
    configureApplicationIcon()
    configureRuntime()
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
    false
  }

  func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
    showMainWindow(section: .settings)
    return true
  }

  func configureRuntime() {
    guard !didConfigure else {
      return
    }

    didConfigure = true
    floatingPillController.configure(appModel: appModel)
    let appModel = appModel

    do {
      try hotKeyManager.registerDefaultHotKeys(
        quick: { [weak appModel] in appModel?.runQuickCapture() },
        area: { [weak appModel] in appModel?.runAreaCapture(recording: false) }
      )
      appModel.hotKeyStatus = "Ctrl-Shift-T / Ctrl-Shift-S"
    } catch {
      appModel.hotKeyStatus = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    }
  }

  func showMainWindow(section: AppInterfaceSection) {
    configureRuntime()
    appWindowController.show(section: section)
  }

  private func configureApplicationIcon() {
    guard
      let iconURL = Bundle.module.url(forResource: "AppIcon", withExtension: "png"),
      let icon = NSImage(contentsOf: iconURL)
    else {
      return
    }

    NSApp.applicationIconImage = icon
  }
}
