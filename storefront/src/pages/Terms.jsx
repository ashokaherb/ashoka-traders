import LegalPage, { Section, List, Tbd } from "../components/LegalPage";
import { LEGAL } from "../content/legalConfig";
import { useAppData } from "../context/AppDataContext";

export default function Terms() {
  const { settings } = useAppData();
  const storeName = settings?.storeName || "Aashoka Traders";
  const email = settings?.supportEmail || "ashokaherb@gmail.com";
  const phone = settings?.supportPhone || "+91 98972 05657";

  return (
    <LegalPage
      title="Terms & Conditions"
      description={`The terms that apply when you browse or buy from ${storeName}.`}
      lastUpdated={LEGAL.lastUpdated}
    >
      <p>
        These Terms &amp; Conditions govern your use of this website and any order you place on it.
        The site is operated by <Tbd value={LEGAL.legalEntity} />, trading as {storeName}, from{" "}
        {settings?.storeAddress || LEGAL.businessAddress}. By placing an order you accept these terms.
      </p>

      <Section heading="1. Using this website">
        <List
          items={[
            "You must be at least 18 years old, or have the consent of a parent or guardian, to place an order.",
            "You agree to give accurate contact and delivery details. We are not responsible for a delivery that fails because the address or phone number given was wrong or incomplete.",
            "You are responsible for keeping your account password confidential and for activity under your account.",
            "You may not use this site to attempt fraud, to interfere with its security, or to copy its content for commercial use without permission.",
          ]}
        />
      </Section>

      <Section heading="2. Products, descriptions and images">
        <List
          items={[
            "We sell herbs, dry fruits, groceries and related products for ordinary household use. They are food items, not medicines, and nothing on this site is medical advice or a claim to treat any condition.",
            "Product photographs are for illustration. Natural products vary in colour, size and appearance between batches.",
            "Weights shown are packed weights. Minor variation within normal tolerances can occur.",
            "Please read the label and check for allergens before use. If you have a medical condition or are pregnant, consult a qualified practitioner before using herbal products.",
          ]}
        />
      </Section>

      <Section heading="3. Prices and payment">
        <List
          items={[
            "All prices are shown in Indian Rupees and include applicable taxes unless the bill states otherwise.",
            "Shipping charges, discounts and the final payable amount are shown at checkout before you confirm your order.",
            "We accept Cash on Delivery and online payment through Razorpay. Online payments are handled entirely by Razorpay; we never see or store your full card, UPI or bank details.",
            "Prices and offers can change at any time before an order is placed, and coupon codes may be withdrawn or limited in number.",
          ]}
        />
      </Section>

      <Section heading="4. Pricing or stock errors">
        <p>
          Despite our care, an item may occasionally be listed at an incorrect price, or may sell out
          between your order and our packing. Your order is an offer to buy; a contract is formed when
          we confirm dispatch. If an error or a stock shortage affects your order we will contact you
          and either correct it with your agreement or cancel the affected items and refund you in
          full. If you have already paid online for an item we cannot supply, the amount is refunded
          to the original payment method.
        </p>
      </Section>

      <Section heading="5. Orders and cancellation">
        <p>
          We may refuse or cancel an order where we reasonably suspect fraud, abuse of a promotion,
          resale of goods bought at retail prices, or where delivery to your location is not possible.
          Your rights to cancel or return are set out in our Cancellation &amp; Returns Policy, which
          forms part of these terms.
        </p>
      </Section>

      <Section heading="6. Liability">
        <p>
          We are responsible for supplying goods that match their description and are of satisfactory
          quality. To the extent permitted by law, our total liability for any order is limited to the
          amount you paid for that order. We are not liable for indirect or consequential loss, or for
          delays caused by events outside our reasonable control such as transport disruption,
          strikes, extreme weather or courier failure.
        </p>
      </Section>

      <Section heading="7. Intellectual property">
        <p>
          The content of this site, including text, product photographs, the {storeName} name and
          logo, belongs to us or our suppliers and may not be reproduced without written permission.
        </p>
      </Section>

      <Section heading="8. Governing law">
        <p>
          These terms are governed by the laws of India. Any dispute is subject to the exclusive
          jurisdiction of the courts at {LEGAL.jurisdiction}.
        </p>
      </Section>

      <Section heading="9. Contact">
        <p>
          Questions about these terms? Email{" "}
          <a className="text-brand-700 underline" href={`mailto:${email}`}>
            {email}
          </a>{" "}
          or call{" "}
          <a className="text-brand-700 underline" href={`tel:${phone.replace(/\s/g, "")}`}>
            {phone}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
