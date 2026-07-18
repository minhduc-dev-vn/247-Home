export type ProductDemoImage = {
  altText: string;
  src: string;
};

function createGallery(slug: string, productName: string): ProductDemoImage[] {
  return [
    {
      altText: `${productName}, ảnh sản phẩm chính`,
      src: `/assets/images/products/${slug}.png`,
    },
    {
      altText: `${productName}, góc nhìn trực diện`,
      src: `/assets/images/products/${slug}_1.png`,
    },
    {
      altText: `${productName}, góc nhìn bên và chi tiết thiết bị`,
      src: `/assets/images/products/${slug}_2.png`,
    },
    {
      altText: `${productName} trong không gian sử dụng`,
      src: `/assets/images/products/${slug}_3.png`,
    },
  ];
}

export const productDemoImages = {
  'camera-ngoai-troi-c1': createGallery(
    'camera-ngoai-troi-c1',
    'Camera ngoài trời C1 màu trắng',
  ),
  'camera-pin-c3': createGallery('camera-pin-c3', 'Camera pin C3 màu đen'),
  'camera-trong-nha-c2': createGallery(
    'camera-trong-nha-c2',
    'Camera trong nhà C2 màu trắng',
  ),
  'chuong-cua-d1': createGallery(
    'chuong-cua-d1',
    'Chuông cửa D1 màu trắng kèm chuông',
  ),
  'chuong-cua-d2': createGallery(
    'chuong-cua-d2',
    'Chuông cửa D2 góc rộng màu đen',
  ),
  'chuong-cua-d3': createGallery(
    'chuong-cua-d3',
    'Chuông cửa D3 màu xám kèm màn hình',
  ),
  'khoa-cua-l1': createGallery(
    'khoa-cua-l1',
    'Khóa cửa L1 bàn phím số màu đen',
  ),
  'khoa-cua-l2': createGallery('khoa-cua-l2', 'Khóa cửa L2 vân tay màu đen'),
  'khoa-cua-l3': createGallery(
    'khoa-cua-l3',
    'Khóa cửa L3 kết nối ứng dụng màu xám',
  ),
  'mesh-wifi-m1': createGallery(
    'mesh-wifi-m1',
    'Mesh Wi-Fi M1 bộ hai thiết bị màu trắng',
  ),
  'mesh-wifi-m2': createGallery(
    'mesh-wifi-m2',
    'Mesh Wi-Fi M2 bộ ba thiết bị màu trắng',
  ),
  'mesh-wifi-m3': createGallery(
    'mesh-wifi-m3',
    'Mesh Wi-Fi M3 Pro bộ ba thiết bị màu graphite',
  ),
} satisfies Record<string, ProductDemoImage[]>;

export function getProductDemoImages(slug: string): ProductDemoImage[] {
  return productDemoImages[slug as keyof typeof productDemoImages] ?? [];
}

export function getProductPrimaryDemoImage(
  slug: string,
): ProductDemoImage | null {
  return getProductDemoImages(slug)[0] ?? null;
}
