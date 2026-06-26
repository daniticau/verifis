import Foundation
import Combine

final class AppSettings: ObservableObject {
  private enum Keys {
    static let mode = "analysisMode"
    static let provider = "aiProvider"
    static let geminiModel = "geminiModel"
    static let openAIModel = "openAIModel"
    static let anthropicModel = "anthropicModel"
    static let ollamaModel = "ollamaModel"
    static let ollamaBaseURL = "ollamaBaseURL"
    static let geminiAuthMethod = "geminiAuthMethod"
    static let openAIAuthMethod = "openAIAuthMethod"
    static let anthropicAuthMethod = "anthropicAuthMethod"
    static let googleCloudProjectID = "googleCloudProjectID"
    static let screenOCRFallback = "screenOCRFallback"
    static let maxCharacters = "maxCharacters"
  }

  private let keychainService = "com.verifis.mac"

  @Published var geminiAPIKey: String
  @Published var openAIAPIKey: String
  @Published var anthropicAPIKey: String
  @Published var provider: AIProvider {
    didSet { UserDefaults.standard.set(provider.rawValue, forKey: Keys.provider) }
  }
  @Published var mode: AnalysisMode {
    didSet { UserDefaults.standard.set(mode.rawValue, forKey: Keys.mode) }
  }
  @Published var geminiModel: String {
    didSet { UserDefaults.standard.set(geminiModel, forKey: Keys.geminiModel) }
  }
  @Published var openAIModel: String {
    didSet { UserDefaults.standard.set(openAIModel, forKey: Keys.openAIModel) }
  }
  @Published var anthropicModel: String {
    didSet { UserDefaults.standard.set(anthropicModel, forKey: Keys.anthropicModel) }
  }
  @Published var ollamaModel: String {
    didSet { UserDefaults.standard.set(ollamaModel, forKey: Keys.ollamaModel) }
  }
  @Published var ollamaBaseURL: String {
    didSet { UserDefaults.standard.set(ollamaBaseURL, forKey: Keys.ollamaBaseURL) }
  }
  @Published var geminiAuthMethod: AuthMethod {
    didSet { UserDefaults.standard.set(geminiAuthMethod.rawValue, forKey: Keys.geminiAuthMethod) }
  }
  @Published var openAIAuthMethod: AuthMethod {
    didSet { UserDefaults.standard.set(openAIAuthMethod.rawValue, forKey: Keys.openAIAuthMethod) }
  }
  @Published var anthropicAuthMethod: AuthMethod {
    didSet { UserDefaults.standard.set(anthropicAuthMethod.rawValue, forKey: Keys.anthropicAuthMethod) }
  }
  @Published var googleCloudProjectID: String {
    didSet { UserDefaults.standard.set(googleCloudProjectID, forKey: Keys.googleCloudProjectID) }
  }
  @Published var screenOCRFallback: Bool {
    didSet { UserDefaults.standard.set(screenOCRFallback, forKey: Keys.screenOCRFallback) }
  }
  @Published var maxCharacters: Int {
    didSet { UserDefaults.standard.set(maxCharacters, forKey: Keys.maxCharacters) }
  }

  init() {
    let defaults = UserDefaults.standard
    let storedMode = defaults.string(forKey: Keys.mode).flatMap(AnalysisMode.init(rawValue:)) ?? .both
    let storedProvider = defaults.string(forKey: Keys.provider).flatMap(AIProvider.init(rawValue:)) ?? .ollama
    let storedMaxCharacters = defaults.object(forKey: Keys.maxCharacters) as? Int ?? 1800

    self.geminiAPIKey = KeychainStore.load(service: keychainService, account: AIProvider.gemini.keychainAccount)
    self.openAIAPIKey = KeychainStore.load(service: keychainService, account: AIProvider.openAI.keychainAccount)
    self.anthropicAPIKey = KeychainStore.load(service: keychainService, account: AIProvider.anthropic.keychainAccount)
    self.provider = storedProvider
    self.mode = storedMode
    let storedGeminiModel = defaults.string(forKey: Keys.geminiModel) ?? AIProvider.gemini.defaultModel
    self.geminiModel = AppSettings.migratedGeminiModel(storedGeminiModel)
    self.openAIModel = defaults.string(forKey: Keys.openAIModel) ?? AIProvider.openAI.defaultModel
    self.anthropicModel = defaults.string(forKey: Keys.anthropicModel) ?? AIProvider.anthropic.defaultModel
    self.ollamaModel = defaults.string(forKey: Keys.ollamaModel) ?? AIProvider.ollama.defaultModel
    self.ollamaBaseURL = defaults.string(forKey: Keys.ollamaBaseURL) ?? "http://127.0.0.1:11434"
    self.geminiAuthMethod = defaults.string(forKey: Keys.geminiAuthMethod).flatMap(AuthMethod.init(rawValue:)) ?? .apiKey
    self.openAIAuthMethod = .apiKey
    self.anthropicAuthMethod = .apiKey
    self.googleCloudProjectID = defaults.string(forKey: Keys.googleCloudProjectID) ?? ""
    self.screenOCRFallback = defaults.object(forKey: Keys.screenOCRFallback) as? Bool ?? true
    self.maxCharacters = storedMaxCharacters
  }

  func apiKey(for provider: AIProvider) -> String {
    switch provider {
    case .ollama:
      return ""
    case .gemini:
      return geminiAPIKey
    case .openAI:
      return openAIAPIKey
    case .anthropic:
      return anthropicAPIKey
    }
  }

  func model(for provider: AIProvider) -> String {
    switch provider {
    case .ollama:
      return ollamaModel
    case .gemini:
      return geminiModel
    case .openAI:
      return openAIModel
    case .anthropic:
      return anthropicModel
    }
  }

  func authMethod(for provider: AIProvider) -> AuthMethod {
    switch provider {
    case .ollama:
      return .apiKey
    case .gemini:
      return geminiAuthMethod
    case .openAI:
      return openAIAuthMethod
    case .anthropic:
      return anthropicAuthMethod
    }
  }

  func authContext(for provider: AIProvider) -> ProviderAuthContext {
    ProviderAuthContext(
      method: authMethod(for: provider),
      apiKey: apiKey(for: provider),
      googleCloudProjectID: googleCloudProjectID,
      ollamaBaseURL: ollamaBaseURL
    )
  }

  func saveAPIKeys() {
    KeychainStore.save(geminiAPIKey.trimmingCharacters(in: .whitespacesAndNewlines), service: keychainService, account: AIProvider.gemini.keychainAccount)
    KeychainStore.save(openAIAPIKey.trimmingCharacters(in: .whitespacesAndNewlines), service: keychainService, account: AIProvider.openAI.keychainAccount)
    KeychainStore.save(anthropicAPIKey.trimmingCharacters(in: .whitespacesAndNewlines), service: keychainService, account: AIProvider.anthropic.keychainAccount)
  }

  private static func migratedGeminiModel(_ model: String) -> String {
    let retiredDefaults = ["gemini-2.0-flash", "gemini-2.0-flash-exp", "gemini-2.5-flash-lite"]
    return retiredDefaults.contains(model) ? AIProvider.gemini.defaultModel : model
  }
}
