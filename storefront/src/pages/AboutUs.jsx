import { Link } from "react-router-dom";
import LegalPage, { Section, List, Tbd } from "../components/LegalPage";
import { LEGAL } from "../content/legalConfig";
import { useAppData } from "../context/AppDataContext";

export default function AboutUs() {
  const { settings } = useAppData();
  const storeName = settings?.storeName || "Ashoka Traders";
  const email = settings?.supportEmail || "ashokaherb@gmail.com";
  const phone = settings?.supportPhone || "+91 98972 05657";
  const address = settings?.storeAddress || LEGAL.businessAddress;

  return (
    <LegalPage
      title={`About ${storeName}`}
      description={`${storeName} - herbs, dry fruits and everyday essentials from Dehradun, now delivered to your door.`}
    >
      <p>
        {storeName} is a family-run shop in {address}, selling herbs, dry fruits, spices and everyday
        kitchen essentials. What began as a counter serving customers in Dehradun now also delivers
        across India, so you can order the same products online that regulars have bought from us
        over the counter for years.
      </p>

      <Section heading="What we sell">
        <List
          items={[
            "Dry fruits and nuts - almonds, cashews, figs, raisins, saffron and more.",
            "Ayurvedic herbs and powders, sourced whole and packed in small batches.",
            "Everyday grocery staples for the kitchen.",
          ]}
        />
        <p>
          We buy in small, frequent lots rather than holding large stock, so what reaches you is fresh.
          Each order is packed by hand and checked before it leaves the shop.
        </p>
      </Section>

      <Section heading="How we work">
        <List
          items={[
            "Honest weights: what is on the label is what goes in the packet.",
            "Fair prices: the same prices online as over the counter.",
            "Cash on Delivery or secure online payment, whichever suits you.",
            "A real person at the end of the phone when something needs sorting out.",
          ]}
        />
      </Section>

      <Section heading="The shop">
        <p>
          You are always welcome to visit us at {address}. Our trading name is {storeName}; the
          registered business is <Tbd value={LEGAL.legalEntity} />.
        </p>
      </Section>

      <Section heading="Talk to us">
        <p>
          Call{" "}
          <a className="text-brand-700 underline" href={`tel:${phone.replace(/\s/g, "")}`}>
            {phone}
          </a>
          , email{" "}
          <a className="text-brand-700 underline" href={`mailto:${email}`}>
            {email}
          </a>
          , or use our{" "}
          <Link className="text-brand-700 underline" to="/contact">
            contact page
          </Link>
          . For delivery questions see our{" "}
          <Link className="text-brand-700 underline" to="/shipping">
            Shipping Policy
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
