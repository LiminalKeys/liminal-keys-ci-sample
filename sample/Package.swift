// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "LiminalSample",
  platforms: [.macOS(.v13)],
  targets: [
    .executableTarget(
      name: "LiminalSample",
      path: "Sources"
    ),
  ]
)
