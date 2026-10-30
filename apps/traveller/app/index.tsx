import { Redirect } from 'expo-router';
import { useAuth } from '../src/lib/auth-context';
import { LoadingState } from '../src/components/StateViews';
import { ScreenContainer } from '../src/components/ScreenContainer';

export default function Index() {
  const { session, loading, hasProfile } = useAuth();

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState label="Loading Layo…" />
      </ScreenContainer>
    );
  }

  if (!session) return <Redirect href="/(auth)/welcome" />;

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
