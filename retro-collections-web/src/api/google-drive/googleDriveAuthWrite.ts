let tokenClientWrite: google.accounts.oauth2.TokenClient | null = null;
let currentResolveWrite: ((token: string) => void) | null = null;

// Dedicated storage keys to completely separate this session from read-only operations
export const WRITE_TOKEN_KEY = 'gdrive_access_token_write';
export const WRITE_EXPIRY_KEY = 'gdrive_token_expiry_write';

export const initGoogleDriveAuthWrite = (clientId: string): void => {
  tokenClientWrite = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    // Requests full file-level create/write permissions alongside read capability
    scope:
      'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file',
    callback: (response) => {
      if (response.access_token) {
        const expiresInSeconds = response.expires_in || 3600;
        const expiryTime = Date.now() + expiresInSeconds * 1000;

        sessionStorage.setItem(WRITE_TOKEN_KEY, response.access_token);
        sessionStorage.setItem(WRITE_EXPIRY_KEY, expiryTime.toString());

        if (currentResolveWrite) {
          currentResolveWrite(response.access_token);
          currentResolveWrite = null;
        }
      }
    },
  });
};

export const getDriveWriteToken = (): string | null => {
  const token = sessionStorage.getItem(WRITE_TOKEN_KEY);
  const expiry = sessionStorage.getItem(WRITE_EXPIRY_KEY);

  if (!token || !expiry) return null;

  const isExpired = Date.now() > parseInt(expiry, 10) - 120000;

  if (isExpired) {
    clearDriveWriteToken();
    return null;
  }

  return token;
};

export const requestDriveWriteToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!tokenClientWrite) {
      return reject('Google Write Token Client not initialized');
    }

    const validToken = getDriveWriteToken();
    if (validToken) {
      return resolve(validToken);
    }

    currentResolveWrite = resolve;
    tokenClientWrite.requestAccessToken();
  });
};

export const clearDriveWriteToken = (): void => {
  sessionStorage.removeItem(WRITE_TOKEN_KEY);
  sessionStorage.removeItem(WRITE_EXPIRY_KEY);
};
