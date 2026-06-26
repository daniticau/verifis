import AppKit

enum AreaSelectionError: LocalizedError {
  case cancelled
  case tooSmall

  var errorDescription: String? {
    switch self {
    case .cancelled:
      return "Area selection was cancelled."
    case .tooSmall:
      return "Select a larger area."
    }
  }
}

@MainActor
final class AreaSelectionService {
  private var panel: NSPanel?
  private var continuation: CheckedContinuation<NSRect, Error>?

  func selectArea() async throws -> NSRect {
    try await withCheckedThrowingContinuation { continuation in
      self.continuation = continuation
      showSelectionPanel()
    }
  }

  private func showSelectionPanel() {
    let screenFrame = NSScreen.main?.frame ?? NSRect(x: 0, y: 0, width: 1280, height: 800)
    let view = AreaSelectionView(frame: NSRect(origin: .zero, size: screenFrame.size))
    view.onComplete = { [weak self, weak view] rect in
      guard let self, let view, let window = view.window else {
        return
      }

      let windowRect = view.convert(rect, to: nil)
      let screenRect = window.convertToScreen(windowRect)
      self.finish(with: screenRect)
    }
    view.onCancel = { [weak self] in
      self?.cancel()
    }

    let panel = AreaSelectionPanel(
      contentRect: screenFrame,
      styleMask: [.borderless],
      backing: .buffered,
      defer: false
    )
    panel.level = .modalPanel
    panel.isOpaque = false
    panel.backgroundColor = .clear
    panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .transient]
    panel.ignoresMouseEvents = false
    panel.contentView = view
    NSApp.activate(ignoringOtherApps: true)
    panel.makeKeyAndOrderFront(nil)
    panel.orderFrontRegardless()

    self.panel = panel
  }

  private func finish(with rect: NSRect) {
    guard rect.width >= 24, rect.height >= 24 else {
      continuation?.resume(throwing: AreaSelectionError.tooSmall)
      cleanup()
      return
    }

    continuation?.resume(returning: rect)
    cleanup()
  }

  private func cancel() {
    continuation?.resume(throwing: AreaSelectionError.cancelled)
    cleanup()
  }

  private func cleanup() {
    panel?.orderOut(nil)
    panel = nil
    continuation = nil
  }
}

private final class AreaSelectionPanel: NSPanel {
  override var canBecomeKey: Bool { true }
  override var canBecomeMain: Bool { true }
}

private final class AreaSelectionView: NSView {
  var onComplete: ((NSRect) -> Void)?
  var onCancel: (() -> Void)?

  private var startPoint: NSPoint?
  private var currentRect: NSRect = .zero

  override var acceptsFirstResponder: Bool { true }
  override var isFlipped: Bool { true }

  override func viewDidMoveToWindow() {
    window?.makeFirstResponder(self)
  }

  override func draw(_ dirtyRect: NSRect) {
    NSColor.black.withAlphaComponent(0.28).setFill()
    bounds.fill()

    guard !currentRect.isEmpty else {
      drawHint()
      return
    }

    NSColor.white.withAlphaComponent(0.12).setFill()
    NSBezierPath(roundedRect: currentRect, xRadius: 8, yRadius: 8).fill()

    NSColor.white.withAlphaComponent(0.95).setStroke()
    let path = NSBezierPath(roundedRect: currentRect, xRadius: 8, yRadius: 8)
    path.lineWidth = 2
    path.stroke()
  }

  override func mouseDown(with event: NSEvent) {
    startPoint = convert(event.locationInWindow, from: nil)
    currentRect = .zero
    needsDisplay = true
  }

  override func mouseDragged(with event: NSEvent) {
    guard let startPoint else {
      return
    }

    let point = convert(event.locationInWindow, from: nil)
    currentRect = NSRect(
      x: min(startPoint.x, point.x),
      y: min(startPoint.y, point.y),
      width: abs(point.x - startPoint.x),
      height: abs(point.y - startPoint.y)
    )
    needsDisplay = true
  }

  override func mouseUp(with event: NSEvent) {
    guard !currentRect.isEmpty else {
      onCancel?()
      return
    }

    onComplete?(currentRect)
  }

  override func keyDown(with event: NSEvent) {
    if event.keyCode == 53 {
      onCancel?()
    } else {
      super.keyDown(with: event)
    }
  }

  private func drawHint() {
    let hint = "Drag an area"
    let attributes: [NSAttributedString.Key: Any] = [
      .font: NSFont.systemFont(ofSize: 22, weight: .semibold),
      .foregroundColor: NSColor.white.withAlphaComponent(0.9)
    ]
    let size = hint.size(withAttributes: attributes)
    let origin = NSPoint(x: bounds.midX - size.width / 2, y: bounds.midY - size.height / 2)
    hint.draw(at: origin, withAttributes: attributes)
  }
}
