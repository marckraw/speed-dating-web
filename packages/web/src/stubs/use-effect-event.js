// stubs/use-effect-event.js
import * as React from "react";

export function useEffectEvent(handler) {
  const handlerRef = React.useRef(handler);
  React.useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  return React.useCallback((...args) => {
    return handlerRef.current(...args);
  }, []);
}
