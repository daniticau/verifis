import SwiftUI

struct OverlayPanelView: View {
  @ObservedObject var presenter: OverlayPresenter

  var body: some View {
    ZStack(alignment: .bottom) {
      RoundedRectangle(cornerRadius: 16, style: .continuous)
        .fill(.ultraThinMaterial)
        .overlay(
          RoundedRectangle(cornerRadius: 16, style: .continuous)
            .strokeBorder(.primary.opacity(0.10), lineWidth: 1)
        )
        .shadow(color: .black.opacity(0.14), radius: 14, x: 0, y: 6)

      content
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
    }
    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
  }

  @ViewBuilder
  private var content: some View {
    switch presenter.state {
    case .idle:
      EmptyView()
    case .loading(let message):
      loadingView(message)
    case .error(let message):
      messageView(
        icon: "exclamationmark.triangle.fill",
        iconColor: .red,
        title: "Verifis",
        message: message
      )
    case .result(let result):
      resultView(result)
    }
  }

  private func loadingView(_ message: String) -> some View {
    HStack(spacing: 10) {
      ProgressView()
        .controlSize(.small)

      Text(shortened(message))
        .font(.caption)
        .foregroundStyle(.secondary)
        .lineLimit(1)

      Spacer(minLength: 4)
      closeButton
    }
  }

  private func messageView(icon: String, iconColor: Color, title: String, message: String) -> some View {
    HStack(alignment: .top, spacing: 10) {
      Image(systemName: icon)
        .font(.caption.weight(.semibold))
        .foregroundStyle(iconColor)
        .frame(width: 18, height: 18)

      VStack(alignment: .leading, spacing: 3) {
        Text(title)
          .font(.caption.weight(.semibold))
        Text(message)
          .font(.caption)
          .foregroundStyle(.secondary)
          .lineLimit(2)
          .textSelection(.enabled)
      }

      Spacer(minLength: 4)
      closeButton
    }
  }

  private func resultView(_ result: AnalysisResult) -> some View {
    HStack(alignment: .top, spacing: 10) {
      Image(systemName: resultIcon(for: result))
        .font(.caption.weight(.semibold))
        .foregroundStyle(resultTint(for: result))
        .frame(width: 18, height: 18)

      VStack(alignment: .leading, spacing: 5) {
        Text(result.headline)
          .font(.caption.weight(.semibold))
          .lineLimit(1)
          .textSelection(.enabled)

        Text(result.summary)
          .font(.caption)
          .foregroundStyle(.secondary)
          .lineLimit(2)
          .textSelection(.enabled)

        HStack(spacing: 6) {
          Text(result.source.displayName)
          if !result.claims.isEmpty {
            Text(claimSummary(for: result))
          }
          Text("\(result.elapsedMilliseconds)ms")
        }
        .font(.caption2)
        .foregroundStyle(.tertiary)
        .lineLimit(1)
      }

      Spacer(minLength: 4)
      closeButton
    }
  }

  private var closeButton: some View {
    Button {
      presenter.hide()
    } label: {
      Image(systemName: "xmark")
        .font(.caption2.weight(.bold))
        .frame(width: 18, height: 18)
        .contentShape(Circle())
    }
    .buttonStyle(.plain)
    .foregroundStyle(.secondary)
  }

  private func shortened(_ message: String) -> String {
    message
      .replacingOccurrences(of: "highlighted text or visible screen text", with: "text")
      .replacingOccurrences(of: "Drag an area to", with: "Drag to")
      .replacingOccurrences(of: "Sampling area text", with: "Sampling")
      .replacingOccurrences(of: "Reading area text", with: "Reading area")
  }

  private func claimSummary(for result: AnalysisResult) -> String {
    let counts = Dictionary(grouping: result.claims, by: \.verdict).mapValues(\.count)
    if let contradicted = counts[.contradicted], contradicted > 0 {
      return "\(contradicted) contradicted"
    }
    if let questionable = counts[.questionable], questionable > 0 {
      return "\(questionable) questionable"
    }
    if let supported = counts[.supported], supported > 0 {
      return "\(supported) supported"
    }
    return "\(result.claims.count) unclear"
  }

  private func resultIcon(for result: AnalysisResult) -> String {
    if result.claims.contains(where: { $0.verdict == .contradicted || $0.verdict == .questionable }) {
      return "exclamationmark.circle.fill"
    }
    return "checkmark.circle.fill"
  }

  private func resultTint(for result: AnalysisResult) -> Color {
    if result.claims.contains(where: { $0.verdict == .contradicted }) {
      return .red
    }
    if result.claims.contains(where: { $0.verdict == .questionable }) {
      return .yellow
    }
    return .green
  }
}
