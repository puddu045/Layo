import { useMutation } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { useUpdateProfile } from './api-hooks';

const AVATARS_BUCKET = 'avatars';
const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
};

/**
 * Picks an image from the library, uploads it to the `avatars` Supabase Storage bucket under
 * this user's own folder (required by that bucket's RLS policies, which scope writes to
 * `<userId>/...` paths), and saves the resulting public URL onto the profile via the existing
 * `updateProfile` endpoint.
 *
 * Reads the picked asset via `fetch(uri).arrayBuffer()` — this works identically whether `uri` is
 * a native `file://` path or a web `blob:` URL (the image picker returns the latter when this
 * app runs as a website), unlike `expo-file-system`'s `readAsStringAsync`, which is deprecated
 * in this SDK version and isn't meaningfully implemented for web at all.
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

      const contentType = asset.mimeType ?? 'image/jpeg';
      const extension = EXTENSION_BY_MIME_TYPE[contentType] ?? 'jpg';
      const path = `${userId}/avatar.${extension}`;

      const arrayBuffer = await fetch(asset.uri).then((res) => res.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, arrayBuffer, { contentType, upsert: true });
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
