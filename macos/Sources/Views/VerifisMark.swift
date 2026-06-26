import SwiftUI

struct VerifisGlyph: View {
  var body: some View {
    GeometryReader { proxy in
      let side = min(proxy.size.width, proxy.size.height)
      let strokeWidth = max(2, side * 0.17)
      let rect = CGRect(
        x: (proxy.size.width - side) / 2,
        y: (proxy.size.height - side) / 2,
        width: side,
        height: side
      )

      mark(in: rect)
        .stroke(.primary, style: StrokeStyle(lineWidth: strokeWidth, lineCap: .round, lineJoin: .round))
    }
    .aspectRatio(1, contentMode: .fit)
  }

  private func mark(in rect: CGRect) -> Path {
    Path { path in
      path.move(to: CGPoint(x: rect.minX + rect.width * 0.32, y: rect.minY + rect.height * 0.37))
      path.addLine(to: CGPoint(x: rect.minX + rect.width * 0.48, y: rect.minY + rect.height * 0.68))
      path.addLine(to: CGPoint(x: rect.minX + rect.width * 0.70, y: rect.minY + rect.height * 0.37))
    }
  }
}
