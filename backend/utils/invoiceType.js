// Which kind of GST document an order gets, based on the store's GST registration.
// Kept separate from the PDF code so the rule is easy to find and test.

const GST_SCHEMES = ["regular", "composition", "not_registered"];

// Wording mandated for a composition dealer's Bill of Supply (CGST Rules, rule 5(1)(g)).
const COMPOSITION_DISCLOSURE = "Composition taxable person, not eligible to collect tax on supplies";

/**
 * @param {{ gstScheme?: string, gstNumber?: string }} settings
 * @returns {"bill_of_supply" | "tax_invoice" | "receipt"}
 */
function resolveDocumentType(settings) {
  const hasGstin = Boolean((settings.gstNumber || "").trim());
  if (!hasGstin) return "receipt";
  if (settings.gstScheme === "composition") return "bill_of_supply";
  if (settings.gstScheme === "regular") return "tax_invoice";
  return "receipt";
}

module.exports = { GST_SCHEMES, COMPOSITION_DISCLOSURE, resolveDocumentType };
