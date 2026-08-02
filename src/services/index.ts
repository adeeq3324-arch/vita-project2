import { setAuthTokenProvider } from './api/client';
import { getAccessToken } from './auth/session';

export { api, ApiError, setAuthTokenProvider } from './api/client';

export * as authService from './auth/authService';
export * as coachService from './coach/coachService';
export * as onboardingService from './onboarding/onboardingService';
export * as planningService from './planning/planningService';
export * as profileService from './profile/profileService';
export {
  loadSession,
  getSession,
  getAccessToken,
  isAuthenticated,
  clearSession,
  type Session,
} from './auth/session';

/**
 * Wires the API client to the session store so every request carries a fresh
 * bearer token. Called once at app start (see `App.tsx`), before any request.
 */
export function initAuth(): void {
  setAuthTokenProvider(getAccessToken);
}
