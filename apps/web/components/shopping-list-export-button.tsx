"use client";

type ShoppingListExportButtonProps = {
  items: Array<{ name: string; quantity: string; category: string; estimatedCost: string }>;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ShoppingListExportButton({ items }: ShoppingListExportButtonProps) {
  function handleExport() {
    const lines = items.map(
      (item) => `${item.name} - ${item.quantity} (${item.category}) - ${item.estimatedCost}`
    );
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `shopping-list-${todayIsoDate()}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return (
    <button type="button" className="atlas-button" onClick={handleExport} disabled={items.length === 0}>
      Export as .txt
    </button>
  );
}
