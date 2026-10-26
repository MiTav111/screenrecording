import Cocoa
import WebKit

class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var webView: WKWebView!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let screenRect = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1440, height: 900)
        let winWidth: CGFloat = min(1440, screenRect.width * 0.92)
        let winHeight: CGFloat = min(900, screenRect.height * 0.92)
        let winX = screenRect.origin.x + (screenRect.width - winWidth) / 2
        let winY = screenRect.origin.y + (screenRect.height - winHeight) / 2

        window = NSWindow(
            contentRect: NSRect(x: winX, y: winY, width: winWidth, height: winHeight),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "ChurchReel Studio — Catholic Website & Parish Screen Video Creator"
        window.minSize = NSSize(width: 1024, height: 680)

        let config = WKWebViewConfiguration()
        config.userContentController.add(self, name: "saveFile")
        config.preferences.setValue(true, forKey: "allowFileAccessFromFileURLs")

        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        window.contentView?.addSubview(webView)

        if let resourcePath = Bundle.main.resourcePath {
            let publicDir = URL(fileURLWithPath: resourcePath).appendingPathComponent("public")
            let indexUrl = publicDir.appendingPathComponent("index.html")
            webView.loadFileURL(indexUrl, allowingReadAccessTo: publicDir)
        }

        setupMainMenu()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if message.name == "saveFile",
           let dict = message.body as? [String: String],
           let filename = dict["filename"],
           let base64 = dict["base64"],
           let data = Data(base64Encoded: base64) {

            let savePanel = NSSavePanel()
            savePanel.nameFieldStringValue = filename
            savePanel.canCreateDirectories = true
            savePanel.title = "Save ChurchReel Export"

            savePanel.beginSheetModal(for: window) { response in
                if response == .OK, let targetURL = savePanel.url {
                    try? data.write(to: targetURL)
                }
            }
        }
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }

    func setupMainMenu() {
        let mainMenu = NSMenu()
        let appMenuItem = NSMenuItem()
        mainMenu.addItem(appMenuItem)

        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About ChurchReel Studio", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(NSMenuItem.separator())
        appMenu.addItem(withTitle: "Quit ChurchReel Studio", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appMenuItem.submenu = appMenu

        NSApp.mainMenu = mainMenu
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
