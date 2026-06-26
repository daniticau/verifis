import Carbon.HIToolbox
import Foundation

final class HotKeyManager {
  private var hotKeyRefs: [UInt32: EventHotKeyRef] = [:]
  private var eventHandlerRef: EventHandlerRef?
  private var handlers: [UInt32: () -> Void] = [:]

  func registerDefaultHotKeys(quick: @escaping () -> Void, area: @escaping () -> Void) throws {
    unregister()
    handlers = [
      1: quick,
      2: area
    ]

    var eventSpec = EventTypeSpec(
      eventClass: OSType(kEventClassKeyboard),
      eventKind: UInt32(kEventHotKeyPressed)
    )

    let handler: EventHandlerUPP = { _, event, userData in
      guard let event, let userData else {
        return noErr
      }

      var hotKeyID = EventHotKeyID()
      let status = GetEventParameter(
        event,
        EventParamName(kEventParamDirectObject),
        EventParamType(typeEventHotKeyID),
        nil,
        MemoryLayout<EventHotKeyID>.size,
        nil,
        &hotKeyID
      )

      guard status == noErr else {
        return noErr
      }

      let manager = Unmanaged<HotKeyManager>.fromOpaque(userData).takeUnretainedValue()
      DispatchQueue.main.async {
        manager.handlers[hotKeyID.id]?()
      }

      return noErr
    }

    let installStatus = InstallEventHandler(
      GetApplicationEventTarget(),
      handler,
      1,
      &eventSpec,
      Unmanaged.passUnretained(self).toOpaque(),
      &eventHandlerRef
    )

    guard installStatus == noErr else {
      throw HotKeyError.registrationFailed(installStatus)
    }

    try registerHotKey(id: 1, keyCode: UInt32(kVK_ANSI_T), modifiers: UInt32(controlKey | shiftKey))
    try registerHotKey(id: 2, keyCode: UInt32(kVK_ANSI_S), modifiers: UInt32(controlKey | shiftKey))
  }

  func unregister() {
    for (_, hotKeyRef) in hotKeyRefs {
      UnregisterEventHotKey(hotKeyRef)
    }
    hotKeyRefs = [:]
    handlers = [:]

    if let eventHandlerRef {
      RemoveEventHandler(eventHandlerRef)
      self.eventHandlerRef = nil
    }
  }

  deinit {
    unregister()
  }

  private func registerHotKey(id: UInt32, keyCode: UInt32, modifiers: UInt32) throws {
    var hotKeyRef: EventHotKeyRef?
    let hotKeyID = EventHotKeyID(signature: OSType(fourCharCode("VRFS")), id: id)
    let registerStatus = RegisterEventHotKey(
      keyCode,
      modifiers,
      hotKeyID,
      GetApplicationEventTarget(),
      0,
      &hotKeyRef
    )

    guard registerStatus == noErr, let hotKeyRef else {
      unregister()
      throw HotKeyError.registrationFailed(registerStatus)
    }

    hotKeyRefs[id] = hotKeyRef
  }

  private func fourCharCode(_ string: String) -> FourCharCode {
    var result: FourCharCode = 0
    for scalar in string.unicodeScalars.prefix(4) {
      result = (result << 8) + FourCharCode(scalar.value)
    }
    return result
  }
}

enum HotKeyError: LocalizedError {
  case registrationFailed(OSStatus)

  var errorDescription: String? {
    switch self {
    case .registrationFailed(let status):
      return "Could not register Verifis hotkeys (\(status))."
    }
  }
}
