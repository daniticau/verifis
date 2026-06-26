import AppKit
import ApplicationServices

enum PermissionService {
  static var isAccessibilityTrusted: Bool {
    AXIsProcessTrusted()
  }

  static func promptForAccessibility() {
    let options = [
      kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true
    ] as CFDictionary
    AXIsProcessTrustedWithOptions(options)
  }

  static func openAccessibilitySettings() {
    openPrivacyPane(anchor: "Privacy_Accessibility")
  }

  static func openScreenRecordingSettings() {
    openPrivacyPane(anchor: "Privacy_ScreenCapture")
  }

  private static func openPrivacyPane(anchor: String) {
    guard let url = URL(string: "x-apple.systempreferences:com.apple.preference.security?\(anchor)") else {
      return
    }

    NSWorkspace.shared.open(url)
  }
}

