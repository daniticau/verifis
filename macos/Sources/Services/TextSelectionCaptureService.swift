import AppKit

enum TextSelectionCaptureError: LocalizedError {
  case accessibilityUnavailable
  case copyEventFailed

  var errorDescription: String? {
    switch self {
    case .accessibilityUnavailable:
      return "Allow Accessibility for Verifis to read highlighted text."
    case .copyEventFailed:
      return "Could not send the copy shortcut to the frontmost app."
    }
  }
}

@MainActor
final class TextSelectionCaptureService {
  func captureSelectedText() async throws -> String? {
    guard PermissionService.isAccessibilityTrusted else {
      throw TextSelectionCaptureError.accessibilityUnavailable
    }

    let pasteboard = NSPasteboard.general
    let snapshot = PasteboardSnapshot(pasteboard: pasteboard)
    let startingChangeCount = pasteboard.changeCount

    try sendCopyEvent()

    let deadline = Date().addingTimeInterval(0.45)
    var copiedText: String?

    while Date() < deadline {
      try await Task.sleep(nanoseconds: 35_000_000)
      if pasteboard.changeCount != startingChangeCount {
        copiedText = pasteboard.string(forType: .string)
        break
      }
    }

    snapshot.restore(to: pasteboard)

    let trimmed = copiedText?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return trimmed.isEmpty ? nil : trimmed
  }

  private func sendCopyEvent() throws {
    guard let source = CGEventSource(stateID: .combinedSessionState),
          let keyDown = CGEvent(keyboardEventSource: source, virtualKey: 8, keyDown: true),
          let keyUp = CGEvent(keyboardEventSource: source, virtualKey: 8, keyDown: false)
    else {
      throw TextSelectionCaptureError.copyEventFailed
    }

    keyDown.flags = .maskCommand
    keyUp.flags = .maskCommand
    keyDown.post(tap: .cghidEventTap)
    keyUp.post(tap: .cghidEventTap)
  }
}
