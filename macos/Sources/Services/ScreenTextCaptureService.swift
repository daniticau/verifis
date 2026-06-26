import AppKit
import Vision

enum ScreenTextCaptureError: LocalizedError {
  case displayUnavailable
  case screenshotUnavailable
  case noTextRecognized

  var errorDescription: String? {
    switch self {
    case .displayUnavailable:
      return "No active display is available."
    case .screenshotUnavailable:
      return "Could not capture the screen. Allow Screen Recording for Verifis in System Settings."
    case .noTextRecognized:
      return "No readable text was found on the visible screen."
    }
  }
}

@MainActor
final class ScreenTextCaptureService {
  func captureVisibleText() async throws -> String {
    guard CGPreflightScreenCaptureAccess() else {
      throw ScreenTextCaptureError.screenshotUnavailable
    }

    guard let screen = NSScreen.main,
          let screenNumber = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber
    else {
      throw ScreenTextCaptureError.displayUnavailable
    }

    let displayID = CGDirectDisplayID(screenNumber.uint32Value)
    guard let image = CGDisplayCreateImage(displayID) else {
      throw ScreenTextCaptureError.screenshotUnavailable
    }

    let text = try await recognizeText(in: image)
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      throw ScreenTextCaptureError.noTextRecognized
    }

    return trimmed
  }

  func captureText(in screenRect: NSRect) async throws -> String {
    guard CGPreflightScreenCaptureAccess() else {
      throw ScreenTextCaptureError.screenshotUnavailable
    }

    guard let screen = NSScreen.main,
          let screenNumber = screen.deviceDescription[NSDeviceDescriptionKey("NSScreenNumber")] as? NSNumber
    else {
      throw ScreenTextCaptureError.displayUnavailable
    }

    let displayID = CGDirectDisplayID(screenNumber.uint32Value)
    guard let image = CGDisplayCreateImage(displayID) else {
      throw ScreenTextCaptureError.screenshotUnavailable
    }

    let cropRect = pixelRect(for: screenRect, in: screen, image: image)
    guard let cropped = image.cropping(to: cropRect) else {
      throw ScreenTextCaptureError.screenshotUnavailable
    }

    let text = try await recognizeText(in: cropped)
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      throw ScreenTextCaptureError.noTextRecognized
    }

    return trimmed
  }

  func recordText(in screenRect: NSRect, duration: TimeInterval = 1.2) async throws -> String {
    let startedAt = Date()
    var lines: [String] = []
    var seen = Set<String>()

    repeat {
      if let text = try? await captureText(in: screenRect) {
        for line in text.components(separatedBy: .newlines) {
          let normalized = line.trimmingCharacters(in: .whitespacesAndNewlines)
          guard !normalized.isEmpty, !seen.contains(normalized) else {
            continue
          }
          seen.insert(normalized)
          lines.append(normalized)
        }
      }

      try await Task.sleep(nanoseconds: 180_000_000)
    } while Date().timeIntervalSince(startedAt) < duration

    let text = lines.joined(separator: "\n")
    guard !text.isEmpty else {
      throw ScreenTextCaptureError.noTextRecognized
    }

    return text
  }

  private func pixelRect(for rect: NSRect, in screen: NSScreen, image: CGImage) -> CGRect {
    let scale = screen.backingScaleFactor
    let screenFrame = screen.frame
    let x = (rect.minX - screenFrame.minX) * scale
    let yFromBottom = (rect.minY - screenFrame.minY) * scale
    let y = CGFloat(image.height) - yFromBottom - rect.height * scale
    let raw = CGRect(x: x, y: y, width: rect.width * scale, height: rect.height * scale).integral
    let bounds = CGRect(x: 0, y: 0, width: image.width, height: image.height)
    return raw.intersection(bounds)
  }

  private func recognizeText(in image: CGImage) async throws -> String {
    try await Task.detached(priority: .userInitiated) {
      let request = VNRecognizeTextRequest()
      request.recognitionLevel = .fast
      request.usesLanguageCorrection = true
      request.minimumTextHeight = 0.012

      let handler = VNImageRequestHandler(cgImage: image, options: [:])
      try handler.perform([request])

      let lines = request.results?
        .compactMap { $0.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty } ?? []

      return lines.joined(separator: "\n")
    }.value
  }
}
