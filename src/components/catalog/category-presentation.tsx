import {
  BellRing,
  Camera,
  LockKeyhole,
  Wifi,
  type LucideIcon,
} from 'lucide-react';
import { ProductCategory } from '@prisma/client';

export const categoryPresentation: Record<
  ProductCategory,
  { icon: LucideIcon; label: string }
> = {
  SECURITY_CAMERA: { icon: Camera, label: 'Camera an ninh' },
  VIDEO_DOORBELL: { icon: BellRing, label: 'Chuông cửa có hình' },
  MESH_WIFI: { icon: Wifi, label: 'Wi-Fi Mesh' },
  SMART_LOCK: { icon: LockKeyhole, label: 'Khóa thông minh' },
};

export const productCategories = Object.entries(categoryPresentation) as Array<
  [ProductCategory, (typeof categoryPresentation)[ProductCategory]]
>;
