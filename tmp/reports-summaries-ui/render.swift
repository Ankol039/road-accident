import Foundation
import AppKit
import PDFKit
let args = CommandLine.arguments
let root = args[1]
var summary: [[String: Any]] = []
for filename in args.dropFirst(2) {
  guard let doc = PDFDocument(url: URL(fileURLWithPath: filename)) else { fatalError(filename) }
  let name = URL(fileURLWithPath: filename).deletingPathExtension().lastPathComponent
  var pages: [[String: Any]] = []
  for index in 0..<doc.pageCount {
    let page = doc.page(at: index)!
    let rect = page.bounds(for: .mediaBox)
    let thumb = page.thumbnail(of: NSSize(width: rect.width * 1.5, height: rect.height * 1.5), for: .mediaBox)
    let bitmap = NSBitmapImageRep(data: thumb.tiffRepresentation!)!
    let output = "\(root)/\(name)-\(index+1).png"
    try bitmap.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: output))
    pages.append(["width": rect.width, "height": rect.height, "text": page.string ?? "", "image": output])
  }
  summary.append(["file": filename, "pages": pages])
}
let data = try JSONSerialization.data(withJSONObject: summary, options: [.prettyPrinted, .sortedKeys])
try data.write(to: URL(fileURLWithPath: "\(root)/inspection.json"))
print("Rendered \(summary.count) PDFs")
