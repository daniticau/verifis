import Foundation

enum AIProviderClientError: LocalizedError {
  case missingAPIKey(AIProvider)
  case oauthUnavailable(AIProvider)
  case invalidURL(AIProvider)
  case ollamaUnavailable(String)
  case noText
  case api(AIProvider, String)
  case emptyResponse(AIProvider)

  var errorDescription: String? {
    switch self {
    case .missingAPIKey(let provider):
      return "Add a \(provider.displayName) API key in Verifis settings."
    case .oauthUnavailable(let provider):
      return "\(provider.displayName) does not support OAuth for direct model API calls. Use an API key."
    case .invalidURL(let provider):
      return "The \(provider.displayName) model URL is invalid."
    case .ollamaUnavailable(let message):
      return "Ollama Local: \(message)"
    case .noText:
      return "No text was available to analyze."
    case .api(let provider, let message):
      return "\(provider.displayName): \(message)"
    case .emptyResponse(let provider):
      return "\(provider.displayName) returned an empty response."
    }
  }
}

final class AIProviderClient {
  private let session: URLSession

  init() {
    let configuration = URLSessionConfiguration.ephemeral
    configuration.timeoutIntervalForRequest = 14
    configuration.timeoutIntervalForResource = 18
    configuration.waitsForConnectivity = false
    self.session = URLSession(configuration: configuration)
  }

  func analyze(input: CaptureInput, provider: AIProvider, mode: AnalysisMode, auth: ProviderAuthContext, model: String, startedAt: Date) async throws -> AnalysisResult {
    let trimmedKey = auth.apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
    if provider != .ollama && auth.method == .apiKey && trimmedKey.isEmpty {
      throw AIProviderClientError.missingAPIKey(provider)
    }
    if auth.method == .oauth && !provider.supportsOAuth {
      throw AIProviderClientError.oauthUnavailable(provider)
    }

    let trimmedText = input.text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmedText.isEmpty else {
      throw AIProviderClientError.noText
    }

    let prompt = PromptFactory.prompt(for: trimmedText, source: input.source, mode: mode)
    let responseText: String

    switch provider {
    case .ollama:
      responseText = try await analyzeWithOllama(prompt: prompt, auth: auth, model: model)
    case .gemini:
      responseText = try await analyzeWithGemini(prompt: prompt, auth: auth, model: model)
    case .openAI:
      responseText = try await analyzeWithOpenAI(prompt: prompt, apiKey: trimmedKey, model: model)
    case .anthropic:
      responseText = try await analyzeWithAnthropic(prompt: prompt, apiKey: trimmedKey, model: model)
    }

    return AnalysisResponseDecoder.decode(
      responseText,
      provider: provider,
      source: input.source,
      mode: mode,
      startedAt: startedAt,
      truncated: input.truncated
    )
  }

  private func analyzeWithOllama(prompt: String, auth: ProviderAuthContext, model: String) async throws -> String {
    let baseURLString = auth.ollamaBaseURL.trimmingCharacters(in: .whitespacesAndNewlines)
    guard var components = URLComponents(string: baseURLString.isEmpty ? "http://127.0.0.1:11434" : baseURLString) else {
      throw AIProviderClientError.invalidURL(.ollama)
    }
    components.path = components.path.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/api/generate"
    if !components.path.hasPrefix("/") {
      components.path = "/" + components.path
    }

    guard let url = components.url else {
      throw AIProviderClientError.invalidURL(.ollama)
    }

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONEncoder().encode(
      OllamaGenerateRequest(
        model: model,
        prompt: prompt,
        stream: false,
        format: "json",
        options: OllamaOptions(
          temperature: 0.1,
          numPredict: 700
        )
      )
    )

    do {
      let data = try await perform(request, provider: .ollama)
      let decoded = try JSONDecoder().decode(OllamaGenerateResponse.self, from: data)
      if let error = decoded.error?.trimmingCharacters(in: .whitespacesAndNewlines), !error.isEmpty {
        throw AIProviderClientError.api(.ollama, error)
      }

      guard let text = decoded.response?.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else {
        throw AIProviderClientError.emptyResponse(.ollama)
      }

      return text
    } catch let error as AIProviderClientError {
      throw error
    } catch {
      throw AIProviderClientError.ollamaUnavailable(
        "Start Ollama, then run `ollama pull \(model)` if the model is not installed."
      )
    }
  }

  private func analyzeWithGemini(prompt: String, auth: ProviderAuthContext, model: String) async throws -> String {
    let encodedModel = model.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? model
    guard let url = URL(string: "https://generativelanguage.googleapis.com/v1beta/models/\(encodedModel):generateContent") else {
      throw AIProviderClientError.invalidURL(.gemini)
    }

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    switch auth.method {
    case .apiKey:
      request.setValue(auth.apiKey.trimmingCharacters(in: .whitespacesAndNewlines), forHTTPHeaderField: "x-goog-api-key")
    case .oauth:
      let token = try GoogleADCOAuthTokenProvider.accessToken()
      request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
      let projectID = auth.googleCloudProjectID.trimmingCharacters(in: .whitespacesAndNewlines)
      if !projectID.isEmpty {
        request.setValue(projectID, forHTTPHeaderField: "x-goog-user-project")
      }
    }
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONEncoder().encode(
      GeminiGenerateRequest(
        contents: [
          GeminiContent(parts: [GeminiPart(text: prompt)])
        ],
        generationConfig: GeminiGenerationConfig(
          temperature: 0.1,
          maxOutputTokens: 700,
          responseMimeType: "application/json"
        )
      )
    )

    let data = try await perform(request, provider: .gemini)
    let decoded = try JSONDecoder().decode(GeminiGenerateResponse.self, from: data)
    if let error = decoded.error {
      throw AIProviderClientError.api(.gemini, error.message)
    }

    guard let text = decoded.candidates?.first?.content.parts.first?.text.trimmingCharacters(in: .whitespacesAndNewlines), !text.isEmpty else {
      throw AIProviderClientError.emptyResponse(.gemini)
    }

    return text
  }

  private func analyzeWithOpenAI(prompt: String, apiKey: String, model: String) async throws -> String {
    guard let url = URL(string: "https://api.openai.com/v1/responses") else {
      throw AIProviderClientError.invalidURL(.openAI)
    }

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONEncoder().encode(
      OpenAIResponsesRequest(
        model: model,
        input: prompt,
        maxOutputTokens: 700,
        store: false,
        reasoning: model.localizedCaseInsensitiveContains("gpt-5") ? OpenAIReasoning(effort: "none") : nil
      )
    )

    let data = try await perform(request, provider: .openAI)
    let decoded = try JSONDecoder().decode(OpenAIResponsesResponse.self, from: data)

    if let outputText = decoded.outputText?.trimmingCharacters(in: .whitespacesAndNewlines), !outputText.isEmpty {
      return outputText
    }

    let text = decoded.output?
      .flatMap { $0.content ?? [] }
      .compactMap { $0.text }
      .joined(separator: "\n")
      .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

    guard !text.isEmpty else {
      throw AIProviderClientError.emptyResponse(.openAI)
    }

    return text
  }

  private func analyzeWithAnthropic(prompt: String, apiKey: String, model: String) async throws -> String {
    guard let url = URL(string: "https://api.anthropic.com/v1/messages") else {
      throw AIProviderClientError.invalidURL(.anthropic)
    }

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
    request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONEncoder().encode(
      AnthropicMessagesRequest(
        model: model,
        maxTokens: 700,
        temperature: 0.1,
        messages: [
          AnthropicMessage(role: "user", content: prompt)
        ]
      )
    )

    let data = try await perform(request, provider: .anthropic)
    let decoded = try JSONDecoder().decode(AnthropicMessagesResponse.self, from: data)

    let text = decoded.content
      .compactMap { $0.text }
      .joined(separator: "\n")
      .trimmingCharacters(in: .whitespacesAndNewlines)

    guard !text.isEmpty else {
      throw AIProviderClientError.emptyResponse(.anthropic)
    }

    return text
  }

  private func perform(_ request: URLRequest, provider: AIProvider) async throws -> Data {
    let (data, response) = try await session.data(for: request)

    guard let http = response as? HTTPURLResponse else {
      return data
    }

    guard (200..<300).contains(http.statusCode) else {
      let message = ProviderErrorMessage.extract(from: data) ?? "API error \(http.statusCode)."
      throw AIProviderClientError.api(provider, message)
    }

    return data
  }
}

private enum GoogleADCOAuthTokenProvider {
  static func accessToken() throws -> String {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    process.arguments = ["gcloud", "auth", "application-default", "print-access-token"]

    let output = Pipe()
    let error = Pipe()
    process.standardOutput = output
    process.standardError = error

    do {
      try process.run()
    } catch {
      throw AIProviderClientError.api(
        .gemini,
        "Gemini OAuth needs Google Cloud ADC. Install gcloud, then run gcloud auth application-default login with Gemini scopes."
      )
    }

    process.waitUntilExit()

    let stdout = String(data: output.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?
      .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    let stderr = String(data: error.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?
      .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

    guard process.terminationStatus == 0, !stdout.isEmpty else {
      throw AIProviderClientError.api(
        .gemini,
        stderr.isEmpty ? "Run gcloud auth application-default login with Gemini OAuth scopes first." : stderr
      )
    }

    return stdout
  }
}

private enum PromptFactory {
  static func prompt(for text: String, source: CaptureSource, mode: AnalysisMode) -> String {
    """
    You are Verifis, a low-latency desktop assistant. Explain and fact-check text captured from macOS.

    Mode: \(mode.displayName)
    Capture: \(source.displayName)

    Return only compact JSON:
    {
      "headline": "max 7 words",
      "summary": "2-3 short sentences, plain language",
      "background": "optional, max 2 short sentences",
      "claims": [
        {
          "claim": "specific factual claim",
          "verdict": "supported | questionable | contradicted | unclear",
          "confidence": 0.0,
          "rationale": "one short reason",
          "sourceHints": ["credible source/domain to check, no invented URLs"]
        }
      ]
    }

    Rules:
    - Optimize for a tiny overlay, not a report.
    - If fact-checking needs live sources, use "unclear" and name likely source types.
    - Never invent citations or URLs.
    - At most 3 claims.
    - If OCR/recorded-area text is noisy, say what is likely and do not overclaim.

    Text:
    \(text)
    """
  }
}

private enum AnalysisResponseDecoder {
  static func decode(_ responseText: String, provider: AIProvider, source: CaptureSource, mode: AnalysisMode, startedAt: Date, truncated: Bool) -> AnalysisResult {
    let jsonText = extractJSONObject(from: responseText)
    let elapsed = Int(Date().timeIntervalSince(startedAt) * 1000)

    if let data = jsonText.data(using: .utf8),
       let payload = try? JSONDecoder().decode(AnalysisPayload.self, from: data) {
      return AnalysisResult(
        provider: provider,
        headline: payload.headline.nonEmpty ?? "Verifis Result",
        summary: payload.summary.nonEmpty ?? responseText,
        background: payload.background.nonEmpty,
        claims: payload.claims ?? [],
        source: source,
        mode: mode,
        elapsedMilliseconds: elapsed,
        truncated: truncated
      )
    }

    return AnalysisResult(
      provider: provider,
      headline: "Verifis Result",
      summary: responseText,
      background: nil,
      claims: [],
      source: source,
      mode: mode,
      elapsedMilliseconds: elapsed,
      truncated: truncated
    )
  }

  private static func extractJSONObject(from text: String) -> String {
    var cleaned = text
      .replacingOccurrences(of: "```json", with: "")
      .replacingOccurrences(of: "```", with: "")
      .trimmingCharacters(in: .whitespacesAndNewlines)

    if let start = cleaned.firstIndex(of: "{"), let end = cleaned.lastIndex(of: "}"), start <= end {
      cleaned = String(cleaned[start...end])
    }

    return cleaned
  }
}

private enum ProviderErrorMessage {
  static func extract(from data: Data) -> String? {
    guard let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      return String(data: data, encoding: .utf8)
    }

    if let error = object["error"] as? [String: Any] {
      return error["message"] as? String ?? error["error"] as? String
    }
    if let error = object["error"] as? String {
      return error
    }

    return object["message"] as? String
  }
}

private struct AnalysisPayload: Decodable {
  var headline: String?
  var summary: String?
  var background: String?
  var claims: [CheckedClaim]?
}

private struct GeminiGenerateRequest: Encodable {
  var contents: [GeminiContent]
  var generationConfig: GeminiGenerationConfig
}

private struct GeminiContent: Codable {
  var parts: [GeminiPart]
}

private struct GeminiPart: Codable {
  var text: String
}

private struct GeminiGenerationConfig: Encodable {
  var temperature: Double
  var maxOutputTokens: Int
  var responseMimeType: String
}

private struct GeminiGenerateResponse: Decodable {
  var candidates: [GeminiCandidate]?
  var error: GeminiAPIError?
}

private struct OllamaGenerateRequest: Encodable {
  var model: String
  var prompt: String
  var stream: Bool
  var format: String
  var options: OllamaOptions
}

private struct OllamaOptions: Encodable {
  var temperature: Double
  var numPredict: Int

  enum CodingKeys: String, CodingKey {
    case temperature
    case numPredict = "num_predict"
  }
}

private struct OllamaGenerateResponse: Decodable {
  var response: String?
  var error: String?
}

private struct GeminiCandidate: Decodable {
  var content: GeminiContent
}

private struct GeminiAPIError: Decodable {
  var message: String
}

private struct OpenAIResponsesRequest: Encodable {
  var model: String
  var input: String
  var maxOutputTokens: Int
  var store: Bool
  var reasoning: OpenAIReasoning?

  enum CodingKeys: String, CodingKey {
    case model
    case input
    case maxOutputTokens = "max_output_tokens"
    case store
    case reasoning
  }
}

private struct OpenAIReasoning: Encodable {
  var effort: String
}

private struct OpenAIResponsesResponse: Decodable {
  var outputText: String?
  var output: [OpenAIOutputItem]?

  enum CodingKeys: String, CodingKey {
    case outputText = "output_text"
    case output
  }
}

private struct OpenAIOutputItem: Decodable {
  var content: [OpenAIContentItem]?
}

private struct OpenAIContentItem: Decodable {
  var text: String?
}

private struct AnthropicMessagesRequest: Encodable {
  var model: String
  var maxTokens: Int
  var temperature: Double
  var messages: [AnthropicMessage]

  enum CodingKeys: String, CodingKey {
    case model
    case maxTokens = "max_tokens"
    case temperature
    case messages
  }
}

private struct AnthropicMessage: Encodable {
  var role: String
  var content: String
}

private struct AnthropicMessagesResponse: Decodable {
  var content: [AnthropicContentItem]
}

private struct AnthropicContentItem: Decodable {
  var text: String?
}

private extension Optional where Wrapped == String {
  var nonEmpty: String? {
    guard let value = self?.trimmingCharacters(in: .whitespacesAndNewlines), !value.isEmpty else {
      return nil
    }
    return value
  }
}
