import AppKit
import SwiftUI

@MainActor
final class FloatingPillController {
  private enum Defaults {
    static let originX = "floatingPillOriginX"
    static let originY = "floatingPillOriginY"
  }

  private var panel: NSPanel?
  private var screenObserver: NSObjectProtocol?
  private var dragStartOrigin: NSPoint?
  private var dragStartMouseLocation: NSPoint?

  func configure(appModel: AppModel) {
    ensurePanel(appModel: appModel)
    appModel.overlay.setAnchorFrameProvider { [weak self] in
      self?.panel?.frame
    }
    positionPanel()
    panel?.orderFrontRegardless()

    if screenObserver == nil {
      screenObserver = NotificationCenter.default.addObserver(
        forName: NSApplication.didChangeScreenParametersNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        Task { @MainActor in
          self?.positionPanel()
        }
      }
    }
  }

  deinit {
    if let screenObserver {
      NotificationCenter.default.removeObserver(screenObserver)
    }
  }

  private func ensurePanel(appModel: AppModel) {
    guard panel == nil else {
      return
    }

    let size = NSSize(width: 188, height: 70)
    let panel = NSPanel(
      contentRect: NSRect(origin: .zero, size: size),
      styleMask: [.borderless, .nonactivatingPanel],
      backing: .buffered,
      defer: false
    )
    panel.isReleasedWhenClosed = false
    panel.isOpaque = false
    panel.backgroundColor = .clear
    panel.hasShadow = false
    panel.level = .floating
    panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .transient, .stationary]
    panel.ignoresMouseEvents = false
    panel.contentView = ClearHostingView(
      rootView: FloatingCommandPillView(
        model: appModel,
        onDragStart: { [weak self] in
          self?.beginDrag()
        },
        onDragChanged: { [weak self, weak appModel] in
          self?.drag()
          appModel?.overlay.reposition()
        },
        onDragEnded: { [weak self, weak appModel] in
          self?.endDrag()
          appModel?.overlay.reposition()
        }
      )
    )

    self.panel = panel
  }

  private func positionPanel() {
    guard let panel else {
      return
    }

    let screenFrame = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1280, height: 800)
    let size = panel.frame.size
    let origin = savedOrigin() ?? defaultOrigin(for: size, in: screenFrame)
    panel.setFrameOrigin(clamped(origin, size: size, in: screenFrame))
  }

  private func beginDrag() {
    dragStartOrigin = panel?.frame.origin
    dragStartMouseLocation = NSEvent.mouseLocation
  }

  private func drag() {
    guard let panel, let dragStartOrigin, let dragStartMouseLocation else {
      return
    }

    let mouseLocation = NSEvent.mouseLocation
    let proposedOrigin = NSPoint(
      x: dragStartOrigin.x + mouseLocation.x - dragStartMouseLocation.x,
      y: dragStartOrigin.y + mouseLocation.y - dragStartMouseLocation.y
    )
    let screenFrame = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1280, height: 800)
    panel.setFrameOrigin(clamped(proposedOrigin, size: panel.frame.size, in: screenFrame))
  }

  private func endDrag() {
    guard let panel else {
      return
    }

    let origin = panel.frame.origin
    UserDefaults.standard.set(origin.x, forKey: Defaults.originX)
    UserDefaults.standard.set(origin.y, forKey: Defaults.originY)
    dragStartOrigin = nil
    dragStartMouseLocation = nil
  }

  private func savedOrigin() -> NSPoint? {
    let defaults = UserDefaults.standard
    guard defaults.object(forKey: Defaults.originX) != nil,
      defaults.object(forKey: Defaults.originY) != nil
    else {
      return nil
    }

    return NSPoint(
      x: defaults.double(forKey: Defaults.originX),
      y: defaults.double(forKey: Defaults.originY)
    )
  }

  private func defaultOrigin(for size: NSSize, in screenFrame: NSRect) -> NSPoint {
    NSPoint(
      x: screenFrame.midX - size.width / 2,
      y: screenFrame.minY + 22
    )
  }

  private func clamped(_ origin: NSPoint, size: NSSize, in screenFrame: NSRect) -> NSPoint {
    let inset: CGFloat = 8
    let minX = screenFrame.minX + inset
    let maxX = screenFrame.maxX - size.width - inset
    let minY = screenFrame.minY + inset
    let maxY = screenFrame.maxY - size.height - inset

    return NSPoint(
      x: min(max(origin.x, minX), maxX),
      y: min(max(origin.y, minY), maxY)
    )
  }
}

private final class ClearHostingView<Content: View>: NSHostingView<Content> {
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

private struct FloatingCommandPillView: View {
  @ObservedObject var model: AppModel
  var onDragStart: () -> Void
  var onDragChanged: () -> Void
  var onDragEnded: () -> Void

  @State private var isExpanded = false
  @State private var dragIsActive = false
  @State private var dragLockedExpansion: Bool?

  private let animation = Animation.smooth(duration: 0.28, extraBounce: 0)
  private var displayedExpanded: Bool {
    dragLockedExpansion ?? isExpanded
  }

  var body: some View {
    ZStack {
      Capsule()
        .fill(.ultraThinMaterial)
        .overlay(
          Capsule()
            .strokeBorder(.primary.opacity(0.12), lineWidth: 1)
        )

      CollapsedPillIcon(isRunning: model.isRunning)
        .opacity(displayedExpanded ? 0 : 1)
        .scaleEffect(displayedExpanded ? 0.86 : 1)

      expandedControls
        .opacity(displayedExpanded ? 1 : 0)
        .scaleEffect(displayedExpanded ? 1 : 0.96)
        .allowsHitTesting(displayedExpanded && !dragIsActive)
    }
    .frame(width: displayedExpanded ? 150 : 58, height: 48)
    .clipShape(Capsule())
    .shadow(color: .black.opacity(0.16), radius: 16, x: 0, y: 7)
    .animation(animation, value: displayedExpanded)
    .frame(width: 188, height: 70)
    .background(Color.clear)
    .contentShape(Capsule())
    .onHover { hovering in
      guard !dragIsActive else {
        return
      }
      withAnimation(animation) {
        isExpanded = hovering
      }
    }
    .simultaneousGesture(
      DragGesture(minimumDistance: 6)
        .onChanged { value in
          if !dragIsActive {
            dragIsActive = true
            dragLockedExpansion = isExpanded
            onDragStart()
          }
          onDragChanged()
        }
        .onEnded { _ in
          dragIsActive = false
          dragLockedExpansion = nil
          onDragEnded()
        }
    )
  }

  private var expandedControls: some View {
    HStack(spacing: 8) {
      PillButton(systemImage: "text.viewfinder", help: "Text") {
        model.runQuickCapture()
      }
      PillButton(systemImage: "selection.pin.in.out", help: "Screenshot") {
        model.runAreaCapture(recording: false)
      }
    }
    .padding(.horizontal, 10)
    .disabled(model.isRunning)
  }
}

private struct CollapsedPillIcon: View {
  var isRunning: Bool

  var body: some View {
    Group {
      if isRunning {
        ProgressView()
          .controlSize(.small)
      } else {
        VerifisGlyph()
          .frame(width: 19, height: 19)
          .accessibilityLabel("Verifis")
      }
    }
  }
}

private struct PillButton: View {
  var systemImage: String
  var help: String
  var action: () -> Void

  var body: some View {
    Button(action: action) {
      Image(systemName: systemImage)
        .font(.system(size: 15, weight: .semibold))
        .frame(width: 42, height: 34)
        .contentShape(RoundedRectangle(cornerRadius: 17, style: .continuous))
    }
    .buttonStyle(.plain)
    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 17, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 17, style: .continuous)
        .strokeBorder(.primary.opacity(0.08), lineWidth: 1)
    )
    .help(help)
  }
}
