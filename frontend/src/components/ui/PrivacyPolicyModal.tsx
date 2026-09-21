import React, { useState, useRef, useEffect } from 'react';
import { X, ShieldCheck, ChevronDown, ChevronUp } from 'lucide-react';

interface PrivacyPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
}

export default function PrivacyPolicyModal({ isOpen, onClose, onAccept }: PrivacyPolicyModalProps) {
  const [agreed, setAgreed] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setAgreed(false);
      setScrolledToBottom(false);
    }
  }, [isOpen]);

  const handleScroll = () => {
    const el = contentRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setScrolledToBottom(atBottom);
  };

  useEffect(() => {
    if (isOpen && contentRef.current) {
      contentRef.current.scrollTop = 0;
      setScrolledToBottom(false);
      setAgreed(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-primary/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-accent-soft w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="bg-primary px-6 py-4 flex items-center justify-between border-b border-accent/30 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent/20 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight">Privacy Policy</h2>
              <p className="text-[10px] text-accent font-bold uppercase tracking-widest">BSC Textiles Pvt Ltd</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          ref={contentRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-[11.5px] leading-relaxed text-primary font-medium"
        >
          {/* Introduction */}
          <section>
            <h3 className="text-sm font-black text-primary mb-2 tracking-tight">Introduction</h3>
            <p className="text-primary/80">
              At BSC Textiles Pvt Ltd, we respect your privacy and are committed to protecting your personal data. This Privacy Policy explains what information we collect, why we collect it, how we use and protect it, and the choices and rights you have. It is prepared in line with the Digital Personal Data Protection Act, 2023 ("DPDP Act"), the Information Technology Act, 2000, and related rules.
            </p>
          </section>

          <hr className="border-accent-soft" />

          {/* Information We Collect */}
          <section>
            <h3 className="text-sm font-black text-primary mb-2 tracking-tight">Information We Collect</h3>
            <p className="text-primary/80 mb-2 font-bold">Information you give us:</p>
            <ul className="list-disc pl-5 space-y-1 text-primary/80">
              <li>Name, email address, phone number (including WhatsApp number)</li>
              <li>Delivery and billing address</li>
              <li>Account details and login credentials</li>
              <li>Order details and communication with us (enquiries, feedback, support requests)</li>
              <li>Any other information you choose to provide</li>
            </ul>
            <p className="text-primary/80 mt-3 mb-2 font-bold">Information collected automatically:</p>
            <ul className="list-disc pl-5 space-y-1 text-primary/80">
              <li>Device and browser type, IP address, and operating system</li>
              <li>Pages visited, time spent, and referring website</li>
              <li>Cookies and similar technologies (see Section 9)</li>
            </ul>
            <p className="text-primary/80 mt-3 mb-2 font-bold">Payment information:</p>
            <p className="text-primary/80">
              Payments are handled by third-party payment processors. We do not store your full card, UPI PIN, or net-banking credentials.
            </p>
          </section>

          <hr className="border-accent-soft" />

          {/* Your Personal Data */}
          <section>
            <h3 className="text-sm font-black text-primary mb-2 tracking-tight">Your Personal Data</h3>
            <p className="text-primary/80 mb-2">We use your personal data to:</p>
            <ul className="list-disc pl-5 space-y-1 text-primary/80">
              <li>Create and manage your account</li>
              <li>Process orders, payments, deliveries, returns, and refunds</li>
              <li>Respond to your queries and provide customer support</li>
              <li>Send order updates and service messages</li>
              <li>Send offers and marketing messages, only where you have given consent</li>
              <li>Improve our Site, products, and services</li>
              <li>Prevent fraud and keep the Site secure</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="text-primary/80 mt-3">
              We process your data based on your consent, to provide the services you request, and for legitimate uses permitted under the DPDP Act, such as complying with the law.
            </p>
          </section>

          <hr className="border-accent-soft" />

          {/* Sharing Personal Data */}
          <section>
            <h3 className="text-sm font-black text-primary mb-2 tracking-tight">Sharing Personal Data</h3>
            <p className="text-primary/80 mb-2">We do not sell your personal data. We share it only with:</p>
            <ul className="list-disc pl-5 space-y-1 text-primary/80">
              <li>Service providers that help us run our business, such as hosting and cloud providers, payment gateways, delivery and logistics partners, messaging platforms, and analytics and advertising tools. They may process your data only on our instructions and for the purposes described here.</li>
              <li>Legal and regulatory authorities, where required by law, court order, or to protect our rights and safety.</li>
              <li>A successor business, if we merge with or are acquired by another business, in which case this policy will continue to protect your data or you will be notified of any change.</li>
            </ul>
          </section>

          <hr className="border-accent-soft" />

          {/* Links and Services */}
          <section>
            <h3 className="text-sm font-black text-primary mb-2 tracking-tight">Links and Services</h3>
            <p className="text-primary/80">
              The Site may contain links to third-party websites or use third-party services (such as payment gateways, messaging platforms, and analytics tools). We do not control and are not responsible for their content or practices. Their use is governed by their own terms and policies.
            </p>
          </section>

          <hr className="border-accent-soft" />

          {/* Cookies and Tracking Technologies */}
          <section>
            <h3 className="text-sm font-black text-primary mb-2 tracking-tight">Cookies and Tracking Technologies</h3>
            <p className="text-primary/80 mb-2">
              When you visit our website, we place small text files called cookies on your phone, tablet, or computer. Cookies help the Site work properly, remember your preferences, and give us a picture of how the Site is being used so we can make it better.
            </p>
            <p className="text-primary/80 mb-2 font-bold">What we use cookies for:</p>
            <ul className="list-disc pl-5 space-y-1 text-primary/80">
              <li><strong>Essential cookies:</strong> These keep the Site running, for example by keeping you logged in, remembering items in your cart, and protecting against fraud. The Site cannot work properly without them.</li>
              <li><strong>Preference cookies:</strong> These remember choices such as your language or region, so you don't have to set them again on every visit.</li>
              <li><strong>Analytics cookies:</strong> These show us which pages people visit, how they move around, and where they run into problems. We use this to improve the Site.</li>
              <li><strong>Advertising cookies:</strong> These help us measure how well our ads and promotions perform and show you offers that may be relevant to you.</li>
            </ul>
            <p className="text-primary/80 mt-3 mb-2 font-bold">Third-party cookies:</p>
            <p className="text-primary/80">
              Some cookies are set by companies we work with, not by us. We use Google Analytics to understand how visitors use the Site. These providers have their own privacy policies and we don't control how they use their cookies.
            </p>
            <p className="text-primary/80 mt-2">
              You can read how Google handles data at{' '}
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-accent font-bold hover:underline">
                https://policies.google.com/privacy
              </a>
              , and you can opt out of Google Analytics using Google's browser add-on at{' '}
              <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer" className="text-accent font-bold hover:underline">
                https://tools.google.com/dlpage/gaoptout
              </a>.
            </p>
            <p className="text-primary/80 mt-3 mb-2 font-bold">Your choices:</p>
            <ul className="list-disc pl-5 space-y-1 text-primary/80">
              <li>When you first visit the Site, you can accept or decline non-essential cookies using our cookie banner. You can change your choice at any time through the cookie settings link in the footer.</li>
              <li>You can also block or delete cookies in your browser settings. Each browser does this differently, so check its help section for steps.</li>
              <li>If you turn off cookies, some parts of the Site may not work as intended. For example, you may need to log in more often, and your cart or preferences may not be saved.</li>
            </ul>
            <p className="text-primary/80 mt-3">
              Some cookies last only until you close your browser (session cookies), and others stay on your device for a set period (persistent cookies), usually between 30 days and 2 years. Information gathered through cookies is handled in line with the rest of this Privacy Policy.
            </p>
          </section>

          <hr className="border-accent-soft" />

          {/* Data Retention */}
          <section>
            <h3 className="text-sm font-black text-primary mb-2 tracking-tight">Data Retention</h3>
            <p className="text-primary/80 mb-2">
              We keep your personal data only for as long as we need it for the purpose it was collected, or for as long as the law requires. When that time is up, we either delete your data or remove anything that could identify you.
            </p>
            <p className="text-primary/80 mb-2">In some situations we may need to keep certain information for longer, for example:</p>
            <ul className="list-disc pl-5 space-y-1 text-primary/80">
              <li>To detect, investigate, and prevent fraud, misuse, or abuse of BSC Textiles Pvt Ltd and its services.</li>
              <li>To establish, exercise, or defend our legal rights, or to respond to lawful requests from courts and government authorities.</li>
              <li>To meet tax, accounting, and other record-keeping obligations under Indian law.</li>
            </ul>
            <p className="text-primary/80 mt-3">
              We may also keep information in anonymised form, meaning it can no longer be linked back to you, so we can analyse trends, carry out research, and improve our products and services.
            </p>
            <p className="text-primary/80 mt-2">
              If you ask us to delete your data, we will do so unless we are legally required or permitted to keep it, and we will tell you if that is the case. To make a request, write to us at{' '}
              <a href="mailto:exclusive@bscdvg.com" className="text-accent font-bold hover:underline">exclusive@bscdvg.com</a>.
            </p>
          </section>

          <hr className="border-accent-soft" />

          {/* Your Rights */}
          <section>
            <h3 className="text-sm font-black text-primary mb-2 tracking-tight">Your Rights</h3>
            <p className="text-primary/80 mb-2">
              We want the information we hold about you to be correct and current. If you tell us something is wrong or out of date, we will fix or remove it as soon as reasonably possible.
            </p>
            <p className="text-primary/80 mb-1 font-bold">Access, correction, and updates.</p>
            <p className="text-primary/80 mb-2">
              You can view and edit most of your details yourself by logging in and going to Profile / My Account / Settings. If you can't find what you need there, email us and we will help.
            </p>
            <p className="text-primary/80 mb-1 font-bold">Deleting your data.</p>
            <p className="text-primary/80 mb-2">
              You can remove optional information, such as your saved addresses, profile photo, and preferences, from your account settings. To have your account and personal data deleted entirely, write to us at{' '}
              <a href="mailto:exclusive@bscdvg.com" className="text-accent font-bold hover:underline">exclusive@bscdvg.com</a>{' '}
              with "Data Deletion Request" in the subject line. We will delete your data unless the law requires us to keep it, and we will tell you if that is the case.
            </p>
            <p className="text-primary/80 mb-1 font-bold">Withdrawing your consent.</p>
            <p className="text-primary/80 mb-2">
              You can withdraw consent you have given us at any time by emailing{' '}
              <a href="mailto:exclusive@bscdvg.com" className="text-accent font-bold hover:underline">exclusive@bscdvg.com</a>{' '}
              with "Withdrawal of Consent" in the subject line. For your security, we may ask you to confirm your identity before we act on it.
            </p>
            <p className="text-primary/80 mb-2">Please keep in mind:</p>
            <ul className="list-disc pl-5 space-y-1 text-primary/80">
              <li>Withdrawal applies from that point forward. It does not undo the processing we carried out while your consent was in effect.</li>
              <li>If we need the information to provide a service you have asked for, withdrawing consent may mean we can no longer offer that service, or that some parts of the Site stop working for you.</li>
              <li>To stop marketing messages only, you can opt out through the unsubscribe link / replying STOP, without withdrawing consent for everything else.</li>
            </ul>
            <p className="text-primary/80 mt-3 mb-1 font-bold">Other rights.</p>
            <p className="text-primary/80 mb-2">
              You may also ask for a summary of the personal data we hold about you and who we share it with, and you may nominate someone to exercise your rights on your behalf if you die or become unable to do so.
            </p>
            <p className="text-primary/80 mb-1 font-bold">Complaints.</p>
            <p className="text-primary/80">
              If you are unhappy with how we have handled your data or a request, contact our Grievance Officer first. If we haven't resolved the matter, you can take it to the Data Protection Board of India. We aim to respond to all requests within 30 days.
            </p>
          </section>

          <hr className="border-accent-soft" />

          {/* Your Consent */}
          <section>
            <h3 className="text-sm font-black text-primary mb-2 tracking-tight">Your Consent</h3>
            <p className="text-primary/80 mb-2">
              We collect and use your personal data only with your consent, or where the law allows us to do so without it. When we ask for your consent, we make sure it is:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-primary/80">
              <li><strong>Informed:</strong> We tell you what data we are collecting and why, before or at the time we ask, in clear and simple language.</li>
              <li><strong>Specific:</strong> Consent is tied to a stated purpose. Agreeing to one thing, such as processing your order, does not mean you have agreed to another, such as receiving marketing messages.</li>
              <li><strong>Freely given:</strong> We will not make you agree to unnecessary data use as a condition of using the Site. Optional uses, like marketing, are always separate from what we need to serve you.</li>
              <li><strong>Clear and affirmative:</strong> You give consent by taking a clear action, such as ticking an unticked box, clicking "I agree," or replying "YES" to an opt-in message. We do not use pre-ticked boxes or treat silence as consent.</li>
            </ul>
            <p className="text-primary/80 mt-3 mb-2 font-bold">How you may give consent.</p>
            <p className="text-primary/80 mb-2">
              For example, when you create an account, place an order, subscribe to updates, opt in to WhatsApp or SMS messages, submit a form, or accept non-essential cookies on our cookie banner.
            </p>
            <p className="text-primary/80 mb-2 font-bold">Withdrawing consent.</p>
            <p className="text-primary/80 mb-2">
              You can withdraw your consent at any time, and we make it as easy to withdraw as it was to give. See Section 8 for how, and what happens when you do.
            </p>
            <p className="text-primary/80 mb-2 font-bold">When we may process data without consent.</p>
            <p className="text-primary/80 mb-2">
              The DPDP Act permits certain uses without consent, such as complying with a law or court order, responding to a medical emergency, or other "legitimate uses" it lists. We rely on these only where they genuinely apply.
            </p>
            <p className="text-primary/80 mb-2 font-bold">Records and language.</p>
            <p className="text-primary/80 mb-2">
              We keep a record of when and how you gave your consent. Our privacy notice is available in English and in Hindi on request.
            </p>
            <p className="text-primary/80 mb-1 font-bold">Children.</p>
            <p className="text-primary/80">
              Where a user is under 18, consent must come from a parent or legal guardian.
            </p>
          </section>

          <hr className="border-accent-soft" />

          {/* Children's Privacy */}
          <section>
            <h3 className="text-sm font-black text-primary mb-2 tracking-tight">Children's Privacy</h3>
            <p className="text-primary/80 mb-2">
              Our Site is meant for people who are 18 or older and legally able to enter into a contract under the Indian Contract Act, 1872. We do not knowingly collect personal data from anyone under 18, and we do not direct our services, marketing, or advertising at children.
            </p>
            <p className="text-primary/80 mb-2">
              If a child needs to use a feature of our Site, or if you give us information about a child (for example, a child's name or size for a purchase), you must be that child's parent or legal guardian, and you confirm that you consent on the child's behalf. We will use this information only to provide the service you asked for. We will not track the child's behaviour or use their data for targeted advertising.
            </p>
            <p className="text-primary/80">
              If you believe a child has given us personal data without a parent's or guardian's consent, please email us at{' '}
              <a href="mailto:exclusive@bscdvg.com" className="text-accent font-bold hover:underline">exclusive@bscdvg.com</a>. We will review the request and delete the data promptly, unless the law requires us to keep it.
            </p>
          </section>

          <hr className="border-accent-soft" />

          {/* Marketing Communications */}
          <section>
            <h3 className="text-sm font-black text-primary mb-2 tracking-tight">Marketing Communications</h3>
            <p className="text-primary/80">
              We will send you promotional messages, including through WhatsApp, SMS, and email, only if you have opted in. You can opt out at any time by replying STOP / clicking "unsubscribe" / emailing{' '}
              <a href="mailto:exclusive@bscdvg.com" className="text-accent font-bold hover:underline">exclusive@bscdvg.com</a>.
              Opting out of marketing will not stop essential messages about your orders or account.
            </p>
          </section>

          <hr className="border-accent-soft" />

          {/* Changes to This Policy */}
          <section>
            <h3 className="text-sm font-black text-primary mb-2 tracking-tight">Changes to This Policy</h3>
            <p className="text-primary/80">
              We may update this Privacy Policy from time to time. Any changes will be posted on this page with a new "Last updated" date, and where the change is significant we will notify you by email or a notice on the Site.
            </p>
          </section>

          <hr className="border-accent-soft" />

          {/* Contact and Grievance Officer */}
          <section>
            <h3 className="text-sm font-black text-primary mb-2 tracking-tight">Contact and Grievance Officer</h3>
            <p className="text-primary/80 mb-2">For privacy questions, requests, or complaints, contact:</p>
            <div className="bg-background rounded-xl p-4 border border-accent-soft space-y-1.5">
              <p className="text-primary/80"><span className="font-bold text-primary">Email:</span>{' '}<a href="mailto:exclusive@bscdvg.com" className="text-accent font-bold hover:underline">exclusive@bscdvg.com</a></p>
              <p className="text-primary/80"><span className="font-bold text-primary">Phone:</span> 9071555508</p>
              <p className="text-primary/80"><span className="font-bold text-primary">Address:</span> BSC Textiles Pvt Ltd, Medical College Road, MCC B Block, Kuvempu Nagar, Davanagere, Karnataka 577004</p>
            </div>
          </section>

          <hr className="border-accent-soft" />

          {/* Customer Support */}
          <section>
            <h3 className="text-sm font-black text-primary mb-2 tracking-tight">Customer Support</h3>
            <p className="text-primary/80 mb-2">
              If you have a question about your order, your account, these Terms, or how we handle your data, our support team is happy to help.
            </p>
            <div className="bg-background rounded-xl p-4 border border-accent-soft space-y-1.5">
              <p className="text-primary/80"><span className="font-bold text-primary">Email:</span>{' '}<a href="mailto:exclusive@bscdvg.com" className="text-accent font-bold hover:underline">exclusive@bscdvg.com</a></p>
              <p className="text-primary/80"><span className="font-bold text-primary">Phone:</span> 9071555508</p>
              <p className="text-primary/80"><span className="font-bold text-primary">Support hours:</span> Monday to Saturday, 10:00 AM to 9:30 PM IST</p>
              <p className="text-primary/80"><span className="font-bold text-primary">Address:</span> BSC Textiles Pvt Ltd, Medical College Road, MCC B Block, Kuvempu Nagar, Davanagere, Karnataka 577004</p>
            </div>
          </section>
        </div>

        {/* Footer — Agree & Accept */}
        <div className="border-t border-accent-soft px-6 py-4 bg-background/50 flex-shrink-0 space-y-3">
          {!scrolledToBottom && (
            <p className="text-[10px] text-primary/60 font-medium flex items-center gap-1.5">
              <ChevronDown className="w-3 h-3 animate-bounce" />
              Please scroll through the entire Privacy Policy to enable the agreement checkbox.
            </p>
          )}
          <label className={`flex items-start gap-3 cursor-pointer ${!scrolledToBottom ? 'opacity-50 pointer-events-none' : ''}`}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={!scrolledToBottom}
              className="mt-0.5 w-4 h-4 rounded border-accent-soft text-primary focus:ring-accent/30 accent-primary"
            />
            <span className="text-[11px] font-semibold text-primary leading-snug">
              I have read and agree to the{' '}
              <span className="font-black">Privacy Policy</span>{' '}
              of BSC Textiles Pvt Ltd. I consent to the collection, use, and processing of my personal data as described above.
            </span>
          </label>
          <div className="flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-accent-soft text-primary font-bold text-xs hover:bg-background transition-all"
            >
              Close
            </button>
            <button
              onClick={() => { if (agreed) onAccept(); }}
              disabled={!agreed}
              className="px-6 py-2.5 rounded-xl bg-primary text-white font-extrabold text-xs tracking-wide hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ShieldCheck className="w-4 h-4" />
              I Agree & Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
