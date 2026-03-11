const Footer = () => (
  <footer className="border-t bg-primary px-4 py-10 text-primary-foreground/70">
    <div className="container mx-auto max-w-4xl">
      <div className="flex flex-col items-center gap-4 text-center text-sm">
        <div>
          <span className="font-display text-lg font-700 text-primary-foreground">SURVIVE NIGERIA</span>
          <p className="mt-1 text-xs text-primary-foreground/50">#survive9ja · #SurviveNigeria2026</p>
        </div>
        <div className="flex flex-wrap justify-center gap-4 text-xs text-primary-foreground/50">
          <span>About</span>
          <span>Contact</span>
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
        </div>
        <p className="text-xs text-primary-foreground/40">
          © {new Date().getFullYear()} Survive Nigeria. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
