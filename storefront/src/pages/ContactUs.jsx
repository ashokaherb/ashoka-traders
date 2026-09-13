import { useState } from "react";
import api from "../api/axios";

// This page is also linked from "My Orders" and the Returns page for customers who
// need to cancel an order or report an issue. The form at the bottom alerts the
// admin (email + WhatsApp) immediately.
// EDIT ME: same real details as components/Footer.jsx - keep the two in sync.
export default function ContactUs() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [status, setStatus] = useState(""); // "", "sending", "sent", "error"

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("sending");
    try {
      await api.post("/contact", form);
      setStatus("sent");
      setForm({ name: "", email: "", phone: "", message: "" });
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Contact Us</h1>
        <p className="text-gray-600 leading-relaxed mb-6">
          Have a question, need to cancel an order, or ran into an issue? Reach out to
          us any of these ways:
        </p>

        <ul className="space-y-3 text-gray-700 mb-8">
          <li>
            <span className="font-medium">Phone:</span>{" "}
            <a href="tel:+919897205657" className="text-brand-700 underline">
              +91 98972 05657
            </a>
          </li>
          <li>
            <span className="font-medium">Email:</span>{" "}
            <a href="mailto:ashokaherb@gmail.com" className="text-brand-700 underline">
              ashokaherb@gmail.com
            </a>
          </li>
          <li>
            <span className="font-medium">WhatsApp:</span>{" "}
            <a
              href="https://wa.me/919897205657"
              target="_blank"
              rel="noreferrer"
              className="text-brand-700 underline"
            >
              Chat with us
            </a>
          </li>
          <li>
            <span className="font-medium">Address:</span> Ashoka Traders - Herbs &amp; Dry
            Fruits, 3 Dhamawala Bazaar, Dehradun
          </li>
        </ul>

        <h2 className="text-lg font-bold text-gray-800 mb-3">Or send us a message</h2>

        {status === "sent" && (
          <p className="mb-4 text-sm text-brand-700 bg-brand-50 p-2 rounded">
            Thanks! We'll get back to you soon.
          </p>
        )}
        {status === "error" && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">
            Something went wrong - please try again, or reach us directly using the
            details above.
          </p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-md">
          <input
            name="name"
            placeholder="Your name"
            value={form.name}
            onChange={handleChange}
            required
            className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            type="email"
            name="email"
            placeholder="Your email"
            value={form.email}
            onChange={handleChange}
            required
            className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <input
            name="phone"
            placeholder="Phone (optional)"
            value={form.phone}
            onChange={handleChange}
            className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <textarea
            name="message"
            placeholder="How can we help?"
            value={form.message}
            onChange={handleChange}
            required
            rows={4}
            className="border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={status === "sending"}
            className="bg-brand-600 text-white rounded py-2 hover:bg-brand-700 disabled:opacity-50"
          >
            {status === "sending" ? "Sending..." : "Send Message"}
          </button>
        </form>
      </div>
    </div>
  );
}
