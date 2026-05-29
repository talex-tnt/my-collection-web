import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import {
  useGetWikipediaSettingsQuery,
  useGetRawgSettingsQuery,
  useUpdateRawgSettingsMutation,
  useUpdateWikipediaSettingsMutation,
  useGetUISettingsQuery,
  useUpdateUISettingsMutation,
} from '../api/firestore/firestoreApi';
import { initGoogleDriveAuth } from '../api/google-drive/googleDriveAuth';

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

type Google = {
  google: { accounts: unknown };
};
export const useGoogleDriveAuth = () => {
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (
      typeof (window as Google).google !== 'undefined' &&
      (window as Google).google.accounts
    ) {
      initGoogleDriveAuth(clientId);
    } else {
      const interval = setInterval(() => {
        if (
          typeof (window as Google).google !== 'undefined' &&
          (window as Google).google.accounts
        ) {
          initGoogleDriveAuth(clientId);
          clearInterval(interval);
        }
      }, 50);

      return () => clearInterval(interval);
    }
  }, []);
};

export const useDisableScroll = (disable: boolean = true) => {
  useEffect(() => {
    document.body.style.overflow = disable ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [disable]);
};

export const useUISettings = () => {
  const user = useCurrentUser();

  const userId = user?.uid;

  const {
    data: uiSettings,
    isLoading,
    error: getError,
  } = useGetUISettingsQuery(userId ?? '', {
    skip: !userId,
  });
  const [updateUISettings, { isLoading: isUpdating }] =
    useUpdateUISettingsMutation();

  const setUISettings = async (payload: {
    collapseImages: boolean;
    enableImageProxy?: boolean;
    defaultListPageSize?: number;
  }) => {
    await updateUISettings({
      userId: userId ?? '',
      ...payload,
    }).unwrap();
  };
  return [
    uiSettings,
    setUISettings,
    { isLoading, isUpdating, getError },
  ] as const;
};

const getPageOptions = (defaultPageSize?: number) => {
  const options = [5, 10, 25, 50, 100, 250, 500];
  if (
    defaultPageSize !== undefined &&
    !options.includes(defaultPageSize) &&
    defaultPageSize !== Number.MAX_SAFE_INTEGER
  ) {
    options.push(defaultPageSize);
  }
  return options.sort((a, b) => a - b);
};

export const useSettingsUIPageSize = () => {
  const [settingsUI] = useUISettings();
  const pageOptions = getPageOptions(settingsUI?.defaultListPageSize);
  const [pageSize, setPageSize] = useState<number | 'all' | undefined>(
    settingsUI?.defaultListPageSize === Number.MAX_SAFE_INTEGER
      ? 'all'
      : settingsUI?.defaultListPageSize
  );
  useEffect(() => {
    if (
      pageSize === undefined &&
      settingsUI?.defaultListPageSize !== undefined
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPageSize(
        settingsUI?.defaultListPageSize === Number.MAX_SAFE_INTEGER
          ? 'all'
          : settingsUI?.defaultListPageSize
      );
    }
  }, [settingsUI?.defaultListPageSize, setPageSize, pageSize]);
  return [pageSize, setPageSize, pageOptions] as const;
};
