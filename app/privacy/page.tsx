export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-6 lg:px-8">
        <h1 className="text-3xl font-extrabold text-white">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-400">Effective Date: March 20, 2026</p>

        <div className="mt-8 space-y-6 text-sm text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white">Overview</h2>
            <p className="mt-2">
              Elite Cheer Stats (“we”, “our”, “us”) operates the Elite Cheer Stats platform.
              This Privacy Policy explains what information we collect and how we use it.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Information We Collect</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Email address (if you sign up or subscribe)</li>
              <li>Usage data (pages visited, features used)</li>
              <li>Payment information (processed securely via Stripe — we do not store card details)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">How We Use Information</h2>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Provide and improve our services</li>
              <li>Communicate with you</li>
              <li>Process payments</li>
              <li>Analyze usage and improve performance</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Third-Party Services</h2>
            <p className="mt-2">
              We may use third-party services such as Stripe (payments), Supabase (data storage),
              and analytics providers. These services may process your data according to their own policies.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Data Security</h2>
            <p className="mt-2">
              We take reasonable steps to protect your information, but no system is completely secure.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white">Your Rights</h2>
            <p className="mt-2">
              You may request access, correction, or deletion of your data by contacting us.
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