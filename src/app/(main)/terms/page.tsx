import { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms of Service - Equinti",
  description: "Terms of Service for Equinti - Rules and guidelines for using our platform.",
};

export default function TermsOfServicePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Link 
        href="/"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-cyan-400 transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Home
      </Link>

      <div className="glass rounded-xl p-6 md:p-8">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 2026</p>

        <div className="prose prose-invert max-w-none space-y-6">
          <section>
            <h2 className="text-xl font-semibold text-cyan-400 mb-3">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Equinti (&quot;the Service&quot;), you agree to be bound by these Terms of 
              Service. If you do not agree to these terms, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cyan-400 mb-3">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              Equinti is a social platform for equestrians that provides features including but not 
              limited to: social networking, event management, educational challenges, and community 
              engagement tools. The Service is provided &quot;as is&quot; and we reserve the right to modify, 
              suspend, or discontinue any aspect of the Service at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cyan-400 mb-3">3. User Accounts</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              To use certain features of the Service, you must create an account. You agree to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Provide accurate and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Promptly update any changes to your information</li>
              <li>Accept responsibility for all activities under your account</li>
              <li>Notify us immediately of any unauthorized use</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cyan-400 mb-3">4. User Content</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              You retain ownership of content you post on Equinti. By posting content, you grant us 
              a non-exclusive, worldwide, royalty-free license to use, display, and distribute your 
              content in connection with the Service. You represent that:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>You own or have the right to post the content</li>
              <li>The content does not violate any third-party rights</li>
              <li>The content complies with these Terms and applicable laws</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cyan-400 mb-3">5. Prohibited Conduct</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              You agree not to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Post illegal, harmful, threatening, abusive, or harassing content</li>
              <li>Impersonate any person or entity</li>
              <li>Spam or send unsolicited communications</li>
              <li>Upload viruses or malicious code</li>
              <li>Interfere with the proper functioning of the Service</li>
              <li>Attempt to gain unauthorized access to any accounts or systems</li>
              <li>Use the Service for any illegal purpose</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Post content that promotes animal cruelty or unsafe riding practices</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cyan-400 mb-3">6. Events and Challenges</h2>
            <p className="text-muted-foreground leading-relaxed">
              Events and challenges on Equinti are created by administrators and approved trainers. 
              Participation is at your own risk. We do not guarantee the quality, safety, or legality 
              of any event. You are responsible for your own safety when participating in any 
              equestrian activities mentioned or organized through the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cyan-400 mb-3">7. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service and its original content (excluding user content), features, and functionality 
              are owned by Equinti and are protected by international copyright, trademark, and other 
              intellectual property laws.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cyan-400 mb-3">8. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may terminate or suspend your account and access to the Service immediately, without 
              prior notice, for conduct that we believe violates these Terms or is harmful to other 
              users, us, or third parties, or for any other reason at our sole discretion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cyan-400 mb-3">9. Disclaimers</h2>
            <p className="text-muted-foreground leading-relaxed">
              THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND. WE DISCLAIM ALL 
              WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR 
              PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, 
              SECURE, OR ERROR-FREE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cyan-400 mb-3">10. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, EQUINTI SHALL NOT BE LIABLE FOR ANY INDIRECT, 
              INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, 
              DATA, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE OF THE SERVICE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cyan-400 mb-3">11. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify users of any 
              material changes by posting the new Terms on this page. Your continued use of the 
              Service after changes constitutes acceptance of the modified Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cyan-400 mb-3">12. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the 
              United States, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-cyan-400 mb-3">13. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about these Terms of Service, please contact us at:
            </p>
            <p className="text-cyan-400 mt-2">support@equinti.com</p>
          </section>
        </div>
      </div>
    </div>
  );
}
