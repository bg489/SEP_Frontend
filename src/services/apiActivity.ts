type Listener = (activeRequests: number) => void;

let activeRequests = 0;
const listeners = new Set<Listener>();

function publish() {
  listeners.forEach((listener) => listener(activeRequests));
}

export function beginApiActivity() {
  activeRequests += 1;
  publish();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    activeRequests = Math.max(0, activeRequests - 1);
    publish();
  };
}

export function subscribeToApiActivity(listener: Listener) {
  listeners.add(listener);
  listener(activeRequests);
  return () => {
    listeners.delete(listener);
  };
}
