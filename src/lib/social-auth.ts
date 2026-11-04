import { Platform } from 'react-native';

/**
 * Native Google / Apple sign-in. Returns the provider's ID token for Supabase's signInWithIdToken,
 * or null when the user cancelled. Native modules are loaded lazily so web and the demo keep working.
 */
export async function googleIdToken(): Promise<string | null> {
  const { GoogleSignin, isSuccessResponse } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const res = await GoogleSignin.signIn();
  if (!isSuccessResponse(res)) return null;
  if (!res.data.idToken) throw new Error('Google hat kein ID-Token geliefert. Ist die Web-Client-ID gesetzt?');
  return res.data.idToken;
}

export async function appleIdToken(): Promise<{ token: string; nonce: string; fullName?: string } | null> {
  const Apple = await import('expo-apple-authentication');
  const Crypto = await import('expo-crypto');
  const nonce = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  try {
    const cred = await Apple.signInAsync({
      requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
      nonce: hashed,
    });
    if (!cred.identityToken) throw new Error('Apple hat kein Token geliefert.');
    const fullName = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ') || undefined;
    return { token: cred.identityToken, nonce, fullName };
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
    throw e;
  }
}

export async function appleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    const Apple = await import('expo-apple-authentication');
    return await Apple.isAvailableAsync();
  } catch {
    return false;
  }
}

/** Normalises German-style input ("0151 1234567") to E.164 ("+491511234567"). */
export function toE164(input: string, defaultCountry = '+49'): string | null {
  let s = input.replace(/[\s\-/()]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  else if (s.startsWith('0')) s = defaultCountry + s.slice(1);
  else if (!s.startsWith('+')) s = defaultCountry + s;
  return /^\+[1-9]\d{7,14}$/.test(s) ? s : null;
}
