# Browser APIs for Cursed Cassette

Checked against MDN on 2026-11-24. API facts come from the pages listed in "Sources checked". Fallbacks and project notes are our own decisions, based on the mixtape-core spec. Anything those pages did not state is marked **not confirmed**. Nothing was filled in from memory.

MDN's browser compatibility tables are rendered with JavaScript and did not appear in the fetched text. Only the `decodeAudioData` page showed a support banner. Browser version numbers in the previous version of this file (dated 2026-11-23) could not be re-verified, so they were removed. Check the tables in a real browser before quoting versions in the write-up.

## Privacy answer: may speech recognition send audio to an online service?

**Yes.** MDN says the browser decides where recognition runs. Depending on the browser, audio may go to a server-based recognition service (which then does not work offline) or be processed on the device. An app can request on-device processing with `SpeechRecognition.processLocally = true`. In that case neither the audio nor the transcript goes to a third-party service. This needs a language pack for each language, and `start()` fails with a `service-not-allowed` error if the pack is missing.

Which browsers send audio online by default is **not confirmed** by these pages. The privacy text should say: "Your browser's speech recognition may send your voice to the browser vendor's online service. Cursed Cassette does not upload your recordings. Only the recognised text is sent to our server to be scored, and it is not stored." Keep the consent notice before first use, as product.md requires.

## 1. Web Speech API: SpeechRecognition

**Use in the app:** turns the user's spoken recall (30 to 90 s) into a transcript. The backend then scores it by counting key terms.

**Requirements and limits**
- `start()` begins listening to the microphone (or an audio track). Results arrive in `result` events. `stop()` returns what was captured so far. `abort()` returns nothing.
- Some browsers expose only the prefixed `webkitSpeechRecognition`. Feature-detect both names.
- Set `lang` explicitly. MDN calls this the recommended practice. If unset, it falls back to the page `lang` attribute, then the browser language.
- `continuous` defaults to `false` (one result). A 30 to 90 s recall needs `continuous = true` and handling of several results. Whether that works on every browser is **not confirmed**.
- Optional extras: `phrases` (bias recognition toward the key terms, boost 0.0 to 10.0), `available()` and `install()` (language pack checks), `processLocally`. The `phrases` idea suits us because key terms are the scoring basis. `available()` and `install()` are governed by the `on-device-speech-recognition` Permissions-Policy directive, default `self`. If blocked, `available()` resolves to `unavailable` and `install()` rejects with `NotAllowedError`.
- `grammars` is deprecated and has no effect.
- The fetched pages do not state whether HTTPS or a user gesture is required, or how the microphone permission prompt works for this API. **Not confirmed.** The MDN demo calls `start()` from a button click, and our rules already require a REC press.
- The Using the Web Speech API page was returned truncated after 20,000 characters. The cut-off part was the contextual biasing section (the `boost` description). The privacy and on-device sections were read in full.

**Browser support risk:** **not confirmed** (no table in the fetched text). MDN confirms that support is uneven: some browsers need the prefix, and the on-device features are described as supported only by "implementations" that have them.

**Fallback:** if neither `SpeechRecognition` nor `webkitSpeechRecognition` exists, or the mic is denied, or recognition errors out, show a text box so the user can type the recall. Same scoring path. Future idea, not in the current spec: an on-device recognition option using `processLocally`.

## 2. MediaRecorder

**Use in the app:** records the user's recall audio from the microphone. The result is a `Blob` stored in IndexedDB and played back later with decay effects.

**Requirements and limits**
- Needs a `MediaStream`, normally from `getUserMedia`, so it inherits the microphone permission and secure-context rules in section 3.
- `start()` with no `timeslice` delivers one chunk at the end. With `timeslice` (ms) you get periodic chunks. `stop()` fires a final `dataavailable`, then `stop`. `requestData()` flushes a chunk and keeps recording.
- Collect the `dataavailable` chunks into an array and build the `Blob` after `stop`.
- `mimeType` reports the container chosen at construction. `audioBitsPerSecond` may differ from what you requested.
- `MediaRecorder.isTypeSupported()` tells you whether a MIME type works in the current browser. The MDN example hardcodes `audio/ogg; codecs=opus`, so do not copy that as a default. Which types each browser supports is **not confirmed**.
- `pause()` and `resume()` exist. The `error` event fires on fatal errors.
- `audioBitrateMode` exists, but its support was not shown. **Not confirmed.**

**Browser support risk:** **not confirmed.** The fetched text has no support data. The MIME type difference between browsers is the practical risk: choose the type at runtime and store the chosen `mimeType` with the recording, so playback can decode it.

**Fallback:** if `MediaRecorder` is missing, the mic is denied, or no MIME type works, the app skips the recording and still submits the typed or transcribed text for scoring. The text is not stored. The track then has no playable recording for that attempt, so decayed playback is disabled for it.

## 3. MediaDevices.getUserMedia()

**Use in the app:** asks for microphone access (`{ audio: true }`) when the user presses REC. Never before.

**Requirements and limits**
- **Secure context only.** A page served over HTTPS, `localhost`, or `file:///` qualifies. In an insecure context `navigator.mediaDevices` is `undefined`, so calling it throws a `TypeError`. Vercel serves HTTPS, so production is fine.
- **Permission is always required.** Browsers must ask at least the first time and must show an in-use indicator. Whether a user gesture is required is **not confirmed** by this page. The app only calls it after a REC press anyway.
- An `audio` or `video` constraint must be set. An empty constraints object rejects.
- Rejections to handle: `NotAllowedError` (denied, insecure context, or blocked by Permissions Policy), `NotFoundError` (no microphone), `NotReadableError` (hardware or OS fault), `OverconstrainedError`, `AbortError`, `SecurityError`, `TypeError`.
- Permissions Policy directive `microphone` applies. If the app is ever embedded in an `<iframe>` (for example a judging page), the frame needs `allow="microphone"`. Sandboxed iframes, `data:` and `blob:` documents with no origin, and `srcdoc` frames cannot use it.
- After recording, stop the stream's tracks so the browser's mic indicator turns off. The page does not say this directly. It is our own precaution. The page does say browsers show a "permission granted" indicator even when not recording.

**Browser support risk:** **not confirmed** (no table in the fetched text).

**Fallback:** on any rejection, show a plain message that names the reason (denied, no mic, insecure page) and switch the recall panel to the typing box. Do not retry in a loop.

## 4. BaseAudioContext.decodeAudioData()

**Use in the app:** decodes a stored recall `Blob` (after `blob.arrayBuffer()`) into an `AudioBuffer` so Web Audio can play it with hiss, wobble and distortion based on the track's condition.

**Requirements and limits**
- Takes an `ArrayBuffer` holding a **complete** file. It does not work on fragments, so decode the final stored recording, not individual MediaRecorder chunks.
- Returns a Promise of an `AudioBuffer`. Callback arguments exist for legacy use. Use the Promise form.
- The decoded buffer is resampled to the `AudioContext` sample rate.
- The decode happens asynchronously. Decode errors reject the Promise, so catch them.
- The page does not say whether an `AudioContext` needs a user gesture. **Not confirmed.** The MDN example creates the context inside a click handler. Our rule already says audio starts only after the user presses play.
- Which formats decode in which browser is **not confirmed**. This matters because MediaRecorder output varies by browser.

**Browser support:** MDN shows the Baseline "Widely available" badge, available across browsers since April 2021.

**Fallback:** if decoding fails (unsupported format or corrupt data), play the original `Blob` through a plain `<audio>` element with no decay effects and show a short note. If that fails too, show the transcript text only.

## 5. IndexedDB API

**Use in the app:** stores recall recordings (`Blob`s) in the browser, keyed by trackId, as defined in design.md, so a new recording replaces the previous one for that track. Recordings never leave the device.

**Requirements and limits**
- Stores structured data, including files and blobs, and any value supported by the structured clone algorithm.
- Asynchronous and transactional. You open a database with `indexedDB.open()`, create object stores in the `upgradeneeded` handler, and read or write inside transactions.
- Same-origin policy: data is visible only to the same origin. A different domain (for example a Vercel preview URL) has separate, empty storage.
- Also available inside Web Workers.
- Storage limits and eviction rules differ between browsers and are not simple. MDN links a separate page describing them (only for Firefox). The exact quotas, and whether the browser may delete data under pressure, are **not confirmed** here.
- Behaviour in private browsing: **not confirmed.**
- It needs no permission prompt (the page mentions none, but does not state this outright).

**Browser support risk:** **not confirmed** (no support table in the fetched text). Eviction and quota differences are the practical risk, so recordings may disappear.

**Fallback:** wrap storage in `recordingStore.ts` with a clear "recording not available" state. If `indexedDB` is missing, the open call fails, or a write throws (for example quota exceeded), still submit the recall text for scoring, keep the returned score, and do not store the text. Tell the user the audio was not saved. A missing recording must never block scoring or restoring a track.

## Sources checked

| URL | Date checked | Fetch succeeded |
|---|---|---|
| https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API | 2026-11-24 | Yes, but truncated at 20,000 characters (cut-off part covers contextual biasing `boost` only) |
| https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition | 2026-11-24 | Yes. No compatibility table in the fetched text |
| https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder | 2026-11-24 | Yes. No compatibility table in the fetched text |
| https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia | 2026-11-24 | Yes. No compatibility table in the fetched text |
| https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData | 2026-11-24 | Yes. Baseline badge shown, table not rendered |
| https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API | 2026-11-24 | Yes. No compatibility table in the fetched text |
