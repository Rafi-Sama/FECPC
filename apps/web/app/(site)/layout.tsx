import Nav from '@/components/site/Nav';
import Footer from '@/components/site/Footer';
import './site.layer.css';
import './site.utilities.css';

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a href="#main" className="sr">
        Skip to content
      </a>
      <Nav />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
