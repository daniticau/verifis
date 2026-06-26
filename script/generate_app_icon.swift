import AppKit

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let resourcesURL = root
  .appendingPathComponent("macos")
  .appendingPathComponent("Sources")
  .appendingPathComponent("Resources")
let appIconURL = resourcesURL.appendingPathComponent("AppIcon.png")
let icnsURL = resourcesURL.appendingPathComponent("AppIcon.icns")
let iconsetURL = resourcesURL.appendingPathComponent("AppIcon.iconset")

let extensionIconDirs = [
  root.appendingPathComponent("extension").appendingPathComponent("public").appendingPathComponent("icons"),
  root.appendingPathComponent("extension").appendingPathComponent("dist").appendingPathComponent("icons")
]

func roundedRect(_ rect: CGRect, radius: CGFloat) -> NSBezierPath {
  NSBezierPath(roundedRect: rect, xRadius: radius, yRadius: radius)
}

func linearGradient(_ colors: [NSColor]) -> NSGradient {
  NSGradient(colors: colors) ?? NSGradient(colors: [.black, .white])!
}

func strokePath(_ points: [CGPoint], width: CGFloat, color: NSColor) {
  guard let first = points.first else {
    return
  }

  let path = NSBezierPath()
  path.move(to: first)
  for point in points.dropFirst() {
    path.line(to: point)
  }
  path.lineCapStyle = .round
  path.lineJoinStyle = .round
  path.lineWidth = width
  color.setStroke()
  path.stroke()
}

func drawIcon(scale: CGFloat) {
  guard let graphicsContext = NSGraphicsContext.current else {
    fatalError("No graphics context")
  }

  let context = graphicsContext.cgContext
  context.saveGState()
  context.scaleBy(x: scale, y: scale)
  defer { context.restoreGState() }

  let canvas = CGRect(x: 0, y: 0, width: 1024, height: 1024)
  NSColor.clear.setFill()
  canvas.fill()

  let baseRect = canvas.insetBy(dx: 104, dy: 104)
  let basePath = roundedRect(baseRect, radius: 230)

  let baseShadow = NSShadow()
  baseShadow.shadowColor = NSColor(calibratedWhite: 0, alpha: 0.42)
  baseShadow.shadowBlurRadius = 34
  baseShadow.shadowOffset = NSSize(width: 0, height: -18)
  baseShadow.set()

  linearGradient([
    NSColor(calibratedWhite: 0.035, alpha: 1),
    NSColor(calibratedWhite: 0.060, alpha: 1),
    NSColor(calibratedWhite: 0.095, alpha: 1)
  ]).draw(in: basePath, angle: -36)

  NSShadow().set()

  let rimPath = roundedRect(baseRect.insetBy(dx: 1, dy: 1), radius: 229)
  NSColor(calibratedWhite: 1, alpha: 0.12).setStroke()
  rimPath.lineWidth = 2
  rimPath.stroke()

  let wholeMark = [
    CGPoint(x: 328, y: 646),
    CGPoint(x: 488, y: 378),
    CGPoint(x: 704, y: 650)
  ]

  let markShadow = NSShadow()
  markShadow.shadowColor = NSColor(calibratedWhite: 0, alpha: 0.36)
  markShadow.shadowBlurRadius = 16
  markShadow.shadowOffset = NSSize(width: 0, height: -7)
  markShadow.set()
  strokePath(wholeMark, width: 96, color: NSColor(calibratedWhite: 0.94, alpha: 1))
  NSShadow().set()
}

func makeIconRep(pixelSize: Int) -> NSBitmapImageRep {
  guard
    let rep = NSBitmapImageRep(
      bitmapDataPlanes: nil,
      pixelsWide: pixelSize,
      pixelsHigh: pixelSize,
      bitsPerSample: 8,
      samplesPerPixel: 4,
      hasAlpha: true,
      isPlanar: false,
      colorSpaceName: .deviceRGB,
      bytesPerRow: 0,
      bitsPerPixel: 0
    ),
    let context = NSGraphicsContext(bitmapImageRep: rep)
  else {
    fatalError("Could not create bitmap context")
  }

  rep.size = NSSize(width: pixelSize, height: pixelSize)

  let previousContext = NSGraphicsContext.current
  NSGraphicsContext.current = context
  context.cgContext.setShouldAntialias(true)
  context.cgContext.setAllowsAntialiasing(true)
  context.cgContext.interpolationQuality = .high
  drawIcon(scale: CGFloat(pixelSize) / 1024)
  NSGraphicsContext.current = previousContext

  return rep
}

func writePNG(size: Int, to url: URL) throws {
  let rep = makeIconRep(pixelSize: size)
  guard let png = rep.representation(using: .png, properties: [:]) else {
    fatalError("Could not render \(url.lastPathComponent)")
  }

  try png.write(to: url, options: .atomic)
}

func buildICNS() throws {
  let process = Process()
  process.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
  process.arguments = ["-c", "icns", iconsetURL.path, "-o", icnsURL.path]
  try process.run()
  process.waitUntilExit()

  guard process.terminationStatus == 0 else {
    fatalError("iconutil failed with status \(process.terminationStatus)")
  }
}

try FileManager.default.createDirectory(at: resourcesURL, withIntermediateDirectories: true)
try FileManager.default.createDirectory(at: iconsetURL, withIntermediateDirectories: true)

try writePNG(size: 1024, to: appIconURL)

let iconsetImages: [(String, Int)] = [
  ("icon_16x16.png", 16),
  ("icon_16x16@2x.png", 32),
  ("icon_32x32.png", 32),
  ("icon_32x32@2x.png", 64),
  ("icon_128x128.png", 128),
  ("icon_128x128@2x.png", 256),
  ("icon_256x256.png", 256),
  ("icon_256x256@2x.png", 512),
  ("icon_512x512.png", 512),
  ("icon_512x512@2x.png", 1024)
]

for (name, size) in iconsetImages {
  try writePNG(size: size, to: iconsetURL.appendingPathComponent(name))
}

try buildICNS()

for iconDir in extensionIconDirs where FileManager.default.fileExists(atPath: iconDir.deletingLastPathComponent().path) {
  try FileManager.default.createDirectory(at: iconDir, withIntermediateDirectories: true)
  for size in [16, 32, 48, 128] {
    try writePNG(size: size, to: iconDir.appendingPathComponent("icon\(size).png"))
  }
}

print(appIconURL.path)
print(icnsURL.path)
