import Foundation
import Combine

@MainActor
final class AppModel: ObservableObject {
  let settings = AppSettings()
  let history = AnalysisHistoryStore()
  @Published var latestResult: AnalysisResult?
  @Published var latestError: String?
  @Published var isRunning = false
  @Published var hotKeyStatus = "Control-Shift-T"
  @Published var selectedInterfaceSection: AppInterfaceSection = .settings

  let overlay = OverlayPresenter()

  private let captureCoordinator = CaptureCoordinator()
  private let areaSelectionService = AreaSelectionService()
  private let providerClient = AIProviderClient()
  private var activeTask: Task<Void, Never>?
  private var cancellables: Set<AnyCancellable> = []

  init() {
    settings.objectWillChange
      .sink { [weak self] _ in
        self?.objectWillChange.send()
      }
      .store(in: &cancellables)
  }

  func runQuickCapture() {
    activeTask?.cancel()
    isRunning = true
    latestError = nil
    overlay.show(.loading("Reading highlighted text..."))

    activeTask = Task { [weak self] in
      await self?.performQuickCapture()
    }
  }

  func runAreaCapture(recording: Bool) {
    activeTask?.cancel()
    isRunning = true
    latestError = nil
    overlay.show(.loading(recording ? "Drag an area to record..." : "Drag an area to read..."))

    activeTask = Task { [weak self] in
      await self?.performAreaCapture(recording: recording)
    }
  }

  func analyzeTypedText(_ text: String) {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else {
      return
    }

    activeTask?.cancel()
    isRunning = true
    latestError = nil
    overlay.show(.loading("Analyzing text..."))

    let input = CaptureInput(
      text: String(trimmed.prefix(settings.maxCharacters)),
      source: .highlightedText,
      capturedAt: Date(),
      truncated: trimmed.count > settings.maxCharacters
    )
    activeTask = Task { [weak self] in
      await self?.analyze(input: input, startedAt: Date())
    }
  }

  private func performQuickCapture() async {
    let startedAt = Date()

    do {
      let input = try await captureCoordinator.captureSelectedText(maxCharacters: settings.maxCharacters)
      await analyze(input: input, startedAt: startedAt)
    } catch {
      show(error: error)
    }
  }

  private func performAreaCapture(recording: Bool) async {
    let startedAt = Date()

    do {
      let rect = try await areaSelectionService.selectArea()
      overlay.show(.loading(recording ? "Sampling area text..." : "Reading area text..."))
      let input = try await captureCoordinator.captureArea(
        rect,
        record: recording,
        maxCharacters: settings.maxCharacters
      )
      await analyze(input: input, startedAt: startedAt)
    } catch AreaSelectionError.cancelled {
      isRunning = false
      overlay.hide()
    } catch {
      show(error: error)
    }
  }

  private func analyze(input: CaptureInput, startedAt: Date) async {
    do {
      let provider = settings.provider
      overlay.show(.loading("Checking with \(provider.displayName)..."))
      let result = try await providerClient.analyze(
        input: input,
        provider: provider,
        mode: settings.mode,
        auth: settings.authContext(for: provider),
        model: settings.model(for: provider),
        startedAt: startedAt
      )
      latestResult = result
      history.add(result)
      latestError = nil
      isRunning = false
      overlay.show(.result(result))
    } catch {
      show(error: error)
    }
  }

  private func show(error: Error) {
    let message = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
    latestError = message
    isRunning = false
    overlay.show(.error(message))
  }
}
