import { faq } from "@/lib/data";

export default function Faq() {
  return (
    <div className="faq">
      {faq.map((f, i) => (
        <details key={f.q} name="faq" open={i === 0}>
          <summary><span className="silk acc">Q{i + 1}</span><span>{f.q}</span><i aria-hidden /></summary>
          <p className="body">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
