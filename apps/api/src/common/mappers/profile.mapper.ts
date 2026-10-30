import { calculateAge, type PublicProfile } from '@layo/contracts';

export interface ProfileRow {
  userId: string;
  displayName: string;
  dateOfBirth: Date;
  bio: string;
  interests: string[];
  languages: string[];
  homeCityIata: string | null;
  photoUrl: string | null;
}

export function toPublicProfile(profile: ProfileRow): PublicProfile {
  return {
    userId: profile.userId,
    displayName: profile.displayName,
    age: calculateAge(profile.dateOfBirth.toISOString().slice(0, 10)),
    bio: profile.bio,
    interests: profile.interests,
    languages: profile.languages,
    homeCityIata: profile.homeCityIata ?? undefined,
    photoUrl: profile.photoUrl ?? undefined,
  };
}
