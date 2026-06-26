import AppKit
import SwiftUI

struct ContentView: View {
  @ObservedObject var model: AppModel
  @ObservedObject private var settings: AppSettings
  @ObservedObject private var history: AnalysisHistoryStore

  init(model: AppModel) {
    self.model = model
    self._settings = ObservedObject(wrappedValue: model.settings)
    self._history = ObservedObject(wrappedValue: model.history)
  }

  var body: some View {
    NavigationSplitView {
      List(selection: $model.selectedInterfaceSection) {
        ForEach(AppInterfaceSection.allCases) { section in
          Label(section.title, systemImage: section.systemImage)
            .tag(section)
        }
      }
      .listStyle(.sidebar)
      .navigationSplitViewColumnWidth(min: 150, ideal: 160, max: 190)
    } detail: {
      Group {
        switch model.selectedInterfaceSection {
        case .settings:
          SettingsPane(settings: settings)
        case .history:
          HistoryPane(history: history)
        }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .background(.regularMaterial)
    }
    .background(.ultraThinMaterial)
  }
}

private struct SettingsPane: View {
  @ObservedObject var settings: AppSettings
  @State private var showAllKeys = false

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 14) {
        HeaderView(title: "Settings", systemImage: "gearshape")

        GlassSection {
          SettingRow("Provider") {
            Picker("Provider", selection: $settings.provider) {
              ForEach(AIProvider.allCases) { provider in
                Text(provider.displayName).tag(provider)
              }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
          }

          SettingRow("Mode") {
            Picker("Mode", selection: $settings.mode) {
              ForEach(AnalysisMode.allCases) { mode in
                Text(mode.displayName).tag(mode)
              }
            }
            .pickerStyle(.segmented)
            .labelsHidden()
          }

          SettingRow("Model") {
            Picker("Model", selection: modelBinding(for: settings.provider)) {
              ForEach(modelOptions(for: settings.provider)) { option in
                Text(option.menuTitle).tag(option.id)
              }
            }
            .pickerStyle(.menu)
            .labelsHidden()
          }

          authControls

          DisclosureGroup("Provider Keys", isExpanded: $showAllKeys) {
            VStack(spacing: 8) {
              keyRow(.gemini)
              keyRow(.openAI)
              keyRow(.anthropic)
            }
            .padding(.top, 6)
          }
          .font(.caption)
        }

        GlassSection {
          Toggle("Screen OCR fallback", isOn: $settings.screenOCRFallback)

          SettingRow("Limit") {
            Stepper("\(settings.maxCharacters) chars", value: $settings.maxCharacters, in: 500...5000, step: 250)
          }

          HStack(spacing: 8) {
            Button {
              PermissionService.promptForAccessibility()
            } label: {
              Label("Accessibility", systemImage: "person.crop.circle.badge.checkmark")
            }

            Button {
              PermissionService.openScreenRecordingSettings()
            } label: {
              Label("Screen Capture", systemImage: "rectangle.on.rectangle")
            }
          }
          .controlSize(.small)
        }
      }
      .padding(18)
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }

  @ViewBuilder
  private var authControls: some View {
    if settings.provider == .ollama {
      SettingRow("Server") {
        TextField("http://127.0.0.1:11434", text: $settings.ollamaBaseURL)
          .textFieldStyle(.roundedBorder)
      }

      Text("No API key needed. Install Ollama, run it, then pull the selected model.")
        .font(.caption)
        .foregroundStyle(.secondary)
        .fixedSize(horizontal: false, vertical: true)
    } else if settings.provider == .gemini {
      SettingRow("Auth") {
        Picker("Auth", selection: $settings.geminiAuthMethod) {
          Text("API Key").tag(AuthMethod.apiKey)
          Text("OAuth").tag(AuthMethod.oauth)
        }
        .pickerStyle(.segmented)
        .labelsHidden()
      }

      if settings.geminiAuthMethod == .oauth {
        SettingRow("Project") {
          TextField("Google Cloud project ID", text: $settings.googleCloudProjectID)
            .textFieldStyle(.roundedBorder)
        }
      } else {
        apiKeyRow(for: .gemini)
      }
    } else {
      apiKeyRow(for: settings.provider)
    }
  }

  private func keyRow(_ provider: AIProvider) -> some View {
    HStack(spacing: 8) {
      Text(provider.displayName)
        .foregroundStyle(.secondary)
        .frame(width: 74, alignment: .leading)
      SecureField("\(provider.displayName) key", text: keyBinding(for: provider))
        .textFieldStyle(.roundedBorder)
    }
  }

  private func apiKeyRow(for provider: AIProvider) -> some View {
    SettingRow("Key") {
      SecureField("\(provider.displayName) API key", text: keyBinding(for: provider))
        .textFieldStyle(.roundedBorder)
      Button("Save") {
        settings.saveAPIKeys()
      }
    }
  }

  private func keyBinding(for provider: AIProvider) -> Binding<String> {
    switch provider {
    case .ollama:
      return .constant("")
    case .gemini:
      return $settings.geminiAPIKey
    case .openAI:
      return $settings.openAIAPIKey
    case .anthropic:
      return $settings.anthropicAPIKey
    }
  }

  private func modelBinding(for provider: AIProvider) -> Binding<String> {
    switch provider {
    case .ollama:
      return $settings.ollamaModel
    case .gemini:
      return $settings.geminiModel
    case .openAI:
      return $settings.openAIModel
    case .anthropic:
      return $settings.anthropicModel
    }
  }

  private func modelOptions(for provider: AIProvider) -> [ModelOption] {
    let currentModel = settings.model(for: provider)
    var options = provider.modelOptions

    if !options.contains(where: { $0.id == currentModel }) {
      options.insert(
        ModelOption(id: currentModel, name: currentModel, detail: "Saved"),
        at: 0
      )
    }

    return options
  }
}

private struct HistoryPane: View {
  @ObservedObject var history: AnalysisHistoryStore
  @State private var selectedID: UUID?
  @State private var showingClearConfirmation = false

  private var selectedEntry: AnalysisHistoryEntry? {
    if let selectedID, let match = history.entries.first(where: { $0.id == selectedID }) {
      return match
    }
    return history.entries.first
  }

  var body: some View {
    VStack(spacing: 0) {
      HStack(spacing: 12) {
        HeaderView(title: "History", systemImage: "clock.arrow.circlepath")
        Spacer()
        Button(role: .destructive) {
          showingClearConfirmation = true
        } label: {
          Label("Clear", systemImage: "trash")
        }
        .controlSize(.small)
        .disabled(history.entries.isEmpty)
      }
      .padding(18)

      Divider()

      if history.entries.isEmpty {
        ContentUnavailableView("No History", systemImage: "clock")
          .frame(maxWidth: .infinity, maxHeight: .infinity)
      } else {
        HStack(spacing: 0) {
          List(selection: $selectedID) {
            ForEach(history.entries) { entry in
              HistoryRow(entry: entry)
                .tag(Optional(entry.id))
            }
          }
          .listStyle(.sidebar)
          .frame(minWidth: 220, idealWidth: 250, maxWidth: 300)

          Divider()

          if let selectedEntry {
            HistoryDetail(entry: selectedEntry)
          } else {
            ContentUnavailableView("No Selection", systemImage: "doc.text.magnifyingglass")
          }
        }
      }
    }
    .onAppear {
      if selectedID == nil {
        selectedID = history.entries.first?.id
      }
    }
    .onChange(of: history.entries.map(\.id)) { _, ids in
      if !ids.contains(where: { Optional($0) == selectedID }) {
        selectedID = ids.first
      }
    }
    .confirmationDialog("Clear History?", isPresented: $showingClearConfirmation) {
      Button("Clear History", role: .destructive) {
        history.clear()
      }
      Button("Cancel", role: .cancel) {}
    }
  }
}

private struct HistoryRow: View {
  var entry: AnalysisHistoryEntry

  var body: some View {
    VStack(alignment: .leading, spacing: 3) {
      Text(entry.result.headline)
        .font(.callout.weight(.medium))
        .lineLimit(1)
      Text("\(entry.createdAt.formatted(date: .abbreviated, time: .shortened)) - \(entry.result.source.displayName)")
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(1)
    }
    .padding(.vertical, 3)
  }
}

private struct HistoryDetail: View {
  var entry: AnalysisHistoryEntry

  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 14) {
        VStack(alignment: .leading, spacing: 5) {
          Text(entry.result.headline)
            .font(.title3.weight(.semibold))
            .textSelection(.enabled)
          Text("\(entry.result.provider.displayName) - \(entry.result.mode.displayName) - \(entry.result.source.displayName) - \(entry.result.elapsedMilliseconds)ms")
            .font(.caption)
            .foregroundStyle(.secondary)
        }

        GlassSection {
          Text(entry.result.summary)
            .font(.callout)
            .textSelection(.enabled)

          if let background = entry.result.background, !background.isEmpty {
            Divider()
            Text(background)
              .font(.callout)
              .foregroundStyle(.secondary)
              .textSelection(.enabled)
          }
        }

        if !entry.result.claims.isEmpty {
          GlassSection {
            ForEach(entry.result.claims) { claim in
              ClaimDetail(claim: claim)
              if claim.id != entry.result.claims.last?.id {
                Divider()
              }
            }
          }
        }
      }
      .padding(18)
      .frame(maxWidth: .infinity, alignment: .leading)
    }
  }
}

private struct ClaimDetail: View {
  var claim: CheckedClaim

  var body: some View {
    VStack(alignment: .leading, spacing: 7) {
      HStack(spacing: 8) {
        Text(claim.verdict.displayName)
          .font(.caption2.weight(.semibold))
          .padding(.horizontal, 8)
          .padding(.vertical, 3)
          .background(verdictTint(claim.verdict), in: Capsule())
        if let confidence = claim.confidence {
          Text("\(Int(confidence * 100))%")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      }

      Text(claim.claim)
        .font(.caption.weight(.medium))
        .textSelection(.enabled)

      Text(claim.rationale)
        .font(.caption)
        .foregroundStyle(.secondary)
        .textSelection(.enabled)

      if !claim.sourceHints.isEmpty {
        Text(claim.sourceHints.joined(separator: "; "))
          .font(.caption)
          .foregroundStyle(.tertiary)
          .lineLimit(2)
          .textSelection(.enabled)
      }
    }
  }

  private func verdictTint(_ verdict: Verdict) -> Color {
    switch verdict {
    case .supported:
      return .green.opacity(0.2)
    case .questionable:
      return .yellow.opacity(0.24)
    case .contradicted:
      return .red.opacity(0.2)
    case .unclear:
      return .gray.opacity(0.2)
    }
  }
}

private struct HeaderView: View {
  var title: String
  var systemImage: String

  var body: some View {
    HStack(spacing: 10) {
      Image(systemName: systemImage)
        .font(.title3.weight(.semibold))
        .frame(width: 30, height: 30)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 8, style: .continuous))
      Text(title)
        .font(.title3.weight(.semibold))
    }
  }
}

private struct GlassSection<Content: View>: View {
  @ViewBuilder var content: Content

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      content
    }
    .padding(12)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .strokeBorder(.primary.opacity(0.08), lineWidth: 1)
    )
  }
}

private struct SettingRow<Content: View>: View {
  var title: String
  @ViewBuilder var content: Content

  init(_ title: String, @ViewBuilder content: () -> Content) {
    self.title = title
    self.content = content()
  }

  var body: some View {
    HStack(spacing: 10) {
      Text(title)
        .foregroundStyle(.secondary)
        .frame(width: 74, alignment: .leading)
      content
    }
  }
}
