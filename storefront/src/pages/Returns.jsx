import { Link } from "react-router-dom";

// Placeholder content - the client's actual cancellation/returns policy will replace
// this later. No self-service cancel button by design - see ContactUs.jsx.
export default function Returns() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Cancellation &amp; Returns</h1>
        <p className="text-gray-600 leading-relaxed mb-4">
          This is a placeholder policy page. Replace this text with your shop's actual
          rules on order cancellation, returns, and exchanges.
        </p>
        <p className="text-gray-600 leading-relaxed bg-brand-50 text-brand-800 rounded p-4">
          Need to cancel an order or have an issue with one you've already placed?{" "}
          <Link to="/contact" className="underline font-medium">
            Contact us
          </Link>{" "}
          and we'll sort it out.
        </p>
      </div>
    </div>
  );
}
