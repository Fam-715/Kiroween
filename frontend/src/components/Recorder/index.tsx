export default function Recorder() {
  return (
    <section aria-labelledby="recorder-heading">
      <h2 id="recorder-heading" className="text-3xl text-label-tealBright">
        Record a Tape
      </h2>
      <p className="mt-2 max-w-prose text-plastic-300">
        Build a mixtape of study topics (tracks) and breaks (interludes), side A
        and side B. The full recorder UI arrives with task 8.
      </p>
      <div
        className="mt-6 rounded-sm border border-dashed border-plastic-500/40 bg-plum-900/50 p-6"
        role="note"
      >
        <p className="font-hand text-2xl text-plastic-100">
          Choose a length (C60 / C90 / C120), then lay down tracks with their
          key terms…
        </p>
      </div>
    </section>
  );
}
