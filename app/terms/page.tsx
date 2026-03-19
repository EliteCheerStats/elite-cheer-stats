export default function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-6 lg:px-8">
        <h1 className="text-3xl font-extrabold text-white">Terms of Use</h1>
        <p className="mt-2 text-sm text-slate-400">Effective Date: March 20, 2026</p>

        <div className="mt-8 space-y-6 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white">Use of Service</h2>
            <p className="mt-2">
              Elite Cheer Stats provides analytics, rankings, and insights related to competitive cheerleading.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">No Guarantees</h2>
            <p className="mt-2">
              All data, rankings, projections, and analytics are provided for informational and entertainment purposes only.
              We do not guarantee accuracy, completeness, or outcomes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Limitation of Liability</h2>
            <p className="mt-2">
              Elite Cheer Stats is not responsible for any decisions made based on our data.
              Use the platform at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Accounts & Payments</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Subscriptions may be billed monthly</li>
              <li>You may cancel at any time</li>
              <li>No partial refunds will be issued unless required by law</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Intellectual Property</h2>
            <p className="mt-2">
              All content, branding, and data presentation are owned by Elite Cheer Stats and may not be reproduced without permission.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Changes</h2>
            <p className="mt-2">
              We may update these terms at any time.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Contact</h2>
            <p className="mt-2">
              contactus@elitecheerstats.com
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}