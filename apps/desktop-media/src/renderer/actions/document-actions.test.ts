import { describe, expect, it, vi } from "vitest";
import { createDocumentActions } from "./document-actions";

describe("createDocumentActions", () => {
  it("delegates count and list to desktop API", async () => {
    const api = {
      countInvoiceReceiptDocuments: vi.fn().mockResolvedValue(3),
      listInvoiceReceiptDocuments: vi.fn().mockResolvedValue({ total: 1, rows: [] }),
    };
    const actions = createDocumentActions(api);
    await expect(actions.loadInvoiceReceiptCatalogCount()).resolves.toBe(3);
    await actions.loadInvoiceReceiptDocuments({ page: 1, pageSize: 24 });
    expect(api.listInvoiceReceiptDocuments).toHaveBeenCalledWith({ page: 1, pageSize: 24 });
  });
});
