/**
 * Touchpoint & deal attribution engine.
 */
export const calculateAttribution = (touchpoints = []) => {
  if (touchpoints.length === 0) return {};

  const total = touchpoints.length;
  const firstTouch = touchpoints[0];
  const lastTouch = touchpoints[touchpoints.length - 1];

  const linearWeight = 1 / total;

  return {
    firstTouch: { ...firstTouch, weight: 1.0 },
    lastTouch: { ...lastTouch, weight: 1.0 },
    linear: touchpoints.map((tp) => ({ ...tp, weight: linearWeight }))
  };
};

export default { calculateAttribution };
