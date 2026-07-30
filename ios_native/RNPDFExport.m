// RNPDFExport.m
// Module natif custom PatriMoi — compile directement dans l'app target
// Fichier auto-suffisant : pas besoin d'importer RNPDFExport.h
//
// Stratégie scroll-page-par-page (v2):
//  1. WKWebView A4 width, alpha=0 dans la fenêtre (rendu actif)
//  2. Après load: JS mesure scrollHeight
//  3. Pour chaque page A4:
//     a. Scroller à la position de cette page → force le rendu des tiles
//     b. Attendre 0.4s pour que WebKit rende cette zone
//     c. createPDFWithConfiguration pour cette tranche exacte
//     d. Écrire dans le PDF final multi-pages
//
// Pourquoi cette approche:
//  WKWebView utilise le rendu par tiles. Même avec alpha=0, il ne rend
//  que les tiles dans le viewport visible (~844pt sur iPhone). En scrollant
//  à chaque position, on force iOS à rendre les tiles de cette zone.
//  On capture tranche par tranche → PDF multi-pages garanti.

#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>

@interface RNPDFExport : NSObject <RCTBridgeModule>
@end

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
    // Frame initial A4 — largeur 595.2pt critique pour le layout CSS
    CGRect a4 = CGRectMake(0, 0, 595.2, 841.8);
    WKWebView *wv = [[WKWebView alloc] initWithFrame:a4];

    // alpha=0 (transparent, PAS hidden) → participe au rendu des tiles
    UIWindow *window = [UIApplication sharedApplication].windows.firstObject;
    wv.alpha = 0;
    [window addSubview:wv];

    __block WKWebView        *strongWV  = wv;
    __block RNPDFNavDelegate *strongDel = nil;

    RNPDFNavDelegate *del = [[RNPDFNavDelegate alloc]
      initWithFinish:^(WKWebView *webView) {

        // Étape 1: attendre layout initial (fonts, CSS, images)
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)),
                       dispatch_get_main_queue(), ^{

          // Étape 2: mesurer la hauteur RÉELLE du document
          [webView evaluateJavaScript:@"document.documentElement.scrollHeight"
                    completionHandler:^(id result, NSError *jsErr) {

            const CGFloat a4W = 595.2;
            const CGFloat a4H = 841.8;

            CGFloat contentH = a4H;
            if (result && [result respondsToSelector:@selector(floatValue)]) {
              CGFloat h = [result floatValue];
              if (h > contentH) contentH = h;
            }

            NSInteger pageCount = (NSInteger)ceil(contentH / a4H);
            if (pageCount < 1) pageCount = 1;

            // Créer le PDF multi-pages final
            NSMutableData *finalPDF = [NSMutableData data];
            UIGraphicsBeginPDFContextToData(finalPDF, CGRectMake(0, 0, a4W, a4H), nil);

            // ── Capture page par page (scroll → tiles → capture) ─────────────
            // Bloc récursif : pour chaque page on scroll, attend, capture, continue
            __block NSInteger currentPage = 0;
            __block void (^captureNext)(void);

            captureNext = ^{
              if (currentPage >= pageCount) {
                // Toutes les pages capturées → fermer PDF et sauvegarder
                UIGraphicsEndPDFContext();
                [webView removeFromSuperview];
                strongWV  = nil;
                strongDel = nil;
                captureNext = nil;

                if (!finalPDF || finalPDF.length == 0) {
                  reject(@"PDF_EMPTY", @"PDF vide après capture", nil);
                  return;
                }

                NSString *dir  = NSSearchPathForDirectoriesInDomains(
                                   NSDocumentDirectory, NSUserDomainMask, YES).firstObject;
                NSString *path = [dir stringByAppendingPathComponent:fileName];
                NSError  *we   = nil;
                if ([finalPDF writeToFile:path options:NSDataWritingAtomic error:&we]) {
                  resolve(@{ @"filePath": path });
                } else {
                  reject(@"PDF_WRITE", we.localizedDescription ?: @"Erreur écriture", we);
                }
                return;
              }

              CGFloat yOffset = (CGFloat)currentPage * a4H;

              // SCROLL à la position de cette page → force iOS à rendre ces tiles
              [webView.scrollView setContentOffset:CGPointMake(0, yOffset) animated:NO];

              // Attendre que WebKit rende les tiles de cette zone (0.4s)
              dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.4 * NSEC_PER_SEC)),
                             dispatch_get_main_queue(), ^{

                if (@available(iOS 14.0, *)) {
                  // Hauteur de cette tranche (dernière page peut être plus courte)
                  CGFloat sliceH = MIN(a4H, contentH - yOffset);
                  if (sliceH <= 0) { currentPage++; captureNext(); return; }

                  WKPDFConfiguration *cfg = [[WKPDFConfiguration alloc] init];
                  // cfg.rect dans le coordinate space CONTENU du WKWebView
                  // (pas le viewport — c'est la position dans le document)
                  cfg.rect = CGRectMake(0, yOffset, a4W, sliceH);

                  [webView createPDFWithConfiguration:cfg
                                 completionHandler:^(NSData *sliceData, NSError *sliceErr) {

                    if (sliceData && sliceData.length > 0) {
                      // Ouvrir la tranche comme CGPDFDocument
                      CGDataProviderRef prov = CGDataProviderCreateWithCFData(
                        (__bridge CFDataRef)sliceData);
                      CGPDFDocumentRef doc  = CGPDFDocumentCreateWithProvider(prov);
                      CGPDFPageRef     page = CGPDFDocumentGetPage(doc, 1);

                      if (page) {
                        // Créer une page A4 dans le PDF final
                        UIGraphicsBeginPDFPage();
                        CGContextRef ctx = UIGraphicsGetCurrentContext();

                        // Flip Y: PDF standard (Y=0 en bas) → UIKit (Y=0 en haut)
                        CGContextSaveGState(ctx);
                        CGContextTranslateCTM(ctx, 0, a4H);
                        CGContextScaleCTM(ctx, 1.0, -1.0);

                        // Si la tranche est plus petite qu'A4 (dernière page),
                        // la dessiner en haut de la page A4
                        if (sliceH < a4H) {
                          CGContextTranslateCTM(ctx, 0, -(a4H - sliceH));
                        }

                        CGContextDrawPDFPage(ctx, page);
                        CGContextRestoreGState(ctx);
                      }

                      CGPDFDocumentRelease(doc);
                      CGDataProviderRelease(prov);
                    }

                    currentPage++;
                    captureNext();
                  }];
                } else {
                  // iOS < 14 non supporté
                  UIGraphicsEndPDFContext();
                  [webView removeFromSuperview];
                  strongWV  = nil;
                  strongDel = nil;
                  captureNext = nil;
                  reject(@"PDF_IOS14", @"iOS 14+ requis pour l'export PDF", nil);
                }
              });
            };

            // Lancer la capture de la première page
            captureNext();
          }];
        });
      }
      error:^(NSError *err) {
        [wv removeFromSuperview];
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
