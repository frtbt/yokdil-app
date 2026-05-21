const { withXcodeProject, withPodfileProperties } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// ─── Objective-C header ───────────────────────────────────────────────────────
const HEADER = `\
#import <React/RCTBridgeModule.h>

@interface PdfTextModule : NSObject <RCTBridgeModule>
@end
`;

// ─── Objective-C implementation (PDFKit — iOS 11+) ───────────────────────────
const IMPL = `\
#import "PdfTextModule.h"
#import <PDFKit/PDFKit.h>

@implementation PdfTextModule

RCT_EXPORT_MODULE(PdfTextModule)

+ (BOOL)requiresMainQueueSetup {
  return NO;
}

RCT_EXPORT_METHOD(extractText:(NSString *)filePath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_global_queue(DISPATCH_QUEUE_PRIORITY_DEFAULT, 0), ^{
    NSString *cleanPath = [filePath hasPrefix:@"file://"]
      ? [filePath substringFromIndex:7]
      : filePath;

    NSURL *fileURL = [NSURL fileURLWithPath:cleanPath];
    PDFDocument *document = [[PDFDocument alloc] initWithURL:fileURL];

    if (!document) {
      reject(@"PDF_TEXT_ERROR",
             [NSString stringWithFormat:@"PDF dosyasi acilamadi: %@", cleanPath],
             nil);
      return;
    }

    NSMutableArray<NSString *> *pages = [NSMutableArray array];
    for (NSInteger i = 0; i < (NSInteger)[document pageCount]; i++) {
      PDFPage *page = [document pageAtIndex:i];
      NSString *text = [page string] ?: @"";
      [pages addObject:text];
    }

    resolve(pages);
  });
}

@end
`;

const withPdfTextModule = (config) => {
  // Podfile deployment target'i her prebuild'de 16.0 olarak sabitle
  config = withPodfileProperties(config, (config) => {
    config.modResults['ios.deploymentTarget'] = '16.0';
    return config;
  });

  return withXcodeProject(config, (config) => {
    const iosDir = config.modRequest.platformProjectRoot; // ios/
    const projectName = config.modRequest.projectName;    // yokdilapp

    // Source dosyalari ios/<projectName>/ altina yaz
    const targetDir = path.join(iosDir, projectName);
    fs.mkdirSync(targetDir, { recursive: true });

    fs.writeFileSync(path.join(targetDir, 'PdfTextModule.h'), HEADER, 'utf8');
    fs.writeFileSync(path.join(targetDir, 'PdfTextModule.m'), IMPL, 'utf8');

    // Xcode projesine kaynak dosya olarak ekle
    const xcodeProject = config.modResults;

    // Zaten eklenmemisse ekle (idempotent)
    const existingSources = xcodeProject.pbxSourcesBuildPhaseObj(
      xcodeProject.getFirstTarget().uuid
    );
    const alreadyAdded = Object.values(existingSources.files || {}).some(
      (f) => typeof f === 'object' && f.comment && f.comment.includes('PdfTextModule.m')
    );

    if (!alreadyAdded) {
      const groupKey = xcodeProject.findPBXGroupKey({ name: projectName });
      xcodeProject.addSourceFile(
        `${projectName}/PdfTextModule.m`,
        { target: xcodeProject.getFirstTarget().uuid },
        groupKey
      );
    }

    return config;
  });
};

module.exports = withPdfTextModule;
