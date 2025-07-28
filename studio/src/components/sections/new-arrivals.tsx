
'use client';

import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/api';
import type { Product } from '@/lib/products';
import ProductCard from '@/components/product-card';


export default function NewArrivals() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch latest products from backend
    apiRequest('/sell/listed-public')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.products)) {
          // Sort by listing date (newest first) and get latest 4
          const sortedProducts = data.products.sort((a: any, b: any) => {
            const dateA = new Date(a.listed_product?.listed_at || a.created_at || a.createdAt || 0);
            const dateB = new Date(b.listed_product?.listed_at || b.created_at || b.createdAt || 0);
            return dateB.getTime() - dateA.getTime();
          });

          const mapped = sortedProducts.slice(0, 4).map((p: any) => {
            const lp = p.listed_product || {};
            console.log('New Arrivals - Product images:', p.images); // Debug log
            return {
              id: p._id,
              name: lp.title || p.article,
              brand: p.brand,
              category: lp.category || '',
              mainCategory: lp.mainCategory || p.mainCategory || 'Unisex',
              price: `₹${lp.price || ''}`,
              originalPrice: lp.mrp ? `₹${lp.mrp}` : '',
              condition: p.ai_analysis?.image_analysis?.quality || '',
              images: (p.images || []).map((img: any) => {
                console.log('New Arrivals - Raw image data:', img); // Debug log
                if (typeof img === 'string') {
                  // Handle legacy string URLs
                  const url = img.startsWith('http') ? img : `${process.env.NEXT_PUBLIC_API_URL || 'https://retag-1n7d.onrender.com'}/${img.replace(/^uploads\//, 'uploads/')}`;
                  console.log('New Arrivals - String URL:', url); // Debug log
                  return url;
                } else if (img && img.url) {
                  // Handle Cloudinary objects - use URL directly
                  console.log('New Arrivals - Cloudinary URL:', img.url); // Debug log
                  return img.url;
                }
                console.log('New Arrivals - No valid image data'); // Debug log
                return '';
              }).filter(Boolean),
              imageHints: lp.tags || [],
              sizes: p.size ? [p.size] : [],
            };
          });
          setProducts(mapped as Product[]);
        }
        setLoading(false);
      })
      .catch(() => {
        setProducts([]);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <section className="pb-16 sm:pb-24 bg-card">
        <div className="container w-full max-w-7xl mx-auto px-4">
          <div className="text-left mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-white">New Arrivals</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="aspect-[4/5] bg-gray-200 animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="pb-16 sm:pb-24 bg-card">
        <div className="container w-full max-w-7xl mx-auto px-4">
          <div className="text-left mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-white">New Arrivals</h2>
          </div>
          <div className="text-center py-12">
            <p className="text-gray-400">No products available yet. Be the first to sell!</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="pb-16 sm:pb-24 bg-card">
      <div className="container w-full max-w-7xl mx-auto px-4">
        <div className="text-left mb-6">
          <h2 className="text-2xl font-bold tracking-tight text-white">New Arrivals</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </section>
  );
}
