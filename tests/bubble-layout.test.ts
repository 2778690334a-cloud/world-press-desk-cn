import test from "node:test";
import assert from "node:assert/strict";
import { layoutBubbles } from "../app/lib/bubble-layout.ts";

test("hotspot bubbles fit mobile, drawer and desktop without hiding or overlapping topics", () => {
  for (const [width, height] of [[300, 360], [350, 420], [460, 360], [720, 490]]) {
    for (const counts of [[90, 50, 35, 20, 18, 12, 9, 8, 7, 6, 4, 1], Array(12).fill(1), [200], [1000, 1, 1, 1, 1]]) {
      const circles = layoutBubbles(counts, width, height);
      assert.equal(circles.length, counts.length);
      for (const [index, circle] of circles.entries()) {
        assert.ok(circle.x - circle.radius >= 0 && circle.x + circle.radius <= width);
        assert.ok(circle.y - circle.radius >= 0 && circle.y + circle.radius <= height);
        assert.ok(circle.radius * 2 >= 44, "bubble remains a usable touch target");
        for (const other of circles.slice(index + 1)) assert.ok(Math.hypot(circle.x - other.x, circle.y - other.y) >= circle.radius + other.radius);
      }
    }
  }
});
