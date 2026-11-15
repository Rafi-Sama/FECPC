import JoinForm from "@/components/JoinForm";
import { site } from "@/lib/site";

export const metadata = { title: "Join" };
const pipeline = [
  ["Apply", "4 min", "The form below. Tell us your department, batch and what you want to build."],
  ["Screen", "30 min", "A short online problem set. It checks how you think, not what you have memorised."],
  ["Interview", "15 min", "Pick a slot. Two committee members, one conversation, a simple rubric."],
  ["Onboard", "week 1", "Your account is created with a checklist and a mentor already assigned."],
];
const checklist = ["Verify at least one judge handle", "Join a group and pick a mentor", "Solve three starter-sheet problems", "Pay the admission fee", "Install the app and turn on notifications"];

export default function Join() {
  return (
    <>
      <section className="page-head t-b paper" data-t="b">
        <div className="wrap"><div className="head">
          <h1 className="disp">Join <span className="acc">the club.</span></h1>
          <p className="lede">Any department, any year, any level. If you have never written a line of code, this is the right place to write the first one.</p>
          <p><a href="#apply" className="btn">Apply now</a></p>
        </div></div>
      </section>
      <section className="sec t-b" data-t="b">
        <div className="wrap">
          <div className="head"><h2 className="h2">Four steps, <span className="acc">about an hour.</span></h2></div>
          <ol className="grid" style={{ "--min": "240px" } as React.CSSProperties}>
            {pipeline.map(([t, time, d], i) => <li key={t} className="panel"><div className="row between"><span className="label">Step {i + 1} of 4</span><span className="label acc2">{time}</span></div><h3 className="h3" style={{ marginBlock: 10 }}>{t}</h3><p className="body">{d}</p></li>)}
          </ol>
        </div>
      </section>
      <section className="sec t-b paper" data-t="b" id="apply">
        <div className="wrap split flip">
          <JoinForm />
          <aside className="stack" style={{ "--g": "32px" } as React.CSSProperties}>
            <div><h2 className="h3" style={{ marginTop: 14 }}>After you are accepted</h2></div>
            <ul className="stack" style={{ "--g": "12px" } as React.CSSProperties}>
              {checklist.map((c) => <li key={c} className="body"><span className="acc" aria-hidden>○</span> {c}</li>)}
            </ul>
            <p className="body">Questions first? <a className="link acc" href={`mailto:${site.email}`}>{site.email}</a></p>
          </aside>
        </div>
      </section>
    </>
  );
}
