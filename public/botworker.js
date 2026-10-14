// public/botworker.js -- runs the bot's thinking off the page's thread (#44). app.js posts { id, task } (the task is
// play.js's `botTask()`), this answers { id, action } or { id, error }. The same `decideTask` the tests run.
import { decideTask } from "./play.js";

self.onmessage = (e) => {
  const { id, task } = e.data;
  try { self.postMessage({ id, action: decideTask(task) }); }
  catch (err) { self.postMessage({ id, error: String((err && err.message) || err) }); }
};
