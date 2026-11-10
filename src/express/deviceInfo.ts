export interface DeviceInfo {
    deviceName: string;
    os?: string;
    browser?: string;
    deviceType: "mobile" | "tablet" | "desktop" | "bot" | "unknown";
}

const OS_PATTERNS: [RegExp, string][] = [
    [/windows nt 10/i, "Windows 10"],
    [/windows nt 6\.3/i, "Windows 8.1"],
    [/windows nt 6\.1/i, "Windows 7"],
    // iOS/iPadOS UAs also contain "like Mac OS X", so they must be checked first.
    [/ipad/i, "iPadOS"],
    [/iphone os|cpu os/i, "iOS"],
    [/mac os x/i, "macOS"],
    [/android/i, "Android"],
    [/linux/i, "Linux"],
];

const BROWSER_PATTERNS: [RegExp, string][] = [
    [/edg\//i, "Edge"],
    [/opr\//i, "Opera"],
    [/chrome\//i, "Chrome"],
    [/crios\//i, "Chrome iOS"],
    [/firefox\//i, "Firefox"],
    [/fxios\//i, "Firefox iOS"],
    [/safari\//i, "Safari"],
    [/postmanruntime/i, "Postman"],
    [/insomnia/i, "Insomnia"],
    [/okhttp/i, "OkHttp"],
    [/curl\//i, "curl"],
    [/axios\//i, "axios"],
    [/node-fetch/i, "node-fetch"],
];

function detectFromPatterns(userAgent: string, patterns: [RegExp, string][]): string | undefined {
    for (const [pattern, name] of patterns) {
        if (pattern.test(userAgent)) {
            return name;
        }
    }
    return undefined;
}

function detectDeviceType(userAgent: string): DeviceInfo["deviceType"] {
    if (!userAgent) {
        return "unknown";
    }
    if (/bot|spider|crawler|slurp/i.test(userAgent)) {
        return "bot";
    }
    if (/ipad|tablet/i.test(userAgent)) {
        return "tablet";
    }
    if (/mobi|iphone|android/i.test(userAgent)) {
        return "mobile";
    }
    return "desktop";
}

/**
 * Resolves the calling device from an explicit `X-Device-Name` header when present,
 * otherwise falls back to parsing the User-Agent string.
 */
export function resolveDeviceInfo(req: any): DeviceInfo {
    const userAgent = String(req?.headers?.["user-agent"] ?? "");
    const os = detectFromPatterns(userAgent, OS_PATTERNS);
    const browser = detectFromPatterns(userAgent, BROWSER_PATTERNS);
    const deviceType = detectDeviceType(userAgent);

    const explicitDeviceName = req?.headers?.["x-device-name"];
    if (explicitDeviceName) {
        return { deviceName: String(explicitDeviceName), os, browser, deviceType };
    }

    const deviceName = [os, browser].filter(Boolean).join(" / ") || (userAgent ? "Unknown device" : "Unknown");
    return { deviceName, os, browser, deviceType };
}

/**
 * Resolves the calling service name from an explicit `X-Service-Name` header,
 * falling back to the service name configured for this backend instance.
 */
export function resolveServiceName(req: any, configuredServiceName?: string): string {
    const explicitServiceName = req?.headers?.["x-service-name"];
    if (explicitServiceName) {
        return String(explicitServiceName);
    }
    return configuredServiceName ?? "unknown-service";
}
