import type { BaseQueryFn, EndpointBuilder } from '@reduxjs/toolkit/query';
import type { FirestoreApiError } from '../errorLogger';

export type FirestoreTagTypes =
  | 'PublicCollections'
  | 'PublicUserItems'
  | 'PublicUserTags'
  | 'PublicUsers'
  | 'PrivateUsers'
  | 'PrivateAuthorizedUsers'
  | 'WikipediaSettings';

export type FirestoreBuilder = EndpointBuilder<
  BaseQueryFn<void, unknown, FirestoreApiError>,
  FirestoreTagTypes,
  'firestoreApi'
>;
