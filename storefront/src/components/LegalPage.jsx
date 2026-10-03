import Seo from "./Seo";
import { isClientTodo } from "../content/legalConfig";

/**
 * Shared layout for the policy pages (Terms, Privacy, Returns, Shipping, About).
 * Handles the page shell, SEO tags and the "last updated" line so each page only
 * has to supply its own content.
 */
export default function LegalPage({ title, description, lastUpdated, children }) {
  return (
    <div className="bg-cream min-h-screen">
      <Seo title={`${title} | Aashoka Traders`} description={description} type="article" />

      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-10">
        <div className="bg-white rounded-lg shadow-sm p-5 sm:p-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-brand-700 tracking-tight">{title}</h1>
          {lastUpdated && <p className="text-xs text-gray-400 mt-1">Last updated: {lastUpdated}</p>}
          <div className="mt-6 flex flex-col gap-6 text-[15px] leading-relaxed text-gray-700 break-words">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** One titled section of a policy page. */
export function Section({ heading, children }) {
  return (
    <section>
      <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2">{heading}</h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

/** A plain bulleted list. */
export function List({ items }) {
  return (
    <ul className="list-disc pl-5 flex flex-col gap-1.5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

/**
 * Renders a value the client still has to supply as a visible, unmissable placeholder -
 * so nobody mistakes it for a real policy statement. Pass a plain value and it renders
 * normally, so pages can use <Tbd value={...} /> for both known and unknown facts.
 */
export function Tbd({ value }) {
  if (!isClientTodo(value)) return <>{value}</>;
  return (
    <mark className="bg-amber-100 text-amber-900 font-medium px-1 rounded">
      [TO BE CONFIRMED: {value.__clientTodo}]
    </mark>
  );
}
