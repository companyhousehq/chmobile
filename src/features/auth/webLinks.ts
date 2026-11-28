import * as WebBrowser from "expo-web-browser";
import { webBaseUrl } from "@/lib/env";

/** Terms and privacy open in the in-app browser so wording never forks (OQ-7). */
export function openLegal(path: string): void {
  const url = /^https?:\/\//.test(path)
    ? path
    : `${webBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  void WebBrowser.openBrowserAsync(url);
}
