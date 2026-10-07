"use client";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { sanitizedTrackingUrl } from "@/lib/telemetry";
export function SiteTelemetry() {
  return <>
    <Analytics beforeSend={event => { const url = sanitizedTrackingUrl(event.url); return url ? { ...event, url } : null; }} />
    <SpeedInsights beforeSend={event => { const url = sanitizedTrackingUrl(event.url); return url ? { ...event, url } : null; }} />
  </>;
}
