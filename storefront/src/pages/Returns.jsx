import { Link } from "react-router-dom";
import LegalPage, { Section, List, Tbd } from "../components/LegalPage";
import { LEGAL } from "../content/legalConfig";
import { useAppData } from "../context/AppDataContext";

export default function Returns() {
  const { settings } = useAppData();
  const storeName = settings?.storeName || "Ashoka Traders";
  const email = settings?.supportEmail || "ashokaherb@gmail.com";
  const phone = settings?.supportPhone || "+91 98972 05657";
  const hours = LEGAL.damageReportWindowHours;

  return (
    <LegalPage
      title="Cancellation & Returns Policy"
      description={`How to cancel an order, return an item or claim a refund at ${storeName}.`}
      lastUpdated={LEGAL.lastUpdated}
    >
      <p>
        We want you to be happy with what you receive. Because we sell food items - herbs, dry fruits
        and groceries - this policy balances your rights with the hygiene and safety rules that apply
        to edible goods.
      </p>

      <Section heading="1. Cancelling an order">
        <List
          items={[
            "You can cancel any order free of charge before it has been dispatched. Contact us as quickly as possible with your order number.",
            "Once an order has been handed to the delivery partner it can no longer be cancelled; please follow the returns process below instead.",
            "If you paid online and we cancel or cannot fulfil your order, the full amount is refunded to the original payment method.",
          ]}
        />
        <p className="text-sm text-gray-600">
          There is no self-service cancel button: message us and we will confirm the cancellation by
          email, so there is always a written record.
        </p>
      </Section>

      <Section heading="2. What we accept back">
        <p>Please tell us within {hours} hours of delivery if your order arrives:</p>
        <List
          items={[
            "damaged, leaking or with broken packaging;",
            "incorrect - an item you did not order, or the wrong weight or variant;",
            "incomplete - something listed on the bill is missing;",
            "spoiled, infested or past its use-by date on arrival.",
          ]}
        />
        <p>
          Keep the item, its original packaging and the bill until the claim is settled, and send us
          photographs where you can. They let us settle most claims the same day.
        </p>
      </Section>

      <Section heading="3. What we cannot accept back">
        <p>
          For food-safety reasons we cannot take back edible goods once opened or used, unless they
          were faulty when they arrived. We also cannot accept:
        </p>
        <List
          items={[
            "items reported after the " + hours + "-hour window, except for a genuine hidden defect;",
            "items returned without their original packaging or bill;",
            "products damaged by storage after delivery, for example by heat or moisture;",
            "normal variation in colour, size, aroma or appearance of a natural product.",
          ]}
        />
      </Section>

      <Section heading="4. How to raise a claim">
        <List
          items={[
            <>
              Message us on WhatsApp or call{" "}
              <a className="text-brand-700 underline" href={`tel:${phone.replace(/\s/g, "")}`}>
                {phone}
              </a>
              , or email{" "}
              <a className="text-brand-700 underline" href={`mailto:${email}`}>
                {email}
              </a>
              .
            </>,
            "Give your order number (shown on your bill and in My Orders), what is wrong, and photographs if the item is damaged or incorrect.",
            "We will confirm within one working day whether we are replacing the item, refunding it, or collecting it first.",
          ]}
        />
      </Section>

      <Section heading="5. Replacements and refunds">
        <List
          items={[
            "Where a claim is accepted we will normally send a replacement, or refund you if a replacement is not available.",
            <>
              Approved refunds are processed within{" "}
              <Tbd value={LEGAL.refundProcessingDays} /> of approval.
            </>,
            "Online payments are refunded to the original payment method; the bank or UPI provider may take a few extra days to show the credit.",
            "Cash on Delivery orders are refunded by bank transfer or UPI to an account in the name of the person who placed the order.",
            "Delivery charges are refunded in full when the fault was ours.",
          ]}
        />
      </Section>

      <Section heading="6. Orders that fail after payment">
        <p>
          Very occasionally an item sells out between your payment and our packing. If that happens
          the order is cancelled automatically, it appears as Cancelled in{" "}
          <Link className="text-brand-700 underline" to="/my-orders">
            My Orders
          </Link>
          , and we refund the full amount to your original payment method without you having to ask.
        </p>
      </Section>

      <Section heading="7. Contact">
        <p>
          For anything to do with a cancellation, return or refund, contact us at{" "}
          <a className="text-brand-700 underline" href={`mailto:${email}`}>
            {email}
          </a>{" "}
          or through our{" "}
          <Link className="text-brand-700 underline" to="/contact">
            contact page
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
