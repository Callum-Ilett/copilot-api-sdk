/**
 * An HTTP method the SDK can send.
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Supplies a JWT access token for one request.
 *
 * Called once per request, right before it is sent. Any auth source works
 * (MSAL, Auth0, a custom one), as long as it resolves to a non empty token.
 *
 * @returns The bearer token to send in the `Authorization` header.
 */
export type AuthTokenProvider = () => Promise<string>;
