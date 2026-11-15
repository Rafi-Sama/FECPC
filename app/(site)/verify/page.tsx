import VerifyBox from "@/components/VerifyBox";
import { site } from "@/lib/site";

export const metadata = { title: "Verify a certificate" };

export default function Verify() {
  return (
    <>
      <section className="page-head t-b paper" data-t="b">
        <div className="wrap split even" style={{ alignItems: "start" }}>
          <div className="head">
            <h1 className="disp" style={{ fontSize: "clamp(48px,6.4vw,92px)" }}>Is this certificate <span className="acc">real?</span></h1>
            <p className="lede">Every certificate {site.short} issues carries a code. The record here is the truth; if the paper disagrees, trust the page.</p>
          </div>
          <VerifyBox />
        </div>
      </section>
    </>
  );
}
