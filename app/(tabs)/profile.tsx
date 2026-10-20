import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorState } from "../../components/ErrorState";
import { LoadingState } from "../../components/LoadingState";
import { AccountSection } from "../../features/profile/components/AccountSection";
import { GlowBackdrop } from "../../features/profile/components/GlowBackdrop";
import { ProfileHeader } from "../../features/profile/components/ProfileHeader";
import { ProfileRecentProjects } from "../../features/profile/components/ProfileRecentProjects";
import { WorkspaceStatsCard } from "../../features/profile/components/WorkspaceStatsCard";
import { useProfileIdentity } from "../../features/profile/hooks/useProfileIdentity";
import { useProfileOverview } from "../../features/profile/hooks/useProfileOverview";
import { useSignOut } from "../../features/profile/hooks/useSignOut";

export default function Profile() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const identity = useProfileIdentity();
  const { stats, recentProjects, hasProjects, isLoading, error, refresh } = useProfileOverview();
  const { requestSignOut, isSigningOut, error: signOutError } = useSignOut();

  return (
    <View className="flex-1 bg-n900">
      <StatusBar style="light" />
      <GlowBackdrop />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingHorizontal: 16,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <ProfileHeader identity={identity} />

        <View className="mt-6 gap-4">
          {isLoading ? (
            <LoadingState label="your workspace" />
          ) : (
            <>
              {/* Figures may be partial when a read failed, so say so. */}
              {error ? <ErrorState message={error} onRetry={refresh} /> : null}
              <WorkspaceStatsCard stats={stats} />
              {/* Without a loaded list, "no projects" would be a guess. */}
              {hasProjects ? (
                <ProfileRecentProjects
                  items={recentProjects}
                  onViewAllPress={() => router.navigate("/projects")}
                  onProjectPress={(project) =>
                    router.push({
                      pathname: "/projects/[projectId]",
                      params: { projectId: project.id },
                    })
                  }
                  onCreatePress={() => router.push("/create-project")}
                />
              ) : null}
            </>
          )}

          {/* Outside the loading branch: signing out never waits on the API. */}
          <AccountSection
            onSignOutPress={requestSignOut}
            isSigningOut={isSigningOut}
            signOutError={signOutError}
          />
        </View>
      </ScrollView>
    </View>
  );
}
