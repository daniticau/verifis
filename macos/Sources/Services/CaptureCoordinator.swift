import Foundation

enum CaptureCoordinatorError: LocalizedError {
  case noTextFound

  var errorDescription: String? {
    switch self {
    case .noTextFound:
      return "Highlight text, then press Control-Shift-T again."
    }
  }
}

@MainActor
final class CaptureCoordinator {
  private let textSelectionService = TextSelectionCaptureService()
  private let screenTextService = ScreenTextCaptureService()

  func captureBestText(screenOCRFallback: Bool, maxCharacters: Int) async throws -> CaptureInput {
    do {
      if let selectedText = try await textSelectionService.captureSelectedText(), !selectedText.isEmpty {
        let processed = truncate(selectedText, maxCharacters: maxCharacters)
        return CaptureInput(
          text: processed.text,
          source: .highlightedText,
          capturedAt: Date(),
          truncated: processed.truncated
        )
      }
    } catch {
      guard screenOCRFallback else {
        throw error
      }
    }

    guard screenOCRFallback else {
      throw CaptureCoordinatorError.noTextFound
    }

    let screenText = try await screenTextService.captureVisibleText()
    let trimmed = screenText.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      throw CaptureCoordinatorError.noTextFound
    }

    let processed = truncate(trimmed, maxCharacters: maxCharacters)
    return CaptureInput(
      text: processed.text,
      source: .screenOCR,
      capturedAt: Date(),
      truncated: processed.truncated
    )
  }

  func captureSelectedText(maxCharacters: Int) async throws -> CaptureInput {
    guard let selectedText = try await textSelectionService.captureSelectedText(), !selectedText.isEmpty else {
      throw CaptureCoordinatorError.noTextFound
    }

      let processed = truncate(selectedText, maxCharacters: maxCharacters)
      return CaptureInput(
        text: processed.text,
        source: .highlightedText,
        capturedAt: Date(),
        truncated: processed.truncated
      )
  }

  func captureArea(_ screenRect: NSRect, record: Bool, maxCharacters: Int) async throws -> CaptureInput {
    let text = try await (record
      ? screenTextService.recordText(in: screenRect)
      : screenTextService.captureText(in: screenRect))

    let processed = truncate(text.trimmingCharacters(in: .whitespacesAndNewlines), maxCharacters: maxCharacters)
    return CaptureInput(
      text: processed.text,
      source: record ? .screenRecording : .screenArea,
      capturedAt: Date(),
      truncated: processed.truncated
    )
  }

  private func truncate(_ text: String, maxCharacters: Int) -> (text: String, truncated: Bool) {
    guard text.count > maxCharacters else {
      return (text, false)
    }

    return (String(text.prefix(maxCharacters)), true)
  }
}
