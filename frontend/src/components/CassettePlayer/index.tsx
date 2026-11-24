import { useParams } from "react-router-dom";
import ConditionText from "../ConditionText";

/**
 * Placeholder cassette player page. The full player (SVG cassette, reels,
 * LCD, buttons, keyboard controls) arrives with tasks 9.1–9.3; this route
 * only establishes the layout and the always-present condition text slot.
 */
export default function CassettePlayer() {
  const { tapeId } = useParams<{ tapeId: string }>();

  return (
    <section aria-labelledby="player-heading">
      <h2 id="player-heading" className="text-3xl text-label-orangeBright">
        Cassette Player
      </h2>
      <p className="mt-2 text-sm text-plastic-300">
        Tape <span className="font-lcd text-lcd-green">{tapeId ?? "—"}</span>
      </p>
      <div
        className="mt-6 rounded-sm border border-plastic-500/30 bg-plum-900 p-6"
        role="note"
      >
        <p className="font-lcd text-3xl text-lcd-green" aria-hidden="true">
          00:00
        </p>
        <p className="mt-2 flex items-center gap-2 text-sm text-plastic-300">
          Condition: <ConditionText condition="Mint" />
        </p>
        <p className="mt-4 max-w-prose text-plastic-300">
          The player UI (PLAY / PAUSE / STOP / REW / FF / REC, the LCD countdown
          and the spinning reels) is built in task 9.2.
        </p>
      </div>
    </section>
  );
}
