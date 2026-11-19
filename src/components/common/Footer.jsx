import React from "react";

export default function Footer() {
  const links = [
    ["about", "About"],
    ["contact", "Contact"],
    ["help", "Help"],
    ["privacy", "Privacy Policy"],
    ["terms", "Terms of Service"]
  ];

  return (
    <footer className="site-footer">
      <span>Dynamic Lab Workstation Tracker</span>
      <nav aria-label="Footer links">
        {links.map(([slug, label]) => (
          <a key={slug} href={`#/${slug}`}>
            {label}
          </a>
        ))}
      </nav>
    </footer>
  );
}
