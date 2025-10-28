const CODE_VERIFIER_LENGTH = 64;
const CODE_VERIFIER_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

export function generateCodeVerifier() {
  const array = new Uint8Array(CODE_VERIFIER_LENGTH);
  crypto.getRandomValues(array);
  let verifier = '';
  for (let i = 0; i < array.length; i += 1) {
    verifier += CODE_VERIFIER_CHARSET.charAt(array[i] % CODE_VERIFIER_CHARSET.length);
  }
  return verifier;
}

export async function generateCodeChallenge(codeVerifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
