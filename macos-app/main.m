#import <Cocoa/Cocoa.h>
#import <WebKit/WebKit.h>

@interface AppDelegate : NSObject <NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate>
@property (strong, nonatomic) NSWindow *window;
@property (strong, nonatomic) WKWebView *webView;
@property (strong, nonatomic) WKWebView *captureWebView;
@property (strong, nonatomic) NSTimer *captureTimeoutTimer;
@property (copy, nonatomic) NSString *pendingUrl;
@property (assign, nonatomic) CGFloat pendingWidth;
@property (assign, nonatomic) CGFloat pendingHeight;
@property (assign, nonatomic) BOOL captureInProgress;
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    NSRect screenRect = [[NSScreen mainScreen] visibleFrame];
    CGFloat winWidth = MIN(1440, screenRect.size.width * 0.92);
    CGFloat winHeight = MIN(900, screenRect.size.height * 0.92);
    CGFloat winX = screenRect.origin.x + (screenRect.size.width - winWidth) / 2.0;
    CGFloat winY = screenRect.origin.y + (screenRect.size.height - winHeight) / 2.0;

    NSUInteger style = NSWindowStyleMaskTitled | NSWindowStyleMaskClosable | NSWindowStyleMaskMiniaturizable | NSWindowStyleMaskResizable;
    self.window = [[NSWindow alloc] initWithContentRect:NSMakeRect(winX, winY, winWidth, winHeight)
                                              styleMask:style
                                                backing:NSBackingStoreBuffered
                                                  defer:NO];
    [self.window setTitle:@"ChurchReel Studio — Catholic Website & Parish Screen Video Creator"];
    [self.window setMinSize:NSMakeSize(1024, 680)];

    WKWebViewConfiguration *config = [[WKWebViewConfiguration alloc] init];
    [config.userContentController addScriptMessageHandler:self name:@"saveFile"];
    [config.userContentController addScriptMessageHandler:self name:@"captureSite"];
    [config.userContentController addScriptMessageHandler:self name:@"pasteClipboard"];
    [config.preferences setValue:@YES forKey:@"allowFileAccessFromFileURLs"];

    self.webView = [[WKWebView alloc] initWithFrame:[[self.window contentView] bounds] configuration:config];
    [self.webView setAutoresizingMask:(NSViewWidthSizable | NSViewHeightSizable)];
    [[self.window contentView] addSubview:self.webView];

    // Hidden offscreen WKWebView dedicated to rendering & snapshotting any live website URL!
    WKWebViewConfiguration *capConfig = [[WKWebViewConfiguration alloc] init];
    self.captureWebView = [[WKWebView alloc] initWithFrame:NSMakeRect(-5000, -5000, 1440, 2850) configuration:capConfig];
    [self.captureWebView setNavigationDelegate:self];

    NSString *resourcePath = [[NSBundle mainBundle] resourcePath];
    NSURL *publicDir = [[NSURL fileURLWithPath:resourcePath] URLByAppendingPathComponent:@"public"];
    NSURL *indexUrl = [publicDir URLByAppendingPathComponent:@"index.html"];
    [self.webView loadFileURL:indexUrl allowingReadAccessToURL:publicDir];

    [self setupMainMenu];
    [self.window makeKeyAndOrderFront:nil];
    [NSApp activateIgnoringOtherApps:YES];
}

- (void)userContentController:(WKUserContentController *)userContentController didReceiveScriptMessage:(WKScriptMessage *)message {
    // 1. Native Save File Dialog (MP4 & GIF)
    if ([message.name isEqualToString:@"saveFile"] && [message.body isKindOfClass:[NSDictionary class]]) {
        NSDictionary *dict = (NSDictionary *)message.body;
        NSString *filename = dict[@"filename"];
        NSString *base64 = dict[@"base64"];
        if (filename && base64) {
            NSData *data = [[NSData alloc] initWithBase64EncodedString:base64 options:NSDataBase64DecodingIgnoreUnknownCharacters];
            if (data) {
                NSSavePanel *savePanel = [NSSavePanel savePanel];
                [savePanel setNameFieldStringValue:filename];
                [savePanel setCanCreateDirectories:YES];
                [savePanel setTitle:@"Save ChurchReel Export"];
                [savePanel beginSheetModalForWindow:self.window completionHandler:^(NSModalResponse result) {
                    if (result == NSModalResponseOK && savePanel.URL) {
                        [data writeToURL:savePanel.URL atomically:YES];
                    }
                }];
            }
        }
        return;
    }

    // 2. Native Clipboard Paste Bridge
    if ([message.name isEqualToString:@"pasteClipboard"]) {
        NSString *clip = [[NSPasteboard generalPasteboard] stringForType:NSPasteboardTypeString];
        if (clip && clip.length > 0) {
            NSString *escaped = [[clip stringByReplacingOccurrencesOfString:@"\\" withString:@"\\\\"]
                                       stringByReplacingOccurrencesOfString:@"'" withString:@"\\'"];
            escaped = [[escaped componentsSeparatedByCharactersInSet:[NSCharacterSet newlineCharacterSet]] componentsJoinedByString:@""];
            NSString *js = [NSString stringWithFormat:@"const inp = document.getElementById('urlInput'); if(inp){ inp.value = '%@'; inp.focus(); }", escaped];
            [self.webView evaluateJavaScript:js completionHandler:nil];
        }
        return;
    }

    // 3. Native Live Website Loader & Full-Height Snapshot Engine
    if ([message.name isEqualToString:@"captureSite"] && [message.body isKindOfClass:[NSDictionary class]]) {
        NSDictionary *dict = (NSDictionary *)message.body;
        NSString *urlStr = dict[@"url"] ?: @"https://www.vaticannews.va/en.html";
        CGFloat width = [dict[@"width"] doubleValue] > 0 ? [dict[@"width"] doubleValue] : 1440.0;
        CGFloat height = [dict[@"height"] doubleValue] > 0 ? [dict[@"height"] doubleValue] : 2850.0;
        BOOL isMobile = [dict[@"isMobile"] boolValue];

        [self startNativeCaptureForURL:urlStr width:width height:height isMobile:isMobile];
    }
}

- (void)startNativeCaptureForURL:(NSString *)urlStr width:(CGFloat)width height:(CGFloat)height isMobile:(BOOL)isMobile {
    [self.captureTimeoutTimer invalidate];
    self.pendingUrl = urlStr;
    self.pendingWidth = width;
    self.pendingHeight = height;
    self.captureInProgress = YES;

    [self.captureWebView setFrame:NSMakeRect(-5000, -5000, width, height)];
    if (isMobile) {
        self.captureWebView.customUserAgent = @"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    } else {
        self.captureWebView.customUserAgent = @"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";
    }

    NSURL *nsUrl = [NSURL URLWithString:urlStr];
    if (!nsUrl) {
        [self finalizeCapture];
        return;
    }

    NSURLRequest *req = [NSURLRequest requestWithURL:nsUrl cachePolicy:NSURLRequestReloadIgnoringLocalCacheData timeoutInterval:12.0];
    [self.captureWebView loadRequest:req];

    // Safety fallback timer so even slow sites get snapshotted after 6.5 seconds
    self.captureTimeoutTimer = [NSTimer scheduledTimerWithTimeInterval:6.5
                                                                target:self
                                                              selector:@selector(onCaptureTimeout)
                                                              userInfo:nil
                                                               repeats:NO];
}

- (void)onCaptureTimeout {
    if (self.captureInProgress) {
        [self finalizeCapture];
    }
}

- (void)webView:(WKWebView *)webView didFinishNavigation:(WKNavigation *)navigation {
    if (webView == self.captureWebView && self.captureInProgress) {
        [self.captureTimeoutTimer invalidate];
        // Wait 1.2s after navigation finishes for hero images & fonts to settle, then snapshot
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.2 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            if (self.captureInProgress) {
                [self finalizeCapture];
            }
        });
    }
}

- (void)webView:(WKWebView *)webView didFailProvisionalNavigation:(WKNavigation *)navigation withError:(NSError *)error {
    if (webView == self.captureWebView && self.captureInProgress) {
        [self.captureTimeoutTimer invalidate];
        [self finalizeCapture];
    }
}

- (void)finalizeCapture {
    self.captureInProgress = NO;
    [self.captureTimeoutTimer invalidate];

    // Hide common cookie banners & get page title/description
    NSString *prepJS = @"(() => {"
        "const sels = ['[id*=\"cookie\" i]', '[class*=\"cookie\" i]', '[id*=\"consent\" i]', '[class*=\"consent\" i]', '.cc-window'];"
        "sels.forEach(s => document.querySelectorAll(s).forEach(el => { el.style.display = 'none'; }));"
        "const descEl = document.querySelector('meta[property=\"og:description\"]') || document.querySelector('meta[name=\"description\"]');"
        "return { title: document.title || location.hostname, description: descEl ? descEl.content : '', hostname: location.hostname.replace(/^www\\./, '') };"
        "})()";

    [self.captureWebView evaluateJavaScript:prepJS completionHandler:^(id result, NSError *error) {
        NSString *pageTitle = @"Official Webpage";
        NSString *pageDesc = @"Interactive website scroll showcase.";
        NSURL *parsed = [NSURL URLWithString:self.pendingUrl];
        NSString *host = parsed.host ? [parsed.host stringByReplacingOccurrencesOfString:@"www." withString:@""] : @"vaticannews.va";

        if ([result isKindOfClass:[NSDictionary class]]) {
            NSDictionary *info = (NSDictionary *)result;
            if ([info[@"title"] isKindOfClass:[NSString class]] && [info[@"title"] length] > 0) pageTitle = info[@"title"];
            if ([info[@"description"] isKindOfClass:[NSString class]] && [info[@"description"] length] > 0) pageDesc = info[@"description"];
            if ([info[@"hostname"] isKindOfClass:[NSString class]] && [info[@"hostname"] length] > 0) host = info[@"hostname"];
        }

        WKSnapshotConfiguration *snapConfig = [[WKSnapshotConfiguration alloc] init];
        snapConfig.rect = NSMakeRect(0, 0, self.pendingWidth, self.pendingHeight);
        snapConfig.snapshotWidth = @(self.pendingWidth);

        [self.captureWebView takeSnapshotWithConfiguration:snapConfig completionHandler:^(NSImage *snapshotImage, NSError *snapErr) {
            NSString *dataUrl = @"";
            if (snapshotImage) {
                CGImageRef cgRef = [snapshotImage CGImageForProposedRect:NULL context:nil hints:nil];
                if (cgRef) {
                    NSBitmapImageRep *bmp = [[NSBitmapImageRep alloc] initWithCGImage:cgRef];
                    NSData *jpgData = [bmp representationUsingType:NSBitmapImageFileTypeJPEG properties:@{NSImageCompressionFactor: @(0.88)}];
                    if (jpgData) {
                        NSString *b64 = [jpgData base64EncodedStringWithOptions:0];
                        dataUrl = [NSString stringWithFormat:@"data:image/jpeg;base64,%@", b64];
                    }
                }
            }

            NSDictionary *payload = @{
                @"title": pageTitle,
                @"description": pageDesc,
                @"hostname": host,
                @"fullUrl": self.pendingUrl ?: @"",
                @"screenshotDataUrl": dataUrl
            };

            NSData *jsonData = [NSJSONSerialization dataWithJSONObject:payload options:0 error:nil];
            NSString *jsonStr = [[NSString alloc] initWithData:jsonData encoding:NSUTF8StringEncoding];
            NSString *callbackJS = [NSString stringWithFormat:@"if(window.__onNativeWebsiteCaptured) window.__onNativeWebsiteCaptured(%@);", jsonStr];
            [self.webView evaluateJavaScript:callbackJS completionHandler:nil];
        }];
    }];
}

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication *)sender {
    return YES;
}

- (void)setupMainMenu {
    NSMenu *mainMenu = [[NSMenu alloc] init];

    // 1. Application Menu
    NSMenuItem *appMenuItem = [[NSMenuItem alloc] init];
    [mainMenu addItem:appMenuItem];
    NSMenu *appMenu = [[NSMenu alloc] init];
    [appMenu addItemWithTitle:@"About ChurchReel Studio" action:@selector(orderFrontStandardAboutPanel:) keyEquivalent:@""];
    [appMenu addItem:[NSMenuItem separatorItem]];
    [appMenu addItemWithTitle:@"Quit ChurchReel Studio" action:@selector(terminate:) keyEquivalent:@"q"];
    [appMenuItem setSubmenu:appMenu];

    // 2. Edit Menu (Crucial so Cmd+C, Cmd+V, Cmd+X, Cmd+A work in native macOS WKWebView!)
    NSMenuItem *editMenuItem = [[NSMenuItem alloc] init];
    [mainMenu addItem:editMenuItem];
    NSMenu *editMenu = [[NSMenu alloc] initWithTitle:@"Edit"];
    [editMenu addItemWithTitle:@"Undo" action:NSSelectorFromString(@"undo:") keyEquivalent:@"z"];
    [editMenu addItemWithTitle:@"Redo" action:NSSelectorFromString(@"redo:") keyEquivalent:@"Z"];
    [editMenu addItem:[NSMenuItem separatorItem]];
    [editMenu addItemWithTitle:@"Cut" action:@selector(cut:) keyEquivalent:@"x"];
    [editMenu addItemWithTitle:@"Copy" action:@selector(copy:) keyEquivalent:@"c"];
    [editMenu addItemWithTitle:@"Paste" action:@selector(paste:) keyEquivalent:@"v"];
    [editMenu addItemWithTitle:@"Select All" action:@selector(selectAll:) keyEquivalent:@"a"];
    [editMenuItem setSubmenu:editMenu];

    [NSApp setMainMenu:mainMenu];
}

@end

int main(int argc, const char * argv[]) {
    @autoreleasepool {
        NSApplication *app = [NSApplication sharedApplication];
        AppDelegate *delegate = [[AppDelegate alloc] init];
        [app setDelegate:delegate];
        [app setActivationPolicy:NSApplicationActivationPolicyRegular];
        [app run];
    }
    return 0;
}
