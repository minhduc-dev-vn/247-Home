import {
  LocalStorageAdapter,
  StorageValidationError,
  uploadAndPersist,
  type StorageUploadInput,
  type StoredPrivateObject,
} from '@/modules/storage';

// Compatibility facade for local/test cleanup helpers. Application code uses
// the provider-neutral storage port from modules/storage.
const localStorage = new LocalStorageAdapter();

export { StorageValidationError as LocalEvidenceStorageError };
export type EvidenceInput = StorageUploadInput;
export type StagedEvidence = StoredPrivateObject;

export async function storeLocalEvidence<T>(
  input: EvidenceInput,
  persist: (uploaded: StagedEvidence) => Promise<T>,
  _compensate?: (persisted: T) => Promise<void>,
): Promise<T> {
  return uploadAndPersist(localStorage, input, persist);
}

export async function discardLocalEvidence(
  uploaded: StagedEvidence,
): Promise<void> {
  await localStorage.delete(uploaded.storageKey);
}

export async function readLocalEvidence(
  storageKey: string,
): Promise<Buffer | null> {
  return localStorage.download(storageKey);
}

export async function removeLocalEvidence(storageKey: string): Promise<void> {
  await localStorage.delete(storageKey);
}
