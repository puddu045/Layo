import type { Metadata } from 'next';
import { LegalLayout } from '../../components/LegalLayout';

export const metadata: Metadata = {
  title: 'Terms of Service — Layo',
  description: 'The terms that govern your use of Layo.',
};

const LAST_UPDATED = '15 November 2026';

export default function TermsOfServicePage() {
  return (
    <LegalLayout title="Terms of Service" lastUpdated={LAST_UPDATED}>
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of the Layo mobile app, website,
        and related services (together, the &quot;Service&quot;), operated by Layo
        (&quot;Layo&quot;, &quot;we&quot;, &quot;us&quot;). By creating an account or otherwise using
        the Service, you agree to these Terms. If you don&apos;t agree, don&apos;t use the Service.
      </p>
      <p>
        <strong>
          [Placeholder — replace before publishing: Layo&apos;s registered legal entity name, company
          number (if incorporated), registered address, and the governing law/jurisdiction you
          want these Terms to use (Section 13 currently assumes England and Wales because of the
          layo.uk domain — confirm or change this, ideally with a lawyer).]
        </strong>
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 18 years old to use Layo. By creating an account, you confirm that you
        are 18 or older and that all information you provide is accurate.
      </p>

      <h2>2. Your account</h2>
      <p>
        You&apos;re responsible for keeping your login credentials secure and for everything that
        happens under your account. Tell us immediately at{' '}
        <a href="mailto:support@layo.uk">support@layo.uk</a> if you suspect unauthorised access.
      </p>

      <h2>3. What Layo is for</h2>
      <p>
        Layo helps travellers find and connect with other people on the same flight, at the same
        departure airport, or during a layover, and to chat, meet, and discover local businesses
        and deals near participating airports. Layo is a platform for making those connections —
        we are not a party to, and take no responsibility for, what happens when users meet or
        interact, on or off the Service.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to, and not to help anyone else to:</p>
      <ul>
        <li>Harass, threaten, stalk, or abuse another user.</li>
        <li>Impersonate any person or misrepresent your identity, age, or affiliation.</li>
        <li>Post or send unlawful, obscene, hateful, or sexually exploitative content.</li>
        <li>Solicit money, commercial services, or sexual services from other users.</li>
        <li>Send spam, unsolicited advertising, or bulk/automated messages.</li>
        <li>Scrape, reverse-engineer, or interfere with the Service&apos;s normal operation.</li>
        <li>Use the Service for any illegal purpose, or to endanger anyone&apos;s safety.</li>
      </ul>
      <p>
        We may remove content, and warn, suspend, or permanently ban any account, at our discretion,
        for violating these Terms — see Section 6.
      </p>

      <h2>5. Your content</h2>
      <p>
        You keep ownership of the messages, photos, and other content you submit to Layo
        (&quot;your content&quot;). By submitting it, you grant Layo a worldwide, non-exclusive,
        royalty-free licence to host, store, transmit, and display your content solely to operate
        and improve the Service — for example, delivering your messages to the people you&apos;re
        chatting with. You&apos;re solely responsible for your content and for having the right to
        share it.
      </p>

      <h2>6. Reporting, moderation, and account actions</h2>
      <p>
        Any user can report another user, a message, or a conversation. Our team reviews reports
        and may warn, suspend, or permanently ban an account found to have broken these Terms. We
        also maintain a record that lets us recognise and block attempts to re-register after a ban
        using the same email address. We may take these actions without prior notice where we
        believe it&apos;s necessary to protect the Service or other users.
      </p>

      <h2>7. Flight and schedule information</h2>
      <p>
        Flight numbers, times, and schedules shown in Layo may come from third-party data providers
        and can be delayed, incomplete, or wrong. A journey Layo cannot verify against that data is
        shown as &quot;unverified&quot;. Always confirm your actual flight details with your airline
        — never rely on Layo as your source of travel information.
      </p>

      <h2>8. Businesses and deals</h2>
      <p>
        Layo lets registered businesses list deals and promotions for travellers at participating
        airports. We review submissions before they go live, but we don&apos;t guarantee the
        accuracy of any listing, and we aren&apos;t a party to any transaction between you and a
        business. Any dispute about a deal, promo code, or purchase is between you and that
        business.
      </p>

      <h2>9. Safety</h2>
      <p>
        Layo helps you find people to meet, but we don&apos;t run background checks and can&apos;t
        guarantee anyone&apos;s identity, intentions, or safety. Use good judgement: verify who
        you&apos;re talking to, meet in public places, tell someone else your plans, and report
        anyone who makes you uncomfortable.
      </p>

      <h2>10. Intellectual property</h2>
      <p>
        The Layo name, logo, and the Service&apos;s design and code are owned by Layo or our
        licensors. Nothing in these Terms gives you any right to use them except to the extent
        necessary to use the Service as intended.
      </p>

      <h2>11. Disclaimers</h2>
      <p>
        The Service is provided &quot;as is&quot; and &quot;as available&quot;, without warranties
        of any kind, express or implied, including fitness for a particular purpose, accuracy, or
        uninterrupted availability. We don&apos;t warrant that the Service will be error-free, that
        any match or connection will be accurate, or that any user is who they claim to be.
      </p>

      <h2>12. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, Layo will not be liable for any indirect,
        incidental, special, or consequential damages, or for any loss of data, profits, or
        goodwill, arising from your use of the Service, including from your interactions with other
        users or with businesses listed on Layo. Nothing in these Terms limits liability that
        cannot lawfully be limited (such as for death or personal injury caused by our negligence,
        or for fraud).
      </p>

      <h2>13. Governing law</h2>
      <p>
        These Terms are governed by the laws of England and Wales, and any dispute will be subject
        to the exclusive jurisdiction of the courts of England and Wales, unless mandatory consumer
        protection laws where you live say otherwise.
      </p>

      <h2>14. Changes to these Terms</h2>
      <p>
        We may update these Terms as the Service changes. If we make material changes, we&apos;ll
        notify you in the app or by email before they take effect. Continuing to use Layo after
        changes take effect means you accept the updated Terms.
      </p>

      <h2>15. Termination</h2>
      <p>
        You can delete your account at any time. We may suspend or terminate your account for
        breaching these Terms, or suspend the Service for maintenance or legal reasons. Sections
        that by their nature should survive termination (such as Sections 5, 9, 11, and 12) will
        continue to apply.
      </p>

      <h2>16. Contact us</h2>
      <p>
        Questions about these Terms? Email <a href="mailto:support@layo.uk">support@layo.uk</a>.
      </p>
    </LegalLayout>
  );
}
