import Foundation

enum AnalysisMode: String, CaseIterable, Codable, Identifiable {
  case explain
  case factCheck
  case both

  var id: String { rawValue }

  var displayName: String {
    switch self {
    case .explain:
      return "Explain"
    case .factCheck:
      return "Fact-check"
    case .both:
      return "Both"
    }
  }
}

enum CaptureSource: String, Codable {
  case highlightedText
  case screenOCR
  case screenArea
  case screenRecording

  var displayName: String {
    switch self {
    case .highlightedText:
      return "Highlighted text"
    case .screenOCR:
      return "Screen text"
    case .screenArea:
      return "Screen area"
    case .screenRecording:
      return "Area recording"
    }
  }
}

enum AIProvider: String, CaseIterable, Codable, Identifiable {
  case ollama
  case gemini
  case openAI
  case anthropic

  var id: String { rawValue }

  var displayName: String {
    switch self {
    case .ollama:
      return "Ollama Local"
    case .gemini:
      return "Gemini"
    case .openAI:
      return "OpenAI"
    case .anthropic:
      return "Anthropic"
    }
  }

  var supportsOAuth: Bool {
    switch self {
    case .gemini:
      return true
    case .ollama, .openAI, .anthropic:
      return false
    }
  }

  var defaultModel: String {
    switch self {
    case .ollama:
      return "llama3.2:3b"
    case .gemini:
      return "gemini-3.1-flash-lite"
    case .openAI:
      return "gpt-5.4-nano"
    case .anthropic:
      return "claude-3-5-haiku-20241022"
    }
  }

  var modelOptions: [ModelOption] {
    switch self {
    case .ollama:
      return [
        ModelOption(id: "llama3.2:3b", name: "Llama 3.2 3B", detail: "Fast local"),
        ModelOption(id: "gpt-oss:20b", name: "gpt-oss 20B", detail: "OpenAI open-weight"),
        ModelOption(id: "qwen2.5:7b", name: "Qwen 2.5 7B", detail: "Balanced local"),
        ModelOption(id: "mistral:7b", name: "Mistral 7B", detail: "Stable local")
      ]
    case .gemini:
      return [
        ModelOption(id: "gemini-3.1-flash-lite", name: "3.1 Flash-Lite", detail: "Fastest"),
        ModelOption(id: "gemini-3-flash", name: "3 Flash", detail: "Balanced"),
        ModelOption(id: "gemini-3.1-pro", name: "3.1 Pro", detail: "Highest quality"),
        ModelOption(id: "gemini-2.5-flash-lite", name: "2.5 Flash-Lite", detail: "Stable fast"),
        ModelOption(id: "gemini-2.5-flash", name: "2.5 Flash", detail: "Stable balanced"),
        ModelOption(id: "gemini-2.5-pro", name: "2.5 Pro", detail: "Stable quality")
      ]
    case .openAI:
      return [
        ModelOption(id: "gpt-5.4-nano", name: "GPT-5.4 nano", detail: "Fastest"),
        ModelOption(id: "gpt-5.4-mini", name: "GPT-5.4 mini", detail: "Balanced"),
        ModelOption(id: "gpt-5.4", name: "GPT-5.4", detail: "Highest quality")
      ]
    case .anthropic:
      return [
        ModelOption(id: "claude-3-5-haiku-20241022", name: "Claude Haiku 3.5", detail: "Fastest"),
        ModelOption(id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", detail: "Balanced"),
        ModelOption(id: "claude-opus-4-1-20250805", name: "Claude Opus 4.1", detail: "Highest quality")
      ]
    }
  }

  var keychainAccount: String {
    switch self {
    case .ollama:
      return "ollama-no-api-key"
    case .gemini:
      return "gemini-api-key"
    case .openAI:
      return "openai-api-key"
    case .anthropic:
      return "anthropic-api-key"
    }
  }
}

enum AuthMethod: String, CaseIterable, Codable, Identifiable {
  case apiKey
  case oauth

  var id: String { rawValue }

  var displayName: String {
    switch self {
    case .apiKey:
      return "API Key"
    case .oauth:
      return "OAuth"
    }
  }
}

struct ProviderAuthContext {
  var method: AuthMethod
  var apiKey: String
  var googleCloudProjectID: String
  var ollamaBaseURL: String
}

struct ModelOption: Identifiable, Hashable {
  var id: String
  var name: String
  var detail: String

  var menuTitle: String {
    "\(name) - \(detail)"
  }
}

struct CaptureInput: Codable {
  var text: String
  var source: CaptureSource
  var capturedAt: Date
  var truncated: Bool
}

enum Verdict: String, Codable {
  case supported
  case questionable
  case contradicted
  case unclear

  var displayName: String {
    switch self {
    case .supported:
      return "Supported"
    case .questionable:
      return "Questionable"
    case .contradicted:
      return "Contradicted"
    case .unclear:
      return "Unclear"
    }
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.singleValueContainer()
    let value = (try? container.decode(String.self))?.lowercased() ?? ""
    self = Verdict(rawValue: value) ?? .unclear
  }
}

struct CheckedClaim: Codable, Identifiable {
  var id = UUID()
  var claim: String
  var verdict: Verdict
  var confidence: Double?
  var rationale: String
  var sourceHints: [String]

  enum CodingKeys: String, CodingKey {
    case claim
    case verdict
    case confidence
    case rationale
    case sourceHints
  }

  init(claim: String, verdict: Verdict, confidence: Double?, rationale: String, sourceHints: [String]) {
    self.claim = claim
    self.verdict = verdict
    self.confidence = CheckedClaim.normalizedConfidence(confidence)
    self.rationale = rationale
    self.sourceHints = sourceHints
  }

  init(from decoder: Decoder) throws {
    let container = try decoder.container(keyedBy: CodingKeys.self)
    let rawConfidence = try container.decodeIfPresent(Double.self, forKey: .confidence)

    self.claim = try container.decodeIfPresent(String.self, forKey: .claim) ?? ""
    self.verdict = try container.decodeIfPresent(Verdict.self, forKey: .verdict) ?? .unclear
    self.confidence = CheckedClaim.normalizedConfidence(rawConfidence)
    self.rationale = try container.decodeIfPresent(String.self, forKey: .rationale) ?? ""
    self.sourceHints = try container.decodeIfPresent([String].self, forKey: .sourceHints) ?? []
  }

  private static func normalizedConfidence(_ value: Double?) -> Double? {
    guard var value else {
      return nil
    }

    if value > 1 {
      value /= 100
    }

    return min(max(value, 0), 1)
  }
}

struct AnalysisResult: Codable, Identifiable {
  var id = UUID()
  var provider: AIProvider
  var headline: String
  var summary: String
  var background: String?
  var claims: [CheckedClaim]
  var source: CaptureSource
  var mode: AnalysisMode
  var elapsedMilliseconds: Int
  var truncated: Bool

  enum CodingKeys: String, CodingKey {
    case provider
    case headline
    case summary
    case background
    case claims
    case source
    case mode
    case elapsedMilliseconds
    case truncated
  }
}
