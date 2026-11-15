import type { Metadata } from 'next';
import { LegalLayout } from '../../components/LegalLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy — Layo',
  description: 'How Layo collects, uses, and protects your information.',
};

const LAST_UPDATED = '15 November 2026';

export default function PrivacyPolicyPage() {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <p>
        This Privacy Policy explains how Layo (&quot;Layo&quot;, &quot;we&quot;, &quot;us&quot;) collects, uses, shares, and
        protects your personal data when you use the Layo mobile app, the Layo website, and any
        related services (together, the &quot;Service&quot;). It applies to travellers, business partners,
        and anyone else who interacts with the Service.
      </p>
      <p>
        <strong>
          [Placeholder — replace before publishing: Layo&apos;s registered legal entity name, company
          number (if incorporated), and registered address. Everything below assumes a single
          controller operating under the Layo brand; update this policy if that changes.]
        </strong>
      </p>

      <h2>1. Information we collect</h2>
      <h3>Account and profile information</h3>
      <p>
        When you register, we collect your email address and the password you set (stored by our
        authentication provider in hashed form — we never see or store your plaintext password).
        You may optionally add a phone number, which we store but do not verify.
      </p>
      <p>
        To use Discover and connect with other travellers, you complete a profile: display name,
        date of birth (used only to confirm you are 18 or older and never shown publicly as a
        full date), a short bio, a profile photo, interests, languages, and a home airport.
      </p>
      <h3>Journeys and flight information</h3>
      <p>
        When you add a flight or journey, we store the flight number, departure/arrival airports,
        scheduled times, and any layover details you provide. Some of this is looked up
        automatically from a third-party flight-data provider (see Section 4) to help us match you
        with other travellers on the same route — this lookup data can be delayed or inaccurate,
        and is never a substitute for your airline&apos;s own information.
      </p>
      <h3>Messages and content</h3>
      <p>
        We store the messages you send through direct chats and airport group chats, including any
        photos you share, so conversations can be delivered, synced across your devices, and
        reviewed if you or someone else reports a message under our safety process (Section 5).
      </p>
      <h3>Reports, blocks, and safety data</h3>
      <p>
        If you report or block another user, we keep a record of the report (who reported whom,
        the reason given, and any message involved) so our moderation team can review it and, where
        the rules in our Terms of Service are broken, take action — including suspending or banning
        an account. We also keep a minimal record (the email address associated with a banned
        account) to help prevent a banned person from simply creating a new account.
      </p>
      <h3>Device and usage information</h3>
      <p>
        We collect a push-notification token for your device so we can deliver chat and connection
        alerts, basic request logs (timestamps, IP address, endpoint called) for security and
        reliability, and standard crash/error information if the app fails unexpectedly.
      </p>
      <h3>Business and deals information</h3>
      <p>
        If you register a business on Layo, we collect your business name, category, airport,
        contact email, and the deals or promotions you submit for admin review.
      </p>

      <h2>2. How we use your information</h2>
      <ul>
        <li>To create and maintain your account, and verify you meet our minimum age of 18.</li>
        <li>To match you with other travellers on the same flight, airport, or layover.</li>
        <li>To deliver messages, notifications, and connection requests.</li>
        <li>To review reports, enforce our Terms of Service, and keep the Service safe.</li>
        <li>To respond to support requests sent to our support address.</li>
        <li>To maintain the security, integrity, and reliability of the Service.</li>
        <li>To comply with legal obligations we&apos;re subject to.</li>
      </ul>
      <p>
        We do not sell your personal data, and we do not use your messages or profile information
        to serve third-party advertising.
      </p>

      <h2>3. Legal basis for processing (UK/EU users)</h2>
      <p>
        Where UK or EU data protection law applies, we rely on: performance of a contract (running
        the matching, messaging, and deals features you&apos;ve signed up for), legitimate interests
        (keeping the Service secure and free of abuse), consent (where we ask for it specifically,
        such as marketing emails, if we ever introduce them), and legal obligation (where the law
        requires us to keep or disclose information).
      </p>

      <h2>4. Who we share information with</h2>
      <p>
        We share data with the service providers who help us run Layo, under contracts that limit
        them to using it only to provide that service to us:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — authentication and our primary database.
        </li>
        <li>
          <strong>Railway</strong> — application hosting for our backend and admin systems.
        </li>
        <li>
          <strong>AeroDataBox (RapidAPI)</strong> — flight schedule lookups used to power journey
          matching.
        </li>
        <li>
          <strong>Resend</strong> — delivery of account emails (verification, password reset).
        </li>
        <li>
          <strong>Expo, Apple, and Google</strong> — delivery of push notifications to your device.
        </li>
      </ul>
      <p>
        We may also disclose information where required by law, to protect the rights, safety, or
        property of Layo or our users, or in connection with a merger, acquisition, or sale of
        assets (with notice to you where required).
      </p>

      <h2>5. Safety and moderation</h2>
      <p>
        Because Layo connects you with people you haven&apos;t met before, we operate a reporting
        system: anyone can report a user, message, or conversation, and our admin team reviews
        reports and can warn, suspend, or permanently ban an account. We retain report records even
        after a report is closed, so we can recognise repeat issues.
      </p>

      <h2>6. Data retention</h2>
      <p>
        We keep your account and profile data for as long as your account is active, and for a
        reasonable period afterward in case you return, to resolve disputes, and to meet legal
        obligations. Report and audit records relating to safety actions are kept longer, since they
        may be needed to show why an account was banned or to prevent ban evasion. You can request
        deletion at any time — see Section 8.
      </p>

      <h2>7. International data transfers</h2>
      <p>
        Our service providers may process data outside your home country, including in the United
        States. Where that involves transferring personal data out of the UK or EEA, we rely on
        appropriate safeguards such as Standard Contractual Clauses or an equivalent mechanism
        recognised by UK/EU data protection law.
      </p>

      <h2>8. Your rights</h2>
      <p>Depending on where you live, you may have the right to:</p>
      <ul>
        <li>Access the personal data we hold about you.</li>
        <li>Correct inaccurate or incomplete data.</li>
        <li>Request deletion of your account and associated data.</li>
        <li>Object to, or ask us to restrict, certain processing.</li>
        <li>Receive a copy of your data in a portable format.</li>
        <li>Withdraw consent at any time, where we rely on consent.</li>
      </ul>
      <p>
        To exercise any of these rights, email us at{' '}
        <a href="mailto:support@layo.uk">support@layo.uk</a>. If you&apos;re in the UK and unhappy
        with our response, you can complain to the Information Commissioner&apos;s Office (ICO) at{' '}
        <a href="https://ico.org.uk" target="_blank" rel="noreferrer">
          ico.org.uk
        </a>
        .
      </p>

      <h2>9. Children&apos;s privacy</h2>
      <p>
        Layo is for adults only. You must be at least 18 years old to create an account, and we ask
        for your date of birth specifically to enforce this. We do not knowingly collect personal
        data from anyone under 18; if we learn that we have, we&apos;ll delete it.
      </p>

      <h2>10. Security</h2>
      <p>
        We use industry-standard safeguards — encrypted connections, hashed passwords, and access
        controls restricting who on our team can view your data — but no system is completely
        secure, and we can&apos;t guarantee absolute security.
      </p>

      <h2>11. Changes to this policy</h2>
      <p>
        We may update this policy as the Service changes. If we make material changes, we&apos;ll
        notify you in the app or by email before they take effect. The &quot;Last updated&quot; date
        above always reflects the current version.
      </p>

      <h2>12. Contact us</h2>
      <p>
        Questions about this policy or your data? Email <a href="mailto:support@layo.uk">support@layo.uk</a>.
      </p>
    </LegalLayout>
  );
}
