import AppKit
import SwiftUI

@MainActor
final class AppWindowController {
  private let appModel: AppModel
  private var window: NSWindow?

  init(appModel: AppModel) {
    self.appModel = appModel
  }

  func show(section: AppInterfaceSection) {
    appModel.selectedInterfaceSection = section
    ensureWindow()
    guard let window else {
      return
    }

    NSApp.activate(ignoringOtherApps: true)
    window.makeKeyAndOrderFront(nil)
  }

  private func ensureWindow() {
    guard window == nil else {
      return
    }

    let contentView = ContentView(model: appModel)
      .frame(minWidth: 660, idealWidth: 720, minHeight: 460, idealHeight: 520)

    let window = NSWindow(
      contentRect: NSRect(x: 0, y: 0, width: 720, height: 520),
      styleMask: [.titled, .closable, .miniaturizable, .resizable],
      backing: .buffered,
      defer: false
    )
    window.title = "Verifis"
    window.isReleasedWhenClosed = false
    window.titlebarAppearsTransparent = true
    window.toolbarStyle = .unifiedCompact
    window.backgroundColor = .clear
    window.contentView = NSHostingView(rootView: contentView)
    window.center()

    self.window = window
  }
}
