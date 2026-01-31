import { NextRequest, NextResponse } from "next/server";
import {
  checkRateLimit,
  getClientIdentifier,
  rateLimitExceededResponse,
  rateLimitHeaders,
  RateLimitConfig,
  RATE_LIMITS,
} from "./rate-limit";

type ApiHandler = (
  request: NextRequest,
  context?: { params: Record<string, string> }
) => Promise<Response>;

interface WithSecurityOptions {
  /** Rate limit configuration */
  rateLimit?: RateLimitConfig;
  /** Whether authentication is required */
  requireAuth?: boolean;
}

/**
 * Wrapper to add rate limiting and security to API routes
 * 
 * Usage:
 * ```ts
 * export const POST = withSecurity(
 *   async (request) => {
 *     // your handler code
 *   },
 *   { rateLimit: RATE_LIMITS.write }
 * );
 * ```
 */
export function withSecurity(
  handler: ApiHandler,
  options: WithSecurityOptions = {}
): ApiHandler {
  return async (request: NextRequest, context?: { params: Record<string, string> }) => {
    // Apply rate limiting if configured
    if (options.rateLimit) {
      const identifier = getClientIdentifier(request);
      const routeKey = `${request.method}:${new URL(request.url).pathname}`;
      const result = checkRateLimit(`${identifier}:${routeKey}`, options.rateLimit);

      if (!result.success) {
        return rateLimitExceededResponse(result);
      }

      // Add rate limit headers to successful responses
      const response = await handler(request, context);
      
      // Clone response to add headers
      const newHeaders = new Headers(response.headers);
      Object.entries(rateLimitHeaders(result)).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    return handler(request, context);
  };
}

/**
 * Security headers to add to all responses
 */
export const securityHeaders = {
  // Prevent clickjacking
  "X-Frame-Options": "DENY",
  // Prevent MIME type sniffing
  "X-Content-Type-Options": "nosniff",
  // Enable XSS filter in older browsers
  "X-XSS-Protection": "1; mode=block",
  // Control referrer information
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Permissions policy
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/**
 * Add security headers to a response
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

// Re-export rate limits for convenience
export { RATE_LIMITS };
