import {
  createCatalogImageStorage,
  getCatalogImageStorage,
  uploadAndPersist,
  type PrivateObjectStorage,
  type StorageUploadInput,
  type StoredPrivateObject,
} from '@/modules/storage';

export type ProductImageUploadInput = Omit<StorageUploadInput, 'purpose'>;

export type ProductImageStorage = Pick<
  PrivateObjectStorage,
  'delete' | 'download' | 'exists'
> & {
  upload(input: ProductImageUploadInput): Promise<StoredPrivateObject>;
};

function asProductImageStorage(
  storage: PrivateObjectStorage,
): ProductImageStorage {
  return {
    upload: (input) => storage.upload({ ...input, purpose: 'catalog' }),
    delete: (storageKey) => storage.delete(storageKey),
    download: (storageKey) => storage.download(storageKey),
    exists: (storageKey) => storage.exists(storageKey),
  };
}

export function createProductImageStorage(
  environment: Record<string, string | undefined> = process.env,
): ProductImageStorage {
  return asProductImageStorage(createCatalogImageStorage(environment));
}

export function getProductImageStorage(): ProductImageStorage {
  return asProductImageStorage(getCatalogImageStorage());
}

export async function uploadAndPersistProductImage<T>(
  input: ProductImageUploadInput,
  persist: (uploaded: StoredPrivateObject) => Promise<T>,
): Promise<T> {
  return uploadAndPersist(
    getCatalogImageStorage(),
    { ...input, purpose: 'catalog' },
    persist,
  );
}
