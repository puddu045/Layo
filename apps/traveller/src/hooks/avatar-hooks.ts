import { useMutation } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth-context';
import { useUpdateProfile } from './api-hooks';

const AVATARS_BUCKET = 'avatars';

/**
 * Uploads an already-cropped image (see `AvatarCropModal`, always a JPEG by the time it gets
 * here — both `cropImage` implementations save as JPEG) to the `avatars` Supabase Storage bucket
 * under this user's own folder (required by that bucket's RLS policies, which scope writes to
 * `<userId>/...` paths), and saves the resulting public URL onto the profile via the existing
 * `updateProfile` endpoint.
 *
 * Reads the file via `fetch(uri).arrayBuffer()` — this works identically whether `uri` is a
 * native `file://` path or a web `blob:` URL, unlike `expo-file-system`'s `readAsStringAsync`,
 * which this used before: deprecated in this SDK version, and not meaningfully implemented for
 * web at all.
 */
export function useUploadAvatar() {
  const { session } = useAuth();
  const updateProfile = useUpdateProfile();

  return useMutation({
    mutationFn: async (uri: string): Promise<string | undefined> => {
      const userId = session?.user.id;
      if (!userId) throw new Error('Not signed in');

      const path = `${userId}/avatar.jpg`;
      const arrayBuffer = await fetch(uri).then((res) => res.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from(AVATARS_BUCKET)
        .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
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
