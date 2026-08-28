declare module "pa11y" {
  export interface Pa11yIssue {
    code: string;
    type: "error" | "warning" | "notice";
    message: string;
    context: string;
    selector: string;
    runner: string;
    runnerExtras?: Record<string, unknown>;
  }
  export interface Pa11yResults {
    documentTitle: string;
    pageUrl: string;
    issues: Pa11yIssue[];
  }
  export interface Pa11yOptions {
    runners?: string[];
    standard?: string;
    includeWarnings?: boolean;
    includeNotices?: boolean;
    timeout?: number;
    [key: string]: unknown;
  }
  function pa11y(url: string, options?: Pa11yOptions): Promise<Pa11yResults>;
  export = pa11y;
}
