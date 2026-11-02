// Only the isolated Vite fixture resolves this module. Production imports are unchanged.
const token = async () => 'synthetic-baseline-token';
export const useAuth = () => ({ isLoaded: true, isSignedIn: true,
  sessionId: 'synthetic-session', getToken: token });
export const useClerk = () => ({ signOut: async () => undefined });
export const SignIn = () => <p>Clerk widget excluded from the offline baseline.</p>;
