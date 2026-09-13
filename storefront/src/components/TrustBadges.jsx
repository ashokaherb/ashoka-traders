import { Leaf, Award, Truck, ShieldCheck } from "./icons";

/**
 * The four trust points shown directly under the hero. Like the hero itself this is
 * desktop/laptop-only (`hidden lg:block`) - remove the `hidden lg:block` below if you
 * later want these on mobile too.
 */
const BADGES = [
  { icon: Leaf, label: "100% Natural", sub: "No artificial additives" },
  { icon: Award, label: "Premium Quality", sub: "Sourced with care" },
  { icon: Truck, label: "Fast Delivery", sub: "Across India" },
  { icon: ShieldCheck, label: "Secure Payments", sub: "Safe & reliable" },
];

export default function TrustBadges() {
  return (
    <section className="hidden lg:block bg-white border-b border-cream-dark">
      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-4 gap-6">
        {BADGES.map(({ icon: Icon, label, sub }) => (
          <div key={label} className="flex items-center gap-3">
            <span className="shrink-0 w-11 h-11 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center">
              <Icon className="w-5 h-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-gray-800">{label}</span>
              <span className="block text-xs text-gray-500">{sub}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
