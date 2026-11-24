import { BrowserRouter } from "react-router-dom";
import Layout from "./components/Layout";

/**
 * Base layout and routes (task 7.4):
 *  /            → TapeShelf  (the haunted shelf)
 *  /record      → Recorder   (create/edit a tape)
 *  /play/:tapeId → CassettePlayer (focus session)
 */
export default function App() {
  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
