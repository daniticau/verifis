import Foundation

struct AnalysisHistoryEntry: Codable, Identifiable {
  var id: UUID
  var createdAt: Date
  var result: AnalysisResult

  init(id: UUID = UUID(), createdAt: Date = Date(), result: AnalysisResult) {
    self.id = id
    self.createdAt = createdAt
    self.result = result
  }
}
