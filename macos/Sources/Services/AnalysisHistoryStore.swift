import Foundation
import Combine

@MainActor
final class AnalysisHistoryStore: ObservableObject {
  @Published private(set) var entries: [AnalysisHistoryEntry] = []

  private let fileManager: FileManager
  private let historyURL: URL
  private let maxEntries = 50

  init(fileManager: FileManager = .default) {
    self.fileManager = fileManager
    self.historyURL = Self.makeHistoryURL(fileManager: fileManager)
    load()
  }

  func add(_ result: AnalysisResult) {
    entries.insert(AnalysisHistoryEntry(result: result), at: 0)
    if entries.count > maxEntries {
      entries = Array(entries.prefix(maxEntries))
    }
    save()
  }

  func clear() {
    entries = []
    save()
  }

  private func load() {
    do {
      let data = try Data(contentsOf: historyURL)
      let decoded = try JSONDecoder().decode([AnalysisHistoryEntry].self, from: data)
      entries = Array(decoded.sorted { $0.createdAt > $1.createdAt }.prefix(maxEntries))
    } catch {
      entries = []
    }
  }

  private func save() {
    do {
      let directoryURL = historyURL.deletingLastPathComponent()
      try fileManager.createDirectory(at: directoryURL, withIntermediateDirectories: true)
      let encoder = JSONEncoder()
      encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
      let data = try encoder.encode(entries)
      try data.write(to: historyURL, options: .atomic)
    } catch {
      assertionFailure("Could not save Verifis history: \(error.localizedDescription)")
    }
  }

  private static func makeHistoryURL(fileManager: FileManager) -> URL {
    let baseURL = (try? fileManager.url(
      for: .applicationSupportDirectory,
      in: .userDomainMask,
      appropriateFor: nil,
      create: true
    )) ?? URL(fileURLWithPath: NSTemporaryDirectory(), isDirectory: true)

    return baseURL
      .appendingPathComponent("Verifis", isDirectory: true)
      .appendingPathComponent("history.json", isDirectory: false)
  }
}
