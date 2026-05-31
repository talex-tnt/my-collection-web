let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let currentResolve: ((token: string) => void) | null = null;

export const TOKEN_KEY = 'gdrive_access_token';
export const EXPIRY_KEY = 'gdrive_token_expiry';

export const initGoogleDriveAuth = (clientId: string) => {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    callback: (response) => {
      if (response.access_token) {
        const expiresInSeconds = response.expires_in || 3600;
        const expiryTime = Date.now() + expiresInSeconds * 1000;

        sessionStorage.setItem(TOKEN_KEY, response.access_token);
        sessionStorage.setItem(EXPIRY_KEY, expiryTime.toString());

        if (currentResolve) {
          currentResolve(response.access_token);
          currentResolve = null;
        }
      }
    },
  });
};

export const getDriveToken = (): string | null => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiry = sessionStorage.getItem(EXPIRY_KEY);

  if (!token || !expiry) return null;

  const isExpired = Date.now() > parseInt(expiry, 10) - 120000;

  if (isExpired) {
    clearDriveToken();
    return null;
  }

  return token;
};

export const requestDriveToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      return reject('Google Token Client not initialized');
    }

    const validToken = getDriveToken();
    if (validToken) {
      return resolve(validToken);
    }

    currentResolve = resolve;
    tokenClient.requestAccessToken();
  });
};

export const clearDriveToken = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRY_KEY);
};
