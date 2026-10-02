import LegalPage, { Section, List, Tbd } from "../components/LegalPage";
import { LEGAL } from "../content/legalConfig";
import { useAppData } from "../context/AppDataContext";

export default function Privacy() {
  const { settings } = useAppData();
  const storeName = settings?.storeName || "Ashoka Traders";
  const email = settings?.supportEmail || "ashokaherb@gmail.com";

  return (
    <LegalPage
      title="Privacy Policy"
      description={`How ${storeName} collects, uses and protects your personal information.`}
      lastUpdated={LEGAL.lastUpdated}
    >
      <p>
        This policy explains what personal information {storeName}, operated by{" "}
        <Tbd value={LEGAL.legalEntity} />, collects when you use this website, why we collect it, and
        the choices you have. We collect only what we need to sell and deliver your order.
      </p>

      <Section heading="1. Information we collect">
        <List
          items={[
            "Account details: your name, email address and (optionally) phone number when you register.",
            "Order details: delivery address, phone number, the items ordered, the amount paid and the payment method.",
            "Communications: messages you send through the contact form, and your WhatsApp number if you opt in to updates.",
            "Technical data: basic logs such as IP address and browser type, kept to keep the site secure and to limit abuse such as repeated failed logins.",
          ]}
        />
        <p className="text-sm text-gray-600">
          We do not collect or store your card number, UPI PIN, CVV or net-banking credentials. Online
          payments are processed by Razorpay on their own secure systems.
        </p>
      </Section>

      <Section heading="2. Why we use it">
        <List
          items={[
            "To process, pack, deliver and invoice your order.",
            "To send order confirmations, delivery updates and your bill.",
            "To answer your questions and handle returns, replacements or refunds.",
            "To keep the records required by Indian tax and accounting law.",
            "To protect the site against fraud and abuse.",
            "To send offers and new-arrival updates on WhatsApp - only if you have explicitly opted in. You can opt out at any time from your profile page.",
          ]}
        />
      </Section>

      <Section heading="3. Who we share it with">
        <p>We share only what is necessary, and we never sell your data. Recipients are:</p>
        <List
          items={[
            "Razorpay, to process online payments.",
            "Our delivery partners, to deliver your order.",
            "Brevo, our email provider, to send order and account emails.",
            "Cloudinary, which hosts our product images (no customer data).",
            "Our WhatsApp message provider, if you have opted in.",
            "Government authorities, where disclosure is required by law.",
          ]}
        />
      </Section>

      <Section heading="4. How long we keep it">
        <p>
          Order and invoice records are kept for as long as Indian tax law requires. Account details
          are kept while your account is open. If you ask us to delete your account we remove your
          personal profile, but keep the minimum invoice information the law requires us to retain.
        </p>
      </Section>

      <Section heading="5. How we protect it">
        <List
          items={[
            "The whole site runs over HTTPS.",
            "Passwords are stored only as salted hashes - we cannot read them.",
            "Access to customer data is restricted to the shop's admin account.",
            "Payment details never reach our servers.",
          ]}
        />
      </Section>

      <Section heading="6. Cookies, local storage and analytics">
        <p>
          We use your browser's local storage to keep you logged in and to remember your cart and
          wishlist. Where website analytics is enabled, it is used only to count visits and understand
          which pages are popular, never to identify you personally.
        </p>
      </Section>

      <Section heading="7. Your choices">
        <List
          items={[
            "You can view and update your name, phone number and address from your profile page.",
            "You can turn WhatsApp updates on or off at any time.",
            "You can ask for a copy of your data, or ask us to correct or delete it, by emailing us.",
          ]}
        />
      </Section>

      <Section heading="8. Children">
        <p>
          This site is not intended for children under 18, and we do not knowingly collect their data.
        </p>
      </Section>

      <Section heading="9. Contact">
        <p>
          For any privacy question or request, email{" "}
          <a className="text-brand-700 underline" href={`mailto:${email}`}>
            {email}
          </a>
          . We respond to genuine requests as quickly as we can.
        </p>
      </Section>
    </LegalPage>
  );
}
