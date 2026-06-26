import Foundation

enum AppInterfaceSection: String, CaseIterable, Identifiable {
  case settings
  case history

  var id: String { rawValue }

  var title: String {
    switch self {
    case .settings:
      return "Settings"
    case .history:
      return "History"
    }
  }

  var systemImage: String {
    switch self {
    case .settings:
      return "gearshape"
    case .history:
      return "clock.arrow.circlepath"
    }
  }
}
