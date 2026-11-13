import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { useUpdateProfile } from './api-hooks';

const AVATARS_BUCKET = 'avatars';

function contentTypeFor(extension: string): string {
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Picks an image from the library, uploads it to the `avatars` Supabase Storage bucket under
 * this user's own folder (required by that bucket's RLS policies, which scope writes to
 * `<userId>/...` paths), and saves the resulting public URL onto the profile via the existing
 * `updateProfile` endpoint.
 *
 * Reads the file as base64 via `expo-file-system` and decodes it to an ArrayBuffer rather than
 * `fetch(uri).blob()` — the latter has been unreliable for local `file://` URIs on Android on
 * some RN/Hermes combinations; this is Supabase's own documented approach for Expo apps.
 */
export function useChangeAvatar() {
  const { session } = useAuth();
  const updateProfile = useUpdateProfile();

  return useMutation({
    mutationFn: async (): Promise<string | undefined> => {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error('Photo library access is needed to choose a profile picture');
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (result.canceled) return undefined;
      const asset = result.assets[0];
      if (!asset) return undefined;

      const userId = session?.user.id;
      if (!userId) throw new Error('Not signed in');

      const extension = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${userId}/avatar.${extension}`;

      const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      const { error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, decode(base64), { contentType: contentTypeFor(extension), upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(AVATARS_BUCKET).getPublicUrl(path);
      // Cache-bust: the path (and so the URL) is stable per user, so re-uploading would otherwise
      // keep showing a cached copy of the previous photo on this and other devices.
      const photoUrl = `${data.publicUrl}?v=${Date.now()}`;

      await updateProfile.mutateAsync({ photoUrl });
      return photoUrl;
    },
  });
}
