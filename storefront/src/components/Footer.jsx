import { Link } from "react-router-dom";
import instagramIcon from "../assets/icons/instagram.png";
import phoneIcon from "../assets/icons/phone.png";
import emailIcon from "../assets/icons/email.png";
import addressIcon from "../assets/icons/address.png";
import visaIcon from "../assets/icons/visa.png";
import mastercardIcon from "../assets/icons/mastercard.png";
import codIcon from "../assets/icons/cod.png";

// EDIT ME: real contact details + social links. Swap INSTAGRAM_URL for the shop's
// actual profile once it exists (currently just "#").
const PHONE = "+91 98972 05657";
const EMAIL = "ashokaherb@gmail.com";
const ADDRESS = "Ashoka Traders - Herbs & Dry Fruits, 3 Dhamawala Bazaar, Dehradun";
const INSTAGRAM_URL = "#";

// Shown on every storefront page (mounted once in App.jsx, outside <Routes>).
export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-12">
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8 text-sm">
        <div>
          <h3 className="text-white font-semibold mb-3">About</h3>
          <ul className="space-y-2">
            <li>
              <Link to="/about" className="hover:text-white">
                About Us
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-white">
                Contact Us
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-white font-semibold mb-3">Policies</h3>
          <ul className="space-y-2">
            <li>
              <Link to="/terms" className="hover:text-white">
                Terms &amp; Conditions
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-white">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link to="/returns" className="hover:text-white">
                Cancellation &amp; Returns
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-white font-semibold mb-3">Contact Us</h3>
          <ul className="space-y-3">
            <li className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 mt-0.5">
                <img src={phoneIcon} alt="" className="w-3.5 h-3.5" />
              </span>
              <a href={`tel:${PHONE.replace(/\s/g, "")}`} className="hover:text-white pt-0.5">
                {PHONE}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 mt-0.5">
                <img src={emailIcon} alt="" className="w-3.5 h-3.5" />
              </span>
              <a href={`mailto:${EMAIL}`} className="hover:text-white break-all pt-0.5">
                {EMAIL}
              </a>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0 mt-0.5">
                <img src={addressIcon} alt="" className="w-3.5 h-3.5" />
              </span>
              <span className="pt-0.5">{ADDRESS}</span>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-white font-semibold mb-3">Follow Us</h3>
          {/* Only Instagram for now - swap INSTAGRAM_URL above for the real profile,
              and add more icons here the same way once other profiles exist. */}
          <div className="flex gap-3">
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" aria-label="Instagram">
              <img src={instagramIcon} alt="Instagram" className="w-7 h-7 rounded" />
            </a>
          </div>
        </div>

        <div>
          <h3 className="text-white font-semibold mb-3">We Accept</h3>
          <div className="flex flex-wrap gap-2">
            <img src={visaIcon} alt="Visa" className="w-9 h-9 bg-white rounded p-1" />
            <img src={mastercardIcon} alt="Mastercard" className="w-9 h-9 bg-white rounded p-1" />
            <img src={codIcon} alt="Cash on Delivery" className="w-9 h-9 bg-white rounded p-1" />
          </div>
        </div>
      </div>

      <div className="border-t border-gray-800 text-center text-xs py-4 text-gray-500">
        &copy; {new Date().getFullYear()} Ashoka Traders. All rights reserved.
      </div>
    </footer>
  );
}
