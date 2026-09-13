import { useEffect, useState } from "react";
import api from "../api/axios";
import ProductCard from "./ProductCard";

// "You may also like" row shown on the product detail page.
export default function RelatedProducts({ productId }) {
  const [related, setRelated] = useState([]);

  useEffect(() => {
    api
      .get(`/products/${productId}/related`)
      .then((res) => setRelated(res.data))
      .catch(() => {});
  }, [productId]);

  if (related.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-lg font-bold text-gray-800 mb-3">You may also like</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {related.map((product) => (
          <ProductCard key={product._id} product={product} />
        ))}
      </div>
    </div>
  );
}
