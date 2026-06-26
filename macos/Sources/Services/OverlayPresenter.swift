import AppKit
import SwiftUI

enum OverlayState {
  case idle
  case loading(String)
  case result(AnalysisResult)
  case error(String)
}

@MainActor
final class OverlayPresenter: ObservableObject {
  @Published var state: OverlayState = .idle

  private var panel: NSPanel?
  private var hideTask: Task<Void, Never>?
  private var anchorFrameProvider: (() -> NSRect?)?

  func setAnchorFrameProvider(_ provider: @escaping () -> NSRect?) {
    anchorFrameProvider = provider
  }

  func show(_ state: OverlayState) {
    hideTask?.cancel()
    self.state = state
    ensurePanel()
    let finalFrame = frame(for: state)
    let startFrame = finalFrame.offsetBy(dx: 0, dy: -12)

    panel?.alphaValue = 0
    panel?.setFrame(startFrame, display: true)
    panel?.orderFrontRegardless()

    NSAnimationContext.runAnimationGroup { context in
      context.duration = 0.18
      context.allowsImplicitAnimation = true
      panel?.animator().alphaValue = 1
      panel?.animator().setFrame(finalFrame, display: true)
    }

    if case .result = state {
      scheduleAutoHide(after: 6)
    }
  }

  func reposition() {
    guard let panel, panel.isVisible else {
      return
    }

    panel.setFrame(frame(for: state), display: true)
  }

  func hide() {
    hideTask?.cancel()
    guard let panel else {
      return
    }

    let hiddenFrame = panel.frame.offsetBy(dx: 0, dy: -10)
    NSAnimationContext.runAnimationGroup { context in
      context.duration = 0.14
      context.allowsImplicitAnimation = true
      panel.animator().alphaValue = 0
      panel.animator().setFrame(hiddenFrame, display: true)
    } completionHandler: {
      panel.orderOut(nil)
    }
  }

  private func ensurePanel() {
    guard panel == nil else {
      return
    }

    let panel = NSPanel(
      contentRect: NSRect(origin: .zero, size: size(for: state)),
      styleMask: [.borderless, .nonactivatingPanel],
      backing: .buffered,
      defer: false
    )
    panel.isReleasedWhenClosed = false
    panel.isOpaque = false
    panel.backgroundColor = .clear
    panel.hasShadow = false
    panel.level = .floating
    panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .transient]
    panel.isMovableByWindowBackground = false
    panel.contentView = OverlayClearHostingView(rootView: OverlayPanelView(presenter: self))

    self.panel = panel
  }

  private func frame(for state: OverlayState) -> NSRect {
    let size = size(for: state)
    let screenFrame = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1280, height: 800)
    let anchorFrame = anchorFrameProvider?()
    let preferredX = (anchorFrame?.midX ?? screenFrame.midX) - size.width / 2
    let preferredY: CGFloat

    if let anchorFrame {
      let aboveY = anchorFrame.maxY + 10
      let belowY = anchorFrame.minY - size.height - 10
      preferredY = aboveY + size.height <= screenFrame.maxY - 8 ? aboveY : belowY
    } else {
      preferredY = screenFrame.minY + 84
    }

    let x = clamped(preferredX, min: screenFrame.minX + 8, max: screenFrame.maxX - size.width - 8)
    let y = clamped(preferredY, min: screenFrame.minY + 8, max: screenFrame.maxY - size.height - 8)
    return NSRect(x: x, y: y, width: size.width, height: size.height)
  }

  private func clamped(_ value: CGFloat, min minimum: CGFloat, max maximum: CGFloat) -> CGFloat {
    Swift.min(Swift.max(value, minimum), maximum)
  }

  private func size(for state: OverlayState) -> NSSize {
    switch state {
    case .idle:
      return NSSize(width: 300, height: 58)
    case .loading:
      return NSSize(width: 320, height: 58)
    case .error:
      return NSSize(width: 340, height: 92)
    case .result(let result):
      return NSSize(width: 360, height: result.claims.isEmpty ? 126 : 154)
    }
  }

  private func scheduleAutoHide(after seconds: UInt64) {
    hideTask = Task { [weak self] in
      try? await Task.sleep(nanoseconds: seconds * 1_000_000_000)
      guard !Task.isCancelled else {
        return
      }
      self?.hide()
    }
  }
}

private final class OverlayClearHostingView<Content: View>: NSHostingView<Content> {
  override var isOpaque: Bool {
    false
  }

  required init(rootView: Content) {
    super.init(rootView: rootView)
    wantsLayer = true
    layer?.backgroundColor = NSColor.clear.cgColor
    layer?.isOpaque = false
  }

  @available(*, unavailable)
  @MainActor dynamic required init?(coder: NSCoder) {
    nil
  }
}
