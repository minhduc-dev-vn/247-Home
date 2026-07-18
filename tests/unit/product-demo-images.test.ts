import { describe, expect, it } from 'vitest';

import {
  getProductDemoImages,
  getProductPrimaryDemoImage,
  productDemoImages,
} from '@/components/catalog/product-demo-images';

const demoProductSlugs = [
  'camera-ngoai-troi-c1',
  'camera-pin-c3',
  'camera-trong-nha-c2',
  'chuong-cua-d1',
  'chuong-cua-d2',
  'chuong-cua-d3',
  'khoa-cua-l1',
  'khoa-cua-l2',
  'khoa-cua-l3',
  'mesh-wifi-m1',
  'mesh-wifi-m2',
  'mesh-wifi-m3',
] as const;

describe('product demo image manifest', () => {
  it('provides one primary and three gallery images for every demo product', () => {
    expect(Object.keys(productDemoImages).sort()).toEqual(
      [...demoProductSlugs].sort(),
    );

    for (const slug of demoProductSlugs) {
      const images = getProductDemoImages(slug);
      expect(images).toHaveLength(4);
      expect(images[0]?.src).toBe(`/assets/images/products/${slug}.png`);
      expect(images.map((image) => image.src)).toEqual([
        `/assets/images/products/${slug}.png`,
        `/assets/images/products/${slug}_1.png`,
        `/assets/images/products/${slug}_2.png`,
        `/assets/images/products/${slug}_3.png`,
      ]);
      expect(images.every((image) => image.altText.length > 0)).toBe(true);
    }
  });

  it('does not invent images for products outside the demo manifest', () => {
    expect(getProductDemoImages('unknown-product')).toEqual([]);
    expect(getProductPrimaryDemoImage('unknown-product')).toBeNull();
  });
});
