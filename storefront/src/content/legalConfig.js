/**
 * Business facts used by the legal/policy pages.
 *
 * Anything we actually know lives here (or comes from admin Settings at runtime - see
 * each page's useAppData() call). Anything the client still has to confirm is wrapped in
 * CLIENT_TODO so it renders as a clearly marked placeholder instead of an invented fact.
 * Search the codebase for "CLIENT_TODO" to find everything still outstanding.
 */

/** Marks a value the client must supply. Rendered highlighted by <Tbd> in LegalPage.jsx. */
export const CLIENT_TODO = (label) => ({ __clientTodo: label });

export const isClientTodo = (value) => Boolean(value && value.__clientTodo);

// Known from the shop's existing configuration (Footer/Settings/invoice defaults).
export const LEGAL = {
  // Trading name. The registered legal entity (proprietorship/firm name) may differ.
  legalEntity: CLIENT_TODO("registered business/legal entity name"),
  // Jurisdiction for disputes - Dehradun is where the shop operates.
  jurisdiction: "Dehradun, Uttarakhand, India",
  // Where orders ship from / returns are received.
  businessAddress: "3 Dhamawala Bazaar, Dehradun, Uttarakhand",

  // Fulfilment details the client must confirm before launch.
  deliveryAreas: CLIENT_TODO("areas/states you deliver to"),
  dispatchTime: CLIENT_TODO("how long before an order is dispatched, e.g. 1-2 working days"),
  deliveryTime: CLIENT_TODO("delivery time after dispatch, e.g. 3-7 working days"),
  courierPartners: CLIENT_TODO("courier/delivery partners used"),
  refundProcessingDays: CLIENT_TODO("days to process a refund once approved, e.g. 5-7 working days"),

  // Already fixed by the project's own configuration (Settings > invoice terms).
  damageReportWindowHours: 48,

  lastUpdated: "3 October 2026",
};
