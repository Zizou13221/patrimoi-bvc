// RNPDFExport.m
// Module natif custom PatriMoi — compile directement dans l'app target
// Fichier auto-suffisant : pas besoin d'importer RNPDFExport.h
// Utilise WKWebView.createPDF (iOS 14+) — aucune API deprecated

#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

// ── Interface (auto-déclarée ici, pas besoin de .h) ───────────────────────────
@interface RNPDFExport : NSObject <RCTBridgeModule>
@end

// ── Delegate interne pour WKWebView ───────────────────────────────────────────
@interface RNPDFNavDelegate : NSObject <WKNavigationDelegate>
- (instancetype)initWithFinish:(void(^)(WKWebView *))finish
                         error:(void(^)(NSError *))error;
@end

@implementation RNPDFNavDelegate {
  void (^_finish)(WKWebView *);
  void (^_error)(NSError *);
}
- (instancetype)initWithFinish:(void(^)(WKWebView *))finish error:(void(^)(NSError *))error {
  if ((self = [super init])) { _finish = [finish copy]; _error = [error copy]; }
  return self;
}
- (void)webView:(WKWebView *)w didFinishNavigation:(WKNavigation *)n {
  if (_finish) { void(^f)(WKWebView *) = _finish; _finish = nil; _error = nil; f(w); }
}
- (void)webView:(WKWebView *)w didFailNavigation:(WKNavigation *)n withError:(NSError *)e {
  if (_error) { void(^f)(NSError *) = _error; _finish = nil; _error = nil; f(e); }
}
- (void)webView:(WKWebView *)w didFailProvisionalNavigation:(WKNavigation *)n withError:(NSError *)e {
  if (_error) { void(^f)(NSError *) = _error; _finish = nil; _error = nil; f(e); }
}
@end

// ── Module natif ──────────────────────────────────────────────────────────────
@implementation RNPDFExport

RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(convert:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSString *html     = options[@"html"]     ?: @"<p>Vide</p>";
  NSString *fileName = options[@"fileName"] ?: @"PatriMoi_export";
  if (![fileName hasSuffix:@".pdf"]) fileName = [fileName stringByAppendingString:@".pdf"];

  dispatch_async(dispatch_get_main_queue(), ^{
    CGRect a4 = CGRectMake(0, 0, 595.2, 841.8);
    WKWebView *wv = [[WKWebView alloc] initWithFrame:a4];

    __block WKWebView        *strongWV  = wv;
    __block RNPDFNavDelegate *strongDel = nil;

    RNPDFNavDelegate *del = [[RNPDFNavDelegate alloc]
      initWithFinish:^(WKWebView *webView) {
        if (@available(iOS 14.0, *)) {
          WKPDFConfiguration *cfg = [[WKPDFConfiguration alloc] init];
          cfg.rect = a4;
          [webView createPDFWithConfiguration:cfg completionHandler:^(NSData *data, NSError *err) {
            strongWV  = nil;
            strongDel = nil;
            if (!data || data.length == 0) {
              reject(@"PDF_EMPTY", err.localizedDescription ?: @"PDF vide", err);
              return;
            }
            NSString *dir  = NSSearchPathForDirectoriesInDomains(
                               NSDocumentDirectory, NSUserDomainMask, YES).firstObject;
            NSString *path = [dir stringByAppendingPathComponent:fileName];
            NSError  *we   = nil;
            if ([data writeToFile:path options:NSDataWritingAtomic error:&we]) {
              resolve(@{ @"filePath": path });
            } else {
              reject(@"PDF_WRITE", we.localizedDescription ?: @"Erreur écriture", we);
            }
          }];
        } else {
          strongWV  = nil;
          strongDel = nil;
          reject(@"PDF_IOS14", @"iOS 14+ requis pour l'export PDF natif", nil);
        }
      }
      error:^(NSError *err) {
        strongWV  = nil;
        strongDel = nil;
        reject(@"PDF_LOAD", err.localizedDescription ?: @"Erreur chargement HTML", err);
      }];

    strongDel = del;
    wv.navigationDelegate = del;
    [wv loadHTMLString:html baseURL:nil];
  });
}

@end
