import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { useScrollRetention } from "./useScrollRetention";

afterEach(() => {
  document.body.innerHTML = "";
});

interface TestComponentProps {
  items: string[];
  filter: string;
}

function TestComponent({ items, filter }: TestComponentProps) {
  const { viewportRef, handleScroll, resetScroll } = useScrollRetention(items, filter);

  return (
    <div>
      <button type="button" onClick={resetScroll}>
        Reset
      </button>
      <div
        ref={viewportRef}
        onScroll={handleScroll}
        data-testid="viewport"
        style={{ height: "100px", overflowY: "auto" }}
      >
        {items.map((item) => (
          <div key={item} style={{ height: "50px" }}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

async function mount(element: React.JSX.Element) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, root };
}

it("retains scroll position across data updates without trigger changes", async () => {
  const { host, root } = await mount(
    <TestComponent items={["item-1", "item-2", "item-3", "item-4"]} filter="all" />,
  );

  const viewport = host.querySelector('[data-testid="viewport"]') as HTMLDivElement;
  expect(viewport).not.toBeNull();

  // Simulate scrolling
  viewport.scrollTop = 120;
  await act(async () => {
    viewport.dispatchEvent(new Event("scroll"));
  });

  // Data updates (e.g. mutation or in-place refresh)
  await act(async () => {
    root.render(
      <TestComponent items={["item-1", "item-2", "item-3", "item-4", "item-5"]} filter="all" />,
    );
  });

  expect(viewport.scrollTop).toBe(120);
});

it("resets scroll position to 0 when filter triggers change", async () => {
  const { host, root } = await mount(
    <TestComponent items={["item-1", "item-2", "item-3", "item-4"]} filter="all" />,
  );

  const viewport = host.querySelector('[data-testid="viewport"]') as HTMLDivElement;
  expect(viewport).not.toBeNull();

  viewport.scrollTop = 150;
  await act(async () => {
    viewport.dispatchEvent(new Event("scroll"));
  });

  // Filter changes
  await act(async () => {
    root.render(
      <TestComponent items={["item-1", "item-3"]} filter="active" />,
    );
  });

  expect(viewport.scrollTop).toBe(0);
});
