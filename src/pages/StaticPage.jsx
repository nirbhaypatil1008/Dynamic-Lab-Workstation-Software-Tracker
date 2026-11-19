import React from "react";
import { useApp } from "../context/AppContext.jsx";
import Footer from "../components/common/Footer.jsx";
import { staticPages } from "../utils/constants.js";

export default function StaticPage({ slug }) {
  const { user } = useApp();

  const page =
    slug === "not-found"
      ? {
          title: "Page not found",
          eyebrow: "404",
          body: `<p>The page you requested does not exist or may have been moved.</p><p><strong><a href="#/help">Visit the Help page</a></strong> or return to the application.</p>`
        }
      : staticPages[slug] || staticPages.about;

  function handleBack() {
    window.location.hash = "";
  }

  return (
    <div className="static-page">
      <header className="static-header">
        <div className="brand-wrap">
          <img
            className="brand-logo"
            src="/lab-logo.png"
            alt="Dynamic Lab logo"
          />
          <div>
            <p className="brand-title">Dynamic Lab</p>
            <span className="brand-subtitle">Workstation Tracker</span>
          </div>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={handleBack}
        >
          Back to {user ? "application" : "sign in"}
        </button>
      </header>

      <main className="static-main">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">{page.eyebrow}</p>
              <h1>{page.title}</h1>
            </div>
          </div>
          <div
            className="legal-content"
            dangerouslySetInnerHTML={{ __html: page.body }}
          />
        </section>
        <Footer />
      </main>
    </div>
  );
}
