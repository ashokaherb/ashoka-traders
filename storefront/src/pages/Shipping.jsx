import { Link } from "react-router-dom";
import LegalPage, { Section, List, Tbd } from "../components/LegalPage";
import { LEGAL } from "../content/legalConfig";
import { useAppData } from "../context/AppDataContext";

/**
 * Shipping Policy. Charges and the free-shipping threshold are read from the live store
 * settings (admin > Settings), so this page can never drift from what checkout charges.
 */
export default function Shipping() {
  const { settings } = useAppData();
  const storeName = settings?.storeName || "Aashoka Traders";
  const email = settings?.supportEmail || "ashokaherb@gmail.com";
  const phone = settings?.supportPhone || "+91 98972 05657";
  const flatFee = settings?.flatShippingFee;
  const freeAbove = settings?.freeShippingThreshold;
  const minOrder = settings?.minimumOrderValue;

  return (
    <LegalPage
      title="Shipping Policy"
      description={`Delivery charges, timelines and areas for orders from ${storeName}.`}
      lastUpdated={LEGAL.lastUpdated}
    >
      <p>
        This policy explains what delivery costs, how long it takes and what happens if something
        goes wrong. Orders are packed and dispatched from{" "}
        {settings?.storeAddress || LEGAL.businessAddress}.
      </p>

      <Section heading="1. Delivery charges">
        {flatFee === undefined ? (
          <p>Delivery charges are shown on the checkout page before you confirm your order.</p>
        ) : (
          <List
            items={[
              flatFee > 0
                ? `A flat delivery charge of ₹${flatFee} applies to orders below the free-delivery threshold.`
                : "Delivery is free on all orders.",
              freeAbove > 0
                ? `Delivery is free on orders with a cart value of ₹${freeAbove} or more (calculated before any coupon discount).`
                : "No minimum cart value is needed for free delivery.",
              "The exact charge for your order is always shown in the order summary at checkout, before payment.",
              minOrder > 0 ? `Orders must be at least ₹${minOrder} to check out.` : null,
            ].filter(Boolean)}
          />
        )}
      </Section>

      <Section heading="2. Where we deliver">
        <p>
          We deliver to <Tbd value={LEGAL.deliveryAreas} />. If your pincode is outside our delivery
          area, or a courier cannot reach it, we will contact you and refund any amount already paid.
        </p>
      </Section>

      <Section heading="3. Order processing and delivery time">
        <List
          items={[
            <>
              Orders are packed and dispatched within <Tbd value={LEGAL.dispatchTime} /> of being
              confirmed. Orders placed on a Sunday or a public holiday are processed on the next
              working day.
            </>,
            <>
              Once dispatched, delivery usually takes <Tbd value={LEGAL.deliveryTime} />, depending on
              your location.
            </>,
            <>
              We deliver through <Tbd value={LEGAL.courierPartners} />. Where a tracking number is
              available, it is shown against your order in{" "}
              <Link className="text-brand-700 underline" to="/my-orders">
                My Orders
              </Link>
              .
            </>,
          ]}
        />
      </Section>

      <Section heading="4. Delays">
        <p>
          Occasionally a delivery takes longer than expected because of weather, local disruption,
          festival-season volumes or a courier issue. These are outside our control, but we will keep
          you updated and help you chase the courier. If a parcel has not arrived well beyond the
          expected window, contact us and we will replace it or refund you.
        </p>
      </Section>

      <Section heading="5. Address and failed deliveries">
        <List
          items={[
            "Please double-check your address, pincode and phone number before placing the order - couriers call before delivery.",
            "Tell us immediately if you spot a mistake. We can change the address only before dispatch.",
            "If a delivery fails because nobody was available or the address was wrong or incomplete, the courier normally tries again. If it is returned to us, we will contact you to arrange a re-send; a second delivery charge may apply.",
            "Refused Cash on Delivery parcels may mean we ask for prepayment on future orders.",
          ]}
        />
      </Section>

      <Section heading="6. Damaged or missing parcels">
        <p>
          Please check your parcel when it arrives. If the packaging is damaged, an item is missing or
          the contents are spoiled, tell us within {LEGAL.damageReportWindowHours} hours with
          photographs. Our{" "}
          <Link className="text-brand-700 underline" to="/returns">
            Cancellation &amp; Returns Policy
          </Link>{" "}
          explains what happens next.
        </p>
      </Section>

      <Section heading="7. Help with a delivery">
        <p>
          Email{" "}
          <a className="text-brand-700 underline" href={`mailto:${email}`}>
            {email}
          </a>{" "}
          or call{" "}
          <a className="text-brand-700 underline" href={`tel:${phone.replace(/\s/g, "")}`}>
            {phone}
          </a>{" "}
          with your order number and we will look into it.
        </p>
      </Section>
    </LegalPage>
  );
}
