// Row of category buttons used on the Home page to filter the product grid.
export default function CategoryFilter({ categories, selected, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <button
        onClick={() => onSelect("")}
        className={`px-3 py-1.5 rounded-full text-sm border ${
          selected === ""
            ? "bg-brand-600 text-white border-brand-600"
            : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
        }`}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat._id}
          onClick={() => onSelect(cat._id)}
          className={`px-3 py-1.5 rounded-full text-sm border ${
            selected === cat._id
              ? "bg-brand-600 text-white border-brand-600"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
          }`}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
