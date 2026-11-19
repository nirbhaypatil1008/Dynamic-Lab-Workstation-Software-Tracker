import React from "react";
import { useApp } from "../../context/AppContext.jsx";
import Header from "./Header.jsx";
import Footer from "../common/Footer.jsx";
import MobileNav from "./MobileNav.jsx";
import ModalDialog from "../common/ModalDialog.jsx";

export default function Layout({ children }) {
  const { error, message, dialogConfig, closeDialog } = useApp();

  return (
    <div className="airbnb-app-layout">
      <Header />

      <main className="airbnb-main-content">
        {error && (
          <div className="notice error-notice" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="notice success-notice" role="status">
            {message}
          </div>
        )}
        <div id="page-content">{children}</div>
        <Footer />
      </main>

      <MobileNav />

      {dialogConfig && (
        <ModalDialog config={dialogConfig} onClose={closeDialog} />
      )}
    </div>
  );
}
