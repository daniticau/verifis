import AppKit
import SwiftUI

@main
struct VerifisApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

  var body: some Scene {
    MenuBarExtra {
      Button("Settings") {
        appDelegate.showMainWindow(section: .settings)
      }

      Button("History") {
        appDelegate.showMainWindow(section: .history)
      }

      Divider()

      Button("Quit Verifis") {
        NSApp.terminate(nil)
      }
      .keyboardShortcut("q")
    } label: {
      VerifisGlyph()
        .frame(width: 18, height: 18)
        .accessibilityLabel("Verifis")
    }
    .menuBarExtraStyle(.menu)
  }
}
