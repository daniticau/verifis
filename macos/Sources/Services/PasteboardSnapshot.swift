import AppKit

struct PasteboardSnapshot {
  private var items: [[NSPasteboard.PasteboardType: Data]]

  init(pasteboard: NSPasteboard = .general) {
    self.items = pasteboard.pasteboardItems?.map { item in
      var values: [NSPasteboard.PasteboardType: Data] = [:]
      for type in item.types {
        if let data = item.data(forType: type) {
          values[type] = data
        }
      }
      return values
    } ?? []
  }

  func restore(to pasteboard: NSPasteboard = .general) {
    pasteboard.clearContents()
    let restoredItems = items.map { values in
      let item = NSPasteboardItem()
      for (type, data) in values {
        item.setData(data, forType: type)
      }
      return item
    }
    pasteboard.writeObjects(restoredItems)
  }
}

