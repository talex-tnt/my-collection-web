import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import {
  useGetWikipediaSettingsQuery,
  useGetRawgSettingsQuery,
  useUpdateRawgSettingsMutation,
  useUpdateWikipediaSettingsMutation,
} from '../api/firestore/firestoreApi';

export const useCurrentUser = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return unsubscribe;
  }, []);
  return user;
};

export const useWikiSettings = () => {
  const user = useCurrentUser();

  const userId = user?.uid;

  const {
    data: wikiSettings,
    isLoading,
    error: getError,
  } = useGetWikipediaSettingsQuery(userId ?? '', {
    skip: !userId,
  });
  const [updateWikipediaSettings, { isLoading: isUpdating }] =
    useUpdateWikipediaSettingsMutation();

  const setWikiSettings = async (payload: { enableSuggestions: boolean }) => {
    await updateWikipediaSettings({
      userId: userId ?? '',
      ...payload,
    }).unwrap();
  };
  return [
    wikiSettings,
    setWikiSettings,
    { isLoading, isUpdating, getError },
  ] as const;
};

export const useRawgSettings = () => {
  const user = useCurrentUser();

  const userId = user?.uid;

  const {
    data: rawgSettings,
    isLoading,
    error: getError,
  } = useGetRawgSettingsQuery(userId ?? '', {
    skip: !userId,
  });
  const [updateRawgSettings, { isLoading: isUpdating }] =
    useUpdateRawgSettingsMutation();

  const setRawgSettings = async (payload: { enableSuggestions: boolean }) => {
    await updateRawgSettings({
      userId: userId ?? '',
      ...payload,
    }).unwrap();
  };
  return [
    rawgSettings,
    setRawgSettings,
    { isLoading, isUpdating, getError },
  ] as const;
};
