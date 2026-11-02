import { Redirect } from 'expo-router';
import { useAuth } from '../src/lib/auth-context';
import { ErrorState, LoadingState } from '../src/components/StateViews';
import { ScreenContainer } from '../src/components/ScreenContainer';

export default function Index() {
  const { session, loading, hasProfile, profileError, refreshProfileStatus } = useAuth();

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState label="Loading Layo…" />
      </ScreenContainer>
    );
  }

  if (!session) return <Redirect href="/(auth)/welcome" />;

  // hasProfile === null covers two different situations: still checking (profileError is
  // unset — show the spinner) and the last check failed (profileError is set — a down API, a
  // dropped connection, anything). Without this split, a failed check looked exactly like it
  // was still loading and this screen spun forever with no way to retry.
  if (profileError) {
    return (
      <ScreenContainer>
        <ErrorState message={profileError} onRetry={refreshProfileStatus} />
      </ScreenContainer>
    );
  }

  if (hasProfile === null) {
    return (
      <ScreenContainer>
        <LoadingState label="Loading your profile…" />
      </ScreenContainer>
    );
  }

  if (hasProfile === false) return <Redirect href="/profile-setup" />;

  return <Redirect href="/(tabs)/discover" />;
}
