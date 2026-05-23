let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let accessToken: string | null = null;
let currentResolve: ((token: string) => void) | null = null;

export const initGoogleDriveAuth = (clientId: string) => {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    callback: (response) => {
      if (response.access_token) {
        accessToken = response.access_token;
        if (currentResolve) {
          currentResolve(response.access_token);
          currentResolve = null;
        }
      }
    },
  });
};

export const requestDriveToken = (): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      return reject('Google Token Client not initialized');
    }

    // Se abbiamo già un token valido, restituisci quello senza aprire pop-up
    if (accessToken) {
      return resolve(accessToken);
    }

    currentResolve = resolve;

    // Rimuoviamo prompt: '' che creava l'inghippo visivo
    tokenClient.requestAccessToken();
  });
};

export const getDriveToken = () => accessToken;
export const clearDriveToken = () => {
  accessToken = null;
};
