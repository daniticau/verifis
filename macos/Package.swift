// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "VerifisMac",
  platforms: [
    .macOS(.v14)
  ],
  products: [
    .executable(name: "Verifis", targets: ["Verifis"])
  ],
  targets: [
    .executableTarget(
      name: "Verifis",
      path: "Sources",
      exclude: ["Resources/AppIcon.iconset", "Resources/AppIcon.icns"],
      resources: [
        .process("Resources/AppIcon.png")
      ]
    )
  ]
)
